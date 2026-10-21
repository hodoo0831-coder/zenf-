/**
 * "현장에서 입력하면 어떻게 자동 분석되고, 대시보드와 보고서까지 반영되는가" — 한 흐름을 같은 속도(배속 없음)로 보여 준다.
 *   ZEN_PIN=… node video/scenes/flow.mjs <출력폴더>
 * ① 작업자 폰 입력(P-BOX) → ② 플랫폼 간접작업 Agent 자동 집계·편차 분석 → ③ AI 판단·조치 → ④ 일일 운영보고 자동 반영.
 * 입력은 작업자 앱 화면에서 직접 하고(값은 실제 Worker 코드로 저장), 플랫폼은 그 서버를 조회한다. 플랫폼 화면은 입력 전(before)과 후(after)를 한 세션에서 이어 찍는다.
 * 60초 주기 자동 갱신 대신 AI 통합 브리핑의 '새로고침' 버튼으로 즉시 갱신한다(자막에 밝힘).
 */
import path from 'path';
import {launch,session,ROOT} from '../lib.mjs';
import {seedPlatform} from '../seed.mjs';
const OUT=path.resolve(process.argv[2]||path.join(ROOT,'video','out'));
const PIN=process.env.ZEN_PIN||'';
const {browser,be}=await launch();
if(!process.env.LIVE)await seedPlatform(be);

/* ── 플랫폼 세션(먼저 열어 입력 전 상태를 보여 준다) ── */
const P=await session(browser,be,'flow_plat',OUT);
await P.open('file://'+path.join(ROOT,'index.html'),800);
await P.p.fill('input[type=password]',PIN);await P.p.keyboard.press('Enter');await P.sleep(4800);
await P.sample(true);
const go=async(id)=>{await P.p.evaluate(x=>go(x),id);await P.sleep(700);};
await go('orikonwash');
await P.cap('입력 전','간접작업 Agent — 지금의 집계','P-BOX · 오리콘 실적을 5초~60초 주기로 서버(D1)에서 가져와 집계합니다');
await P.scene('before',6,async()=>{await P.sleep(1500);},{hold:true});
const t_before=P.marks[P.marks.length-1];

/* ── ① 작업자 앱 입력 ── */
const W=await session(browser,be,'flow_worker',OUT);
await W.open('file://'+path.join(ROOT,'pbox-orikon-system/worker-site/pbox/index.html'),1500);
await W.sample(true);
await W.cap('① 현장 입력','작업자가 폰으로 입력합니다','이름 · 부위 · 작업 · 수량만 — 맨아워(시간)는 자동 계산');
await W.scene('input',16,async()=>{
  await W.sleep(1200);
  await W.type('#workerName','작업자 G',110);
  await W.click('.option-btn[data-value="박스"]',700);
  await W.click('.option-btn[data-value="세척"]',700);
  await W.p.evaluate(()=>document.querySelector('#qtyField')?.scrollIntoView({behavior:'smooth',block:'center'}));await W.sleep(800);
  await W.click('#quickQtyPlt button[data-qty="1"]',900);
  await W.toast('NEW','1 PLT · 09시간 입력 — 이 한 건이 서버(D1)에 저장됩니다',3600);
  await W.click('#submitBtn',1800);
},{hold:true});
await W.finish();

/* ── ② 플랫폼: 자동 집계 · 분석 ── */
await P.p.bringToFront();
await P.cap('② 자동 분석','입력이 곧바로 집계·분석됩니다','총 작업량 · 맨아워 · 시간당 생산성이 다시 계산되고, 작업자별 편차를 기준과 대조합니다');
await P.scene('after',13,async()=>{
  await P.toast('LIVE','자동 갱신은 60초 주기 — 시연에서는 ‘새로고침’으로 즉시 갱신',3800);
  await P.click(P.p.locator('#view button',{hasText:'새로고침'}).first(),2600);
  await P.p.evaluate(()=>{const e=[...document.querySelectorAll('#view .card')].find(c=>/AI 통합 브리핑/.test(c.innerText));if(e)e.scrollIntoView({behavior:'smooth',block:'center'});});
  await P.sleep(1600);
  await P.toast('편차','작업자 G 0.11 PLT/MH — 평균 대비 크게 낮음 → 자동 표시',4200);
},{hold:true});

/* ── ③ AI 판단·조치 ── */
await P.cap('③ 판단 · 조치','분석 결과가 판단과 조치로','인력 판단의 근거도 방금 입력까지 포함해 다시 계산됩니다 — 간접작업 실투입 5명 → 6명');
await P.scene('judge',11,async()=>{
  await go('track');
  await P.click(P.p.locator('#view button',{hasText:'간접작업'}).first(),1500);
  await P.toast('판단','기준: 작업자 생산성 편차 > 40% → 재배치·표준작업 교육',4200);
},{hold:true});

/* ── ④ 일일 운영보고 ── */
await P.cap('④ 보고서','일일 운영보고에 자동 반영','간접작업 줄이 추가되고, 금일조치에 “생산성 편차 확인”이 붙습니다');
await P.scene('report',13,async()=>{
  await go('reports');
  await P.p.evaluate(()=>{const e=[...document.querySelectorAll('#view *')].find(x=>x.children.length===0&&/^\s*간접/.test(x.textContent));});
  await P.sleep(1500);
  /* 새로 들어간 줄만 형광펜으로 짚는다(글자는 그대로, 표시만) */
  await P.p.addStyleTag({content:'::highlight(zhl){background-color:#ffe08a;color:#0d1a2b}'});
  await P.p.evaluate(()=>{const w=document.createTreeWalker(document.getElementById('view'),NodeFilter.SHOW_TEXT);const rs=[];let n;
    while((n=w.nextNode())){const t=n.textContent;for(const key of ['간접  P-BOX','P-BOX 생산성 편차 —','생산성 편차 확인']){const i=t.indexOf(key);if(i<0)continue;let e=t.indexOf('\n',i);if(e<0)e=t.length;const r=new Range();r.setStart(n,i);r.setEnd(n,e);rs.push(r);}}
    if(rs.length)CSS.highlights.set('zhl',new Highlight(...rs));});
  await P.sleep(2200);
  await P.click(P.p.locator('button',{hasText:'보고문 복사'}).first(),1200);
  await P.toast('보고','메신저 보고문 완성 — 취합 60분 → 5분',4200);
},{hold:true});
await P.finish();
await browser.close();
