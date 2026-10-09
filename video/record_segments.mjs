/**
 * 데모 영상용 구간 녹화 — 1440x900, 자막 박스(태그·제목·부제) 포함. 소리 없음.
 *
 *   node video/record_segments.mjs <platform|safevoice|warehouse|all> [출력 폴더]
 *   LIVE=1 …   실시간 연동(workers.dev)을 막지 않는다 — 인터넷이 되는 PC 에서 쓰면 "연결됨" 화면이 찍힌다
 *
 * 구간마다 <출력 폴더>/seg_<이름>.webm 과 .json(장면 시작/끝 초) 을 만든다.
 * 이어 붙이기는 ffmpeg 로 별도 처리(video/README.md).
 */
const PIN=process.env.ZEN_PIN||'';   // 로그인 PIN — 소스에 적지 않는다: ZEN_PIN=… node …
import {chromium} from 'playwright';
import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';
const HERE=path.dirname(fileURLToPath(import.meta.url));
const ROOT=path.join(HERE,'..');
const WHICH=process.argv[2]||'all';
const OUTD=path.resolve(process.argv[3]||path.join(HERE,'out'));
const LIVE=!!process.env.LIVE;
fs.mkdirSync(OUTD,{recursive:true});

const browser=await chromium.launch({executablePath:process.env.CHROMIUM||'/opt/pw-browsers/chromium',args:['--disable-background-timer-throttling','--disable-renderer-backgrounding']});

