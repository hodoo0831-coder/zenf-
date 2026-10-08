/**
 * 젠프 히트워치 구간 — 공장 위치 기준 체감온도 판정 · 현장 수기 입력 · 알람 · 확인 체크 → 관리자 시간별 기록 · PDF 보고서
 *
 *   node video/scenes/heatwatch.mjs <출력폴더>      → <출력폴더>/seg_heatwatch.webm + seg_heatwatch.json
 *   SHOTS=<폴더> …                                  장면별 스크린샷 저장
 *
 * 데이터 원칙 (이 환경은 외부 네트워크가 막혀 있다)
 *  - 앱(ZEN_HeatWatch.html)은 file:// 로 그대로 연다. 판정·단계·알람·차트·표·PDF 내용은 모두 앱 코드가 계산한다.
 *  - 앱이 실제로 쓰는 요청 3종만 Playwright 라우트로 "시연용 고정 응답"을 준다(화면에 "시연용 샘플 데이터" 표시).
 *      · kma-proxy.hodoo0831.workers.dev          기상청 실황(기온·습도)  — 33.4℃ / 습도 57 %
 *      · api.open-meteo.com  (hourly, past_days=7)  관리자 시간별 기록용 8일치 시간별 기온·습도 (결정적 곡선)
 *      · heat-push.hodoo0831.workers.dev          /ack(확인 기록) · /acks · /log(알림 발송 기록) — 메모리 서버
 *    실황 응답은 시간별 곡선의 "오늘 15시" 값과 같다 → 작업자 화면과 관리자 기록의 값이 서로 맞는다.
 *  - 시연 시각은 브라우저 시계를 2026-08-12 15:20(무더위 시간대)로 맞춘다. 영상 속 날짜·요일은 모두 앱이 그 시계로 계산한다.
 *  - 관리자 PIN 은 화면에 입력하지 않는다. 앱은 세션 저장값이 없어(닫힌 변수) PIN 창을 CSS 로 가려 두고,
 *    앱 소스에서 읽은 PIN 을 앱의 정상 경로(#pinInput → #pinOk 클릭)로 넣어 통과시킨다. 공유(카톡) 기능은 PIN 이 따로 있어 쓰지 않는다.
 *  - 푸시 구독(알림 켜기)·카톡 공유·실제 인쇄 대화상자는 쓰지 않는다. 알람은 앱의 화면 배너만 보인다.
 *  - PDF 는 앱이 만든 보고서 영역(#printArea)을 종이 모양 미리보기로 띄워 보여준다(window.print 는 막아 둔다).
 *  - 푸터의 개발자 실명이 나오지 않게 스크롤 위치를 조정한다. 확인 체크는 "작업자 A" 로 입력한다.
 */
import {launch,session,ROOT} from '../lib.mjs';
import fs from 'fs';
import os from 'os';
import path from 'path';

const OUT=path.resolve(process.argv[2]||path.join(ROOT,'video','out'));
const APP='file://'+path.join(ROOT,'ZEN_HeatWatch.html');
const TAG='SYSTEM · 히트워치';
const src=fs.readFileSync(path.join(ROOT,'ZEN_HeatWatch.html'),'utf8');
const PIN=(src.match(/const PIN='([^']+)'/)||[])[1];
if(!PIN)throw new Error('앱 소스에서 PIN 상수를 찾지 못함');

/* ───────── 시연 시각 · 시간별 기상 곡선 (결정적) ───────── */
const NOW=new Date(2026,7,12,15,20,0);                       // 2026-08-12(수) 15:20
const T_ZERO=Date.now();
const fakeNow=()=>new Date(NOW.getTime()+(Date.now()-T_ZERO));
const pad=(n)=>String(n).padStart(2,'0');
const ymd=(d)=>d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
const PEAK=[31.4,32.6,34.0,35.8,37.4,35.2,33.9,33.4];        // 7일 전 … 오늘(15시 최고)
const RHMIN=[60,58,55,51,47,52,55,57];                       // 일 최저 습도(최고기온 때)
const r1=(x)=>Math.round(x*10)/10;
function weather(dayIdx,h){
  const tmax=PEAK[dayIdx],tmin=tmax-7.5,rmax=90,rmin=RHMIN[dayIdx];
  const f=0.5*(1+Math.cos(2*Math.PI*(h-15)/24));
  return {t:r1(tmin+(tmax-tmin)*f),rh:Math.round(rmax-(rmax-rmin)*f)};
}
const dayStr=(idx)=>{const d=new Date(NOW);d.setDate(d.getDate()-(7-idx));return ymd(d);};
const hourly=()=>{const time=[],t=[],rh=[];
  for(let i=0;i<8;i++)for(let h=0;h<24;h++){const w=weather(i,h);time.push(dayStr(i)+'T'+pad(h)+':00');t.push(w.t);rh.push(w.rh);}
  return {hourly:{time,temperature_2m:t,relative_humidity_2m:rh}};};
