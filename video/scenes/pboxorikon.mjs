/**
 * 데모 영상 구간 — 간접작업(P-BOX · 오리콘): 현장 작업자 모바일 입력 → 5초 주기로 관리자 대시보드 자동 집계
 *
 *   node video/scenes/pboxorikon.mjs <출력폴더>   → <출력폴더>/seg_pboxorikon.webm + seg_pboxorikon.json  (장면 34~35초 + 앞뒤 여유 약 1초)
 *   SHOTS=<폴더> …        장면마다 스크린샷 저장(켜면 동작이 느려져 영상 길이가 늘어난다 — 확인용)
 *   SEED_ONLY=1 …         샘플 데이터만 만들어 앱의 이상 감지 규칙으로 미리 계산해 출력하고 끝낸다
 *   DEBUG_T=1 …           클릭마다 걸린 시간 출력
 *
 * 장면: ① P-BOX 작업자 앱 입력(8초) ② 관리자 "오늘" 집계 + 다른 기기 입력 자동 반영(8초) ③ 작업자별 시간당 생산성 ④ 평균 대비 편차·이상 감지
 *       ⑤ 주간계획 대비 실적 ⑥ 오리콘 작업자 앱 입력 ⑦ 오리콘 관리자 작업자 분석
 *
 * 정직성 원칙
 *  - 값은 전부 실제 앱 · 실제 Worker 코드(pbox-orikon-db)로 만든다. DOM 을 고쳐 쓰지 않는다.
 *    · 작업자 앱 화면에서 직접 입력하는 건: P-BOX 1건(공동작업 2명), 오리콘 1건, 그리고 "다른 기기"(별도 브라우저 컨텍스트, 화면엔 안 나옴)의 작업자 앱에서 1건.
 *    · 과거 약 2주치(P-BOX·오리콘 각 40여 건)는 시연용 샘플 — 작업자 앱이 보내는 것과 같은 필드로 be.call('/records') 에 넣는다.
 *    · 이번 주 소요량(주간계획)은 앱이 읽는 저장 키(zenf_plan_*)에 미리 둔다 — 앱의 "소요량 입력" 이 저장하는 자리와 같다.
 *  - 자막의 수치는 화면에서 읽어 온 값(DOM 텍스트)으로 만든다. 하드코딩하지 않는다.
 *  - 작업자 이름은 익명("작업자 A" …). 암호·PIN 입력 화면 없음(이 앱들엔 암호 게이트가 없다).
 *  - 앱 코드·lib.mjs 는 건드리지 않는다. 영상용 보정은 initScript 의 스타일뿐: 스플래시 숨김, 관리자 첫 조회 전 0 값 깜빡임 가림, 자막 폭/위치 변형.
 *
 * 알려진 앱 이슈(영상엔 영향 없게 피했지만 고쳐야 함): worker-site/orikon 은 서버로 보낼 때 part: record.part 를 쓰는데
 *   기록의 필드는 boxType 이라 박스 종류(中/大)가 서버에 null 로 저장된다 → 관리자 오리콘 화면에서 그 건은 中/大 집계에서 빠진다.
 */
import path from 'path';
import fs from 'fs';
import {fileURLToPath} from 'url';
import {launch,session,ROOT} from '../lib.mjs';

process.env.TZ='UTC';   // 브라우저 시계 = UTC — 앱이 보이는 '오늘'·등록 시각(UTC 표기)과 샘플 날짜를 일치시킨다
const OUT=path.resolve(process.argv[2]||path.join(path.dirname(fileURLToPath(import.meta.url)),'..','out'));
const HOST='pbox-orikon-db.hodoo0831.workers.dev';
const SYS=path.join(ROOT,'pbox-orikon-system');
const url=f=>'file://'+path.join(SYS,f);
const W_PBOX=url('worker-site/pbox/index.html'), W_ORI=url('worker-site/orikon/index.html');
const A_PBOX=url('admin-site/pbox/index.html'),  A_ORI=url('admin-site/orikon/index.html');