const CAP_JS=()=>{
  const boot=()=>{
    if(document.getElementById('zcap2'))return;
    const css=document.createElement('style');
    css.textContent=
     '#zcap2{position:fixed;left:46px;bottom:46px;z-index:2147483000;max-width:760px;display:none;font-family:"NanumGothicEmbedded","Noto Sans CJK KR","Nanum Gothic","Malgun Gothic",sans-serif;pointer-events:none}'
    +'#zcap2 .t{display:inline-block;background:linear-gradient(90deg,#1769e0,#10a37f);color:#fff;font:800 13px/1 "NanumGothicEmbedded","Noto Sans CJK KR",sans-serif;letter-spacing:.14em;padding:8px 14px;border-radius:4px 4px 0 0}'
    +'#zcap2 .b{display:block;background:#0b1624;border-radius:0 12px 12px 12px;padding:16px 24px 17px;box-shadow:0 14px 36px rgba(0,0,0,.28)}'
    +'#zcap2 .h{color:#fff;font:800 28px/1.25 "NanumGothicEmbedded","Noto Sans CJK KR",sans-serif;word-break:keep-all}'
    +'#zcap2 .s{color:#7cc4ff;font:700 15px/1.4 "NanumGothicEmbedded","Noto Sans CJK KR",sans-serif;margin-top:6px;word-break:keep-all}'
    +'#zcur{position:fixed;z-index:2147483001;width:24px;height:24px;margin:-12px 0 0 -12px;border:2px solid #0f2438;background:rgba(255,255,255,.88);border-radius:50%;pointer-events:none;left:-60px;top:-60px;transition:transform .12s}'
    +'#zcur.dn{transform:scale(.6);background:rgba(15,36,56,.5)}';
    document.head.appendChild(css);
    const c=document.createElement('div');c.id='zcap2';document.body.appendChild(c);
    const k=document.createElement('div');k.id='zcur';document.body.appendChild(k);
    addEventListener('mousemove',ev=>{k.style.left=ev.clientX+'px';k.style.top=ev.clientY+'px';},true);
    addEventListener('mousedown',()=>k.classList.add('dn'),true);addEventListener('mouseup',()=>k.classList.remove('dn'),true);
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
};

async function session(name,{url,initScript}={}){
  const ctx=await browser.newContext({viewport:{width:1440,height:900},recordVideo:{dir:OUTD,size:{width:1440,height:900}}});
  if(!LIVE)await ctx.route('https://**',r=>r.abort('failed'));
  const p=await ctx.newPage();const t0=Date.now();const marks=[];
  await p.addInitScript(CAP_JS);
  if(initScript)await p.addInitScript(initScript);
  const sleep=(ms)=>p.waitForTimeout(ms);
  const api={p,sleep,marks,
    async open(u){await p.goto(u);await sleep(1200);},
    async cap(tag,title,sub){await p.evaluate(([a,b,c])=>{const e=document.getElementById('zcap2');if(!e)return;e.innerHTML='<span class="t">'+a+'</span><span class="b"><div class="h">'+b+'</div><div class="s">'+c+'</div></span>';e.style.display='block';},[tag,title,sub]);},
    async hide(){await p.evaluate(()=>{const e=document.getElementById('zcap2');if(e)e.style.display='none';});},
    async move(x,y){await p.mouse.move(x,y,{steps:20});},
    async click(loc,pause=700){const l=typeof loc==='string'?p.locator(loc).first():loc;
      try{await l.scrollIntoViewIfNeeded({timeout:2500});const bb=await l.boundingBox();if(!bb)return false;
        await api.move(bb.x+bb.width/2,bb.y+bb.height/2);await sleep(150);await p.mouse.down();await sleep(80);await p.mouse.up();await sleep(pause);return true;}
      catch(e){console.log('  (클릭 건너뜀)',String(e).split('\n')[0].slice(0,90));return false;}},
    async glide(ms,sel){/* 본문을 천천히 내렸다 올린다 */
      const info=await p.evaluate((sel)=>{let e=sel?document.querySelector(sel):document.getElementById('view');while(e&&e!==document.body){const o=getComputedStyle(e).overflowY;if((o==='auto'||o==='scroll')&&e.scrollHeight>e.clientHeight+20)break;e=e.parentElement;}
        if(!e||e===document.body)e=document.scrollingElement;window.__zs=e;return{max:e.scrollHeight-e.clientHeight};},sel||null);
      if(info.max<30){await sleep(ms);return;}
      const n=Math.max(6,Math.round(ms/300));
      for(let i=1;i<=n;i++){await p.evaluate(([i,n])=>{const e=window.__zs;e.scrollTo({top:(e.scrollHeight-e.clientHeight)*0.45*Math.min(1,i/(n*0.8)),behavior:'smooth'});},[i,n]);await sleep(ms/n);}
    },
    /* 장면: 목표 시간(초)에 맞춰 동작 뒤를 채운다 */
    async scene(label,secs,fn,{hold=false}={}){
      const a=Date.now();marks.push({label,start:(a-t0)/1000});console.log(((a-t0)/1000).toFixed(1)+'s '+label);
      try{await fn();}catch(e){console.log('  장면 오류',String(e).split('\n')[0].slice(0,100));}
      const left=secs*1000-(Date.now()-a);if(left>0){if(hold)await sleep(left);else await api.glide(left);}
      marks[marks.length-1].end=(Date.now()-t0)/1000;
    },
    async finish(){const v=p.video();await ctx.close();const f=path.join(OUTD,'seg_'+name+'.webm');fs.copyFileSync(await v.path(),f);fs.unlinkSync(await v.path());
      fs.writeFileSync(f.replace(/\.webm$/,'.json'),JSON.stringify(marks,null,1));console.log('저장 →',f);}
  };
  return api;
}

/* ───── 플랫폼 ───── */
async function platform(){
  const s=await session('platform');const {p,sleep}=s;
  await s.open('file://'+path.join(ROOT,'index.html'));await sleep(800);
  const top=()=>p.evaluate(()=>{let e=document.getElementById('view');while(e&&e!==document.body){const o=getComputedStyle(e).overflowY;if((o==='auto'||o==='scroll')&&e.scrollHeight>e.clientHeight+20)break;e=e.parentElement;}
    (e&&e!==document.body?e:document.scrollingElement).scrollTo(0,0);});
  /* 내장 앱이 불러오며 포커스를 가져가 화면을 아래로 끌어내리므로, 이동 뒤 맨 위로 되돌린다 */
  const goV=async(id)=>{await p.evaluate(x=>go(x),id);await sleep(600);for(let i=0;i<3;i++){await top();await sleep(500);}};
  const tab=async(v,t)=>{await p.evaluate(([v,t])=>setVtab(v,t),[v,t]);await sleep(600);};
  const btn=(t,sc='#view')=>p.locator(sc+' button',{hasText:t}).first();
  await s.cap('ACCESS','역할 기반 접속','현장 · 관리자 · 센터 — 역할에 따라 화면과 권한이 나뉩니다');
  await s.scene('login',9,async()=>{
    await sleep(1800);
    for(const r of ['현장','관리자','센터'])await s.click(p.locator('.roles button',{hasText:r}).first(),600);
    const pin=p.locator('input[type=password]').first();await s.click(pin,200);await p.keyboard.type(PIN,{delay:200});await sleep(250);await p.keyboard.press('Enter');await sleep(2200);
  },{hold:true});
  await s.cap('CONTROL TOWER','컨트롤타워 — 현황을 한 화면에','계획·예측 → 현황·실측 → 판단·조치 → 보고, 메뉴 순서가 곧 업무 순서');
  await s.scene('home',8,async()=>{await goV('home');});
  await s.cap('AGENT · 계획','인력 부족·여유 자동 계산','계획량 ÷ 인력 주간 캐파 → 그룹별 부하율 · 필요 인원 · 재배치 추천');
  await s.scene('forecast',9,async()=>{await goV('forecast');await sleep(1200);await tab('forecast','load');});
  await s.cap('AGENT · 세척','세척 우선순위 자동 추천','제품·색상 전환 40% · 세척주기 35% · 생산부하 25% — 점수로 배차');
  await s.scene('clean',7,async()=>{await goV('clean');},{hold:true});
  await s.cap('AGENT · 간접작업','오리콘 · P-BOX 실적 통합관리','현장 모바일 입력 → 5초 자동 집계 · 편차 자동 감지');
  await s.scene('indirect',6,async()=>{await goV('orikonwash');},{hold:true});
  await s.cap('AGENT · 창고','구역별 적치 · 포화 예측','현장 입력 앱의 실측 12구역 → 권장 입고·재배치');
  await s.scene('stock',6,async()=>{await goV('stock');},{hold:true});
  await s.cap('AGENT · 분석·보고','월 마감 자동 분석','매출·물량·단가·증감과 이상치를 자동 분석 → 경영 보고서');
  await s.scene('insight',5,async()=>{await goV('insight');},{hold:true});
  await s.cap('ROLE','역할 전환','현장은 필요한 것만, 센터는 전체를 봅니다');
  await s.scene('role',5,async()=>{const rb=p.locator('[onclick^="switchRole"]');const n=await rb.count();
    await s.click(rb.first(),1500);await s.click(p.locator('[onclick^="switchRole"]').nth(n-1),1200);await goV('home');},{hold:true});
  await s.cap('AI 판단·조치','실측 → 기준 대조 → 판단 → 조치','담당자·기한 지정 · 조건이 풀려야 효과 확인 · 3회 반복 시 근본 원인 조치로');
  await s.scene('track',9,async()=>{await goV('track');await sleep(1200);await s.click(btn('미조치'),1300);await s.click(btn('전체'),500);});
  await s.cap('판단 기준 · 성과','코드화된 판단 룰 32개 전체 공개','지금 발동 중인 룰은 실시간으로 표시됩니다');
  await s.scene('judge',8,async()=>{await goV('judge');await sleep(900);await s.click(btn('안전'),1200);await s.click(btn('전체'),400);});
  await s.cap('실시간 연동','실적 · 세척 · 기상 · 적치 — 60초마다 갱신','서버가 끊기면 기준값을 유지하고, 실측인지 기준값인지 화면에 표시');
  await s.scene('data',6,async()=>{await goV('data');});
  await s.finish();
}

/* ───── 세이프보이스 ───── */
async function safevoice(){
  const s=await session('safevoice');const {p,sleep}=s;
  await s.open('file://'+path.join(ROOT,'ZEN_SafeVoice.html'));await sleep(500);
  await s.cap('SYSTEM 01 · 안전','세이프보이스 — 위험 신고 · 개선 제안','작업자는 30초 접수 · 관리자는 접수함에서 일괄 정리');
  await s.scene('sv',10,async()=>{
    await sleep(900);
    await s.click(p.locator('button',{hasText:'젠프 · 안전'}).first(),500);
    await s.click('#in-title',200);await p.keyboard.type('통로 적재물 충돌 위험',{delay:90});
    await s.click('#sel-area',300);
    await p.selectOption('#sel-area',{index:1}).catch(()=>{});await sleep(500);
    await p.selectOption('#sel-loc',{index:1}).catch(()=>{});await sleep(500);
    await s.click(p.locator('button',{hasText:'긴급'}).first(),500);
  },{hold:true});
  await s.finish();
}

/* ───── 창고 적치 ───── */
async function warehouse(){
  const s=await session('warehouse',{initScript:()=>{try{sessionStorage.setItem('zen_wh_admin_auth','1');}catch(e){}}});const {p,sleep}=s;
  const cfg=fs.readFileSync(path.join(ROOT,'wh-stack/config.js'),'utf8');
  await s.open('file://'+path.join(ROOT,'wh-stack/worker.html'));await sleep(500);
  await s.cap('SYSTEM 03 · 창고','포장재 창고 적치 — 현장 입력','12개 구역을 탭하면 바로 입력 · 입력하면 관리자 화면에 자동 반영');
  await s.scene('wh-worker',6,async()=>{
    await sleep(700);await s.click(p.locator('button',{hasText:'HnB동 1층'}).first(),900);
    await s.click(p.locator('button',{hasText:'현황'}).first(),700);
  },{hold:true});
  await s.open('file://'+path.join(ROOT,'wh-stack/admin.html'));await sleep(2500);
  await s.cap('SYSTEM 03 · 창고','관리자 — 구역별 적치율 · 배치도','초과 구역 자동 판정 · 사업장 배치도 위에 이동 경로까지');
  await s.scene('wh-admin',7,async()=>{await s.click(p.locator('button',{hasText:'배치도'}).first(),1200);},{hold:true});
  await s.finish();
}

const jobs={platform,safevoice,warehouse};
for(const k of (WHICH==='all'?Object.keys(jobs):[WHICH]))await jobs[k]();
await browser.close();
