/**
 * 세척실 앱 구간 — 작업자 앱(도착 등록 · 우선순위 · 세척 시작/종료) → 관리자 대시보드 자동 반영
 *
 *   node video/scenes/wash.mjs <출력폴더>        → <출력폴더>/seg_wash.webm + seg_wash.json
 *   SHOTS=<폴더> …                               장면별 스크린샷 저장
 *
 * 데이터 원칙
 *  - 모든 값은 실제 앱 화면 조작 또는 실제 Worker(wash-db) 의 /api/state 호출(be.call)로만 만든다.
 *  - 과거 기록·현재 대기/세척중은 "시연용 샘플" — 결정적 의사난수(mulberry32)로 만들어 매번 같은 모양이 나온다.
 *  - 라인 마스터·점도 분류는 앱 소스(index.html)에서 그대로 읽어 온다. 암호는 화면에 입력하지 않는다
 *    (대시보드는 sessionStorage 로 게이트 통과, 설정 탭은 아예 사용하지 않음).
 *  - 자막·토스트의 수치는 화면(DOM)에서 읽은 값으로 만든다.
 */
import {launch,session,ROOT} from '../lib.mjs';
import fs from 'fs';
import path from 'path';

const OUT=path.resolve(process.argv[2]||path.join(ROOT,'video','out'));
const HOST='wash-db.hodoo0831.workers.dev';
const WORKER='file://'+path.join(ROOT,'wash-system/frontend/index.html');
const DASH='file://'+path.join(ROOT,'wash-system/frontend/dashboard.html');
const TAG='SYSTEM · 세척';

/* ───────── 앱 소스에서 라인 마스터·점도 분류 읽기 ───────── */
const src=fs.readFileSync(path.join(ROOT,'wash-system/frontend/index.html'),'utf8');
const grab=(name)=>{const m=src.match(new RegExp('const '+name+'\\s*=\\s*([\\[{][\\s\\S]*?[\\]}]);'));return new Function('return '+m[1])();};
const LINE_MASTER=grab('LINE_MASTER'),PRODUCT_TYPES=grab('PRODUCT_TYPES'),CATEGORY_MASTER=grab('CATEGORY_MASTER');
const findLine=(n)=>LINE_MASTER.find(l=>l.name===n);
const findPT=(label)=>PRODUCT_TYPES.find(p=>p.label===label);

/* ───────── 시각 기준: 업무시간대가 아니면 브라우저 시계를 14:20 으로 맞춘다 ───────── */
const realNow=new Date();
const FAKE=process.env.WASH_FAKE_HOUR!==undefined||realNow.getHours()<12||realNow.getHours()>=21;
const NOW=(()=>{if(!FAKE)return realNow.getTime();const d=new Date(realNow);d.setHours(+(process.env.WASH_FAKE_HOUR??14),20,0,0);return d.getTime();})();
const MIN=60000;

