/* ===== 실시간 실적 직결 =====
   통합 API(zen-integration-api)는 아직 배포되어 있지 않다. 대신 이미 가동 중인
   현장 앱 Worker(pbox-orikon-db)를 플랫폼이 직접 읽어 KPI를 만든다.
   집계식은 integration/src/index.js 의 aggregateWork 와 동일 —
   공동작업("A+B")은 worker_count 로 나눠 개인 실적에 분배한다.
   실패하면 조용히 기준 시드로 남는다(오프라인 시연 유지). */
const WORK_API='https://pbox-orikon-db.hodoo0831.workers.dev';
const _r1=n=>Math.round(n*10)/10;
function aggWork(rows){
  const recs=(rows||[]).map(r=>{
    const ws=String(r.worker||'').split(/[+,·]/).map(x=>x.trim()).filter(Boolean);
    return {date:String(r.date||r.created_at||'').slice(0,10),workers:ws,wc:(+r.worker_count||0)||ws.length||1,
      part:r.part||'미구분',type:r.work_type||'기타',
      plt:+r.qty_plt||0,ea:+r.qty_ea||0,mh:+r.man_hour||0};});
  const totalPLT=_r1(recs.reduce((a,r)=>a+r.plt,0)), totalEA=recs.reduce((a,r)=>a+r.ea,0);
  const totalMH=_r1(recs.reduce((a,r)=>a+r.mh,0));
  const days=new Set(recs.map(r=>r.date).filter(Boolean)).size;
  const grp=k=>{const m={};recs.forEach(r=>{const x=r[k]||'기타';m[x]=_r1((m[x]||0)+r.plt);});return m;};
  const wm={};
  recs.forEach(r=>{const d=r.wc||r.workers.length||1;
    r.workers.forEach(w=>{const o=wm[w]||(wm[w]={name:w,mh:0,plt:0,ea:0});o.plt+=r.plt/d;o.mh+=r.mh/d;o.ea+=r.ea/d;});});
  const workers=Object.values(wm).map(w=>({name:w.name,mh:_r1(w.mh),plt:_r1(w.plt),ea:Math.round(w.ea),
    pltPerMH:w.mh?+(w.plt/w.mh).toFixed(2):0})).sort((a,b)=>b.plt-a.plt);
  /* 일자별 실투입 — 인력 판단용(같은 사람이 여러 건이면 1명으로) */
  const bd={};
  recs.forEach(r=>{if(!r.date)return;const o=bd[r.date]||(bd[r.date]={set:new Set(),mh:0,plt:0});
    r.workers.forEach(w=>o.set.add(w)); o.mh+=r.mh; o.plt+=r.plt;});
  const byDay={};Object.keys(bd).forEach(d=>{const o=bd[d];
    byDay[d]={n:o.set.size,names:[...o.set],mh:_r1(o.mh),plt:_r1(o.plt)};});
  const dm={};recs.forEach(r=>{if(r.date)dm[r.date]=_r1((dm[r.date]||0)+r.plt);});
  const dmh={};recs.forEach(r=>{if(r.date)dmh[r.date]=_r1((dmh[r.date]||0)+r.mh);});
  const daily=Object.keys(dm).sort().map(d=>({date:d,plt:dm[d],mh:dmh[d]||0,
    pltPerMH:dmh[d]?+(dm[d]/dmh[d]).toFixed(2):0}));
  return {records:recs.length,totalPLT,totalEA,totalMH,days,byDay,
    pltPerMH:totalMH?+(totalPLT/totalMH).toFixed(2):0,
    eaPerMH:totalMH?Math.round(totalEA/totalMH):0,
    dailyAvgPLT:days?_r1(totalPLT/days):0,byPart:grp('part'),byType:grp('type'),workers,daily};
}
async function fetchSystem(name,ms){
  const ac=('AbortController' in window)?new AbortController():null;
  const tm=ac?setTimeout(()=>ac.abort(),ms||12000):null;
  try{
    const r=await fetch(WORK_API+'/records?system='+encodeURIComponent(name)+'&limit=5000&_t='+Date.now(),
      {cache:'no-store',signal:ac?ac.signal:undefined});
    if(!r.ok)throw new Error('HTTP '+r.status);
    const j=await r.json();
    if(!j||!j.ok||!Array.isArray(j.records))throw new Error('응답 형식 오류');
    return j.records;
  }finally{ if(tm)clearTimeout(tm); }
}
let liveErr='', liveAt=0, _liveTimer=null, _liveSig='';
function liveErrText(e){
  const m=String((e&&(e.message||e.name))||e||'');
  if(/abort/i.test(m))return '응답 시간 초과(12초)';
  if(/Failed to fetch|NetworkError|Load failed/i.test(m))return '네트워크 차단 또는 오프라인 — 브라우저가 요청을 막았을 수 있습니다';
  return m||'알 수 없는 오류';
}
/* ===== 세척 실측 직결 =====
   세척실 앱은 wash-db 와 5초마다 통신하는데 그 값이 플랫폼 판단으로는
   넘어오지 않아, '세척 우선순위'가 코드에 박힌 시드로 계산되고 있었다.
   GET /api/state 를 직접 읽어 대기·세척중·완료 실적을 판단 근거로 쓴다.
   실패하면 조용히 시드를 유지한다(오프라인 시연 보존). */
