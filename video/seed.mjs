/**
 * 플랫폼 구간용 시연 샘플 데이터 — 실제 Worker 코드의 API 로만 넣는다.
 * (현장 앱 구간 스크립트는 각자 앱에 맞는 데이터를 따로 넣는다.)
 */
const PBOX='pbox-orikon-db.hodoo0831.workers.dev', WASH='wash-db.hodoo0831.workers.dev', WH='wh-stack.hodoo0831.workers.dev';

const ymd=(d)=>d.toISOString().slice(0,10);
function lastWorkdays(n,from=new Date()){const out=[];const d=new Date(from);while(out.length<n){if(d.getDay()!==0&&d.getDay()!==6)out.push(ymd(d));d.setDate(d.getDate()-1);}return out.reverse();}
/* 결정적 의사난수 — 실행할 때마다 같은 샘플이 나오게 */
const rnd=(()=>{let s=20261008;return()=>{s=(s*1664525+1013904223)>>>0;return s/4294967296;};})();

export async function seedPlatform(be){
  /* ① P-BOX · 오리콘 실적 — 최근 10 영업일, 작업자는 익명 */
  const days=lastWorkdays(10);const names=['작업자 A','작업자 B','작업자 C','작업자 D','작업자 E','작업자 F'];
  for(const [i,d] of days.entries()){
    for(const sys of ['P-BOX','오리콘']){
      const n=3+Math.floor(rnd()*3);
      for(let k=0;k<n;k++){
        const w=names[Math.floor(rnd()*names.length)],w2=rnd()<.3?names[Math.floor(rnd()*names.length)]:'';
        const worker=w2&&w2!==w?w+'+'+w2:w;const wc=worker.includes('+')?2:1;
        const mh=+(1.5+rnd()*2.5).toFixed(1);let plt=+(mh*(sys==='P-BOX'?3.6:2.9)*(0.8+rnd()*0.4)).toFixed(1);
        if(i===days.length-3&&k===0)plt=+(plt*0.45).toFixed(1);               // 편차 큰 건 1건(이상 감지용)
        await be.call(PBOX,'/records',{method:'POST',body:{id:(sys==='P-BOX'?'pbox_':'oricon_')+d+'_'+k,system:sys,date:d,worker,worker_count:wc,
          part:sys==='P-BOX'?(rnd()<.5?'박스':'커버'):'박스',work_type:sys==='P-BOX'?(rnd()<.6?'세척':'간지'):(['세척','분류','수리'][Math.floor(rnd()*3)]),
          qty_plt:plt,qty_ea:Math.round(plt*118),input_unit:'PLT',man_hour:mh,created_at:d+'T0'+(7+k)+':30:00.000Z'}});
      }
    }
  }
  /* ② 창고 적치 — 12개 구역, 일부는 CAPA 초과 */
  const Z=[['hnb1','HnB동 1층',627,.87],['fnc2','FnC동 2층 튜브',242,1.14],['fnc3','FnC동 3층 염모제',155,.83],['lbox','L동 박스창고',481,.68],
    ['jig','J동 공작반 2층',85,.87],['tent','임가공[천막]',148,.95],['oc1p','OC동 1층 종이상자+기타',136,1.08],['oc1t','OC동 1층 튜브',72,.74],
    ['ocb','OC동 지하 A구역',136,.79],['ocbb','OC동 지하 B구역',37,.62],['occ','OC동 지하 C구역',12,.58],['cloud','클라우드동',38,.5]];
  const today=ymd(new Date());
  for(const [k,name,capa,rate] of Z)
    await be.call(WH,'/api/submit',{method:'POST',body:{date:today,zone:k,worker:'작업자 A',note:'',items:[{loc:name+' 로케이션 1',capa,qty:Math.round(capa*rate)}]}});
  /* ③ 세척실 — 대기 1 · 세척중 1 · 최근 완료 기록 */
  const now=Date.now();
  const rec=(line,group,wait,wash,ago)=>({id:now-ago,date:ymd(new Date(now-ago)),line,group,category:group,arrivedAt:new Date(now-ago-(wait+wash)*60000).toISOString(),
    startTime:new Date(now-ago-wash*60000).toISOString(),endTime:new Date(now-ago).toISOString(),waitMin:wait,washMin:wash,totalMin:wait+wash,delayMin:0,workers:2});
  await be.call(WASH,'/api/state',{method:'POST',body:{
    waiting:{'직선|동기화 직선13호':{line:'동기화 직선13호',group:'직선',arrivedAt:new Date(now-38*60000).toISOString()}},
    washing:{'염모제|염모제2호':{line:'염모제2호',group:'염모제',startTime:new Date(now-12*60000).toISOString(),arrivedAt:new Date(now-30*60000).toISOString()}},
    records:[rec('직선1호','직선',10,34,3*3600e3),rec('튜브3호','튜브',6,41,5*3600e3),rec('치약충전1호','치약',14,38,8*3600e3),rec('HnB2호','HnB기타',9,33,26*3600e3),rec('직선4호','직선',12,36,28*3600e3)]}});
}
