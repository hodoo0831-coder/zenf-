/* ============ COMPUTED ============ */
const G={
  cur:l=>l.on+l.leave+l.edu,
  achieve:l=>Math.round(l.actual/l.target*100),
  load:l=>Math.round(l.target/l.capa*100),
  oeeQ:l=>+(100-l.defect).toFixed(1),
  oee:l=>+((l.oeeA/100)*(l.oeeP/100)*((100-l.defect)/100)*100).toFixed(1),
  // 세척 우선순위: 색상/제품전환 40% + 주기경과 35%(기준 8h) + 생산부하 25%
  /* 세척 우선순위 = 전환 40 + 주기 35 + 부하 25.
     세척실 앱이 연결되면 '주기'를 실제 마지막 완료 경과시간으로 바꾼다. */
  cleanElapsed:l=>{const W=(typeof washStats==='function')?washStats():null;
    const m=W&&W[l.key];
    if(m&&m.lastEndH!=null)return m.lastEndH;       /* 실측: 마지막 세척 완료 후 경과(h) */
    if(m&&m.wait>0&&m.lastEndH==null)return 8;      /* 대기만 있고 완료 이력 없음 → 주기 만점 */
    return l.clElapsed;},                            /* 미연결 시 기준값 */
  cleanScore:l=>{const cyc=Math.min(1,G.cleanElapsed(l)/8);const load=Math.min(1,l.actual/l.capa);
    return Math.round((0.40*l.clTransfer+0.35*cyc+0.25*load)*100);},
  // 재고: 소진일수·재주문점·발주량(MOQ 반영)
  stock:s=>{const days=+(s.onhand/s.dailyUse).toFixed(1);const rop=+(s.lead*s.dailyUse*1.3).toFixed(0);
    const need=s.onhand<=rop;const qty=Math.max(s.moq,Math.ceil(s.targetDays*s.dailyUse-s.onhand));
    return {days,rop,need,qty};},
};
function totProd(){const L=myLines();const t=L.reduce((a,l)=>a+l.target,0),a=L.reduce((x,l)=>x+l.actual,0);return{t,a,ach:t?Math.round(a/t*100):0};}
function shortSum(){return myLines().reduce((a,l)=>a+Math.max(0,l.need-G.cur(l)),0);}
function avgOEE(){const L=myLines();return +(L.reduce((a,l)=>a+G.oee(l),0)/L.length).toFixed(1);}
function avgDefect(){const L=myLines();return +(L.reduce((a,l)=>a+l.defect,0)/L.length).toFixed(1);}
function headNeed(){return scoped()?myLines().reduce((a,l)=>a+l.need,0):DB.headcount.need;}
function headCur(){return scoped()?myLines().reduce((a,l)=>a+G.cur(l),0):DB.headcount.cur;}

/* ============ AGENTS / ROLES ============ */
const AGENTS=[
  {id:'forecast',name:'계획 · 예측',icon:'',sub:'주간계획 업로드 → 부하율 · 필요인원 · 지연오더 예측'},
  {id:'home',name:'컨트롤타워',icon:'',sub:'실시간 현황 종합 · 오늘의 판단 요약'},
  {id:'reports',name:'일간 · 주간 · 월마감',icon:'',sub:'주기별 보고서 자동 생성'},
  {id:'judge',name:'판단 기준 · 성과',icon:'',sub:'코드화된 판단 룰 카탈로그 · ZAIC 성과지표'},
  {id:'track',name:'AI 판단·조치',icon:'',sub:'실측 → 기준 대조 → 판단 → 담당·기한 → 결과'},
  {id:'ops',name:'현장 8 Agent',icon:'',sub:'생산·계획 · 인력 · 세척 · 창고 · 간접작업 · 안전 · 품질 · 분석·보고'},
  {id:'planhub',name:'생산·계획 Agent',icon:'',sub:'금일 실적 · 주간계획 · 부하율 · 지연오더'},
  {id:'labor',name:'인력 Agent',icon:'',sub:'출근 · 결원 · 대체인력 · 잔업 추천'},
  {id:'clean',name:'세척 Agent',icon:'',sub:'세척 우선순위 자동 추천 · 자동판단율 목표 95%'},
  {id:'stock',name:'창고 Agent',icon:'',sub:'포장재 창고 적치 · 구역별 포화율'},
  {id:'orikonwash',name:'간접작업 Agent',icon:'',sub:'오리콘·P-BOX 실적 · 5초 자동집계'},
  {id:'safe',name:'안전 Agent',icon:'',sub:'TBM · 폭염 · 위험요인 추천'},
  {id:'qual',name:'품질 Agent',icon:'',sub:'불량 추이 · 원인 분석'},
  {id:'insight',name:'분석 Agent',icon:'',sub:'KPI · LOSS · 원가 분석'},
];
const ROLES={
  field:{name:'현장',emoji:'',allow:['home','forecast','ops','planhub','clean','orikonwash','safe','safeapp']},
  admin:{name:'관리자',emoji:'',allow:['home','forecast','reports','judge','track','ops','planhub','labor','clean','stock','orikonwash','safe','qual','data','opl','safeapp']},
  center:{name:'센터',emoji:'',allow:['home','forecast','reports','judge','track','ops','planhub','labor','clean','stock','orikonwash','safe','qual','insight','data','opl','safeapp']},
};
let role='center';