const WASH_API='https://wash-db.hodoo0831.workers.dev';
let WASHLIVE=null;           /* {waiting:[],washing:[],records:[],at} · null이면 미연결 */
function washLineKey(n){return String(n||'').replace(/\s+/g,'');}
/* 세척실 라인명 → 플랫폼 라인군 키 */
function washGrpToLine(g,name){
  const t=washLineKey(g)+washLineKey(name);
  if(/튜브/.test(t))return '튜브';
  if(/치약/.test(t))return '치약충전';
  if(/일회용/.test(t))return '일회용';
  if(/초격차|세정자동/.test(t))return '초격차';
  if(/염모|산화|파우치|멀티|크림|팜플|턴테이블/.test(t))return 'HnB';
  if(/직선|리필|대용량/.test(t))return 'FnC';
  return null;
}
async function fetchWash(ms){
  const ac=('AbortController' in window)?new AbortController():null;
  const tm=ac?setTimeout(()=>ac.abort(),ms||12000):null;
  try{
    const r=await fetch(WASH_API+'/api/state?_t='+Date.now(),{cache:'no-store',signal:ac?ac.signal:undefined});
    if(!r.ok)throw new Error('HTTP '+r.status);
    const j=await r.json();
    if(!j||!j.ok||!j.data)throw new Error('응답 형식 오류');
    const d=j.data;
    return {waiting:Object.values(d.waiting||{}),washing:Object.values(d.washing||{}),
            records:Array.isArray(d.records)?d.records:[],at:j.updatedAt||Date.now()};
  }finally{ if(tm)clearTimeout(tm); }
}
/* 라인별 실측 세척 지표 — 대기 건수·최장 대기(분)·최근 완료 경과(h) */
function washStats(){
  if(!WASHLIVE)return null;
  const now=Date.now(), M={};
  const put=(k)=>M[k]||(M[k]={wait:0,waitMax:0,washing:0,lastEndH:null});
  WASHLIVE.waiting.forEach(w=>{const k=washGrpToLine(w.group,w.line);if(!k)return;
    const o=put(k);o.wait++;
    const t=Date.parse(w.arrivedAt||'');if(t){o.waitMax=Math.max(o.waitMax,Math.round((now-t)/60000));}});
  WASHLIVE.washing.forEach(w=>{const k=washGrpToLine(w.group,w.line);if(k)put(k).washing++;});
  WASHLIVE.records.forEach(r=>{const k=washGrpToLine(r.group,r.line);if(!k)return;
    const t=Date.parse(r.endTime||'');if(!t)return;
    const h=(now-t)/3600000; const o=put(k);
    if(o.lastEndH==null||h<o.lastEndH)o.lastEndH=+h.toFixed(1);});
  return M;
}
async function washRefresh(silent){
  try{
    WASHLIVE=await fetchWash();
    washErr='';
    if(typeof cur!=='undefined'&&cur)go(cur);
    if(!silent)toast(`세척 실측 연결 — 대기 ${WASHLIVE.waiting.length} · 세척중 ${WASHLIVE.washing.length} · 완료 ${WASHLIVE.records.length}건`);
    return true;
  }catch(e){
    washErr=liveErrText(e);
    if(!silent)toast('세척실 서버에 닿지 않아 기준 데이터를 유지합니다 — '+washErr);
    return false;
  }
}
let washErr='';
/* ===== 안전(온열) 실측 직결 =====
   폭염 판단의 WBGT·기온·습도가 DB.safety 시드로 고정되어 있었다.
   히트워치가 쓰는 기상 중계 Worker를 플랫폼도 직접 읽는다.
   산식(습구온도·체감)은 히트워치와 동일한 것을 사용해 두 화면 값이 어긋나지 않게 한다. */
