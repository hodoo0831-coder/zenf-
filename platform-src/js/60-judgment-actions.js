/* ===== AI 판단 센터 — 전 Agent 자동 판단 통합(실측→기준→판단→조치) ===== */
function collectJudgments(){
  const J=[], L=myLines(), w=DB.safety;
  const _LR=loadCalc(loadPlan,loadDays,loadBase);
  const _short=_LR.groups.filter(g=>g.gap>0.4), _surp=_LR.groups.filter(g=>g.gap<-0.4);
  const _tot=+_short.reduce((a,g)=>a+g.gap,0).toFixed(1);
  J.push({area:'인력',ic:'users',lv:_tot>0?'warn':'ok',r:`익주 인력 ${_tot>0?'부족 −'+_tot+'명':'충족'}`,
    s:`${loadPlanName} 실계산 · ${_short.length?'과부하 '+_short.map(g=>g.grp+' +'+g.gap).join('·'):'전 그룹 여유'}`
      +(()=>{const A=laborLive();return A?` — 간접작업 실투입 ${A.n}명 / ${A.mh}MH (${A.date} 실측)`:'';})(),
    rule:'부하율 = 계획량 ÷ 주CAPA > 100%',
    act:_tot>0?(_surp.length?`${_surp[0].grp} 여유 ${Math.abs(_surp[0].gap)}명 → ${_short[0].grp} 재배치`:'잔업·단기인력 검토'):'현 배치 유지'});
  const behind=L.filter(l=>G.achieve(l)<70);
  J.push({area:'생산',ic:'activity',lv:behind.length?'crit':'ok',r:`지연 위험 오더 ${behind.length}건`,s:behind.length?behind.map(l=>l.key+' '+G.achieve(l)+'%').join(' · '):'전 라인 정상 진척',rule:'달성률 < 70%',act:behind.length?'우선순위 재조정 · 투입 강화':'모니터링'});
  J.push({area:'안전',ic:'thermometer',lv:w.wbgt>=31?'crit':w.wbgt>=28?'warn':'ok',r:`폭염 ${w.wbgt>=31?'위험':w.wbgt>=28?'경고':'주의'} · WBGT ${w.wbgt}℃`,s:`기온 ${w.temp}℃ 습도 ${w.humid}% · 무재해 ${w.noAccident}일`+(HEATLIVE?` — 기상 실황 ${HEATLIVE.stamp||''} 실측`:''),rule:'WBGT ≥ 28℃',act:w.wbgt>=28?'시간당 휴식·수분 · 옥외작업 단축':'정상 운영'});
  const worst=[...L].sort((a,b)=>G.cleanScore(b)-G.cleanScore(a))[0];
  const _wS=(typeof washStats==='function')?washStats():null, _wm=_wS&&_wS[worst.key];
  const _wsrc=(()=>{
    if(!_wm)return '전환·주기·부하 가중 반영';
    const bits=[];
    if(_wm.washing)bits.push(`세척 진행 중 ${_wm.washing}건`);
    if(_wm.wait){let t='대기 '+_wm.wait+'건'; if(_wm.waitMax)t+=' · 최장 '+_wm.waitMax+'분'; bits.push(t);}
    if(_wm.lastEndH!=null)bits.push(`마지막 완료 ${_wm.lastEndH}h 전`);
    return (bits.length?bits.join(' · '):'대기·진행 없음')+' — 세척실 앱 실측';
  })();
  J.push({area:'세척',ic:'droplet',lv:G.cleanScore(worst)>=75?'warn':'ok',r:`${worst.key} 세척 우선순위 1위`,s:`우선순위 ${G.cleanScore(worst)}점 · ${_wsrc}`,rule:'우선순위 ≥ 75점',act:'CIP 병렬 투입 · 완료 지연 방지'});
  const zones=whZones();
  const gr=whGrowth(), over=zones.filter(z=>z.rate>=100), satPred=zones.filter(z=>z.rate<100&&Math.round(z.rate*(1+gr))>=100);
  const _wlN=zones.filter(z=>z.live).length;
  const _wsrcz=_wlN?`창고 앱 실측 ${_wlN}/${WH_APP_ZONES.length}구역 (${whLiveDate()||'-'} 점검)`:(DB.wh?'주간 점검 엑셀':'기준 데이터');
  J.push({area:'창고',ic:'package',lv:over.length?'crit':satPred.length?'warn':'ok',r:`적치 초과 ${over.length}구역 · 익주 포화 예측 ${satPred.length}구역`,s:(over.length?over.slice(0,3).map(z=>z.name.replace(/\[.*?\]/g,'').trim()+' '+z.rate+'%').join(' · '):'전 구역 여유')+` — ${_wsrcz}`,rule:'적치율 ≥ 100% / 예측 ≥ 100%',act:over.length?'초과분 여유 구역 재배치·출하 우선':'현 배치 유지'});
  const df=avgDefect();
  J.push({area:'품질',ic:'flask',lv:df>1.5?'warn':'ok',r:`불량률 ${df}%`,s:`목표 1.5% ${df>1.5?'초과':'이내'} · 주요 원인 ${(DB.paretoNames&&DB.paretoNames[0])||'-'}`,rule:'불량률 > 1.5%',act:df>1.5?'최다 라인 원인 조치':'현 수준 유지'});
  const pb=LIVE_SEED.kpi.pbox, low=pb.workers.reduce((m,x)=>x.pltPerMH<m.pltPerMH?x:m,pb.workers[0]);
  const dev=Math.round((1-low.pltPerMH/pb.pltPerMH)*100);
  J.push({area:'간접작업',ic:'package',lv:dev>=40?'warn':'ok',r:`P-BOX·오리콘 생산성 편차 ${dev>=40?'감지':'정상'}`,s:`${low.name} ${low.pltPerMH} PLT/MH · 평균 ${pb.pltPerMH} 대비 ▼${dev}% (현장 앱 실적 자동 집계)`,rule:'작업자 생산성 편차 > 40%',act:dev>=40?'저생산성 작업자 재배치·표준작업 교육':'현 배치 유지'});
  return J;
}
let judgeFilter='전체';
V.judgeLog=()=>{
  const J=collectJudgments();
  const crit=J.filter(x=>x.lv==='crit').length, act=J.filter(x=>x.lv!=='ok').length;
  const areas=['전체',...Array.from(new Set(J.map(x=>x.area)))];
  const cf=judgeFilter;
  const chips=areas.map(a=>`<button class="btn ${a===cf?'p':''}" style="padding:6px 12px" onclick="judgeFilter='${a}';go('judge')">${a}</button>`).join(' ');
  const list=J.filter(x=>cf==='전체'||x.area===cf);
  const cards=list.map(x=>`<div class="pred ${x.lv}"><div class="ph"><span class="ico sm ${x.lv==='crit'?'r':x.lv==='warn'?'a':''}">${svic(x.ic,15)}</span><span class="pr">${x.r}</span><span style="margin-left:auto;font-size:10.5px;font-weight:700;color:var(--muted);border:1px solid var(--line2);border-radius:20px;padding:2px 9px">${x.area}</span></div><div class="ps">${x.s}</div><div style="display:flex;gap:9px;flex-wrap:wrap;margin-top:9px;align-items:center"><span class="prule">적용 기준 ${x.rule}</span><span style="font-size:11.5px;color:var(--muted)">→ 권장 <b style="color:var(--ink)">${x.act}</b></span></div></div>`).join('');
  return `
  <div class="card" style="margin-bottom:14px;background:#fff;border:1px solid var(--line);color:var(--navy)">
    <div style="display:flex;align-items:center;gap:18px;flex-wrap:wrap">
      <div><div style="font-size:11px;letter-spacing:2.5px;color:var(--muted);font-weight:700">AI DECISION CENTER</div>
        <div style="font-size:21px;font-weight:700;margin-top:5px">실측 → 기준 대조 → 판단 → 권장 조치</div>
        <div style="font-size:12.5px;color:var(--muted);margin-top:5px">8개 Agent의 판단을 <b style="color:var(--navy)">한 화면</b>에서</div></div>
      <div style="margin-left:auto;display:flex;gap:30px">
        <div><div class="tnum" style="font-size:28px;font-weight:700">${J.length}</div><div style="font-size:11px;color:var(--muted)">오늘 자동 판단</div></div>
        <div><div class="tnum" style="font-size:28px;font-weight:700;color:var(--warn)">${act}</div><div style="font-size:11px;color:var(--muted)">조치 권고</div></div>
        <div><div class="tnum" style="font-size:28px;font-weight:700;color:var(--err)">${crit}</div><div style="font-size:11px;color:var(--muted)">긴급</div></div>
      </div>
    </div>
  </div>
  <div class="card"><h3>판단 로그 <span class="hint">코드화된 기준으로 자동 판단 · 권장 조치까지</span><span style="margin-left:auto;display:flex;gap:6px;flex-wrap:wrap">${chips}</span></h3>
    <div class="predgrid">${cards}</div>
    <div class="mini" style="margin-top:11px">실측 + 코드화된 기준으로 자동 산출 — 사람은 <b>조치</b>에 집중</div>
  </div>`;
};

