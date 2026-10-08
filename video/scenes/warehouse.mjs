/**
 * 데모 영상 구간 — 포장재 창고 적치 (작업자 입력 → 관리자 자동 반영)
 *
 *   node video/scenes/warehouse.mjs <출력폴더>     → <출력폴더>/seg_warehouse.webm + seg_warehouse.json  (약 28초)
 *   SHOTS=<폴더> …                                  → 장면마다 스크린샷 저장
 *
 * 정직성 원칙
 *  - 값은 전부 실제 앱·실제 Worker 코드(wh-stack-worker.js)로 만든다. DOM 을 고쳐 쓰지 않는다.
 *  - 작업자 앱에서 직접 입력하는 구역은 1곳(OC동 지하 A구역), 나머지 11개 구역은 시연용 샘플을 be.call 로 /api/submit 에 넣는다.
 *  - 관리자 암호는 입력하지 않는다 — sessionStorage 의 앱 인증값(zen_wh_admin_auth)만 미리 둔다(앱 코드 그대로).
 *  - 화면 하단에 "시연용 샘플 데이터" 표시. 입력자는 익명("작업자 A" …).
 */
import path from 'path';
import fs from 'fs';
import {fileURLToPath} from 'url';
import {launch,session,ROOT} from '../lib.mjs';

process.env.TZ='Asia/Seoul';   // 브라우저 시계도 KST — 앱 안의 시각 표기와 Worker 의 KST 제출시각을 맞춘다
const OUT=path.resolve(process.argv[2]||path.join(path.dirname(fileURLToPath(import.meta.url)),'..','out'));
const WH='wh-stack.hodoo0831.workers.dev';
const kstToday=()=>new Date(Date.now()+9*3600e3).toISOString().slice(0,10);
const DATE=kstToday();

/* ── 시연용 샘플: 작업자 앱이 보내는 것과 같은 모양(/api/submit) ──
   whole=true 면 앱의 '구역 전체' 입력(loc=__TOTAL__), 아니면 로케이션별(loc='<이름>#<순번>') */
const TOT='__TOTAL__';
const SAMPLE=[
  {zone:'hnb1', who:'작업자 B', capa:627, qty:858},
  {zone:'fnc2', who:'작업자 C', capa:242, qty:236},
  {zone:'fnc3', who:'작업자 D', capa:155, qty:118},
  {zone:'lbox', who:'작업자 E', capa:481, qty:494},
  {zone:'jig',  who:'작업자 F', capa:85,  qty:62},
  {zone:'tent', who:'작업자 G', capa:148, qty:126, locs:15, per:5},   // 로케이션별 입력(5P × 15칸)
  {zone:'oc1p', who:'작업자 H', capa:136, qty:112},
  {zone:'oc1t', who:'작업자 J', capa:72,  qty:75},
  {zone:'ocbb', who:'작업자 K', capa:37,  qty:21},
  {zone:'occ',  who:'작업자 L', capa:12,  qty:8},
  {zone:'cloud',who:'작업자 M', capa:38,  qty:14},
];
async function seed(be){
  for(const s of SAMPLE){
    let items;
    if(s.locs){ // 칸마다 고르게 나눠 담는다
      const base=Math.floor(s.qty/s.locs); let rest=s.qty-base*s.locs;
      items=Array.from({length:s.locs},(_,i)=>({loc:s.per+'P#'+i,capa:s.per,qty:base+(i<rest?1:0)}));
    } else items=[{loc:TOT,capa:s.capa,qty:s.qty}];
    const r=await be.call(WH,'/api/submit',{method:'POST',body:{date:DATE,zone:s.zone,worker:s.who,note:'',items}});
    if(!r.ok)throw new Error('샘플 제출 실패 '+s.zone+' '+JSON.stringify(r));
  }
}