const live=weather(7,15);
/* 푸시 서버 흉내용 — 앱과 같은 판정 기준(기상청 체감온도 공식)으로 단계를 매겨 샘플 기록을 만든다 */
const wetBulb=(Ta,RH)=>Ta*Math.atan(0.151977*Math.sqrt(RH+8.313659))+Math.atan(Ta+RH)-Math.atan(RH-1.67633)+0.00391838*Math.pow(RH,1.5)*Math.atan(0.023101*RH)-4.686035;
const apparent=(Ta,RH)=>{const Tw=wetBulb(Ta,RH);return -0.2442+0.55399*Tw+0.45535*Ta-0.0022*Tw*Tw+0.00278*Tw*Ta+3.0;};
const stageName=(a)=>a>=38?'위험':a>=35?'경고':a>=33?'주의':a>=31?'관심':'정상';
const atOf=(i,h)=>{const w=weather(i,h);return r1(apparent(w.t,w.rh));};
const acks=[];const pushLog=[];
{ // 샘플 확인 기록(오늘 낮 · 어제)과 알림 발송 기록
  const add=(i,h,m,name)=>{const a=atOf(i,h);acks.push({name,at:a,stage:stageName(a),time:dayStr(i)+' '+pad(h)+':'+pad(m)+':00'});};
  add(6,13,12,'작업자 B');add(6,14,5,'작업자 C');add(7,13,8,'작업자 D');add(7,14,3,'작업자 B');
  acks.sort((x,y)=>y.time.localeCompare(x.time));
  for(const i of [6,7]){let prev=-1;
    for(let h=9;h<=(i===7?15:17);h++){const a=atOf(i,h),st=['정상','관심','주의','경고','위험'].indexOf(stageName(a));
      const periodic=h===9||h===13;const esc=st>prev&&st>=1;
      if(esc||periodic)pushLog.push({time:dayStr(i)+' '+pad(h)+':00:00',stage:stageName(a),at:a,sent:14,escalated:esc||undefined,periodic:(!esc&&periodic)||undefined});
      prev=Math.max(prev,st);}}
  pushLog.sort((x,y)=>y.time.localeCompare(x.time));
}

/* ───────── 시작 ───────── */
fs.mkdirSync(OUT,{recursive:true});
const TMP=fs.mkdtempSync(path.join(os.tmpdir(),'zen_heat_'));
if(!process.env.HEAT_NOWAIT){const w0=Date.now();while(os.loadavg()[0]>3.5&&Date.now()-w0<90000)await new Promise(r=>setTimeout(r,2000));   // 다른 녹화로 CPU 가 바쁘면 동작이 늘어지므로 잠시 기다린다(최대 90초)
  if(Date.now()-w0>2500)console.log('  (부하 대기 '+Math.round((Date.now()-w0)/1000)+'초, load '+os.loadavg()[0].toFixed(1)+')');}
const {browser,be}=await launch();
const initScript=`(function(){
  var css=function(t){var add=function(){var st=document.createElement('style');st.textContent=t;(document.head||document.documentElement).appendChild(st);};
    if(document.documentElement)add();else{var mo=new MutationObserver(function(){if(document.documentElement){mo.disconnect();add();}});mo.observe(document,{childList:true});}};
  css('#splash{display:none!important}'                                  /* 스플래시는 영상에서 생략 */
    +'#pinbg{visibility:hidden!important}'                               /* PIN 창은 화면에 보이지 않게 */
    +'#zcap2{left:28px!important;max-width:296px!important}#zcap2 .h{font-size:23px!important}#zcap2 .s{font-size:14px!important}'   /* 자막이 가운데 앱 열(≈340~1100px)을 가리지 않게 왼쪽 여백에 */
    +'#ztoast{right:18px!important;top:24px!important}#ztoast .k{max-width:300px!important}');
  window.print=function(){};                                             /* 인쇄 대화상자 막기 — PDF 는 미리보기로 보여줌 */
})();`;
const s=await session(browser,be,'heatwatch',TMP,{initScript});
const {p,sleep}=s;
await s.ctx.clock.install({time:NOW});

