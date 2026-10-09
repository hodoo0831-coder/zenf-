/**
 * 월 마감 자동 분석 구간 — 정산 엑셀 업로드 → 월·양식·라인·브랜드 자동 인식 → 지표·증감·이상치
 *                         → 경영 요약·보고서 자동 생성 → 히트맵·워터폴 드릴다운
 *
 *   node video/scenes/monthly.mjs <출력폴더>        → <출력폴더>/seg_monthly.webm + seg_monthly.json
 *   SHOTS=<폴더> …                                  장면별 스크린샷 저장
 *
 * 데이터 원칙
 *  - 앱(ZEN_Monthly_Report.html)이 실제로 받는 정산 엑셀 양식(시트: 마감액 · 생산도급 · 업무도급)을
 *    앱의 파서 코드에 맞춰 이 스크립트가 만든다(가상 수치). 파일은 앱에 내장된 XLSX 로 직접 쓴다.
 *  - 지난 달(2026-03~08)은 녹화 전에 별도 브라우저에서 같은 xlsx 를 앱의 실제 파서로 올려 누적 저장소
 *    (localStorage)에 쌓아 둔 상태로 시작하고, 녹화 화면에서는 9월 마감 xlsx 를 파일 선택창으로 직접 올린다.
 *  - 모든 수치(KPI·증감·이상치·요약·히트맵·워터폴)는 앱이 계산한 것이며, 자막·토스트의 숫자는 화면(DOM)에서 읽는다.
 *  - 앱에 내장된 실데이터 성격의 샘플(closingArchive 18건)과 노란 샘플 배너는 녹화에서 쓰지 않는다
 *    (앱 소스는 건드리지 않고, 브라우저 저장소 쓰기만 가로채 대체).
 */
import {launch,session,ROOT} from '../lib.mjs';
import fs from 'fs';
import os from 'os';
import path from 'path';

const OUT=path.resolve(process.argv[2]||path.join(ROOT,'video','out'));
const APP='file://'+path.join(ROOT,'ZEN_Monthly_Report.html');
const TAG='SYSTEM · 월 마감';
const pad=(n)=>n<10?'0'+n:''+n;

