/**
 * 데모 영상 구간 — 젠키퍼(현장 안전 셀프점검 · TBM · 위험 신고 + 관리자 콘솔)
 *
 *   node video/scenes/zenkeeper.mjs <출력폴더>   → <출력폴더>/seg_zenkeeper.webm + seg_zenkeeper.json (장면 합계 약 28~30초)
 *   SHOTS=<폴더> …   장면마다 스크린샷 저장(확인용)
 *
 * 장면: ① 홈(오늘의 4대 실천 현황) ② 10초 셀프 체크리스트(젠프 5/5 → 저장) ③ 4대 실천 탭 전환(젠큐 입력·젠클린·젠그린)
 *       ④ TBM 등록(실제 입력 + 사진) → 참석자별 누적 시간 ⑤ 위험 신고(실제 입력) ⑥ 관리자 콘솔(자동 집계·7일 추이·상태 변경·CSV)
 *
 * 정직성 원칙
 *  - 앱(ZENF_Safety_App_v65.html)을 file:// 로 열어 화면 조작 그대로 값을 만든다. DOM 을 고쳐 쓰지 않는다.
 *  - 영상 중 직접 입력하는 것: 젠프 5/5·젠큐 3/5 점검 저장, TBM 1건(공정·진행·시간·참석자 3명·포인트·사진 1장), 위험 신고 1건, 신고 상태 변경.
 *  - 과거 기록은 "시연용 샘플" — 앱이 저장하는 localStorage 키(zenf:reports · zenf:checklog · zenf:tbm · zenf:roster ·
 *    zenf:settings)와 같은 형식으로 initScript 에서 미리 넣는다. 화면 하단에 "시연용 샘플 데이터" 표시. 이름은 익명("작업자 A").
 *  - 자막의 수치는 화면(DOM)에서 읽은 값으로 만든다.
 *  - 관리자 PIN 은 화면에 입력하지 않는다. 앱은 PIN 통과 여부를 저장하지 않고 메모리(state.managerAuthed)에만 두므로,
 *    페이지 안에서 그 플래그만 켜고 앱의 정상 경로(역할 토글 → setRole → applyRole)를 누른다. PIN 모달은 뜨지 않는다.
 *  - TBM 사진은 시연용 그림(canvas 로 그린 안내 이미지)을 파일 선택으로 올린다 — 앱의 사진 등록 경로 그대로.
 *  - 전송(노션 등)은 이 앱 v65 에 UI 가 없다(코드에 sendToNotion 만 남아 있고 호출 버튼 없음) → 다루지 않는다.
 *  - 화면에 노출되면 곤란한 것: 홈의 '비상대응 안내' 모달과 관리자 맨 아래 '비상대응 정보'에 실명·전화번호가 있다 → 열지 않고 스크롤도 하지 않는다.
 *    TBM '진행 관리자' 입력칸 placeholder 의 실명 예시는 투명 처리(스타일만).
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import {launch,session,ROOT} from '../lib.mjs';

process.env.TZ='UTC';   // 앱의 todayStr() 은 UTC 날짜 — 샘플 날짜와 일치시킨다
const OUT=path.resolve(process.argv[2]||path.join(ROOT,'video','out'));
const APP='file://'+path.join(ROOT,'ZENF_Safety_App_v65.html');
const TAG='SYSTEM · 젠키퍼';

/* ───────── 시연용 샘플 데이터 (앱의 localStorage 형식 그대로) ───────── */
const NOW=Date.now();
const ymd=d=>d.toISOString().slice(0,10);
const todayD=new Date(ymd(new Date(NOW))+'T00:00:00Z');
const dayStr=n=>ymd(new Date(todayD.getTime()-n*864e5));
const tsAt=(daysAgo,hour,min=0)=>new Date(todayD.getTime()-daysAgo*864e5+(hour*60+min)*60000).toISOString();
const todayTs=(h)=>{const t=Math.max(todayD.getTime()+60e3,Math.min(NOW-60e3,todayD.getTime()+h*3600e3));return new Date(t).toISOString();};