/* ── 앱 화면 위에 얹는 보정(앱 코드는 건드리지 않는다) ── */
const INIT=()=>{
  try{
    sessionStorage.setItem('zen_wh_admin_auth','1');                       // 관리자 게이트 통과(앱 자체 인증값)
    if(/worker\.html$/.test(location.pathname))
      localStorage.setItem('zen_wh_worker_v1',JSON.stringify({who:'작업자 A'})); // 작업자 앱 '설정'의 이름
  }catch(e){}
  const css='#splash{display:none!important}#zcur{transition:left .36s cubic-bezier(.4,0,.2,1),top .36s cubic-bezier(.4,0,.2,1),transform .12s!important}';   // 스플래시는 영상에서 생략 · 커서 이동을 부드럽게
  const add=()=>{const st=document.createElement('style');st.textContent=css;(document.head||document.documentElement).appendChild(st);};
  if(document.documentElement)add();
  else new MutationObserver((m,o)=>{if(document.documentElement){o.disconnect();add();}}).observe(document,{childList:true});
};

const {browser,be}=await launch();
await seed(be);
const s=await session(browser,be,'warehouse',OUT,{initScript:INIT});
const {p,sleep}=s;
const file=f=>'file://'+path.join(ROOT,'wh-stack',f);


/* ── 보조 도구(자기 스크립트 안에서만) ── */
let CUR=[0,0];
/** 커서 이동 — lib.move 는 20스텝(약 1.8초, 부하가 크면 더)이라, 마우스 이벤트는 한 번만 보내고
    커서 오버레이의 CSS 전환(.36초)으로 미끄러지듯 보이게 한다 */
const hop=async(x,y)=>{await p.mouse.move(x,y);CUR=[x,y];await sleep(380);};
const click=async(loc,pause=500)=>{const l=typeof loc==='string'?p.locator(loc).first():loc;
  try{await l.scrollIntoViewIfNeeded({timeout:2500});const bb=await l.boundingBox();if(!bb)return false;
    await hop(bb.x+bb.width/2,bb.y+bb.height/2);await sleep(60);await p.mouse.down();await sleep(70);await p.mouse.up();await sleep(pause);return true;}
  catch(e){console.log('  (클릭 건너뜀)',String(e).split('\n')[0].slice(0,90));return false;}};
const typeInto=async(sel,text,delay=110)=>{await click(sel,100);await p.keyboard.type(text,{delay});await sleep(200);};
/** 화면이 멈춰 보이지 않게 커서를 살짝 움직이며 남은 시간을 채운다 */
const drift=async(ms)=>{const end=Date.now()+ms;let k=0;
  while(end-Date.now()>350){const dx=(k++%2?-1:1)*(18+(k%3)*9),dy=(k%2?1:-1)*(10+(k%2)*8);
    await p.mouse.move(Math.max(5,CUR[0]+dx),Math.max(5,CUR[1]+dy));CUR=[CUR[0]+dx,CUR[1]+dy];
    await sleep(Math.min(520,Math.max(0,end-Date.now()-300)));}
  const left=end-Date.now();if(left>0)await sleep(left);};
/** 장면 — 동작 뒤 남는 시간은 커서 이동으로 채운다(영상 길이를 일정하게 유지) */
const S=async(label,secs,fn)=>{const a=Date.now();
  await s.scene(label,secs,async()=>{await fn();const left=secs*1000-(Date.now()-a);console.log('     동작 '+((Date.now()-a)/1000).toFixed(1)+'s / 목표 '+secs+'s');if(left>300)await drift(left);},{hold:true});};
const num=t=>Number(String(t).replace(/[^\d.]/g,''));
const toTop=async()=>{await p.evaluate(()=>window.scrollTo(0,0));await sleep(120);};   // 탭을 바꾸기 직전 맨 위로(화면 전환과 함께 보이므로 순간 이동해도 어색하지 않다)
const smooth=async(y,ms=800)=>{await p.evaluate(y=>window.scrollTo({top:y,behavior:'smooth'}),y);await sleep(ms);};
/** 자막 위치 — 'right' 는 작업자 입력 화면(하단 제출 바를 가리지 않도록), 기본은 좌하단 */
const capAt=async(pos)=>p.evaluate(pos=>{const e=document.getElementById('zcap2');if(!e)return;
  e.style.left=e.style.right=e.style.top=e.style.bottom=e.style.maxWidth='';
  if(pos==='right'){e.style.left='auto';e.style.right='46px';e.style.top='236px';e.style.bottom='auto';e.style.maxWidth='500px';}},pos);

