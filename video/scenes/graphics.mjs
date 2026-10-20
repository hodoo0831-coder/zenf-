/**
 * 모션 그래픽 장면 — video/graphics/motion.html 의 render(t) 로 프레임을 결정적으로 그려 mp4 로 만든다.
 *   FFMPEG=<ffmpeg> node video/scenes/graphics.mjs <출력폴더> [hook|results|agents|matrix|end|all]
 * 실시간 녹화가 아니라 프레임마다 시간을 지정해 그리므로 끊김이 없다. 1920×1200 · 30fps.
 */
import {chromium} from 'playwright';
import fs from 'fs';
import path from 'path';
import {execFileSync} from 'child_process';
const ROOT=path.join(path.dirname(new URL(import.meta.url).pathname),'..','..');
const OUT=path.resolve(process.argv[2]||path.join(ROOT,'video','out'));
const WHICH=process.argv[3]||'all';
const DUR={hook:10.5,results:10.5,agents:10.5,matrix:7.5,end:8.0};
fs.mkdirSync(OUT,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROMIUM||'/opt/pw-browsers/chromium',args:['--allow-file-access-from-files']});
const page=await browser.newPage({viewport:{width:1920,height:1200}});
await page.goto('file://'+path.join(ROOT,'video','graphics','motion.html'));await page.waitForTimeout(600);
await page.evaluate(()=>document.fonts.ready);
const names=WHICH==='all'?Object.keys(DUR):[WHICH];
for(const n of names){
  const fdir=path.join(OUT,'_g_'+n);fs.rmSync(fdir,{recursive:true,force:true});fs.mkdirSync(fdir,{recursive:true});
  await page.evaluate(n=>setup(n),n);await page.waitForTimeout(150);
  const N=Math.round(DUR[n]*30);
  for(let i=0;i<N;i++){
    await page.evaluate(t=>render(t),i/30);
    await page.screenshot({path:path.join(fdir,'f'+String(i).padStart(5,'0')+'.jpg'),type:'jpeg',quality:93});
  }
  const f=path.join(OUT,'seg_g_'+n+'.mp4');
  execFileSync(process.env.FFMPEG||'ffmpeg',['-v','error','-y','-framerate','30','-i',path.join(fdir,'f%05d.jpg'),'-c:v','libx264','-crf','14','-pix_fmt','yuv420p','-r','30',f],{stdio:'inherit'});
  fs.rmSync(fdir,{recursive:true,force:true});
  console.log('저장 →',f,DUR[n]+'s');
}
await browser.close();
