/**
 * 플랫폼 화면 구간 녹화 — 한 편의 흐름(로그인→컨트롤타워→계획·예측→AI 판단·조치→판단 기준→기준·연동)과
 * 에이전트별 짧은 구간(세척·간접작업·창고·안전·분석)을 만든다. 현장 앱 구간(wash·pboxorikon·warehouse·safevoice)과
 * 영상에서 번갈아 이어 붙인다.
 *
 *   node video/scenes/platform.mjs <출력폴더> [main|clean|indirect|stock|safe|report|all]
 * 값은 로컬 시험 백엔드(실제 Worker 코드)에 시연용 샘플로 넣은 것이다. LIVE=1 이면 실제 서버로 나간다.
 */
import path from 'path';
import {launch,session,ROOT} from '../lib.mjs';
import {seedPlatform} from '../seed.mjs';
const OUT=path.resolve(process.argv[2]||path.join(ROOT,'video','out'));
const WHICH=process.argv[3]||'all';
const {browser,be}=await launch();
if(!process.env.LIVE)await seedPlatform(be);

/* 로그인은 영상 밖에서 먼저 해 두고(main 만 로그인 장면을 찍는다), 실시간 연동이 붙을 때까지 기다린다 */
async function open(name,{recordLogin=false}={}){
  const s=await session(browser,be,name,OUT);
  await s.open('file://'+path.join(ROOT,'index.html'),800);
  if(!recordLogin){
    await s.p.fill('input[type=password]','1996');await s.p.keyboard.press('Enter');
    await s.sleep(4500);
    await s.sample(true);
  }
  return s;
}
const goV=(s)=>async(id)=>{await s.p.evaluate(x=>go(x),id);await s.sleep(500);
  for(let i=0;i<3;i++){await s.p.evaluate(()=>{let e=document.getElementById('view');while(e&&e!==document.body){const o=getComputedStyle(e).overflowY;if((o==='auto'||o==='scroll')&&e.scrollHeight>e.clientHeight+20)break;e=e.parentElement;}(e&&e!==document.body?e:document.scrollingElement).scrollTo(0,0);});await s.sleep(400);}};
const tab=(s)=>async(v,t)=>{await s.p.evaluate(([v,t])=>setVtab(v,t),[v,t]);await s.sleep(500);};

async function main(){
  const s=await open('plat_main',{recordLogin:true});const go_=goV(s),tab_=tab(s);const {p}=s;
  const btn=(t)=>p.locator('#view button',{hasText:t}).first();
  await s.sample(true);
  await s.cap('ACCESS','역할 기반 접속','현장 · 관리자 · 센터 — 역할에 따라 보는 화면과 권한이 나뉩니다');
  await s.scene('login',9,async()=>{
    await s.sleep(1800);
    for(const r of ['현장','관리자','센터'])await s.click(p.locator('.roles button',{hasText:r}).first(),600);
    const pin=p.locator('input[type=password]').first();await s.click(pin,200);await p.keyboard.type('1996',{delay:200});await s.sleep(250);await p.keyboard.press('Enter');await s.sleep(4200);
  },{hold:true});
  await s.cap('CONTROL TOWER','컨트롤타워 — 현황을 한 화면에','생산·인력·세척·창고·안전·품질을 실측으로 종합하고, 오늘의 판단을 우선순위로 올립니다');
  await s.scene('home',10,async()=>{await go_('home');await s.toast('LIVE','실적·세척·창고·기상 4종이 60초마다 들어와 판단을 다시 계산합니다',6000);});
  await s.cap('계획 · 예측','주간계획 → 부하율 · 필요 인원','계획량 ÷ 인력 주간 캐파 = 그룹별 부하율, 부족·여유 인원과 재배치 추천까지');
  await s.scene('forecast',9,async()=>{await go_('forecast');await s.sleep(900);await tab_('forecast','load');await s.toast('엑셀','주간계획 엑셀을 올리면 날짜별 필요 인원도 산출합니다',5200);});
  await s.cap('AI 판단·조치','실측 → 기준 대조 → 판단 → 조치','판단마다 담당자와 기한이 붙은 티켓이 열립니다');
  await s.scene('track',16,async()=>{
    await go_('track');await s.sleep(900);
    await s.click(btn('미조치'),900);
    await s.toast('조치','담당자·기한을 지정해 조치를 생성하고, 착수 → 완료로 진행합니다',5200);
    await s.click(p.locator('#view button',{hasText:'조치 생성'}).first(),1100);
    await s.click(p.locator('#view button',{hasText:'완료'}).nth(1),1200).catch(()=>{});
    await s.toast('효과 확인','완료 버튼만으로 끝나지 않습니다 — 조건이 실제로 풀려야 "해소"로 바뀝니다',5200);
    await s.click(btn('전체'),500);
  });
  await s.cap('판단 기준 · 성과','코드화된 판단 룰 32개를 전부 공개','지금 발동 중인 룰은 실시간으로 표시되고, 임계 대비 현재값을 함께 보여줍니다');
  await s.scene('judge',10,async()=>{await go_('judge');await s.sleep(900);await s.click(btn('안전'),1100);await s.click(btn('전체'),400);});
  await s.cap('기준 · 연동','현장 시스템과 직결','실적 · 세척 · 창고 · 기상이 연결 상태와 함께 표시됩니다 — 끊기면 기준값을 유지하고 그렇다고 알려 줍니다');
  await s.scene('data',9,async()=>{await go_('data');await s.sleep(500);});
  await s.cap('ROLE','역할 전환','현장은 필요한 것만, 센터는 전체를 봅니다');
  await s.scene('role',6,async()=>{const rb=p.locator('[onclick^="switchRole"]');const n=await rb.count();
    await s.click(rb.first(),1700);await s.click(p.locator('[onclick^="switchRole"]').nth(n-1),1200);await go_('home');},{hold:true});
  await s.finish();
}

/* 에이전트별 짧은 구간 — 각 에이전트의 판단 화면을 보여 주고 곧바로 실제 앱 구간으로 넘어간다 */
const AG={
  clean:   {tab:'clean',   cap:['AGENT · 세척','세척 우선순위 자동 추천','제품·색상 전환 40% · 세척주기 35% · 생산부하 25% — 점수로 배차'],secs:7},
  indirect:{tab:'orikonwash',cap:['AGENT · 간접작업','오리콘 · P-BOX 실적 통합관리','현장 모바일 입력이 5초 주기로 자동 집계 · 기준 대비 편차를 판단 센터로'],secs:7},
  stock:   {tab:'stock',   cap:['AGENT · 창고','구역별 적치 · 포화 예측','현장 입력 앱의 실측 12구역 → 권장 입고 · 재배치'],secs:7},
  safe:    {tab:'safe',    cap:['AGENT · 안전','TBM · 폭염 · 위험요인','체감온도와 신고 현황을 한 화면에서 판단'],secs:7},
  report:  {tab:'insight', cap:['AGENT · 분석·보고','월 마감 자동 분석','매출·물량·단가·증감과 이상치를 자동 분석해 경영 보고서로'],secs:6},
};
async function agent(k){
  const a=AG[k];const s=await open('plat_'+k);const go_=goV(s);
  await s.cap(...a.cap);
  await s.scene(k,a.secs,async()=>{await go_(a.tab);await s.sleep(400);},{hold:true});
  await s.finish();
}

const jobs=WHICH==='all'?['main',...Object.keys(AG)]:[WHICH];
for(const j of jobs){if(j==='main')await main();else await agent(j);}
await browser.close();
