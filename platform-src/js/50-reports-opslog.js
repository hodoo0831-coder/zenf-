/* ===== ① 계획 · 예측 — 흐름의 출발점 =====
   주간계획 업로드가 여기서 일어나고, 그 결과로 나오는 예측(부하율·필요인원·
   지연오더)이 한 화면에 모인다. 업로드는 '관리', 결과는 'Agent 탭 안쪽'으로
   흩어져 있던 것을 한 자리로 합친 것. */
V.forecast=()=>{
  const tabs=[{k:'plan',label:'주간계획'},{k:'load',label:'부하율·필요인원'},{k:'delay',label:'지연오더'}];
  const t=vtabActive('forecast',tabs);
  const has=!!DB.plan;
  const head=`<div class="card" style="margin-bottom:14px;background:#fff;border:1px solid var(--line);color:var(--navy)">
    <div style="display:flex;align-items:center;gap:18px;flex-wrap:wrap">
      <div style="min-width:0"><div style="font-size:11px;letter-spacing:2.5px;color:var(--muted);font-weight:700">STEP 1 · PLAN → FORECAST</div>
        <div style="font-size:21px;font-weight:700;margin-top:5px">주간계획을 올리면 예측이 만들어집니다</div>
        <div style="font-size:12.5px;color:var(--muted);margin-top:5px">라인 목표 · 그룹 부하율 · 필요인원 · 지연 위험 오더가 한 번에 산출되고, 과부하는 <b style="color:var(--navy)">조치 티켓</b>으로 넘어갑니다</div></div>
      <div style="margin-left:auto;display:flex;gap:8px;flex-wrap:wrap;align-items:center">
        <input id="fcFile" type="file" accept=".xlsx,.xls" style="display:none" onchange="loadUpload(this)">
        <button class="btn p" onclick="document.getElementById('fcFile').click()">↑ 주간계획 올리기</button>
        <button class="btn" onclick="go('data')">기준 데이터</button>
      </div></div>
    <div class="mini" style="margin-top:10px;color:#8fa6c4">${has?'현재 계획: <b style="color:var(--navy)">'+escHtml(loadPlanName)+'</b> · 기준: '+escHtml(masterStatus()):'아직 계획이 없습니다 — 내장 샘플 기준으로 표시 중입니다'}</div>
  </div>`;
  return head+vtabsBar('forecast',tabs)+(t==='load'?loadView():t==='delay'?V.delay():V.plan());
};

