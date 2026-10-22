/**
 * 젠 필드 빌리지(3D) 둘러보기 — 가상 시계로 한 프레임씩 찍어 부드러운 영상으로 만든다.
 *   VILLAGE_HTML=… WH_HTML=… THREE_JS=… node video/scenes/village_clock.mjs <출력폴더>
 * 소프트웨어 렌더링(SwiftShader)에서 3D 가 초당 2~3장밖에 못 그려 실시간 녹화는 끊긴다.
 * 그래서 Playwright 가상 시계(clock)로 33ms 씩 진행시키며 매번 스크린샷을 찍는다 — 렌더 속도와 무관하게 24fps 로 매끄럽다.
 * 마을 HTML·three.js 는 레포에 없다(환경변수로 경로를 넘긴다). 값은 시험 백엔드(실제 Worker 코드)에 넣은 시연용 샘플이다.
 */
import path from 'path';
import fs from 'fs';
import {chromium} from 'playwright';
import {startBackend} from '../local-backend.mjs';
import {seedPlatform} from '../seed.mjs';
const OUT=path.resolve(process.argv[2]);
const V=process.env.VILLAGE_HTML,W=process.env.WH_HTML,T=process.env.THREE_JS;
if(!V||!W||!T)throw new Error('VILLAGE_HTML · WH_HTML · THREE_JS 환경변수가 필요합니다');
const FPS=+process.env.FPS||24, STEP=1000/FPS, SCALE=+process.env.SCALE||1.3333;
const three=fs.readFileSync(T);
const be=await startBackend();await seedPlatform(be);
const browser=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const F='"NanumGothicEmbedded","Noto Sans CJK KR","Nanum Gothic",sans-serif';
const OVERLAY=()=>{const boot=()=>{if(document.getElementById('zcap2'))return;
  const css=document.createElement('style');
  css.textContent='#zcap2{position:fixed;right:46px;bottom:46px;z-index:2147483000;max-width:560px;display:none;font-family:"Noto Sans CJK KR","Nanum Gothic",sans-serif}'
   +'#zcap2 .t{display:inline-block;background:#fff;color:#0f2438;border:1px solid #0f2438;border-bottom:0;font:700 12px/1 "Noto Sans CJK KR",sans-serif;letter-spacing:.14em;padding:8px 13px;border-radius:3px 3px 0 0}'
   +'#zcap2 .b{display:block;background:#0f2438;border-radius:0 3px 3px 3px;padding:16px 24px 17px;box-shadow:0 10px 30px rgba(15,36,56,.28)}'
   +'#zcap2 .h{color:#fff;font:700 27px/1.28 "Noto Sans CJK KR",sans-serif;word-break:keep-all}#zcap2 .s{color:#c9d6e6;font:400 15px/1.5 "Noto Sans CJK KR",sans-serif;margin-top:6px;word-break:keep-all}'
   +'#zsample{position:fixed;right:18px;bottom:14px;z-index:2147483000;background:#fff;color:#44566e;border:1px solid #cfd8e3;font:700 12px/1 "Noto Sans CJK KR",sans-serif;padding:7px 11px;border-radius:3px}';
  document.head.appendChild(css);for(const id of ['zcap2','zsample']){const e=document.createElement('div');e.id=id;document.body.appendChild(e);}
  document.getElementById('zsample').textContent='시연용 샘플 데이터';};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();};
const ease=t=>t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;