/* ═════════ 시연용 가상 정산 데이터 (결정적 — 실행할 때마다 같은 값) ═════════ */
const MONTHS=['2026-03','2026-04','2026-05','2026-06','2026-07','2026-08','2026-09'];
const MMULT=[0.93,0.97,1.01,0.98,1.03,1.00,1.00];                 // 월별 물량 흐름(가상)
const hash=(s)=>{let h=2166136261;for(const c of s){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return((h>>>0)%100000)/100000;};
const noise=(k,amp)=>(hash(k)-0.5)*2*amp;
const BRANDS={라네즈:'11198',설화수:'11124',헤라:'12002',미쟝센:'11131',려:'11141',마몽드:'11065',라보에이치:'11003',해피바스:'11129',아이오페:'11113',에스트라:'15010'};
/* [라인명(앱이 쓰는 이름), 월 기준액(원), 단가(원/개), 기존단가 대비 인상률, 브랜드 구성] */
const LINES=[
  ['튜브5호',      54e6,19.4,0.03,{라네즈:.40,미쟝센:.34,설화수:.26}],
  ['튜브2호',      46e6,19.1,0.02,{에스트라:.42,라네즈:.28,미쟝센:.18,아이오페:.12}],
  ['직선4호',      41e6,51.2,0.00,{라보에이치:.55,미쟝센:.45}],
  ['멀티셀8호',    38e6,33.6,0.04,{해피바스:.38,려:.34,마몽드:.28}],
  ['세정초격차 1호',36e6,28.3,0.02,{해피바스:.50,라보에이치:.50}],
  ['치약충전2호',  33e6,12.8,0.00,{설화수:.46,헤라:.30,아이오페:.24}],
  ['멀티셀3호',    31e6,34.0,0.03,{려:.52,마몽드:.48}],
  ['직선13호',     29e6,49.7,0.00,{미쟝센:.60,라보에이치:.40}],
  ['염모제 직구성3호',27e6,67.5,0.05,{미쟝센:.70,려:.30}],
  ['튜브8호',      26e6,21.6,0.02,{라네즈:.44,설화수:.30,헤라:.26}],
  ['세정초격차 2호',23e6,27.9,0.02,{해피바스:.64,에스트라:.36}],
  ['팜플1호',      21e6,15.2,0.00,{마몽드:.50,아이오페:.50}],
  ['턴테이블1호',  18e6,41.0,0.03,{려:.62,헤라:.38}],
  ['크림2호',      16e6,58.4,0.00,{라네즈:.55,설화수:.45}],
];
/* 9월(마지막 달)에만 전월 대비 크게 움직이는 라인 — 이상치 탐지가 잡아낼 값 */
const NOV={'튜브5호':1.28,'멀티셀8호':0.83,'염모제 직구성3호':1.11,'치약충전2호':0.91};
/* 9월에 튜브5호가 늘어난 이유 = 라네즈 물량(워터폴 드릴다운에서 브랜드별로 보인다) */
const BRAND_SHIFT_09={'튜브5호':{라네즈:.56,미쟝센:.26,설화수:.18},'멀티셀8호':{해피바스:.30,려:.35,마몽드:.35}};
const BUS=[ // [항목, 단가, 건수(월별 배수), 9월 단가 배수, 9월 건수 배수]
  ['공작/미화',   14.0e6,1,1,1],['설비 세척',182000,190,1.046,1.02],['제품 출하',6800,8400,1,1.09],
  ['포장재 입고', 19500,2900,1,1.05],['원료 관리',38000,690,1,1.01],['내용물 관리',10200,1650,1,1.02]];
const PE=[4.1e6,3.6e6,5.2e6,4.4e6,3.8e6,3.5e6,5.1e6], PI=[0,0,2.0e6,0,0,0,0], BE=[1.3e6,1.1e6,1.6e6,1.2e6,1.4e6,1.2e6,1.2e6], BI=[0,0,0,0,0,0,0];

function lineAmounts(){                                               // 월별·라인별 정산금액(원)
  const amt={};
  for(const [name,base] of LINES){amt[name]=[];
    for(let m=0;m<MONTHS.length;m++){
      if(m<6)amt[name].push(base*MMULT[m]*(1+noise(name+m,0.02)));
      else amt[name].push(amt[name][5]*(NOV[name]??(1.018+noise(name+'09',0.011))));
    }}
  return amt;
}
const AMT=lineAmounts();
/** m번째 달 xlsx 의 시트별 행렬(앱 파서가 읽는 위치) */
function sheetsFor(m){
  const prodRows=[['생산도급 정산 내역 — 시연용 가상 데이터'],
    [null,null,null,null,null,'자재코드','자재내역','확정수량',null,'라인명',null,'가격','정산금액','기존단가']];
  let prodSum=0,idx=0;
  for(const [li,[name,,price,rise,shares0]] of LINES.entries()){
    const shares=(m===6&&BRAND_SHIFT_09[name])||shares0;
    const A=AMT[name][m];
    for(const [b,sh] of Object.entries(shares)){
      const qty=Math.round(A*sh/price);const amount=Math.round(qty*price);prodSum+=amount;
      prodRows.push([null,null,null,null,null,BRANDS[b]+String(10000+li*9+(idx++%9)),b+' '+(li%2?'충전물':'크림')+' '+(10+li)+'ml',qty,null,name,null,price,amount,+(price/(1+rise)).toFixed(2)]);
    }}
  const busRows=[['업무도급 정산 내역 — 시연용 가상 데이터'],[],[null,null,'항목','단가','건수','비용']];
  let busSum=0;
  for(const [item,unit0,qty0,unitMul,qtyMul] of BUS){
    const mm=MMULT[m]===1?1:MMULT[m];
    const unit=m===6?unit0*unitMul:unit0;
    const qty=item==='공작/미화'?1:Math.round(qty0*(m===6?mm*qtyMul:mm*(1+noise(item+m,0.02))));
    const cost=Math.round(unit*qty);busSum+=cost;busRows.push([null,null,item,unit,qty,cost]);
  }
  busRows.push([null,null,'총계',null,null,busSum]);
  const close=[['월 마감액 — 시연용 가상 데이터'],
    [null,'생산도급','노무비(용역비)',prodSum],[null,null,'추가비',PE[m]],[null,null,'인센티브',PI[m]],
    [null,'업무도급','노무비(용역비)',busSum],[null,null,'추가비',BE[m]],[null,null,'인센티브',BI[m]]];
  return {'마감액':close,'생산도급':prodRows,'업무도급':busRows};
}
const fileNameFor=(ym)=>`${ym.slice(2,4)}년_${ym.slice(5)}월_AP_마감_시연용샘플.xlsx`;

/* ═════════ 시작 — 샘플 xlsx 만들기 + 누적 저장소 준비(녹화 전, 별도 브라우저) ═════════ */
fs.mkdirSync(OUT,{recursive:true});
const TMP=fs.mkdtempSync(path.join(process.env.MON_TMP||os.tmpdir(),'zen_monthly_'));
const XDIR=path.join(TMP,'xlsx');fs.mkdirSync(XDIR);
if(!process.env.MON_NOWAIT){const w0=Date.now();while(os.loadavg()[0]>3.5&&Date.now()-w0<60000)await new Promise(r=>setTimeout(r,2000));
  if(Date.now()-w0>2500)console.log('  (부하 대기 '+Math.round((Date.now()-w0)/1000)+'초, load '+os.loadavg()[0].toFixed(1)+')');}
const {browser,be}=await launch();

/* 앱 로드 시 스스로 박아 넣는 내장 샘플(closingArchive)·샘플 배너 대신, 우리가 준비한 누적 데이터를 쓰게 한다 */
const initFor=(seed)=>`(()=>{
  const set=Storage.prototype.setItem;window.__zblock=true;window.__zseed=${JSON.stringify(seed)};
  Storage.prototype.setItem=function(k,v){if(k==='closingArchive'&&window.__zblock)v=window.__zseed;return set.call(this,k,v);};
  document.addEventListener('DOMContentLoaded',()=>{window.__zblock=false;});
  const st=document.createElement('style');st.textContent='#sampleBanner{display:none!important}.backup-toast{bottom:64px!important}';
  document.addEventListener('DOMContentLoaded',()=>document.head.appendChild(st));
})();`;

/* 한글 파일명은 경로로 넘기면 이 환경(로케일)에서 깨지므로 이름·내용을 직접 넘긴다 */
const payload=(ym)=>({name:fileNameFor(ym),mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:fs.readFileSync(path.join(XDIR,fileNameFor(ym)))});
let seed='[]';
{
  const ctx=await browser.newContext({viewport:{width:1440,height:900}});
  const pg=await ctx.newPage();
  if(process.env.MON_DEBUG){pg.on('console',m=>console.log('  [page]',m.text()));pg.on('pageerror',e=>console.log('  [pageerror]',e.message));}
  await pg.addInitScript(initFor('[]'));
  await pg.goto(APP);await pg.waitForTimeout(400);
  for(let m=0;m<MONTHS.length;m++){                                           // 앱에 내장된 XLSX 로 xlsx 파일을 쓴다
    const b64=await pg.evaluate((sheets)=>{const wb=XLSX.utils.book_new();
      for(const [n,rows] of Object.entries(sheets))XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(rows),n);
      return XLSX.write(wb,{type:'base64',bookType:'xlsx'});},sheetsFor(m));
    fs.writeFileSync(path.join(XDIR,fileNameFor(MONTHS[m])),Buffer.from(b64,'base64'));
  }
  if(process.env.KEEP_XLSX)fs.cpSync(XDIR,process.env.KEEP_XLSX,{recursive:true});
  for(let m=0;m<MONTHS.length-1;m++){                                          // 3~8월: 앱 파서로 실제 업로드 → 누적 저장
    await pg.setInputFiles('#fileInput',payload(MONTHS[m]));
    if(process.env.MON_DEBUG){await pg.waitForTimeout(1500);console.log('  [dbg]',await pg.evaluate(()=>JSON.stringify({res:document.getElementById('fileResult').innerHTML.slice(0,200),h:typeof handleFile,files:document.getElementById('fileInput').files.length,ls:(localStorage.getItem('closingArchive')||'').length})));}
    await pg.waitForFunction(ym=>document.getElementById('fileResult').innerText.includes(ym),MONTHS[m],{timeout:15000}).catch(async e=>{throw new Error('업로드 인식 실패: '+await pg.locator('#fileResult').innerText());});
  }
  seed=await pg.evaluate(()=>localStorage.getItem('closingArchive'));
  const n=JSON.parse(seed).length;console.log('  누적 준비:',n,'개월 (앱 파서로 업로드)');
  if(n!==MONTHS.length-1)throw new Error('누적 준비 실패');
  await ctx.close();
}

