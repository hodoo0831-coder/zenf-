/**
 * 세이프보이스 구간 녹화 — 작업자(신고 → 내 신고) + 관리자(접수함·QR 공고문·내보내기)
 *
 *   node video/scenes/safevoice.mjs <출력폴더>   →  <출력폴더>/seg_safevoice.webm + seg_safevoice.json
 *   SHOTS=<폴더> 를 주면 장면마다 스크린샷(s.shot)을 저장한다.
 *
 * 정직성 원칙
 *  - 서버는 실제 netlify/functions/report.mjs 핸들러를 그대로 호출한다. 바뀐 것은 @netlify/blobs 의
 *    getStore 한 줄(메모리 스텁)뿐이며, 변환본은 메모리(data: URL)에서만 만들고 원본 파일은 건드리지 않는다.
 *  - 앱(ZEN_SafeVoice.html)은 가상 주소(https://safevoice.example.com)에서 열어 /api/report 가 핸들러로 가게 한다.
 *  - 샘플 신고 7건은 작업자 POST(+관리자 update)로 핸들러에 넣는다(화면 DOM 에 값을 쓰지 않는다).
 *    서버 접수 시각만 "하루 이틀 전"으로 보이도록 시연 중 Date 를 앞당겨서 넣었다.
 *  - 영상 중 작업자 화면에서 직접 입력·제출하는 1건은 화면 조작 그대로 실제 API 로 들어간다.
 *  - 관리자 PIN 은 화면에 입력하지 않는다. 앱의 정상 경로(localStorage 'sv_admin_pin' → route() →
 *    unlockTry(pin(),true) → 서버가 x-sv-pin 검증)를 그대로 타도록 /admin 페이지에서만 initScript 로 저장해 둔다.
 */
import fs from 'fs';
import path from 'path';
import {launch,session,ROOT} from '../lib.mjs';

