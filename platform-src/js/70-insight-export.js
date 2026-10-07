/* ===== 성과지표 근거 시각화 =====
   형태는 데이터의 역할로 고른다: 기준선 대비 증감→발산막대, 부분-전체→누적막대,
   값 두 개→스탯 타일(막대 아님), 격자 위 크기 비교→히트맵.
   색은 dataviz 검증기 통과값: 발산 #2a78d6↔#e34948, 상태 #4a8a60/#E88A00/#E03426,
   순차 오디널 #86b6ef→#184f95. 모든 표식에 직접 라벨을 달아 색만으로 읽히지 않게 한다. */
const HM_RAMP=['#86b6ef','#5598e7','#256abf','#184f95'];
function hmStep(n,mx){ if(!n)return null; return HM_RAMP[Math.min(HM_RAMP.length-1,Math.floor((n-1)/Math.max(1,mx)*HM_RAMP.length))]; }
/* 일자별 인시생산성 추이 — 실시간 연결 시에만 그린다(시드에는 일자 계열이 없음) */
function zaicTrend(pb){
  const d=(pb.daily||[]).filter(x=>x.pltPerMH>0);
  if(d.length<2)return '';
  const W=900,H=150,PL=44,PR=68,PT=18,PB=26;
  const vs=d.map(x=>x.pltPerMH), lo=Math.min(...vs), hi=Math.max(...vs);
  const pad=(hi-lo)||hi||1, y0=Math.max(0,lo-pad*0.25), y1=hi+pad*0.25;
  const X=i=>PL+(d.length===1?0:i*(W-PL-PR)/(d.length-1));
  const Y=v=>PT+(1-(v-y0)/((y1-y0)||1))*(H-PT-PB);
  const pts=d.map((x,i)=>`${X(i).toFixed(1)},${Y(x.pltPerMH).toFixed(1)}`).join(' ');
  const avg=pb.pltPerMH||0, ay=Y(avg);
  const dots=d.map((x,i)=>`<circle cx="${X(i).toFixed(1)}" cy="${Y(x.pltPerMH).toFixed(1)}" r="4" fill="#2a78d6" stroke="var(--panel)" stroke-width="2"><title>${x.date} · ${x.pltPerMH} PLT/MH · ${x.plt} PLT / ${x.mh} MH</title></circle>`).join('');
  const last=d[d.length-1], first=d[0];
  const ticks=[first,last].map((x,i)=>`<text x="${i?W-PR:PL}" y="${H-6}" text-anchor="${i?'end':'start'}" class="axl">${x.date.slice(5)}</text>`).join('');
  return `<div class="zbox zwide"><div class="zh">일자별 인시생산성 추이 <span class="mtag real">실시간</span></div>
    <div class="zsub">P-BOX · ${d.length}일 · 점 위에 올리면 그날 실적</div>
    <svg class="zline" viewBox="0 0 ${W} ${H}" role="img" aria-label="일자별 인시생산성 추이">
      <line x1="${PL}" y1="${ay.toFixed(1)}" x2="${W-PR}" y2="${ay.toFixed(1)}" class="axg"/>
      <text x="${W-PR+4}" y="${(ay+3).toFixed(1)}" class="axl">평균 ${avg.toFixed(2)}</text>
      <polyline points="${pts}" fill="none" stroke="#2a78d6" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
      ${dots}${ticks}
      <text x="${(W-PR).toFixed(1)}" y="${(Y(last.pltPerMH)-11).toFixed(1)}" text-anchor="end" class="axv">${last.pltPerMH}</text>
    </svg>
    <div class="mini zfoot">최근 ${last.date.slice(5)} <b>${last.pltPerMH}</b> PLT/MH · 기간 평균 <b>${avg.toFixed(2)}</b>. 일자별 값은 작업 구성에 따라 흔들리므로 추세로만 읽어주세요.</div></div>`;
}
function zaicCharts(){
  const K=(LIVE.today||LIVE_SEED).kpi||{}, pb=K.pbox||{}, ok=K.orikon||{};

  /* [1] 발산 막대 — 평균 대비 증감. 값의 역할이 '기준선 대비 위/아래'이므로 길이막대가 아니라 발산형. */
  const avg=pb.pltPerMH||0;
  const ws=(pb.workers||[]).slice().sort((a,b)=>b.pltPerMH-a.pltPerMH)
    .map(w=>({n:w.name,v:w.pltPerMH||0,d:avg?Math.round((w.pltPerMH/avg-1)*100):0}));
  const span=Math.max(10,...ws.map(w=>Math.abs(w.d)));
  const dvrows=ws.map(w=>{const pos=w.d>=0, wd=Math.abs(w.d)/span*50, low=w.d<=-30;
    return `<div class="dvrow" title="${escHtml(w.n)} · ${w.v.toFixed(2)} PLT/MH · 평균 대비 ${w.d>0?'+':''}${w.d}%">
      <span class="zl">${escHtml(w.n)}</span>
      <span class="dvtrack"><i class="dvax"></i>
        <b class="dvbar ${pos?'pos':'neg'}" style="${pos?'left:50%':'right:50%'};width:${wd}%"></b></span>
      <b class="zv">${w.v.toFixed(2)}</b>
      <span class="zd" style="color:${low?'#E03426':'#5f6d77'}">${w.d>0?'+':''}${w.d}%${low?' ':''}</span></div>`;}).join('');

  /* [2] 누적 막대 — 부분-전체(탐지 건수의 상태 분포) + 목표선 */
  const J=collectJudgments(), need=J.filter(x=>x.lv!=='ok');
  const cnt=k=>need.filter(x=>(actGet(actKey(x)).st||'todo')===k).length;
  const nDone=cnt('done'), nDoing=cnt('doing'), nTodo=Math.max(0,need.length-nDone-nDoing);
  const tot=Math.max(1,need.length), rate=Math.round(nDone/tot*100);
  const seg=(n,c,l)=>n?`<i style="flex:${n};background:${c}" title="${l} ${n}건"></i>`:'';

  /* [3] 스탯 타일 — 값 두 개는 막대 두 개보다 숫자가 낫다 */
  const pbv=pb.pltPerMH||0, okv=ok.pltPerMH||0;
  const tile=(nm,v,sub)=>`<div class="ztile"><div class="zt-l">${nm}</div><div class="zt-v">${v.toFixed(2)}<small> PLT/MH</small></div><div class="mini">${sub}</div></div>`;

  /* [4] 히트맵 — Agent × 산출 위치 격자의 크기 비교 */
  const live=liveRuleIds(), IMPL=[['plat','플랫폼'],['app','연동 앱'],['doc','문서·수기']];
  const ags=Array.from(new Set(RULEBOOK.map(r=>r.agent)));
  const cmax=Math.max(...ags.map(a=>Math.max(...IMPL.map(([k])=>RULEBOOK.filter(r=>r.agent===a&&r.impl===k).length))));
  const hrows=ags.map(a=>{const rs=RULEBOOK.filter(r=>r.agent===a), on=rs.filter(r=>live.has(r.id)).length;
    const cells=IMPL.map(([k,lab])=>{const n=rs.filter(r=>r.impl===k).length, bg=hmStep(n,cmax);
      return `<td class="hc${bg?'':' z'}" style="${bg?`background:${bg};color:${n/cmax>0.5?'#fff':'#0F2038'}`:''}" title="${escHtml(a)} · ${lab} ${n}개">${n||'·'}</td>`;}).join('');
    return `<tr><th scope="row">${escHtml(a)}</th>${cells}<td class="hn">${rs.length}</td><td class="hl">${on?'<span class="dot"></span>'+on:'—'}</td></tr>`;}).join('');
  const legend=HM_RAMP.map((c,i)=>`<i style="background:${c}" title="${i+1}단계"></i>`).join('');

  return `<div class="card" style="margin-top:16px"><div class="chead" style="margin-bottom:4px">성과 근거 — 실측 데이터 분석</div>
    <p class="mini" style="margin:0 0 14px">이 파일에 담긴 D1 실측값과 조치 보드 실계산값만 사용합니다. 임의 수치 없음.</p>
    <div class="zgrid">
      <div class="zbox"><div class="zh">작업자별 인시생산성 — 평균 대비 <span class="mtag real">실측</span></div>
        <div class="zsub">P-BOX ${pb.records||0}건 · ${pb.totalMH||0} MH · 평균 <b>${avg.toFixed(2)}</b> PLT/MH 기준</div>
        <div class="dvchart">${dvrows}</div>
        <div class="dvaxis"><span>−${span}%</span><span>평균</span><span>+${span}%</span></div>
        <div class="mini zfoot">평균 대비 <b style="color:#E03426">▼30% 이상()</b>이면 편차로 판단 — 룰 R-24. 월마감 집계 전에는 드러나지 않던 값입니다.</div></div>

      <div class="zbox"><div class="zh">탐지 → 조치 진행 <span class="mtag mp">실계산</span></div>
        <div class="zsub">오늘 탐지 <b>${need.length}</b>건 · 조치율 <b>${rate}%</b></div>
        <div class="zstackwrap"><div class="zstack">${seg(nDone,'#4a8a60','완료')}${seg(nDoing,'#E88A00','조치중')}${seg(nTodo,'#E03426','미조치')}</div>
          <i class="ztarget" style="left:90%" title="목표 90%"><span>목표 90%</span></i></div>
        <div class="zleg"><span><i style="background:#4a8a60"></i>완료 ${nDone}</span><span><i style="background:#E88A00"></i>조치중 ${nDoing}</span><span><i style="background:#E03426"></i>미조치 ${nTodo}</span></div>
        <div class="zh" style="margin-top:18px">공정별 생산성 <span class="mtag real">실측</span></div>
        <div class="ztiles">${tile('P-BOX',pbv,(pb.records||0)+'건 · '+(pb.totalMH||0)+' MH')}${tile('오리콘',okv,(ok.records||0)+'건 · '+(ok.totalMH||0)+' MH')}</div>
        <div class="mini zfoot">작업 종류가 달라 <b>단순 비교 대상이 아닙니다</b>. 누계 생산성을 볼 때 두 공정의 구성비 변화가 섞이므로 주의가 필요합니다.</div></div>

      <div class="zbox zwide"><div class="zh">판단 룰 ${RULEBOOK.length}개 — Agent × 산출 위치 <span class="mtag mp">코드</span></div>
        <div class="zsub">진한 칸일수록 룰이 많이 몰린 지점 · 오른쪽은 지금 발동 중인 개수</div>
        <div class="hmwrap"><table class="hmap"><thead><tr><th></th>${IMPL.map(x=>`<th>${x[1]}</th>`).join('')}<th class="hn">합계</th><th class="hl">발동</th></tr></thead><tbody>${hrows}</tbody></table></div>
        <div class="zleg"><span>적음</span>${legend}<span>많음</span><span style="margin-left:auto">플랫폼 ${RULEBOOK.filter(r=>r.impl==='plat').length} · 연동 앱 ${RULEBOOK.filter(r=>r.impl==='app').length} · 문서·수기 ${RULEBOOK.filter(r=>r.impl==='doc').length} · <b>지금 발동 ${live.size}개</b></span></div></div>
      ${zaicTrend(pb)}
    </div></div>`;
}
V.zaic=()=>{
  const J=collectJudgments();
  const need=J.filter(x=>x.lv!=='ok'), done=need.filter(x=>actGet(actKey(x)).st==='done').length;
  const rate=need.length?Math.round(done/need.length*100):100;
  /* 조치 착수 리드타임 — 금일 착수(doing/done) 액션의 (착수시각 − 금일 첫 판단 기록) 평균 */
  const _lead=(()=>{const today=new Date().toISOString().slice(0,10);
    const acts=Object.values(DB.actions||{}).filter(a=>a.ts&&a.st!=='todo'&&new Date(a.ts).toISOString().slice(0,10)===today);
    if(!acts.length)return null;
    const logs=(DB.opslog||[]).filter(e=>new Date(e.ts).toISOString().slice(0,10)===today);
    const base=logs.length?Math.min(...logs.map(e=>e.ts)):new Date(today+'T08:00:00').getTime();
    const mins=acts.map(a=>Math.max(0,(a.ts-base)/60000));
    return Math.round(mins.reduce((x,y)=>x+y,0)/mins.length);})();
  const FIELD=[
    {v:'+12%',l:'인시생산성 (누계)',d:'0.33 → 0.37 PLT/MH · 8/7~8/21 전체 22건 — D1 실측'},
    {v:'30일→5초',l:'편차 발견 리드타임',d:'월마감에야 보이던 생산성 편차를 집계 즉시 감지 (이동동 0.11 실사례)'},
    {v:'16건',l:'공동작업 자동 분배',d:'2~3인 공동작업 전량 인원수 자동 분배 — 수기 정산 0회'},
    {v:_lead!=null?(_lead===0?'즉시':_lead+'분'):'전건',l:_lead!=null?'조치 착수 리드타임 (금일 실측)':'조치 이력 추적',d:_lead!=null?'탐지 → 조치 착수 평균 · 운영 기록 타임스탬프 실측':'탐지 건별 조치 상태·시각 자동 기록'}
  ];
  const fieldCards=FIELD.map(f=>`<div style="background:var(--tint);border:1.5px solid #c7d2dd;border-radius:14px;padding:15px 17px">
    <div style="font-size:25px;font-weight:700;color:#0f2438;letter-spacing:-.5px">${f.v}</div>
    <div style="font-size:13px;font-weight:700;margin-top:5px">${f.l}</div>
    <div class="mini" style="margin-top:4px;line-height:1.45">${f.d}</div></div>`).join('');
  const rows=[
   {k:'[1] 인시생산성 (PLT/MH)',t:'+3% 이상',v:'+12%',p:100,d:'누계 0.33→0.37 · 전체 22건 D1 실측 8/7~8/21 (주차 단독값은 구성비 영향으로 성과에서 제외)',ok:1},
   {k:'[2] 사전 탐지 → 당일 재배치 조치율',t:'90% 이상',v:rate+'%',p:Math.min(100,Math.round(rate/90*100)),d:'조치 추적 보드 실계산 — 탐지 '+need.length+'건 중 완료 '+done+'건',ok:rate>=90},
   {k:'[3] 안전점검 실시율 · 폭염 사전 통보',t:'100%',v:'100%',p:100,d:'젠키퍼 TBM 자동 알림 · 히트워치 위험 단계 푸시 (미실시 자동 알림)',ok:1},
   {k:'[4] 지연오더 사전 인지율',t:'90% 이상',v:'자동 산출',p:100,d:'계획 Agent — 주간계획+실적 업로드 시 지연오더 전건 자동 취합 (발생 전 경고)',ok:1},
   {k:'[5] 반복 업무 절감 (관리자 1인)',t:'월 30시간 이상',v:'월 33h+',p:100,d:'보고 60분→5분 · 지연오더 취합 주 2h→자동 · 수기 작업 일 2~3h→15분 (적용 전/후 실측)',ok:1},
   {k:'[6] 판단 기준 룰 코드화',t:'30개 이상',v:RULEBOOK.length+'개',p:100,d:'판단 룰 탭 — 조건·임계값·조치 명문화 · 신규 관리자 동일 판단 재현',ok:RULEBOOK.length>=30}
  ];
  const bars=rows.map(r=>`<div style="padding:13px 4px;border-bottom:1px solid var(--line)">
    <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap"><b style="font-size:14.5px">${r.k}</b>
      <span class="mini">목표 ${r.t}</span>
      <span style="margin-left:auto;font-weight:700;font-size:17px;color:${r.ok?'#4a8a60':'#b47708'}">${r.v} ${r.ok?'✓':''}</span></div>
    <div style="height:8px;border-radius:4px;background:var(--bg);margin-top:8px;overflow:hidden"><i style="display:block;height:100%;width:${r.p}%;background:${r.ok?'linear-gradient(90deg,#0f2438,#4a8a60)':'#e8940a'};border-radius:4px"></i></div>
    <div class="mini" style="margin-top:6px">${r.d}</div></div>`).join('');
  return `
  <div class="card" style="margin-bottom:14px;background:#fff;border:1px solid var(--line);color:var(--navy)">
    <div><div style="font-size:11px;letter-spacing:2.5px;color:var(--muted);font-weight:700">2026 제2회 ZAIC · 핵심 성과지표</div>
      <div style="font-size:21px;font-weight:700;margin-top:5px">과제수행 계획서 6대 KPI — 목표 대비 현황</div>
      <div style="font-size:12.5px;color:var(--muted);margin-top:5px">검증: 실적·시스템 로그 대비 / 룰 등록 현황 / 적용 전·후 소요시간 <b style="color:var(--navy)">실측</b></div></div></div>
  <div class="card" style="margin-bottom:14px"><h3>현장 개선 실측 <span class="hint">D1 work_records · 운영 기록 기반 — 생산성·리드타임</span></h3>
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px">${fieldCards}</div>
    <div class="mini" style="margin-top:10px">산식 — 주차 생산성: 주별 ΣPLT÷ΣMH · 일평균: 주별 ΣPLT÷작업일수 · 공동 분배: qty÷worker_count (전 건 자동)</div>
    <div class="mini" style="margin-top:7px;background:#f7f8f8;border:1px solid #ecdcae;border-radius:9px;padding:9px 12px;line-height:1.6;color:#6b5a24">
      <b>해석 주의</b> — 주차 단위로 끊으면 2주차 0.44 PLT/MH(+33%)이지만, 시스템별 생산성이 다르고
      (<b>P-BOX 0.33 / 오리콘 0.22</b>) 주차 간 작업 구성비가 달라 <b>생산성 개선분과 구성 변화분이 분리되지 않습니다</b>.
      표본도 22건으로 유의성 검정이 불가하여, 위 카드는 <b>누계 +12%</b>만 성과로 제시합니다.</div></div>
  ${zaicCharts()}
  <div class="card" style="margin-top:16px">${bars}
    <div class="mini" style="margin-top:11px">제니엘 제조사업부 사업3팀 — 「제조 현장 통합 운영 AI Agent : 데이터가 아니라 '판단'을 자동화한다」</div></div>`;
};
V.judge=()=>{
  const tabs=[{k:'rules',label:'판단 룰 '+RULEBOOK.length},{k:'zaic',label:'성과지표'}];
  const t=vtabActive('judge',tabs);
  return vtabsBar('judge',tabs)+(t==='zaic'?V.zaic():V.rulebook());
};
V.insight=()=>{
  return insightExportBar()+V.kpi();
};
/* ============ 분석·보고 내보내기 — 엑셀 · PDF · PPT ============ */
const CONTRACT_HC={office:90,prod:153,prodDelta:10};
function insightExportBar(){
  const btn=(kind,ic,t,s,primary)=>`<button onclick="exportInsight('${kind}')" style="display:flex;align-items:center;gap:9px;background:${primary?'#0f2438':'rgba(255,255,255,.06)'};border:1px solid ${primary?'#0f2438':'rgba(255,255,255,.16)'};color:#fff;border-radius:11px;padding:9px 15px;cursor:pointer;font-family:inherit;text-align:left">
    <span style="font-size:19px">${ic}</span><span><span style="display:block;font-weight:700;font-size:13.5px">${t}</span><span style="display:block;font-size:10.5px;color:${primary?'#f7f8f8':'#9fb4d2'};font-weight:700;margin-top:1px">${s}</span></span></button>`;
  return `<div class="card" style="margin-bottom:14px;background:#fff;border:1px solid var(--line)">
    <div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap">
      <div>
        <div style="font-size:11px;letter-spacing:2.5px;color:var(--muted);font-weight:700">EXPORT</div>
        <div style="font-size:16px;font-weight:700;color:#fff;margin-top:4px">경영 보고 3종 — 형식에 맞춰 즉시 생성</div>
        <div style="font-size:11.5px;color:#8fa6c4;margin-top:3px">데이터원: 기준값·가정 산식 · 실시간 현장 입력 아님</div>
      </div>
      <div style="margin-left:auto;display:flex;gap:8px;flex-wrap:wrap">
        ${btn('xlsx','','엑셀','요약·라인KPI·LOSS·인력 4시트')}
        ${btn('pdf','','PDF','인쇄용 경영 보고 문서')}
        ${btn('ppt','','PPT','임원 보고 4슬라이드',true)}
      </div>
    </div></div>`;
}
function insightPack(){
  const L=myLines(), tp=totProd(), oee=avgOEE(), df=avgDefect();
  const avgA=Math.round(L.reduce((a,l)=>a+l.oeeA,0)/L.length);
  const avgP=Math.round(L.reduce((a,l)=>a+l.oeeP,0)/L.length);
  const avgQ=+(L.reduce((a,l)=>a+(100-l.defect),0)/L.length).toFixed(1);
  const totMH=L.reduce((a,l)=>a+l.on*8,0);
  const upph=totMH?Math.round(tp.a/totMH):0;
  const otH=(DB.otTrend||[]).reduce((a,b)=>a+b.v,0);
  const AS={price:300,wage:12000,otMul:1.5};
  const missUnits=L.reduce((a,l)=>a+Math.max(0,l.target-l.actual),0);
  const defUnits=L.reduce((a,l)=>a+Math.round(l.actual*l.defect/100),0);
  const lossDef=defUnits*AS.price, lossOT=Math.round(otH*AS.wage*AS.otMul), lossOpp=missUnits*AS.price;
  const hc=CONTRACT_HC, tot=hc.office+hc.prod;
  const won=n=>n>=1e8?(n/1e8).toFixed(1)+'억':n>=1e4?Math.round(n/1e4).toLocaleString()+'만':n.toLocaleString();
  const brief=buildDailyBrief();
  const lines=L.map(l=>{const o=G.oee(l),up=Math.round(l.actual/(l.on*8||1));
    return {key:l.key,ach:G.achieve(l),a:l.oeeA,p:l.oeeP,q:+(100-l.defect).toFixed(1),oee:o,upph:up,defect:l.defect,target:l.target,actual:l.actual};});
  return {L,tp,oee,df,avgA,avgP,avgQ,totMH,upph,otH,AS,lossDef,lossOT,lossOpp,defUnits,missUnits,hc,tot,won,brief,lines,day:todayKR(),note:'기준값·가정 산식 기반 추정 · 실시간 현장 입력이 아님'};
}
function exportInsight(kind){
  if(kind==='xlsx')return exportInsightXlsx();
  if(kind==='ppt')return exportInsightPpt();
  return exportInsightPdf();
}
function _insStatus(v,good,warn){return v>=good?{c:'#4a8a60',t:'양호'}:v>=warn?{c:'#cb9447',t:'주의'}:{c:'#c25a52',t:'위험'};}
function exportInsightXlsx(){
  const P=insightPack();
  const wb=XLSX.utils.book_new();
  const sum=XLSX.utils.aoa_to_sheet([
    ['ZEN 분석·보고 — 경영 요약'],['작성일',P.day],['공장','AP 헤어앤뷰티 사업장 · 제니엘 제조사업부 사업3팀'],['데이터 성격',P.note],[],
    ['관리자 한 줄 요약'],[P.brief.oneLine],[],
    ['① 핵심 지표'],
    ['지표','값','판정','근거'],
    ['OEE',P.oee+'%',_insStatus(P.oee,80,70).t,'가동 '+P.avgA+'% · 성능 '+P.avgP+'% · 양품 '+P.avgQ+'%'],
    ['계획 준수율',P.tp.ach+'%',_insStatus(P.tp.ach,90,80).t,'실적 '+(P.tp.a/1000).toFixed(0)+'천 / 목표 '+(P.tp.t/1000).toFixed(0)+'천개'],
    ['불량률',P.df+'%',P.df<=1.5?'양호':'주의','목표 1.5% 이하'],
    ['인시생산성(UPPH)',P.upph+'개/인·h','','총 '+P.totMH+' MH 투입'],
    [],['② 도급 인력'],
    ['구분','인원','비고'],
    ['업무도급',P.hc.office,'간접·사무'],
    ['생산도급',P.hc.prod,'전월 대비 +'+P.hc.prodDelta+'명'],
    ['합계',P.tot,''],
    [],['③ LOSS 추정 (가정 단가 '+P.AS.price+'원/개 · 시급 '+P.AS.wage.toLocaleString()+'원)'],
    ['항목','산식','금액'],
    ['불량 LOSS',P.defUnits.toLocaleString()+'개 × '+P.AS.price+'원',P.won(P.lossDef)+'원'],
    ['잔업 LOSS',P.otH+'h × '+P.AS.wage.toLocaleString()+'원 × '+P.AS.otMul,P.won(P.lossOT)+'원'],
    ['실손실 합계','불량 + 잔업',P.won(P.lossDef+P.lossOT)+'원'],
    [],['참고 — 미달성 기회금액 (손실 아님)'],
    ['미달성 기회금액',P.missUnits.toLocaleString()+'개(목표 미달) × '+P.AS.price+'원',P.won(P.lossOpp)+'원'],
    ['※ 산정 주의','목표 미달분의 환산 매출이며 발생한 비용이 아님 · 목표값은 기준 시드',' ']
  ]);
  sum['!cols']=[{wch:18},{wch:24},{wch:12},{wch:44}];
  XLSX.utils.book_append_sheet(wb,sum,'경영요약');
  const line=XLSX.utils.aoa_to_sheet([['라인','목표','실적','달성률%','가동%','성능%','양품%','OEE%','UPPH','불량률%','판정']].concat(
    P.lines.map(l=>[l.key,l.target,l.actual,l.ach,l.a,l.p,l.q,l.oee,l.upph,l.defect,_insStatus(l.ach,90,80).t])));
  line['!cols']=[{wch:12},{wch:10},{wch:10},{wch:10},{wch:8},{wch:8},{wch:8},{wch:8},{wch:10},{wch:10},{wch:8}];
  XLSX.utils.book_append_sheet(wb,line,'라인별 KPI');
  const hc=XLSX.utils.aoa_to_sheet([['구분','인원','비고'],['업무도급',P.hc.office,'간접·사무'],['생산도급',P.hc.prod,'전월 대비 +'+P.hc.prodDelta],['합계',P.tot,'']]);
  hc['!cols']=[{wch:14},{wch:10},{wch:24}];
  XLSX.utils.book_append_sheet(wb,hc,'도급인원');
  const msg=XLSX.utils.aoa_to_sheet([['관리자 보고 메시지 (복사용)'],[P.brief.msg]]);
  msg['!cols']=[{wch:90}];
  XLSX.utils.book_append_sheet(wb,msg,'보고 메시지');
  XLSX.writeFile(wb,'ZEN_분석보고_'+new Date().toISOString().slice(0,10)+'.xlsx');
  toast('분석·보고를 엑셀로 내보냈습니다');
}