/* ═════════ 녹화 세션 ═════════ */
const s=await session(browser,be,'monthly',TMP,{initScript:initFor(seed)});
const {p,sleep}=s;
/* 한 가지 우회: 기본 자막은 740px 폭이라 표 위를 가리므로, 자막 폭·글자 크기를 장면마다 줄인다 */
await p.addInitScript(()=>{const add=()=>{const st=document.createElement('style');st.textContent='#zcap2.nr{max-width:322px!important}#zcap2.top{top:46px!important;bottom:auto!important}#zcap2.nr .h{font-size:22px!important}#zcap2.nr .s{font-size:14px!important}#zcap2.md{max-width:560px!important}#zcur{transition:left .42s cubic-bezier(.4,0,.2,1),top .42s cubic-bezier(.4,0,.2,1),transform .1s!important}';document.head.appendChild(st);};
  if(document.head)add();else document.addEventListener('DOMContentLoaded',add);});
const show=async(title,sub,mode='')=>{await s.cap(TAG,title,sub);await p.evaluate(m=>{const e=document.getElementById('zcap2');if(e){e.className=m;e.style.maxWidth='';}},mode);await s.sample(true);};
const SCR='document.scrollingElement';
/* 쉬운 가속·감속으로 스크롤(순간이동 방지) */
const scrollTo=(y,ms=1000)=>p.evaluate(([y,ms])=>new Promise(res=>{const e=document.scrollingElement;const y0=e.scrollTop,t0=performance.now();
  const ease=t=>t<.5?2*t*t:1-Math.pow(-2*t+2,2)/2;
  const step=now=>{const t=Math.min(1,(now-t0)/ms);e.scrollTo({top:y0+(y-y0)*ease(t),behavior:'instant'});t<1?requestAnimationFrame(step):res();};requestAnimationFrame(step);}),[y,ms]);
