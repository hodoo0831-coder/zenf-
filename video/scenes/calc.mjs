/**
 * 인력 T/O 계산기 — "데이터를 넣으면 결과가 어떻게 나오는가" 구간
 *   node video/scenes/calc.mjs <출력폴더>
 * 계산기는 로컬 파일(ZEN_LaborCalc.html)이다. 차트(Chart.js)는 CDN 이라 오프라인에서 비므로 그 카드는 가리고 표·결론만 찍는다.
 */
import path from 'path';
import {launch,session,ROOT} from '../lib.mjs';
const OUT=path.resolve(process.argv[2]||path.join(ROOT,'video','out'));
const {browser,be}=await launch();
const s=await session(browser,be,'plat_calc',OUT);
await s.open('file://'+path.join(ROOT,'ZEN_LaborCalc.html'),1200);
await s.p.addStyleTag({content:'.two{grid-template-columns:1fr!important}.two>.card:nth-child(2){display:none}'});
await s.sample(true);
await s.cap('입력 → 결과','계획 수량을 넣으면 필요 인원이 즉시','신장율·계획량을 바꾸면 부하율과 부족 인원이 바로 다시 계산됩니다');
await s.scene('calc',13,async()=>{
  await s.sleep(2200);
  await s.click(s.p.locator('[data-g="10"]').first(),2600);       // 신장율 +10%
  await s.click(s.p.locator('[data-g="0"]').first(),900);
  const inp=s.p.locator('tr[data-g="튜브"] input').first();
  await s.click(inp,300);await inp.press('Control+A');await s.p.keyboard.type('800000',{delay:150});await s.sleep(2400);   // 튜브 계획량 직접 입력
},{hold:true});
await s.finish();await browser.close();
