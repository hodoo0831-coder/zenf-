/**
 * 다른 현장 앱도 같은 흐름 — 세척 Agent · 창고 Agent 판단 화면 (flow.mjs 의 영상 ① 뒤쪽에 이어 붙인다)
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
await P.cap('다른 앱도 같은 흐름','세척 Agent — 도착 등록이 우선순위 판단으로','제품·색상 전환 40% · 세척주기 35% · 생산부하 25% 점수 (시연 샘플 데이터)');
await P.scene('clean',7,async()=>{await go('clean');await P.sleep(400);},{hold:true});
await P.cap('다른 앱도 같은 흐름','창고 Agent — 적치 입력이 초과 구역·이동 제안으로','현장 입력 앱(wh-stack)의 구역별 적치 수치를 판단 (시연 샘플 데이터)');
await P.scene('stock',7,async()=>{await go('stock');await P.sleep(400);},{hold:true});
await P.finish();
await browser.close();
