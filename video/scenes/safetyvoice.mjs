/**
 * 데모 영상 구간 — 세이프티 보이스(현장 위험사항·건의사항·제보 접수 + 관리자 접수함)
 *
 *   node video/scenes/safetyvoice.mjs <출력폴더>   → <출력폴더>/seg_safetyvoice.webm + seg_safetyvoice.json (장면 합계 약 32~34초)
 *   SHOTS=<폴더> …   장면마다 스크린샷 저장(확인용)     NOPAD=1 …   장면 길이를 채우지 않고 동작 자체의 소요 시간만 잰다
 *
 * 대상: 실제 배포본의 두 화면 — 현장 safetyvoice/worker.html(https://safetyvoice-worker.netlify.app),
 *       관리자 safetyvoice/admin.html(https://safetyvoice-admin.netlify.app). 둘 다 저장소 API https://zenkeeper.hodoo0831.workers.dev 를 쓴다.
 *
 * 정직성 원칙
 *  - 앱 HTML 은 수정하지 않고 저장소 파일 그대로 가상 주소(위 두 배포 주소)에서 열어, 앱이 부르는 API 가 video/local-backend.mjs 의
 *    "젠키퍼 Worker 흉내"로 가게 한다. 이 흉내는 실제 Cloudflare Worker 코드가 아니라 두 화면이 쓰는 계약
 *    (POST / 접수·update, GET /reports)만 구현한 시험용이다.
 *  - 영상 중 직접 입력·제출하는 1건은 현장 화면 조작 그대로 앱의 submit() 이 POST 한다(DOM 하드코딩 없음).
 *    관리자 화면의 상태 변경·답변 저장도 앱의 저장 버튼이 POST {action:'update'} 를 보낸다. 현장 '내 신고 확인'도 앱의 lookup().
 *  - 과거 신고 9건은 "시연용 샘플" — 앱이 보내는 것과 같은 필드 형식으로 흉내 서버의 ZK_REPORTS 에 영상 시작 전에 넣는다
 *    (화면 하단 "시연용 샘플 데이터" 표시). 이름은 익명("작업자 A")·가상 업체명("○○산업")만 쓴다.
 *  - 자막 수치는 화면(DOM)에서 읽은 값으로 만든다.
 *  - 관리자 비밀번호는 화면에 입력하지 않는다. (참고: admin.html 은 sessionStorage['sv_admin_ok'] 가 있어도 enter() 가 입력칸 값을 다시 비교해
 *    통과시키지 않는다.) 그래서 녹화 페이지의 localStorage 'sv_admin_pw' 를 녹화 전용 임시값으로 두고, 게이트가 CSS 로 가려진 상태에서
 *    페이지 안에서 앱의 enter() 를 호출한다 — 실제 비밀번호(기본값 포함)는 스크립트에도 화면에도 쓰이지 않는다.
 *
 * 영상에서 가린 것(앱 소스는 그대로, 녹화 페이지에 CSS 만 주입)
 *  - 두 화면 하단의 "제작 및 문의 센터장 … 전화 · 이메일" 푸터(.credit) 와 부착문(포스터) 맨 아래 문의 줄(.pfoot) — 실명·연락처.
 *  - 스플래시(#splash, 첫 방문 1.65초 이상 표시) 와 관리자 비밀번호 게이트(#gate) — 로딩 화면이 영상에 남지 않게.
 *  - 알림 권한 요청·prompt() 는 initScript 로 무력화(헤드리스 멈춤 방지). 외부 전송(웹훅·카톡 복사)·CSV/Excel/PPT 내보내기는 누르지 않는다.
 *  - 구글 폰트 요청(fonts.googleapis.com/gstatic.com)은 오프라인이라 막히므로, 같은 서체(나눔고딕) 서브셋을
 *    .claude/skills/zen-ui/assets 에서 읽어 그 주소로 대신 내려준다 — 배포본에서 보이는 글꼴과 같은 모양.
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import {launch,session,ROOT} from '../lib.mjs';
import {ZK_REPORTS} from '../local-backend.mjs';

const OUT=path.resolve(process.argv[2]||path.join(ROOT,'video','out'));
const WORKER_ORIGIN='https://safetyvoice-worker.netlify.app';
const ADMIN_ORIGIN='https://safetyvoice-admin.netlify.app';
const TAG='SYSTEM · 세이프티 보이스';
const NOW=Date.now();
const DEMO_PW='svdemo';   // 녹화 전용 임시 비밀번호

/* ───────── 시연용 샘플 신고 9건 — 현장 화면 submit() 이 보내는 것과 같은 필드 형식 ───────── */
const KN={danger:'위험사항',suggest:'건의사항',report:'제보'};
const pad2=n=>String(n).padStart(2,'0');
const kstOf=ms=>{const k=new Date(ms+9*3600e3);
  const date=`${k.getUTCFullYear()}-${pad2(k.getUTCMonth()+1)}-${pad2(k.getUTCDate())}`,time=`${pad2(k.getUTCHours())}:${pad2(k.getUTCMinutes())}`;
  return {datetime:`${date} ${time}`,no:`ZF-${k.getUTCFullYear()}${pad2(k.getUTCMonth()+1)}${pad2(k.getUTCDate())}-${pad2(k.getUTCHours())}${pad2(k.getUTCMinutes())}`};};