async function record(name,file,N,plan){
  const dir=path.join(OUT,'frames_'+name);fs.rmSync(dir,{recursive:true,force:true});fs.mkdirSync(dir,{recursive:true});
  const ctx=await browser.newContext({viewport:{width:1440,height:900},deviceScaleFactor:SCALE});
  await ctx.route(/^https:\/\//,r=>/three\.min\.js/.test(r.request().url())?r.fulfill({status:200,contentType:'application/javascript',body:three}):be.handler(r));
  await ctx.clock.install({time:new Date('2026-10-22T09:00:00')});
  const p=await ctx.newPage();await p.addInitScript(OVERLAY);
  await p.goto('file://'+file);
  const tick=async(ms)=>{await ctx.clock.runFor(ms);};
  for(let i=0;i<40;i++){await tick(250);await p.waitForTimeout(120);}   // 로딩·첫 장면 안정화(가상 시간 10초)
  let n=0,t=0;
  const max=await p.evaluate(()=>document.documentElement.scrollHeight-innerHeight);
  const posOf=i=>max*i/(N-1);
  let y=await p.evaluate(()=>scrollY);
  const frame=async()=>{await tick(STEP);await p.screenshot({path:path.join(dir,'f'+String(n++).padStart(5,'0')+'.jpg'),type:'jpeg',quality:92});};
  const setCap=(c)=>p.evaluate(([c])=>{const e=document.getElementById('zcap2');if(!e)return;if(!c){e.style.display='none';return;}e.innerHTML='<span class="t">'+c[0]+'</span><span class="b"><div class="h">'+c[1]+'</div><div class="s">'+c[2]+'</div></span>';e.style.display='block';},[c]);
  const t0=Date.now();
  for(const st of plan){
    const y1=posOf(st.i),y0=y,tf=Math.round((st.travel||0)*FPS),hf=Math.round(st.hold*FPS);
    await setCap(st.cap);
    for(let k=1;k<=tf;k++){await p.evaluate(v=>scrollTo(0,v),y0+(y1-y0)*ease(k/tf));await frame();}
    y=y1;await p.evaluate(v=>scrollTo(0,v),y1);
    for(let k=0;k<hf;k++)await frame();
    console.log(((Date.now()-t0)/1000).toFixed(0)+'s',name,st.label,'frames',n);
  }
  await ctx.close();
  return {dir,n};
}

const village=await record('village',V,11,[
  {label:'intro',i:0,hold:3.6,cap:['ZEN FIELD VILLAGE','현장에서 만든 업무 도구 23개가 사는 마을','운영 중 13 · 시범 6 · 구상 4']},
  {label:'tower',i:2,travel:2.6,hold:3.2,cap:['관제탑','ZEN Manufacturing 플랫폼','건물 카드를 누르면 플랫폼의 해당 화면으로 이동합니다 (연동 진행 중)']},
  {label:'wh',i:3,travel:2.2,hold:3.2,cap:['포장재 창고','창고가 언제 차는지 구역별로','적치 입력 앱(wh-stack)의 수치를 마을에서도 봅니다']},
  {label:'wash',i:4,travel:2.2,hold:2.8,cap:['세척동','세척 실적을 현장에서 바로 입력','세척실 AI · P-BOX·오리콘 · 박스갈이 일보']},
  {label:'safety',i:5,travel:2.2,hold:3.2,cap:['안전 광장','안전은 4대 지킴이가','젠키퍼 · 세이프체크 · 히트워치 · 세이프티 보이스']},
  {label:'lab',i:7,travel:2.8,hold:2.8,cap:['AI 연구소','시범·구상 중인 새 도구','ZEN AgentWorks · 일일 운영 관제 에이전트 · MSDS']},
  {label:'back',i:0,travel:3.6,hold:2.4,cap:['지금도 진행 중','현장의 불편을 하나씩 도구로','플랫폼과 연동해 한 마을로 잇는 중입니다']},
]);
const wh=await record('whvillage',W,10,[
  {label:'hero',i:0,hold:2.8,cap:['포장재 창고 적치 마을 (제작 중)','12개 구역, 지금 몇 % 찼나','사업장 배치도 그대로 세운 3D 창고']},
  {label:'kpi',i:1,travel:2.2,hold:3.2,cap:['전사 합계','적치 2,217 PLT · CAPA 대비 102.2%','초과 구역과 반출 권고를 한눈에']},
  {label:'fnc',i:2,travel:2.4,hold:3.0,cap:['FnC동','한 건물에 세 구역이 층층이','층별 적치율과 초과를 색으로']},
]);
fs.writeFileSync(path.join(OUT,'frames.json'),JSON.stringify({fps:FPS,village,wh},null,1));
await browser.close();
process.exit(0);
