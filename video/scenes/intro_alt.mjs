/**
 * 지게차 현장 인트로(다른 버전) — 촬영 영상 대신 모션그래픽으로 만든다.
 * 시간 t 의 화면을 순수 함수 render(t) 로 그리고 25fps 로 한 장씩 캡처하므로 끊김(프레임 중복)이 없다.
 *   FFMPEG=/경로/ffmpeg node video/scenes/intro_alt.mjs <출력.mp4>
 * 장면: 사각지대 교차로에서 지게차와 보행자가 만난다 → ZEN 이 충돌을 먼저 예측 → 지게차가 서행·정지 → 안전 확보.
 */
import {chromium} from 'playwright';
import fs from 'fs';
import path from 'path';
import os from 'os';
import {execFileSync} from 'child_process';
import {fileURLToPath} from 'url';
const HERE=path.dirname(fileURLToPath(import.meta.url));
const ROOT=path.join(HERE,'..','..');
const OUT=path.resolve(process.argv[2]||path.join(HERE,'..','out','intro_alt.mp4'));
const FFMPEG=process.env.FFMPEG||'ffmpeg';
const FPS=25, DUR=+(process.env.DUR||12.6);
const f400=fs.readFileSync(path.join(ROOT,'.claude/skills/zen-ui/assets/nanum_400.woff2')).toString('base64');
const f700=fs.readFileSync(path.join(ROOT,'.claude/skills/zen-ui/assets/nanum_700.woff2')).toString('base64');