const H=3600e3;
const SAMPLES=[ // agoH · kind · site · area(장소) · role · company · anon · name · level · content · status · reply
  {agoH:120,kind:'suggest',site:'코스비전',  area:'원료 칭량실',role:'employee',anon:false,name:'작업자 A',level:'하',
   content:'칭량실 입구에 손소독 거치대와 발판 소독 매트를 놓아주세요',status:'완료',reply:'칭량실 입구에 손소독 거치대를 설치했습니다. 제안 감사합니다.'},
  {agoH:98, kind:'report', site:'아모레퍼시픽',area:'하차장 흡연구역',role:'driver',company:'○○산업',anon:false,name:'',level:'하',
   content:'하차 대기 중 흡연구역 안내 표지가 지워져서 위치가 헷갈립니다',status:'완료',reply:'안내 표지를 다시 부착했습니다. 알려주셔서 감사합니다.'},
  {agoH:76, kind:'danger', site:'코스비전',  area:'2층 충진라인 계단',role:'employee',anon:true,level:'중',
   content:'계단 미끄럼 방지 테이프가 많이 닳아서 내려갈 때 미끄럽습니다',status:'완료',reply:'미끄럼 방지 테이프를 교체했습니다.'},
  {agoH:30, kind:'danger', site:'아모레퍼시픽',area:'포장재 창고 도크장',role:'driver',company:'△△운수',anon:true,level:'상',
   content:'포장재 창고 도크장 바닥에 파렛트가 튀어나와 있어서 지게차 통행이 위험합니다',status:'조치중',reply:'도크장 바닥 표시선 재도색 일정을 잡았습니다.'},
  {agoH:27, kind:'danger', site:'코스비전',  area:'충진 3라인',role:'employee',anon:false,name:'작업자 B',level:'상',
   content:'충진 3라인 비상정지 스위치 앞에 자재가 쌓여 있어 바로 누르기 어렵습니다',status:'접수'},
  {agoH:21, kind:'suggest',site:'아모레퍼시픽',area:'사무동 휴게실',role:'employee',anon:true,level:'하',
   content:'휴게실 정수기가 한 대뿐이라 점심시간에 줄이 깁니다. 한 대 더 놓아주세요',status:'대기'},
  {agoH:9,  kind:'report', site:'코스비전',  area:'출하장',role:'driver',company:'□□물류',anon:false,name:'',level:'하',
   content:'야간 출하 때 출입구 조명이 꺼져 있는 날이 있어요. 확인 부탁드립니다',status:'접수'},
  {agoH:5,  kind:'danger', site:'아모레퍼시픽',area:'포장재 창고 도크장',role:'employee',anon:true,level:'중',
   content:'도크장 바닥에 파렛트가 튀어나와 있어 지게차 통행이 위험해요',status:'접수'},
  {agoH:2.5,kind:'suggest',site:'코스비전',  area:'포장실',role:'employee',anon:false,name:'작업자 C',level:'하',
   content:'포장실 작업대가 낮아서 허리가 아파요. 높이 조절형으로 바꿔주세요',status:'접수'},
];
SAMPLES.forEach((x,i)=>{
  const ms=NOW-x.agoH*H,t=kstOf(ms),isD=x.role==='driver';
  const reporter=x.anon?(isD?('협력사·'+(x.company||'기사님')):'익명'):(isD?`${x.company} · ${x.name||'기사님'}`:(x.name||'현장'));
  ZK_REPORTS.push({id:'r_demo_'+(i+1),ts:new Date(ms).toISOString(),
    reportNo:t.no,datetime:t.datetime,title:`[${KN[x.kind]}] ${x.content.replace(/\s+/g,' ').slice(0,40)}${x.content.length>40?'…':''}`,
    level:x.kind==='danger'?x.level:'하',hero:'zenf',zone:x.area?`${x.site} · ${x.area}`:x.site,content:x.content,status:x.status,reporter,photos:[],
    source:'voice',kind:x.kind,site:x.site,area:x.area,anonymous:x.anon,reporterType:x.role,company:isD?x.company:'',
    ...(x.reply?{reply:x.reply}:{})});
});

