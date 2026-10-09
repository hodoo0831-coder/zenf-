/* ============ DATA MANAGEMENT (실데이터 연동) ============ */
const EDIT_COLS=[
  {k:'need',t:'필요'},{k:'on',t:'출근'},{k:'leave',t:'연차'},{k:'edu',t:'교육'},
  {k:'target',t:'목표'},{k:'actual',t:'실적'},{k:'capa',t:'CAPA'},
  {k:'defect',t:'불량%'},{k:'clElapsed',t:'세척경과h'},{k:'clTransfer',t:'전환0~1'},
];
V.data=()=>{
  const rows=DB.lines.map((l,i)=>`<tr><td>${l.key}</td>${EDIT_COLS.map(c=>`<td><input type="number" step="any" value="${l[c.k]}" oninput="editLine(${i},'${c.k}',this.value)" onchange="editLineCommit(${i},'${c.k}',this)"></td>`).join('')}</tr>`).join('');
  return `
  <div class="grid g2" style="margin-bottom:14px">
    <div class="card"><h3>① 파일 가져오기 <span class="hint">.xlsx / .csv — 주간계획 · CAPA표 · 인원표 자동 인식</span></h3>
      <div class="drop" id="drop" onclick="document.getElementById('file').click()">
        <div style="font-size:30px"></div><div style="font-weight:700;margin-top:6px">엑셀·CSV 파일을 끌어놓거나 클릭</div>
        <div class="mini" style="margin-top:4px">라인 데이터(라인/필요/출근/목표/실적/CAPA/불량%…) 자동 매핑</div>
      </div>
      <input id="file" type="file" accept=".xlsx,.xls,.csv" style="display:none" onchange="importFile(this.files[0])">
      <div class="mini" style="margin-top:10px">현재 데이터원: <b id="srcNow" style="color:#1c5fa8">${dataSource}</b></div>
    </div>
    <div class="card"><h3>② 템플릿 · 내보내기</h3>
      <p class="mini">양식 내려받아 값 채워 재업로드 · 헤더명 자동 인식.</p>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">
        <button class="btn p" onclick="exportXLSX()">↓ 엑셀 템플릿</button>
        <button class="btn" onclick="exportCSV()">↓ CSV</button>
        <button class="btn" onclick="resetDB()">↺ 기준값 복원</button>
      </div>
    </div>
    <div class="card"><h3>③ 실적 연동 <span class="hint">계획 대비 달성률</span></h3>
      <p class="mini" style="line-height:1.7">주간계획 업로드 후 <b>실적 파일</b>(오더번호 + 실적수량 헤더)을 올리면 오더별 달성률·<b>지연오더</b>가 자동 계산됩니다. 실적 파일이 없으면 시뮬레이션으로 즉시 확인하세요.</p>
      <input id="actfile" type="file" accept=".xlsx,.xls,.csv" style="display:none" onchange="importActual(this.files[0])">
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">
        <button class="btn p" onclick="document.getElementById('actfile').click()" ${DB.plan?'':'disabled style=\"opacity:.5\"'}>↑ 실적 파일 업로드</button>
        <button class="btn" onclick="simulateActual()" ${DB.plan?'':'disabled style=\"opacity:.5\"'}>▶ 실적 시뮬레이션</button>
      </div>
      <div class="mini" style="margin-top:8px">${DB.plan?(planHasActual()?' 실적 연동됨':'생산계획 로드됨 · 실적 대기'):' 먼저 주간 생산계획을 업로드하세요'}</div>
    </div>
    <div class="card"><h3>④ 창고 적치 실시간 <span class="hint">창고 앱 Worker</span></h3>
      <p class="mini" style="line-height:1.7">포장재 창고 적치 관리 시스템의 <b>Worker 주소</b>가 기본값으로 들어가 있습니다. 구역별 적치 수량을 60초마다 받아 <b>적치 초과 판단</b>이 자동으로 바뀝니다. 적치 점검은 주 1회라 <b>가장 최근 점검일</b>의 값을 읽습니다.</p>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">
        <input id="whApi" class="urlinp" value="${(WH_API||'').replace(/"/g,'&quot;')}" placeholder="https://....workers.dev" style="flex:1;min-width:200px">
        <button class="btn p" onclick="whSetApi()">연결</button>
        ${WH_API!==WH_API_DEFAULT?'<button class="btn" onclick="whResetApi()">기본값</button>':''}
      </div>
      <div class="mini" style="margin-top:8px">${WH_API?(WHLIVE?` 연결됨 · <b>${whLiveDate()||'-'}</b> 점검 ${whLiveN()}/${WH_APP_ZONES.length}구역 수신${whLiveN()<WH_APP_ZONES.length?' <span style="color:#b9922e">— 미제출 구역은 집계에서 빠집니다</span>':''}`:` 수신 대기${whErr?' — '+whErr:''}`):'미등록 — 기준·업로드 데이터로 판단합니다'}</div>
    </div>
    <div class="card"><h3>⑤ 조치 공유 <span class="hint">담당자와 같은 보드</span></h3>
      <p class="mini" style="line-height:1.7">조치 티켓과 이력을 <b>사업장 단위로 공유</b>합니다. 등록하지 않으면 조치가 이 브라우저에만 남아, 담당자를 지정해도 그 사람 화면에는 뜨지 않습니다. <b>zen-actions</b> Worker 배포 주소를 넣으세요(레포 <code>zen-actions/</code>).</p>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">
        <input id="actApi" class="urlinp" value="${(ACT_API||'').replace(/"/g,'&quot;')}" placeholder="https://zen-actions.....workers.dev" style="flex:1;min-width:200px">
        <button class="btn p" onclick="actSetApi()">연결</button>
      </div>
      <div class="mini" style="margin-top:8px">${(()=>{const L=actSyncLabel();return `<span style="color:${L.c};font-weight:700">${escHtml(L.t)}</span>`+(ACTSYNC.st==='ok'?` · 티켓 ${ACTSYNC.n}건 · 이력 ${(DB.actlog||[]).length}건`:'');})()}</div>
      <div class="mini" style="margin-top:6px"><span class="mut2">서버가 끊겨도 조치는 이 브라우저에 계속 저장되고, 연결되면 자동으로 합쳐집니다.</span></div>
    </div>
    <div class="card"><h3>⑥ MES/DB 연동 <span class="hint">참고</span></h3>
      <p class="mini">사내 MES·ERP 직접연동은 백엔드 프록시 필요 · 엑셀/CSV 업로드로 동일 대시보드 구동.</p>
    </div>
  </div>
  <div class="card"><h3>라인 데이터 직접 편집 <span class="hint">입력 중 화면을 다시 그리지 않습니다 · 다른 Agent는 이동 시 반영</span></h3>
    <div style="overflow-x:auto"><table class="edit"><thead><tr><th>라인</th>${EDIT_COLS.map(c=>`<th>${c.t}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></div>
    <div class="mini" style="margin-top:10px">전환(0~1): 0 동일제품 · 0.5 제품전환 · 1.0 색상전환+알러지 · 세척 점수식에 직접 반영</div>
  </div>
  <div class="card" style="margin-top:14px"><h3>⑦ 연동 시스템 (외부 배포 URL · 역할별) <span class="hint">관련 Agent 화면에 임베드 · 현장직=작업자용 / 반장·공장장=관리자용</span></h3>
    <div style="overflow-x:auto"><table class="tb"><thead><tr><th>시스템</th><th style="text-align:left">작업자용 URL</th><th style="text-align:left">관리자용 URL</th><th>표시 위치</th></tr></thead><tbody>
    ${(DB.extSys||[]).map(s=>{const u=s.urls||{};const inp=(which,val)=>`<input class="urlinp" style="width:100%;min-width:230px;padding:7px 9px" value="${(val||'').replace(/"/g,'&quot;')}" placeholder="https://..." onchange="setSysUrl('${s.id}','${which}',this.value)">`;
      const ag=(Array.isArray(s.agent)?s.agent:[s.agent]).map(a=>AGENTNAME[a]||a).join(' · ');
      return `<tr><td>${s.icon} ${s.name}</td><td style="text-align:left">${inp('worker',u.worker)}</td><td style="text-align:left">${inp('admin',u.admin)}</td><td><span class="chip">${ag}</span></td></tr>`;}).join('')}
    </tbody></table></div>
    <div class="mini" style="margin-top:8px">저장 시 역할별 URL이 세척/안전/창고 화면에 자동 임베드됩니다.</div>
  </div>`;
};
/* ===== 주간 생산계획 (실 엑셀 파싱) ===== */
let planWeek=0;
// 리소스(설비)명 → 공정(라인군) 매핑 규칙
const GROUP_RULES=[
  [/^튜브/,'튜브 라인'],[/^치약충전|^치약수/,'치약충전 라인'],[/^세정자동화/,'세정자동화 라인'],
  [/^직선/,'직선 라인'],[/^멀티셀|^멀티/,'멀티셀 라인'],[/염모|산화/,'염모·산화 라인'],
  [/세럼충전|^세럼/,'세럼충전 라인'],[/턴테이블/,'턴테이블 라인'],[/^팜플/,'팜플 라인'],[/^리필/,'리필 라인'],[/^로션|^크림/,'로션·크림 라인'],
];
function lineGroupOf(name){for(const[re,g]of GROUP_RULES)if(re.test(name))return g;return '기타 라인';}
/* ===== 실적(Actual) 연동 ===== */
function planHasActual(){return !!(DB.plan&&DB.plan.hasActual);}
function eachOrder(cb){if(!DB.plan)return;DB.plan.weeks.forEach((w,wi)=>w.resources.forEach(r=>r.orders.forEach(o=>cb(o,r,w,wi))));}
function groupActual(wk){const m={};wk.resources.forEach(r=>{const gn=lineGroupOf(r.name);r.orders.forEach(o=>{if(o.actual!=null)m[gn]=(m[gn]||0)+o.actual;});});return m;}
function delayedOrders(wk){return wk.resources.flatMap(r=>r.orders.filter(o=>o.actual!=null&&o.actual<o.qty).map(o=>({...o,res:r.name,group:lineGroupOf(r.name),short:o.qty-o.actual,ach:Math.round(o.actual/o.qty*100)}))).sort((a,b)=>b.short-a.short);}
function simulateActual(){
  if(!DB.plan)return toast('먼저 생산계획을 업로드하세요');
  const hash=o=>{let h=0;const s=String(o.orderNo);for(let i=0;i<s.length;i++)h=(h*31+s.charCodeAt(i))>>>0;return h;};
  eachOrder(o=>{const hh=hash(o)%100;
    const rate=hh<10?0.40+(hh/10)*0.30:hh<25?0.70+((hh-10)/15)*0.20:0.92+((hh-25)/75)*0.13;
    o.actual=Math.round(o.qty*rate);});
  DB.plan.hasActual=true;if(!/실적/.test(dataSource))dataSource+=' + 실적(시뮬)';saveDB();
  toast('실적 시뮬레이션 생성 완료 — 계획 대비 달성률 산출');rerender();go('delay');
}
const ACT_ORDER_KEYS=['오더번호','오더','오더no','orderno','order'];
const ACT_QTY_KEYS=['실적','실적수량','생산수량','양품수량','완료수량','생산실적'];
function importActual(file){
  if(!DB.plan)return toast('먼저 생산계획을 업로드하세요');
  const name=file.name.toLowerCase();const rd=new FileReader();
  rd.onload=e=>{try{
    let rows;
    if(name.endsWith('.csv'))rows=csvToRows(e.target.result);
    else{const wb=XLSX.read(e.target.result,{type:'binary'});rows=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{defval:''});}
    const idx={};eachOrder(o=>{idx[String(o.orderNo)]=o;});
    let n=0;rows.forEach(r=>{let on,q;Object.keys(r).forEach(h=>{const hn=String(h).trim().toLowerCase();if(ACT_ORDER_KEYS.includes(hn))on=String(r[h]).trim();if(ACT_QTY_KEYS.includes(String(h).trim()))q=+r[h];});
      if(on&&idx[on]&&!isNaN(q)){idx[on].actual=q;n++;}});
    if(n>0){DB.plan.hasActual=true;if(!/실적/.test(dataSource))dataSource+=' + 실적';saveDB();toast(n+'건 오더 실적 반영');rerender();go('delay');}
    else toast('매칭되는 오더번호가 없습니다 (오더번호/실적수량 헤더 확인)');
  }catch(err){toast('실적 파싱 실패: '+err.message);}};
  if(name.endsWith('.csv'))rd.readAsText(file);else rd.readAsBinaryString(file);
}
function buildGroups(resources){
  const gm={};
  resources.forEach(r=>{const g=lineGroupOf(r.name);if(!gm[g])gm[g]={name:g,resCount:0,orderCount:0,weekTotal:0,daily:{},resources:[]};
    const G=gm[g];G.resCount++;G.orderCount+=r.orders.length;G.weekTotal+=r.weekTotal;G.resources.push(r.name);
    Object.entries(r.daily).forEach(([d,q])=>G.daily[d]=(G.daily[d]||0)+q);});
  return Object.values(gm).sort((a,b)=>b.weekTotal-a.weekTotal);
}
/* ===== 주간계획 업로드 → 전 화면 연쇄 반영 ===== */
const DASH_FROM_CAPA={튜브:'튜브',치약:'치약충전',초격차:'초격차',HnB기타:'HnB',염모:'HnB',멀티:'FnC'};
function dashKeyFromCapa(row){if(/일회용/.test(row[2]||''))return '일회용';return DASH_FROM_CAPA[row[1]]||null;}
function planToLoadMap(plan){
  const m={},wk=(plan&&plan.weeks&&plan.weeks[0])||null;if(!wk)return m;
  wk.resources.forEach(r=>{const code=(String(r.code||'').match(/\d{4,}/)||[])[0];if(!code)return;m[code]=(m[code]||0)+(r.weekTotal||0);});
  return m;
}
function applyLoadToLines(planMap,days){
  days=days||loadDays||6;const sums={};
  LMASTER().forEach(a=>{const k=dashKeyFromCapa(a);if(!k)return;sums[k]=(sums[k]||0)+(planMap[a[0]]||0);});
  let n=0;DB.lines.forEach(l=>{if(sums[l.key]==null)return;const t=Math.round(sums[l.key]/days);if(t>0){l.target=t;n++;}});
  return n;
}
function applyPlanCascade(plan,fileName,extraLoad){
  const map=(extraLoad&&Object.keys(extraLoad).length)?extraLoad:planToLoadMap(plan);
  if(plan&&plan.weeks&&plan.weeks.length){DB.plan=plan;planWeek=0;}
  if(Object.keys(map).length){
    loadPlan=map;loadFilter=null;loadPlanName=(fileName||'주간계획').replace(/\.[^.]+$/,'');
    DB.loadPlan=map;DB.loadPlanName=loadPlanName;DB.loadDays=loadDays;DB.loadBase=loadBase;
  }
  const nLines=applyLoadToLines(loadPlan,loadDays);
  const over=loadCalc(loadPlan,loadDays,loadBase).groups.filter(g=>g.load>=100).length;
  const opened=syncActionsFromJudgments();
  if(fileName)dataSource=fileName;
  saveDB();
  return {over,opened,nLines,codes:Object.keys(map).length,weeks:(plan&&plan.weeks)?plan.weeks.length:0};
}
function parsePlan(wb){
  const weeks=wb.SheetNames.map(sn=>{
    const a=XLSX.utils.sheet_to_json(wb.Sheets[sn],{header:1,defval:''});
    const hdr=a[0]||[];const dateCols=[];
    for(let i=3;i<hdr.length;i++){const v=String(hdr[i]).trim();if(/^\d{4}\.\d{2}\.\d{2}$/.test(v))dateCols.push({i,date:v});}
    const rm={};
    for(let r=1;r<a.length;r++){const row=a[r];const rname=String(row[2]||'').trim();
      if(!rname||rname.endsWith('합계'))continue;
      if(!rm[rname])rm[rname]={code:String(row[1]||'').trim(),name:rname,daily:{},orders:[],weekTotal:0};
      const res=rm[rname];
      if(String(row[3]||'').includes('오더')){
        dateCols.forEach(dc=>{const qty=+row[dc.i+2];const on=row[dc.i+1];
          if(qty&&!isNaN(qty)){const prod=a[r+1]?String(a[r+1][dc.i+1]||'').trim():'';
            res.orders.push({date:dc.date,orderNo:String(on),qty,product:prod});
            res.daily[dc.date]=(res.daily[dc.date]||0)+qty;res.weekTotal+=qty;}});
      }}
    const resources=Object.values(rm).filter(r=>r.weekTotal>0).sort((x,y)=>y.weekTotal-x.weekTotal);
    return {name:sn,dates:dateCols.map(d=>d.date),resources,groups:buildGroups(resources)};
  }).filter(w=>w.resources.length);
  return {weeks};
}
function isPlanWB(wb){try{const a=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{header:1,defval:''});return a[0]&&/리소스/.test(String(a[0][0])+String(a[0][1]));}catch(e){return false;}}
/* ===== 창고 구역별 적치 점검(주1회) ===== */
let whWeek=0;
function fmtWk(s){s=String(s).trim();return /^\d{4}$/.test(s)?s.slice(0,2)+'/'+s.slice(2):s;}
function isWhWB(wb){try{const a=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{header:1,defval:''});return /적치|포장재창고|적재\s*CAPA/.test(a.slice(0,5).map(r=>r.join('')).join(''));}catch(e){return false;}}
function parseWarehouse(wb){
  const weeks=wb.SheetNames.map(sn=>{
    const a=XLSX.utils.sheet_to_json(wb.Sheets[sn],{header:1,defval:''});
    const zones=[];let total=null,cg='';
    for(let r=5;r<a.length;r++){const row=a[r];const g=String(row[0]||'').trim();const area=String(row[1]||'').replace(/[\r\n]+/g,' ').trim();
      if(g==='계'){total={capa:+row[2],max:+row[3],count:+row[4]};break;}
      if(g)cg=g;const capa=+row[2],max=+row[3],count=+row[4];
      if(!isNaN(capa)&&capa>0){const cnt=isNaN(count)?0:count;
        zones.push({name:(cg+(area?' '+area:'')).trim(),capa,max:isNaN(max)?capa:max,count:cnt,rate:Math.round(cnt/capa*100)});}}
    return {name:sn,label:fmtWk(sn),zones,total};});
  return {weeks};
}
function whTotRate(w){return w.total&&w.total.capa?Math.round(w.total.count/w.total.capa*100):0;}
V.plan=()=>{
  if(!DB.plan)return `<div class="card"><h3>주간 생산계획</h3><p class="muted">아직 업로드된 생산계획이 없습니다. 주간 생산계획 엑셀(.xlsx)을 올리면 라인 목표·부하율·지연오더·조치가 한 번에 채워집니다.</p><button class="btn p" onclick="go('data')">데이터 관리에서 업로드 →</button></div>`;
  const wk=DB.plan.weeks[planWeek]||DB.plan.weeks[0];
  const tot=wk.resources.reduce((a,r)=>a+r.weekTotal,0);
  const ords=wk.resources.reduce((a,r)=>a+r.orders.length,0);
  const daily=wk.dates.map(d=>({label:d.slice(5),v:Math.round(wk.resources.reduce((a,r)=>a+(r.daily[d]||0),0)/1000)}));
  const maxR=Math.max(...wk.resources.map(r=>r.weekTotal));
  const resRows=wk.resources.slice(0,14).map((r,i)=>`<div class="barrow" style="grid-template-columns:130px 1fr 96px"><div class="nm">${r.name}</div><div>${pbar(r.weekTotal/maxR*100,'#3b82f6')}<div class="mini" style="margin-top:4px">${r.orders.length}오더 · ${Object.keys(r.daily).length}일 가동</div></div><div class="vv">${r.weekTotal.toLocaleString()}</div></div>`).join('');
  const allOrders=wk.resources.flatMap(r=>r.orders.map(o=>({...o,res:r.name}))).sort((a,b)=>a.date.localeCompare(b.date)||b.qty-a.qty);
  const HA=planHasActual();
  const oHead=HA?'<tr><th>일자</th><th>리소스</th><th>오더번호</th><th style="text-align:left">품명</th><th>계획</th><th>실적</th><th>달성률</th></tr>':'<tr><th>일자</th><th>리소스</th><th>오더번호</th><th style="text-align:left">품명</th><th>수량</th></tr>';
  const oRows=allOrders.slice(0,40).map(o=>{const base=`<td>${o.date.slice(5)}</td><td>${o.res}</td><td>${o.orderNo}</td><td style="text-align:left;max-width:${HA?260:340}px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${o.product||'-'}</td><td>${o.qty.toLocaleString()}</td>`;
    if(!HA)return `<tr>${base}</tr>`;
    const a=o.actual!=null?Math.round(o.actual/o.qty*100):null;const col=a==null?'':a<70?'#dc4b4b':a<90?'#d98a2b':'#22a05f';
    return `<tr>${base}<td>${o.actual!=null?o.actual.toLocaleString():'-'}</td><td style="color:${col}">${a!=null?a+'%':'-'}</td></tr>`;}).join('');
  const tabs=DB.plan.weeks.map((w,i)=>`<button class="btn ${i===planWeek?'p':''}" onclick="planWeek=${i};go('plan')">${w.name}</button>`).join(' ');
  const gmax=Math.max(...wk.groups.map(g=>g.weekTotal));
  const gAct=planHasActual()?groupActual(wk):null;
  const grpRows=wk.groups.map(g=>{
    const actInfo=gAct?(()=>{const av=gAct[g.name]||0;const a=Math.round(av/g.weekTotal*100);const col=a>=95?'#22a05f':a>=85?'#ffcf5a':'#dc4b4b';return `<span class="mut2" style="font-weight:700;color:${col}"> · 달성 ${a}%</span>`;})():'';
    return `<div class="barrow" style="grid-template-columns:150px 1fr 210px"><div class="nm">${g.name}</div><div>${pbar(g.weekTotal/gmax*100,'#14b8a6')}<div class="mini" style="margin-top:4px">리소스 ${g.resCount}대 · 오더 ${g.orderCount}건 · ${g.resources.slice(0,4).join(', ')}${g.resources.length>4?' 외 '+(g.resources.length-4):''}</div></div><div class="vv">${g.weekTotal.toLocaleString()} <span class="mut2" style="font-weight:700">(${Math.round(g.weekTotal/tot*100)}%)</span>${actInfo}</div></div>`;}).join('');
  return `
  <div style="display:flex;gap:8px;margin-bottom:14px">${tabs}<span class="src live" style="margin-left:auto;align-self:center">실데이터: ${dataSource}</span></div>
  <div class="grid g4" style="margin-bottom:14px">
    <div class="kpi"><div class="ic" data-ic="package"></div><div class="lab">주간 총 계획수량</div><div class="val">${(tot/10000).toFixed(1)}<small>만개</small></div><div class="delta">${tot.toLocaleString()}개</div></div>
    <div class="kpi"><div class="ic" data-ic="report"></div><div class="lab">오더 건수</div><div class="val">${ords}<small>건</small></div></div>
    <div class="kpi"><div class="ic" data-ic="factory"></div><div class="lab">가동 리소스</div><div class="val">${wk.resources.length}<small>개</small></div><div class="delta">설비/라인</div></div>
    <div class="kpi"><div class="ic" data-ic="clock"></div><div class="lab">계획 일수</div><div class="val">${wk.dates.length}<small>일</small></div><div class="delta">${wk.dates[0]?.slice(5)}~${wk.dates[wk.dates.length-1]?.slice(5)}</div></div>
  </div>
  <div class="card" style="margin-bottom:14px"><h3>공정(라인군)별 집계 <span class="hint">리소스명 자동 매핑 · ${wk.groups.length}개 라인군</span></h3>${grpRows}</div>
  <div class="grid g2" style="grid-template-columns:1fr 1fr;margin-bottom:14px">
    <div class="card"><h3>리소스별 주간 계획수량 <span class="hint">상위 14 · 개</span></h3>${resRows}</div>
    <div class="card"><h3>일자별 계획수량 <span class="hint">천개</span></h3>${lineChart(daily,{stroke:'#22a05f',fill:'#22a05f22',colorAt:()=>'#22a05f'})}
      <div class="mini" style="text-align:center">${wk.name} · 일 평균 ${Math.round(tot/wk.dates.length/1000).toLocaleString()}천개</div></div>
  </div>
  <div class="card"><h3>생산 오더 목록 <span class="hint">전체 ${ords}건 중 상위 40 · 날짜순${HA?' · 실적 반영':''}</span></h3>
    <div style="overflow-x:auto"><table class="tb"><thead>${oHead}</thead><tbody>${oRows}</tbody></table></div>
  </div>`;
};
V.delay=()=>{
  if(!DB.plan)return `<div class="card"><h3>지연오더</h3><p class="muted">주간 생산계획을 올리면 달성률 미달 오더를 자동으로 걸러 보여줍니다.</p><button class="btn p" onclick="go('data')">데이터 관리에서 업로드 →</button></div>`;
  if(!planHasActual())return `<div class="card"><h3>지연오더 <span class="hint">계획 대비 실적 분석</span></h3>
    <p class="muted" style="line-height:1.8">지연/미달 오더를 계산하려면 <b>실적 데이터</b>가 필요합니다. 실적 파일이 아직 없으면 시뮬레이션으로 계획 대비 달성률을 즉시 확인할 수 있습니다.</p>
    <div style="display:flex;gap:8px;margin-top:10px"><button class="btn p" onclick="simulateActual()">▶ 실적 시뮬레이션 생성</button><button class="btn" onclick="go('data')">실적 파일 업로드 →</button></div></div>`;
  const wk=DB.plan.weeks[planWeek]||DB.plan.weeks[0];
  const del=delayedOrders(wk);
  const totPlan=wk.resources.reduce((a,r)=>a+r.weekTotal,0);
  const totAct=wk.resources.reduce((a,r)=>a+r.orders.reduce((x,o)=>x+(o.actual||0),0),0);
  const totShort=del.reduce((a,o)=>a+o.short,0);
  const ach=Math.round(totAct/totPlan*100);
  const gShort={};del.forEach(o=>gShort[o.group]=(gShort[o.group]||0)+o.short);
  const gTop=Object.entries(gShort).sort((a,b)=>b[1]-a[1]);
  const gmax=gTop.length?gTop[0][1]:1;
  const gRows=gTop.map(([g,s])=>`<div class="barrow" style="grid-template-columns:150px 1fr 110px"><div class="nm">${g}</div><div>${pbar(s/gmax*100,'#dc4b4b')}</div><div class="vv neg">-${s.toLocaleString()}</div></div>`).join('')||'<div class="mini">지연 없음</div>';
  const rows=del.slice(0,40).map(o=>{const col=o.ach<70?'#dc4b4b':o.ach<90?'#d98a2b':'#22a05f';const st=o.ach<70?'지연 심각':o.ach<90?'미달':'경미';
    return `<tr><td>${o.date.slice(5)}</td><td>${o.res}</td><td>${o.orderNo}</td><td style="text-align:left;max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${o.product||'-'}</td><td>${o.qty.toLocaleString()}</td><td>${o.actual.toLocaleString()}</td><td class="neg">-${o.short.toLocaleString()}</td><td style="color:${col}">${o.ach}%</td><td><span class="tag ${o.ach<70?'t-red':'t-amber'}">${st}</span></td></tr>`;}).join('');
  return `
  <div style="display:flex;gap:8px;margin-bottom:14px;align-items:center">
    ${DB.plan.weeks.map((w,i)=>`<button class="btn ${i===planWeek?'p':''}" onclick="planWeek=${i};go('delay')">${w.name}</button>`).join(' ')}
    <span class="src live" style="margin-left:auto">실데이터: ${dataSource}</span>
  </div>
  <div class="grid g4" style="margin-bottom:14px">
    <div class="kpi"><div class="ic" data-ic="clock"></div><div class="lab">지연/미달 오더</div><div class="val neg">${del.length}<small>건</small></div><div class="delta">전체 ${wk.resources.reduce((a,r)=>a+r.orders.length,0)}건 중</div></div>
    <div class="kpi"><div class="ic" data-ic="activity"></div><div class="lab">총 부족 수량</div><div class="val neg">${(totShort/10000).toFixed(1)}<small>만개</small></div><div class="delta neg">${totShort.toLocaleString()}개</div></div>
    <div class="kpi"><div class="ic" data-ic="target"></div><div class="lab">주간 달성률</div><div class="val" style="color:${ach>=95?'#22a05f':ach>=85?'#ffcf5a':'#dc4b4b'}">${ach}<small>%</small></div><div class="delta">실적 ${(totAct/10000).toFixed(0)}만 / 계획 ${(totPlan/10000).toFixed(0)}만</div></div>
    <div class="kpi"><div class="ic" data-ic="alert"></div><div class="lab">최다 지연 라인군</div><div class="val" style="font-size:18px">${gTop[0]?gTop[0][0].replace(' 라인',''):'-'}</div><div class="delta neg">${gTop[0]?'-'+gTop[0][1].toLocaleString():''}</div></div>
  </div>
  <div class="grid g2" style="grid-template-columns:1fr 1fr;margin-bottom:14px">
    <div class="card"><h3>라인군별 부족 수량 <span class="hint">계획-실적</span></h3>${gRows}</div>
    <div class="card"><h3>지연 원인 · 조치 제안 <span class="hint">AI</span></h3>
      <div class="reco bad"><div class="ic" data-ic="clock"></div><div class="tx"><div class="r">${gTop[0]?gTop[0][0]:'-'} 최다 부족</div><div class="s">해당 라인군 잔업·주말 특근 또는 여유 라인 전환 생산 검토</div></div></div>
      <div class="reco warn"><div class="ic" data-ic="arrow"></div><div class="tx"><div class="r">미달 오더 익주 이월</div><div class="s">달성 90% 미만 오더는 익주 계획 우선 편성 권장</div></div></div>
      <div class="reco"><div class="ic" data-ic="package"></div><div class="tx"><div class="r">자재·설비 병목 점검</div><div class="s">반복 지연 리소스는 자재 결품/설비 비가동 이력 교차 확인</div></div></div>
    </div>
  </div>
  <div class="card"><h3>지연오더 목록 <span class="hint">부족수량 순 · 상위 40 / 총 ${del.length}건</span><button class="btn" onclick="exportDelay()">↓ 내보내기</button></h3>
    <div style="overflow-x:auto"><table class="tb"><thead><tr><th>일자</th><th>리소스</th><th>오더번호</th><th style="text-align:left">품명</th><th>계획</th><th>실적</th><th>부족</th><th>달성률</th><th>상태</th></tr></thead><tbody>${rows}</tbody></table></div>
  </div>`;
};
function exportDelay(){const wk=DB.plan.weeks[planWeek]||DB.plan.weeks[0];const del=delayedOrders(wk);
  const head=['일자','리소스','라인군','오더번호','품명','계획','실적','부족','달성률(%)'];
  const aoa=[head,...del.map(o=>[o.date,o.res,o.group,o.orderNo,o.product,o.qty,o.actual,o.short,o.ach])];
  const ws=XLSX.utils.aoa_to_sheet(aoa);const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,'지연오더');XLSX.writeFile(wb,'ZEN_지연오더_'+wk.name+'.xlsx');toast('지연오더를 엑셀로 내보냈습니다');}