const REPORTS=[ // [며칠 전, 시, 구역, 분류, 위험도, 제목, 내용, 상태, 신고자]
  [6,9,'세척실','zenclean','중','세척실 배수구 막힘','배수가 느려 바닥에 물이 고입니다.','완료','작업자 B'],
  [5,14,'생산라인','zenf','상','컨베이어 방호덮개 파손','덮개가 깨져 손이 말려들 위험이 있습니다.','완료','작업자 C'],
  [4,10,'포장재창고','zenclean','하','파렛트 정위치 이탈','표시선 밖으로 파렛트가 나와 있습니다.','완료','작업자 D'],
  [4,15,'원료창고','zengreen','중','폐기물 분리수거 혼입','일반 폐기물에 재활용품이 섞여 있습니다.','완료','작업자 E'],
  [3,11,'AGV 구역','zenf','상','AGV 이동로에 적재물','이동로 한쪽에 박스가 쌓여 있습니다.','처리중','작업자 B'],
  [2,13,'생산라인','zenqual','중','계측기 교정 표시 누락','교정 만료일 표시가 보이지 않습니다.','처리중','작업자 F'],
  [1,9,'출하장','zenf','중','상차 구역 바닥 파손','바닥이 패여 지게차 바퀴가 걸립니다.','처리중','작업자 C'],
  [1,16,'생산라인','zenf','상','비상정지 스위치 앞 자재 적치','스위치 접근이 어렵습니다.','접수','작업자 D'],
  ['T',8,'세척실','zengreen','하','세척액 보관함 라벨 훼손','내용물 표시가 지워져 있습니다.','접수','작업자 E'],
].map((r,i)=>{const ts=r[0]==='T'?todayTs(r[1]):tsAt(r[0],r[1],10*i%50);
  const o={id:Date.parse(ts)+i,ts,zone:r[2],hero:r[3],level:r[4],title:r[5],content:r[6],status:r[7],reporter:r[8],synced:false};
  if(r[7]!=='접수')o.statusAt=new Date(Date.parse(ts)+3*3600e3).toISOString();
  return o;}).sort((a,b)=>b.id-a.id);   // 앱은 최신이 맨 앞

const LOG=[];   // 앱 checklog 형식: {id,date,hero,items,done,total}
const HK=['zenf','zenqual','zenclean','zengreen'];
const PAT={1:HK,2:['zenf','zenqual','zenclean'],3:HK,4:['zenf','zenclean'],5:['zenf','zenqual','zengreen'],6:HK};   // 일별 점검한 분류
for(const [d,heroes] of Object.entries(PAT)){heroes.forEach((h,j)=>{const done=(d%2===0&&j===heroes.length-1)?4:5;
  LOG.push({id:Date.parse(tsAt(+d,8,j)),date:dayStr(+d),hero:h,items:[...Array(done).keys()],done,total:5});});}
LOG.push({id:NOW-3*3600e3,date:dayStr(0),hero:'zenclean',items:[0,1,2,3,4],done:5,total:5});   // 오늘 이른 시간에 끝낸 분류(샘플)
LOG.push({id:NOW-3*3600e3+1,date:dayStr(0),hero:'zengreen',items:[0,1,2,3],done:4,total:5});

const ROSTER=['작업자 A','작업자 B','작업자 C','작업자 D','작업자 E','작업자 F'];
const TBM={};   // 최근 2주 평일 TBM(사진 없음)
{const PROC=['충전 3라인','포장 1라인','세척실','출하장'],DUR=[10,15,15,20];let k=0;
 for(let i=1;i<=14;i++){const d=new Date(todayD.getTime()-i*864e5);const wd=d.getUTCDay();if(wd===0||wd===6)continue;
  const att=ROSTER.filter((n,j)=>(k+j)%3!==0);
  TBM[ymd(d)]={photos:[],ts:tsAt(i,7,50),process:PROC[k%4],manager:'관리자 A',duration:DUR[k%4],attendeeNames:att,points:'보호구 착용 · 이동동선 확인',done:true,doneTs:tsAt(i,8,10)};k++;}}

