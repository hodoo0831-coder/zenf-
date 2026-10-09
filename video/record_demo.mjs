/**
 * ZEN 데모 영상 자동 녹화 — 나레이션 대본(ZEN_나레이션_대본.md)의 장면 순서대로 화면을 돌며 자막과 함께 .webm 으로 저장한다.
 *
 *   node video/record_demo.mjs [index.html 경로] [출력.webm]
 *   LIVE=1 node video/record_demo.mjs      ← 실시간 연동(workers.dev)을 막지 않고 녹화 — 인터넷이 되는 PC 에서 이걸로 찍을 것
 *   ONLY=2,4,8,10,11,12 node video/record_demo.mjs   ← 번호(0=S1 … 18=S17)로 고른 장면만 녹화. 장면마다 따로 잘라 .clips/ 에 저장(ffmpeg 필요)
 *
 * 필요: playwright (npm i playwright) + Chromium.  CHROMIUM=/경로 로 브라우저 실행 파일 지정 가능.
 * 소리는 들어 있지 않다 — 대본을 읽은 음성을 편집 프로그램에서 얹는다.
 */
const PIN=process.env.ZEN_PIN||'';   // 로그인 PIN — 소스에 적지 않는다: ZEN_PIN=… node …
import {chromium} from 'playwright';
import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';
const HERE=path.dirname(fileURLToPath(import.meta.url));
const FILE=path.resolve(process.argv[2]||path.join(HERE,'..','index.html'));
const OUT=path.resolve(process.argv[3]||path.join(HERE,'ZEN_데모영상_자동.webm'));
const LIVE=!!process.env.LIVE;
const ONLY=process.env.ONLY?new Set(process.env.ONLY.split(',').map(Number)):null;
const SEC_PER_CHAR=+(process.env.SPC||0.12);

const SCENES=[
 ['S1 · 오프닝','데이터가 아니라, 판단을 자동화합니다. AI 에이전트 여덟 개, 코드화된 판단 룰 서른두 개, 실제 연동 시스템 여섯 개. 제니엘 제조사업부 사업3팀, ZEN Manufacturing Platform입니다.'],
 ['S2 · 역할 기반 접속','현장, 관리자, 센터. 역할에 따라 보는 화면과 권한이 나뉩니다.'],
 ['S3 · 컨트롤타워','메뉴가 곧 업무 순서입니다. 계획과 예측, 현황과 실측, 판단과 조치, 그리고 보고. 컨트롤타워는 그중 현황을 한 화면에 모읍니다.'],
 ['S4 · 작업 예측 · AI 판단','핵심은 예측입니다. 내일과 향후를, 코드화된 기준으로 먼저 판단합니다.'],
 ['S5 · 계획 에이전트','부하율은 계획량을 인력 주간 캐파로 나눠 자동 산출합니다. 여섯 개 그룹을 기준 인원과 비교해 부족과 여유를 판정하고, 주간뿐 아니라 날짜별로도 산출합니다.'],
 ['S6 · 세척 에이전트','경험에 의존하던 세척 배차를 점수로 바꿨습니다. 제품·색상 전환 40퍼센트, 세척주기 경과 35퍼센트, 생산부하 25퍼센트로 우선순위를 자동 계산합니다.'],
 ['S7 · 간접작업 에이전트','현장 작업자가 모바일로 실적을 입력하면, 5초 주기로 여러 기기에서 자동 집계됩니다. 작업자별 생산성과 기준 대비 편차를 자동으로 감지해 판단 센터로 올립니다.'],
 ['S8 · 분석·보고 에이전트','월별 정산 엑셀을 올리면 매출·물량·단가·증감과 이상치를 자동으로 분석해, 경영 보고서로 만듭니다. 사람은 취합이 아니라 검토만 하면 됩니다.'],
 ['S9 · 창고 에이전트','포장재 창고는 현장 입력 앱의 실측을 그대로 받아, 구역별 적치 히트맵과 다음 주 포화 예측으로 권장 입고와 재배치를 먼저 제안합니다.'],
 ['S10 · 역할 전환','현장은 필요한 것만, 센터는 전체를 봅니다.'],
 ['S11 · AI 판단·조치','이 모든 판단이 한 곳에 모입니다. 실측에서 기준 대조, 판단, 권장 조치까지. 조치에는 담당자와 기한이 붙고, 조건이 실제로 풀려야 효과 확인으로 바뀝니다. 같은 조건이 세 번 반복되면 근본 원인 조치로 올리라고 알립니다.'],
 ['S11-2 · 판단 기준 · 성과','판단의 근거는 숨기지 않습니다. 코드화된 룰 서른두 개를 전부 화면에 열어두고, 지금 발동 중인 룰은 실시간으로 표시됩니다.'],
 ['S11-3 · 실시간 연동','판단의 입력은 시드 데이터가 아니라 현장 앱의 실측입니다. 간접작업 실적, 세척실 현황, 기상 실황, 창고 적치. 네 가지가 육십 초마다 들어와 판단을 다시 계산하고, 실측인지 기준값인지 화면에 함께 표시합니다.'],
 ['S12 · 실제 배포 시스템','이제 현장이 직접 쓰는, 실제로 배포된 앱들입니다.'],
 ['S13 · 젠키퍼 (안전)','젠키퍼는 현장 작업자용 셀프 점검 앱입니다. TBM 누적시간을 관리하고, 위험을 현장에서 바로 신고합니다. 관리자 콘솔에서는 신고와 TBM이 자동으로 집계됩니다.'],
 ['S14 · 젠프 히트워치 (온열·안전)','히트워치는 공장 위치를 기준으로 체감온도를 산출해, 위험 시 알람을 보냅니다. 입력은 관리자 페이지에서 기록으로 관리되어 보고서까지 한 번에 나옵니다.'],
 ['S15 · 포장재 창고 (앱)','엑셀 한 장이면 구역별 캐파와 적치율을 자동으로 인식합니다. 사업장 배치도 위에 초과 구역을 자동 판정하고, 수기 현황판을 대체합니다.'],
 ['S16 · 월 마감 자동 분석 (앱)','월 마감 엑셀을 올리면 월·라인·브랜드를 자동 인식하고, 히트맵과 워터폴, 드릴다운으로 증감과 이상치를 짚어 보고서를 자동 생성합니다.'],
 ['S17 · 마무리','수기 취합이 아니라, 판단과 조치로. 연간 사백 시간 절감, 수기 취합 90퍼센트 감축, 월 마감 보고서는 다섯 시간에서 5분으로. 감사합니다.'],
];