/* 내장 도구(base64) — 별도 동반 파일 불필요. 한 파일로 완결. */
function _docURL(cache,b64){if(cache.u)return cache.u;if(!b64)return 'about:blank';const bin=atob(b64);const by=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)by[i]=bin.charCodeAt(i);cache.u=URL.createObjectURL(new Blob([by],{type:'text/html;charset=utf-8'}));return cache.u;}
const _oplC={};function oplURL(){return _docURL(_oplC,_zd('opl'));}
const _monC={};function monthlyURL(){return _docURL(_monC,_zd('mon'));}
const _labC={};function laborURL(){return _docURL(_labC,_zd('lab'));}
/* 창고 앱은 배포본(wh-stack/)을 gzip 으로 내장한다 — 구버전 base64 임베드를 대체 */
function whURL(){return gzURL('whA');}
const _safeC={};function safeAppURL(){return _docURL(_safeC,_zd('safe'));}
const _heatC={};function heatURL(){return _docURL(_heatC,_zd('heat'));}
/* 연동 현장 앱 — gzip+base64 내장 (배포 방식과 무관하게 동작) */
const GZDOC={};['svW','svA','washW','washA','pboxA','pboxW','oriA','oriW','whA','whW'].forEach(function(k){Object.defineProperty(GZDOC,k,{get:function(){return _zd(k)},enumerable:true});});
const _gzC={}; let _gzReady=false;
async function _gunzipB64(b64){
  const bin=atob(b64), by=new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++)by[i]=bin.charCodeAt(i);
  const st=new Blob([by]).stream().pipeThrough(new DecompressionStream('gzip'));
  const buf=await new Response(st).arrayBuffer();
  return URL.createObjectURL(new Blob([buf],{type:'text/html;charset=utf-8'}));
}
async function preloadGzDocs(){
  if(_gzReady)return; await _dataReady();
  for(const k in GZDOC){ try{ _gzC[k]=await _gunzipB64(GZDOC[k]); }catch(e){ _gzC[k]=null; } }
  _gzReady=true;
  try{ if(typeof cur!=='undefined'&&cur)go(cur); }catch(e){}
}
function gzURL(k){return _gzC[k]||'';}
/* 내장 앱 스킴 — internal:<key> → 실제 blob URL (오프라인 동작) */
function sysResolve(u){if(u==='internal:safe')return safeAppURL();if(u==='internal:wh')return whURL();if(u==='internal:heat')return heatURL();if(typeof u==='string'&&u.indexOf('internal:gz:')===0){var _p=u.slice(12).split('#'),_b=gzURL(_p[0]);return _b?(_p[1]?_b+'#'+_p[1]:_b):_b;}return u;}
function isInternal(u){return typeof u==='string'&&u.indexOf('internal:')===0;}
/* 내장 실연동 시스템의 실제 배포 주소 — '내장(오프라인) + 실배포' 둘 다 노출 */
const LIVE_URL={wash:'https://wash-admin.netlify.app/',safe:'https://zenkeeper.netlify.app/',heat:'https://zenf-heat-watch-v4.netlify.app/',wh:'https://wh-stack.netlify.app/index.html',whAdmin:'https://wh-stack.netlify.app/admin.html',whWorker:'https://wh-stack.netlify.app/worker.html',orikon:'https://orikon-pbox-admin.netlify.app/',pboxAdmin:'https://orikon-pbox-admin.netlify.app/pbox/',orikonAdmin:'https://orikon-pbox-admin.netlify.app/orikon/',orikonWorker:'https://orikon-pbox-worker.netlify.app/',monthly:'https://scintillating-dolphin-1f9abd.netlify.app/'};
/* 한 카드 안에서 시스템을 갈아끼우는 축 — 오리콘·P-BOX 는 별개 시스템이라
   현장용/관리자용 토글만으로는 오리콘 화면에 닿을 수 없었다. */