/* ───────── 시연용 고정 응답 라우트 (lib 의 기본 라우트보다 나중에 등록 → 우선) ───────── */
const CORS={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'GET,POST,OPTIONS'};
const json=(route,obj,status=200)=>route.fulfill({status,headers:CORS,contentType:'application/json',body:JSON.stringify(obj)});
await s.ctx.route(/^https:\/\/(api\.open-meteo\.com|kma-proxy\.hodoo0831\.workers\.dev|heat-push\.hodoo0831\.workers\.dev)\//,async route=>{
  const req=route.request(),u=new URL(req.url());
  if(req.method()==='OPTIONS')return route.fulfill({status:204,headers:CORS});
  if(u.hostname==='kma-proxy.hodoo0831.workers.dev')return json(route,{temp:live.t,rh:live.rh,baseTime:'1500'});
  if(u.hostname==='api.open-meteo.com'){
    if(u.searchParams.get('hourly'))return json(route,hourly());
    return json(route,{current:{time:ymd(NOW)+'T15:00',temperature_2m:live.t,relative_humidity_2m:live.rh}});
  }
  if(u.pathname==='/log')return json(route,{log:pushLog});
  if(u.pathname==='/acks')return json(route,acks);
  if(u.pathname==='/ack'&&req.method()==='POST'){
    const b=JSON.parse(req.postData()||'{}');const d=fakeNow();
    acks.unshift({name:String(b.name||''),at:b.at,stage:b.stage,time:ymd(d)+' '+pad(d.getHours())+':'+pad(d.getMinutes())+':00'});
    return json(route,{ok:true});
  }
  return json(route,{ok:false},404);
});

/* ───────── 도구 ───────── */
const txt=async(sel)=>(await p.locator(sel).first().innerText()).trim();
const num=async(sel)=>parseFloat(await txt(sel));
const hover=async(loc,steps=14)=>{const bb=await (typeof loc==='string'?p.locator(loc).first():loc).boundingBox();if(bb)await p.mouse.move(bb.x+bb.width/2,bb.y+bb.height/2,{steps});};
const tap=async(loc,pause=350,steps=14)=>{const l=typeof loc==='string'?p.locator(loc).first():loc;
  try{const bb=await l.boundingBox();if(!bb)return false;
    await p.mouse.move(bb.x+bb.width/2,bb.y+bb.height/2,{steps});await sleep(90);await p.mouse.down();await sleep(60);await p.mouse.up();await sleep(pause);return true;}
  catch(e){console.log('  (탭 실패)',String(e).split('\n')[0].slice(0,100));return false;}};
const smoothTo=(y)=>p.evaluate(y=>window.scrollTo({top:y,behavior:'smooth'}),y);
/** 슬라이더 엄지 위치(값→x) */
const thumbX=(bb,v,min,max)=>bb.x+13+(v-min)/(max-min)*(bb.width-26);
async function drag(sel,from,to,min,max,ms){                              // 시간 기준으로 움직여 부하가 있어도 길이가 일정
  const bb=await p.locator(sel).boundingBox();const y=bb.y+bb.height/2;
  await p.mouse.move(thumbX(bb,from,min,max),y,{steps:8});await sleep(100);await p.mouse.down();
  const t0=Date.now();let f=0;
  while(f<1){f=Math.min(1,(Date.now()-t0)/ms);const e=f;await p.mouse.move(thumbX(bb,from+(to-from)*e,min,max),y);await sleep(30);}
  await p.mouse.up();await sleep(120);
}

