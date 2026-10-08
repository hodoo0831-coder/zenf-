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
  const st=document.createElement('style');
  st.textContent='#splash{display:none!important}';                        // 스플래시는 영상에서 생략
  (document.head||document.documentElement).appendChild(st);
};

const {browser,be}=await launch();
await seed(be);
const s=await session(browser,be,'warehouse',OUT,{initScript:INIT});
const {p,sleep}=s;
const file=f=>'file://'+path.join(ROOT,'wh-stack',f);

await s.open(file('worker.html'),1500);
await s.sample(true);

/* ───────── 1. 작업자 앱 : 구역 목록 ───────── */
await s.cap('SYSTEM · 창고','현장 작업자 — 구역별 적치 입력','폰·태블릿에서 12개 구역 카드를 눌러 파렛트 수를 입력');
await s.scene('작업자 구역 목록',4,async()=>{
  await s.shot('01_list');
},{hold:false});

await s.finish();
await browser.close();