await s.open(file('worker.html'),600);
await s.sample(true);

/* ───────── 1. 작업자 앱 : 12개 구역 카드 ───────── */
await s.cap('SYSTEM · 창고','현장 작업자 — 구역별 적치 입력','12개 구역 카드를 눌러 파렛트 수를 입력하고 제출');
await S('작업자 구역 목록',2.4,async()=>{
  await s.shot('01_list');
  await s.toast('LIVE','클라우드 실시간 연동 — 제출하면 관리자 화면에 자동 반영',2300);
  await sleep(500);
  await click(p.locator('button.z',{hasText:'OC동 지하 A구역'}),300);
});

/* ───────── 2. 구역 입력 (실제 입력) ───────── */
await capAt('right');
await s.cap('SYSTEM · 창고','숫자를 넣는 즉시 적치율 계산','＋10 · ＋ 버튼 또는 직접 입력 → CAPA 대비 적치율과 초과분이 바로 표시');
await S('구역 입력',4.6,async()=>{
  await typeInto('#totIn','128',90);
  await p.keyboard.press('Enter');await sleep(500);
  await s.shot('03_enter');
  await click(p.locator('button',{hasText:'+10'}),300);
  await click(p.locator('button',{hasText:'+10'}),250);
  await s.toast('AUTO','CAPA 136 PLT 초과분(12 PLT)을 자동 계산 — 빨간색으로 표시',2300);
  await sleep(300);
  await s.shot('04_bump');
});

/* ───────── 3. 제출 ───────── */
await S('제출',2.4,async()=>{
  await click('#send',150);
  await capAt('');
  await s.cap('SYSTEM · 창고','제출 → 클라우드에 저장','12개 구역이 모두 "제출됨" — 관리자 화면에서 바로 확인');
  await sleep(800);
  await s.shot('05_sent');
});

/* ───────── 4. 관리자 : 제출 현황 ───────── */
await S('관리자 제출 현황',5.6,async()=>{
  await s.open(file('admin.html'),0);
  await s.sample(true);
  await s.cap('SYSTEM · 창고','관리자 — 작업자 제출이 자동으로 도착','방금 입력한 구역까지 12개 구역 제출이 한 화면에 모인다');
  await s.shot('10_admin_open');
  await click('#atabs button[data-t="sub"]',400);
  const subInfo=await p.evaluate(()=>{const m=document.querySelector('#cBody .msum');return m?m.innerText.replace(/\s+/g,' '):'';});
  const subTotal=(subInfo.match(/합계\s*([\d,]+)\s*PLT/)||[])[1];
  const subCnt=(subInfo.match(/제출\s*(\d+)\s*\/\s*(\d+)/)||[]);
  console.log('  제출 탭:',subInfo);
  if(subCnt[1]!=='12'||!subTotal)console.log('  !! 제출 12/12 확인 필요');
  await s.cap('SYSTEM · 창고','관리자 — 작업자 제출이 자동으로 도착',`제출 ${subCnt[1]}/${subCnt[2]} 구역 · 합계 ${subTotal} PLT · 입력자·시각·적치율이 한 표에`);
  await smooth(268,600);
  await s.toast('AUTO','구역별 CAPA 대비 적치율을 자동 계산 — 100% 초과는 빨간색',3000);
  await s.shot('11_sub');
  await sleep(300);
  await click('#cApply',500);                                        // 이 수치를 적재수로 반영(앱 기능)
  await s.toast('NEW','구역별 [확인] 처리 후 "적재수로 반영" 한 번이면 KPI·배치도가 갱신',3200);
  await sleep(400);
});

