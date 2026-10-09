/**
 * 세이프보이스 구간 녹화 — 작업자(신고 → 내 신고) + 관리자(접수함·QR 공고문·내보내기)
 *
 *   node video/scenes/safevoice.mjs <출력폴더>   →  <출력폴더>/seg_safevoice.webm + seg_safevoice.json
 *   SHOTS=<폴더> 를 주면 장면마다 스크린샷(s.shot)을 저장한다.
 *
 * 정직성 원칙
 *  - 서버는 실제 netlify/functions/report.mjs 핸들러를 그대로 호출한다. 바뀐 것은 @netlify/blobs 의
 *    getStore 한 줄(메모리 스텁)뿐이며, 변환본은 메모리(data: URL)에서만 만들고 원본 파일은 건드리지 않는다.
 *  - 앱(ZEN_SafeVoice.html)은 가상 주소(https://zen-ap-manufacturing.netlify.app)에서 열어 /api/report 가 핸들러로 가게 한다.
 *  - 샘플 신고 7건은 작업자 POST(+관리자 update)로 핸들러에 넣는다(화면 DOM 에 값을 쓰지 않는다).
 *    서버 접수 시각만 "하루 이틀 전"으로 보이도록 시연 중 Date 를 앞당겨서 넣었다.
 *  - 영상 중 작업자 화면에서 직접 입력·제출하는 1건은 화면 조작 그대로 실제 API 로 들어간다.
 *  - 관리자 PIN 은 화면에 입력하지 않는다. 앱의 정상 경로(localStorage 'sv_admin_pin' → route() →
 *    unlockTry(pin(),true) → 서버가 x-sv-pin 검증)를 그대로 타도록 /admin 페이지에서만 initScript 로 저장해 둔다.
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import {launch,session,ROOT} from '../lib.mjs';

const OUT=path.resolve(process.argv[2]||path.join(ROOT,'video','out'));
const ORIGIN='https://zen-ap-manufacturing.netlify.app';          // 가상 주소(예약 도메인) — 화면 QR 공고문에 찍히는 주소
const PIN=process.env.ADMIN_PIN||'1234';

/* ───────── 1) 실제 report.mjs 핸들러 불러오기(@netlify/blobs 만 메모리 스텁으로) ───────── */
const STUB=`
const __mem=new Map();
const getStore=()=>({
  async get(k,o){ if(!__mem.has(k)) return null; const v=__mem.get(k); return (o&&o.type==='json')?JSON.parse(v):v; },
  async set(k,v){ __mem.set(k,String(v)); },
  async setJSON(k,v){ __mem.set(k,JSON.stringify(v)); },
  async list(o){ const p=(o&&o.prefix)||''; return {blobs:[...__mem.keys()].filter(k=>k.startsWith(p)).sort().map(key=>({key}))}; },
});`;
async function loadHandler(){
  const src=fs.readFileSync(path.join(ROOT,'netlify/functions/report.mjs'),'utf8');
  const re=/import\s*\{\s*getStore\s*\}\s*from\s*["']@netlify\/blobs["'];?/;
  if(!re.test(src))throw new Error('report.mjs 의 @netlify/blobs import 형태가 바뀌었다 — 스텁 치환을 고쳐야 한다');
  const code=src.replace(re,STUB);
  const mod=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
  return mod.default;
}
const handler=await loadHandler();
const call=async(method,pathname,{pin,body}={})=>{
  const headers={'content-type':'application/json'};if(pin)headers['x-sv-pin']=pin;
  const res=await handler(new Request(ORIGIN+pathname,{method,headers,body:body?JSON.stringify(body):undefined}));
  return res.json();
};
/** 샘플을 "과거에 접수된 것"으로 보이게: 핸들러가 부르는 new Date()/Date.now() 만 잠시 ms 로 고정 */
async function atTime(ms,fn){
  const R=Date;
  globalThis.Date=class extends R{constructor(...a){a.length?super(...a):super(ms);} static now(){return ms;}};
  try{return await fn();}finally{globalThis.Date=R;}
}

/* ───────── 2) 시연용 샘플 신고 7건 (접수 3 · 진행중 2 · 완료 2) ───────── */
const H=3600e3;
const SAMPLES=[
  // 오래된 것부터 넣는다(서버 접수 시각이 곧 정렬 기준)
  {ago:70,id:'SV-261005-P7M2',type:'위험 신고',category:'젠프 · 안전',title:'주차장 출구 시야 가림',location:'외곽·기타 · 주차장',severity:'낮음',
   content:'출구 우측 적재함 때문에 나오는 차량이 잘 보이지 않습니다.',reporter:'작업자 G',status:'완료',result:'기준·표준 반영',memo:'반사경 설치 완료, 적재 위치 표준화'},
  {ago:50,id:'SV-261006-X4Q8',type:'위험 신고',category:'젠프 · 안전',title:'상하차장 바닥 기름 누유',location:'생산동 · 상하차장',severity:'긴급',
   content:'지게차 진입로 바닥에 기름이 번져 미끄러질 위험이 큽니다.',reporter:'작업자 C',status:'완료',result:'즉시 조치 완료',memo:'흡착포 처리, 누유 지점 점검 완료'},
  {ago:40,id:'SV-261006-T9B1',type:'위험 신고',category:'젠그린 · 환경',title:'폐기물 보관소 덮개 파손',location:'외부 작업장 · 폐기물 보관소',severity:'높음',
   content:'덮개가 깨져 비가 들어가면 침출수가 넘칠 수 있습니다.',reporter:'작업자 F',status:'진행중',result:'보수·발주 진행',memo:'덮개 자재 발주 완료'},
  {ago:30,id:'SV-261006-L2D6',type:'위험 신고',category:'젠프 · 안전',title:'3번 라인 계단 난간 흔들림',location:'생산동 · 통로·계단',severity:'높음',
   content:'계단 난간이 흔들려서 잡고 내려가기 불안합니다.',reporter:'작업자 B',status:'진행중',result:'보수·발주 진행',memo:'용접 보수 일정 협의 중'},
  {ago:20,id:'SV-261007-N5W3',type:'개선 제안',category:'젠클린 · 2S',title:'포장재창고 앞 미끄럼 방지 매트',location:'생산동 · 포장재창고',severity:'-',
   content:'출입구 앞 바닥이 자주 젖어 있습니다. 미끄럼 방지 매트를 깔면 좋겠습니다.',reporter:'작업자 D'},
  {ago:12,id:'SV-261007-C8J4',type:'위험 신고',category:'젠큐 · 품질',title:'세척실 건조대 이물 낙하 우려',location:'세척실 · 건조·보관 구역',severity:'보통',
   content:'건조대 상단 덮개가 헐거워 이물이 떨어질 수 있습니다.',reporter:'작업자 E'},
  {ago:6,id:'SV-261007-R1V9',type:'위험 신고',category:'젠프 · 안전',title:'튜브 라인 비상정지 스위치 접근 불편',location:'생산동 · 튜브 라인',severity:'긴급',
   content:'비상정지 스위치 앞에 자재가 쌓여 즉시 누르기 어렵습니다.',reporter:'작업자 H'},
];
async function seed(){
  const now=Date.now();
  for(const x of SAMPLES){
    const t=now-x.ago*H;
    await atTime(t,async()=>{
      const r=await call('POST','/api/report',{body:{report_id:x.id,type:x.type,category:x.category,title:x.title,site:'제니엘',
        location:x.location,severity:x.severity,content:x.content,reporter:x.reporter,contact:'-',
        submitted_at:new Date(t).toLocaleString('ko-KR'),photo:''}});
      if(!r.ok)throw new Error('샘플 접수 실패 '+JSON.stringify(r));
    });
    if(x.status){
      await atTime(t+2*H,async()=>{
        const r=await call('POST','/api/report',{pin:PIN,body:{action:'update',id:x.id,status:x.status,result:x.result,memo:x.memo}});
        if(!r.ok)throw new Error('샘플 상태 변경 실패 '+JSON.stringify(r));
      });
    }
  }
}
await seed();
{const r=await call('GET','/api/report',{pin:PIN});console.log('샘플 신고',r.reports.length,'건 입력 (핸들러 응답)');}

/* ───────── 3) 브라우저 · 가상 주소 라우트 ───────── */
const {browser,be}=await launch();
const initScript=`(function(){
  // init script 는 문서가 만들어지기 전에 돌아 documentElement 가 아직 없다 → 생기는 즉시 <style> 을 넣는다
  var css=function(t){var add=function(){var st=document.createElement('style');st.textContent=t;(document.head||document.documentElement).appendChild(st);};
    if(document.documentElement)add();else{var mo=new MutationObserver(function(){if(document.documentElement){mo.disconnect();add();}});mo.observe(document,{childList:true});}};
  try{sessionStorage.setItem('sv_splash','1');}catch(e){}                       // 스플래시는 첫 방문에 한 번만 — 영상에선 생략
  if(/^\\/admin/.test(location.pathname)){
    try{localStorage.setItem('sv_admin_pin',${JSON.stringify(PIN)});}catch(e){}  // 관리자 PIN 저장값(앱의 정상 경로로 접수함 진입)
    css('#pin-card{display:none!important}');                                    // 로딩 중 PIN 안내 카드가 번쩍이지 않게
  }else{
    css('#zcap2{max-width:340px}');                                              // 자막이 모바일 폭 입력 열(가운데)을 가리지 않게 좁힌다
  }
})();`;
const WORK=fs.mkdtempSync(path.join(os.tmpdir(),'sv-rec-'));   // 녹화는 전용 임시 폴더에서 하고 끝나면 출력 폴더로 복사(다른 구간 파일과 섞이지 않게)
const s=await session(browser,be,'safevoice',WORK,{initScript});
const {p,sleep}=s;
const V0=Date.now();const elapsed=()=>(Date.now()-V0)/1000;   // 서버가 바쁠 때 녹화가 늘어지지 않게, 선택 동작은 일정보다 늦으면 건너뛴다
const HTML=fs.readFileSync(path.join(ROOT,'ZEN_SafeVoice.html'));
await s.ctx.route(new RegExp('^'+ORIGIN.replace(/[.]/g,'\\.')+'/'),async route=>{
  const req=route.request();const u=new URL(req.url());
  try{
    if(u.pathname==='/api/report'){
      const h={...req.headers()};delete h['content-length'];delete h['host'];
      const res=await handler(new Request(req.url(),{method:req.method(),headers:h,
        body:['GET','HEAD'].includes(req.method())?undefined:(req.postDataBuffer()||undefined)}));
      return route.fulfill({status:res.status,headers:Object.fromEntries(res.headers),body:Buffer.from(await res.arrayBuffer())});
    }
    if(u.pathname.startsWith('/vendor/')){
      const f=path.join(ROOT,'vendor',path.basename(u.pathname));
      if(fs.existsSync(f))return route.fulfill({status:200,contentType:'text/javascript; charset=utf-8',body:fs.readFileSync(f)});
    }
    if(['/','/report','/admin','/admin/','/ZEN_SafeVoice.html'].includes(u.pathname))
      return route.fulfill({status:200,contentType:'text/html; charset=utf-8',body:HTML});
    return route.fulfill({status:404,body:''});
  }catch(e){return route.fulfill({status:500,contentType:'application/json',body:JSON.stringify({ok:false,error:String(e)})});}
});

/* ───────── 4) 조작 도구 (lib.click 의 20단계 커서 이동은 녹화 중 너무 느려 가볍게 다시 구현) ───────── */
const TAG='SYSTEM 01 · 안전';
const B=(sec)=>process.env.NOPAD?0:sec;   // NOPAD=1 이면 장면 길이를 채우지 않고 동작 자체의 소요 시간만 잰다
const L=(x)=>typeof x==='string'?p.locator(x).first():x;
/** 이미 화면 가운데 영역에 있으면 가만히 두고, 아니면 부드럽게 스크롤 */
const focusEl=async(loc,block='center')=>{
  const need=await L(loc).evaluate((e,b)=>{const r=e.getBoundingClientRect();const ok=r.top>120&&r.bottom<660&&b==='center';
    if(!ok)e.scrollIntoView({block:b,behavior:'smooth'});return !ok;},block);
  if(need)await sleep(360);};
/** 부드럽게 스크롤 → 커서가 걸어가 → 누른다 */
const tap=async(loc,pause=350,block='center')=>{const l=L(loc);await focusEl(l,block);const bb=await l.boundingBox();if(!bb)return false;
  await p.mouse.move(bb.x+bb.width/2,bb.y+bb.height/2,{steps:5});await sleep(70);await p.mouse.down();await sleep(50);await p.mouse.up();await sleep(pause);return true;};
const typeIn=async(loc,text,delay=40)=>{await tap(loc,60);await p.keyboard.type(text,{delay});await sleep(150);};
/** 네이티브 select: 커서로 눌러 보이고 값 선택 */
const pick=async(sel,value,pause=250)=>{await tap(sel,80);await p.keyboard.press('Escape').catch(()=>{});await p.selectOption(sel,value);await sleep(pause);};
const nudge=async()=>{await p.mouse.move(700,430,{steps:4});};
const txt=async(sel)=>(await p.locator(sel).first().innerText()).trim();
const toTop=async()=>{await p.evaluate(()=>window.scrollTo({top:0,behavior:'smooth'}));await sleep(450);};

/* ───────── 5) 작업자 화면 ───────── */
await s.open(ORIGIN+'/report',350);
await s.sample(true);
await s.cap(TAG,'작업자 — 위험 신고','분류 · 제목 · 구역→세부 위치 · 긴급도 · 사진 · 이름');
await s.scene('worker-form',B(7.2),async()=>{
  await s.shot('01_form_top');
  await tap(p.locator('#chips-cat button',{hasText:'젠프'}).first(),250);
  await typeIn('#in-title','통로 적재물 충돌 위험',35);
  await s.toast('NEW','구역 → 세부 위치 2단계 선택 · QR 로 들어오면 위치 자동 입력',4200);
  await pick('#sel-area','생산동',200);
  await pick('#sel-loc','포장재창고',200);
  await s.shot('02_loc');
  await typeIn('#in-content','파렛트가 통로로 튀어나와 충돌 위험이 있어요.',16);
  await tap(p.locator('#sev-grid button[data-v="긴급"]'),250);
  await s.shot('03_sev');
  await s.toast('OPT','사진 첨부는 선택 — 있으면 조치가 훨씬 빨라요',3600);
  await typeIn('#in-name','작업자 A',40);
  await s.shot('04_name');
},{hold:true});

await s.scene('worker-submit',B(4.4),async()=>{
  await s.cap(TAG,'제출 즉시 접수번호 발급','오프라인이면 기기에 임시 저장 후 자동 전송');
  await tap(p.locator('#btn-submit'),150);
  await p.waitForSelector('#view-done',{state:'visible',timeout:6000});
  await sleep(500);
  await s.shot('05_done');
  const rid=(await txt('#done-rid'));
  await s.toast('AUTO',rid+' · 관리자 접수함에 바로 도착',3600);
  await sleep(700);
  await tap(p.locator('#btn-gomine'),250);
  await p.waitForSelector('#mine-list .mycard',{timeout:6000});
  const n=await txt('#mine-count');
  await s.cap(TAG,'내 신고 현황 — '+n,'처리 상태·조치 결과를 신고자도 확인 (상태만 조회)');
  await s.shot('06_mine');
},{hold:true});

/* ───────── 6) 관리자 화면 ───────── */
await s.scene('admin-inbox',B(7.8),async()=>{
  await tap(p.locator('#rt-admin'),60);
  await p.waitForURL(/\/admin/,{timeout:8000});
  await p.waitForSelector('#inbox-main',{state:'visible',timeout:8000});
  await p.waitForSelector('#rlist .ritem',{timeout:8000});
  await s.sample(true);await nudge();
  const st=async()=>({all:await txt('#st-all'),nw:await txt('#st-new'),wk:await txt('#st-work'),dn:await txt('#st-done')});
  const a=await st();
  await s.cap(TAG,'관리자 — 접수함 한눈에',`전체 ${a.all}건 · 접수 ${a.nw} · 진행중 ${a.wk} · 완료 ${a.dn} — 방금 제출한 신고가 맨 위`);
  await s.toast('NEW','긴급도·분류·구역별 색 표시 — 방금 제출한 신고가 맨 위에 도착',3800);
  await s.shot('07_inbox');
  await sleep(500);
  const top=p.locator('#rlist .ritem').first();
  await tap(top.locator('.rhead'),450,'start');
  await s.cap(TAG,'상태 · 조치 결과 · 메모','선택한 조치 결과와 메모는 신고자의 “내 신고”에도 표시');
  await s.shot('08_open');
  await tap(top.locator('.chips.rslt button',{hasText:'보수·발주 진행'}),250);
  await typeIn(top.locator('.memo-row textarea'),'구획선 재도색 예정',35);
  await tap(top.locator('.memo-row button'),350);
  await s.shot('09_memo');
  await tap(top.locator('.stbtns button',{hasText:'진행중'}),600);   // 상태 변경 → 목록 갱신
  const b=await st();
  await s.cap(TAG,'상태를 바꾸면 집계도 바로 갱신',`접수 ${a.nw}→${b.nw} · 진행중 ${a.wk}→${b.wk} · 완료 ${b.dn}`);
  await s.shot('10_status');
},{hold:true});

await s.scene('admin-export',B(3.8),async()=>{
  await toTop();
  await s.cap(TAG,'엑셀 · PPT · PDF 로 바로 보고','필터한 목록 그대로 내보내기 — 사진은 PPT·PDF 에 포함');
  await s.toast('EXPORT','신고내역 엑셀 · 보고용 PPT · 인쇄용 PDF 한 번에',3600);
  await tap(p.locator('#btn-xlsx'),700);
  await s.shot('11_xlsx');
  if(elapsed()<23.5){
    await tap(p.locator('#view-toggle button[data-v="digest"]'),500);
    await s.cap(TAG,'일괄 정리 — 상태별로 묶어 보기','회의·보고용으로 접수 → 진행중 → 완료 순');
    await p.evaluate(()=>window.scrollBy({top:380,behavior:'smooth'}));
    await sleep(700);
  }else console.log('  (늦어서 일괄 정리 장면 생략)');
  await s.shot('12_digest');
},{hold:true});

await s.scene('admin-poster',B(4.2),async()=>{
  await toTop();
  await s.cap(TAG,'QR 공고문 — 위치별 자동 생성','QR 을 찍으면 해당 위치가 신고 폼에 자동 입력');
  await p.evaluate(()=>{const e=document.getElementById('zcap2');if(e){e.style.left='auto';e.style.right='46px';}});   // 공고문은 왼쪽에 생기므로 자막을 오른쪽 아래로
  await tap(p.locator('#tab-btn-poster'),250);
  await typeIn('#adm-locs',elapsed()<26?'생산동 · 치약 라인\n생산동 · 포장재창고':'생산동 · 포장재창고',22);
  await tap(p.locator('#btn-gen'),450);
  await p.evaluate(()=>document.querySelector('#posters').scrollIntoView({block:'start',behavior:'smooth'}));
  await sleep(700);
  await s.shot('13_poster');
},{hold:true});

/* ───────── 7) 다시 작업자 — 관리자 처리 결과가 내 신고에 ───────── */
await s.scene('worker-loop',B(3.2),async()=>{
  await toTop();
  await tap(p.locator('#rt-worker'),60);
  await p.waitForSelector('#tb-mine',{state:'visible',timeout:8000});
  await s.sample(true);await nudge();
  await s.cap(TAG,'처리 결과가 신고자에게 돌아옵니다','관리자가 바꾼 상태·조치 결과·메모가 “내 신고”에 반영');
  await tap(p.locator('#tb-mine'),250);
  await p.waitForFunction(()=>/진행중/.test(document.querySelector('#mine-list')?.innerText||''),null,{timeout:6000}).catch(()=>{});
  await sleep(300);
  await s.shot('14_loop');
},{hold:true});

/* lib.finish() 는 페이지 이동(작업자↔관리자) 뒤 p.video().path() 가 실제 파일과 달라 실패한다 → 폴더의 webm 을 직접 찾는다 */
await s.ctx.close();
const findVids=()=>fs.readdirSync(WORK).filter(f=>/\.webm$/.test(f)).map(f=>path.join(WORK,f));
let vids=findVids();
for(let i=0;i<40&&vids.length!==1;i++){await new Promise(r=>setTimeout(r,250));vids=findVids();}   // 영상 파일이 디스크에 완성될 때까지 기다린다
if(vids.length!==1)throw new Error('녹화 파일을 찾지 못함: '+vids.join(','));
fs.mkdirSync(OUT,{recursive:true});
const dest=path.join(OUT,'seg_safevoice.webm');
fs.copyFileSync(vids[0],dest);
fs.writeFileSync(dest.replace(/\.webm$/,'.json'),JSON.stringify(s.marks,null,1));
fs.rmSync(WORK,{recursive:true,force:true});
console.log('저장 →',dest);
await browser.close();
process.exit(0);