const topOf=(sel,off=24)=>p.evaluate(([sel,off])=>document.querySelector(sel).getBoundingClientRect().top+document.scrollingElement.scrollTop-off,[sel,off]);
const txt=(sel)=>p.locator(sel).first().innerText().then(t=>t.replace(/\s+/g,' ').trim());
/* 커서: 실제 마우스는 2스텝으로 보내고, 화면의 커서(#zcur)는 CSS 전환으로 0.42초 동안 미끄러지게 한다
   (Playwright 의 steps 는 한 스텝마다 왕복이 들어 느리다 — 클릭은 커서가 도착한 뒤에 눌린다) */
const GL=470;
const center=async(loc)=>{const l=typeof loc==='string'?p.locator(loc).first():loc;
  let bb=await l.boundingBox();
  if(!bb||bb.y<40||bb.y+bb.height>860){await l.scrollIntoViewIfNeeded({timeout:2500});bb=await l.boundingBox();}
  return {x:bb.x+bb.width/2,y:bb.y+bb.height/2};};
const tap=async(loc,pause=300)=>{
  try{const c=await center(loc);await p.mouse.move(c.x,c.y,{steps:2});await sleep(GL);await p.mouse.down();await sleep(70);await p.mouse.up();await sleep(pause);return true;}
  catch(e){console.log('  (탭 실패)',String(e).split('\n')[0].slice(0,100));return false;}};