/* ───────────────── 날짜 도우미 (UTC) ───────────────── */
const ymd=d=>d.toISOString().slice(0,10);
const todayD=new Date(ymd(new Date())+'T00:00:00Z');
const addDays=(d,n)=>new Date(d.getTime()+n*864e5);
const TODAY=ymd(todayD);
const mondayOf=d=>addDays(d,-((d.getUTCDay()+6)%7));
const MON=mondayOf(todayD);

/* ───────────────── 시연용 샘플 데이터 ─────────────────
   작업자 앱이 POST /records 로 보내는 것과 같은 필드. 과거 15일 중 일요일 제외(약 2주치).
   · 하루 PLT·인원·시간은 현실적 범위(하루 합계 5~7 PLT, 1인 시간당 0.2~0.3 PLT 안팎)
   · 이상치: 설비 점검으로 거의 못 한 날 1건(급감) + 긴급 오더로 공동작업이 몰린 날 1건(급증) */
function rng(seed){let x=seed>>>0;return()=>{x=(Math.imul(x,1664525)+1013904223)>>>0;return x/4294967296;};}
const r1=v=>Math.round(v*10)/10, half=v=>Math.round(v*2)/2;
function hoursOf(s,e){const f=t=>+t.slice(0,2)*60+ +t.slice(3);return (f(e)-f(s))/60;}

function rec(sys,seq,date,worker,part,type,qtyPlt,ratio,{s='08:30',e='17:30',memo=null,unit='PLT'}={}){
  const wc=worker.split('+').length;
  const ea=Math.round(qtyPlt*ratio);
  return {
    id:(sys==='P-BOX'?'pbox_s':'oricon_s')+String(seq).padStart(3,'0'),
    system:sys,date,worker,worker_count:wc,part,work_type:type,
    qty_plt:unit==='EA'?+(ea/ratio).toFixed(3):qtyPlt, qty_ea:ea, input_unit:unit,
    start_time:s,end_time:e,man_hour:hoursOf(s,e)*wc,memo,
    created_at:`${date}T${e}:00.000Z`,
  };
}

function seedPbox(){
  const R=rng(20261008), out=[]; let seq=1;
  const days=[];for(let i=15;i>=1;i--){const d=addDays(todayD,-i);if(d.getUTCDay()!==0)days.push(d);}
  const lowDay=days[days.length-8], surgeDay=days[days.length-5], jointDay2=days[days.length-10];
  days.forEach((d,k)=>{
    const date=ymd(d), dow=d.getUTCDay(), sat=dow===6;
    const pick=(a,b)=>R()<.5?a:b;
    const q=(base,spread)=>half(base+R()*spread);
    const mk=(w,part,type,qty,o)=>{
      let unit='PLT'; if(R()<.22&&qty>=1){unit='EA';qty=Math.round(qty*90/15)*15/90;}   // 일부는 EA 단위로 입력된 건
      out.push(rec('P-BOX',seq++,date,w,part,type,qty,90,{...o,unit}));
    };
    if(date===ymd(lowDay)){            // 설비 점검 — 급감
      mk('작업자 A','커버','세척',2,{});
      mk('작업자 B','박스','세척',1,{memo:'컨베이어 점검으로 중단'});
      return;
    }
    if(date===ymd(surgeDay)){          // 긴급 오더 — 공동작업 몰림 (급증)
      mk('작업자 A+작업자 B','커버','세척',4.5,{memo:'긴급 오더 대응'});
      mk('작업자 C+작업자 D','박스','세척',3.5,{memo:'긴급 오더 대응'});
      mk('작업자 A','박스','간지',pick(1,1.5),{});
      mk('작업자 C','커버','세척',2,{});
      return;
    }
    mk('작업자 A',pick('커버','박스'),R()<.8?'세척':'간지',sat?q(2,.5):q(2,.5),sat?{e:'13:30'}:{});
    mk('작업자 B',pick('박스','커버'),R()<.75?'세척':'간지',sat?q(1.5,.5):q(1.5,.5),sat?{e:'13:30'}:(R()<.3?{e:'16:30'}:{}));
    if(sat||R()<.75)mk('작업자 C','커버','세척',sat?q(1,.5):q(1.5,.8),sat?{e:'13:30'}:{});
    if(!sat&&R()<.45)mk('작업자 D','박스',pick('세척','간지'),q(1,.5),{e:'12:30'});
    if(date===ymd(jointDay2))mk('작업자 A+작업자 B','커버','세척',3,{});
  });
  return out;
}
function seedOri(){
  const R=rng(777), out=[]; let seq=1;
  const days=[];for(let i=15;i>=1;i--){const d=addDays(todayD,-i);if(d.getUTCDay()!==0)days.push(d);}
  const lowDay=days[days.length-6];
  days.forEach(d=>{
    const date=ymd(d), sat=d.getUTCDay()===6, q=(b,s)=>half(b+R()*s);
    const mk=(w,part,type,qty,o)=>{let unit='PLT';if(R()<.2&&qty>=1){unit='EA';qty=Math.round(qty*120/30)*30/120;}
      out.push(rec('오리콘',seq++,date,w,part,type,qty,120,{...o,unit}));};
    if(date===ymd(lowDay)){mk('작업자 E','中','분류',1,{memo:'원박스 입고 지연'});mk('작업자 F','大','세척',0.5,{memo:'원박스 입고 지연'});return;}
    mk('작업자 E',R()<.6?'中':'大',R()<.7?'세척':'분류',q(2,.5),sat?{e:'13:30'}:{});
    mk('작업자 F',R()<.5?'大':'中',R()<.6?'세척':'분류',sat?q(1.5,.5):q(1.5,.8),sat?{e:'13:30'}:{});
    if(sat||R()<.7)mk('작업자 G','中',R()<.5?'분류':'세척',sat?q(1,.5):q(1.5,.7),sat?{e:'13:30'}:{});
    if(!sat&&R()<.3)mk('작업자 H','大','수리',q(.5,.5),{e:'14:30'});
    if(!sat&&R()<.22)mk('작업자 E+작업자 F','中','분류',q(3,.5),{});
  });
  return out;
}
async function seed(be,list){for(const r of list){const x=await be.call(HOST,'/records',{method:'POST',body:r});if(!x.ok)throw new Error('샘플 저장 실패 '+JSON.stringify(x));}}