/* 영상 중 직접 입력할 신고 — 샘플(도크장 파렛트)과 내용이 비슷해 앱의 유사 신고 탐지(admin.html textSim ≥ 0.55)에 걸린다 */
const NEW={company:'○○산업',site:'아모레퍼시픽',zone:'포장재 창고 도크장',content:'도크장 앞 바닥에 파렛트가 튀어나와 있어서 지게차 통행이 위험합니다',
  reply:'도크장 바닥 표시선을 다시 칠하고 적치 금지 구역으로 지정하겠습니다. 감사합니다.'};
{ // 사전 점검: admin.html 과 같은 계산으로 유사도 확인
  const bg=s=>{s=s.replace(/\s+/g,'');const o=new Set();for(let i=0;i<s.length-1;i++)o.add(s.substr(i,2));return o;};
  const sim=(a,b)=>{const A=bg(a),B=bg(b);let n=0;A.forEach(g=>{if(B.has(g))n++;});return n/(A.size+B.size-n);};
  const d=SAMPLES.filter(x=>x.kind==='danger'&&x.site===NEW.site);
  console.log('유사도(새 신고 vs 샘플):',d.map(x=>sim(NEW.content,x.content).toFixed(2)).join(' / '),'| 샘플끼리',sim(d[0].content,d[1].content).toFixed(2));
}