const hover=async(loc,pause=150)=>{
  try{const c=await center(loc);await p.mouse.move(c.x,c.y,{steps:2});await sleep(GL+pause);}catch(e){console.log('  (호버 실패)',String(e).split('\n')[0].slice(0,100));}};
const closeModal=async()=>{await tap('#modalBg.active .modal-foot button.primary',450);};
const L0=Date.now();const sh=async(t)=>{if(process.env.LAPS)console.log('   lap',t,((Date.now()-L0)/1000).toFixed(2));return s.shot(t);};

/* 자막 모드: ''=기본(좌하단 넓게) · 'nr'=좁게(모달 옆) · 'top'=좌상단 */
const mode=(m)=>p.evaluate(m=>{const e=document.getElementById('zcap2');if(e)e.className=m;},m);
const waitModal=(sel)=>p.waitForSelector(sel,{timeout:3000}).catch(()=>{});

/* ═════════ 장면 1 — 마감 엑셀 업로드 → 월·양식·라인·브랜드 자동 인식 ═════════ */
await s.open(APP,500);
await p.evaluate(()=>window.hideBackupToast&&window.hideBackupToast());
await p.mouse.move(1180,430);                                                  // 커서를 화면 안으로
const prevYm=await txt('.report .report-head-left h2');                        // 업로드 전에 보이는 보고서(지난 달)
console.log('  업로드 전 보고서:',prevYm);
await show('매월 마감 엑셀, 한 번만 올리세요','정산 엑셀을 끌어다 놓기만 하면 분석이 시작됩니다');
let fileMsg='';
await s.scene('upload',4.4,async()=>{
  await sleep(250);
  s.toast('UPLOAD','마감 엑셀(.xlsx)을 드래그하거나 클릭해서 선택',1900);
  const dz=await p.locator('#dropzone').boundingBox();
  await p.mouse.move(dz.x+dz.width*0.55,dz.y+dz.height*0.5,{steps:2});await sleep(GL+80);
  await sh('1a_dropzone_hover');
  const [fc]=await Promise.all([p.waitForEvent('filechooser'),(async()=>{await p.mouse.down();await sleep(80);await p.mouse.up();})()]);
  await sleep(300);                                                           // 파일 선택창
  await fc.setFiles(payload(MONTHS[MONTHS.length-1]));
  await p.waitForFunction(ym=>document.getElementById('fileResult').innerText.includes(ym),MONTHS[MONTHS.length-1],{timeout:15000});
  await p.evaluate(()=>window.hideBackupToast&&window.hideBackupToast());
  fileMsg=await txt('#fileResult .file-result');
  console.log('  업로드 결과:',fileMsg);
  const ym=(fileMsg.match(/\d{4}-\d{2}/)||[''])[0];
  const lines=(fileMsg.match(/라인 (\d+)개/)||[])[1],items=(fileMsg.match(/항목 (\d+)개/)||[])[1];
  const src=(fileMsg.match(/·\s*(AP|데일리뷰티)\s*·/)||[])[1];
  const brands=await p.evaluate(()=>new Set(Object.values(window._currentState.curr.lineBrands).flatMap(o=>Object.keys(o))).size);
  console.log('  브랜드 수(앱 상태):',brands);
  await show(ym+' 마감 엑셀 → 자동 인식 완료','파일명에서 월·양식('+src+'), 시트에서 라인 '+lines+'개 · 브랜드 '+brands+'개 · 업무 항목 '+items+'개를 읽어 냅니다');
  s.toast('AUTO','월 · 양식 · 라인 · 브랜드를 자동 인식 — 직접 입력 없음',2600);
  await hover('#fileResult .file-result',100);
  await sh('1b_recognized');
  await scrollTo(await topOf('.report-head',90),700);
  await hover('.report-head .meta-row',100);
  await sh('1c_head');
},{hold:true});
const meta=await txt('.report-head .meta-row');
console.log('  보고서 머리말:',meta);