/* ───────── 5. 관리자 : 배치도 · 이동 경로 ───────── */
let kp={k:['','',''],ms:'',n:0};
await S('배치도 · 초과 판정',4.0,async()=>{
  await toTop();await click('#atabs button[data-t="map"]',250);
  kp=await p.evaluate(()=>{const k=[...document.querySelectorAll('#kpis .kpi')].map(e=>e.innerText.replace(/\s+/g,' '));
    const ms=(document.getElementById('movesum')||{}).innerText||'';
    return {k,ms:ms.replace(/\s+/g,' '),n:document.querySelectorAll('#moves .mv').length};});
  console.log('  KPI:',JSON.stringify(kp));
  const rate=(kp.k[0].match(/([\d.]+)%/)||[])[1], overN=(kp.k[1].match(/(\d+)\s*구역/)||[])[1], overPlt=(kp.k[1].match(/초과\s*([\d,]+)\s*PLT/)||[])[1];
  await s.cap('SYSTEM · 창고','구역별 CAPA 대비 적치율 · 초과 자동 판정',`전사 적치율 ${rate}% · CAPA 초과 ${overN}개 구역(초과 ${overPlt} PLT) — 초록·주황·빨강으로 한눈에`);
  await s.toast('AUTO','Max 초과분이 10 PLT를 넘는 구역은 재배치 후보로 자동 선정',3000);
  await s.shot('13_map');
  await sleep(500);
  await smooth(404,700);
  const mvPlt=(kp.ms.match(/이동 물량\s*([\d,]+)\s*PLT/)||[])[1];
  await s.cap('SYSTEM · 창고','사업장 배치도 위 이동 경로 제안',`초과 구역 → 여유 구역 ${kp.n}건 · ${mvPlt} PLT — 지게차·핸드카·승강기 동선과 소요 시간까지`);
  await s.shot('14_map_routes');
});
await S('이동 카드',3.2,async()=>{
  await smooth(960,650);
  await s.shot('15_moves');
  const card=p.locator('#moves .mv',{hasText:'OC동 지하 A구역'}).first();
  await click(card,150);                                            // 카드를 누르면 그 동선만 지도에 표시
  await s.cap('SYSTEM · 창고','이동 카드를 누르면 해당 동선만 표시','방금 입력한 OC동 지하 A구역(148/136 PLT)의 초과 12 PLT도 이동 제안에 포함');
  await sleep(600);
  await s.shot('16_focus');
});

/* ───────── 6. 현황 탭 ───────── */
await S('현황 탭',2.4,async()=>{
  await toTop();
  await click('#atabs button[data-t="now"]',200);
  await s.cap('SYSTEM · 창고','현황 — 구역별 적치 상태 막대','흰 선 = 적재 CAPA · 빗금 = CAPA 초과분 · 여유 / 주의 / 초과 색 구분');
  await smooth(250,500);
  await s.shot('17_now');
});

/* ───────── 7. 상세·보고 · 내보내기 ───────── */
await S('상세·보고',4.2,async()=>{
  await toTop();
  await click('#atabs button[data-t="rep"]',200);
  await s.cap('SYSTEM · 창고','상세·보고 — 구역별 상세표와 보고문 자동 작성','엑셀 · PDF · 배치도 PNG 내보내기, 보고문은 한 번에 복사');
  await smooth(470,600);
  await s.toast('EXPORT','엑셀 · PDF · 배치도 이미지로 내보내기',2600);
  await s.shot('18_rep');
  const b=p.locator('.expbtns button',{hasText:'엑셀'}).first();const bb=await b.boundingBox();
  if(bb)await hop(bb.x+bb.width/2,bb.y+bb.height/2);
  const b2=p.locator('.expbtns button',{hasText:'PDF'}).first();const bb2=await b2.boundingBox();
  if(bb2)await hop(bb2.x+bb2.width/2,bb2.y+bb2.height/2);
  await smooth(1010,700);
  await s.shot('19_report');
});

await s.finish();
await browser.close();