/* ───────── 페이지 서빙·초기 스크립트 ───────── */
const SV=path.join(ROOT,'safetyvoice');
const HTML={worker:fs.readFileSync(path.join(SV,'worker.html')),admin:fs.readFileSync(path.join(SV,'admin.html'))};
const FONTS=path.join(ROOT,'.claude/skills/zen-ui/assets');
const initScript=`(function(){
  var admin=/safetyvoice-admin/.test(location.hostname);
  var css=function(t){var add=function(){var st=document.createElement('style');st.textContent=t;(document.head||document.documentElement).appendChild(st);};
    if(document.documentElement)add();else{var mo=new MutationObserver(function(){if(document.documentElement){mo.disconnect();add();}});mo.observe(document,{childList:true});}};
  try{if(admin)localStorage.setItem('sv_admin_pw','${DEMO_PW}');}catch(e){}            // 녹화용 임시 비밀번호(앱의 PWKEY) — 실제 비밀번호는 쓰지 않고 화면에 입력하지도 않는다
  try{window.prompt=function(){return null;};window.alert=function(){};
      Object.defineProperty(window,'Notification',{value:{permission:'denied',requestPermission:function(){return Promise.resolve('denied');}},configurable:true});}catch(e){}
  css('#splash{display:none!important}'                                              // 스플래시
     +'#gate{display:none!important}'                                                // 관리자 비밀번호 게이트
     +'.credit{display:none!important}.poster .pfoot{visibility:hidden}'             // 실명·연락처 푸터 / 부착문 문의 줄
     +'html.zhold body{opacity:0}');                                                 // 페이지 전환·로딩 중 빈 화면이 찍히지 않게
  css(admin
    ?'#zcap2{max-width:500px!important}#zcap2 .h{font-size:23px!important}#zcap2 .s{font-size:14px!important}'
     +'#ztoast{top:auto!important;bottom:62px!important;right:34px!important}#ztoast .k{max-width:400px!important}'   // 관리자: 토스트는 우하단(신고 상세 서랍의 제목·버튼을 가리지 않게)
    :'#zcap2{left:28px!important;max-width:330px!important}#zcap2 .h{font-size:21px!important}#zcap2 .s{font-size:13.5px!important}'   // 가운데 신고 열(680px)을 가리지 않게 좁힌다
     +'#ztoast{right:28px!important}#ztoast .k{max-width:330px!important;font-size:14px!important}');
  var hold=function(){document.documentElement.classList.add('zhold');setTimeout(function(){document.documentElement.classList.remove('zhold');},5000);};   // 5초 안전장치
  if(document.documentElement)hold();else{var mo2=new MutationObserver(function(){if(document.documentElement){mo2.disconnect();hold();}});mo2.observe(document,{childList:true});}
})();`;

const {browser,be}=await launch();
const WORK=fs.mkdtempSync(path.join(os.tmpdir(),'svv-rec-'));
const s=await session(browser,be,'safetyvoice',WORK,{initScript});
const {p,sleep}=s;
p.setDefaultTimeout(6000);
p.on('pageerror',e=>console.log('  [pageerror]',String(e.stack||e).slice(0,400),'@',p.url()));
p.on('dialog',d=>d.dismiss().catch(()=>{}));
p.on('requestfailed',r=>{const u=r.url();if(!/cdnjs|jsdelivr|googleapis|gstatic/.test(u))console.log('  [requestfailed]',u.slice(0,100));});
await s.ctx.route(/^https:\/\/safetyvoice-(worker|admin)\.netlify\.app\//,route=>{
  const u=new URL(route.request().url());
  if(u.pathname==='/'||u.pathname==='/index.html')return route.fulfill({status:200,contentType:'text/html; charset=utf-8',body:HTML[u.hostname.includes('admin')?'admin':'worker']});
  return route.fulfill({status:404,body:''});});
await s.ctx.route(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//,route=>{   // 구글 폰트 대신 같은 서체(나눔고딕 서브셋)
  const u=new URL(route.request().url());const cors={'access-control-allow-origin':'*'};
  if(u.hostname==='fonts.googleapis.com')return route.fulfill({status:200,contentType:'text/css',headers:cors,
    body:[400,700,800].map(w=>`@font-face{font-family:'Nanum Gothic';font-style:normal;font-weight:${w};font-display:block;src:url(https://fonts.gstatic.com/local/nanum_${w===400?400:700}.woff2) format('woff2')}`).join('\n')});
  const w=/nanum_400/.test(u.pathname)?400:700;
  return route.fulfill({status:200,contentType:'font/woff2',headers:cors,body:fs.readFileSync(path.join(FONTS,`nanum_${w}.woff2`))});});