/* 이번 주 소요량(EA) — 과거 요일은 샘플 실적에 견주어 달성 100% / 80%대 / 미달이 섞이게 */
function planFor(list,ratio,sys){
  const byDay={};list.filter(r=>r.system===sys).forEach(r=>{byDay[r.date]=(byDay[r.date]||0)+r.qty_ea;});
  const plan={};const f=[1.0,1.12,.92];
  for(let i=0;i<7;i++){
    const d=addDays(MON,i),k=ymd(d);
    if(d.getUTCDay()===0)continue;
    if(byDay[k]){plan[k]=Math.round(byDay[k]/f[i%3]/10)*10;}
    else if(d.getUTCDay()===6)plan[k]=Math.round(3*ratio/10)*10;
    else plan[k]=Math.round(7*ratio/10)*10;
  }
  return plan;
}

/* ───────────────── 앱 화면 위에 얹는 보정 (앱 코드는 건드리지 않는다) ───────────────── */
const INIT=(planP,planO)=>{
  try{
    if(/admin-site/.test(location.pathname)){
      const ori=/admin-site\/orikon\//.test(location.pathname);
      const k=ori?'zenf_plan_오리콘박스':'zenf_plan_P-BOX', v=ori?planO:planP;
      if(!localStorage.getItem(k))localStorage.setItem(k,JSON.stringify(v));
    }
  }catch(e){}
  const adm=/admin-site/.test(location.pathname);
  const CSS='.splash,#splash{display:none!important}'
    +(adm?'html.zwait body{visibility:hidden}':'')
    +'#zcap2.nar{max-width:410px!important}#zcap2.rt{left:auto!important;right:46px!important}';
  const inject=()=>{
    if(document.getElementById('zx-style'))return true;
    const host=document.head||document.documentElement;if(!host)return false;
    const st=document.createElement('style');st.id='zx-style';st.textContent=CSS;host.appendChild(st);return true;
  };
  if(!inject()){const mo=new MutationObserver(()=>{if(inject())mo.disconnect();});mo.observe(document,{childList:true,subtree:true});}
  if(adm){
    const done=()=>{if(document.documentElement)document.documentElement.classList.remove('zwait');};
    const arm=()=>{if(!document.documentElement)return false;document.documentElement.classList.add('zwait');return true;};
    if(!arm()){const mo3=new MutationObserver(()=>{if(arm())mo3.disconnect();});mo3.observe(document,{childList:true});}
    const mo2=new MutationObserver(()=>{const e=document.getElementById('cloudStatus');if(e&&/실시간/.test(e.textContent)){done();mo2.disconnect();}});
    mo2.observe(document,{childList:true,subtree:true,characterData:true});
    setTimeout(done,2500);
  }
};