const SEED={
  'zenf:reports':REPORTS,'zenf:seeded':true,'zenf:checklog':LOG,'zenf:tbm':TBM,'zenf:roster':ROSTER,
  'zenf:settings':{incidentStart:dayStr(47)},'zenf:config':{relayUrl:''},
};

const initScript=`(function(){
  var css=function(t){var add=function(){var st=document.createElement('style');st.textContent=t;(document.head||document.documentElement).appendChild(st);};
    if(document.documentElement)add();else{var mo=new MutationObserver(function(){if(document.documentElement){mo.disconnect();add();}});mo.observe(document,{childList:true});}};
  try{var S=${JSON.stringify(SEED)};for(var k in S){localStorage.setItem(k,JSON.stringify(S[k]));}}catch(e){}
  css('#splash{display:none!important}'                                   // 스플래시(2초)는 영상에서 생략
     +'#tbmManager::placeholder{color:transparent}'                        // placeholder 의 실명 예시를 가림
     +'#zcap2{max-width:392px!important;left:40px!important}#zcap2 .h{font-size:24px!important}#zcap2 .s{font-size:14px!important}');   // 가운데 앱 열(480px)을 가리지 않게 좁힌다
})();`;

/* ───────── 시연용 TBM 사진(안내 그림) 만들기 ───────── */
const {browser,be}=await launch();
const WORK=fs.mkdtempSync(path.join(os.tmpdir(),'zk-rec-'));
const PHOTO=path.join(WORK,'tbm_sample.png');
{const c=await browser.newContext();const pg=await c.newPage();
 const b64=await pg.evaluate(()=>{const cv=document.createElement('canvas');cv.width=800;cv.height=500;const g=cv.getContext('2d');
  g.fillStyle='#e9eef3';g.fillRect(0,0,800,500);g.fillStyle='#0f2438';g.fillRect(0,0,800,90);
  g.fillStyle='#fff';g.font='700 34px sans-serif';g.fillText('TBM  작업 전 안전미팅',34,58);
  g.strokeStyle='#0f2438';g.lineWidth=4;g.strokeRect(80,150,640,260);
  g.fillStyle='#0f2438';for(let i=0;i<5;i++){g.beginPath();g.arc(180+i*110,270,34,0,7);g.fill();g.fillRect(146+i*110,312,68,70);}
  g.fillStyle='#44566e';g.font='600 24px sans-serif';g.fillText('시연용 샘플 이미지',290,455);
  return cv.toDataURL('image/png').split(',')[1];});
 fs.writeFileSync(PHOTO,Buffer.from(b64,'base64'));await c.close();}

/* ───────── 세션 · 조작 도구 ───────── */
const s=await session(browser,be,'zenkeeper',WORK,{initScript});
const {p,sleep}=s;
p.on('pageerror',e=>console.log('  [pageerror]',String(e).slice(0,140)));
const V0=Date.now();const elapsed=()=>(Date.now()-V0)/1000;
const B=(sec)=>process.env.NOPAD?0:sec;   // NOPAD=1 이면 장면 길이를 채우지 않고 동작 자체의 소요 시간만 잰다
const L=(x)=>typeof x==='string'?p.locator(x).first():x;
const txt=async(sel)=>(await L(sel).innerText()).replace(/\s+/g,' ').trim();
let mx=1000,my=500;   // 커서 위치(이동 거리에 따라 단계 수를 조절 — 가까우면 짧게, 멀면 길게)
/** 필요하면 부드럽게 스크롤 → 커서가 걸어가서 → 누른다 */
const tap=async(loc,pause=300)=>{const l=L(loc);
  let r=await l.evaluate(e=>{const b=e.getBoundingClientRect();const ok=b.top>110&&b.bottom<770;if(!ok)e.scrollIntoView({block:'center',behavior:'smooth'});
    return {x:b.x,y:b.y,w:b.width,h:b.height,sc:!ok};});
  if(r.sc){await sleep(420);const bb=await l.boundingBox();if(!bb)return false;r={x:bb.x,y:bb.y,w:bb.width,h:bb.height};}
  const x=r.x+r.w/2,y=r.y+r.h/2,steps=Math.max(2,Math.min(9,Math.round(Math.hypot(x-mx,y-my)/110)));
  await p.mouse.move(x,y,{steps});mx=x;my=y;await p.mouse.down();await sleep(40);await p.mouse.up();await sleep(pause);return true;};