/* ───────── 조작 도구 ───────── */
const V0=Date.now();const elapsed=()=>(Date.now()-V0)/1000;
const B=(sec)=>process.env.NOPAD?0:sec;
const L=(x)=>typeof x==='string'?p.locator(x).first():x;
const txt=async(sel)=>(await L(sel).innerText()).replace(/\s+/g,' ').trim();
let mx=1100,my=520;
/** 필요하면 부드럽게 스크롤 → 커서가 걸어가서 → 누른다 */
const tap=async(loc,pause=300)=>{const l=L(loc);
  const sc=await l.evaluate(e=>{const b=e.getBoundingClientRect();const ok=b.top>150&&b.bottom<720;if(!ok)e.scrollIntoView({block:'center',behavior:'smooth'});return !ok;});
  if(sc)await sleep(520);
  const bb=await l.boundingBox();if(!bb)return false;
  const x=bb.x+bb.width/2,y=bb.y+bb.height/2,steps=Math.max(3,Math.min(11,Math.round(Math.hypot(x-mx,y-my)/90)));
  await p.mouse.move(x,y,{steps});mx=x;my=y;await sleep(60);await p.mouse.down();await sleep(45);await p.mouse.up();await sleep(pause);return true;};
const hover=async(loc,pause=300)=>{const l=L(loc);const bb=await l.boundingBox();if(!bb)return;const x=bb.x+bb.width/2,y=bb.y+bb.height/2;
  await p.mouse.move(x,y,{steps:Math.max(3,Math.min(11,Math.round(Math.hypot(x-mx,y-my)/90)))});mx=x;my=y;await sleep(pause);};
const typeIn=async(loc,text,delay=40)=>{await tap(loc,50);await p.keyboard.type(text,{delay});await sleep(120);};
/** 네이티브 select: 커서로 눌러 보이고 값 선택(헤드리스에서는 목록이 그려지지 않는다) */
const pick=async(sel,value,pause=250)=>{await tap(sel,60);await p.keyboard.press('Escape').catch(()=>{});await p.selectOption(sel,value);await sleep(pause);};
/** 토스트는 한 번에 하나만 — 앞의 것은 바로 치운다 */
const T=async(tag,text,ms=3200)=>{await p.evaluate(()=>document.querySelectorAll('#ztoast .k').forEach(k=>k.remove())).catch(()=>{});await s.toast(tag,text,ms);};
/** 스크린샷 + 실명·연락처·기본 비밀번호 문구가 화면 텍스트에 남아 있는지 점검(가려진 요소는 innerText 에 안 잡힌다) */
const shot=async(tag)=>{const bad=await p.evaluate(()=>/이민아|010-\d{4}-\d{4}|malee@|기본 비밀번호/.test(document.body.innerText)).catch(()=>false);
  if(bad)console.log('  [경고] 연락처·실명 문구가 화면에 있음:',tag);await s.shot(tag);};
const reveal=async()=>{await p.evaluate(()=>document.documentElement.classList.remove('zhold'));};
const toTop=async(wait=500)=>{await p.evaluate(()=>scrollTo({top:0,behavior:'smooth'}));await sleep(wait);};
const fontsReady=async()=>{await p.evaluate(()=>document.fonts.ready).catch(()=>{});};
/** 이동한 페이지가 그려질 때까지 기다리고 나서 보여준다 */
const goto=async(url,ready)=>{await p.goto(url,{waitUntil:'load'});
  if(url.startsWith(ADMIN_ORIGIN))await p.evaluate(pw=>{const i=document.getElementById('pin');i.value=pw;document.getElementById('go').click();},DEMO_PW);   // 앱의 정상 경로(enter()) — 게이트는 CSS 로 가려져 화면엔 안 나온다
  if(ready)await p.waitForSelector(ready,{timeout:8000});await fontsReady();await p.mouse.move(mx,my);await s.sample(true);await reveal();await sleep(120);};