/* ============ 판단 룰 카탈로그 · 조치 추적 · ZAIC 성과지표 ============ */
const RULEBOOK=[
 {id:'R-01',agent:'인력',cond:'부하율 = 계획량 ÷ 인력 주CAPA',th:'≥ 100%',judge:'과부하 그룹 · 인력 부족 구간',act:'여유 그룹 재배치 · 필요 T/O 산출',impl:'plat'},
 {id:'R-02',agent:'인력',cond:'부하율',th:'< 70%',judge:'여유 인력',act:'타 그룹 지원 전환 추천',impl:'plat'},
 {id:'R-03',agent:'인력',cond:'그룹 간 부족·여유 격차',th:'> 0.4명',judge:'재배치 대상',act:'이동 배치안 자동 생성',impl:'plat'},
 {id:'R-04',agent:'인력',cond:'신장률 시뮬레이션(±%)',th:'입력값',judge:'필요 인원 변화',act:'시나리오별 T/O 재산출',impl:'plat'},
 {id:'R-05',agent:'인력',cond:'주간계획 업로드',th:'즉시',judge:'익주 부족·여유 사전 산출',act:'발생 전 알람 (선제 판단)',impl:'plat'},
 {id:'R-06',agent:'생산',cond:'오더 달성률',th:'< 70%',judge:'지연 위험 오더',act:'우선순위 재조정 · 투입 강화',impl:'plat'},
 {id:'R-07',agent:'생산',cond:'CAPA 부하율',th:'≥ 100%',judge:'과부하 라인',act:'잔업·증원 검토',impl:'plat'},
 {id:'R-08',agent:'생산',cond:'계획 대비 실적 (오더별)',th:'< 100%',judge:'지연오더 자동 취합',act:'부족수량 순 목록 · 엑셀 산출',impl:'plat'},
 {id:'R-09',agent:'생산',cond:'시간당 산출 급락',th:'전시간 −30%',judge:'라인 이상 징후',act:'설비·인력 점검 알림',impl:'doc'},
 {id:'R-10',agent:'세척',cond:'우선순위 점수 산식',th:'전환40+주기35+부하25',judge:'세척 순번 자동 추천',act:'순위·예상 완료시간 제시',impl:'plat'},
 {id:'R-11',agent:'세척',cond:'제품·색상·알러지 전환',th:'전환 발생',judge:'전환 가중 1.0 (최우선)',act:'해당 설비 상위 배치',impl:'plat'},
 {id:'R-12',agent:'세척',cond:'세척주기 경과',th:'≥ 8h',judge:'주기 가중 상승',act:'우선순위 점수 가산',impl:'plat'},
 {id:'R-13',agent:'세척',cond:'우선순위 점수',th:'≥ 75점',judge:'지연 위험',act:'CIP 병렬 투입 권고',impl:'plat'},
 {id:'R-14',agent:'세척',cond:'현장 순위 수정 + 사유 저장',th:'수정 발생',judge:'룰 보정 대상',act:'가중치 학습 반영 (자동판단율 목표 95%)',impl:'app'},
 {id:'R-15',agent:'창고',cond:'구역 적치율',th:'≥ 100%',judge:'초과 구역',act:'여유 구역 재배치 · 출하 우선',impl:'plat'},
 {id:'R-16',agent:'창고',cond:'구역 적치율',th:'90~99%',judge:'포화 임박',act:'입고 억제 · 모니터링 강화',impl:'plat'},
 {id:'R-17',agent:'창고',cond:'주간 증가율 반영 익주 예측',th:'≥ 100%',judge:'포화 예측',act:'선제 재배치안 생성',impl:'plat'},
 {id:'R-18',agent:'창고',cond:'초과분 재배치 비용',th:'거리·환적 가중',judge:'최적 이동 경로',act:'재배치안 + 보고문 자동 작성',impl:'doc'},
 {id:'R-19',agent:'창고',cond:'자재 소진일수 = 재고÷일소비',th:'≤ 재주문점',judge:'발주 필요',act:'즉시 발주 추천 (MOQ 반영)',impl:'plat'},
 {id:'R-20',agent:'안전',cond:'WBGT (온열지수)',th:'≥ 28℃',judge:'폭염 주의',act:'수분 · 휴식 안내',impl:'plat'},
 {id:'R-21',agent:'안전',cond:'WBGT',th:'≥ 31℃',judge:'폭염 경고',act:'시간당 10분 휴식 · 옥외 단축',impl:'plat'},
 {id:'R-22',agent:'안전',cond:'체감온도 (히트워치)',th:'≥ 35℃',judge:'위험',act:'푸시 알람 · 작업시간 조정',impl:'app'},
 {id:'R-23',agent:'안전',cond:'체감온도',th:'≥ 38℃',judge:'옥외작업 중지',act:'전면 중지 통보 100%',impl:'app'},
 {id:'R-24',agent:'안전',cond:'작업 전 TBM 실시 여부',th:'미실시',judge:'점검 누락',act:'자동 알림 100% (실시율 100%)',impl:'app'},
 {id:'R-25',agent:'안전',cond:'위험 신고 처리상태',th:'미조치 24h',judge:'방치 위험',act:'담당자 자동 재알림',impl:'app'},
 {id:'R-26',agent:'품질',cond:'불량률',th:'> 1.5%',judge:'품질 이상',act:'최다 원인 라인 조치 권고',impl:'plat'},
 {id:'R-27',agent:'품질',cond:'파레토 상위 불량 원인',th:'상위 1~3',judge:'교육 대상',act:'OPL 교육자료 자동 선정',impl:'plat'},
 {id:'R-28',agent:'간접작업',cond:'실적 집계 주기',th:'5초 · 다기기',judge:'실시간 통합',act:'수기 전표 대체 (자동 집계)',impl:'app'},
 {id:'R-29',agent:'간접작업',cond:'공동작업 실적',th:'인원수 분배',judge:'개인 실적 산출',act:'개인별 MH · PLT/MH 자동 계산',impl:'app'},
 {id:'R-30',agent:'간접작업',cond:'작업자 생산성 편차',th:'> 40%',judge:'이상치',act:'경보 · 판단 센터 상신',impl:'plat'},
 {id:'R-31',agent:'분석·보고',cond:'월마감 전월·전년 증감',th:'± 2σ 초과',judge:'이상치 항목',act:'자동 감지 · 드릴다운 제시',impl:'doc'},
 {id:'R-32',agent:'분석·보고',cond:'KPI 임계 미달 항목',th:'목표 대비',judge:'보고 하이라이트',act:'임원 보고서 자동 생성',impl:'plat'}
];
function liveRuleIds(){
  const J=collectJudgments(), ids=new Set();
  J.forEach(x=>{ if(x.lv==='ok')return;
    if(x.area==='인력')ids.add('R-01').add('R-03');
    if(x.area==='생산')ids.add('R-06');
    if(x.area==='안전')ids.add(DB.safety.wbgt>=31?'R-21':'R-20');
    if(x.area==='세척')ids.add('R-13');
    if(x.area==='창고')ids.add(x.lv==='crit'?'R-15':'R-17');
    if(x.area==='품질')ids.add('R-26');
    if(x.area==='간접작업')ids.add('R-30');
  });
  return ids;
}
let ruleFilter='전체';
/* ===== 룰 부가정보 =====
   룰이 "언제·무엇으로 판정되고, 얼마나 미리 알려주는가"를 명시한다.
   같은 Agent 안에서는 대개 동일하므로 Agent 기본값 + 룰별 예외로 둔다. */
