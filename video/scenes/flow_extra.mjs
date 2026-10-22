/**
 * 에이전트별 시각화 화면 — 품질 Agent · 안전 Agent (flow.mjs 의 영상 ① 뒤쪽에 이어 붙인다)
 *   ZEN_PIN=… node video/scenes/flow_extra.mjs <출력폴더>
 * 값은 시험 백엔드(실제 Worker 코드)에 넣은 시연용 샘플이다.
 */
import path from 'path';
import {launch,session,ROOT} from '../lib.mjs';
import {seedPlatform} from '../seed.mjs';
const OUT=path.resolve(process.argv[2]||path.join(ROOT,'video','out'));
const PIN=process.env.ZEN_PIN||'';
const {browser,be}=await launch();
await seedPlatform(be);
const P=await session(browser,be,'flow_extra',OUT);
await P.open('file://'+path.join(ROOT,'index.html'),800);
await P.p.fill('input[type=password]',PIN);await P.p.keyboard.press('Enter');
await P.sleep(4800);
await P.sample(true);
const go=async(id)=>{await P.p.evaluate(x=>go(x),id);await P.sleep(500);
  for(let i=0;i<3;i++){await P.p.evaluate(()=>{let e=document.getElementById('view');while(e&&e!==document.body){const o=getComputedStyle(e).overflowY;if((o==='auto'||o==='scroll')&&e.scrollHeight>e.clientHeight+20)break;e=e.parentElement;}(e&&e!==document.body?e:document.scrollingElement).scrollTo(0,0);});await P.sleep(400);}};
await P.cap('시각화','품질 Agent — 불량률 추이와 원인 파레토','목표 1.5% 대비 불량률 · 원인별 누적 비율을 자동 차트로 (시연 샘플 데이터)');
await P.scene('quality',7,async()=>{await go('qual');await P.sleep(400);},{hold:true});
await P.cap('시각화','안전 Agent — 체감온도·TBM·위험요인 자동 판단','WBGT 28℃ 이상이면 휴식·냉방 조치를 추천 (시연 샘플 데이터)');
await P.scene('safety',7,async()=>{await go('safe');await P.sleep(400);},{hold:true});
await P.finish();
await browser.close();