/* ───────── ① 현장 — 말하기(실제 입력·제출) ───────── */
await p.goto(WORKER_ORIGIN+'/');
await p.waitForSelector('.sv-kind',{timeout:8000});await fontsReady();
await p.mouse.move(mx,my);await s.sample(true);await reveal();await sleep(150);
let reportNo='';
await s.scene('worker-form',B(9.2),async()=>{
  await s.cap(TAG,'현장 신고 — 말하기','QR 로 접속 · 로그인 없이 소속 구분 → 사업장 → 유형을 고르고 적기만 하면 끝');
  await shot('01_form_top');
  await tap('.sv-who .w:has-text("협력사 기사님")',200);
  await T('WHO','제니엘 근로자 / 협력사 기사님(업체명 입력) 구분',3600);
  await typeIn('#svCompany',NEW.company,70);
  await pick('#svSite',NEW.site,180);
  await tap('.sv-kind .k.danger',250);
  await s.cap(TAG,'위험사항이면 위험도까지','위험사항 · 건의사항 · 제보 중 고르면 안내 문구가 바뀌고, 위험사항은 위험도를 함께 선택');
  await shot('02_kind');
  await tap('.rp-lv .hi span',200);
  await typeIn('#svZone',NEW.zone,28);
  await typeIn('#svContent',NEW.content,30);
  await shot('03_filled');
  await T('ANON','익명이면 신고자는 기록되지 않아요 — 이름 남기기도 선택 가능',3800);
  await tap('#svWhoBox .w:has-text("이름 남기기")',260);
  await shot('04_name');
  await tap('#svWhoBox .w:has-text("익명으로")',200);
},{hold:true});

await s.scene('worker-submit',B(3.0),async()=>{
  await tap('#svSend',150);
  await p.waitForSelector('.sv-done .no',{timeout:6000});
  await sleep(350);
  reportNo=(await txt('.sv-done .no')).replace(/^접수번호\s*/,'');
  await s.cap(TAG,'잘 받았어요!','접수번호 '+reportNo+' 발급 · 관리자 접수함에 바로 도착');
  await T('AUTO','접수번호로 언제든 처리 상태를 조회할 수 있어요',3000);
  await shot('05_done');
},{hold:true});

/* ───────── ② 관리자 — 접수함 · 필터 · 상태/답변 ───────── */
let st0={};
const stats=async()=>({all:+await txt('#cAll'),today:+await txt('#cToday'),open:+await txt('#cOpen'),work:+await txt('#cWork'),danger:+await txt('#cDanger')});
await s.scene('admin-inbox',B(4.6),async()=>{
  await goto(ADMIN_ORIGIN+'/','#list .card');
  await p.waitForFunction(()=>document.querySelector('#list .sim-chip'),null,{timeout:5000}).catch(()=>{});   // 유사 신고 계산(비동기)이 끝나 배지가 붙을 때까지
  await p.mouse.move(1000,470,{steps:6});mx=1000;my=470;
  st0=await stats();
  const top=p.locator(`#list .card[data-no="${reportNo}"]`);
  const sim=await top.locator('.sim-chip').first().innerText().catch(()=>'');
  await s.cap(TAG,`관리자 접수함 — 전체 ${st0.all}건`,`방금 낸 신고가 맨 위 · 아직 못 본 건 ${st0.open} · 대기·조치중 ${st0.work} · 위험 미완료 ${st0.danger}`);
  await shot('06_inbox');
  await hover('.stat.alert',900);                                                    // 집계 카드를 짚는다
  await T('STATS','접수함은 15초마다 자동으로 새로 불러와 집계 카드가 갱신돼요',2300);
  await hover(top.locator('.sim-chip').first(),700);                                // 유사 신고 배지를 짚는다
  if(sim)await T('SIMILAR',`내용이 비슷한 신고를 자동으로 묶어 "${sim.trim()}" 배지로 표시`,3000);
},{hold:true});

await s.scene('admin-filter',B(3.0),async()=>{
  await pick('#fWho','driver',300);
  const n=await p.locator('#list .card').count();
  await s.cap(TAG,`신고자별로 걸러 보기 — 협력사 기사님 ${n}건`,'유형 · 사업장 · 신고자 · 상태 · 기간 필터와 내용 검색');
  await T('EXPORT','접수함은 CSV 로, 보고문 탭에서는 PDF · Excel · PPT 로 저장',2800);
  await hover('#csv',900);
  await shot('07_filter');
},{hold:true});