/* ───────────────── 실행 ───────────────── */
const {browser,be}=await launch();
const sampleP=seedPbox(), sampleO=seedOri();
await seed(be,sampleP);await seed(be,sampleO);
if(process.env.SEED_ONLY){   // 샘플 점검용: 앱의 이상 감지 규칙으로 미리 계산해 본다 (SEED_ONLY=1 node …)
  for(const [nm,L] of [['P-BOX',sampleP],['오리콘',sampleO]]){
    const day={};L.forEach(r=>{day[r.date]=(day[r.date]||0)+r.qty_plt;});
    const v=Object.values(day),avg=v.reduce((a,b)=>a+b,0)/v.length;
    console.log(nm,'건수',L.length,'일수',v.length,'일평균',avg.toFixed(2));
    Object.entries(day).forEach(([d,x])=>{const dl=(x-avg)/avg;console.log(' ',d,x.toFixed(1),(dl*100).toFixed(0)+'%',dl<-.4?'급감':dl>.6?'급증':'');});
    const wd={};L.forEach(r=>{const ws=r.worker.split('+');ws.forEach(w=>{(wd[w]=wd[w]||{})[r.date]=(wd[w][r.date]||0)+r.qty_plt/ws.length;});});
    Object.entries(wd).forEach(([w,m])=>{const a=Object.values(m);if(a.length<5)return;const av=a.reduce((x,y)=>x+y,0)/a.length,sd=Math.sqrt(a.reduce((x,y)=>x+(y-av)**2,0)/a.length);
      Object.entries(m).forEach(([d,x])=>{if(sd&&(x-av)/sd<-1.5)console.log('  개인편차',w,d,x.toFixed(1),'평균',av.toFixed(1));});});
  }
  process.exit(0);
}
const planP=planFor(sampleP,90,'P-BOX'), planO=planFor(sampleO,120,'오리콘');