const typeIn=async(loc,text,delay=38)=>{await tap(loc,60);await p.keyboard.type(text,{delay});await sleep(120);};
const scrollToEl=async(sel,block='start',off=0,wait=750)=>{await p.evaluate(([sel,block,off])=>{const e=document.querySelector(sel);if(!e)return;
    const y=e.getBoundingClientRect().top+scrollY-off;scrollTo({top:y,behavior:'smooth'});},[sel,block,off]);await sleep(wait);};
const toTop=async(wait=500)=>{await p.evaluate(()=>scrollTo({top:0,behavior:'smooth'}));await sleep(wait);};
const tab=(label)=>p.locator('#tabBar .tab',{hasText:label}).first();

/* ───────── ① 홈 ───────── */
await s.open(APP,500);
await p.waitForFunction(()=>document.querySelectorAll('#todayStat .ts').length===4,null,{timeout:8000});
await s.sample(true);
await p.mouse.move(1000,500);
await s.scene('home',B(1.8),async()=>{
  const dd=await txt('#dday'),sum=await txt('#statSum');
  await s.cap(TAG,'현장 작업자 — 오늘의 4대 실천',`젠프·젠큐·젠클린·젠그린 · 무재해 ${dd}일째 · 오늘 ${sum}`);
  await s.toast('HOME','분류별 진행률을 링으로 표시',3000);
  await s.shot('01_home');
  await p.mouse.move(700,430,{steps:6});mx=700;my=430;
  await p.evaluate(()=>scrollTo({top:230,behavior:'smooth'}));   // 4가지 약속·캠페인 포스터 영역 쪽으로 살짝
  await sleep(500);await s.shot('01b_home_scrolled');
},{hold:true});

/* ───────── ② 10초 셀프 체크리스트 (젠프 5/5 → 저장) ───────── */
await s.scene('check',B(4.4),async()=>{
  await toTop(350);
  await tap(tab('체크'),250);
  await s.cap(TAG,'10초 셀프 체크리스트','작업 전 항목을 눌러 체크 — 보호구·동선·설비·비상구');
  await s.shot('02_check_open');
  const items=p.locator('#ckList label.check');
  const n=await items.count();
  for(let i=0;i<n;i++){await tap(items.nth(i),90);}
  const cnt=await txt('#ckCount');
  await s.cap(TAG,`젠프 안전 점검 ${cnt}`,'진행 막대가 차오르고 "오늘 점검 저장"으로 기록');
  await s.shot('03_check_done');
  await tap('button.btn.g:has-text("오늘 점검 저장")',350);
  await p.waitForSelector('#cele.show',{timeout:3000}).catch(()=>{});
  await s.toast('AUTO','점검 기록은 관리자 점검률에 자동 반영',3600);
  await sleep(700);await s.shot('04_celebrate');
  await tap('#cele .btn',250);
},{hold:true});

/* ───────── ③ 4대 실천 탭 전환 ───────── */
await s.scene('heroes',B(3.0),async()=>{
  await s.cap(TAG,'4대 실천 — 분류별 점검표','젠프 안전 · 젠큐 품질 · 젠클린 2S · 젠그린 환경 (항목은 분류마다 다름)');
  await tap(p.locator('#heroPick button',{hasText:'젠큐'}),250);
  const items=p.locator('#ckList label.check');
  for(let i=0;i<3;i++)await tap(items.nth(i),80);
  await tap('button.btn.g:has-text("오늘 점검 저장")',350);
  await s.shot('05_zenqual');
  await tap(p.locator('#heroPick button',{hasText:'젠클린'}),380);
  await tap(p.locator('#heroPick button',{hasText:'젠그린'}),380);
  await s.shot('06_zengreen');
},{hold:true});