const KMA_API='https://kma-proxy.hodoo0831.workers.dev';
const SITE_LOC={lat:36.383,lon:127.408};   /* 사업장 좌표 */
let HEATLIVE=null, heatErr='';
function _wetBulb(Ta,RH){return Ta*Math.atan(0.151977*Math.sqrt(RH+8.313659))
  +Math.atan(Ta+RH)-Math.atan(RH-1.67633)
  +0.00391838*Math.pow(RH,1.5)*Math.atan(0.023101*RH)-4.686035;}
function _apparent(Ta,RH){const Tw=_wetBulb(Ta,RH);
  return -0.2442+0.55399*Tw+0.45535*Ta-0.0022*Tw*Tw+0.00278*Tw*Ta+3.0;}
async function fetchHeat(ms){
  const ac=('AbortController' in window)?new AbortController():null;
  const tm=ac?setTimeout(()=>ac.abort(),ms||12000):null;
  try{
    const r=await fetch(KMA_API+'?lat='+SITE_LOC.lat+'&lon='+SITE_LOC.lon,{cache:'no-store',signal:ac?ac.signal:undefined});
    if(!r.ok)throw new Error('HTTP '+r.status);
    const j=await r.json();
    if(j.temp==null||j.rh==null)throw new Error('실황 값 없음');
    const t=+j.temp, h=+j.rh;
    return {temp:+t.toFixed(1),humid:Math.round(h),
            wbgt:+_apparent(t,h).toFixed(1),
            stamp:(j.baseTime||'').replace(/(\d{2})(\d{2})/,'$1:$2'),at:Date.now()};
  }finally{ if(tm)clearTimeout(tm); }
}
async function heatRefresh(silent){
  try{
    HEATLIVE=await fetchHeat(); heatErr='';
    /* 판단·화면이 모두 DB.safety 를 보므로 실측으로 덮는다(무재해일 등 나머지는 유지) */
    DB.safety.temp=HEATLIVE.temp; DB.safety.humid=HEATLIVE.humid; DB.safety.wbgt=HEATLIVE.wbgt;
    if(typeof cur!=='undefined'&&cur)go(cur);
    if(!silent)toast(`기상 실측 연결 — ${HEATLIVE.temp}℃ · 습도 ${HEATLIVE.humid}% · 체감 ${HEATLIVE.wbgt}℃`);
    return true;
  }catch(e){
    heatErr=liveErrText(e);
    if(!silent)toast('기상 서버에 닿지 않아 기준 데이터를 유지합니다 — '+heatErr);
    return false;
  }
}
/* ===== 창고 적치 실측 직결 =====
   적치 판단이 주 1회 점검표 업로드(없으면 시드)로만 돌아, 주중 변화를 못 봤다.
   창고 앱이 쓰는 Worker의 /api/state 를 플랫폼도 읽어 구역별 적치를 실시간으로 받는다.
   주소는 앱과 마찬가지로 사용자가 등록한다(코드에 하드코딩된 값이 없음). */
