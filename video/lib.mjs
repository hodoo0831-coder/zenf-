/**
 * 데모 영상 녹화 공용 도구 — 1440x900, 소리 없음.
 *
 *   import {launch, session} from './lib.mjs';
 *   const {browser,be}=await launch();                 // be = 로컬 시험 백엔드(실제 Worker 코드)
 *   const s=await session(browser,be,'이름',outDir,{initScript});
 *   await s.open('file:///…/앱.html');
 *   await s.cap('SYSTEM · 세척','제목','부제');            // 좌하단 자막 박스(태그·제목·부제)
 *   await s.scene('장면이름',초,async()=>{ … },{hold:true}); // 초만큼 길이를 채운다. hold=false 면 본문을 천천히 훑는다
 *   await s.finish();                                  // <outDir>/seg_<이름>.webm + .json(장면별 시작/끝 초)
 *
 * 도구 모음: s.click(loc,pause) · s.type(loc,text) · s.toast(태그,문구,ms) · s.hide() · s.sleep(ms) · s.p(Playwright page)
 *
 * 시연용 샘플 데이터 원칙: 값은 반드시 실제 Worker 코드로 넣고(백엔드 be.call 또는 앱 화면에서 직접 입력),
 * 화면에 "시연용 샘플" 표시를 띄운다(s.sample()). 암호는 화면에 입력하지 않고 앱의 세션 저장값으로 통과시킨다.
 */
import {chromium} from 'playwright';
import fs from 'fs';
import path from 'path';
import {startBackend} from './local-backend.mjs';

export const FONT='"NanumGothicEmbedded","Noto Sans CJK KR","Nanum Gothic","Malgun Gothic",sans-serif';