/* ───────── ④ TBM ───────── */
await s.scene('tbm',B(6.2),async()=>{
  await tap(tab('TBM'),300);
  await s.cap(TAG,'TBM — 공정·참석자·시간 기록','작업 전 안전미팅을 기록하면 참석자별 누적 시간이 자동 계산');
  await s.shot('07_tbm_open');
  await typeIn('#tbmProcess','충전 3라인',26);
  await typeIn('#tbmManager','관리자 A',26);
  await typeIn('#tbmDuration','15',60);
  const chips=p.locator('#tbmRoster .rchip');
  for(const i of [0,1,2])await tap(chips.nth(i),90);
  await typeIn('#tbmPoints','후진 시 주변 확인',16);
  await s.shot('08_tbm_filled');
  const fc=p.waitForEvent('filechooser',{timeout:4000});
  await tap(p.locator('.photo-btns button').nth(1),120);   // 앨범에서 선택
  try{(await fc).setFiles(PHOTO);}catch(e){console.log('  (사진 선택 건너뜀)');}
  await p.waitForFunction(()=>document.querySelectorAll('#tbmPhotos .tbm-th').length>0,null,{timeout:4000}).catch(()=>{});
  await sleep(250);
  await s.toast('PHOTO','사진을 올리면 "TBM 실시"로 표시',3600);
  await tap('#tbmRegBtn',450);
  await s.shot('09_tbm_done');
  await scrollToEl('#tbmTally',  'start',210,700);
  const meta=await txt('#tbmTallyMeta'),first=await txt('#tbmTally .tally-row');
  await s.cap(TAG,'참석자별 누적 TBM 시간 — 자동 집계',`${meta} · 1위 ${first.replace(/^1 /,'')}`);
  await s.shot('10_tbm_tally');
},{hold:true});

/* ───────── ⑤ 위험 신고 ───────── */
await s.scene('report',B(5.6),async()=>{
  await tap(tab('신고'),300);
  await s.cap(TAG,'위험 신고 — 발견 즉시 현장에서','구역 · 분류 · 위험도를 고르고 제목·내용을 적어 제출 (사진 3장까지)');
  await typeIn('#rReporter','작업자 A',26);
  await tap('#rZone',40);await p.keyboard.press('Escape').catch(()=>{});await p.selectOption('#rZone','포장재창고');await sleep(160);
  await tap(p.locator('.seg label',{hasText:'높음'}),150);
  await typeIn('#rTitle','통로 적재물로 충돌 위험',22);
  await typeIn('#rContent','파렛트가 통로로 튀어나옴',14);
  await s.shot('11_report_filled');
  await s.toast('REPORT','분류·위험도는 관리자 통계에 반영',3600);
  await tap('button.btn.g:has-text("신고하기")',450);
  await s.cap(TAG,'제출 즉시 저장 — 관리자 콘솔에 반영','내 신고 목록에서 접수 상태·위험도를 바로 확인');
  await s.shot('12_report_sent');
},{hold:true});