/* ── 다른 기기(별도 컨텍스트) 의 작업자 앱: 같은 서버로 보낸다. 녹화 시작 전에 미리 열어 둔다 ── */
async function otherDevice(){
  const ctx=await browser.newContext({viewport:{width:390,height:844}});
  if(!process.env.LIVE)await ctx.route(/^https:\/\//,be.handler);
  const q=await ctx.newPage();
  await q.goto(W_PBOX);await q.waitForTimeout(2200);
  await q.fill('#workerName','작업자 A');
  await q.click('.option-btn[data-value="커버"]');await q.click('.option-btn[data-value="간지"]');
  await q.click('#qtyPlus');await q.click('#qtyPlus');   // 1.0 → 2.0 PLT
  return {submit:async()=>{await q.click('#submitBtn');await q.waitForTimeout(600);},close:()=>ctx.close()};
}
const dev2=await otherDevice();

const s=await session(browser,be,'pboxorikon',OUT,{initScript:`(${INIT.toString()})(${JSON.stringify(planP)},${JSON.stringify(planO)})`});
const {p,sleep}=s;

/* ── 도우미 ── */
let cur={x:300,y:300};
const polls=[];p.on('request',r=>{if(/\/records\?system=/.test(r.url()))polls.push(Date.now());});
const txt=(sel)=>p.evaluate(sel=>{const e=document.querySelector(sel);return e?e.textContent.replace(/\s+/g,' ').trim():'';},sel);
const txts=(sel)=>p.evaluate(sel=>[...document.querySelectorAll(sel)].map(e=>e.textContent.replace(/\s+/g,' ').trim()),sel);
async function mv(x,y,steps=14){await p.mouse.move(x,y,{steps});cur={x,y};}
async function clk(loc,{pause=450,steps=14}={}){
  const l=typeof loc==='string'?p.locator(loc).first():loc;
  const bb=await l.boundingBox();if(!bb){console.log('  (클릭 건너뜀: 요소 없음)');return false;}
  const x=bb.x+bb.width/2+(Math.random()*8-4), y=bb.y+bb.height/2+(Math.random()*6-3);
  const t0=Date.now();
  await mv(x,y,steps);await sleep(110);await p.mouse.down();await sleep(70);await p.mouse.up();await sleep(pause);
  if(process.env.DEBUG_T)console.log('    클릭',String(loc).slice(0,40),(Date.now()-t0)+'ms (pause '+pause+')');
  return true;
}
/** 커서를 천천히 흘려 보내며 기다린다 — 정지 화면 방지 */
async function drift(ms,dx=60,dy=40){
  if(ms<=80)return;
  const t0=Date.now(),x0=cur.x,y0=cur.y;
  while(Date.now()-t0<ms){const k=(Date.now()-t0)/ms;await p.mouse.move(x0+dx*Math.sin(k*Math.PI),y0+dy*k);await sleep(70);}
  cur={x:x0,y:y0+dy};
}
async function cap(tag,t,sub,cls=''){await s.cap(tag,t,sub);await p.evaluate(c=>{const e=document.getElementById('zcap2');if(e)e.className=c;},cls);}
async function scrollTo(target,ms=650,offset=8){
  await p.evaluate(([t,off])=>{const y=typeof t==='number'?t:(()=>{const e=document.querySelector(t);return e?e.getBoundingClientRect().top+scrollY-off:0;})();window.scrollTo({top:y,behavior:'smooth'});},[target,offset]);
  await sleep(ms);
}
const open=async(u,wait=400)=>{await s.open(u,wait);await s.sample(true);await p.mouse.move(cur.x+1,cur.y+1);};   // 새 문서엔 커서 점이 없으니 다시 띄운다
const tab=async(id,off=112)=>{await clk(`.tab-btn[data-tab="${id}"]`,{pause:60,steps:12});await p.evaluate(([sel,off])=>{const e=document.querySelector(sel);window.scrollTo({top:e.getBoundingClientRect().top+scrollY-off,behavior:'smooth'});},['#tabBar',off]);};

/* lib 의 finish 는 v.path() 가 실제 파일명과 어긋나는 경우가 있어(다른 컨텍스트를 함께 썼을 때) 직접 마무리한다 */
async function finish(){
  const v=s.p.video();
  await s.ctx.close();
  let src=null;try{src=await v.path();}catch(e){}
  if(!src||!fs.existsSync(src)){   // 파일명이 어긋나면 가장 최근 page@*.webm
    const vids=fs.readdirSync(OUT).filter(f=>/^page@.*\.webm$/.test(f)).map(f=>({f,t:fs.statSync(path.join(OUT,f)).mtimeMs})).sort((a,b)=>b.t-a.t);
    src=path.join(OUT,vids[0].f);
  }
  let sz=-1;for(let i=0;i<40;i++){const n=fs.statSync(src).size;if(n===sz)break;sz=n;await new Promise(r=>setTimeout(r,500));}   // 기록이 끝날 때까지(크기가 안정될 때까지) 기다린다
  const dst=path.join(OUT,'seg_pboxorikon.webm');
  fs.copyFileSync(src,dst);
  for(const f of fs.readdirSync(OUT))if(/^page@.*\.webm$/.test(f))fs.unlinkSync(path.join(OUT,f));
  fs.writeFileSync(dst.replace(/\.webm$/,'.json'),JSON.stringify(s.marks,null,1));
  console.log('저장 →',dst,(fs.statSync(dst).size/1e6).toFixed(1)+'MB');
}

const N={};   // 화면에서 읽은 값(자막용)

/** 장면 — 목표 초에 맞춰 남은 시간은 커서를 천천히 흘리며 채운다(정지 화면 방지). 동작이 더 오래 걸리면 그만큼 길어진다 */
async function sc(label,secs,fn,tail=[40,30]){
  await s.scene(label,secs,async()=>{const end=Date.now()+secs*1000;await fn(end);await drift(end-Date.now(),...tail);await s.shot('end_'+label.replace(/\s+/g,'_'));},{hold:true});
}
const profs=async(root)=>{   // 작업자 카드의 이름·시간당 생산성(PLT/MH)을 화면에서 읽는다
  const names=await txts(root+' .pc-name');
  const prods=await p.evaluate(r=>[...document.querySelectorAll(r+' .profile-card')].map(c=>c.querySelectorAll('.pc-stat-val')[2].textContent.trim()),root);
  return names.map((n,i)=>n.replace('작업자 ','')+' '+prods[i]);
};

/* ───────── 1. P-BOX 작업자 앱 (모바일 레이아웃) ───────── */
await open(W_PBOX,500);
await cap('SYSTEM · 간접작업','현장 작업자는 폰으로 입력','큰 버튼으로 등록 · 이름을 "+" 로 이으면 공동작업','nar');
await sc('P-BOX 작업자 입력',7,async()=>{
  await s.shot('01_worker_start');
  await clk('#workerName',{pause:120,steps:10});
  await p.keyboard.type('작업자 C+작업자 D',75);await sleep(300);
  await s.toast('NEW','"+" 로 이으면 공동작업 · 맨아워 자동 계산',3300);
  await clk('.option-btn[data-value="박스"]',{pause:200,steps:10});
  await clk('.option-btn[data-value="세척"]',{pause:200,steps:10});
  await scrollTo('#qtyField',420,150);
  await clk('#quickQtyPlt button[data-qty="2"]',{pause:300,steps:10});
  await s.shot('02_worker_filled');
  await clk('#submitBtn',{pause:900,steps:10});
  await s.shot('03_worker_done');
  N.workerToast=await txt('#toast');
  await scrollTo(0,450);
  await clk('.tab[data-tab="history"]',{pause:500,steps:12});   // 방금 등록한 건이 기록 목록에 쌓인다
  N.history=await txt('#historyContainer');console.log('  작업자 앱 기록 탭(화면):',N.history.slice(0,90));
  await s.shot('03b_worker_history');
});

/* ───────── 2. P-BOX 관리자 대시보드 : 방금 입력 → 합산 → 다른 기기 입력도 자동 반영 ───────── */
await open(A_PBOX,400);
await cap('SYSTEM · 간접작업','작업자 폰 입력이 대시보드에 바로 합산','서버(D1)를 5초마다 조회 — 새로고침 없이 자동 갱신');
await sc('P-BOX 관리자 실시간 집계',8,async()=>{
  await clk('.period-btn[data-period="today"]',{pause:350,steps:12});
  N.t1={plt:await txt('#kpiPlt'),mh:await txt('#kpiManHour'),info:await txt('#periodInfo')};
  console.log('  오늘(1건):',JSON.stringify(N.t1));
  const short=o=>`${o.info.replace(/^[\d-]+ · /,'오늘 ')} · ${o.plt.replace('PLT',' PLT')} · ${o.mh.replace('MH',' MH')}`;
  await cap('SYSTEM · 간접작업','방금 입력한 건이 "오늘" 집계에 합산',short(N.t1)+' (공동 2명 × 9h)');
  await s.toast('LIVE','서버(D1)를 5초 주기로 자동 조회',2300);
  // 다른 기기에서 "등록 완료" — 다음 서버 조회 직전에 눌러 반영이 곧바로 보이게 한다
  // 서버 조회가 5초 주기이므로, 다음 조회 약 3초 전에 눌러 "1건 → 2건" 이 보이도록 한다(주기를 못 맞춰도 최대 5초 안에 반영)
  const last=polls[polls.length-1]||Date.now();let next=last+5000;if(next<Date.now())next+=5000*Math.ceil((Date.now()-next)/5000);
  const sub=(async()=>{await sleep(Math.max(0,next-Date.now()-3000));await dev2.submit();})();
  await mv(1000,520,24);await drift(1400,-80,30);
  await sub;
  await p.waitForFunction(()=>/2건/.test(document.getElementById('periodInfo').textContent),null,{timeout:8000}).catch(()=>console.log('  (자동 갱신 대기 초과)'));
  N.t2={plt:await txt('#kpiPlt'),mh:await txt('#kpiManHour'),info:await txt('#periodInfo')};
  console.log('  오늘(2건):',JSON.stringify(N.t2));
  await cap('SYSTEM · 간접작업','다른 기기의 입력까지 자동으로 합산',short(N.t2)+' — 새로고침 없이 반영');
  await s.toast('AUTO','다른 기기 입력도 자동 합산',2800);
  await s.shot('05_admin_after_dev2');
  // 합산된 부위·유형 비중 차트까지 천천히 훑어 보이고 다시 맨 위로
  await sleep(500);await scrollTo(330,900);await sleep(900);
  await s.shot('05b_admin_charts');
  await scrollTo(0,700);
},[50,20]);
await dev2.close();

/* ───────── 3. 작업자별 시간당 생산성 ───────── */
await sc('P-BOX 작업자 생산성',3.6,async()=>{
  await clk('.period-btn[data-period="all"]',{pause:150,steps:10});
  await tab('wk');
  N.prof=await profs('#workerProfiles');const days=await txt('#kpiDays');
  console.log('  생산성(화면):',N.prof.join(' · '),'| 작업일수',days);
  await cap('SYSTEM · 간접작업','작업자별 시간당 생산성',`${N.prof.join(' · ')} PLT/MH (전체 기간)`,'rt');
  await s.toast('KPI','PLT ÷ 근무시간(MH) = 시간당 생산성',3000);
  await s.shot('07_admin_workers');
},[0,90]);

/* ───────── 4. 기준 대비 편차 · 이상 감지 ───────── */
await sc('P-BOX 이상 감지',3.4,async()=>{
  await tab('an');
  const items=await txts('#anomalyAlerts .anomaly-item');
  N.an=items;console.log('  이상 감지(화면):',items.length,'건 |',items.join(' // '));
  const first=(items[0]||'').replace(/^\D*(\d{4}-\d\d-\d\d)/,'$1 ');
  await cap('SYSTEM · 간접작업','평균 대비 편차 · 이상 자동 감지',`${items.length}건 표시 — ${first}`.slice(0,96),'rt');
  await s.toast('ALERT','평균 대비 급감·급증 자동 표시',3000);
  await s.shot('08_admin_anomaly');
},[0,60]);

/* ───────── 5. 주간계획 대비 실적 ───────── */
await sc('P-BOX 주간계획',3.4,async()=>{
  await tab('plan',20);
  const gauge=await txt('#planGaugeLabel');N.plan=gauge;console.log('  주간계획(화면):',gauge);
  await cap('SYSTEM · 간접작업','주간계획 대비 실적 자동 집계',gauge.replace(/\s{2,}/g,' ').replace(' · ',' · 실적/소요 '));
  await s.toast('PLAN','소요량 대비 일자별 달성률',3000);
  await s.shot('09_admin_plan');
},[40,70]);

/* ───────── 6. 오리콘 : 작업자 앱 → 관리자 ───────── */
await open(W_ORI,400);
await cap('SYSTEM · 간접작업','오리콘도 같은 방식으로 입력','中·大 박스 · 세척·분류·수리 · 1 PLT = 120 EA','nar');
await sc('오리콘 작업자 입력',3.6,async()=>{
  await clk('#workerName',{pause:100,steps:10});
  await p.keyboard.type('작업자 E',70);await sleep(150);
  await clk('.option-btn[data-value="中"]',{pause:150,steps:10});
  await clk('.option-btn[data-value="분류"]',{pause:150,steps:10});
  await s.shot('10_ori_filled');
  await clk('#submitBtn',{pause:700,steps:10});
  await s.shot('11_ori_done');
});

await open(A_ORI,400);
await cap('SYSTEM · 간접작업','오리콘 관리자 대시보드','');
await sc('오리콘 관리자',2.6,async()=>{
  await tab('wk');
  N.oprof=await profs('#workerProfiles');console.log('  오리콘 생산성(화면):',N.oprof.join(' · '));
  await cap('SYSTEM · 간접작업','오리콘 관리자 — 같은 집계·분석 화면',`작업자별 PLT/MH: ${N.oprof.join(' · ')}`,'rt');
  await s.shot('12_ori_admin');
},[0,70]);

await s.shot('99_end');
await finish();
await browser.close();
console.log('화면에서 읽은 값:',JSON.stringify(N,null,1));
process.exit(0);