const RULE_META_BY_AGENT={
  '인력':{src:'주간계획 xlsx + 인원·CAPA 마스터',when:'계획 업로드 즉시',lead:'익주 (7일 전)'},
  '생산':{src:'주간계획 + 라인 실적',when:'실적 갱신 시',lead:'당일 (2~4시간 전)'},
  '세척':{src:'세척실 앱 (라인 도착·완료 기록)',when:'5초 자동 갱신',lead:'즉시 ~ 당일'},
  '창고':{src:'창고 적치 점검표 (주 1회)',when:'점검표 업로드 시',lead:'익주 (7일 전)'},
  '안전':{src:'히트워치 · 젠키퍼 (기상·점검 기록)',when:'실시간 푸시',lead:'2~6시간 전'},
  '품질':{src:'라인별 불량 집계',when:'일 1회 마감',lead:'당일'},
  '간접작업':{src:'P-BOX·오리콘 앱 (작업자 입력)',when:'5초 자동 갱신',lead:'즉시'},
  '분석·보고':{src:'월 정산 엑셀 + 누적 KPI',when:'월마감 시',lead:'익월 (30일 주기)'},
};
const RULE_META={
  'R-05':{lead:'익주 (7일 전) · 선제 판단'},
  'R-09':{lead:'1시간 전'},
  'R-17':{lead:'익주 예측 (7일 전)'},
  'R-19':{lead:'재주문 리드타임 기준'},
  'R-25':{when:'24시간 경과 시 자동',lead:'24시간'},
  'R-31':{lead:'익월 (30일 주기)'},
};
function ruleMeta(r){return Object.assign({},RULE_META_BY_AGENT[r.agent]||{src:'—',when:'—',lead:'—'},RULE_META[r.id]||{});}

/* ===== 룰별 현재값 =====
   임계값만 적어 두면 "그래서 지금 어떤데?"에 답할 수 없다.
   측정 가능한 룰은 현재값과 임계값 대비 진행률을 함께 낸다.
   측정 대상이 아닌 룰은 억지로 값을 만들지 않고 비워 둔다. */