/* ═════════ 장면 1 — 작업자 화면: 위치 · 실황 · 판정 ═════════ */
const L0=Date.now();const lap=(t)=>{if(process.env.LAPS)console.log('   lap',t,Date.now()-L0);};
await s.open(APP,250);
await p.waitForSelector('#status.live',{timeout:8000});await sleep(300);
await s.sample(true);
await p.mouse.move(900,420,{steps:2});
const locName=await txt('.chip.sel .cl');
const sub1=await txt('#sSub');                                           // "15:00 실황 (기상청 실황) · 기온 33.4℃ / 습도 57%"
const clock=await txt('#clockTxt');
await s.cap(TAG,'공장 위치 기준 실시간 체감온도',`${locName} · ${sub1}`);
await s.shot('1a_live');
await s.scene("live",4.8,async()=>{
  await hover('.chip.sel',9);await sleep(250);
  await s.toast('AUTO','기상청 초단기실황으로 10분마다 자동 갱신 — 장애 시 기상모델로 자동 대체',3300);
  await sleep(500);lap('s1 chip');
  await hover('#clock',8);
  await s.toast('시간대',`무더위 시간대(14~17시)는 시계가 주황색으로 — 지금 ${clock}`,2600);
  await sleep(700);lap('s1 clock');
  await smoothTo(380);await sleep(800);                                  // 아래로 — 슬라이더·체감온도 카드가 한 화면에
  const at=await txt('#atV'),bd=await txt('#badge'),title=await txt('#actTitle');
  await hover('#result',8);
  await s.cap(TAG,`체감온도 ${at}℃ — ‘${bd}’ 단계`,`기온·습도로 기상청 체감온도식을 계산 → ${title}`);
  await s.shot('1b_result');lap('s1 result');
},{hold:true});

/* ═════════ 장면 2 — 현장 상황대로 수기 입력 → 단계 변화 · 알람 · 확인 체크 ═════════ */
const t0=await num('#tempV'),h0=await num('#rhV');
await s.cap(TAG,'현장 상황대로 직접 입력',`기온 ${t0.toFixed(1)}℃ · 습도 ${h0}% — 슬라이더를 움직이면 체감온도와 단계가 즉시 다시 계산됩니다`);
let banner='';
await s.scene("manual",9.0,async()=>{
  await s.toast('수기','기온·습도를 직접 조정 — 실시간 복귀는 [갱신]',2800);
  await drag("#temp",t0,38.8,20,45,1900);lap('s2 drag');
  const at=await txt('#atV'),bd=await txt('#badge'),tt=await txt('#tempV'),act=await txt('#actTitle');
  await s.cap(TAG,`기온 ${tt}℃ → 체감 ${at}℃ ‘${bd}’`,`${act} — 단계별 색과 조치 안내가 바뀝니다`);
  await s.shot('2a_danger');
  await sleep(650);lap('s2 danger');
  /* 알람 기준 */
  await tap('#alarmSel',150,9);await p.keyboard.press('Escape').catch(()=>{});
  await p.selectOption('#alarmSel','33');await sleep(150);
  banner=await txt('#abTitle');
  await smoothTo(0);                                                       // 배너는 문서 맨 위에 생긴다
  await s.cap(TAG,'기준 이상이면 즉시 알람','알람 기준 ‘주의 33℃’ — 화면 배너와 함께 경고음·진동·푸시 알림');
  await s.toast('ALARM',banner,3000);
  await sleep(900);await s.shot('2b_alarm');lap('s2 alarm');
  await sleep(500);
  /* 확인 체크 */
  await p.evaluate(()=>document.getElementById('ackCard').scrollIntoView({block:'center',behavior:'smooth'}));await sleep(800);
  await s.cap(TAG,'알림 확인 체크','“확인했습니다”를 누르면 이름·시각이 서버에 기록되어 관리자가 확인합니다');
  await tap('#ackName',100,8);await p.keyboard.type('작업자 A',{delay:70});await sleep(150);
  await tap('#ackBtn',200,8);
  await s.shot('2c_ack');lap('s2 ack');
},{hold:true});
console.log('  배너:',banner);

