/**
 * 챕터 타이틀 카드 — 흰 바탕·네이비, 제니엘 톤. 구간 사이에 3초씩 끼운다.
 *   node video/scenes/chapters.mjs <출력폴더>   → seg_ch_<이름>.webm
 */
import fs from 'fs';
import path from 'path';
import {launch,session,ROOT} from '../lib.mjs';
const OUT=path.resolve(process.argv[2]||path.join(ROOT,'video','out'));
const f400=fs.readFileSync(path.join(ROOT,'.claude/skills/zen-ui/assets/nanum_400.woff2')).toString('base64');
const f700=fs.readFileSync(path.join(ROOT,'.claude/skills/zen-ui/assets/nanum_700.woff2')).toString('base64');
const CARDS={
  apps:   ['02','현장 앱','입력이 곧 판단이 됩니다','작업자가 현장에서 입력하면 에이전트가 바로 집계·판단합니다'],
  safety: ['03','안전','위험을 먼저 감지합니다','신고 · 점검 · 체감온도를 하나의 흐름으로'],
  judge:  ['04','판단 · 조치','모든 판단이 한 곳으로','기준은 공개하고, 조치는 담당자와 기한으로 닫습니다'],
};
const html=(n,t,h,s)=>`<!doctype html><meta charset=utf-8><style>
@font-face{font-family:N;font-weight:400;src:url(data:font/woff2;base64,${f400}) format('woff2')}
@font-face{font-family:N;font-weight:700;src:url(data:font/woff2;base64,${f700}) format('woff2')}
html,body{margin:0;height:100%;background:#fff;font-family:N,sans-serif;color:#0f2438;word-break:keep-all}
.w{position:absolute;left:120px;top:50%;transform:translateY(-50%);width:1200px}
.n{font-weight:700;font-size:150px;line-height:1;letter-spacing:-.02em;color:#0f2438;opacity:0;animation:up .7s .15s ease both}
.r{height:2px;background:#0f2438;width:0;margin:26px 0 30px;animation:grow .8s .35s ease both}
.t{font-weight:700;font-size:26px;letter-spacing:.18em;color:#44566e;opacity:0;animation:up .6s .55s ease both}
.h{font-weight:700;font-size:56px;line-height:1.25;margin-top:14px;opacity:0;animation:up .6s .7s ease both}
.s{font-size:22px;color:#44566e;margin-top:16px;opacity:0;animation:up .6s .9s ease both}
.z{position:absolute;right:70px;bottom:50px;font-weight:700;letter-spacing:.2em;font-size:15px;color:#8d9db4}
@keyframes up{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}@keyframes grow{to{width:160px}}
</style><div class=w><div class=n>${n}</div><div class=r></div><div class=t>${t}</div><div class=h>${h}</div><div class=s>${s}</div></div><div class=z>ZEN MANUFACTURING PLATFORM</div>`;
const {browser,be}=await launch();
for(const [k,[n,t,h,s]] of Object.entries(CARDS)){
  const sess=await session(browser,be,'ch_'+k,OUT);
  await sess.p.setContent(html(n,t,h,s));await sess.sleep(300);
  await sess.scene(k,3.4,async()=>{},{hold:true});
  await sess.finish();
}
await browser.close();