/* ═════════ 장면 2 — 핵심 지표 · 전월 증감 · 이상치 ═════════ */
const k=async(i,sel)=>txt(`.kpi-grid .kpi:nth-child(${i}) ${sel}`);
const KP={total:await k(1,'.kpi-val'),totalD:await k(1,'.kpi-trend'),prod:await k(2,'.kpi-val'),prodD:await k(2,'.kpi-trend'),
  bus:await k(3,'.kpi-val'),busD:await k(3,'.kpi-trend'),alerts:await k(4,'.kpi-val')};
console.log('  KPI',JSON.stringify(KP));
const num=(t)=>(t.match(/[+\-−]?[\d.,]+%/)||[''])[0].replace('−','-');
await show('핵심 지표와 전월 증감이 자동 계산','총 마감액 '+KP.total+' ('+num(KP.totalD)+') · 생산도급 '+KP.prod+' ('+num(KP.prodD)+') · 업무도급 '+KP.bus+' ('+num(KP.busD)+')');
let alertRows=[];
await s.scene('kpi-alerts',4.0,async()=>{
  s.toast('증감','비교 기준(전월·전년 동월·직접 선택)은 버튼으로 바꿉니다',2000);
  await hover('.kpi-grid .kpi:nth-child(1)',120);
  await hover('.kpi-grid .kpi:nth-child(3)',120);
  await sh('2a_kpi');
  await show('±3% 넘는 변동은 이상치로 자동 탐지','이상치 '+KP.alerts+' — 눌러서 항목별 전월 대비 증감 확인');
  await tap('.kpi-grid .kpi.alert',150);                                         // 이상치 KPI 클릭 → 전체 목록
  await mode('nr');
  await waitModal('#modalBody .al-row');
  alertRows=(await p.locator('#modalBody .al-row').allInnerTexts()).map(x=>x.replace(/\s+/g,' ').trim());
  console.log('  이상치 목록',alertRows.join(' | '));
  await sh('2b_alert_modal');
  await sleep(500);
},{hold:true});

/* ═════════ 장면 3 — 이상치 라인 → 상세 드릴다운 ═════════ */
const topRow=alertRows.find(t=>/상세/.test(t))||'';
const topLine=topRow.replace(/^[▲▼]\s*/,'').split(' 상세')[0].trim();
const topFlow=(topRow.match(/[\d,.]+[만억]\s*→\s*[\d,.]+[만억]/)||[''])[0];
const topPct=(topRow.match(/[+\-−][\d.]+%/)||[''])[0];
console.log('  드릴 대상 라인:',topLine,topFlow,topPct);
await show('이상치 라인을 누르면 브랜드·단가·물량까지','"'+topLine+'" '+topFlow+' ('+topPct+') — 어느 브랜드가 움직였는지','nr');
let cellTitle='';
await s.scene('drill-cell',3.4,async()=>{
  s.toast('DRILL','라인 → 브랜드 → 단가·물량 — 이상치 원인을 클릭으로 추적',2400);
  await tap(p.locator('#modalBody .al-row-click').filter({hasText:topLine}).first(),150);
  await waitModal('#modalBg.active .cd-line');
  await sleep(200);
  cellTitle=await txt('#modalBg.active .cd-line').catch(()=>'');
  await sh('3a_cell_drill');
  await hover('#modalBg.active .cd-kpis',150);
  await sleep(500);
  await closeModal();
},{hold:true});