/* ============ VIEWS ============ */
const V={};
const CAPA_LINES=[["32104","직선","직선4호",21600,27360,1,2,1,0],["32105","직선","직선5호",24300,30780,1,5,1,3],["32111","직선","직선11호",16200,20520,1,6,1,3],["32113","직선","직선13호",26100,33060,1,6,1,4],["32114","직선","직선14호",24300,30780,1,6,1,4],["32115","직선","직선15호",18000,22800,1,5,1,3],["32116","직선","직선16호",30600,38760,1,7,1,4],["32117","초격차","세정초격차 1호",16200,20520,2,2,2,2],["32118","초격차","세정초격차 2호",16200,20520,2,2,2,2],["32119","초격차","세정초격차 3호",16200,20520,2,3,2,3],["32120","초격차","세정초격차 4호",16200,20520,2,4,2,4],["32163","직선","리필3호",9000,11400,1,2,1,2],["32171","직선","대용량 충전",3150,3990,1,2,0,0],["32202","멀티","멀티셀2호",7650,9690,1,1,1,0],["32203","멀티","멀티셀3호",7650,9690,1,1,1,1],["32206","멀티","멀티셀6호",15750,19950,1,3,1,2],["32207","멀티","멀티셀7호",15750,19950,1,3,1,3],["32208","멀티","멀티셀8호",15750,19950,1,3,1,2],["32209","멀티","세럼충전기",15750,19950,1,0,1,0],["32222","HnB기타","크림2호",5400,6840,1,3,1,0],["32223","HnB기타","크림3호",5850,7410,1,3,1,0],["32232","튜브","튜브2호",20250,25650,2,0,1,0],["32233","튜브","튜브3호",18900,23940,2,0,1,0],["32234","튜브","튜브4호",22500,28500,2,0,1,0],["32235","튜브","튜브5호",22500,28500,2,0,1,0],["32236","튜브","튜브6호",22500,28500,2,0,1,0],["32237","튜브","튜브7호",24300,30780,1,0,1,0],["32238","튜브","튜브8호",20250,25650,1,2,1,2],["32239","튜브","튜브9호(초음파)",0,0,0,0,0,0],["32302","치약","치약충전2호",67500,85500,1,2,0,0],["32303","치약","치약충전3호",67500,85500,1,2,0,0],["32304","치약","치약충전4호",29250,37050,1,2,1,1],["32305","치약","치약충전5호",67500,85500,1,1,1,2],["32306","치약","치약충전6호",67500,85500,1,1,1,2],["32322","치약","치약수축2호",22500,28500,1,0,0,0],["32324","치약","치약수축4호",22500,28500,1,1,1,0],["32325","치약","치약수축5호",22500,28500,1,1,1,0],["32331","치약","치약기획",4500,5700,1,4,0,0],["32341","치약","일회용 치약충전",99000,125400,1,1,0,0],["32401","염모","염모제 충전1호",15750,19950,1,1,1,1],["32402","염모","염모제 충전3호",11250,14250,1,0,1,0],["32403","염모","염모제 충전5호",15750,19950,0.5,0,0.5,0],["32411","염모","염모제 직구성1호",15750,19950,1,1,1,0],["32412","염모","염모제 직구성2호",11000,15000,1,4,0,0],["32413","염모","염모제 직구성3호",11250,14250,1,4,0,0],["32415","염모","염모제 직구성5호",15750,19950,1,1,1,1],["32416","염모","염모제 직구성6호",7200,9120,1,1,1,0],["32417","염모","염모제 직구성7호",27000,34200,1,2,1,2],["32432","염모","염모제 파우치2호",10000,13000,1,0,0,0],["32433","염모","염모제 파우치3호",7200,9120,0.5,0,0.5,0],["32434","염모","염모제 파우치4호",7200,9120,0.5,0,0.5,0],["32435","염모","염모제 파우치5호",20000,27000,1,0,1,0],["32436","염모","염모제 파우치6호",27000,34200,1,0,1,0],["32442","염모","산화제 충전2호",11250,14250,1,1,1,1],["32443","염모","산화제 충전3호",2250,2850,1,1,1,0],["32445","염모","산화제 충전5호",11250,14250,1,0,1,0],["32446","염모","산화제 충전6호",15750,19950,0.5,0,0.5,0],["32447","염모","산화제 충전7호",8000,11000,1,1,0,0],["32448","염모","산화제 충전8호",27000,34200,1,0,1,0],["32451","염모","염모제 기획",9000,12400,1,10,0,0],["32901","HnB기타","팜플1호",49500,62700,1,0,1,0],["32902","HnB기타","팜플2호(FNC)",0,0,0,0,0,0],["32903","HnB기타","팜플3호",49500,62700,1,0,0,0],["32906","HnB기타","팜플6호(FNC)",0,0,0,0,0,0],["32907","HnB기타","팜플7호(FNC)",0,0,0,0,0,0],["32908","HnB기타","팜플8호",49500,62700,1,0,1,0],["32911","HnB기타","턴테이블1호",14400,18240,1,3,1,2],["32913","HnB기타","턴테이블3호",14400,18240,1,3,1,2],["32914","HnB기타","턴테이블4호",14400,18240,1,1,0,0],["N-01","직선","동기화 직선14호",22500,28500,0,1,0,0]];
const PLAN_SEED={"32113":80934,"32115":58000,"32116":85440,"32117":75000,"32118":78016,"32119":143032,"32120":127659,"32163":31404,"32202":33004,"32206":63012,"32207":66000,"32208":33866,"32209":70616,"32233":113812,"32234":72000,"32235":99420,"32236":155796,"32237":154292,"32238":97016,"32305":151800,"32306":171600,"32324":39600,"32325":57200,"32401":43080,"32403":54000,"32411":43080,"32415":54000,"32416":51604,"32417":104272,"32433":154812,"32434":154812,"32435":26400,"32436":104272,"32443":9800,"32446":54000,"32448":104208,"32903":90000,"32907":9200,"32911":64904,"32913":41220};

/* ===== 주간계획 부하율(실 CAPA·표준인원 연동) ===== */
let loadPlan=PLAN_SEED, loadDays=6, loadBase='c75', loadFilter=null, loadPlanName='33주 확정(내장 샘플)';
function _lnum(v){v=String(v).replace(/[, ]/g,'');const m=v.match(/\d+/g);return m?+m[0]:0;}
/* ===== 라인 마스터(기준 데이터) — CAPA표·인원표 업로드로 갱신 =====
   CAPA_LINES 는 'AP 라인별 인원·CAPA 기준표'(HnB·튜브·염모제·치약 4개 시트)를 코드에
   내장한 초기값이다: [작업장코드, 그룹, 라인명, 정상 CAPA, 잔업 CAPA, 표준 OP, 표준 작업자, 가용 OP, 가용 작업자].
   CAPA = 분당 케파 × 450분(7.5hr 정규) / × 570분(9.5hr 잔업) — 표의 정상·잔업 열과 같다.
   표에 CAPA(분)가 비어 있는 라인은 기존 값을 두고, 가동 안 하는 라인(표준·가용 인원 모두 없음)은 0 이다.
   같은 형식의 파일을 업로드하면 DB.master 가 그 값을 덮고, 부하율·필요인원 계산 전체가 새 기준을 따른다. */
function LMASTER(){return (DB.master&&DB.master.rows&&DB.master.rows.length)?DB.master.rows:CAPA_LINES;}
function _mnum(v){const m=String(v==null?'':v).replace(/,/g,'').match(/\d+(?:\.\d+)?/);return m?+m[0]:0;}
function _mkey(v){return String(v||'').replace(/\s+/g,'').toLowerCase();}
function _masterClone(){return LMASTER().map(a=>a.slice());}
function _aoa(ws){return XLSX.utils.sheet_to_json(ws,{header:1,raw:false,defval:''});}

/* CAPA표: '3xxxx' 작업장코드 + 우측 기준수량 2열. 여러 시트면 코드 행이 가장 많은(=최신) 시트 */
function _capaSheet(wb){let best=null,bestN=0;
  for(const nm of wb.SheetNames){const a=_aoa(wb.Sheets[nm]);let n=0;
    for(const r of a){const ci=r.findIndex(c=>/^3\d{4}$/.test(String(c).trim()));
      if(ci>=0&&r.slice(ci+1,ci+6).some(c=>_mnum(c)>100))n++;}
    if(n>=bestN&&n>=10){best=nm;bestN=n;}}
  return best;}
