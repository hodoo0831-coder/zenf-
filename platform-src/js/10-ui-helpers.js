/* ===== 통합 라이브(P-BOX·오리콘) — 프로덕션 D1(work_records) 연동 ===== */
const LIVE_SEED={ // 프로덕션 D1(data.work_records) 실측 — 2026-08-07 ~ 08-14 · 14건
  asOf:'2026-08-14T18:50:00',
  kpi:{
    pbox:{records:12,totalPLT:59,totalEA:5310,totalMH:180.9,days:6,pltPerMH:0.33,eaPerMH:29.4,dailyAvgPLT:9.8,
      byPart:{'박스':58,'커버':1}, byType:{'세척':59},
      workers:[{name:'홍길동',mh:45,plt:13,ea:1170,pltPerMH:0.29},{name:'정철훈',mh:42.8,plt:18,ea:1620,pltPerMH:0.42},{name:'박지연',mh:30.8,plt:14.5,ea:1305,pltPerMH:0.47},{name:'김철수',mh:27,plt:5,ea:450,pltPerMH:0.19},{name:'이동동',mh:18,plt:2,ea:180,pltPerMH:0.11}]},
    orikon:{records:2,totalPLT:6,totalEA:720,totalMH:27,days:2,pltPerMH:0.22,eaPerMH:26.7,dailyAvgPLT:3,
      byPart:{}, byType:{'세척':6},
      workers:[{name:'김철수',mh:9,plt:3,ea:360,pltPerMH:0.33},{name:'이동동',mh:9,plt:1.5,ea:180,pltPerMH:0.17},{name:'홍길동',mh:9,plt:1.5,ea:180,pltPerMH:0.17}]},
  },
  alerts:[{level:'warn',title:'P-BOX 생산성 편차',detail:'이동동 0.11 PLT/MH (평균 0.33 대비 ▼66%)'}],
};
let LIVE={apiBase:'',today:LIVE_SEED,brief:null,status:'demo',sys:'pbox',_tried:false};
try{LIVE.apiBase=localStorage.getItem('zen_live_api')||'';}catch(e){}
/* ===== 모듈 내부 탭 ===== */
let vtab={labor:'status',safe:'status',report:'doc',planhub:'today',insight:'kpi'};
function setVtab(v,t){vtab[v]=t;go(v);window.scrollTo({top:0});}
function vtabsBar(view,tabs,cls){const list=tabs.filter(t=>t.show!==false);const cur=list.some(t=>t.k===vtab[view])?vtab[view]:list[0].k;return `<div class="vtabs${cls?' '+cls:''}">${list.map(t=>`<button class="${cur===t.k?'on':''}" onclick="setVtab('${view}','${t.k}')">${t.ic?`<span class="opi">${t.ic}</span>`:''}${t.label}</button>`).join('')}</div>`;}
function vtabActive(view,tabs){const list=tabs.filter(t=>t.show!==false);return list.some(t=>t.k===vtab[view])?vtab[view]:list[0].k;}
function fmtN(n){return (Math.round((+n||0)*10)/10).toLocaleString();}
/* ===== 단색 라인 아이콘 (SVG) ===== */
const ICON={
  activity:'<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
  users:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  droplet:'<path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5S12.5 4.5 12 2c-.5 2.5-2 4.4-4 6.5S5 13 5 15a7 7 0 0 0 7 7z"/>',
  package:'<path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>',
  shield:'<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
  flask:'<path d="M9 3h6"/><path d="M10 3v6l-4.5 8A2 2 0 0 0 7.3 20h9.4a2 2 0 0 0 1.8-3L14 9V3"/><path d="M8 15h8"/>',
  gauge:'<path d="M12 14 16 10"/><path d="M3.34 19a10 10 0 1 1 17.32 0"/>',
  report:'<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z"/><path d="M14 2v5h5"/><path d="M9 13h6"/><path d="M9 17h5"/>',
  bell:'<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
  thermometer:'<path d="M14 4v10.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0z"/>',
  zap:'<path d="M13 2 3 14h7l-1 8 10-12h-7z"/>',
  truck:'<path d="M14 18V6a1 1 0 0 0-1-1H2v13"/><path d="M14 9h4l3 3v6h-7"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/>',
  factory:'<path d="M2 20h20"/><path d="M4 20V9l6 4V9l6 4V5h4v15"/><path d="M9 20v-4h2v4"/>',
  spark:'<path d="M12 3l1.6 4.6L18 9l-4.4 1.4L12 15l-1.6-4.6L6 9l4.4-1.4z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  arrow:'<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
  db:'<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5"/><path d="M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/>',
  alert:'<path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  check:'<path d="M20 6 9 17l-5-5"/>',
  target:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  wrench:'<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2 2-2.6-.6-.6-2.6z"/>',
};
const NAV_ICON={forecast:'clock',reports:'report',home:'factory',judge:'spark',track:'check',ops:'activity',planhub:'clock',prod:'activity',labor:'users',clean:'droplet',stock:'package',orikonwash:'droplet',safe:'shield',qual:'flask',insight:'gauge',kpi:'gauge',report:'report',opl:'report',data:'db'};
function svic(n,s){s=s||18;return '<svg class="sv" width="'+s+'" height="'+s+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">'+(ICON[n]||'')+'</svg>';}
function tintOf(c){return c==='#4a8a60'?'g':c==='#cb9447'?'a':c==='#c25a52'?'r':'n';}
function hydrateIcons(root){(root||document).querySelectorAll('[data-ic]').forEach(function(e){if(e.getAttribute('data-done'))return;e.innerHTML=svic(e.getAttribute('data-ic'),16);e.setAttribute('data-done','1');});}
function localBrief(d){const k=(d&&d.kpi)||{},bits=[];
  if(k.pbox)bits.push(`P-BOX ${fmtN(k.pbox.totalPLT)} PLT(${(k.pbox.totalEA||0).toLocaleString()} EA)·${fmtN(k.pbox.totalMH)} MH·생산성 ${k.pbox.pltPerMH} PLT/MH`);
  if(k.orikon)bits.push(`오리콘 ${fmtN(k.orikon.totalPLT)} PLT(${(k.orikon.totalEA||0).toLocaleString()} EA)·${fmtN(k.orikon.totalMH)} MH`);
  const top=(d&&d.alerts&&d.alerts[0])?d.alerts[0].title+' — '+d.alerts[0].detail:'특이사항 없음';
  return {oneLine:`[통합현황] ${bits.slice(0,2).join(' / ')||'정상 가동'} · 우선 ${top}`,
    kakao:` AP 헤어앤뷰티 사업장 통합 브리핑 (${((d&&d.asOf)||'').slice(0,16).replace('T',' ')})\n`+bits.map(b=>'• '+b).join('\n')+`\n\n 우선조치: ${top}`};
}
/* ===== 일일 운영 보고문 자동생성 — 8개 Agent 실데이터 종합 ===== */
function buildDailyBrief(){
  const L=myLines(),tp=totProd(),df=avgDefect(),oee=avgOEE(),w=DB.safety;
  const behind=L.filter(l=>G.achieve(l)<70).map(l=>l.key);
  const gap=headNeed()-headCur();
  const clean=[...L].sort((a,b)=>G.cleanScore(b)-G.cleanScore(a))[0], cleanN=L.filter(l=>G.cleanScore(l)>=75).length;
  const undone=L.filter(l=>!w.tbmDone.includes(l.key)).map(l=>l.key);
  const orders=DB.stock.filter(s=>G.stock(s).need);
  const overZones=whZones().filter(z=>z.rate>=100).length;
  const worstDef=[...L].sort((a,b)=>b.defect-a.defect)[0];
  const dt=todayKR(), bar='━━━━━━━━━━━━━';
  const oneLine=`[AP헤어앤뷰티 ${dt}] 달성 ${tp.ach}% · 인력 ${gap>0?'−'+gap+'명':'충족'} · 폭염 ${w.wbgt>=28?w.wbgt+'℃ 경고':'주의'} · 불량 ${df}% · 발주 ${orders.length}건${behind.length?' — 지연 '+behind.join('·'):''}`;
  const msg=[
    ` AP 헤어앤뷰티 사업장 일일 운영보고 (${dt})`, bar,
    ` 생산  달성 ${tp.ach}% (목표 ${(tp.t/1000).toFixed(0)}천→실적 ${(tp.a/1000).toFixed(0)}천개)`+(behind.length?`\n     지연 ${behind.join('·')} (달성 70%↓)`:''),
    ` 인력  투입 ${headCur()}/${headNeed()}명`+(gap>0?` · ${gap}명 부족\n    → 여유라인 재배치 + 잔업 대응`:' · 충족'),
    ` 세척  최우선 ${clean.key}(${G.cleanScore(clean)}점)`+(cleanN?` · 필요 ${cleanN}라인 · CIP 2기 병렬`:' · 여유'),
    ` 안전  WBGT ${w.wbgt}℃ ${w.wbgt>=28?'경고':'주의'} · 무재해 ${w.noAccident}일`+(undone.length?`\n     TBM 미실시 ${undone.join('·')}`:' · TBM 100%'),
    ` 품질  불량 ${df}% (목표 1.5%) · 최다유형 ${DB.paretoNames[0]} · 최다라인 ${worstDef.key}`,
    ` 창고  발주 ${orders.length}건`+(orders.length?`(${orders.map(s=>s.name).join('·')})`:'')+(overZones?` · 적치초과 ${overZones}구역`:''),
    bar,
    ` 금일조치: 인력 재배치 · 발주 ${orders.length}건 · 세척 ${cleanN}라인`,
    ` 익일리스크: ${orders.length?'자재 미입고 시 라인중단 · ':''}${w.wbgt>=28?'폭염 지속':'특이 리스크 낮음'}`,
  ].join('\n');
  return {oneLine,msg};
}
/* 클립보드 복사 — file://·비보안 컨텍스트·비포커스에서도 동작하는 폴백 포함.
   실패 시 '복사됨' 거짓 안내 대신 실제 결과를 알린다. */
function copyText(t,okMsg){
  const fallback=()=>{try{const ta=document.createElement('textarea');ta.value=t;
    ta.setAttribute('readonly','');ta.style.cssText='position:fixed;top:0;left:-9999px;opacity:0';
    document.body.appendChild(ta);ta.select();ta.setSelectionRange(0,t.length);
    const ok=document.execCommand('copy');document.body.removeChild(ta);return ok;}catch(e){return false;}};
  const done=ok=>toast(ok?(okMsg||'복사됨'):'복사가 차단되었습니다 — 아래 내용을 직접 선택해 복사하세요');
  if(navigator.clipboard&&window.isSecureContext){
    navigator.clipboard.writeText(t).then(()=>done(true)).catch(()=>done(fallback()));
  }else{done(fallback());}
}
function copyDailyBrief(kind){const b=buildDailyBrief(),t=kind==='one'?b.oneLine:b.msg;copyText(t,kind==='one'?'관리자 한 줄 복사됨':'메신저 보고문 복사됨');}
function dlDailyBrief(){const b=buildDailyBrief();dl('ZEN_일일운영보고_'+new Date().toISOString().slice(0,10).replace(/-/g,'')+'.txt',b.oneLine+'\n\n'+b.msg,'text/plain');toast('보고문을 저장했습니다');}