/* ═════════ 장면 4 — 경영 요약(Executive Summary) + 보고서 자동 생성 ═════════ */
const summary=await txt('.summary-box .summary-text');
console.log('  요약:',summary);
const sum1=(summary.match(/^(.*?\))\.\s/)||[,summary])[1];
await show('경영 요약이 문장으로 자동 작성됩니다',sum1+' · 이상치 '+KP.alerts+' → 메일·PPT·공지문·CSV로 출력');
await s.scene('summary',5.4,async()=>{
  await scrollTo(await topOf('.summary-box',110),850);
  await hover('.summary-box',100);
  await sh('4a_summary');
  s.toast('REPORT','요약·이상치·증감 → 임원 보고 메일 · PPT 아웃라인 · 현장 공지문 · CSV',2600);
  await hover('.action-card:nth-child(2)',80);
  await tap('.action-card:nth-child(1)',150);                                    // 임원 메일 생성
  await mode('nr');
  await waitModal('#modalBody textarea');
  await sh('4b_mail');
  await sleep(450);
  await p.locator('#modalBody textarea').evaluate(e=>e.scrollTo({top:230,behavior:'smooth'})).catch(()=>{});
  await sleep(1000);
  await sh('4c_mail2');
  await closeModal();
},{hold:true});

/* ═════════ 장면 5 — 라인 × 월 히트맵 ═════════ */
await show('라인 × 월 히트맵으로 한눈에','색이 진할수록 정산 금액이 큰 달 — 셀을 누르면 그 달의 브랜드·단가·물량');
await s.scene('heatmap',3.0,async()=>{
  s.toast('HEATMAP','라인 × 월 정산액 — 진한 칸일수록 금액이 큰 달',2400);
  await scrollTo(await topOf('.heatmap-wrap',72),900);
  await sh('5a_heatmap');
  const rows=p.locator('.heatmap tbody tr');
  const cellAt=(r,c)=>rows.nth(r).locator('td.cell').nth(c);
  await hover(cellAt(0,2),0);await hover(cellAt(0,6),0);await hover(cellAt(3,6),0);
  await sh('5b_heat_hover');
},{hold:true});

/* ═════════ 장면 6 — 워터폴(전월 대비 증감 분해) ═════════ */
const wfCap=await txt('.wf-caption').catch(()=>'');
console.log('  워터폴:',wfCap);
await show('전월 대비 증감은 워터폴로 분해',wfCap+' — 막대를 누르면 브랜드별 증감','top');
await s.scene('waterfall',4.4,async()=>{
  await scrollTo(await topOf('.waterfall',150),1200);
  await sh('6a_waterfall');
  const idx=await p.evaluate(l=>[...document.querySelectorAll('.waterfall-svg rect.wf-bar')].findIndex(r=>(r.querySelector('title')?.textContent||'').startsWith(l+':')),topLine);
  console.log('  워터폴 막대 idx',idx);
  s.toast('DRILL','막대 클릭 → 어느 브랜드 때문에 늘고 줄었는지 분해',2000);
  if(idx>=0)await tap(p.locator('.waterfall-svg rect.wf-bar').nth(idx),150);
  await waitModal('#modalBg.active .wfd-row');
  const wrow=(await p.locator('#modalBg.active .wfd-row').first().innerText().catch(()=>'')).replace(/\s+/g,' ').trim();
  const wb=wrow.split(' ')[0],wd=(wrow.match(/[+\-−][\d,.]+[만억]/)||[''])[0];
  console.log('  워터폴 드릴 첫 행:',wrow);
  await show(topLine+' 증가분은 '+wb+' '+wd+' 때문','브랜드별 증감을 자동으로 분해','nr');
  await sh('6b_wf_drill');
  await sleep(1000);
  await closeModal();
},{hold:true});

/* 끝내기 — 임시 폴더의 결과를 출력 폴더로 옮긴다 */
await s.finish();
fs.copyFileSync(path.join(TMP,'seg_monthly.webm'),path.join(OUT,'seg_monthly.webm'));
fs.copyFileSync(path.join(TMP,'seg_monthly.json'),path.join(OUT,'seg_monthly.json'));
if(process.env.KEEP_XLSX)fs.cpSync(XDIR,process.env.KEEP_XLSX,{recursive:true});
fs.rmSync(TMP,{recursive:true,force:true});
await browser.close();
const tot=JSON.parse(fs.readFileSync(path.join(OUT,'seg_monthly.json'),'utf8')).reduce((a,m)=>a+(m.end-m.start),0);
console.log('완료 →',path.join(OUT,'seg_monthly.webm'),'· 장면 합계',tot.toFixed(1)+'초');
process.exit(0);