function isCapaWB(wb){return !!_capaSheet(wb);}
function applyCapaMaster(wb,fname){
  const a=_aoa(wb.Sheets[_capaSheet(wb)]), rows=_masterClone();
  const byCode={},byName={};rows.forEach(r=>{byCode[r[0]]=r;byName[_mkey(r[2])]=r;});
  let upd=0,added=0,miss=[];
  for(const r of a){
    const ci=r.findIndex(c=>/^3\d{4}$/.test(String(c).trim())); if(ci<0)continue;
    const code=String(r[ci]).trim();
    /* CAPA 수량 = 500 이상 숫자를 담은 셀('오전/16200' 같은 표기 포함).
       라인명 = 그 앞의 마지막 한글 셀 — '세정초격차 1호'처럼 이름에 든 작은
       숫자(호수)가 수량으로 오인되지 않도록 500 문턱으로 가른다. */
    let first=-1;const nums=[];
    for(let i=ci+1;i<r.length;i++){const cs=String(r[i]).trim();
      if(/^3\d{4}$/.test(cs))continue;              /* 작업장코드 반복 열 제외 */
      const n=_mnum(cs);
      if(n>=500){if(first<0)first=i;if(nums.length<2)nums.push(n);}}
    if(!nums.length)continue;
    let ni=-1;
    for(let i=ci+1;i<first;i++){const c=String(r[i]);
      if(/[가-힣]/.test(c)&&_mnum(c)<500&&!/^3\d{4}$/.test(c.trim()))ni=i;}
    if(ni<0)continue;
    const row=byCode[code]||byName[_mkey(r[ni])];
    if(row){row[3]=nums[0];row[4]=nums[1]||nums[0];upd++;}
    else if(nums[0]>0){const grp=guessGrpFromName(String(r[ni]));rows.push([code,grp,String(r[ni]).trim(),nums[0],nums[1]||nums[0],0,0,0,0]);byCode[code]=rows[rows.length-1];added++;}
    else miss.push(String(r[ni]));
  }
  DB.master=Object.assign(DB.master||{},{rows,capaName:fname,capaAt:new Date().toISOString().slice(0,10)});
  saveDB();return {upd,added,miss};
}
function guessGrpFromName(n){
  if(/^직선|리필|대용량/.test(n))return '직선';
  if(/초격차/.test(n))return '초격차';
  if(/멀티|세럼/.test(n))return '멀티';
  if(/튜브/.test(n))return '튜브';
  if(/치약/.test(n))return '치약';
  if(/염모|산화제/.test(n))return '염모';
  return 'HnB기타';
}

/* 인원표: '라인명' + '표준 필요' + '가용' 헤더를 가진 시트들 */
function _staffSheets(wb){const out=[];
  for(const nm of wb.SheetNames){const a=_aoa(wb.Sheets[nm]);
    const hr=a.findIndex(r=>r.some(c=>/라인명/.test(String(c)))&&r.some(c=>/표준\s*필요/.test(String(c)))&&r.some(c=>/가용/.test(String(c))));
    if(hr>=0)out.push({nm,a,hr});}
  return out;}
function isStaffWB(wb){return _staffSheets(wb).length>0;}
/* 라인명 찾기 — 표에는 '염모제 직구성1호(염모제충전1호)' 처럼 괄호로 짝 설비를 덧붙인 이름이 있다.
   정확히 같은 이름 → 괄호 앞 이름 → 괄호 안 이름 순으로 맞춘다. */