await s.scene('admin-detail',B(6.4),async()=>{
  await tap(`#list .card[data-no="${reportNo}"]`,450);
  await p.waitForSelector('#dr.on',{timeout:3000});
  await sleep(250);
  const simN=await p.locator('#dr .simItem').count();
  await s.cap(TAG,'신고를 열어 처리하기',(simN?`비슷해 보이는 신고 ${simN}건을 함께 보여줘 중복 확인 · `:'')+'상태 변경과 신고자에게 보일 답변');
  await shot('08_drawer');
  await tap('#stb button[data-s="조치중"]',200);
  await T('REPLY','답변은 신고자의 "내 신고 확인"에 그대로 보여요',2200);
  await typeIn('#dReply',NEW.reply,16);
  await shot('09_reply');
  await tap('#dSave',250);
  await p.waitForFunction(()=>!document.querySelector('#dr.on'),null,{timeout:4000}).catch(()=>{});
  await sleep(550);
  const st1=await stats();
  await s.cap(TAG,'저장 즉시 집계 갱신',`아직 못 본 건 ${st0.open} → ${st1.open} · 대기·조치중 ${st0.work} → ${st1.work} · 위험 미완료 ${st1.danger}`);
  await shot('10_saved');
},{hold:true});

await s.scene('admin-qr',B(3.2),async()=>{
  await tap('#tabs button[data-v="qr"]',450);
  await p.waitForFunction(()=>document.querySelectorAll('#qrGrid .qr .c *').length>0,null,{timeout:4000}).catch(()=>{});
  const n=await p.locator('#qrGrid .qr').count();
  await s.cap(TAG,`QR — 사업장별 ${n}장 자동 생성`,'현장에 붙이고 스캔하면 해당 사업장이 담긴 신고 화면이 열려요 · 인쇄·이미지 저장 가능');
  await T('QR','신고 화면 주소에 사업장(?site=)이 담긴 QR 을 사업장마다 한 장씩',2800);
  await hover('#qrGrid .qr:first-child .c',500);
  await shot('11_qr_cards');
},{hold:true});

/* ───────── ③ 현장 — 내 신고 확인(상태·답변 반영) ───────── */
await s.scene('worker-mine',B(3.8),async()=>{
  await goto(WORKER_ORIGIN+'/','.tabs');
  await s.cap(TAG,'신고자도 처리 상태를 확인','접수번호로 조회 · 이 기기에서 낸 신고는 "내 신고 확인"에 남아요');
  await tap('.tabs b:has-text("내 신고 확인")',350);
  await tap('.sv-mine .mi',250);
  await p.waitForSelector('#lookRes .tag',{timeout:5000}).catch(()=>{});
  const stNow=await txt('#lookRes .tag').catch(()=>'');
  await s.cap(TAG,'신고자도 처리 상태를 확인',`${reportNo} · ${stNow} — 관리자가 남긴 답변이 그대로 보여요`);
  await T('LOOP','접수 → 대기 → 조치중 → 완료 진행 막대와 답변',3000);
  await shot('13_mine');
},{hold:true});

/* lib.finish() 는 페이지 이동(가상 주소 변경) 뒤 p.video().path() 가 실제 파일과 달라 실패할 수 있다 → 폴더의 webm 을 직접 찾는다 */
await s.ctx.close();
const findVids=()=>fs.readdirSync(WORK).filter(f=>/\.webm$/.test(f)).map(f=>path.join(WORK,f));
let vids=findVids();
for(let i=0;i<40&&vids.length!==1;i++){await new Promise(r=>setTimeout(r,250));vids=findVids();}
if(vids.length!==1)throw new Error('녹화 파일을 찾지 못함: '+vids.join(','));
fs.mkdirSync(OUT,{recursive:true});
const dest=path.join(OUT,'seg_safetyvoice.webm');
fs.copyFileSync(vids[0],dest);
fs.writeFileSync(dest.replace(/\.webm$/,'.json'),JSON.stringify(s.marks,null,1));
fs.rmSync(WORK,{recursive:true,force:true});
console.log('저장 →',dest,'| 총',elapsed().toFixed(1)+'s');
await browser.close();
process.exit(0);