const SYS_SUB={
  orikon:{list:[{k:'pbox',n:'P-BOX'},{k:'orikon',n:'오리콘'}],
    urls:{pbox:{worker:'internal:gz:pboxW',admin:'internal:gz:pboxA'},
          orikon:{worker:'internal:gz:oriW',admin:'internal:gz:oriA'}},
    live:{pbox:{worker:LIVE_URL.orikonWorker,admin:LIVE_URL.pboxAdmin},
          orikon:{worker:LIVE_URL.orikonWorker,admin:LIVE_URL.orikonAdmin}}}
};
const INT_LIVE={safevoice:{worker:'https://safetyvoice-worker.netlify.app',admin:'https://safetyvoice-admin.netlify.app'},wash:{admin:LIVE_URL.wash},safe:{worker:LIVE_URL.safe,admin:LIVE_URL.safe},heat:{worker:LIVE_URL.heat,admin:LIVE_URL.heat}};
let sysSubView={};
function sysSubK(s){const d=SYS_SUB[s&&s.id];return d?(sysSubView[s.id]||d.list[0].k):null;}
function setSysSub(id,k){sysSubView[id]=k;go(cur);}
function subToggle(s){const d=SYS_SUB[s.id];if(!d)return '';const cur=sysSubK(s);
  return `<span class="subtog">${d.list.map(x=>`<button class="btn ${x.k===cur?'p':''}" onclick="setSysSub('${s.id}','${x.k}')">${x.n}</button>`).join('')}</span>`;}