/* 주소는 창고 시스템 config.js 의 ZEN_WH_API 와 같은 값. 필요하면 화면에서 바꿀 수 있다. */
const WH_API_DEFAULT='https://wh-stack.hodoo0831.workers.dev';
let WH_API=WH_API_DEFAULT;
try{const _v=localStorage.getItem('zen_wh_api'); if(_v!=null)WH_API=_v;}catch(e){}
function whSetApi(){const el=document.getElementById('whApi');WH_API=(el&&el.value||'').trim();
  try{localStorage.setItem('zen_wh_api',WH_API);}catch(e){}
  if(WH_API)whRefresh(false); else {WHLIVE=null;whErr='';rerender();toast('창고 실시간 연결 해제');}}
function whResetApi(){WH_API=WH_API_DEFAULT;try{localStorage.removeItem('zen_wh_api');}catch(e){}
  const el=document.getElementById('whApi'); if(el)el.value=WH_API; whRefresh(false);}
let WHLIVE=null, whErr='';
/* 창고 작업자 앱의 구역 마스터(worker.html ZD) — 키·이름·기준 CAPA.
   구버전 통합키 oc1 은 로케이션명으로 튜브/비튜브를 갈라 oc1t/oc1p 로 넘긴다. */
const WH_APP_ZONES=[
  ['hnb1','HnB동 1층',627],['fnc2','FnC동 2층 튜브',242],['fnc3','FnC동 3층 염모제',155],
  ['lbox','L동 박스창고',481],['jig','J동 공작반 2층',85],['tent','임가공[천막]',148],
  ['oc1p','OC동 1층 종이상자+기타',136],['oc1t','OC동 1층 튜브',72],
  ['ocb','OC동 지하 A구역',136],['ocbb','OC동 지하 B구역',37],
  ['occ','OC동 지하 C구역',12],['cloud','클라우드동',38]];
const _isTubeLoc=l=>/튜브|4R-?04/.test(String(l||''));
async function _whGet(path,ms){
  const base=WH_API.replace(/\/+$/,'');
  const ac=('AbortController' in window)?new AbortController():null;
  const tm=ac?setTimeout(()=>ac.abort(),ms||12000):null;
  try{
    const r=await fetch(base+path,{cache:'no-store',signal:ac?ac.signal:undefined});
    if(!r.ok)throw new Error('HTTP '+r.status);
    const j=await r.json();
    if(!j||!j.ok)throw new Error('응답 형식 오류');
    return j;
  }finally{ if(tm)clearTimeout(tm); }
}
/* 적치 점검은 주 1회다 — 오늘 날짜로 조회하면 대개 빈 값이 온다.
   최근 기준일 목록에서 가장 최신 날짜를 잡아 그 날짜로 읽는다. */
async function fetchWh(ms){
  if(!WH_API)throw new Error('주소 미등록');
  let date='';
  try{const d=await _whGet('/api/dates',ms);
    const rows=(d.dates||[]).filter(x=>x&&x.date&&x.zones>0);
    if(rows.length)date=rows[0].date;
  }catch(e){/* 목록 조회 실패 시 오늘로 시도 */}
  if(!date){const n=new Date(Date.now()+9*3600e3);date=n.toISOString().slice(0,10);}
  const j=await _whGet('/api/state?date='+encodeURIComponent(date),ms);
  j.date=j.date||date;
  return j;
}
/* 창고 앱 실측 → 구역별 적치. CAPA 도 앱이 기록한 값을 쓴다(없으면 구역 기준 CAPA). */
function whLiveZones(){
  if(!WHLIVE)return null;
  const items=WHLIVE.items||{};
  const acc={}; WH_APP_ZONES.forEach(([k,n,c])=>acc[k]={key:k,name:n,capa:0,count:0,got:false,tcap:c});
  const add=(k,qty,capa)=>{const z=acc[k];if(!z)return;z.count+=qty;z.capa+=capa;z.got=true;};
  Object.keys(items).forEach(k=>{
    const rows=items[k]||[];
    if(k==='oc1'){ rows.forEach(x=>add(_isTubeLoc(x.loc)?'oc1t':'oc1p',+x.qty||0,+x.capa||0)); return; }
    rows.forEach(x=>add(k,+x.qty||0,+x.capa||0));
  });
  const out=WH_APP_ZONES.map(([k])=>acc[k]).filter(z=>z.got)
    .map(z=>{const capa=z.capa>0?z.capa:z.tcap;
      return {name:z.name,count:z.count,capa,rate:capa?Math.round(z.count/capa*100):0,live:true};});
  return out.length?out:null;
}
function whLiveDate(){return (WHLIVE&&WHLIVE.date)||'';}
/* 적치 구역 단일 진입점 — 실측(창고 앱) > 업로드 엑셀 > 기준 시드.
   실측이 있으면 창고 앱의 구역 마스터를 그대로 쓴다. 시드 구역명에 억지로
   맞추면 앱에만 있는 구역(클라우드동)이 사라지고, 앱에 없는 시드 구역은
   낡은 값으로 남아 섞인다. */