/* ───────── ⑥ 관리자 콘솔 ───────── */
await s.scene('admin',B(8.8),async()=>{
  await p.evaluate(()=>{state.managerAuthed=true;});   // PIN 통과 상태(메모리 플래그) — 화면에 PIN 입력 없음
  await toTop(450);
  await tap('#rManager',500);
  await p.waitForSelector('#v-board .kpis',{timeout:5000});
  await p.mouse.move(1080,520,{steps:4});mx=1080;my=520;
  const kp={};for(const k of await p.locator('#v-board .kpi').all()){kp[(await k.locator('.l').innerText()).trim()]=(await k.locator('.n').innerText()).replace(/\s+/g,'');}
  await s.cap(TAG,'관리자 콘솔 — 신고·점검·TBM 자동 집계',`누적 신고 ${kp['누적 신고']}건 · 미처리 ${kp['미처리 신고']}건 · 오늘 점검 완료율 ${kp['오늘 점검 완료율']} · 무재해 ${kp['무재해 연속']}`);
  await s.toast('ADMIN','입력 즉시 집계 — 별도 취합 없음',3400);
  await s.shot('13_admin_top');
  await tap(p.locator('#v-board .btn.ghost',{hasText:'CSV'}),500);   // 엑셀(CSV) 내보내기
  await s.cap(TAG,'엑셀(CSV) · PDF 리포트로 내보내기','보고용 파일을 버튼 한 번에 (PDF 는 인쇄 창에서 저장)');
  await s.shot('14_admin_csv');
  const cnt=async()=>{const o={};for(const r of await p.locator('#v-board .bar').all()){const l=(await r.locator('.bl').innerText()).trim();if(/^(접수|처리중|완료)$/.test(l))o[l]=+(await r.locator('.bv').innerText());}return o;};
  const before=await cnt();
  await scrollToEl('#v-board .donutrow',  'start',130,800);
  await s.cap(TAG,'분류별 점검률 · TBM 실시 · 신고 처리 현황','오늘 점검률 링 4개, TBM 사진, 접수→처리중→완료 막대');
  await s.shot('15_admin_mid');
  await sleep(350);
  await p.evaluate(()=>{const e=[...document.querySelectorAll('#v-board strong')].find(x=>/안전 통계/.test(x.textContent));if(e)scrollTo({top:e.getBoundingClientRect().top+scrollY-110,behavior:'smooth'});});
  await sleep(900);
  await s.cap(TAG,'최근 7일 추이 — 일별 신고 · 점검 이행률','구역별·분류별 신고 분포까지 자동 그래프');
  await s.shot('16_admin_trend');
  await sleep(300);
  const first=p.locator('#v-board .rep').first();
  await first.scrollIntoViewIfNeeded();
  await p.evaluate(()=>{const e=document.querySelector('#v-board .rep');if(e)scrollTo({top:e.getBoundingClientRect().top+scrollY-130,behavior:'smooth'});});
  await sleep(750);
  await s.cap(TAG,'신고 처리 — 상태 버튼 한 번','방금 접수한 신고가 맨 위 · 접수 → 처리중 → 완료');
  await s.shot('17_admin_list');
  await tap(first.locator('.stbtns button',{hasText:'처리중'}),500);
  const after=await cnt();
  await scrollToEl('#v-board .donutrow',  'start',130,700);
  await s.cap(TAG,'상태를 바꾸면 집계도 바로 갱신',`접수 ${before.접수}→${after.접수} · 처리중 ${before.처리중}→${after.처리중} · 완료 ${after.완료}`);
  await s.shot('18_admin_after');
},{hold:true});

/* ───────── 마무리 (lib.finish 대신 임시 폴더에서 찾아 복사) ───────── */
await s.ctx.close();
const findVids=()=>fs.readdirSync(WORK).filter(f=>/\.webm$/.test(f)).map(f=>path.join(WORK,f));
let vids=findVids();
for(let i=0;i<40&&vids.length!==1;i++){await new Promise(r=>setTimeout(r,250));vids=findVids();}
if(vids.length!==1)throw new Error('녹화 파일을 찾지 못함: '+vids.join(','));
fs.mkdirSync(OUT,{recursive:true});
const dest=path.join(OUT,'seg_zenkeeper.webm');
fs.copyFileSync(vids[0],dest);
fs.writeFileSync(dest.replace(/\.webm$/,'.json'),JSON.stringify(s.marks,null,1));
fs.rmSync(WORK,{recursive:true,force:true});
console.log('저장 →',dest,'| 총',elapsed().toFixed(1)+'s');
await browser.close();
process.exit(0);