/* ===== ④ 보고 — 일간 · 주간 · 월마감 ===== */
V.reports=()=>{
  const tabs=[{k:'daily',label:'일간 보고'},{k:'weekly',label:'주간 보고'},{k:'monthly',label:'월마감 보고서'}];
  const t=vtabActive('reports',tabs);
  return vtabsBar('reports',tabs)+(t==='weekly'?weeklyReport():t==='monthly'?V.report():dailyReport());
};
function dailyReport(){
  const b=buildDailyBrief(), tp=totProd(), oee=avgOEE(), df=avgDefect();
  const J=collectJudgments().filter(x=>x.lv!=='ok');
  return `<div class="card" style="margin-bottom:14px"><h3>일간 운영보고 <span class="hint">${todayKR()} · 8개 Agent 자동 취합</span>
    <span style="margin-left:auto;display:flex;gap:6px"><button class="btn" onclick="copyDailyBrief('one')">한 줄 복사</button><button class="btn p" onclick="copyDailyBrief('msg')">보고문 복사</button></span></h3>
    <div class="reco" style="margin-bottom:10px"><div class="ic" data-ic="spark"></div><div class="tx"><div class="r">${escHtml(b.oneLine)}</div></div></div>
    <pre style="white-space:pre-wrap;font-family:inherit;font-size:13px;line-height:1.7;margin:0;background:var(--bg);border-radius:10px;padding:14px 16px">${escHtml(b.msg)}</pre></div>
  <div class="kstrip">
    <div class="ki"><div class="l">생산 달성률</div><div class="v tnum">${tp.ach}<small>%</small></div><div class="d muted">${(tp.a/1000).toFixed(0)}천 / ${(tp.t/1000).toFixed(0)}천개</div></div>
    <div class="ki"><div class="l">OEE</div><div class="v tnum">${oee}<small>%</small></div></div>
    <div class="ki"><div class="l">불량률</div><div class="v tnum">${df}<small>%</small></div></div>
    <div class="ki"><div class="l">미조치 판단</div><div class="v tnum" style="color:${J.length?'#c25a52':'#4a8a60'}">${J.length}<small>건</small></div><div class="d muted"><a onclick="go('track')" style="color:#3f74b5;cursor:pointer">조치 추적 →</a></div></div>
  </div>`;
}
function weeklyReport(){
  const R=loadCalc(loadPlan,loadDays,loadBase), g=R.groups;
  const over=g.filter(x=>x.load>=100), tot=R.rows.filter(r=>r.wk>0);
  const totWk=tot.reduce((a,r)=>a+r.wk,0), totCap=tot.reduce((a,r)=>a+r.cap*loadDays,0);
  const netGap=+g.reduce((a,x)=>a+x.gap,0).toFixed(1);
  const rows=g.map(x=>`<tr><td style="text-align:left">${escHtml(x.grp)}</td><td>${x.load}%</td><td>${x.needAdj}</td><td>${x.avail}</td>
    <td style="color:${x.gap>0.4?'#c25a52':x.gap<-0.4?'#3f74b5':'#5f6d77'};font-weight:700">${x.gap>0?'+':''}${x.gap}</td></tr>`).join('');
  return `<div class="card" style="margin-bottom:14px"><h3>주간 운영보고 <span class="hint">${escHtml(loadPlanName)} · ${loadDays}일 기준</span></h3>
    <div class="kstrip" style="margin-bottom:12px">
      <div class="ki"><div class="l">주간 계획량</div><div class="v tnum">${(totWk/10000).toFixed(1)}<small>만개</small></div></div>
      <div class="ki"><div class="l">전체 부하율</div><div class="v tnum">${totCap?Math.round(totWk/totCap*100):0}<small>%</small></div></div>
      <div class="ki"><div class="l">과부하 그룹</div><div class="v tnum" style="color:${over.length?'#c25a52':'#4a8a60'}">${over.length}<small>/${g.length}</small></div><div class="d muted">${over.map(x=>x.grp).join('·')||'없음'}</div></div>
      <div class="ki"><div class="l">순 인원 과부족</div><div class="v tnum" style="color:${netGap>0?'#c25a52':'#4a8a60'}">${netGap>0?'+':''}${netGap}<small>명</small></div></div>
    </div>
    <table class="tb"><thead><tr><th style="text-align:left">라인군</th><th>부하율</th><th>필요(부하반영)</th><th>가용</th><th>과부족</th></tr></thead><tbody>${rows}</tbody></table>
    <div class="mini" style="margin-top:9px">부하율 100% 초과 그룹은 잔업·재배치 대상입니다. 상세는 <a onclick="go('forecast')" style="color:#3f74b5;cursor:pointer">계획·예측</a>에서 확인하세요.</div></div>`;
}
V.planhub=()=>{
  /* 계획·예측(주간계획·부하율·지연오더)은 ① 계획·예측 화면으로 이관.
     여기는 '오늘 현황'만 남긴다 — 흐름상 2단계(실측)에 속하므로. */
  return prodStatus()+`<div class="mini" style="margin-top:10px">주간계획·부하율·지연오더 예측은 <a onclick="go('forecast')" style="color:#3f74b5;cursor:pointer;font-weight:700">① 계획·예측</a>에서 봅니다.</div>`;
};