function whZones(){
  if(whWeek===0){const lv=whLiveZones(); if(lv)return lv;} /* 지난 주차를 보는 중이면 실측으로 덮지 않는다 */
  const src=DB.wh?((DB.wh.weeks[whWeek]||DB.wh.weeks[0]).zones):DEFAULT_WH_ZONES;
  return src.map(z=>({name:z.name,count:z.count,capa:z.capa,
    rate:z.rate!=null?z.rate:(z.capa?Math.round(z.count/z.capa*100):0),live:false}));
}
function whZoneTotal(zs){const c=zs.reduce((a,z)=>a+z.count,0),p=zs.reduce((a,z)=>a+z.capa,0);
  return {count:c,capa:p,rate:p?Math.round(c/p*100):0};}
function whLiveN(){return whZones().filter(z=>z.live).length;}
async function whRefresh(silent){
  if(!WH_API){WHLIVE=null;return false;}
  try{
    WHLIVE=await fetchWh(); whErr='';
    if(typeof cur!=='undefined'&&cur)go(cur);
    if(!silent)toast('창고 실측 연결 — '+(whLiveDate()||'')+' 점검 '+whLiveN()+'개 구역');
    return true;
  }catch(e){
    whErr=liveErrText(e);
    if(!silent)toast('창고 서버에 닿지 않아 기준 데이터를 유지합니다 — '+whErr);
    return false;
  }
}
/* ===== 인력 실측 — 간접작업(P-BOX·오리콘) 실적의 작업자·공수에서 산출 =====
   라인 생산 인원은 출퇴근·배치를 기록하는 연결 시스템이 없어 여기 포함되지 않는다. */