function sysLiveUrl(s){const d=SYS_SUB[s.id];
  if(d)return (d.live[sysSubK(s)]||{})[sysVar(s)]||'';
  return (INT_LIVE[s.id]||{})[sysVar(s)]||'';}
function liveBtn(key){const u=LIVE_URL[key];return u?`<button class="btn" onclick="window.open('${u}','_blank')" title="${u}">↗ 실배포</button>`:'';}
/* 내장↔실배포 토글 임베드 (ZEN Keeper·창고·월마감) */
let embedView={}; // {key:'internal'|'live'}
function setEmbed(key,v){embedView[key]=v;go(cur);}
function embedToggle(key){const v=embedView[key]||'internal';
  return `<span style="display:inline-flex;gap:5px;margin-right:6px"><button class="btn ${v==='internal'?'p':''}" style="padding:5px 11px" onclick="setEmbed('${key}','internal')">내장</button><button class="btn ${v==='live'?'p':''}" style="padding:5px 11px" onclick="setEmbed('${key}','live')">실배포</button></span>`;}
function dualEmbed(key,name,icoHtml,internalUrl,height,idOverride,extraCtl,liveOverride){
  const v=embedView[key]||'internal', liveUrl=liveOverride!==undefined?liveOverride:LIVE_URL[key];
  const live=v==='live'&&!!liveUrl, src=live?liveUrl:internalUrl;
  const state=live?'실배포 연결('+liveUrl.replace(/^https?:\/\//,'').replace(/\/.*$/,'')+')':'실연동(내장) · 오프라인 동작';
  const openU=(src||'').replace(/'/g,'%27');
  const head=`<h3><span style="display:inline-flex;vertical-align:-3px;color:var(--accent)">${icoHtml}</span> ${name} <span class="hint" style="color:#3f9d6b">● ${state}</span><span style="margin-left:auto;display:flex;gap:6px;align-items:center;flex-wrap:wrap">${extraCtl||''}${embedToggle(key)}<button class="btn" onclick="window.open('${openU}','_blank')">↗ 새 창</button></span></h3>`;
  const note=live?`<div class="mini" style="margin-top:6px">실제 배포 화면 · 비어 보이면 임베드 차단(X-Frame-Options)일 수 있으니 ‘↗ 새 창’으로 확인하세요.</div>`:'';
  return `<div class="card" style="margin-top:14px;padding:13px"${idOverride?` id="${idOverride}"`:''}>${head}<iframe class="safe" src="${src.replace(/"/g,'&quot;')}" title="${name}" style="height:${height}" loading="lazy"></iframe>${note}</div>`;
}
V.opl=()=>`<div class="card" id="oplGen" style="padding:12px"><h3>OPL 원포인트레슨 자동생성 <span class="hint">점검·이슈 붙여넣기 → 적발(NG)→준수기준(OK) 카드 + 교육 서명부 · 인쇄/PDF</span><span style="margin-left:auto"><button class="btn" onclick="window.open(oplURL(),'_blank')">↗ 새 창</button></span></h3><iframe class="safe" src="${oplURL()}" title="OPL 생성기" style="height:80vh"></iframe><div class="mini" style="margin-top:6px">점검 내용 붙여넣기 → 자동 생성 · 사진 업로드 후 PDF/인쇄.</div></div>`;
V.safeapp=()=>dualEmbed('safe','안전 관리 (ZEN Keeper)',svic('shield',16),safeAppURL(),'80vh');