const HTML=`<!doctype html><meta charset=utf-8><style>
@font-face{font-family:N;font-weight:400;src:url(data:font/woff2;base64,${f400}) format('woff2')}
@font-face{font-family:N;font-weight:700;src:url(data:font/woff2;base64,${f700}) format('woff2')}
html,body{margin:0;background:#0b1a2b;overflow:hidden}svg{display:block;font-family:N,sans-serif}
</style><svg id=s width=1440 height=900 viewBox="0 0 1440 900" xmlns="http://www.w3.org/2000/svg">
<defs><radialGradient id=bg cx=50% cy=40% r=80%><stop offset=0 stop-color=#12293f /><stop offset=1 stop-color=#08131f /></radialGradient>
<radialGradient id=halo><stop offset=0 stop-color=#fff stop-opacity=.55 /><stop offset=1 stop-color=#fff stop-opacity=0 /></radialGradient></defs>
<rect width=1440 height=900 fill=url(#bg) />
<g id=grid stroke=#16314d stroke-width=1></g>
<g id=racks></g>
<g id=floor>
  <rect x=120 y=360 width=1200 height=200 fill=#0d2034 stroke=#1d3b58 stroke-width=1.5 rx=4 />
  <rect x=840 y=560 width=120 height=140 fill=#0d2034 stroke=#1d3b58 stroke-width=1.5 />
  <rect x=840 y=170 width=120 height=190 fill=#0d2034 stroke=#1d3b58 stroke-width=1.5 />
  <line x1=130 y1=460 x2=1310 y2=460 stroke=#27496a stroke-width=2 stroke-dasharray="14 12" />
</g>
<g id=trails fill=none stroke-linecap=round>
  <path id=fTrail stroke=#9fb6d1 stroke-width=3 opacity=.55 />
  <path id=fPred stroke=#e5484d stroke-width=3 stroke-dasharray="10 9" opacity=0 />
  <path id=pPred stroke=#e5484d stroke-width=3 stroke-dasharray="10 9" opacity=0 />
</g>
<g id=cone opacity=0><path id=conePath fill=#e5484d opacity=.14 /></g>
<g id=risk opacity=0>
  <circle id=riskRing cx=900 cy=460 r=46 fill=none stroke=#e5484d stroke-width=3 />
  <circle id=riskRing2 cx=900 cy=460 r=46 fill=none stroke=#e5484d stroke-width=2 opacity=.5 />
  <circle cx=900 cy=460 r=8 fill=#e5484d id=riskDot />
</g>
<g id=ped opacity=0><circle id=pHalo r=34 fill=url(#halo) /><circle id=pBody r=11 fill=#fff /><circle id=pRing r=19 fill=none stroke=#fff stroke-width=2 opacity=.7 /></g>
<g id=fk>
  <circle id=sense r=110 fill=none stroke=#9fb6d1 stroke-width=2 opacity=.35 />
  <g id=fkBody>
    <rect x=-44 y=-24 width=64 height=48 rx=8 fill=#e9eef5 />
    <rect x=-30 y=-16 width=26 height=32 rx=5 fill=#9fb6d1 opacity=.8 />
    <rect x=20 y=-17 width=44 height=5 rx=2 fill=#e9eef5 /><rect x=20 y=12 width=44 height=5 rx=2 fill=#e9eef5 />
    <rect id=brake x=-46 y=-20 width=5 height=40 rx=2 fill=#e5484d opacity=0 />
  </g>
</g>
<g id=hud>
  <text id=hdr x=70 y=78 fill=#cfe0f2 font-size=24 font-weight=700 opacity=0 letter-spacing=.5></text>
  <line id=hdrLine x1=70 y1=98 x2=70 y2=98 stroke=#10c27c stroke-width=3 />
  <g id=ttcBox opacity=0><rect x=1010 y=300 width=250 height=84 rx=4 fill=#0b1a2b stroke=#e5484d stroke-width=2 />
    <text x=1030 y=334 fill=#f3b4b6 font-size=17 font-weight=700 letter-spacing=1.5>충돌 예측</text>
    <text id=ttc x=1030 y=370 fill=#fff font-size=34 font-weight=700></text></g>
  <g id=okBox opacity=0><rect x=1010 y=300 width=250 height=84 rx=4 fill=#0b1a2b stroke=#10c27c stroke-width=2 />
    <text x=1030 y=334 fill=#9be0c1 font-size=17 font-weight=700 letter-spacing=1.5>ZEN 판단</text>
    <text x=1030 y=370 fill=#fff font-size=30 font-weight=700>서행 → 정지</text></g>
  <text id=big1 x=720 y=742 fill=#fff font-size=64 font-weight=700 text-anchor=middle opacity=0>위험을 먼저 감지</text>
  <line id=big1Line x1=520 y1=766 x2=920 y2=766 stroke=#e5484d stroke-width=4 opacity=0 />
  <text id=big2 x=720 y=742 fill=#fff font-size=64 font-weight=700 text-anchor=middle opacity=0>판단은 짧게, 실행은 즉시</text>
  <text id=foot x=70 y=842 fill=#9fb6d1 font-size=22 opacity=0>감지하고, 판단하고, 현장을 움직입니다</text>
  <text id=mark x=1370 y=842 fill=#6f8aa8 font-size=16 font-weight=700 text-anchor=end letter-spacing=3 opacity=0>ZEN MANUFACTURING PLATFORM</text>
</g>
<rect id=fade width=1440 height=900 fill=#08131f opacity=1 />
</svg>
<script>
const $=id=>document.getElementById(id);const C=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const ease=t=>t<.5?2*t*t:1-Math.pow(-2*t+2,2)/2, out=t=>1-Math.pow(1-t,3);
const seg=(t,a,b)=>C((t-a)/(b-a));
/* 격자·선반 한 번만 */
(function(){let g='';for(let x=0;x<=1440;x+=60)g+='<line x1='+x+' y1=0 x2='+x+' y2=900 />';for(let y=0;y<=900;y+=60)g+='<line x1=0 y1='+y+' x2=1440 y2='+y+' />';$('grid').innerHTML=g;
  let r='';const row=(y,h)=>{for(let x=120;x<1320;x+=100){if(x>=840&&x<960)continue;r+='<rect x='+(x+4)+' y='+y+' width=92 height='+h+' rx=3 fill=#10263c stroke=#1d3b58 />'}};
  row(260,90);row(570,90);row(170,80);row(680,70);$('racks').innerHTML=r;})();
const HDR='현장의 신호 → ZEN Manufacturing Platform → 다음 행동';
const FY=460;
function render(t){
  const o=(id,v)=>{$(id).setAttribute('opacity',v)};
  $('fade').setAttribute('opacity',(1-out(seg(t,0,.7)))*1 + out(seg(t,11.9,12.6))*1 - (1-out(seg(t,0,.7)))*out(seg(t,11.9,12.6)));
  /* 머리글 타이핑 */
  const n=Math.round(HDR.length*seg(t,.5,2.0));$('hdr').textContent=HDR.slice(0,n);o('hdr',n?1:0);
  $('hdrLine').setAttribute('x2',70+420*out(seg(t,.5,1.6)));
  /* 지게차: 1.0~6.2 느린 가속, 6.2~9.0 서행→정지 */
  let fx;
  if(t<6.2)fx=140+ (790-140)*0.0+ 150*seg(t,1.0,6.2)*(1+seg(t,1.0,6.2))*0.5*1.9; else fx=0;
  const a=seg(t,1.0,6.2), x1=140+ (a*a*0.35+a*0.65)*610;       // 6.2초에 x≈750
  const b=seg(t,6.2,9.0), x2=750+ (1-Math.pow(1-b,2))*48;      // 감속하며 x≈798 에서 정지
  fx=t<6.2?x1:x2;
  $('fk').setAttribute('transform','translate('+fx+','+FY+')');
  o('fk',out(seg(t,.7,1.3)));
  $('sense').setAttribute('r',100+16*Math.sin(t*3.2));
  $('fTrail').setAttribute('d','M140 '+FY+' L'+fx+' '+FY);
  $('brake').setAttribute('opacity',t>6.4&&t<9.2?1:0);
  /* 보행자: 사각지대(선반 뒤)에서 올라와 교차로를 건넌 뒤 위쪽 통로로 빠짐 */
  const pp=seg(t,3.0,10.2);let py=700-(700-170)*pp;
  const ph=(t>8.0)?0:1;
  const px=900+ (t>7.3? 0:0);
  $('ped').setAttribute('transform','translate('+px+','+py+')');
  o('ped',C(seg(t,3.0,3.5))*(t>10.0?1-seg(t,10.0,10.4):1));
  $('pHalo').setAttribute('r',30+6*Math.sin(t*5)); $('pRing').setAttribute('r',17+3*Math.sin(t*5+1));
  /* 위험 예측 4.2~6.6 */
  const pr=out(seg(t,4.2,5.0)), clear=seg(t,8.6,9.4);
  $('fPred').setAttribute('d','M'+fx+' '+FY+' L900 '+FY);$('fPred').setAttribute('opacity',pr*(1-clear));
  $('pPred').setAttribute('d','M'+px+' '+py+' L900 '+FY);$('pPred').setAttribute('opacity',(py>FY?pr:0)*(1-clear));
  const cw=fx+60; $('conePath').setAttribute('d','M'+cw+' '+FY+' L'+(cw+360)+' '+(FY-170)+' L'+(cw+360)+' '+(FY+170)+' Z');
  $('cone').setAttribute('opacity',pr*(1-clear)*1);
  o('risk',pr*(1-clear));$('riskRing').setAttribute('r',40+10*Math.sin(t*6));$('riskRing2').setAttribute('r',60+14*Math.sin(t*6+1.6));
  o('ttcBox',pr*(1-seg(t,8.0,8.4)));
  const ttc=Math.max(.0,2.4-(t-4.4)*.62);$('ttc').textContent=ttc.toFixed(1)+'초 후 접촉';
  o('okBox',out(seg(t,8.4,9.0))*(1-seg(t,11.0,11.5)));
  /* 큰 문구 */
  const b1=out(seg(t,5.6,6.2))*(1-seg(t,8.5,8.9));o('big1',b1);o('big1Line',b1);
  const b2=out(seg(t,9.3,9.9))*(1-seg(t,11.9,12.5));o('big2',b2);
  o('foot',out(seg(t,10.0,10.6))*(1-seg(t,11.9,12.5)));o('mark',.9*out(seg(t,1.2,2.0))*(1-seg(t,11.9,12.5)));
  $('hdr').setAttribute('opacity',(n?1:0)*(1-seg(t,11.9,12.5)));
}
render(0);
</script>`;

const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'zen_intro_'));
const browser=await chromium.launch({executablePath:process.env.CHROMIUM||'/opt/pw-browsers/chromium'});
const p=await (await browser.newContext({viewport:{width:1440,height:900}})).newPage();
await p.setContent(HTML);await p.waitForTimeout(400);
const N=Math.round(DUR*FPS);
for(let i=0;i<N;i++){await p.evaluate(t=>render(t),i/FPS);await p.screenshot({path:path.join(tmp,'f'+String(i).padStart(4,'0')+'.png')});}
await browser.close();
fs.mkdirSync(path.dirname(OUT),{recursive:true});
execFileSync(FFMPEG,['-v','error','-y','-framerate',String(FPS),'-i',path.join(tmp,'f%04d.png'),'-c:v','libx264','-crf','16','-pix_fmt','yuv420p',OUT]);
fs.rmSync(tmp,{recursive:true,force:true});
console.log('저장 →',OUT,N+'프레임');