/* ═════════ 장면 3 — 관리자: 시간별 기록 · 그래프 · 확인 현황 · PDF ═════════ */
await s.cap(TAG,'관리자 — 시간별 기록','[관리자 · 시간별 기록] 버튼 — PIN 으로 보호');
await s.scene("admin",12.2,async()=>{
  /* 페이지를 내려 단계별 조치 기준표를 지나 관리자 버튼으로 (푸터 개발자 표기는 화면 밖) */
  await p.evaluate(()=>{const r=document.getElementById('adminOpen').getBoundingClientRect();window.scrollTo({top:window.scrollY+r.bottom-868,behavior:'smooth'});});
  await sleep(1000);
  await tap('#adminOpen',150,10);
  await p.evaluate((pin)=>{document.getElementById('pinInput').value=pin;document.getElementById('pinOk').click();},PIN);    // PIN 창은 CSS 로 가려져 있음
  await p.waitForSelector('#admin.show .sum-card',{timeout:6000});await sleep(150);
  const mx=(await txt('#admSum .sum-card:nth-child(1) .sv')).replace(/\s+/g,' ');
  await s.cap(TAG,'시간별 체감온도 기록',`최근 7일 · 1시간 단위 — 오늘 일 최고 체감 ${mx}, 이후 시간은 예보(흐리게)`);
  await s.toast('AUTO','기상 API 시간별 자료를 체감온도로 환산해 단계별 색으로 표시',2800);
  await s.shot('3a_dash');lap('s3 dash');
  await sleep(900);
  /* 가장 더웠던 날 */
  await tap(p.locator('.adm-tab').nth(3),250,10);
  const tabTxt=await txt('.adm-tab.sel');
  const mx2=(await txt('#admSum .sum-card:nth-child(1) .sv')).replace(/\s+/g,' ');
  const cw=(await txt('#admSum .sum-card:nth-child(2) .sv')).replace(/\s+/g,''),cd=(await txt('#admSum .sum-card:nth-child(3) .sv')).replace(/\s+/g,'');
  await s.cap(TAG,`${tabTxt} — 경고 이상 시간 확인`,`일 최고 ${mx2} · 경고(35℃↑) ${cw} · 위험(38℃↑) ${cd}`);
  await s.shot('3b_hotday');lap('s3 hot');
  await sleep(1000);
  /* 시간별 표 */
  await tap(p.locator('.adm-view-btn[data-v="table"]'),200,10);
  await s.cap(TAG,'시간별 표 — 기온·습도·체감온도·단계','경고 이상 시간대는 숫자 색으로 눈에 띄게 표시');
  await p.evaluate(()=>document.querySelector('.adm-body').scrollTo({top:330,behavior:'smooth'}));await sleep(1300);
  await s.shot('3c_table');lap('s3 table');
  /* 확인 현황 */
  await p.evaluate(()=>document.querySelector('.adm-body').scrollTo({top:0,behavior:'smooth'}));await sleep(550);
  await tap(p.locator('.adm-view-btn[data-v="ack"]'),500,10);
  const firstAck=await txt('#admAck .sh-row:nth-child(3)');
  await s.cap(TAG,'확인 현황 — 누가 언제 확인했나','방금 작업자 화면에서 누른 확인이 맨 위에 기록됩니다');
  await s.shot('3d_ack');lap('s3 ack');
  console.log('  확인 현황 첫 행:',firstAck.replace(/\s+/g,' '));
  await sleep(700);
  /* PDF */
  await tap('#admPdf',200,10);
  await p.evaluate(()=>{const st=document.createElement('style');
    st.textContent='#printArea{display:block!important;position:fixed;top:18px;left:50%;margin-left:-380px;width:760px;height:864px;overflow:auto;background:#fff;padding:34px 38px;z-index:70;box-shadow:0 0 0 3000px rgba(15,36,56,.6),0 20px 60px rgba(0,0,0,.4)}#printArea svg.chart{max-height:230px}';
    document.head.appendChild(st);});
  await s.cap(TAG,'PDF 보고서','일 최고 체감·경고/위험 시간·차트·시간별 표를 A4 일일기록으로 — 인쇄 또는 PDF 저장');
  await s.toast('PDF','[PDF] 버튼 한 번으로 일일 보고서 생성',3000);
  await s.shot('3e_pdf');lap('s3 pdf');
  await sleep(900);
  await p.evaluate(()=>document.getElementById('printArea').scrollTo({top:430,behavior:'smooth'}));
},{hold:true});

/* 끝내기 */
await s.finish();
fs.copyFileSync(path.join(TMP,'seg_heatwatch.webm'),path.join(OUT,'seg_heatwatch.webm'));
fs.copyFileSync(path.join(TMP,'seg_heatwatch.json'),path.join(OUT,'seg_heatwatch.json'));
fs.rmSync(TMP,{recursive:true,force:true});
await browser.close();
const tot=JSON.parse(fs.readFileSync(path.join(OUT,'seg_heatwatch.json'),'utf8')).reduce((a,m)=>a+(m.end-m.start),0);
console.log('완료 →',path.join(OUT,'seg_heatwatch.webm'),'· 장면 합계',tot.toFixed(1)+'초');
process.exit(0);