const OVERLAY_JS=()=>{
  const boot=()=>{
    if(document.getElementById('zcap2'))return;
    const F='"NanumGothicEmbedded","Noto Sans CJK KR","Nanum Gothic","Malgun Gothic",sans-serif';
    const css=document.createElement('style');
    /* 제니엘 톤 — 네이비(#0f2438) · 흰 바탕 · 헤어라인. 그라데이션·원형 커서 없음 */
    css.textContent=
     `#zcap2{position:fixed;left:46px;bottom:46px;z-index:2147483000;max-width:760px;display:none;font-family:${F};pointer-events:none}`
    +`#zcap2 .t{display:inline-block;background:#fff;color:#0f2438;border:1px solid #0f2438;border-bottom:0;font:700 12px/1 ${F};letter-spacing:.14em;padding:8px 13px;border-radius:3px 3px 0 0;margin-left:0}`
    +`#zcap2 .b{display:block;background:#0f2438;border-radius:0 3px 3px 3px;padding:16px 24px 17px;box-shadow:0 10px 30px rgba(15,36,56,.28)}`
    +`#zcap2 .h{color:#fff;font:700 27px/1.28 ${F};word-break:keep-all}`
    +`#zcap2 .s{color:#c9d6e6;font:400 15px/1.5 ${F};margin-top:6px;word-break:keep-all}`
    +`#ztoast{position:fixed;right:34px;top:34px;z-index:2147483000;display:flex;flex-direction:column;gap:10px;align-items:flex-end;pointer-events:none;font-family:${F}}`
    +`#ztoast .k{display:flex;gap:11px;align-items:center;background:#fff;color:#0f2438;border:1px solid #cfd8e3;border-left:4px solid #0f2438;border-radius:3px;padding:11px 16px;box-shadow:0 8px 24px rgba(15,36,56,.2);max-width:520px;font:700 15px/1.45 ${F};word-break:keep-all;animation:zin .35s ease both}`
    +`#ztoast .k i{font-style:normal;background:#0f2438;color:#fff;font:700 11px/1 ${F};letter-spacing:.08em;padding:5px 8px;border-radius:2px;flex:none}`
    +`#ztoast .k.out{animation:zout .35s ease both}`
    +`@keyframes zin{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:none}}@keyframes zout{to{opacity:0;transform:translateY(-8px)}}`
    +`#zsample{position:fixed;right:18px;bottom:14px;z-index:2147483000;background:#fff;color:#44566e;border:1px solid #cfd8e3;font:700 12px/1 ${F};padding:7px 11px;border-radius:3px;pointer-events:none;display:none}`
    +`#zcur{position:fixed;z-index:2147483001;width:22px;height:28px;margin:-2px 0 0 -2px;pointer-events:none;left:-60px;top:-60px;transition:transform .1s;transform-origin:3px 3px;`
    +`background:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='22' height='28' viewBox='0 0 22 28'><path d='M3 2 L3 21 L8 16.5 L11.5 24 L14.5 22.7 L11.2 15.3 L18 15 Z' fill='%230f2438' stroke='white' stroke-width='1.6' stroke-linejoin='round'/></svg>") no-repeat}`
    +`#zcur.dn{transform:scale(.82)}`;
    document.head.appendChild(css);
    for(const id of ['zcap2','ztoast','zsample','zcur']){const e=document.createElement('div');e.id=id;document.body.appendChild(e);}
    const k=document.getElementById('zcur');
    addEventListener('mousemove',ev=>{k.style.left=ev.clientX+'px';k.style.top=ev.clientY+'px';},true);
    addEventListener('mousedown',()=>k.classList.add('dn'),true);addEventListener('mouseup',()=>k.classList.remove('dn'),true);
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
};


/* ── 부드러운 스크롤 ──
   헤드리스 녹화에서는 브라우저 기본 smooth 스크롤(컴포지터 애니메이션)이 프레임이 끊겨 찍힌다.
   behavior:'smooth' 요청을 가로채 requestAnimationFrame 으로 직접(easeInOut) 굴린다 — 앱 코드는 그대로 둔다. */
const SMOOTH_JS=()=>{
  if(window.__zsmooth)return;window.__zsmooth=1;
  const oWS=window.scrollTo.bind(window),oEI=Element.prototype.scrollIntoView;
  const oES=Element.prototype.scrollTo,oEB=Element.prototype.scrollBy;
  const ease=t=>t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;
  const running=new WeakMap();
  const isWin=c=>c===window;
  const getY=c=>isWin(c)?window.scrollY:c.scrollTop;
  const setY=(c,y)=>{if(isWin(c))oWS({top:y,left:window.scrollX,behavior:'instant'});else oES.call(c,{top:y,left:c.scrollLeft,behavior:'instant'});};
  const maxY=c=>isWin(c)?Math.max(0,document.documentElement.scrollHeight-window.innerHeight):Math.max(0,c.scrollHeight-c.clientHeight);
  function anim(c,y1){
    y1=Math.max(0,Math.min(maxY(c),y1));const y0=getY(c),d=y1-y0;if(Math.abs(d)<1)return;
    const dur=Math.min(1500,380+Math.abs(d)*0.75),t0=performance.now();
    const id={};running.set(c,id);
    const step=now=>{if(running.get(c)!==id)return;const t=Math.min(1,(now-t0)/dur);setY(c,y0+d*ease(t));if(t<1)requestAnimationFrame(step);else running.delete(c);};
    requestAnimationFrame(step);
  }
  const parse=(a,b)=>typeof a==='object'&&a?{x:a.left,y:a.top,smooth:a.behavior==='smooth'}:{x:a,y:b,smooth:false};
  window.scrollTo=function(a,b){const o=parse(a,b);if(!o.smooth)return oWS.apply(window,arguments);if(o.y!=null)anim(window,o.y);else oWS(a);};
  window.scrollBy=function(a,b){const o=parse(a,b);if(!o.smooth)return window.scroll?oWS(window.scrollX+(o.x||0),window.scrollY+(o.y||0)):0;anim(window,window.scrollY+(o.y||0));};
  Element.prototype.scrollTo=function(a,b){const o=parse(a,b);const c=(this===document.documentElement||this===document.scrollingElement)?window:this;
    if(!o.smooth)return oES.apply(this,arguments);if(o.y!=null)anim(c,o.y);};
  Element.prototype.scrollBy=function(a,b){const o=parse(a,b);const c=(this===document.documentElement||this===document.scrollingElement)?window:this;
    if(!o.smooth)return oEB.apply(this,arguments);anim(c,getY(c)+(o.y||0));};
  Element.prototype.scrollIntoView=function(a){
    if(!(a&&typeof a==='object'&&a.behavior==='smooth'))return oEI.apply(this,arguments);
    let c=this.parentElement;while(c&&c!==document.body&&c!==document.documentElement){const o=getComputedStyle(c).overflowY;if((o==='auto'||o==='scroll')&&c.scrollHeight>c.clientHeight+2)break;c=c.parentElement;}
    const win=!c||c===document.body||c===document.documentElement;const cont=win?window:c;
    const r=this.getBoundingClientRect();const cr=win?{top:0,bottom:window.innerHeight,height:window.innerHeight}:c.getBoundingClientRect();
    const blk=a.block||'start';let delta;
    if(blk==='center')delta=(r.top+r.height/2)-(cr.top+cr.height/2);
    else if(blk==='end')delta=r.bottom-cr.bottom;
    else if(blk==='nearest'){delta=r.top<cr.top?r.top-cr.top:(r.bottom>cr.bottom?r.bottom-cr.bottom:0);}
    else delta=r.top-cr.top;
    anim(cont,getY(cont)+delta);};
};

/** 브라우저 + 로컬 백엔드. LIVE=1 이면 백엔드 대신 실제 workers.dev 로 나간다(인터넷이 되는 PC 용). */
export async function launch(){
  const browser=await chromium.launch({executablePath:process.env.CHROMIUM||'/opt/pw-browsers/chromium',
    args:['--disable-background-timer-throttling','--disable-renderer-backgrounding']});
  const be=await startBackend();
  return {browser,be};
}

export async function session(browser,be,name,outDir,{initScript,mobile=false}={}){
  fs.mkdirSync(outDir,{recursive:true});
  const ctx=await browser.newContext({viewport:{width:1440,height:900},recordVideo:{dir:outDir,size:{width:1440,height:900}}});
  if(!process.env.LIVE)await ctx.route(/^https:\/\//,be.handler);
  const p=await ctx.newPage();const t0=Date.now();const marks=[];
  await p.addInitScript(OVERLAY_JS);
  await p.addInitScript(SMOOTH_JS);
  if(initScript)await p.addInitScript(initScript);
  const sleep=(ms)=>p.waitForTimeout(ms);
  const api={p,ctx,sleep,marks,be,
    async open(u,wait=1200){await p.goto(u);await sleep(wait);},
    async cap(tag,title,sub){await p.evaluate(([a,b,c])=>{const e=document.getElementById('zcap2');if(!e)return;e.innerHTML='<span class="t">'+a+'</span><span class="b"><div class="h">'+b+'</div><div class="s">'+c+'</div></span>';e.style.display='block';},[tag,title,sub]);},
    async hide(){await p.evaluate(()=>{const e=document.getElementById('zcap2');if(e)e.style.display='none';});},
    /** 우상단 기능 토스트 — 화면의 특정 순간에 "이 기능이 뭔지" 한 줄로 짚는다 */
    async toast(tag,text,ms=5200){await p.evaluate(([a,b,ms])=>{const w=document.getElementById('ztoast');if(!w)return;const k=document.createElement('div');k.className='k';k.innerHTML='<i>'+a+'</i><span>'+b+'</span>';w.appendChild(k);setTimeout(()=>{k.classList.add('out');setTimeout(()=>k.remove(),400);},ms);},[tag,text,ms]);},
    /** "시연용 샘플 데이터" 표시 */
    async sample(on=true,text='시연용 샘플 데이터'){await p.evaluate(([on,t])=>{const e=document.getElementById('zsample');if(!e)return;e.textContent=t;e.style.display=on?'block':'none';},[on,text]);},
    async move(x,y){await p.mouse.move(x,y,{steps:20});},
    async click(loc,pause=700){const l=typeof loc==='string'?p.locator(loc).first():loc;
      try{await l.scrollIntoViewIfNeeded({timeout:2500});const bb=await l.boundingBox();if(!bb)return false;
        await api.move(bb.x+bb.width/2,bb.y+bb.height/2);await sleep(150);await p.mouse.down();await sleep(80);await p.mouse.up();await sleep(pause);return true;}
      catch(e){console.log('  (클릭 건너뜀)',String(e).split('\n')[0].slice(0,90));return false;}},
    async type(loc,text,delay=70){const l=typeof loc==='string'?p.locator(loc).first():loc;await api.click(l,150);await p.keyboard.type(text,{delay});await sleep(250);},
    async glide(ms,sel){/* 본문을 천천히 내렸다 올린다 — 한 번의 rAF 루프(끊김 없음) */
      const info=await p.evaluate((sel)=>{let e=sel?document.querySelector(sel):document.getElementById('view');while(e&&e!==document.body){const o=getComputedStyle(e).overflowY;if((o==='auto'||o==='scroll')&&e.scrollHeight>e.clientHeight+20)break;e=e.parentElement;}
        if(!e||e===document.body)e=document.scrollingElement;window.__zs=e;return{max:e.scrollHeight-e.clientHeight};},sel||null);
      if(info.max<30){await sleep(ms);return;}
      await p.evaluate(({ms,max})=>new Promise(res=>{const e=window.__zs,y1=max*0.45,t0=performance.now(),dur=ms*0.85;
        const oES=Element.prototype.scrollTo;
        const step=now=>{const t=Math.min(1,(now-t0)/dur);const k=t<.5?2*t*t:1-Math.pow(-2*t+2,2)/2;oES.call(e,{top:y1*k,behavior:'instant'});if(t<1)requestAnimationFrame(step);else res();};
        requestAnimationFrame(step);}),{ms,max:info.max});
      const left=ms-ms*0.85;if(left>0)await sleep(left);},
    /** 장면: 목표 시간(초)에 맞춰 동작 뒤를 채운다. hold=true 면 가만히, 아니면 본문을 천천히 훑는다 */
    async scene(label,secs,fn,{hold=false}={}){
      const a=Date.now();marks.push({label,start:(a-t0)/1000});console.log(((a-t0)/1000).toFixed(1)+'s '+label);
      try{await fn();}catch(e){console.log('  장면 오류',String(e).split('\n')[0].slice(0,120));}
      const left=secs*1000-(Date.now()-a);if(left>0){if(hold)await sleep(left);else await api.glide(left);}
      marks[marks.length-1].end=(Date.now()-t0)/1000;},
    /** 장면 사이에 화면 상태를 눈으로 확인하려고 스냅샷 저장(SHOTS=폴더) */
    async shot(tag){if(process.env.SHOTS){fs.mkdirSync(process.env.SHOTS,{recursive:true});await p.screenshot({path:path.join(process.env.SHOTS,name+'_'+tag+'.png')});}},
    async finish(){const v=p.video();await ctx.close();const f=path.join(outDir,'seg_'+name+'.webm');fs.copyFileSync(await v.path(),f);fs.unlinkSync(await v.path());
      fs.writeFileSync(f.replace(/\.webm$/,'.json'),JSON.stringify(marks,null,1));console.log('저장 →',f);return f;}
  };
  return api;
}

export const ROOT=path.join(path.dirname(new URL(import.meta.url).pathname),'..');