const OUT=path.resolve(process.argv[2]||path.join(ROOT,'video','out'));
const ORIGIN='https://safevoice.example.com';          // 가상 주소(예약 도메인) — 화면 QR 공고문에 찍히는 주소
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
  try{sessionStorage.setItem('sv_splash','1');}catch(e){}                      // 스플래시는 첫 방문에 한 번만 — 영상에선 생략
  if(/^\\/admin/.test(location.pathname)){
    try{localStorage.setItem('sv_admin_pin',${JSON.stringify(PIN)});}catch(e){} // 관리자 PIN 저장값(앱의 정상 경로로 접수함 진입)
    var st=document.createElement('style');st.textContent='#pin-card{display:none!important}'; // 로딩 중 PIN 안내 카드가 번쩍이지 않게
    (document.head||document.documentElement).appendChild(st);
  }
})();`;
const s=await session(browser,be,'safevoice',OUT,{initScript});
const {p,sleep}=s;
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

/* ───────── 4) 조작 도구 ───────── */
const TAG='SYSTEM 01 · 안전';
const L=(x)=>typeof x==='string'?p.locator(x).first():x;
const focusEl=async(loc,block='center')=>{await L(loc).evaluate((e,b)=>e.scrollIntoView({block:b,behavior:'smooth'}),block);await sleep(520);};
const tap=async(loc,pause=600,block)=>{await focusEl(loc,block);return s.click(loc,pause);};
const typeIn=async(loc,text,delay=55)=>{await focusEl(loc);await s.type(loc,text,delay);};
/** 네이티브 select: 커서로 눌러 보이고 값 선택 */
const pick=async(sel,value,pause=550)=>{const l=p.locator(sel);await focusEl(l);await s.click(l,200);await p.keyboard.press('Escape').catch(()=>{});
  await p.selectOption(sel,value);await sleep(pause);};
const nudge=async()=>{await p.mouse.move(720,420,{steps:4});};
const txt=async(sel)=>(await p.locator(sel).first().innerText()).trim();

/* ───────── 5) 작업자 화면 ───────── */
await s.open(ORIGIN+'/report',500);
await s.sample(true);
await s.cap(TAG,'작업자 — 위험 신고 30초 접수','4대 실천 분류 · 제목 · 구역 → 세부 위치 · 긴급도 · 상세 · 사진(선택) · 이름');
await s.scene('worker-form',9,async()=>{
  await sleep(500);
  await s.shot('01_form_top');
  await tap(p.locator('#chips-cat button',{hasText:'젠프'}).first(),450,'center');
  await typeIn('#in-title','통로 적재물 충돌 위험',50);
  await s.toast('NEW','구역 → 세부 위치 2단계 선택 · QR 로 들어오면 위치가 자동 입력',4200);
  await pick('#sel-area','생산동',350);
  await pick('#sel-loc','포장재창고',350);
  await s.shot('02_loc');
  await typeIn('#in-content','포장재 파렛트가 통로로 튀어나와 지게차와 부딪힐 위험이 있습니다.',22);
  await tap(p.locator('#sev-grid button[data-v="긴급"]'),450);
  await s.shot('03_sev');
  await typeIn('#in-name','작업자 A',60);
  await s.shot('04_name');
},{hold:true});

await s.scene('worker-submit',6,async()=>{
  await s.cap(TAG,'제출하면 바로 접수번호 발급','오프라인이면 기기에 임시 저장 후 연결되면 자동 전송');
  await tap(p.locator('#btn-submit'),300);
  await p.waitForSelector('#view-done',{state:'visible',timeout:6000});
  await sleep(900);
  await s.shot('05_done');
  const rid=(await txt('#done-rid'));
  await s.toast('AUTO',rid+' · 관리자 접수함에 즉시 반영',4200);
  await sleep(900);
  await tap(p.locator('#btn-gomine'),500);
  await p.waitForSelector('#mine-list .mycard',{timeout:6000});
  const n=await txt('#mine-count');
  await s.cap(TAG,'내 신고 현황 — '+n,'처리 상태·조치 결과를 신고자도 확인 (개인정보 없이 상태만 조회)');
  await s.shot('06_mine');
},{hold:true});

/* ───────── 6) 관리자 화면 ───────── */
await s.scene('admin-inbox',9,async()=>{
  await tap(p.locator('#rt-admin'),100,'center');
  await p.waitForURL(/\/admin/,{timeout:8000});
  await p.waitForSelector('#inbox-main',{state:'visible',timeout:8000});
  await p.waitForSelector('#rlist .ritem',{timeout:8000});
  await sleep(300);
  await s.sample(true);await nudge();
  const st=async()=>({all:await txt('#st-all'),nw:await txt('#st-new'),wk:await txt('#st-work'),dn:await txt('#st-done')});
  const a=await st();
  await s.cap(TAG,'관리자 — 접수함 한눈에',`전체 ${a.all}건 · 접수 ${a.nw} · 진행중 ${a.wk} · 완료 ${a.dn} — 방금 제출한 신고가 맨 위`);
  await s.toast('LIVE','작업자 제출이 새로고침 없이 접수함 맨 위로',4200);
  await s.shot('07_inbox');
  await sleep(1300);
  // 맨 위(방금 제출한 신고) 열기
  const top=p.locator('#rlist .ritem').first();
  await tap(top.locator('.rhead'),700,'start');
  await s.cap(TAG,'상태 · 조치 결과 · 메모','선택한 조치 결과와 메모는 신고자의 “내 신고”에 그대로 표시');
  await s.shot('08_open');
  await tap(top.locator('.chips.rslt button',{hasText:'보수·발주 진행'}),500);
  await typeIn(top.locator('.memo-row textarea'),'지게차 통로 구획선 재도색 예정',50);
  await tap(top.locator('.memo-row button'),600);
  await s.shot('09_memo');
  await tap(top.locator('.stbtns button',{hasText:'진행중'}),900,'center');   // 상태 변경 → 목록 갱신
  const b=await st();
  await s.cap(TAG,'상태 변경 즉시 집계 반영',`접수 ${a.nw}→${b.nw} · 진행중 ${a.wk}→${b.wk} · 완료 ${b.dn}`);
  await s.shot('10_status');
},{hold:true});

await s.scene('admin-export',5,async()=>{
  await p.evaluate(()=>window.scrollTo({top:0,behavior:'smooth'}));await sleep(700);
  await s.cap(TAG,'엑셀 · PPT · PDF 로 바로 보고','필터한 목록 그대로 내보내기 — 사진은 PPT·PDF 에 포함');
  await s.toast('EXPORT','신고내역 엑셀 · 보고용 PPT · 인쇄용 PDF',4200);
  await tap(p.locator('#btn-xlsx'),900,'center');
  await s.shot('11_xlsx');
  await tap(p.locator('#view-toggle button[data-v="digest"]'),800,'center');
  await s.cap(TAG,'일괄 정리 — 상태별로 묶어 한 번에','회의·보고용으로 접수 → 진행중 → 완료 순으로 정렬');
  await p.evaluate(()=>window.scrollBy({top:420,behavior:'smooth'}));
  await sleep(900);
  await s.shot('12_digest');
},{hold:true});

await s.scene('admin-poster',5,async()=>{
  await p.evaluate(()=>window.scrollTo({top:0,behavior:'smooth'}));await sleep(500);
  await s.cap(TAG,'QR 공고문 — 위치별로 자동 생성','QR 을 찍으면 해당 위치가 신고 폼에 자동 입력');
  await tap(p.locator('#tab-btn-poster'),500,'center');
  await typeIn('#adm-locs','생산동 · 치약 라인\n생산동 · 포장재창고',35);
  await tap(p.locator('#btn-gen'),700,'center');
  await p.evaluate(()=>document.querySelector('#posters').scrollIntoView({block:'start',behavior:'smooth'}));
  await sleep(800);
  await s.shot('13_poster');
},{hold:true});

/* ───────── 7) 다시 작업자 — 관리자 처리 결과가 내 신고에 ───────── */
await s.scene('worker-loop',4,async()=>{
  await p.evaluate(()=>window.scrollTo({top:0,behavior:'smooth'}));await sleep(500);
  await tap(p.locator('#rt-worker'),100,'center');
  await p.waitForSelector('#tb-mine',{state:'visible',timeout:8000});
  await sleep(300);
  await s.sample(true);await nudge();
  await s.cap(TAG,'처리 결과가 신고자에게 돌아옵니다','관리자가 바꾼 상태·조치 결과·메모가 작업자 “내 신고”에 반영');
  await tap(p.locator('#tb-mine'),400,'center');
  await p.waitForFunction(()=>/진행중/.test(document.querySelector('#mine-list')?.innerText||''),null,{timeout:6000}).catch(()=>{});
  await sleep(300);
  await s.shot('14_loop');
},{hold:true});

await s.finish();
await browser.close();
process.exit(0);