function laborLive(){
  if(LIVE.status!=='live')return null;
  const K=(LIVE.today||{}).kpi||{}, A=[(K.pbox||{}).byDay||{},(K.orikon||{}).byDay||{}];
  const days=[...new Set([].concat(...A.map(Object.keys)))].sort();
  if(!days.length)return null;
  const at=d=>{const nm=new Set();let mh=0;
    A.forEach(b=>{const o=b[d];if(!o)return;(o.names||[]).forEach(w=>nm.add(w));mh+=o.mh||0;});
    return {date:d,n:nm.size,mh:_r1(mh),names:[...nm]};};
  const last=at(days[days.length-1]);
  const trend=days.slice(-7).map(at);
  const avg=trend.length?+(trend.reduce((a,x)=>a+x.n,0)/trend.length).toFixed(1):last.n;
  return Object.assign(last,{trend,avg,perHead:last.n?_r1(last.mh/last.n):0});
}
async function liveDirect(silent){
  try{
    /* 한쪽 시스템이 실패해도 나머지는 살린다 */
    const rs=await Promise.allSettled([fetchSystem('P-BOX'),fetchSystem('오리콘')]);
    const fails=rs.filter(r=>r.status==='rejected');
    if(fails.length===rs.length)throw fails[0].reason;
    const pb=rs[0].status==='fulfilled'?rs[0].value:[];
    const ok=rs[1].status==='fulfilled'?rs[1].value:[];
    if(!pb.length&&!ok.length)throw new Error('조회된 실적이 없습니다');
    liveErr=fails.length?('일부 실패: '+liveErrText(fails[0].reason)):'';
    const P=aggWork(pb), O=aggWork(ok);
    const worst=P.workers.filter(w=>w.mh>0).sort((a,b)=>a.pltPerMH-b.pltPerMH)[0];
    LIVE.today={asOf:new Date().toISOString(),kpi:{pbox:P,orikon:O},
      alerts:worst&&P.pltPerMH&&worst.pltPerMH<P.pltPerMH*0.7
        ?[{level:'warn',title:'P-BOX 생산성 편차',
           detail:`${worst.name} ${worst.pltPerMH} PLT/MH (평균 ${P.pltPerMH} 대비 ▼${Math.round((1-worst.pltPerMH/P.pltPerMH)*100)}%)`}]:[]};
    const sig=[P.records,P.totalPLT,P.totalMH,O.records,O.totalPLT,O.totalMH].join('|');
    const changed=(sig!==_liveSig); _liveSig=sig;
    LIVE.status='live'; dataSource='실시간 현장 앱'; LIVE.brief=localBrief(LIVE.today);
    liveAt=Date.now();
    syncSrcTag();
    /* 값이 바뀐 경우에만 다시 그린다 — 주기 갱신이 읽던 위치를 흔들지 않게 */
    if(changed&&typeof cur!=='undefined'&&cur)go(cur);
    if(!silent)toast(`실시간 연결 — P-BOX ${P.records}건 · 오리콘 ${O.records}건`);
    return true;
  }catch(e){
    liveErr=liveErrText(e);
    if(LIVE.status!=='live'){LIVE.status='demo';LIVE.brief=localBrief(LIVE.today);}
    syncSrcTag(); /* 재렌더하지 않는다 — 읽던 위치가 튄다 */
    if(!silent)toast('실시간 연결 실패 — '+liveErr);
    return false;
  }
}
/* 한 번 실패하고 끝나던 것을 재시도 + 주기 갱신으로 */
/* 실적·세척은 서로 다른 서버라 독립이다. 순차로 걸면 한쪽 재시도(최대 19초)가
   끝날 때까지 다른 쪽이 시작도 못 한다 → 병렬로 각자 재시도한다. */