const browser=await chromium.launch({executablePath:process.env.CHROMIUM||'/opt/pw-browsers/chromium',args:['--disable-background-timer-throttling','--disable-renderer-backgrounding']});
const tmp=fs.mkdtempSync(path.join(HERE,'.rec-'));
const ctx=await browser.newContext({viewport:{width:1280,height:720},recordVideo:{dir:tmp,size:{width:1280,height:720}}});
if(!LIVE)await ctx.route('https://*.workers.dev/**',r=>r.abort('failed'));
const tStart=Date.now();
const p=await ctx.newPage();
const marks=[];
const sleep=(ms)=>p.waitForTimeout(ms);

/* 자막 + 가짜 커서(헤드리스는 커서를 그리지 않는다) */
await p.addInitScript(()=>{
  const boot=()=>{
    if(document.getElementById('zcap'))return;
    const css=document.createElement('style');
    css.textContent='#zcap{position:fixed;left:0;right:0;bottom:0;z-index:2147483000;background:rgba(15,36,56,.94);color:#fff;padding:12px 28px 14px;font:700 21px/1.5 "NanumGothicEmbedded","Nanum Gothic","Malgun Gothic",sans-serif;word-break:keep-all;border-top:2px solid #fff}'
    +'#zcap small{display:block;font:400 13px/1.2 "NanumGothicEmbedded",sans-serif;letter-spacing:.06em;opacity:.7;margin-bottom:3px}'
    +'#zcur{position:fixed;z-index:2147483001;width:22px;height:22px;margin:-11px 0 0 -11px;border:2px solid #0f2438;background:rgba(255,255,255,.85);border-radius:50%;pointer-events:none;left:-50px;top:-50px;transition:transform .12s}'
    +'#zcur.dn{transform:scale(.6);background:rgba(15,36,56,.5)}'
    +'#zend{position:fixed;inset:0;z-index:2147483100;background:#0f2438;color:#fff;display:none;align-items:center;justify-content:center;text-align:center;font:700 34px/1.6 "NanumGothicEmbedded",sans-serif}';
    document.head.appendChild(css);
    const c=document.createElement('div');c.id='zcap';c.style.display='none';document.body.appendChild(c);
    const k=document.createElement('div');k.id='zcur';document.body.appendChild(k);
    const e=document.createElement('div');e.id='zend';document.body.appendChild(e);
    addEventListener('mousemove',ev=>{k.style.left=ev.clientX+'px';k.style.top=ev.clientY+'px';},true);
    addEventListener('mousedown',()=>k.classList.add('dn'),true);addEventListener('mouseup',()=>k.classList.remove('dn'),true);
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
});
const caption=(t,s)=>p.evaluate(([t,s])=>{const c=document.getElementById('zcap');if(!c)return;c.innerHTML='<small>'+t+'</small>'+s;c.style.display='block';},[t,s]);

let mx=640,my=360;
async function moveTo(x,y){await p.mouse.move(x,y,{steps:22});mx=x;my=y;}
async function click(loc,{pause=900}={}){
  const l=typeof loc==='string'?p.locator(loc).first():loc;
  try{await l.scrollIntoViewIfNeeded({timeout:2500});const bb=await l.boundingBox();if(!bb)return false;
    await moveTo(bb.x+bb.width/2,bb.y+bb.height/2);await sleep(180);await p.mouse.down();await sleep(90);await p.mouse.up();await sleep(pause);return true;}
  catch(e){console.log('  (클릭 건너뜀)',String(e).split('\n')[0].slice(0,80));return false;}
}
const goV=async(id)=>{await p.evaluate(x=>go(x),id);await sleep(700);};
const tab=async(v,t)=>{await p.evaluate(([v,t])=>setVtab(v,t),[v,t]);await sleep(700);};
/* 본문을 천천히 훑는다 */
async function glide(ms){
  const info=await p.evaluate(()=>{let e=document.getElementById('view');while(e&&e!==document.body){const o=getComputedStyle(e).overflowY;if((o==='auto'||o==='scroll')&&e.scrollHeight>e.clientHeight+20)break;e=e.parentElement;}
    if(!e||e===document.body){e=document.scrollingElement;}window.__zs=e;return{max:e.scrollHeight-e.clientHeight};});
  if(info.max<30){await sleep(ms);return;}
  const steps=Math.max(8,Math.round(ms/250));
  for(let i=1;i<=steps;i++){await p.evaluate(([i,n])=>{const e=window.__zs;e.scrollTo({top:(e.scrollHeight-e.clientHeight)*i/n,behavior:'smooth'});},[i,steps]);await sleep(ms/steps);}
  await p.evaluate(()=>window.__zs.scrollTo({top:0,behavior:'smooth'}));await sleep(500);
}

await p.goto('file://'+FILE);await sleep(1500);
const t0=Date.now();
async function scene(i,acts,hold){
  if(ONLY&&!ONLY.has(i))return;
  const [t,s]=SCENES[i];const dur=Math.max(4500,s.replace(/\s/g,'').length*SEC_PER_CHAR*1000);
  await caption(t,s);const a=Date.now();marks.push({i,title:t,start:(a-tStart)/1000});
  console.log(((Date.now()-t0)/1000).toFixed(0)+'s '+t);
  try{await acts();}catch(e){console.log('  장면 오류',String(e).split('\n')[0].slice(0,100));}
  const left=dur-(Date.now()-a);if(left>0){if(hold)await sleep(left);else await glide(left);}
  marks[marks.length-1].end=(Date.now()-tStart)/1000;
  if(process.env.SHOTS)await p.screenshot({path:path.join(process.env.SHOTS,'s'+String(i).padStart(2,'0')+'.png')});
}

async function silentLogin(){const pin=p.locator('input[type=password]').first();await pin.fill(PIN);await p.keyboard.press('Enter');await sleep(2500);}
if(ONLY&&!ONLY.has(0)&&!ONLY.has(1)){await silentLogin();await p.evaluate(()=>{const c=document.getElementById('zcap');if(c)c.style.display='block';});}
/* S1 로그인 화면 */
await scene(0,async()=>{await sleep(2500);});
/* S2 역할 */
await scene(1,async()=>{
  for(const r of ['현장','관리자']){await click(p.locator('.roles button',{hasText:r}).first(),{pause:700});}
  await click(p.locator('.roles button',{hasText:'센터'}).first(),{pause:500});
  const pin=p.locator('input[type=password]').first();await click(pin,{pause:200});await p.keyboard.type(PIN,{delay:220});await sleep(300);await p.keyboard.press('Enter');await sleep(2500);
});
await p.evaluate(()=>{const c=document.getElementById('zcap');if(c)c.style.display='block';});
await scene(2,async()=>{await goV('home');await sleep(1200);});
await scene(3,async()=>{await goV('forecast');await sleep(800);await click(p.locator('#view .vtabs button',{hasText:'주간계획'}).first());});
await scene(4,async()=>{await tab('forecast','load');await sleep(800);});
await scene(5,async()=>{await goV('clean');await click(p.locator('#view button',{hasText:'관리자용'}).first());});
await scene(6,async()=>{await goV('orikonwash');await click(p.locator('#view button',{hasText:'오리콘'}).first());await click(p.locator('#view button',{hasText:'P-BOX'}).first());});
await scene(7,async()=>{await goV('reports');await click(p.locator('#view .vtabs button',{hasText:'월마감'}).first());});
await scene(8,async()=>{await goV('stock');await click(p.locator('#view button',{hasText:'관리자용'}).first());});
await scene(9,async()=>{
  const rb=p.locator('[onclick^="switchRole"]');const n=await rb.count();
  await click(rb.first(),{pause:1800});await click(p.locator('[onclick^="switchRole"]').nth(n-1),{pause:1800});
  await goV('home');
});
await scene(10,async()=>{await goV('track');await sleep(1200);await click(p.locator('#view button',{hasText:'미조치'}).first(),{pause:1500});await click(p.locator('#view button',{hasText:'전체'}).first(),{pause:600});});
await scene(11,async()=>{await goV('judge');await sleep(1000);await click(p.locator('#view button',{hasText:'안전'}).first(),{pause:1500});await click(p.locator('#view button',{hasText:'전체'}).first(),{pause:500});});
await scene(12,async()=>{await goV('data');await sleep(800);});
await scene(13,async()=>{await goV('safe');await tab('safe','sys');await sleep(600);});
await scene(14,async()=>{await click(p.locator('#view button',{hasText:'내장'}).nth(2),{pause:1200});},true);
await scene(15,async()=>{await click(p.locator('#view button',{hasText:'내장'}).nth(1),{pause:1200});},true);
await scene(16,async()=>{await goV('stock');await sleep(500);await click(p.locator('#view button',{hasText:'현장용'}).first(),{pause:800});},true);
await scene(17,async()=>{await goV('reports');await tab('reports','monthly');await sleep(600);await click(p.locator('#view button',{hasText:'내장'}).first(),{pause:1000});},true);
/* S18 마무리 */
{const [t,s]=SCENES[18];await caption(t,s);console.log(((Date.now()-t0)/1000).toFixed(0)+'s '+t);
 await p.evaluate(()=>{document.getElementById('zcap').style.display='none';const e=document.getElementById('zend');e.innerHTML='ZEN Manufacturing Platform<br><span style="font-size:20px;font-weight:400;opacity:.85">수기 취합이 아니라, 판단과 조치로 · 제니엘 제조사업부 사업3팀</span>';e.style.display='flex';});
 await sleep(5500);}
const vid=p.video();await ctx.close();await browser.close();
fs.copyFileSync(await vid.path(),OUT);fs.rmSync(tmp,{recursive:true,force:true});
fs.writeFileSync(OUT+'.scenes.json',JSON.stringify(marks,null,1));
if(ONLY){/* 장면별로 잘라 저장 */
  const {execFileSync}=await import('child_process');
  const FF=process.env.FFMPEG||[...(fs.existsSync('/opt/pw-browsers')?fs.readdirSync('/opt/pw-browsers').filter(d=>d.startsWith('ffmpeg')).map(d=>path.join('/opt/pw-browsers',d,'ffmpeg-linux')):[]),'ffmpeg'].find(f=>f==='ffmpeg'||fs.existsSync(f));
  const dir=path.join(path.dirname(OUT),'clips');fs.mkdirSync(dir,{recursive:true});
  for(const m of marks){const f=path.join(dir,'S'+String(m.i).padStart(2,'0')+'_'+m.title.split(' · ')[0].replace(/\s/g,'')+'.webm');
    try{execFileSync(FF,['-v','error','-y','-ss',String(Math.max(0,m.start-0.2)),'-to',String(m.end+0.4),'-i',OUT,'-c:v','libvpx','-b:v','4M','-an',f]);console.log('  클립 →',f);}catch(e){console.log('  (자르기 실패 — '+OUT+'.scenes.json 의 시각으로 편집기에서 자르세요)');break;}}
}
console.log('저장 →',OUT,(fs.statSync(OUT).size/1048576).toFixed(1)+'MB',((Date.now()-t0)/1000).toFixed(0)+'초');