/* ───────── 결정적 의사난수 ───────── */
function rng(seed){return()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
const R=rng(20261008);
const pick=(a)=>a[Math.floor(R()*a.length)];
const pad=(n)=>n<10?'0'+n:''+n;
const fmtDate=(d)=>d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
const r1=(x)=>Math.round(x*10)/10;
const iso=(ms)=>new Date(ms).toISOString();

/* ───────── 샘플 기록 만들기 (앱의 record 형식 그대로) ───────── */
const GROUP_POOL=['직선','직선','직선','튜브','튜브','염모제','염모제','치약','치약','HnB기타','HnB기타','멀티','멀티','세정 자동','포터블 및 제조팀'];
const PREFIX={'직선':'P','튜브':'U','염모제':'M','치약':'T','HnB기타':'H','멀티':'X','세정 자동':'S','포터블 및 제조팀':'Z'};
let seq=0;
function makeRecord(endMs){
  const group=pick(GROUP_POOL);const line=pick(LINE_MASTER.filter(l=>l.group===group));
  const same=PRODUCT_TYPES.filter(p=>p.cat===line.category);
  const pt=R()<0.85?pick(same):pick(PRODUCT_TYPES);
  const cat=CATEGORY_MASTER[pt.cat];
  let wash=line.base*cat.weight*(0.75+R()*0.6);if(R()<0.08)wash*=1.5;          // 가끔 오래 걸림
  const waitMin=Math.min(55,3+(-Math.log(1-R())*11));                              // 대부분 짧고 가끔 길다
  const end=Math.round(endMs/1000)*1000;
  const start=end-Math.round(wash*60)*1000;const arr=start-Math.round(waitMin*60)*1000;
  // 필요시간: 82% 는 여유 있게 완료, 18% 는 지연
  const delay=R()<0.82?-Math.round(4+R()*34):Math.round(3+R()*24);
  const required=end-delay*MIN;
  const rework=R()<0.06?'Y':'N';
  return {id:end+(seq++),date:fmtDate(new Date(start)),line:line.name,group,category:pt.cat,productType:pt.label,
    item:PREFIX[group]+(100+Math.floor(R()*900)),unitCount:R()<0.8?1:2+Math.floor(R()*2),
    arrivedBy:group==='포터블 및 제조팀'?'manufacturing':'production',
    arrivedAt:iso(arr),requiredTime:iso(required),startTime:iso(start),endTime:iso(end),
    waitMin:r1((start-arr)/MIN),washMin:r1((end-start)/MIN),totalMin:r1((end-arr)/MIN),
    delayMin:Math.round((end-required)/MIN),workers:1+Math.floor(R()*3),carriers:1+Math.floor(R()*2),
    rework,arrivalNote:'',note:rework==='Y'?'재세척 - 잔류 확인':''};
}
function buildRecords(){
  const recs=[];
  for(let back=20;back>=1;back--){                                                 // 지난 20일
    const d=new Date(NOW-back*86400000);const dow=d.getDay();
    const n=dow===0?8+Math.floor(R()*2):dow===6?8+Math.floor(R()*4):10+Math.floor(R()*6);   // 8~15건
    for(let k=0;k<n;k++){const e=new Date(d);e.setHours(9,0,0,0);recs.push(makeRecord(e.getTime()+(k+0.5)/n*10*3600000+(R()-0.5)*40*MIN));}
  }
  // 오늘: 아침부터 지금 직전까지 10건
  const T0=new Date(NOW);T0.setHours(9,0,0,0);const T1=NOW-15*MIN,N=10;
  for(let k=0;k<N;k++)recs.push(makeRecord(T0.getTime()+(k+0.5)/N*(T1-T0.getTime())+(R()-0.5)*12*MIN));
  return recs;
}
function mkWaiting(name,ptLabel,arrAgo,reqIn,item,{unit=1,carriers=1}={}){
  const l=findLine(name),pt=findPT(ptLabel);
  return {line:name,waitingKey:name,group:l.group,category:pt.cat,lineCategory:l.category,productType:ptLabel,base:l.base,
    item,unitCount:unit,carriers,note:'',requiredTime:iso(NOW+reqIn*MIN),arrivedAt:iso(NOW-arrAgo*MIN),arrivedBy:'production'};
}
function mkWashing(name,ptLabel,startedAgo,wait,reqIn,workers,item,{unit=1}={}){
  const l=findLine(name),pt=findPT(ptLabel);
  return {line:name,washingKey:name,group:l.group,category:pt.cat,lineCategory:l.category,productType:ptLabel,base:l.base,
    item,unitCount:unit,arrivedBy:'production',workers,carriers:1,arrivalNote:'',requiredTime:iso(NOW+reqIn*MIN),
    arrivedAt:iso(NOW-(startedAgo+wait)*MIN),waitMin:wait,startedAt:iso(NOW-startedAgo*MIN)};
}
const waiting={};
for(const w of [
  mkWaiting('튜브5호','튜브 충전물',34,55,'U205'),
  mkWaiting('크림2호','크림',17,84,'H402'),
  mkWaiting('멀티셀3호','린스/에센스/세럼',21,78,'X318',{unit:2}),
  mkWaiting('직선11호','샴푸/바디워시',12,95,'P311'),
])waiting[w.line]=w;
const washing={};
for(const w of [
  mkWashing('치약충전6호','치약',46,14,25,2,'T405'),
  mkWashing('염모제 충전1호','1제 (염모제)',28,22,75,3,'M101'),
  mkWashing('직선14호','샴푸/바디워시',9,6,40,1,'P214'),
])washing[w.line]=w;

/* ───────── 시작 ───────── */
fs.mkdirSync(OUT,{recursive:true});
const {browser,be}=await launch();
const state=await be.call(HOST,'/api/state',{method:'POST',body:{waiting,washing,records:buildRecords()}});
if(!state.ok)throw new Error('샘플 데이터 저장 실패');
const s=await session(browser,be,'wash',OUT,{initScript:()=>{try{sessionStorage.setItem('zeniel_dash_auth_v1','ok');}catch(e){}}});
const {p,sleep}=s;
if(FAKE){await s.ctx.clock.install({time:new Date(NOW)});console.log('(업무시간대가 아니라 브라우저 시계를 '+new Date(NOW).toTimeString().slice(0,5)+' 로 맞춤)');}
await s.sample(true);

/* 공통 도우미 */
const waitSplash=async(page)=>{await page.waitForSelector('#splashScreen',{state:'detached',timeout:8000}).catch(()=>{});};
const show=async(tag,title,sub,narrow=false)=>{await s.cap(tag,title,sub);await p.evaluate(n=>{const e=document.getElementById('zcap2');if(e)e.style.maxWidth=n?'380px':'';},narrow);await s.sample(true);};
const smoothTo=(sel,y)=>p.evaluate(([sel,y])=>{const e=sel?document.querySelector(sel):window;e.scrollTo({top:y,behavior:'smooth'});},[sel,y]);
const scrollTop=(y)=>p.evaluate(y=>window.scrollTo({top:y,behavior:'smooth'}),y);
const txt=(sel)=>p.locator(sel).first().innerText();
const sh=(t)=>s.shot(t);
const keepFor=async(ms,t0)=>{const left=ms-(Date.now()-t0);if(left>0)await sleep(left);};

/* 시계 보정이 필요하면 time 입력 문자열(12시간제)을 계산 */
const to12=(ms)=>{const d=new Date(ms);const h=d.getHours();return {hh:pad(h%12===0?12:h%12),mm:pad(d.getMinutes()),ap:h>=12?'P':'A'};};

/* ═════════ 장면 1 — 생산라인: 도착 등록 ═════════ */
await s.open(WORKER,300);await waitSplash(p);await sleep(300);
let eTimeLabel='';
await show(TAG,'생산라인은 라인만 고르면 끝 — 도착 등록','호퍼·탱크를 세척실에 놓고 점도·필요시간만 입력하면 도착 시각이 자동 기록됩니다');
await s.scene('arrival',9,async()=>{
  await sleep(700);
  await s.click(p.locator('.login-btn',{hasText:'생산라인 및 설비'}),900);
  await sh('1a_arrival_screen');
  await s.click('#groupFilterArrival .group-chip[data-grp="염모제"]',700);
  await s.click(p.locator('#lineGridArrival .line-card',{hasText:'염모제 충전3호'}),700);
  await show(TAG,'점도 분류 + 필요 시간 입력','"몇 시까지 세척 완료" — 수기 인계장에 적던 시각을 그대로 디지털로',true);
  s.toast('NEW','필요 시간 직접 입력 — 우선순위 계산의 기준이 됩니다',4200);
  // 필요시간: 지금 + 135분 으로 직접 입력
  const want=NOW+135*MIN;const t=to12(want);eTimeLabel=t.hh+':'+t.mm+' '+t.ap+'M';
  await p.locator('#arrivalRequiredTime').focus();await sleep(300);
  await p.keyboard.type(t.hh+t.mm+t.ap,{delay:130});await sleep(400);
  await s.click('#arrivalProductType',250);
  await p.selectOption('#arrivalProductType','C4|1제 (염모제)');await sleep(600);
  await s.type('#arrivalItem','M312',80);
  await sh('1b_modal_filled');
  await p.locator('#modalArrival .modal').evaluate(e=>e.scrollTo({top:9999,behavior:'smooth'}));await sleep(600);
  await s.click('#modalArrival .btn-arrival',500);
  await show(TAG,'도착 등록 완료 — 세척실에 바로 알림','자주 쓰는 라인에 자동 등록 · 서버에 저장되어 모든 기기가 공유');
  await sh('1c_registered');
},{hold:true});

/* ═════════ 장면 2 — 세척실: 우선순위 ═════════ */
await show(TAG,'세척실 — 우선순위가 자동으로 정렬','필요시간 − 예상 세척시간 − 점도별 버퍼 = 시작해야 할 시각');
await s.scene('priority',8,async()=>{
  await s.click('.logout-btn',700);
  await s.click(p.locator('.login-btn',{hasText:'세척실'}),1100);
  await sh('2a_washroom_home');
  s.toast('AUTO','방금 등록한 건이 세척실 화면에 바로 도착 — 대기·세척중·완료를 한눈에',4200);
  await sleep(1200);
  await s.click('nav.tabs button[data-tab="priority"]',900);
  await sh('2b_priority');
  s.toast('점수','HIGH·MEDIUM·LOW 로 자동 분류 — 시작 필요 시각이 임박한 순서',4200);
  await sleep(1800);
},{hold:true});

/* ═════════ 장면 3 — 세척실: 시작 · 종료 기록 ═════════ */
await show(TAG,'세척 시작·종료는 두 번의 터치','대기시간·세척시간·지연/여유(분)를 앱이 자동 계산해 기록합니다');
let startMsg='',endMsg='';
await s.scene('startend',9,async()=>{
  await s.click('nav.tabs button[data-tab="home"]',700);
  await s.click('#homeSummaryRow .summary-card[data-filter="waiting"]',900);
  await sh('3a_waiting_panel');
  await s.click('#filterPanelBody .filter-item',900);                       // 최우선 건
  await sh('3b_start_modal');
  s.toast('AUTO','도착 후 대기시간 · 시작 권장 시각까지 자동 계산해서 보여줍니다',4200);
  await sleep(1200);
  await s.click('#modalStart .btn-start',500);
  startMsg=await txt('#toast');await sh('3c_started');
  await s.click('#homeSummaryRow .summary-card[data-filter="waiting"]',200).catch(()=>{});
  await p.evaluate(()=>clearHomeFilter());await sleep(400);
  await s.click(p.locator('#activeLines .line-card',{hasText:'치약충전6호'}),900);
  await sh('3d_running');
  await s.click('#runActionButtons .btn-stop',500);
  endMsg=await txt('#toast');await sh('3e_finished');
  s.toast('NEW','종료하면 지연/여유가 기록에 남고 관리자 대시보드로 즉시 전송',4200);
},{hold:true});
console.log('  앱 토스트:',startMsg,'|',endMsg);
await sleep(1500);                                                           // 마지막 저장(push) 확정
const srv=await be.call(HOST,'/api/state');
console.log('  서버 상태: 대기',Object.keys(srv.data.waiting).length,'세척중',Object.keys(srv.data.washing).length,'기록',srv.data.records.length);

/* 다른 태블릿(보이지 않는 두 번째 브라우저) — 대시보드를 보는 동안 실제 앱으로 도착 등록 */
const ctx2=await browser.newContext({viewport:{width:1440,height:900}});
await ctx2.route(/^https:\/\//,be.handler);
if(FAKE)await ctx2.clock.install({time:new Date(NOW+2*60000)});
const p2=await ctx2.newPage();
await p2.goto(WORKER);await waitSplash(p2);
await p2.locator('.login-btn',{hasText:'생산라인 및 설비'}).click();await sleep(500);
const otherTablet=async()=>{
  await p2.locator('#searchArrival').fill('세정 자동 2');await sleep(200);
  await p2.locator('#lineGridArrival .line-card',{hasText:'세정 자동 2호'}).click();await sleep(300);
  const w=new Date((FAKE?NOW+2*MIN:Date.now())+50*MIN);
  await p2.locator('#arrivalRequiredTime').fill(pad(w.getHours())+':'+pad(w.getMinutes()));
  await p2.selectOption('#arrivalProductType',{index:1});
  await p2.locator('#arrivalItem').fill('S207');
  await p2.locator('#modalArrival .btn-arrival').click();
  await sleep(1200);
};

/* ═════════ 장면 4 — 관리자 대시보드: 자동 반영 ═════════ */
await p.goto(DASH);await waitSplash(p);await sleep(700);
const num=async(id)=>parseInt(await txt('#'+id),10);
let before=await num('countWait');
await show(TAG,'관리자 — 현장 입력이 자동으로 반영','로그인 없이 5초마다 서버를 조회 · 새로고침 불필요');
await s.scene('dash-live',9,async()=>{
  await sh('4a_dash_top');
  s.toast('AUTO','작업자 앱의 입력 → 서버 → 관리자 화면까지 5초 안에 자동 반영',4200);
  await sleep(2200);
  const done=otherTablet();                                                  // 다른 태블릿에서 도착 등록
  let after=before;const t0=Date.now();
  while(Date.now()-t0<8000){after=await num('countWait');if(after!==before)break;await sleep(250);}
  await done;
  console.log('  대기 중',before,'→',after);
  if(after!==before)s.toast('NEW','다른 태블릿에서 도착 등록 → 대기 중 '+before+'건 → '+after+'건 자동 갱신',4200);
  await sh('4b_dash_updated');
  await sleep(600);
},{hold:true});

/* ═════════ 장면 5 — 대시보드: 지표 · 차트 · 기록 ═════════ */
const kpi={wait:await txt('#kpiAvgWait'),wash:await txt('#kpiAvgWash'),loss:await txt('#kpiTotalWait'),ontime:await txt('#kpiOnTimeRate'),
  done:await txt('#countDone'),washing:await txt('#countWashing'),high:await txt('#countHigh')};
console.log('  KPI',JSON.stringify(kpi));
await show(TAG,'핵심 지표와 차트가 실시간으로 채워집니다','대기시간·세척시간·대기 LOSS·필요시간 준수율 — 도착~종료 기록에서 자동 집계');
await s.scene('dash-charts',8,async()=>{
  await scrollTop(250);await sleep(1400);await sh('5a_kpi');
  s.toast('점수','필요시간 준수율 '+kpi.ontime+' · 평균 세척 '+kpi.wash+'분 · 평균 대기 '+kpi.wait+'분',4200);
  const y=await p.evaluate(()=>document.querySelector('.charts-section').getBoundingClientRect().top+scrollY-20);
  await scrollTop(y);await sleep(1800);await sh('5b_charts');
  await scrollTop(y+330);await sleep(1800);await sh('5c_charts2');
},{hold:true});

await show(TAG,'우선순위 표 · 오늘 완료 기록','HIGH 는 시작 필요 시각이 지난 건 — 지연/여유(분)까지 기록으로 남습니다');
await s.scene('dash-tables',6,async()=>{
  const y=await p.evaluate(()=>document.querySelector('.table-wrap').getBoundingClientRect().top+scrollY-20);
  await scrollTop(y);await sleep(1800);await sh('6a_table');
  await scrollTop(y+520);await sleep(1800);await sh('6b_records');
},{hold:true});

await s.finish();
await ctx2.close();await browser.close();
console.log('완료 →',path.join(OUT,'seg_wash.webm'));
process.exit(0);