function ruleNow(id){
  try{
    const L=myLines(), w=DB.safety;
    const R=loadCalc(loadPlan,loadDays,loadBase);
    const grpMax=R.groups.length?R.groups.reduce((a,g)=>g.load>a.load?g:a,R.groups[0]):null;
    const grpMin=R.groups.length?R.groups.reduce((a,g)=>g.load<a.load?g:a,R.groups[0]):null;
    const gapMax=R.groups.length?Math.max(...R.groups.map(g=>Math.abs(g.gap))):0;
    const worst=[...L].sort((a,b)=>G.cleanScore(b)-G.cleanScore(a))[0];
    const zones=whZones();
    const zmax=zones.length?Math.max(...zones.map(z=>z.rate)):0;
    const achMin=L.length?Math.min(...L.map(l=>G.achieve(l))):100;
    const capMax=L.length?Math.max(...L.map(l=>G.load(l))):0;
    const K=(LIVE.today||LIVE_SEED).kpi||{}, pb=K.pbox||{};
    const ws=(pb.workers||[]).filter(x=>x.mh>0);
    const devMax=(pb.pltPerMH&&ws.length)?Math.round(Math.max(...ws.map(x=>(1-x.pltPerMH/pb.pltPerMH)*100))):null;
    const M={
      'R-01':grpMax&&{v:grpMax.load,th:100,u:'%',n:grpMax.grp+' 최대'},
      'R-02':grpMin&&{v:grpMin.load,th:70,u:'%',n:grpMin.grp+' 최소',inv:1,good:1},
      'R-03':{v:+gapMax.toFixed(1),th:0.4,u:'명',n:'그룹 간 최대 격차'},
      'R-06':{v:achMin,th:70,u:'%',n:'최저 라인 달성률',inv:1},
      'R-07':{v:capMax,th:100,u:'%',n:'최대 CAPA 부하'},
      'R-13':worst&&{v:G.cleanScore(worst),th:75,u:'점',n:worst.key+' 최우선'},
      'R-15':{v:zmax,th:100,u:'%',n:'최대 적치 구역'},
      'R-16':{v:zmax,th:90,u:'%',n:'최대 적치 구역'},
      'R-20':{v:w.wbgt,th:28,u:'℃',n:'현재 WBGT'},
      'R-21':{v:w.wbgt,th:31,u:'℃',n:'현재 WBGT'},
      'R-26':{v:+avgDefect(),th:1.5,u:'%',n:'평균 불량률'},
      'R-30':devMax!=null?{v:devMax,th:40,u:'%',n:'최대 생산성 편차'}:null,
    };
    const m=M[id]; if(!m)return null;
    /* inv: 값이 작을수록 위험한 룰(달성률·여유인력) */
    const pct=m.inv?Math.max(0,Math.min(150,Math.round(m.th/Math.max(m.v,0.01)*100)))
                   :Math.max(0,Math.min(150,Math.round(m.v/m.th*100)));
    const hit=m.inv?(m.v<m.th):(m.v>=m.th);
    return Object.assign({},m,{pct,state:hit?(m.good?'good':'hit'):pct>=85?(m.good?'ok':'near'):'ok'});
  }catch(e){return null;}
}
V.rulebook=()=>{
  const live=liveRuleIds();
  const agents=['전체',...Array.from(new Set(RULEBOOK.map(r=>r.agent)))];
  const chips=agents.map(a=>`<button class="btn ${a===ruleFilter?'p':''}" style="padding:6px 12px" onclick="ruleFilter='${a}';go('judge')">${a}</button>`).join(' ');
  const list=RULEBOOK.filter(r=>ruleFilter==='전체'||r.agent===ruleFilter);
  const IMPL_LB={plat:{t:'플랫폼 산출',c:'#0f2438',b:'#f7f8f8'},app:{t:'연동 앱 산출',c:'#1c5fa8',b:'#f7f8f8'},doc:{t:'정의만',c:'#8a7333',b:'#f7f8f8'}};
  const ST={hit:{t:'발동 중',c:'#E03426',b:'#f7f8f8'},near:{t:'임계 근접',c:'#B0620A',b:'#f7f8f8'},ok:{t:'여유',c:'#0f2438',b:'#f7f8f8'},good:{t:'해당 (여유 있음)',c:'#1c5fa8',b:'#f7f8f8'},none:{t:'—',c:'#8a97a8',b:'transparent'}};
  const gauge=n=>{
    if(!n)return `<div class="rgno">측정 대상 아님</div>`;
    const st=ST[n.state], w=Math.min(100,n.pct);
    return `<div class="rgwrap"><div class="rgtop"><b style="color:${st.c}">${n.v}${n.u}</b>
      <span>/ ${n.th}${n.u}</span><i style="background:${st.b};color:${st.c}">${st.t}</i></div>
      <div class="rgbar"><span style="width:${w}%;background:${st.c}"></span></div>
      <div class="rgsub">${escHtml(n.n)} · 임계 대비 ${n.pct}%</div></div>`;
  };
  /* 발동 표시는 측정값이 있으면 그것을 따르고(화면 안에서 한 목소리),
     측정 대상이 아닌 룰만 판단 로그(liveRuleIds)를 근거로 쓴다. */
  const rows=list.map(r=>{const m=ruleMeta(r), n=ruleNow(r.id), on=n?(n.state==='hit'):live.has(r.id);
    const il=(IMPL_LB[r.impl]||IMPL_LB.doc);
    return `<tr${on?' class="rlive"':''}>
    <td class="rid">${r.id}${on?'<span class="rdot">● 발동</span>':''}<span class="ragent">${escHtml(r.agent)}</span></td>
    <td><div class="rcond">${escHtml(r.cond)} <b>${escHtml(r.th)}</b></div>
        <div class="rjudge">→ ${escHtml(r.judge)}</div>
        <div class="ract">${escHtml(r.act)}</div></td>
    <td class="rgcell">${gauge(n)}</td>
    <td class="rmeta">
      <div><span>입력</span>${escHtml(m.src)}</div>
      <div><span>시점</span>${escHtml(m.when)}</div>
      <div><span>선행</span><b>${escHtml(m.lead)}</b></div>
      <div style="margin-top:5px"><i style="color:${il.c};background:${il.b}">${il.t}</i></div>
    </td></tr>`;}).join('');
  const nowAll=list.map(r=>ruleNow(r.id)).filter(Boolean);
  const nHit=nowAll.filter(n=>n.state==='hit').length, nNear=nowAll.filter(n=>n.state==='near').length;
  const nMeasured=nowAll.length;

  return `
  <div class="card" style="margin-bottom:14px;background:#fff;border:1px solid var(--line);color:var(--navy)">
    <div style="display:flex;align-items:center;gap:18px;flex-wrap:wrap">
      <div><div style="font-size:11px;letter-spacing:2.5px;color:var(--muted);font-weight:700">RULEBOOK · 기준의 코드화</div>
        <div style="font-size:21px;font-weight:700;margin-top:5px">관리자 경험 → 정량 판단 룰 ${RULEBOOK.length}개</div>
        <div style="font-size:12.5px;color:var(--muted);margin-top:5px">신규 관리자도 <b style="color:var(--navy)">동일 판단 재현</b> — 담당자 의존 구조 해소</div></div>
      <div style="margin-left:auto;display:flex;gap:30px">
        <div><div class="tnum" style="font-size:28px;font-weight:700">${RULEBOOK.length}</div><div style="font-size:11px;color:var(--muted)">코드화 룰</div></div>
        <div><div class="tnum" style="font-size:28px;font-weight:700">${RULEBOOK.filter(r=>r.impl==='plat').length}</div><div style="font-size:11px;color:var(--muted)">플랫폼 산출</div></div>
        <div><div class="tnum" style="font-size:28px;font-weight:700;color:var(--warn)">${nNear}</div><div style="font-size:11px;color:var(--muted)">임계 근접 (곧 발동)</div></div>
        <div><div class="tnum" style="font-size:28px;font-weight:700;color:var(--err)">${nHit}</div><div style="font-size:11px;color:var(--muted)">지금 발동 중</div></div>
      </div></div></div>
  <div class="card"><h3>판단 룰 카탈로그 <span class="hint">지금 값이 임계에 얼마나 가까운가 · 얼마나 미리 알려주는가</span><span style="margin-left:auto;display:flex;gap:6px;flex-wrap:wrap">${chips}</span></h3>
    <div style="overflow:auto"><table class="rbook"><tr><th>룰</th><th>조건 → 판단 → 조치</th><th>현재값 · 임계 대비</th><th>입력 · 시점 · 선행</th></tr>${rows}</table></div>
    <div class="mini" style="margin-top:10px"><b>산출 위치</b> — <span style="color:#0f2438;font-weight:700">플랫폼 산출 ${RULEBOOK.filter(r=>r.impl==='plat').length}</span>: 이 화면에서 직접 계산 · <span style="color:#1c5fa8;font-weight:700">연동 앱 산출 ${RULEBOOK.filter(r=>r.impl==='app').length}</span>: 현장 앱에서 판단, 플랫폼은 결과 수신 · <span style="color:#8a7333;font-weight:700">정의만 ${RULEBOOK.filter(r=>r.impl==='doc').length}</span>: 기준 확정, 로직 미구현<br>초록 행 = 현재 실측 데이터로 <b>발동 중인 룰</b> · 임계값은 운영 실측(오탐/미탐 이력)으로 주기 보정</div></div>`;
};
function escHtml(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
/* ── 조치 추적 (탐지 → 조치 → 결과) ── */
function actKey(x){return x.area+'|'+x.rule;}
function actGet(k){DB.actions=DB.actions||{};return DB.actions[k]||{st:'todo'};}
function actDueDefault(){const d=new Date();d.setHours(18,0,0,0);if(d.getTime()<Date.now())d.setDate(d.getDate()+1);return d.getTime();}
function actOwnerOf(area){return (area==='안전'||area==='세척')?'현장':(area==='생산'||area==='인력'||area==='품질')?'생산관리':'미지정';}
function actOverdue(a){return !!(a&&a.due&&a.st!=='done'&&Date.now()>a.due);}
/* ===== 조치 공유 (zen-actions Worker) =====
   조치는 지금까지 localStorage 에만 있었다. 담당자를 지정해도 그 사람 화면에는
   뜨지 않고, 다른 PC 에서 열면 보드가 비어 있었다.
   로컬 우선으로 둔 채 서버를 얹는다 — 주소가 없거나 서버가 끊겨도 조치는 그대로 된다. */
const ACT_SITE='AP 대전공장';
let ACT_API=''; try{ACT_API=localStorage.getItem('zen_act_api')||'';}catch(e){}
let ACTSYNC={st:'off',at:0,err:'',n:0};
function actWho(){try{return (role==='center'?'이민아':'홍길동')+' '+ROLES[role].name;}catch(e){return '';}}
function actSetApi(){const el=document.getElementById('actApi');ACT_API=(el&&el.value||'').trim();
  try{localStorage.setItem('zen_act_api',ACT_API);}catch(e){}
  if(ACT_API)actSync(false); else {ACTSYNC={st:'off',at:0,err:'',n:0};rerender();toast('조치 공유 해제 — 이 브라우저에만 저장됩니다');}}
let _actTimer=null,_actPend=false;
/* 조치를 건드릴 때마다 서버로 밀되, 연타는 한 번으로 묶는다 */
function actPush(){ if(!ACT_API)return; if(_actPend)return; _actPend=true;
  setTimeout(()=>{_actPend=false;actSync(true);},800); }
async function actSync(silent){
  if(!ACT_API){ACTSYNC.st='off';return false;}
  const base=ACT_API.replace(/\/+$/,'');
  const ac=('AbortController' in window)?new AbortController():null;
  const tm=ac?setTimeout(()=>ac.abort(),12000):null;
  try{
    const body={site:ACT_SITE,by:actWho(),actions:DB.actions||{},actlog:(DB.actlog||[]).slice(-100)};
    const r=await fetch(base+'/api/sync',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify(body),cache:'no-store',signal:ac?ac.signal:undefined});
    if(!r.ok)throw new Error('HTTP '+r.status);
    const j=await r.json();
    if(!j||!j.ok)throw new Error('응답 형식 오류');
    /* 서버가 병합 결과를 돌려준다 — 그대로 채택한다(우리 변경은 이미 반영됨) */
    const before=JSON.stringify(DB.actions||{})+'|'+((DB.actlog||[]).length), stBefore=ACTSYNC.st;
    if(j.actions)DB.actions=j.actions;
    if(Array.isArray(j.actlog))DB.actlog=j.actlog;
    ACTSYNC={st:'ok',at:Date.now(),err:'',n:Object.keys(j.actions||{}).length};
    saveDB();
    const after=JSON.stringify(DB.actions||{})+'|'+((DB.actlog||[]).length);
    if((before!==after||stBefore!=='ok')&&typeof cur!=='undefined'&&cur==='track')go('track'); else syncSrcTag();
    if(!silent)toast('조치 공유 연결 — 티켓 '+ACTSYNC.n+'건 · 이력 '+((DB.actlog||[]).length)+'건');
    return true;
  }catch(e){
    const _was=ACTSYNC.st;
    ACTSYNC={st:'err',at:ACTSYNC.at,err:liveErrText(e),n:ACTSYNC.n};
    if(!silent)toast('조치 공유 서버에 닿지 않습니다 — 이 브라우저에만 저장됩니다 ('+ACTSYNC.err+')');
    if(_was!=='err'&&typeof cur!=='undefined'&&cur==='track')go('track'); else syncSrcTag();
    return false;
  }finally{ if(tm)clearTimeout(tm); }
}
function actSyncLabel(){
  if(!ACT_API)return {t:'이 브라우저에만 저장',c:'#8a7333'};
  if(ACTSYNC.st==='ok'){const ago=Math.round((Date.now()-ACTSYNC.at)/1000);
    return {t:'공유 중 · '+(ago<60?ago+'초 전':Math.round(ago/60)+'분 전')+' 동기화',c:'#0f2438'};}
  if(ACTSYNC.st==='err')return {t:'서버 미연결 — 로컬 저장 중'+(ACTSYNC.err?' ('+ACTSYNC.err+')':''),c:'#b9922e'};
  return {t:'동기화 대기',c:'#8a7333'};
}
/* 조치 이력 — append-only. 티켓이 재발·효과없음으로 닫힐 때마다 스냅샷을 남긴다.
   기존 구조는 판단 키 하나에 레코드 하나여서, 재발하면 직전 조치 기록이 통째로 지워졌다. */