async function retryUntil(fn){
  const waits=[0,2000,5000,12000];
  for(let i=0;i<waits.length;i++){
    if(waits[i])await new Promise(r=>setTimeout(r,waits[i]));
    if(await fn(true))return true;
  }
  return false;
}
async function liveStart(){
  await Promise.allSettled([retryUntil(liveDirect),retryUntil(washRefresh),retryUntil(heatRefresh),retryUntil(whRefresh),retryUntil(actSync)]);
  if(_liveTimer)clearInterval(_liveTimer);
  _liveTimer=setInterval(()=>{liveDirect(true);washRefresh(true);heatRefresh(true);whRefresh(true);actSync(true);},60000);
}
function liveRetry(){toast('실시간 연결을 다시 시도합니다…');liveDirect(false);}
async function liveRefresh(){
  if(!LIVE.apiBase){LIVE.status='demo';LIVE.brief=localBrief(LIVE.today);if(cur==='home')go('home');return;}
  const base=LIVE.apiBase.replace(/\/+$/,'');
  LIVE.status='loading';if(cur==='home')go('home');
  try{
    const t=await fetch(base+'/today').then(r=>r.json());
    if(t&&t.kpi){LIVE.today=t;LIVE.status='live';}else throw new Error('bad');
    try{const b=await fetch(base+'/brief').then(r=>r.json());LIVE.brief={oneLine:b.oneLine,kakao:b.kakao,model:b.model};}catch(e){LIVE.brief=localBrief(LIVE.today);}
  }catch(e){LIVE.status='error';LIVE.brief=localBrief(LIVE.today);}
  if(cur==='home')go('home');
}
function liveSetApi(){const el=document.getElementById('liveApi');LIVE.apiBase=(el&&el.value||'').trim();try{localStorage.setItem('zen_live_api',LIVE.apiBase);}catch(e){}LIVE._tried=true;toast(LIVE.apiBase?'라이브 서버 연결 시도…':'연결 해제(기준값)');liveRefresh();}
function liveDisconnect(){LIVE.apiBase='';try{localStorage.removeItem('zen_live_api');}catch(e){}LIVE.status='demo';LIVE.brief=localBrief(LIVE.today);toast('라이브 연결 해제(기준 스냅샷)');if(cur==='home')go('home');}
function liveSys(s){LIVE.sys=s;if(cur==='home')go('home');}
function copyBrief(){const t=(LIVE.brief&&LIVE.brief.kakao)||localBrief(LIVE.today).kakao;copyText(t,'카톡 보고문을 복사했습니다');}
function liveConnectPrompt(){const e=document.getElementById('liveConn');if(e)e.scrollIntoView({behavior:'smooth'});}
function renderLive(){
  if(LIVE.apiBase&&!LIVE._tried){LIVE._tried=true;setTimeout(liveRefresh,60);}
  const d=LIVE.today||LIVE_SEED,k=d.kpi||{};
  const sys=(LIVE.sys==='orikon')?'orikon':'pbox';
  const c=k[sys]||k.pbox||{};
  const badge=LIVE.status==='live'?'<span class="tag t-green">● LIVE</span>':LIVE.status==='loading'?'<span class="tag t-amber">연결 중…</span>':LIVE.status==='error'?'<span class="tag t-red">연결 실패·기준</span>':'<span class="tag t-blue">실데이터 스냅샷</span>';
  const tab=(id,label)=>`<button class="btn ${sys===id?'p':''}" style="padding:5px 11px" onclick="liveSys('${id}')">${label}</button>`;
  const kt=`<div class="grid g4" style="margin-bottom:10px">
    <div class="kpi"><div class="ic" data-ic="package"></div><div class="lab">총 작업량 <span class="tag t-blue" style="margin-left:4px;font-size:10px">가동 1주차</span></div><div class="val">${(c.totalEA||0).toLocaleString()}<small> EA</small></div><div class="delta">${fmtN(c.totalPLT)} PLT · 월 환산 ≈ ${((c.totalEA||0)&&c.days?Math.round((c.totalEA/c.days)*22/1000)+'천':'-')} EA</div></div>
    <div class="kpi"><div class="ic" data-ic="clock"></div><div class="lab">맨아워</div><div class="val">${fmtN(c.totalMH)}<small> MH</small></div><div class="delta">작업 ${c.days||0}일 · 월 환산 ≈ ${(c.totalMH&&c.days?Math.round(c.totalMH/c.days*22):'-')} MH</div></div>
    <div class="kpi"><div class="ic" data-ic="zap"></div><div class="lab">시간당 생산성</div><div class="val">${c.pltPerMH||0}<small> PLT/MH</small></div><div class="delta">${c.eaPerMH||0} EA/MH</div></div>
    <div class="kpi"><div class="ic" data-ic="clock"></div><div class="lab">일평균</div><div class="val">${fmtN(c.dailyAvgPLT)}<small> PLT</small></div><div class="delta">기록 ${c.records||0}건</div></div>
  </div>`;
  const wk=(c.workers||[]).map(w=>`<tr><td>${w.name}</td><td>${fmtN(w.mh)}</td><td>${fmtN(w.plt)}</td><td>${(w.ea||0).toLocaleString()}</td><td style="color:${w.pltPerMH>=(c.pltPerMH||0)?'#22a05f':'#d98a2b'};font-weight:700">${w.pltPerMH}</td></tr>`).join('');
  const parts=c.byPart?Object.entries(c.byPart):[],pmax=Math.max(1,...parts.map(p=>p[1]));
  const types=c.byType?Object.entries(c.byType):[],tmax=Math.max(1,...types.map(p=>p[1]));
  const bar=(n,v,mx,col)=>`<div class="barrow" style="grid-template-columns:52px 1fr 44px;padding:5px 0"><div class="nm" style="font-size:12px">${n}</div><div>${pbar(v/mx*100,col)}</div><div class="vv" style="font-size:12px">${fmtN(v)}</div></div>`;
  const partBars=parts.map(([n,v])=>bar(n,v,pmax,'#3f74b5')).join('');
  const typeBars=types.map(([n,v])=>bar(n,v,tmax,'#22a05f')).join('');
  const b=LIVE.brief||localBrief(d);
  const modelTag=(b.model&&b.model!=='rule-fallback')?b.model:'통합현황 자동요약';
  return `<div class="grid g2" style="grid-template-columns:1.45fr 1fr;margin-top:14px">
    <div class="card"><h3>P-BOX · 오리콘 통합 실적 ${badge}<span style="margin-left:auto;display:flex;gap:6px">${tab('pbox','P-BOX')}${tab('orikon','오리콘')}</span></h3>
      ${kt}
      <div style="margin-top:4px"><h3 style="font-size:12.5px">부위·유형별 (PLT)</h3><div class="grid g2" style="grid-template-columns:1fr 1fr;gap:14px"><div>${partBars||'<div class="mini">부위 구분 없음</div>'}</div><div>${typeBars}</div></div></div>
      <details class="zfold" style="margin-top:9px"><summary>작업자별 실적 · 공동작업 인원분배 상세</summary>
        <table class="tb" style="margin-top:8px"><thead><tr><th>작업자</th><th>MH</th><th>PLT</th><th>EA</th><th>PLT/MH</th></tr></thead><tbody>${wk}</tbody></table>
      </details>
    </div>
    <div class="card"><h3>AI 통합 브리핑 <span class="hint">${modelTag}</span><button class="btn" onclick="liveRefresh()">새로고침</button></h3>
      <div class="reco" style="margin-bottom:10px"><div class="ic" style="color:var(--accent)" data-ic="spark"></div><div class="tx"><div class="r">${(b.oneLine||'').replace(/</g,'&lt;')}</div><div class="s">데이터원: ${LIVE.status==='live'?'실시간 D1(work_records)':'실데이터 스냅샷'} · ${((d.asOf)||'').slice(0,16).replace('T',' ')}</div></div></div>
      <details class="zfold"><summary>카톡 보고문 미리보기</summary>
      <pre style="white-space:pre-wrap;background:#ffffff;border:1px solid var(--line2);border-radius:9px;padding:11px;font-size:12.5px;line-height:1.55;font-family:inherit;margin:8px 0 0">${(b.kakao||'').replace(/</g,'&lt;')}</pre>
      </details>
      <div style="display:flex;gap:8px;margin-top:10px"><button class="btn p" onclick="copyBrief()">보고문 복사</button><button class="btn" onclick="liveConnectPrompt()">라이브 연결</button></div>
    </div>
  </div>
  <details class="zfold card" id="liveConn" style="margin-top:14px;padding:12px 16px"><summary>라이브 연결 설정 — 통합 API 주소를 붙이면 실시간 전환 <b style="color:${LIVE.status==='live'?'#22a05f':'#5f6d77'}">(${LIVE.status==='live'?'연결됨 ✓':'미연결 · 스냅샷'})</b></summary>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px"><input id="liveApi" type="text" value="${(LIVE.apiBase||'').replace(/"/g,'&quot;')}" placeholder="https://zen-integration-api.○○○.workers.dev" style="flex:1;min-width:240px;border:1px solid var(--line2);border-radius:8px;padding:9px 11px;font-size:13px;font-family:inherit"><button class="btn p" onclick="liveSetApi()">연결</button><button class="btn" onclick="liveDisconnect()">해제</button></div>
    <div class="mini" style="margin-top:6px">배포: <code>integration/</code> 폴더에서 <code>wrangler deploy</code> → 나온 주소를 여기 붙이기</div>
  </details>`;
}