/* ============ 일자별 운영 기록 ============ */
const OPSLOG_SEED=[
 {d:'2026-08-22',items:[
   {t:'08:10',area:'판단',ev:'일일 자동 판단 7건 산출 — 긴급 2 · 경고 5',st:'warn'},
   {t:'09:05',area:'안전',ev:'폭염 경고 WBGT 29.4℃ — 시간당 휴식·수분 공지 발송',st:'done'}]},
 {d:'2026-08-21',items:[
   {t:'13:51',area:'간접작업',ev:'P-BOX 세척 6 PLT·540 EA 자동 집계 (정철훈·이호선 2인 분배 · 11 MH)',st:'info'},
   {t:'14:20',area:'생산',ev:'지연 위험 오더 2건 경고 → 우선순위 재조정',st:'done'}]},
 {d:'2026-08-20',items:[
   {t:'13:56',area:'간접작업',ev:'P-BOX 17 PLT·1,530 EA 집계 (2건 · 공동작업 자동 분배)',st:'info'},
   {t:'16:40',area:'세척',ev:'우선순위 89점 초과 — CIP 병렬 투입 권고 → 시행',st:'done'}]},
 {d:'2026-08-19',items:[
   {t:'09:50',area:'간접작업',ev:'단독작업 2.5 PLT 집계 · 생산성 편차 경보(0.11 PLT/MH ▼69%) → 재배치 검토',st:'warn'},
   {t:'11:00',area:'인력',ev:'익주 부하율 산출 — 초격차 +2.4명 부족 사전 경고',st:'warn'}]},
 {d:'2026-08-18',items:[
   {t:'12:20',area:'간접작업',ev:'P-BOX 33 PLT·2,970 EA 집계 — 일 최대 실적',st:'info'},
   {t:'15:30',area:'창고',ev:'HnB 1층 적치 초과 122% — 재배치안 자동 생성 → 이동 완료',st:'done'}]},
 {d:'2026-08-14',items:[
   {t:'18:00',area:'보고',ev:'주간 마감 자동 집계 — 주 누계 59 PLT · 5,310 EA · 보고문 발송',st:'done'}]},
 {d:'2026-08-12',items:[
   {t:'10:00',area:'창고',ev:'주 1회 적치 점검 — 12구역 평균 104% · 초과 7구역 판정 → 재배치 2건',st:'done'}]},
 {d:'2026-08-11',items:[
   {t:'09:30',area:'계획',ev:'33주 주간계획 업로드 → 익주 인력 부족 −2.4명 사전 산출·알람',st:'warn'}]},
 {d:'2026-08-08',items:[
   {t:'07:25',area:'간접작업',ev:'P-BOX 관리자 대시보드 가동 — 첫 자동 집계 14 PLT·1,260 EA',st:'info'}]},
 {d:'2026-08-07',items:[
   {t:'08:30',area:'시스템',ev:'가동 시작 — 현장 입력 → 5초 자동 집계 검증 완료 (D1 첫 레코드)',st:'done'}]}
];
function opsLog(ev,area,st){DB.opslog=DB.opslog||[];DB.opslog.push({ts:Date.now(),area,ev,st:st||'info'});saveDB();}
function opsDays(){
  const dyn={};(DB.opslog||[]).forEach(e=>{const d=new Date(e.ts),key=d.toISOString().slice(0,10);
    (dyn[key]=dyn[key]||[]).push({t:d.toTimeString().slice(0,5),area:e.area,ev:e.ev,st:e.st});});
  const days={};OPSLOG_SEED.forEach(x=>days[x.d]=[...x.items]);
  Object.entries(dyn).forEach(([d,items])=>{days[d]=[...(days[d]||[]),...items];});
  return days;
}
function opsPrint(d){
  const days=opsDays(), it=(days[d]||[]).sort((a,b)=>a.t<b.t?-1:1);
  if(!it.length)return;
  const wd=['일','월','화','수','목','금','토'][new Date(d+'T00:00:00').getDay()];
  const done=it.filter(x=>x.st==='done').length, warn=it.filter(x=>x.st==='warn').length;
  const stlab=st=>st==='done'?'조치 완료':st==='warn'?'경고·판단':'자동 집계';
  const rows=it.map(x=>`<tr><td>${x.t}</td><td>${x.area}</td><td style="text-align:left">${x.ev}</td><td class="s-${x.st}">${stlab(x.st)}</td></tr>`).join('');
  const _html=`<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8"><title>ZEN 일일 운영 보고서 ${d}</title><style> body{font-family:'NanumGothicEmbedded','NanumGothic','Nanum Gothic','나눔고딕','Malgun Gothic','맑은 고딕',system-ui,-apple-system,sans-serif;color:#1b2736;margin:36px 44px;min-width:760px}
    @media print{body{min-width:0}}
    .hd{display:flex;align-items:flex-end;justify-content:space-between;border-bottom:3px solid #1d3a5f;padding-bottom:12px}
    .hd h1{font-size:22px;margin:0}.hd .co{font-size:12px;color:#66788f;font-weight:700}
    .meta{margin-top:12px;font-size:13.5px;font-weight:700}
    .sum{display:flex;gap:12px;margin:16px 0}
    .sum div{flex:1;border:1px solid #e2e9f3;border-radius:10px;padding:12px 14px;text-align:center}
    .sum .n{font-size:24px;font-weight:700}.sum .l{font-size:11.5px;color:#66788f;font-weight:700;margin-top:3px}
    table{width:100%;border-collapse:collapse;margin-top:6px;font-size:12.5px}
    th{background:#f7f8f8;color:#3d557a;padding:8px 9px;font-size:11.5px}
    td{border-bottom:1px solid #edf1f6;padding:9px;text-align:center;vertical-align:top;line-height:1.5}
    .s-done{color:#4a8a60;font-weight:700}.s-warn{color:#b47708;font-weight:700}.s-info{color:#2f6db3;font-weight:700}
    .ft{margin-top:26px;display:flex;justify-content:space-between;align-items:flex-end;font-size:11.5px;color:#66788f}
    .sign{display:flex;gap:26px;font-size:12.5px;font-weight:700;color:#1b2736}
    .sign span{border-top:1px solid #9aa8b8;padding-top:6px;min-width:110px;text-align:center}
    .pbar{position:fixed;top:14px;right:16px;display:flex;gap:8px;z-index:99}.pbtn{background:#1d3a5f;color:#fff;border:0;border-radius:9px;padding:10px 18px;font-weight:700;font-size:13px;cursor:pointer;font-family:inherit;min-height:40px}.pbtn.ghost{background:#fff;color:#1d3a5f;border:1.5px solid #cbd6e4}\n    @media print{body{margin:12mm}.pbtn{display:none}}
  </style></head><body>
    <div class="hd"><h1>ZEN 일일 운영 보고서</h1><div class="co">ZEN Manufacturing Platform · AP 헤어앤뷰티 사업장 · 제니엘 제조사업부 사업3팀</div></div>
    <div class="meta">보고 일자 : ${d} (${wd})</div>
    <div class="sum"><div><div class="n">${it.length}</div><div class="l">총 기록</div></div>
      <div><div class="n" style="color:#4a8a60">${done}</div><div class="l">조치 완료</div></div>
      <div><div class="n" style="color:#b47708">${warn}</div><div class="l">경고·판단</div></div></div>
    <table><tr><th style="width:52px">시간</th><th style="width:76px">영역</th><th>내용</th><th style="width:78px">상태</th></tr>${rows}</table>
    <div class="ft"><span>본 보고서는 플랫폼 운영 기록에서 자동 생성되었습니다 · 출력 ${new Date().toISOString().slice(0,10)}</span>
      <div class="sign"><span>작성 : ZEN Platform (자동)</span><span>확인 : </span></div></div>
  </body></html>`;
  openDocView(_html,'ZEN 일일 운영 보고서 '+d);
}
function opsExport(){
  const days=opsDays(); const keys=Object.keys(days).sort().reverse();
  const aoa=[['일자','시간','영역','내용','상태']];
  keys.forEach(d=>[...days[d]].sort((a,b)=>a.t<b.t?-1:1).forEach(x=>aoa.push([d,x.t,x.area,x.ev,x.st==='done'?'조치 완료':x.st==='warn'?'경고·판단':'자동 집계'])));
  const ws=XLSX.utils.aoa_to_sheet(aoa);ws['!cols']=[{wch:11},{wch:6},{wch:9},{wch:70},{wch:10}];
  const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,'운영기록');
  XLSX.writeFile(wb,'ZEN_운영기록_'+new Date().toISOString().slice(0,10)+'.xlsx');
  toast('운영 기록 전체를 엑셀로 내보냈습니다');
}
function opsLogView(){
  const days=opsDays();
  const keys=Object.keys(days).sort().reverse();
  const dot=st=>st==='done'?'#0f2438':st==='warn'?'#e8940a':'#5b9bd5';
  const stlab=st=>st==='done'?'조치 완료':st==='warn'?'경고·판단':'자동 집계';
  const cards=keys.map(d=>{const it=days[d].sort((a,b)=>a.t<b.t?1:-1);
    const done=it.filter(x=>x.st==='done').length, warn=it.filter(x=>x.st==='warn').length;
    const wd=['일','월','화','수','목','금','토'][new Date(d+'T00:00:00').getDay()];
    return `<div class="card" style="margin-bottom:12px"><h3 style="font-size:15.5px;cursor:pointer" onclick="opsPrint('${d}')" title="클릭 시 일일 보고서 출력">${d} (${wd})
      <span class="hint" style="margin-left:10px">기록 ${it.length} · 조치 완료 ${done}${warn?' · 경고 '+warn:''}</span>
      <button class="btn" style="margin-left:auto;padding:5px 13px" onclick="event.stopPropagation();opsPrint('${d}')"> 일일 보고서</button></h3>
      ${it.map(x=>`<div style="display:flex;gap:11px;align-items:flex-start;padding:9px 2px;border-bottom:1px solid var(--line)">
        <span style="font-size:12px;font-weight:700;color:var(--muted);white-space:nowrap;margin-top:2px">${x.t}</span>
        <span style="width:8px;height:8px;border-radius:50%;background:${dot(x.st)};flex-shrink:0;margin-top:6px"></span>
        <span style="font-size:13.5px;font-weight:700;line-height:1.5;flex:1">${x.ev}</span>
        <span style="font-size:10.5px;font-weight:700;color:var(--muted);border:1px solid var(--line2);border-radius:16px;padding:2px 9px;white-space:nowrap">${x.area}</span>
        <span style="font-size:10.5px;font-weight:700;color:${dot(x.st)};white-space:nowrap;margin-top:2px">${stlab(x.st)}</span>
      </div>`).join('')}</div>`;}).join('');
  return `
  <div class="card" style="margin-bottom:14px;background:#fff;border:1px solid var(--line);color:var(--navy)">
    <div style="display:flex;align-items:center;gap:18px;flex-wrap:wrap">
      <div><div style="font-size:11px;letter-spacing:2.5px;color:var(--muted);font-weight:700">OPERATIONS LOG · 일자별 운영 기록</div>
        <div style="font-size:21px;font-weight:700;margin-top:5px">탐지·조치·집계가 날짜별 이력으로 남습니다</div>
        <div style="font-size:12.5px;color:var(--muted);margin-top:5px">날짜를 누르면 <b style="color:var(--navy)">일일 보고서로 즉시 출력(PDF)</b> — 인수인계·감사 대응</div></div>
      <div style="margin-left:auto;display:flex;gap:26px;align-items:center">
        <div><div class="tnum" style="font-size:28px;font-weight:700">${keys.length}</div><div style="font-size:11px;color:var(--muted)">기록 일수</div></div>
        <div><div class="tnum" style="font-size:28px;font-weight:700;color:var(--muted)">${keys.reduce((a,k)=>a+days[k].length,0)}</div><div style="font-size:11px;color:var(--muted)">누적 기록</div></div>
        <button class="btn" style="background:#0f2438;border-color:#0f2438;color:#fff;font-weight:700;padding:9px 16px" onclick="opsExport()">↓ 엑셀 내보내기</button>
      </div></div></div>
  ${cards}
  <div class="mini" style="margin-top:4px">8/7~8/21 기록은 D1 실측(work_records) 기반 · 이후 조치 이력은 플랫폼에서 자동 기록</div>`;
}
function actHome(i,mode){const J=collectJudgments(),x=J[i];if(!x)return;const k=actKey(x);DB.actions=DB.actions||{};
  if(mode==='ok'){DB.actions[k]=Object.assign(actGet(k),{st:'done',ts:Date.now()});opsLog(`[${x.area}] ${x.r} — 조치 승인·완료 처리`,x.area,'done');saveDB();toast('조치 승인 — 완료 처리되었습니다 (조치 추적 반영)');}
  else{const txt=`[조치 요청] ${x.area} — ${x.r}\n· 근거: ${x.s}\n· 적용 기준: ${x.rule}\n· 권장 조치: ${x.act}\n· 기한: 금일 내\n(ZEN Manufacturing Platform 자동 생성)`;
    DB.actions[k]=Object.assign(actGet(k),{st:'doing',txt,ts:Date.now()});saveDB();
    copyText(txt,'조치 문안 복사됨 — 담당자에게 전달하세요');}
  go(cur);}