function actArchive(k,a,x,outcome){
  DB.actlog=DB.actlog||[];
  DB.actlog.push({k,area:(x&&x.area)||'',r:(x&&x.r)||'',rule:(x&&x.rule)||'',
    seq:a.seq||1,owner:a.owner||'',what:a.what||a.note||'',outcome,
    openedAt:a.openedAt||null,doneAt:a.doneAt||null,closedAt:Date.now(),
    overdue:!!(a.due&&(a.doneAt||Date.now())>a.due)});
  if(DB.actlog.length>500)DB.actlog=DB.actlog.slice(-500);
}
function actPatch(k,field,val){
  try{k=decodeURIComponent(k);}catch(e){}
  DB.actions=DB.actions||{};
  const a=Object.assign({},actGet(k),{ts:Date.now()});
  if(field==='due'){const p=String(val).split('-');a.due=(p.length===3)?new Date(+p[0],+p[1]-1,+p[2],18,0,0).getTime():a.due;}
  else a[field]=val;
  if(!a.openedAt)a.openedAt=Date.now();
  if(!a.seq)a.seq=1;
  if(field==='st'&&val==='done'){
    a.doneAt=Date.now();
    if(!a.what)a.what=(a.note||'').trim();
    /* 완료 시점에 조건이 아직 발동 중이면 효과 미확인 — 해소되면 sync 가 확인으로 바꾼다 */
    a.verify=a.cleared?'cleared':'pending';
    if(a.cleared)a.verifiedAt=Date.now();
  }
  if(field==='st'&&val!=='done'){a.verify=null;a.doneAt=null;}
  DB.actions[k]=a;
  actPush();
  if(field==='st')opsLog('조치 '+( {done:'완료',doing:'착수',todo:'미조치',hold:'보류'}[val]||val )+' 처리'
    +(val==='done'?(a.verify==='cleared'?' (효과 확인)':' (효과 미확인 — 조건 지속)'):'')
    +(a.what?' — '+a.what:''),'조치',val==='done'?'done':'info');
  saveDB();go(cur==='track'?'track':cur);
}
function actSet(k,st){actPatch(k,'st',st);}
/* 완료 — 조치 내용이 비어 있으면 AI 권고 조치를 기록해 이력이 비지 않게 한다 */
function actDone(k,i){
  let kk=k; try{kk=decodeURIComponent(k);}catch(e){}
  const J=collectJudgments(),x=J[i];
  DB.actions=DB.actions||{};
  const a=Object.assign({},actGet(kk));
  if(!a.what)a.what=((a.note||'').trim())||((x&&x.act)||'');
  DB.actions[kk]=a;
  actPatch(k,'st','done');
}
function syncActionsFromJudgments(){
  DB.actions=DB.actions||{}; DB.actlog=DB.actlog||[];
  const J=collectJudgments(); const DAY=86400000;
  let opened=0,changed=false;
  const fresh=(a,x,extra)=>Object.assign({st:'todo',openedAt:Date.now(),owner:a.owner||actOwnerOf(x.area),
    due:actDueDefault(),note:'',what:'',txt:'',cleared:false,verify:null,doneAt:null,seq:(a.seq||1)+1,
    area:x.area,title:x.r,rule:x.rule,ts:Date.now()},extra||{});
  J.forEach(x=>{
    const k=actKey(x),a=Object.assign({},actGet(k));
    if(x.lv==='ok'){                       /* 조건 정상 복귀 */
      if(a.openedAt&&!a.cleared){
        a.cleared=true;a.clearedAt=Date.now();a.ts=Date.now();
        if(a.st==='done'&&a.verify!=='cleared'){a.verify='cleared';a.verifiedAt=Date.now();
          opsLog('['+x.area+'] '+x.r+' — 조치 후 조건 해소, 효과 확인',x.area,'done');}
        DB.actions[k]=a;changed=true;
      }
      return;
    }
    if(a.st==='done'){
      if(a.cleared){                       /* 완료·해소 뒤 다시 발동 = 재발 */
        actArchive(k,a,x,'재발');
        DB.actions[k]=fresh(a,x,{reopened:true});
        opened++;changed=true;
        opsLog('['+x.area+'] '+x.r+' — 조건 재발, '+((a.seq||1)+1)+'회차 조치 오픈',x.area,'warn');
        return;
      }
      if(a.verify!=='pending'){a.verify='pending';a.ts=Date.now();DB.actions[k]=a;changed=true;}
      if(a.doneAt&&Date.now()-a.doneAt>DAY){ /* 완료했는데 하루 지나도 조건 지속 = 효과 없음 */
        actArchive(k,a,x,'효과 없음');
        DB.actions[k]=fresh(a,x,{noEffect:true});
        opened++;changed=true;
        opsLog('['+x.area+'] '+x.r+' — 완료 처리 후에도 조건 지속, 자동 재오픈',x.area,'warn');
      }
      return;
    }
    if(!a.openedAt){
      DB.actions[k]=Object.assign(a,{st:a.st&&a.st!=='todo'?a.st:'todo',openedAt:Date.now(),
        owner:a.owner||actOwnerOf(x.area),due:a.due||actDueDefault(),cleared:false,seq:a.seq||1,
        area:x.area,title:x.r,rule:x.rule,ts:Date.now()});
      opened++;changed=true;
    }
  });
  if(changed){saveDB();actPush();}
  return opened;
}
function actGen(i){
  const J=collectJudgments(),x=J[i];if(!x)return;const k=actKey(x);
  const curA=Object.assign({owner:actOwnerOf(x.area),due:actDueDefault(),openedAt:Date.now()},actGet(k));
  const dueStr=new Date(curA.due).toLocaleString('ko-KR',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'});
  const txt=`[조치 요청] ${x.area} — ${x.r}\n· 근거: ${x.s}\n· 적용 기준: ${x.rule}\n· 권장 조치: ${x.act}\n· 담당: ${curA.owner}\n· 기한: ${dueStr}\n(ZEN Manufacturing Platform 자동 생성 · ${new Date().toISOString().slice(0,10)})`;
  DB.actions=DB.actions||{};DB.actions[k]=Object.assign(curA,{st:'doing',txt,ts:Date.now()});saveDB();
  opsLog(`[${x.area}] ${x.r} — 조치 문안 생성·담당자 전달`,x.area,'info');
  actPush();copyText(txt,'조치 문안 생성 · 복사됨');go(cur==='track'?'track':cur);
}
let trackFilter='전체';
/* 조치 보드 컬럼 접기 — 헤더 클릭/Enter/Space로 토글. 재렌더에도 유지 */
let actFold={};
function toggleActCol(k,el){actFold[k]=!actFold[k];
  const col=el&&el.closest?el.closest('.actcol'):null;
  if(col)col.classList.toggle('fold',actFold[k]);
  if(el)el.setAttribute('aria-expanded',actFold[k]?'false':'true');}
V.track=()=>{
  const tabs=[{k:'now',label:'오늘 조치 보드'},{k:'log',label:'일자별 운영 기록'}];
  const t=vtabActive('track',tabs);
  return vtabsBar('track',tabs)+(t==='log'?opsLogView():V.trackNow());
};
V.trackNow=()=>{
  syncActionsFromJudgments();
  const J=collectJudgments();
  const actbl=J.map((x,i)=>({x,i,k:actKey(x),a:actGet(actKey(x))}));
  const need=actbl.filter(o=>o.x.lv!=='ok'||o.a.openedAt);
  const openNeed=need.filter(o=>o.x.lv!=='ok'&&o.a.st!=='done');
  const done=need.filter(o=>o.a.st==='done').length, doing=need.filter(o=>o.a.st==='doing').length;
  const verified=need.filter(o=>o.a.st==='done'&&o.a.verify==='cleared').length;
  const overdue=openNeed.filter(o=>actOverdue(o.a)).length;
  const rate=openNeed.length+done?Math.round(done/(openNeed.length+done)*100):100;
  /* 효과 확인율 — 완료 처리만으로는 오르지 않는다. 조건이 실제로 해소돼야 오른다. */
  const vrate=openNeed.length+done?Math.round(verified/(openNeed.length+done)*100):100;
  const repeat=need.filter(o=>(o.a.seq||1)>=3).length;
  const areas=['전체',...Array.from(new Set(J.map(x=>x.area)))];
  const cf=trackFilter;
  const pass=o=>{
    if(cf==='미조치')return o.a.st==='todo'||o.a.st==='hold';
    if(cf==='조치중')return o.a.st==='doing';
    if(cf==='완료')return o.a.st==='done';
    if(cf==='기한초과')return actOverdue(o.a);
    if(cf==='해소')return !!o.a.cleared&&o.a.st!=='done';
    if(areas.includes(cf)&&cf!=='전체')return o.x.area===cf;
    return true;
  };
  const shown=need.filter(pass);
  const ek=k=>encodeURIComponent(k);
  const owners=['미지정','현장','생산관리','안전'];
  const dueVal=a=>{const d=new Date(a.due||actDueDefault());return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');};
  const card=o=>{
    const ov=actOverdue(o.a), kk=ek(o.k);
    const ownSel=owners.map(n=>`<option ${o.a.owner===n?'selected':''}>${n}</option>`).join('');
    const st=o.a.st||'todo';
    const lvlab=o.x.lv==='crit'?'긴급':o.x.lv==='warn'?'경고':'정상';
    return `<div class="actcard ${o.x.lv}${ov?' overdue':''}${o.a.cleared&&st!=='done'?' cleared':''}">
      <div class="ahd">
        <span class="actlv ${o.x.lv}">${lvlab}</span>
        <span class="actarea">${escHtml(o.x.area)}</span>
        ${ov?'<span class="actdue">기한초과</span>':''}
        ${(o.a.seq||1)>1?`<span class="actseq" title="같은 조건이 반복 발동한 횟수">${o.a.seq}회차</span>`:''}
        ${o.a.noEffect?'<span class="actseq" style="background:#8a5cf6">직전 조치 효과 없음</span>':''}
      </div>
      ${(o.a.seq||1)>=3?`<div class="mini" style="margin-top:6px;color:#7c3aed;font-weight:700">${o.a.seq}회 반복 — 임시 조치로 해결되지 않습니다. 근본 원인 조치가 필요합니다.</div>`:''}
      <div class="pr">${escHtml(o.x.r)}</div>
      <div class="ps">${escHtml(o.x.s)}</div>
      <div class="actrule"><span class="l">적용 기준</span> ${escHtml(o.x.rule||'-')}</div>
      <div class="actreco"><div class="l">AI 권고 조치</div><div class="t">${escHtml(o.x.act)}</div></div>
      ${o.a.cleared&&st!=='done'?'<div class="mini" style="margin-top:8px;color:#4a8a60;font-weight:700">조건 해소됨 — 완료로 닫아 주세요</div>':''}
      ${st==='done'?`<div class="actverify ${o.a.verify==='cleared'?'ok':'pend'}">${o.a.verify==='cleared'
        ?'효과 확인 — 조치 후 조건이 해소됐습니다'
        :'효과 미확인 — 완료 처리했지만 조건이 아직 발동 중입니다. 하루 지나도 지속되면 자동 재오픈됩니다.'}</div>`:''}
      ${st==='done'&&o.a.what?`<div class="mini" style="margin-top:6px"><b>조치 내용</b> ${escHtml(o.a.what)}</div>`:''}
      ${o.x.lv!=='ok'||st!=='done'?`<div class="ameta">
        <select onchange="actPatch('${kk}','owner',this.value)" aria-label="담당">${ownSel}</select>
        <input type="date" value="${dueVal(o.a)}" onchange="actPatch('${kk}','due',this.value)" aria-label="기한">
        <input class="note" value="${escHtml(o.a.note||'')}" placeholder="조치 내용 (완료 시 이력에 기록)" onchange="actPatch('${kk}','note',this.value)">
      </div>
      <div class="actbtns">
        <button class="btn p" onclick="actGen(${o.i})"> 조치 생성</button>
        ${st!=='doing'?`<button class="btn" onclick="actSet('${kk}','doing')">착수</button>`:''}
        ${st!=='done'?`<button class="btn" onclick="actDone('${kk}',${o.i})">완료</button>`:''}
        ${st!=='hold'?`<button class="btn" onclick="actSet('${kk}','hold')">보류</button>`:''}
        ${st==='done'?`<button class="btn" onclick="actSet('${kk}','todo')">재오픈</button>`:''}
      </div>`:''}
      ${o.a.txt?`<details class="acttxt"><summary style="cursor:pointer;font-weight:700;color:#1c5fa8">생성된 조치 문안</summary><pre style="margin:8px 0 0;white-space:pre-wrap;font-family:inherit;font-size:12px;line-height:1.55">${escHtml(o.a.txt)}</pre></details>`:''}
    </div>`;
  };
  const col=(title,list,kind)=>{const f=!!actFold[kind];
    const body=list.length?list.map(card).join(''):'<div class="mini" style="padding:12px 14px">없음</div>';
    return `<div class="actcol ${kind}${f?' fold':''}">`
      +`<h4 role="button" tabindex="0" aria-expanded="${f?'false':'true'}" title="클릭하면 접기/펼치기"`
      +` onclick="toggleActCol('${kind}',this)"`
      +` onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();toggleActCol('${kind}',this)}">`
      +`<span class="fchev">▼</span>${title}<span class="n">${list.length}</span></h4>`
      +`<div class="actbody"><div class="actinner">${body}</div></div></div>`;};
  const cTodo=shown.filter(o=>o.a.st==='todo'||o.a.st==='hold');
  const cDo=shown.filter(o=>o.a.st==='doing');
  const cDone=shown.filter(o=>o.a.st==='done');
  const chips=['전체','미조치','조치중','완료','기한초과','해소',...areas.filter(a=>a!=='전체')].map(a=>`<button class="btn ${a===cf?'p':''}" style="padding:6px 12px" onclick="trackFilter='${a}';go('track')">${a}</button>`).join(' ');
  return `
  <div class="card" style="margin-bottom:14px;background:#fff;border:1px solid var(--line);color:var(--navy)">
    <div style="display:flex;align-items:center;gap:18px;flex-wrap:wrap">
      <div><div style="font-size:11px;letter-spacing:2.5px;color:var(--muted);font-weight:700">AI DECISION → ACTION</div>
        <div style="font-size:21px;font-weight:700;margin-top:5px">실측 → 기준 대조 → 판단 → 조치 → 결과</div>
        <div style="font-size:12.5px;color:var(--muted);margin-top:5px">8개 Agent의 판단이 <b style="color:var(--navy)">담당·기한이 붙은 티켓</b>으로 — 기한 지나면 <b style="color:var(--warn)">기한초과</b>, 조건이 정상 복귀하면 해소 표시</div></div>
      <div style="margin-left:auto;display:flex;gap:20px;flex-wrap:wrap">
        <div><div class="tnum" style="font-size:26px;font-weight:700">${J.length}</div><div style="font-size:11px;color:var(--muted)">오늘 자동 판단</div></div>
        <div><div class="tnum" style="font-size:26px;font-weight:700;color:var(--err)">${J.filter(x=>x.lv==='crit').length}</div><div style="font-size:11px;color:var(--muted)">긴급</div></div>
        <div><div class="tnum" style="font-size:26px;font-weight:700">${openNeed.length}</div><div style="font-size:11px;color:var(--muted)">열린 조치</div></div>
        <div><div class="tnum" style="font-size:26px;font-weight:700;color:var(--warn)">${doing}</div><div style="font-size:11px;color:var(--muted)">조치중</div></div>
        <div><div class="tnum" style="font-size:26px;font-weight:700;color:var(--err)">${overdue}</div><div style="font-size:11px;color:var(--muted)">기한초과</div></div>
        <div><div class="tnum" style="font-size:26px;font-weight:700;color:var(--muted)">${rate}%</div><div style="font-size:11px;color:var(--muted)">조치율 (목표 90%)</div></div>
        <div><div class="tnum" style="font-size:26px;font-weight:700;color:${vrate>=rate?'#5f6d77':'#cb9447'}">${vrate}%</div><div style="font-size:11px;color:var(--muted)">효과 확인율</div></div>
      </div></div></div>
  ${repeat?`<div class="card" style="margin-bottom:12px;border-left:4px solid #7c3aed"><h3 style="border:none;padding:0;margin:0;font-size:14px">반복 발동 ${repeat}건 <span class="hint">3회 이상 — 임시 조치로 해결되지 않는 항목</span></h3><p class="mini" style="margin-top:6px">같은 조건이 세 번 넘게 다시 열렸습니다. 조치가 증상만 눌렀을 가능성이 큽니다. 근본 원인 조치로 올리세요.</p></div>`:''}
  ${(()=>{const L=actSyncLabel();return `<div class="card" style="margin-bottom:12px;padding:11px 14px;display:flex;gap:9px;align-items:center;flex-wrap:wrap">
    <span class="dot" style="background:${L.c};width:8px;height:8px;border-radius:50%;display:inline-block"></span>
    <b style="font-size:12.5px;color:${L.c}">조치 공유 — ${escHtml(L.t)}</b>
    <span class="mini" style="margin-left:auto">${ACT_API?'같은 사업장의 담당자가 같은 보드를 봅니다':'주소를 등록하면 담당자와 보드를 공유합니다'}
      <a onclick="go('data')" style="color:#3f74b5;cursor:pointer;font-weight:700">기준 · 연동에서 설정</a></span></div>`;})()}
  <div class="card" style="margin-bottom:12px"><h3>필터 <span class="hint">영역 · 상태</span><span style="margin-left:auto;display:flex;gap:6px;flex-wrap:wrap">${chips}</span></h3></div>
  <div class="actboard">${col('미조치 · 보류',cTodo,'todo')}${col('조치중',cDo,'doing')}${col('완료',cDone,'done')}</div>
  ${actLogView()}`;
};
/* 조치 이력 — 닫힌 회차의 축적 기록. 상태 플래그가 아니라 '무엇을 했고 효과가 있었나'가 남는다. */
function actLogView(){
  const L=(DB.actlog||[]).slice().reverse();
  if(!L.length)return `<div class="card" style="margin-top:14px"><h3>조치 이력 <span class="hint">닫힌 회차 누적</span></h3>
    <p class="mini">아직 닫힌 회차가 없습니다. 조치가 재발하거나 효과 없음으로 자동 재오픈되면, 그 전 회차가 여기에 <b>조치 내용·소요시간·결과</b>와 함께 남습니다.</p></div>`;
  const fmt=t=>t?new Date(t).toLocaleString('ko-KR',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'}):'-';
  const hrs=(a,b)=>(a&&b)?Math.max(0,Math.round((b-a)/3600000*10)/10)+'h':'-';
  const rows=L.slice(0,60).map(e=>`<tr>
    <td>${fmt(e.closedAt)}</td><td>${escHtml(e.area)}</td>
    <td style="text-align:left">${escHtml(e.r)}</td>
    <td>${e.seq}회차</td><td>${escHtml(e.owner||'-')}</td>
    <td style="text-align:left">${escHtml(e.what||'(기록 없음)')}</td>
    <td>${hrs(e.openedAt,e.doneAt||e.closedAt)}</td>
    <td><span class="tag ${e.outcome==='효과 없음'?'t-red':'t-amber'}">${escHtml(e.outcome)}</span></td>
    <td>${e.overdue?'<span style="color:#dc4b4b;font-weight:700">지연</span>':'-'}</td></tr>`).join('');
  const noEff=L.filter(e=>e.outcome==='효과 없음').length;
  return ledger('조치 이력 ('+L.length+'건 누적)',
    (noEff?'효과 없음 '+noEff+'건 · ':'')+'닫힌 회차의 조치 내용·소요시간·결과 — 클릭하여 펼침',
    '<div class="tblscroll"><table class="tb tbsticky"><thead><tr><th>닫힌 시각</th><th>영역</th><th style="text-align:left">판단</th><th>회차</th><th>담당</th><th style="text-align:left">조치 내용</th><th>소요</th><th>결과</th><th>기한</th></tr></thead><tbody>'+rows+'</tbody></table></div>'
    +'<div class="mini" style="margin-top:8px">회차가 닫힐 때(재발·효과 없음) 스냅샷으로 남습니다. 같은 판단이라도 회차별로 따로 축적되어 덮어써지지 않습니다.</div>');
}
/* ── ZAIC 성과지표 (계획서 6대 KPI) ── */