function _lineRow(byName,name){
  const k=_mkey(name); if(byName[k])return byName[k];
  const base=k.replace(/[(（].*$/,''); if(base&&byName[base])return byName[base];
  const m=k.match(/[(（]([^)）]*)/); if(m&&byName[m[1]])return byName[m[1]];
  return null;}
function applyStaffMaster(wb,fname){
  const sheets=_staffSheets(wb), rows=_masterClone();
  const byName={};rows.forEach(r=>{byName[_mkey(r[2])]=r;});
  let upd=0,capaUpd=0;const miss=[];
  for(const {a,hr} of sheets){
    const li=a[hr].findIndex(c=>/라인명/.test(String(c)));
    const ci=a[hr].findIndex(c=>/CAPA/i.test(String(c)));      /* 인원·CAPA 합본 표 — 'CAPA' 아래 첫 열이 분당 케파(분) */
    for(let i=hr+1;i<a.length;i++){
      const r=a[i], name=String(r[li]||'').trim();
      if(!name||/^[\d.,\s]+$/.test(name))continue;              /* 빈 행·합계 행 제외 */
      /* 라인명만 있고 인원·CAPA 칸이 전부 빈 행(자리표시)은 '0' 이 아니라 '자료 없음' — 덮어쓰지 않는다 */
      if(![li+1,li+2,li+3,li+4].some(j=>String(r[j]||'').trim())&&!(ci>=0&&String(r[ci]||'').trim()))continue;
      const row=_lineRow(byName,name);
      const v=[_mnum(r[li+1]),_mnum(r[li+2]),_mnum(r[li+3]),_mnum(r[li+4])];
      if(row){row[5]=v[0];row[6]=v[1];row[7]=v[2];row[8]=v[3];upd++;
        const mpm=ci>=0?_mnum(r[ci]):0;                           /* 분당 케파 → 정상(450분)·잔업(570분) CAPA */
        if(mpm>0){row[3]=Math.round(mpm*450);row[4]=Math.round(mpm*570);capaUpd++;}}
      else miss.push(name);
    }
  }
  DB.master=Object.assign(DB.master||{},{rows,staffName:fname,staffAt:new Date().toISOString().slice(0,10)});
  saveDB();return {upd,capaUpd,miss:[...new Set(miss)]};
}
function masterStatus(){
  const m=DB.master||{};
  const capa=m.capaName?`CAPA ${m.capaName} (${m.capaAt})`:'CAPA 내장 기준';
  const staff=m.staffName?`인원 ${m.staffName} (${m.staffAt})`:'인원 내장 기준';
  return capa+' · '+staff;
}
function masterReset(){delete DB.master;saveDB();rerender();toast('라인 기준을 내장값으로 되돌렸습니다');}
function loadCalc(plan,days,base){
  days=days||6; base=base||'c75';
  const rows=LMASTER().map(a=>{const l={code:a[0],grp:a[1],name:a[2],c75:a[3],c105:a[4],needOP:a[5],needW:a[6],avOP:a[7],avW:a[8]};
    const cap=l[base]||l.c75, wk=plan[l.code]||0, wcap=cap*days, load=wcap?wk/wcap*100:0;
    const need=l.needOP+l.needW, avail=l.avOP+l.avW, needAdj=Math.round(need*load/100*10)/10;
    return Object.assign(l,{cap,wk,load:Math.round(load),need,avail,needAdj,gap:+(needAdj-avail).toFixed(1)});});
  const Gm={};rows.forEach(r=>{const g=Gm[r.grp]||(Gm[r.grp]={wk:0,cap:0,need:0,avail:0,needAdj:0});g.wk+=r.wk;g.cap+=r.cap*days;g.need+=r.need;g.avail+=r.avail;g.needAdj+=r.needAdj;});
  const groups=Object.entries(Gm).map(([grp,v])=>({grp,load:v.cap?Math.round(v.wk/v.cap*100):0,need:v.need,avail:v.avail,needAdj:+v.needAdj.toFixed(1),gap:+(v.needAdj-v.avail).toFixed(1)})).filter(g=>g.need>0||g.wk>0).sort((a,b)=>b.load-a.load);
  return {rows,groups};
}
/* 보안: 업로드 값 무해화 — 모든 엑셀 파싱 결과에서 태그 문자 제거 (XSS 방지) */
(function(){if(typeof XLSX==='undefined')return;const orig=XLSX.utils.sheet_to_json;
  const clean=v=>typeof v==='string'?v.replace(/[<>]/g,''):v;
  XLSX.utils.sheet_to_json=function(){const r=orig.apply(this,arguments);
    if(Array.isArray(r))r.forEach(row=>{if(Array.isArray(row)){for(let i=0;i<row.length;i++)row[i]=clean(row[i]);}
      else if(row&&typeof row==='object'){for(const k in row)row[k]=clean(row[k]);}});
    return r;};})();
function loadUpload(input){const f=input.files[0];if(!f)return;const rd=new FileReader();
  rd.onload=e=>{try{const wb=XLSX.read(new Uint8Array(e.target.result),{type:'array'});
    /* 기준 파일 자동 식별 — 인원표를 먼저 본다(CAPA표 판별식이 더 느슨하므로) */
    if(typeof isStaffWB==='function'&&isStaffWB(wb)){
      const st=applyStaffMaster(wb,f.name);
      if(DB.plan)applyPlanCascade(DB.plan,DB.loadPlanName||'주간계획',DB.loadPlan||{});
      rerender();
      toast('인원 기준 반영 — '+st.upd+'개 라인 표준·가용 인원'+(st.capaUpd?' · CAPA '+st.capaUpd+'개':'')+' 갱신'+(st.miss.length?' · 미매칭 '+st.miss.length+'건('+st.miss.slice(0,3).join(', ')+(st.miss.length>3?' 외':'')+')':''));
      go('load');return;
    }
    if(typeof isCapaWB==='function'&&isCapaWB(wb)){
      const cp=applyCapaMaster(wb,f.name);
      if(DB.plan)applyPlanCascade(DB.plan,DB.loadPlanName||'주간계획',DB.loadPlan||{});
      rerender();
      toast('CAPA 기준 반영 — '+cp.upd+'개 라인 갱신'+(cp.added?' · 신규 '+cp.added:'')+' — 부하율·필요인원이 새 기준으로 재계산됩니다');
      go('load');return;
    }
    let plan=null,map={};
    if(typeof isPlanWB==='function'&&isPlanWB(wb)){plan=parsePlan(wb);map=planToLoadMap(plan);}
    if(!Object.keys(map).length){
      const ws=wb.Sheets[wb.SheetNames[0]];const aoa=XLSX.utils.sheet_to_json(ws,{header:1,raw:false,defval:''});
      const QC=[5,8,11,14,17,20];
      for(const r of aoa){const code=(String(r[1]||'').match(/\d{4,}/)||[])[0];if(!code)continue;if(!String(r[3]||'').trim())continue;const wk=QC.map(c=>_lnum(r[c])).reduce((a,b)=>a+b,0);map[code]=(map[code]||0)+wk;}
    }
    if(!Object.keys(map).length){toast('인식 실패 — 리소스코드·수량 형식을 확인하세요');return;}
    const s=applyPlanCascade(plan,f.name,map);
    rerender();
    toast('주간계획 반영 — '+s.codes+'개 라인'+(s.weeks?' · '+s.weeks+'주':'')+' · 라인 목표 '+s.nLines+'개 갱신 · 과부하 '+s.over+'그룹 · 조치 '+s.opened+'건');
    go('load');
  }catch(err){toast('읽기 오류: '+err.message);}};
  rd.readAsArrayBuffer(f);}
/* ===== 생산량 대비 필요 인원 — 일간 =====
   주간과 같은 식(필요 = 표준인원 × 부하율)을 1일 단위로 적용한다.
   일 계획량은 주간계획 엑셀의 날짜별 물량(resources[].daily[date])을 그대로 쓴다.
   균등 배분 같은 추정은 하지 않는다 — 요일별 물량은 실제로 고르지 않다. */
let loadUnit='week', loadDate='';
function planWeekObj(){return DB.plan?(DB.plan.weeks[planWeek]||DB.plan.weeks[0]):null;}
function dayPlanMap(date,useActual){
  const wk=planWeekObj(), m={}; if(!wk)return m;
  wk.resources.forEach(r=>{
    const code=(String(r.code||'').match(/\d{4,}/)||[])[0]; if(!code)return;
    let q=0;
    if(useActual)r.orders.forEach(o=>{if(o.date===date&&o.actual!=null)q+=o.actual;});
    else q=r.daily[date]||0;
    if(q)m[code]=(m[code]||0)+q;
  });
  return m;
}
function dayCalc(date,base,useActual){return loadCalc(dayPlanMap(date,useActual),1,base||loadBase);}
function daySum(R){
  const act=R.rows.filter(r=>r.wk>0);
  const qty=act.reduce((a,r)=>a+r.wk,0), cap=act.reduce((a,r)=>a+r.cap,0);
  const need=+R.groups.reduce((a,g)=>a+g.needAdj,0).toFixed(1);
  const avail=R.groups.reduce((a,g)=>a+g.avail,0);
  return {qty,cap,load:cap?Math.round(qty/cap*100):0,need,avail,gap:+(need-avail).toFixed(1),lines:act.length};
}
function daySeries(useActual){
  const wk=planWeekObj(); if(!wk)return [];
  return wk.dates.map(d=>Object.assign({date:d},daySum(dayCalc(d,loadBase,useActual))));
}
/* 일간 필요 인원 화면 */
function loadDayView(){
  const gcol=v=>v>=100?'#c25a52':v>=90?'#cb9447':v>=60?'#4a8a60':'#3f74b5';
  const unitBtn=(k,lab)=>`<button class="btn ${loadUnit===k?'p':''}" style="padding:5px 10px" onclick="loadUnit='${k}';go('load')">${lab}</button>`;
  const baseBtn=(k,lab)=>`<button class="btn ${loadBase===k?'p':''}" style="padding:5px 10px" onclick="loadBase='${k}';go('load')">${lab}</button>`;
  const head=`<div class="card" style="margin-bottom:14px;padding:13px"><div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
    <div class="chead">일간 생산량 대비 필요 인원</div>
    <span class="mini">호기 CAPA(${loadBase==='c75'?'7.5hr 정규':'9.5hr 잔업'}) × 1일</span>
    <span style="margin-left:auto;display:flex;gap:6px;align-items:center;flex-wrap:wrap">
      <span class="mini">단위</span>${unitBtn('week','주간')}${unitBtn('day','일간')}
      <span class="mini" style="margin-left:6px">기준</span>${baseBtn('c75','정규')}${baseBtn('c105','잔업')}
      <label class="btn" style="cursor:pointer" onclick="document.getElementById('loadFile2').click()">↑ 주간계획 업로드</label>
      <input id="loadFile2" type="file" accept=".xlsx,.xls" style="display:none" onchange="loadUpload(this)"></span></div></div>`;
  const wk=planWeekObj();
  if(!wk||!wk.dates||!wk.dates.length)return head+`<div class="card"><h3>일자별 계획이 없습니다</h3>
    <p class="mini" style="line-height:1.8">일간 필요 인원은 <b>주간계획 엑셀의 날짜별 물량</b>으로 계산합니다.
    지금 적용된 <b>${escHtml(loadPlanName)}</b>은 주 단위 합계만 있어 일자별로 나눌 수 없습니다.<br>
    <span class="mut2">주간 합계를 가동일수로 나눠 추정할 수도 있지만, 요일별 물량은 실제로 고르지 않아 그렇게 하지 않습니다.
    날짜 열(YYYY.MM.DD)이 있는 주간계획 엑셀을 올리면 바로 채워집니다.</span></p>
    <button class="btn p" style="margin-top:8px" onclick="document.getElementById('loadFile2').click()">↑ 주간계획 올리기</button></div>`;
  const hasAct=planHasActual();
  const S=daySeries(false), A=hasAct?daySeries(true):null;
  if(!loadDate||wk.dates.indexOf(loadDate)<0)loadDate=(S.find(d=>d.qty>0)||S[0]).date;
  const cur=S.find(d=>d.date===loadDate)||S[0];
  const curA=A?A.find(d=>d.date===loadDate):null;
  const R=dayCalc(loadDate,loadBase,false);
  const WD=['일','월','화','수','목','금','토'];
  const wdOf=ds=>{const p=ds.split('.');return WD[new Date(+p[0],+p[1]-1,+p[2]).getDay()];};
  const chips=S.map(d=>`<button class="btn ${d.date===loadDate?'p':''}" style="padding:6px 11px" onclick="loadDate='${d.date}';go('load')">${d.date.slice(5)}(${wdOf(d.date)})</button>`).join(' ');

  /* 일자별 필요 인원 막대 + 가용 기준선 */
  const mx=Math.max(1,...S.map(d=>Math.max(d.need,d.avail)));
  const bars=S.map(d=>{const on=d.date===loadDate, hN=Math.round(d.need/mx*88), hA=Math.round(d.avail/mx*88);
    const col=d.gap>0.4?'#dc4b4b':'#0f2438';
    return `<div style="flex:1;min-width:52px;display:flex;flex-direction:column;align-items:center;gap:4px;cursor:pointer" onclick="loadDate='${d.date}';go('load')">
      <div style="font-size:11px;font-weight:700;color:${d.qty?col:'#5f6d77'}">${d.qty?d.need:'-'}</div>
      <div style="position:relative;width:100%;height:92px;display:flex;align-items:flex-end">
        <div style="width:100%;height:${d.qty?hN+3:3}px;border-radius:4px 4px 0 0;background:${d.qty?col:'#d8dee6'};opacity:${on?1:.55}"></div>
        <span title="가용 ${d.avail}명" style="position:absolute;left:0;right:0;bottom:${hA}px;height:0;border-top:2px dashed #4f7cb0"></span>
      </div>
      <div class="mini" style="font-size:10px;font-weight:${on?800:600}">${d.date.slice(5)}<br>${wdOf(d.date)}</div></div>`;}).join('');

  /* 그룹별 표 */
  const gs=R.groups.filter(g=>g.wk>0||g.needAdj>0);
  const grows=gs.map(g=>`<tr><td style="text-align:left">${g.grp}</td><td style="color:${gcol(g.load)};font-weight:700">${g.load}%</td><td>${g.need}</td><td>${g.avail}</td><td><b>${g.needAdj}</b></td><td class="${g.gap>0?'neg':g.gap<0?'pos':'zero'}">${g.gap>0?'+'+g.gap:g.gap}</td></tr>`).join('')
    ||`<tr><td colspan="6" class="mini" style="text-align:center;padding:14px">이 날짜에 계획된 물량이 없습니다</td></tr>`;
  /* 라인별 표 */
  const lrows=R.rows.filter(r=>r.wk>0).sort((a,b)=>b.load-a.load)
    .map(r=>`<tr><td style="text-align:left">${r.name}</td><td>${r.grp}</td><td>${r.wk.toLocaleString()}</td><td>${r.cap.toLocaleString()}</td><td style="color:${gcol(r.load)};font-weight:700">${r.load}%</td><td>${r.need}</td><td>${r.avail}</td><td><b>${r.needAdj}</b></td><td class="${r.gap>0?'neg':r.gap<0?'pos':'zero'}">${r.gap>0?'+'+r.gap:r.gap}</td></tr>`).join('')
    ||`<tr><td colspan="9" class="mini" style="text-align:center;padding:14px">이 날짜에 계획된 물량이 없습니다</td></tr>`;

  const peak=[...S].filter(d=>d.qty).sort((a,b)=>b.need-a.need)[0];
  const shortDays=S.filter(d=>d.qty&&d.gap>0.4);
  const actLine=curA?`<div class="mini" style="margin-top:10px;line-height:1.8"><b>실적 기준</b> — 같은 날 실 생산량 ${curA.qty.toLocaleString()}개 기준 필요 인원 <b>${curA.need}명</b>
    (계획 기준 ${cur.need}명 대비 ${(curA.need-cur.need)>0?'+':''}${(curA.need-cur.need).toFixed(1)}명).
    <span class="mut2">계획보다 적게 생산했다면 그만큼 인원이 덜 필요했다는 뜻이고, 배치가 과했는지 되짚는 근거가 됩니다.</span></div>`
    :`<div class="mini" style="margin-top:10px"><span class="mut2">실적 파일을 올리면 같은 날 <b>실 생산량 기준</b> 필요 인원이 나란히 표시됩니다.</span></div>`;

  return head+`
  <div class="card" style="margin-bottom:14px;padding:12px 14px"><div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
    <span class="mini" style="font-weight:700">날짜</span>${chips}
    <span class="tag t-blue" style="margin-left:auto">${escHtml(loadPlanName)} · ${escHtml(wk.name)}</span></div></div>
  <div class="kstrip">
    <div class="ki"><div class="l">일 생산 계획량</div><div class="v tnum">${(cur.qty/1000).toFixed(1)}<small>천개</small></div><div class="d muted">가동 라인 ${cur.lines}개</div></div>
    <div class="ki"><div class="l">일 부하율</div><div class="v tnum" style="color:${gcol(cur.load)}">${cur.load}<small>%</small></div><div class="d muted">계획 ÷ 일CAPA</div></div>
    <div class="ki"><div class="l">필요 인원</div><div class="v tnum" style="color:#0f2438">${cur.need}<small>명</small></div><div class="d muted">표준 × 부하율</div></div>
    <div class="ki"><div class="l">가용 대비</div><div class="v tnum" style="color:${cur.gap>0?'#c25a52':'#4a8a60'}">${cur.gap>0?'+'+cur.gap:cur.gap}<small>명</small></div><div class="d muted">가용 ${cur.avail}명</div></div>
  </div>
  <div class="grid g2" style="grid-template-columns:1.2fr 1fr;margin-bottom:14px">
    <div class="card"><h3>일자별 필요 인원 <span class="hint">막대 = 필요 · 점선 = 가용 · 클릭하여 날짜 선택</span></h3>
      <div style="display:flex;gap:7px;align-items:flex-end;padding:6px 2px 0">${bars}</div>
      ${actLine}</div>
    <div class="card"><h3>주중 요약 <span class="hint">계획 기준</span></h3>
      <div class="reco ${shortDays.length?'crit':'ok'}" style="margin-bottom:8px"><div class="ic" data-ic="users"></div><div class="tx">
        <div class="r">${shortDays.length?`인원 부족 ${shortDays.length}일`:'주중 전일 인원 충족'}</div>
        <div class="s">${shortDays.length?shortDays.map(d=>d.date.slice(5)+'('+wdOf(d.date)+') +'+d.gap+'명').join(' · '):'가용 인원으로 계획 소화 가능'}</div></div></div>
      <div class="reco warn"><div class="ic" data-ic="activity"></div><div class="tx">
        <div class="r">최대 필요일 — ${peak?peak.date.slice(5)+'('+wdOf(peak.date)+') '+peak.need+'명':'-'}</div>
        <div class="s">${peak?`부하율 ${peak.load}% · 계획 ${(peak.qty/1000).toFixed(1)}천개 · 이 날 기준으로 T/O를 잡으면 나머지 요일은 여유`:''}</div></div></div>
      <div class="mini" style="margin-top:10px;line-height:1.7">필요 인원 = <b>표준인원 × (일 계획량 ÷ 일 CAPA)</b>.
        일 CAPA는 ${loadBase==='c75'?'7.5hr 정규':'9.5hr 잔업'} 기준이며, 위 [기준] 버튼으로 바꿔 비교할 수 있습니다.</div></div>
  </div>
  ${ledger('그룹별 일간 필요 인원',loadDate.slice(5)+'('+wdOf(loadDate)+') 기준 · '+gs.length+'개 그룹 — 클릭하여 펼침','<div class="tblscroll"><table class="tb tbsticky"><thead><tr><th style="text-align:left">그룹</th><th>부하율</th><th>표준</th><th>가용</th><th>필요</th><th>과부족</th></tr></thead><tbody>'+grows+'</tbody></table></div>')}
  ${ledger('라인별 일간 필요 인원',loadDate.slice(5)+'('+wdOf(loadDate)+') 기준 · 가동 '+cur.lines+'개 라인 — 클릭하여 펼침','<input class="tblsearch" oninput="tblFilter(this)" placeholder="라인 검색 (예: 튜브, 염모)…"><div class="tblscroll"><table class="tb tbsticky"><thead><tr><th style="text-align:left">라인</th><th>그룹</th><th>일 계획</th><th>일 CAPA</th><th>부하율</th><th>표준</th><th>가용</th><th>필요</th><th>과부족</th></tr></thead><tbody>'+lrows+'</tbody></table></div>')}`;
}
function loadView(){
  if(loadUnit==='day')return loadDayView();
  const base=loadBase, R=loadCalc(loadPlan,loadDays,base), rows=R.rows, groups=R.groups;
  const active=rows.filter(r=>r.wk>0);
  const totWk=active.reduce((a,r)=>a+r.wk,0), totCap=active.reduce((a,r)=>a+r.cap*loadDays,0), totLoad=totCap?Math.round(totWk/totCap*100):0;
  const over=groups.filter(g=>g.load>=100);
  const netGap=+groups.reduce((a,g)=>a+g.gap,0).toFixed(1);
  const shortG=groups.filter(g=>g.gap>0.4).sort((a,b)=>b.gap-a.gap);
  const surpG=groups.filter(g=>g.gap<-0.4).map(g=>({...g})).sort((a,b)=>a.gap-b.gap);
  const gcol=v=>v>=100?'#c25a52':v>=90?'#cb9447':v>=60?'#4a8a60':'#3f74b5';
  const mline=`<div class="mini" style="margin:2px 0 10px;display:flex;gap:8px;align-items:center;flex-wrap:wrap">기준: ${masterStatus()}${DB.master?`<button class="btn" style="padding:2px 9px;font-size:11px" onclick="masterReset()">내장값으로</button>`:''}</div>`;
  const dayBtn=d=>`<button class="btn ${loadDays===d?'p':''}" style="padding:5px 10px" onclick="loadDays=${d};go('load')">${d}일</button>`;
  const baseBtn=(k,lab)=>`<button class="btn ${loadBase===k?'p':''}" style="padding:5px 10px" onclick="loadBase='${k}';go('load')">${lab}</button>`;
  const unitBtn=(k,lab)=>`<button class="btn ${loadUnit===k?'p':''}" style="padding:5px 10px" onclick="loadUnit='${k}';go('load')">${lab}</button>`;
  const gbars=groups.map(g=>{const on=loadFilter===g.grp;return `<div class="barrow" style="grid-template-columns:78px 1fr 52px;padding:7px 6px;cursor:pointer;border-radius:8px;${on?'background:#f7f8f8':''}" onclick="loadFilter=(loadFilter==='${g.grp}'?null:'${g.grp}');go('load')"><div class="nm" style="font-size:12.5px">${g.grp}${on?' ▾':''}</div><div>${pbar(Math.min(100,g.load),gcol(g.load))}<div class="mini" style="margin-top:3px">필요 ${g.needAdj} / 가용 ${g.avail}명 · <span style="color:${g.gap>0?'#c25a52':'#4a8a60'}">${g.gap>0?'+'+g.gap+' 부족':g.gap<0?g.gap+' 여유':'적정'}</span></div></div><div class="vv tnum" style="color:${gcol(g.load)};font-size:13px">${g.load}%</div></div>`;}).join('');
  let reco='';
  for(const s of shortG){let need=s.gap;for(const u of surpG){if(need<=0.4)break;if(u.gap>=-0.4)continue;const mv=Math.min(need,-u.gap);if(mv<0.4)continue;reco+=`<div class="reco"><div class="ic" data-ic="arrow"></div><div class="tx"><div class="r">${u.grp} → ${s.grp} ${Math.round(mv)||1}명 재배치</div><div class="s">${u.grp} 여유 ${(-u.gap).toFixed(0)}명 · ${s.grp} 부족 ${s.gap.toFixed(0)}명(부하 ${s.load}%)</div></div></div>`;u.gap+=mv;need-=mv;}}
  if(!reco)reco='<div class="reco"><div class="ic" data-ic="check"></div><div class="tx"><div class="r">그룹 간 재배치 불필요</div><div class="s">현재 인력 배치로 대응 가능</div></div></div>';
  const shown=active.filter(r=>!loadFilter||r.grp===loadFilter).sort((a,b)=>b.load-a.load);
  const tbl=shown.map(r=>`<tr><td style="text-align:left">${r.name}</td><td>${r.grp}</td><td>${r.wk.toLocaleString()}</td><td>${(r.cap*loadDays).toLocaleString()}</td><td style="color:${gcol(r.load)};font-weight:700">${r.load}%</td><td>${r.need}</td><td>${r.avail}</td><td>${r.needAdj}</td><td class="${r.gap>0?'neg':r.gap<0?'pos':'zero'}">${r.gap>0?'+'+r.gap:r.gap}</td></tr>`).join('');
  const filterChip=loadFilter?`<span class="tag t-blue" style="cursor:pointer" onclick="loadFilter=null;go('load')">${loadFilter} 필터 ✕</span>`:'';
  return `
  <div class="card" style="margin-bottom:14px;padding:13px"><div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap"><div class="chead">주간계획 부하율 · 필요인원</div><span class="tag t-blue">${loadPlanName}</span><span class="mini">호기 CAPA(${base==='c75'?'7.5hr 정규':'9.5hr 잔업'}) × ${loadDays}일</span><span style="margin-left:auto;display:flex;gap:6px;align-items:center;flex-wrap:wrap"><span class="mini">단위</span>${unitBtn('week','주간')}${unitBtn('day','일간')}<span class="mini" style="margin-left:6px">기준</span>${baseBtn('c75','정규')}${baseBtn('c105','잔업')}<span class="mini" style="margin-left:6px">가동</span>${dayBtn(5)}${dayBtn(6)}<label class="btn" style="cursor:pointer" onclick="document.getElementById('loadFile').click()">↑ 주간계획 업로드</label><input id="loadFile" type="file" accept=".xlsx,.xls" style="display:none" onchange="loadUpload(this)"></span></div></div>
  
  ${mline}
  <div class="kstrip">
    <div class="ki"><div class="l">전체 부하율</div><div class="v tnum" style="color:${gcol(totLoad)}">${totLoad}<small>%</small></div><div class="d muted">계획 ${(totWk/1000).toFixed(0)}천 ÷ CAPA</div></div>
    <div class="ki"><div class="l">과부하 그룹</div><div class="v tnum" style="color:${over.length?'#c25a52':'#4a8a60'}">${over.length}<small>/${groups.length}</small></div><div class="d muted">${over.map(g=>g.grp).slice(0,3).join('·')||'없음'}</div></div>
    <div class="ki"><div class="l">순 인원 과부족</div><div class="v tnum" style="color:${netGap>0?'#c25a52':'#4a8a60'}">${netGap>0?'+'+netGap:netGap}<small>명</small></div><div class="d muted">필요−가용(부하반영)</div></div>
    <div class="ki"><div class="l">최대 과부하</div><div class="v tnum" style="font-size:16px">${groups[0]?groups[0].grp:'-'}</div><div class="d muted">${groups[0]?groups[0].load+'%':''}</div></div>
  </div>
  <div class="grid g2" style="grid-template-columns:1fr 1fr;margin-bottom:14px">
    <div class="card"><h3>그룹별 부하율 <span class="hint">클릭 → 라인 필터 · 100%↑ 잔업·증원</span></h3>${gbars}</div>
    <div class="card"><h3>AI 인력 재배치 추천 <span class="hint">여유 그룹 → 과부하 그룹</span></h3>${reco}</div>
  </div>
  ${ledger('라인별 부하율 · 필요인원','CAPA·표준인원 실데이터 연동 · '+shown.length+'개 라인 — 클릭하여 펼침','<input class="tblsearch" oninput="tblFilter(this)" placeholder="라인 검색 (예: 튜브, 염모)…"><div class="tblscroll"><table class="tb tbsticky"><thead><tr><th style="text-align:left">라인</th><th>그룹</th><th>주간계획</th><th>주CAPA</th><th>부하율</th><th>표준</th><th>가용</th><th>필요*</th><th>과부족</th></tr></thead><tbody>'+tbl+'</tbody></table></div><div class="mini" style="margin-top:6px">* 필요 = 표준인원 × 부하율. CAPA 기준: '+(base==='c75'?'7.5hr 정규':'9.5hr 잔업')+' · 부하율 100%↑ = 잔업 또는 증원 필요.</div>')}`;
}

V.home=()=>{
  const tp=totProd(),oee=avgOEE(),df=avgDefect(),need=headNeed(),cur=headCur();
  const orders=DB.stock.filter(s=>G.stock(s).need);
  const worst=[...myLines()].sort((a,b)=>G.cleanScore(b)-G.cleanScore(a))[0];
  const cln=myLines().filter(l=>G.cleanScore(l)>=75).length;
  const whRate=whZoneTotal(whZones()).rate;
  const hm=(lab,val,vals,col)=>`<div class="m"><div class="ml">${lab}</div><div class="mv tnum">${val}</div><div class="sp">${spark(vals,{color:col,w:104,h:24})}</div></div>`;
  const hero=`<div class="hero">
    <div class="hl"><div class="k">AI CONTROL TOWER</div><div class="t">통합 운영 현황</div><div class="s">8개 Agent가 실측을 종합해 <b style="color:#0f2438;text-decoration:underline;text-decoration-color:var(--muted)">‘판단’까지 자동화</b> · AP 헤어앤뷰티 사업장 가동 6/6 라인 · ${dataSource==='기준값'?'<b style="color:#8a7333">기준 데이터(시드)</b> — 실측 연결 시 자동 전환':'실데이터 '+dataSource}</div></div>
    <div class="hm">
      ${hm('생산 달성률',tp.ach+'<small>%</small>',[68,71,70,74,72,73,tp.ach],'#7fe0b0')}
      ${hm('OEE',oee+'<small>%</small>',[79,81,80,82,81,80,oee],'#7fe0b0')}
      ${hm('불량률',df+'<small>%</small>',DB.qualTrend.map(d=>d.v),'#c25a52')}
      ${hm('투입 / 필요',cur+'<small>/'+need+'명</small>',[86,88,85,88,90,88,cur],'#cb9447')}
    </div></div>`;
  const tiles=[
    {id:'prod',ic:'activity',n:'생산',v:tp.ach+'%',c:tp.ach>=80?'#4a8a60':'#cb9447'},
    {id:'labor',ic:'users',n:'인력',v:(need-cur>0?'−'+(need-cur):'0')+'명',c:need-cur>0?'#c25a52':'#4a8a60'},
    {id:'clean',ic:'droplet',n:'세척',v:cln?cln+'라인':'양호',c:cln?'#cb9447':'#4a8a60'},
    {id:'stock',ic:'package',n:'창고',v:whRate!=null?whRate+'%':(orders.length+'건'),c:(whRate>=100||orders.length)?'#c25a52':'#4a8a60'},
    {id:'safe',ic:'shield',n:'안전',v:DB.safety.wbgt>=28?'경고':'양호',c:DB.safety.wbgt>=28?'#cb9447':'#4a8a60'},
    {id:'qual',ic:'flask',n:'품질',v:df+'%',c:df<=1.5?'#4a8a60':'#cb9447'},
  ].filter(t=>ROLES[role].allow.includes(t.id));
  const otiles=`<div class="otiles">${tiles.map(t=>`<div class="otile" onclick="go('${t.id}')"><div class="oh"><span class="ico ${tintOf(t.c)}">${svic(t.ic,18)}</span><span class="dot" style="background:${t.c}"></span></div><div class="on">${t.n}</div><div class="ov tnum">${t.v}</div></div>`).join('')}</div>`;
  const lineBars=myLines().map(l=>{const a=G.achieve(l),col=a>=80?'#4a8a60':a>=65?'#cb9447':'#c25a52';return `<div class="barrow" style="grid-template-columns:70px 1fr 44px;padding:8px 0"><div class="nm" style="font-size:12.5px">${l.key}</div><div>${pbar(a,col)}<div class="mini" style="margin-top:3px">부하 ${G.load(l)}% · 종료 ${l.end}</div></div><div class="vv tnum" style="color:${col};font-size:12.5px">${a}%</div></div>`;}).join('');
  // ===== 작업 예측 · AI 판단 (내일·향후를 코드화된 기준으로) =====
  const fc=DB.forecast,peak=fc.reduce((m,d)=>d.v>m.v?d:m,fc[0]);
  const behind=myLines().filter(l=>G.achieve(l)<65);
  /* 홈은 요약만 — 판단 본문은 조치 추적이 원본(단일 소스). 별도 배열을 두면 문구가 갈라진다 */
  const _rank={crit:0,warn:1,ok:2};
  const preds=collectJudgments().slice().sort((a,b)=>_rank[a.lv]-_rank[b.lv]).slice(0,4);
  const predCard=`<div class="card" style="margin-top:16px"><div class="chead" style="margin-bottom:10px;display:flex;align-items:center;flex-wrap:wrap;gap:8px">오늘 AI 판단 <span class="mtag mp">요약</span><span style="text-transform:none;letter-spacing:0;font-weight:700;color:var(--muted)">우선순위 상위 ${preds.length}건</span><button class="btn p" style="margin-left:auto;padding:6px 13px;flex:none" onclick="go('track')">전체 ${collectJudgments().length}건 · 조치 추적 →</button></div>
    <div class="predgrid">${preds.map(x=>`<div class="pred ${x.lv}"><div class="ph"><span class="ico sm ${x.lv==='crit'?'r':x.lv==='warn'?'a':''}">${svic(x.ic,15)}</span><span class="pr">${escHtml(x.r)}</span><span class="predlv ${x.lv}">${x.lv==='crit'?'긴급':x.lv==='warn'?'경고':'정상'}</span></div><div class="prule">적용 기준 ${escHtml(x.rule)}</div></div>`).join('')}</div></div>`;
  const judgments=collectJudgments(),priority=judgments.find(x=>x.lv==='crit')||judgments.find(x=>x.lv==='warn')||judgments[0];
  const decisionFlow=`<div class="flowhead"><div class="flowstep"><b>1</b>현재 상태</div><span class="flowarrow">→</span><div class="flowstep"><b>2</b>위험 예측</div><span class="flowarrow">→</span><div class="flowstep"><b>3</b>AI 판단</div><span class="flowarrow">→</span><div class="flowstep on"><b>4</b>조치 실행</div></div>
  <div class="decisiongrid">
    <div class="decisioncard now"><div class="dt">${svic('activity',15)} 현재 상태</div><div class="dv">생산 ${tp.ach}% · 인력 ${cur}/${need}명</div><div class="ds">OEE ${oee}% · 불량 ${df}% · 가동 현황을 실시간 종합</div></div>
    <div class="decisioncard predict"><div class="dt">${svic('clock',15)} 최우선 예측</div><div class="dv">${priority.r}</div><div class="ds">${priority.s}<br><b>판단 기준:</b> ${priority.rule}</div></div>
    <div class="decisioncard act"><div class="dt">${svic('spark',15)} AI 권고 조치</div><div class="dv">${priority.act}</div><div class="ds">권고안을 검토한 뒤 실행하거나 담당자에게 전달하세요.</div><div class="dbtns">${actGet(actKey(priority)).st==='done'?`<span style="font-size:12.5px;font-weight:700;color:#176f42;background:#f7f8f8;border-radius:8px;padding:8px 14px">✓ 조치 완료됨</span>`:`<button class="btn p" onclick="actHome(${judgments.indexOf(priority)},'ok')">조치 승인</button><button class="btn" onclick="actHome(${judgments.indexOf(priority)},'fwd')">담당자 전달</button>`}<button class="btn" onclick="go('judge')">판단 근거</button></div></div>
  </div>`;
  return `
  ${hero}
  ${decisionFlow}
  ${predCard}
  <div class="chead" style="margin:18px 0 10px">실연동 시스템 <span class="mtag real">6종 실배포 · LIVE</span></div>
  <div class="sysboard">
    <div class="sysb" onclick="window.open(LIVE_URL.safe,'_blank')"><span class="sl">LIVE</span><div class="se"></div><div class="sn">젠키퍼</div><div class="sd">안전 셀프점검 · TBM · 신고</div></div>
    <div class="sysb" onclick="window.open(LIVE_URL.heat,'_blank')"><span class="sl">LIVE</span><div class="se"></div><div class="sn">히트워치</div><div class="sd">체감온도 · 푸시 · 휴게 부여</div></div>
    <div class="sysb" onclick="window.open(LIVE_URL.orikon,'_blank')"><span class="sl">LIVE</span><div class="se"></div><div class="sn">오리콘·P-BOX</div><div class="sd">실적 5초 집계 · D1 실측</div></div>
    <div class="sysb" onclick="window.open(LIVE_URL.wash,'_blank')"><span class="sl">LIVE</span><div class="se"></div><div class="sn">세척실</div><div class="sd">현장·관리자 실시간 연동</div></div>
    <div class="sysb" onclick="window.open(LIVE_URL.wh,'_blank')"><span class="sl">LIVE</span><div class="se"></div><div class="sn">창고 적치</div><div class="sd">관리자 · 현장 입력 · 히트맵</div></div>
    <div class="sysb" onclick="window.open(LIVE_URL.monthly,'_blank')"><span class="sl">LIVE</span><div class="se"></div><div class="sn">월마감 분석</div><div class="sd">정산 엑셀 → 경영 보고서</div></div>
  </div>
  <div class="chead" style="margin:2px 0 10px">운영 영역 바로가기</div>
  ${otiles}
  <div class="chead" style="margin:2px 0 10px">실시간 실적 <span class="mtag real">실측</span></div>
  ${renderLive()}
  <div class="card" style="margin-top:16px"><div class="chead" style="margin-bottom:12px">라인별 생산 달성률 <span class="mtag real">실측</span></div>${lineBars}</div>`;
};
V.prod=()=>{
  const tabs=[{k:'status',label:'실시간 현황'},{k:'pbox',label:'P-BOX·오리콘 실적'}];
  const t=vtabActive('prod',tabs);
  return vtabsBar('prod',tabs)+(t==='pbox'?renderLive():prodStatus());
};