V.ops=()=>{
  const target={production:'planhub',labor:'labor',clean:'clean',stock:'stock',indirect:'orikonwash',safe:'safe',quality:'qual'};
  const tabs=[{k:'production',label:'생산',ic:''},{k:'labor',label:'인력',ic:''},{k:'clean',label:'세척',ic:''},{k:'stock',label:'창고',ic:''},{k:'indirect',label:'간접작업',ic:''},{k:'safe',label:'안전',ic:''},{k:'quality',label:'품질',ic:''}].filter(x=>ROLES[role].allow.includes(target[x.k]));
  const t=vtabActive('ops',tabs);
  const map={production:()=>V.planhub(),labor:()=>V.labor(),clean:()=>V.clean()+renderSysLinks('clean'),stock:()=>V.stock()+renderSysLinks('stock'),indirect:()=>V.orikonwash(),safe:()=>V.safe(),quality:()=>V.qual()};
  const AGX=[{k:'production',n:'생산·계획',e:''},{k:'labor',n:'인력',e:''},{k:'clean',n:'세척',e:''},{k:'stock',n:'창고',e:''},{k:'indirect',n:'간접작업',e:''},{k:'safe',n:'안전',e:''},{k:'quality',n:'품질',e:''},{k:'insight',n:'분석·보고',e:'',go:'insight'}].filter(a=>a.go||tabs.some(x=>x.k===a.k));
  const engines='<div class="agx"><b>AI Agent 8기 가동중</b>'+AGX.map((a,i)=>{const on=a.k===t;
    const act=a.go?`go('${a.go}')`:`setVtab('ops','${a.k}')`;
    return `<button class="agxi${on?' on':''}" onclick="${act}"><i>${i+1}</i>${a.e} ${a.n} Agent</button>`;}).join('')
    +'<span class="agxn">판단은 <b>AI 판단·조치</b>에 집결</span></div>';
  return engines+(map[t]||map.production)();
};
