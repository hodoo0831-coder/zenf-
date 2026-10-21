/**
 * "데이터를 넣으면 결과가 어떻게 나오는가" 구간 — 플랫폼 계획·예측 화면에 주간계획 엑셀을 올린다.
 *   ZEN_PIN=… PLAN_XLSX=<주간계획.xlsx> node video/scenes/calc.mjs <출력폴더>
 * 계획 파일은 실제 현장 데이터이므로 레포에 넣지 않는다 — PLAN_XLSX 로 경로만 넘긴다.
 */
import path from 'path';
import fs from 'fs';
import {launch,session,ROOT} from '../lib.mjs';
import {seedPlatform} from '../seed.mjs';
const OUT=path.resolve(process.argv[2]||path.join(ROOT,'video','out'));
const PIN=process.env.ZEN_PIN||'';
const PLAN=process.env.PLAN_XLSX;
if(!PLAN)throw new Error('PLAN_XLSX 환경변수에 주간계획 엑셀 경로를 지정하세요');
const {browser,be}=await launch();
if(!process.env.LIVE)await seedPlatform(be);
const s=await session(browser,be,'plat_calc',OUT);
await s.open('file://'+path.join(ROOT,'index.html'),800);
await s.p.fill('input[type=password]',PIN);await s.p.keyboard.press('Enter');
await s.sleep(4500);
await s.sample(true);
await s.p.evaluate(()=>go('load'));await s.sleep(900);
await s.cap('입력 → 결과','43주 확정 계획을 올리면 필요 인원이 바로','계획 수량 ÷ 호기 CAPA = 부하율, 표준 인원 × 부하율 = 필요 인원');
await s.scene('calc',13,async()=>{
  await s.sleep(1800);
  await s.p.setInputFiles('#loadFile',{name:'43주_확정계획.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:fs.readFileSync(PLAN)});   // 43주 확정 주간계획 업로드
  await s.sleep(3800);
  await s.click(s.p.locator('#view button',{hasText:'5일'}).first(),3200);   // 가동 6일 → 5일: 필요 인원 즉시 재계산
  await s.click(s.p.locator('#view button',{hasText:'6일'}).first(),2200);
},{hold:true});
await s.finish();await browser.close();
