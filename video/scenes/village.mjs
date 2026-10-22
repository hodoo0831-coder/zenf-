/**
 * 젠 필드 빌리지(3D 마을) 둘러보기 영상 — "지금도 진행 중" 구간.
 *   VILLAGE_HTML=<마을 index.html> WH_HTML=<포장재 창고 마을 html> THREE_JS=<three.min.js r128> ZEN_PIN=… node video/scenes/village.mjs <출력폴더>
 * 마을 파일과 three.js 는 레포에 없다(마을은 별도 제작물, three 는 CDN) — 경로를 환경변수로 넘긴다. CDN 요청은 THREE_JS 로 대신 응답한다.
 * 마을의 실시간 수치는 시험 백엔드(실제 Worker 코드)에 넣은 시연용 샘플이다.
 */
import path from 'path';
import fs from 'fs';
import {launch,session,ROOT} from '../lib.mjs';
import {seedPlatform} from '../seed.mjs';
const OUT=path.resolve(process.argv[2]||path.join(ROOT,'video','out'));
const V=process.env.VILLAGE_HTML, W=process.env.WH_HTML, T=process.env.THREE_JS;
if(!V||!W||!T)throw new Error('VILLAGE_HTML · WH_HTML · THREE_JS 환경변수가 필요합니다');
const three=fs.readFileSync(T);
const {browser,be}=await launch();await seedPlatform(be);

async function tour(name,file,stops,N,{wait=5000}={}){
  const s=await session(browser,be,name,OUT);
  await s.ctx.route(/three\.min\.js/,r=>r.fulfill({status:200,contentType:'application/javascript',body:three}));   // 나중에 등록한 라우트가 먼저 적용된다
  await s.open('file://'+file,wait);
  await s.sample(true);
  await s.p.addStyleTag({content:'#zcap2.rt{left:auto!important;right:46px!important;max-width:560px!important}'});   // 마을의 카드(좌하단)와 겹치지 않게 자막은 오른쪽
  const go=async(i)=>{await s.p.evaluate(([i,N])=>{const max=document.documentElement.scrollHeight-innerHeight;scrollTo({top:max*i/(N-1),behavior:'smooth'});},[i,N]);};
  for(const st of stops){
    await s.cap(...st.cap);await s.p.evaluate(()=>{const e=document.getElementById('zcap2');if(e)e.className='rt';});
    await s.scene(st.label,st.secs,async()=>{if(st.i!=null)await go(st.i);},{hold:true});
  }
  await s.finish();
}

/* ── ① 젠 필드 빌리지 : intro gate tower wh wash safety office lab bus about contact (11곳) ── */
if(!process.env.ONLY||process.env.ONLY==='village')await tour('village',V,[
  {label:'intro',i:0,secs:4,cap:['ZEN FIELD VILLAGE','지금도 진행 중 — 현장에서 만든 도구 23개가 사는 마을','운영 13 · 시범 6 · 구상 4 · 건물마다 도구가 살고 있습니다']},
  {label:'gate',i:1,secs:3,cap:['마을 입구','엑셀·카톡·종이 일보로 돌던 일을 데이터로','하나씩 앱으로 바꿔 온 도구들입니다']},
  {label:'tower',i:2,secs:4,cap:['관제탑 · ZEN Manufacturing','플랫폼의 해당 화면으로 바로 이동','건물 카드 → 컨트롤타워 (연동 진행 중)']},
  {label:'wh',i:3,secs:4,cap:['포장재 창고','창고가 언제 차는지 구역별로','현장 입력 앱(wh-stack)의 적치 수치를 마을에서도']},
  {label:'wash',i:4,secs:3,cap:['세척동','세척 실적을 현장에서 바로 입력','세척실 AI · P-BOX·오리콘 · 박스갈이 일보']},
  {label:'safety',i:5,secs:4,cap:['안전 광장','안전은 4대 지킴이가','젠키퍼 · 세이프체크 · 히트워치 · 세이프티 보이스']},
  {label:'lab',i:7,secs:3,cap:['AI 연구소','시범·구상 중인 새 도구들','ZEN AgentWorks · 일일 운영 관제 에이전트 · MSDS']},
],11);

/* ── ② 포장재 창고 적치 마을 : 12구역 3D ── */
if(!process.env.ONLY||process.env.ONLY==='whvillage')await tour('whvillage',W,[
  {label:'wh0',i:0,secs:3,cap:['포장재 창고 적치 마을 (제작 중)','12개 구역, 지금 몇 % 찼나','사업장 배치도 그대로 세운 3D 창고']},
  {label:'wh1',i:1,secs:4,cap:['전사 합계','적치 2,217 PLT · CAPA 대비 102.2%','CAPA 초과 구역과 반출 권고를 한눈에']},
  {label:'wh2',i:2,secs:3,cap:['FnC동 3개 층','한 건물에 세 구역이 층층이','층별 적치율과 CAPA 초과를 색으로']},
  {label:'end',i:9,secs:4,cap:['지금도 진행 중','플랫폼 11.1 + 마을 연동 배포 → 현장 시범','제니엘 제조사업부 사업3팀 · 감사합니다']},
],10);
await browser.close();
