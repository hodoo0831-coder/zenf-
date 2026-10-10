/* 내장 앱 데이터는 파일 맨 뒤 <script type=text/plain> 블록에 둔다. 메인 스크립트가 6MB 를 다 받아야 실행되던 것을 막아
   로그인이 일찍 열리게 한다. 데이터는 필요할 때 읽고, 아직 안 왔으면 빈 값을 돌려준다. */
function _zd(n){var e=document.getElementById('zd-'+n);return e?e.textContent:'';}
window.addEventListener('load',function(){ /* 데이터가 늦게 와서 빈 칸으로 그려졌던 화면만 다시 그린다 — 입력 중인 화면은 건드리지 않는다 */
  try{ if(typeof cur!=='undefined'&&cur&&document.querySelector('#view iframe[src="about:blank"]'))go(cur); }catch(e){} });
function _dataReady(){return document.readyState==='complete'?Promise.resolve():new Promise(function(r){window.addEventListener('load',r,{once:true});});}

/* ============ CHART HELPERS ============ */
function gauge(pct,{color='#22a05f',size=150}={}){
  const r=60,cx=80,cy=80,f=Math.max(0,Math.min(1,pct/100)),a=Math.PI*(1-f);
  const x=(cx+r*Math.cos(a)).toFixed(1),y=(cy-r*Math.sin(a)).toFixed(1);
  return `<svg viewBox="0 0 160 92" width="${size}" style="display:block"><path d="M20 80 A60 60 0 0 1 140 80" fill="none" stroke="#e2e8f0" stroke-width="12" stroke-linecap="round"/><path d="M20 80 A60 60 0 0 1 ${x} ${y}" fill="none" stroke="${color}" stroke-width="12" stroke-linecap="round"/></svg>`;
}
function donut(segs,{size=130,center='',centerSub=''}={}){
  let acc=0,st=[];segs.forEach(s=>{const f=acc;acc+=s.pct;st.push(`${s.color} ${f}% ${acc}%`);});
  if(acc<100)st.push(`#e5ebf2 ${acc}% 100%`);
  return `<div class="donut" style="width:${size}px;height:${size}px;background:conic-gradient(${st.join(',')})"><div style="position:absolute;inset:15px;border-radius:50%;background:#ffffff"></div><div class="mid"><span class="t">${centerSub}</span><span class="n">${center}</span></div></div>`;
}
function lineChart(data,{w=560,h=200,max,min=0,pad={l:34,r:16,t:18,b:26},stroke='#3b82f6',fill='#3b82f633',showVals=true,colorAt,grid=4}={}){
  const mx=max ?? (Math.ceil(Math.max(...data.map(d=>d.v))*1.15)||1);
  const iw=w-pad.l-pad.r,ih=h-pad.t-pad.b;
  const X=i=>pad.l+(data.length<2?iw/2:(i/(data.length-1))*iw);
  const Y=v=>pad.t+(1-(v-min)/(mx-min))*ih;
  let g='';
  for(let k=0;k<=grid;k++){const gv=min+(mx-min)*k/grid,y=Y(gv);g+=`<line x1="${pad.l}" y1="${y}" x2="${w-pad.r}" y2="${y}" stroke="#e2e8f0"/><text x="${pad.l-6}" y="${y+3}" font-size="10.5" font-weight="600" text-anchor="end" fill="#5b6b82">${Math.round(gv)}</text>`;}
  const pts=data.map((d,i)=>[X(i),Y(d.v)]);
  const line=pts.map((p,i)=>(i?'L':'M')+p[0].toFixed(1)+' '+p[1].toFixed(1)).join(' ');
  const area=`M${pts[0][0]} ${Y(min)} `+pts.map(p=>`L${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ')+` L${pts[pts.length-1][0]} ${Y(min)} Z`;
  g+=`<path d="${area}" fill="${fill}"/><path d="${line}" fill="none" stroke="${stroke}" stroke-width="2.4" stroke-linejoin="round"/>`;
  data.forEach((d,i)=>{const c=colorAt?colorAt(d.v,d):stroke;g+=`<circle cx="${X(i)}" cy="${Y(d.v)}" r="3.2" fill="${c}" stroke="#ffffff" stroke-width="1.4"/>`;if(showVals)g+=`<text x="${X(i)}" y="${Y(d.v)-8}" font-size="11" font-weight="800" text-anchor="middle" fill="${c}">${d.v}${d.suffix||''}</text>`;g+=`<text x="${X(i)}" y="${h-8}" font-size="9.8" font-weight="600" text-anchor="middle" fill="#5b6b82">${d.label}</text>`;g+=`<circle cx="${X(i)}" cy="${Y(d.v)}" r="11" fill="transparent" style="cursor:pointer" onmousemove='chtip(event,${JSON.stringify(String(d.label||"")+" · "+d.v+(d.suffix||""))})' onmouseout="chtipHide()"/>`;});
  return `<svg viewBox="0 0 ${w} ${h}" style="width:100%;height:auto">${g}</svg>`;
}
function barsChart(data,{w=560,h=200,max,pad={l:34,r:14,t:16,b:26},grid=4}={}){
  const mx=max ?? (Math.ceil(Math.max(...data.map(d=>d.v))*1.12)||1);
  const iw=w-pad.l-pad.r,ih=h-pad.t-pad.b,bw=iw/data.length*0.56;
  const X=i=>pad.l+(i+0.5)/data.length*iw,Y=v=>pad.t+(1-v/mx)*ih;
  let g='';
  for(let k=0;k<=grid;k++){const gv=mx*k/grid,y=Y(gv);g+=`<line x1="${pad.l}" y1="${y}" x2="${w-pad.r}" y2="${y}" stroke="#e2e8f0"/><text x="${pad.l-6}" y="${y+3}" font-size="10.5" font-weight="600" text-anchor="end" fill="#5b6b82">${Math.round(gv)}</text>`;}
  data.forEach((d,i)=>{const x=X(i)-bw/2,y=Y(d.v),bh=pad.t+ih-y;g+=`<rect x="${x}" y="${y}" width="${bw}" height="${bh}" rx="3" fill="${d.color||'#3b82f6'}"/><text x="${X(i)}" y="${y-6}" font-size="11" font-weight="800" text-anchor="middle" fill="${d.color||'#7fb8ff'}">${d.v}${d.suffix||''}</text><text x="${X(i)}" y="${h-8}" font-size="9.8" font-weight="600" text-anchor="middle" fill="#5b6b82">${d.label}</text><rect x="${X(i)-iw/data.length/2}" y="${pad.t}" width="${iw/data.length}" height="${ih}" fill="transparent" style="cursor:pointer" onmousemove='chtip(event,${JSON.stringify(String(d.label||"")+" · "+d.v+(d.suffix||""))})' onmouseout="chtipHide()"/>`;});
  return `<svg viewBox="0 0 ${w} ${h}" style="width:100%;height:auto">${g}</svg>`;
}
function pbar(pct,color){return `<div class="pbar"><i style="width:${Math.max(0,Math.min(100,pct))}%;background:${color}"></i></div>`;}
function spark(vals,{w=110,h=30,color='#3f74b5',fill}={}){
  if(!vals||!vals.length)return '';const mn=Math.min(...vals),mx=Math.max(...vals),rng=(mx-mn)||1;
  const X=i=>(vals.length<2?w/2:i/(vals.length-1)*w),Y=v=>h-3-((v-mn)/rng)*(h-6);
  const pts=vals.map((v,i)=>[X(i),Y(v)]);
  const line=pts.map((p,i)=>(i?'L':'M')+p[0].toFixed(1)+' '+p[1].toFixed(1)).join(' ');
  const area=`M0 ${h} `+pts.map(p=>`L${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ')+` L${w} ${h} Z`;
  const last=pts[pts.length-1];
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" width="100%" height="${h}" preserveAspectRatio="none"><path d="${area}" fill="${fill||color+'20'}"/><path d="${line}" fill="none" stroke="${color}" stroke-width="1.8" stroke-linejoin="round" vector-effect="non-scaling-stroke"/><circle cx="${last[0].toFixed(1)}" cy="${last[1].toFixed(1)}" r="2.4" fill="${color}"/></svg>`;
}
function pi(cls){return `<svg class="pi ${cls}" width="14" height="14" viewBox="0 0 24 24"><path fill="currentColor" d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm0 1.8c-3.4 0-8 1.7-8 5.1V21h16v-2.1c0-3.4-4.6-5.1-8-5.1Z"/></svg>`;}
function sc(v,warn,bad,invert){if(invert)return v>=bad?'#dc4b4b':v>=warn?'#d98a2b':'#22a05f';return v<=bad?'#dc4b4b':v<=warn?'#d98a2b':'#22a05f';}
function toast(m){const t=document.getElementById('toast');t.textContent=m;t.classList.add('show');clearTimeout(t._t);t._t=setTimeout(()=>t.classList.remove('show'),2200);}
function chtip(e,txt){let t=document.getElementById('chtip');if(!t){t=document.createElement('div');t.id='chtip';document.body.appendChild(t);}t.textContent=txt;t.style.cssText='position:fixed;z-index:9999;background:#16233a;color:#fff;font-size:12px;font-weight:700;padding:5px 9px;border-radius:7px;pointer-events:none;box-shadow:0 6px 18px rgba(0,0,0,.28);white-space:nowrap;transform:translate(-50%,-145%)';t.style.left=e.clientX+'px';t.style.top=e.clientY+'px';t.style.display='block';}
function chtipHide(){const t=document.getElementById('chtip');if(t)t.style.display='none';}
/* ===== 표준 4단 — ② AI 판단·추천 (판단 기준 룰 노출) + ④ 상세 원장 접기 ===== */
function aiBand(dom,rule,lead,recos){
  const rc=(recos||[]).map(c=>`<div class="arc ${c.lv||'ok'}"><div class="r">${c.r}</div>${c.s?`<div class="s">${c.s}</div>`:''}</div>`).join('');
  return `<div class="aiband"><div class="ah"><span class="aspark">✦</span> AI 판단 · ${dom}${rule?`<span class="arule">적용 기준 ${rule}</span>`:''}</div><div class="alead">${lead}</div><div class="arecos">${rc}</div></div>`;
}
let _ldgrN=0;
function ledger(title,desc,inner,open){
  const key='zlg_'+title.replace(/[^0-9A-Za-z가-힣]/g,'').slice(0,28);
  let saved=null;try{saved=localStorage.getItem(key);}catch(e){}
  const isOpen=(saved==null)?!!open:(saved==='1');
  const id='ldgr'+(_ldgrN++);
  return `<div class="ldgr"><div class="lgh" onclick="toggleLedger('${id}','${key}')"><span class="cv" id="${id}c">${isOpen?'▾':'▸'}</span><div><div class="lt">${title}</div><div class="ld">${desc}</div></div></div><div class="lgb" id="${id}" style="display:${isOpen?'block':'none'}">${inner}</div></div>`;
}
function toggleLedger(id,key){const b=document.getElementById(id);if(!b)return;const c=document.getElementById(id+'c');const o=b.style.display!=='none';b.style.display=o?'none':'block';if(c)c.textContent=o?'▸':'▾';try{if(key)localStorage.setItem(key,o?'0':'1');}catch(e){}}
function tblFilter(inp){const q=inp.value.trim().toLowerCase();const tbl=inp.parentElement.querySelector('table');if(!tbl)return;let n=0;tbl.querySelectorAll('tbody tr').forEach(tr=>{const hit=!q||tr.textContent.toLowerCase().includes(q);tr.style.display=hit?'':'none';if(hit)n++;});}

/* ============ SINGLE SOURCE OF TRUTH: DB ============ */
// per-line: 인력(need/on/leave/edu) · 생산(target/actual/capa/end) · 세척(clElapsed h, clTransfer 0~1: 0동일,0.5제품전환,1색상+알러지) · 품질(defectPct) · 설비(oeeA,oeeP)
const DEFAULT_DB={
  rate:92.6,
  lines:[
    {key:'튜브',label:'튜브 라인',cls:'l-tube', need:18,on:16,leave:1,edu:0, target:42000,actual:31500,capa:45000,end:'17:40', clElapsed:11.0,clTransfer:0.3, defect:2.4, oeeA:91,oeeP:88},
    {key:'치약충전',label:'치약충전 라인',cls:'l-fill', need:16,on:15,leave:1,edu:0, target:38000,actual:30400,capa:40000,end:'17:10', clElapsed:4.0,clTransfer:0.0, defect:1.2, oeeA:95,oeeP:92},
    {key:'일회용',label:'일회용 라인',cls:'l-once', need:12,on:9,leave:1,edu:0, target:60000,actual:39000,capa:68000,end:'18:20', clElapsed:9.5,clTransfer:1.0, defect:2.9, oeeA:86,oeeP:83},
    {key:'초격차',label:'초격차 라인',cls:'l-cham', need:15,on:16,leave:0,edu:0, target:25000,actual:21250,capa:26000,end:'16:50', clElapsed:3.2,clTransfer:0.0, defect:0.9, oeeA:96,oeeP:94},
    {key:'HnB',label:'HnB 라인',cls:'l-hnb', need:20,on:14,leave:1,edu:3, target:30000,actual:19500,capa:34000,end:'18:40', clElapsed:7.0,clTransfer:0.8, defect:1.6, oeeA:88,oeeP:85},
    {key:'FnC',label:'FnC 라인',cls:'l-fnc', need:14,on:14,leave:1,edu:0, target:28000,actual:23800,capa:30000,end:'16:40', clElapsed:0.4,clTransfer:0.0, defect:1.1, oeeA:94,oeeP:91},
  ],
  work:[{lab:'정상 근무',n:76,color:'#22a05f'},{lab:'연차',n:11,color:'#d98a2b'},{lab:'교육/출장',n:5,color:'#3b82f6'}],
  headcount:{need:95,cur:88}, // 관제 집계(교육·이동대기 포함)
  stock:[
    {name:'튜브 원단',unit:'ROLL',onhand:38,dailyUse:32,lead:1,moq:200,targetDays:10},
    {name:'인쇄 잉크',unit:'KG',onhand:12,dailyUse:15,lead:1,moq:100,targetDays:10},
    {name:'라벨',unit:'천매',onhand:9,dailyUse:4.5,lead:2,moq:50,targetDays:12},
    {name:'치약 원료(불소)',unit:'KG',onhand:420,dailyUse:120,lead:3,moq:500,targetDays:12},
    {name:'박스',unit:'EA',onhand:3100,dailyUse:520,lead:2,moq:2000,targetDays:14},
    {name:'캡/뚜껑',unit:'천개',onhand:64,dailyUse:8,lead:4,moq:30,targetDays:14},
  ],
  warehouse:[{name:'완제품 창고',fill:88},{name:'자재 창고',fill:72},{name:'포장자재 창고',fill:61}],
  safety:{wbgt:29.4,temp:33,humid:62,noAccident:187, tbmDone:['튜브','치약충전','초격차','HnB','FnC']},
  qualTrend:[{label:'5/04',v:1.6},{label:'5/05',v:1.9},{label:'5/06',v:1.5},{label:'5/07',v:2.1},{label:'5/08',v:1.7},{label:'5/09',v:2.0},{label:'5/10',v:1.8}],
  paretoNames:['인쇄 불량','캡 체결 불량','충전량 편차','이물 혼입','기타'],
  paretoVals:[64,48,36,28,24],
  otTrend:[{label:'월',v:22},{label:'화',v:28},{label:'수',v:31},{label:'목',v:26},{label:'금',v:35}],
  forecast:[{label:'5/10(금)',v:3},{label:'5/11(토)',v:2},{label:'5/12(월)',v:4},{label:'5/13(화)',v:6},{label:'5/14(수)',v:5},{label:'5/15(목)',v:2},{label:'5/16(금)',v:1}],
  extSys:[ // 외부 연동 시스템(배포 URL) — 역할별(worker/admin) URL, 관련 Agent 화면에 임베드
    {id:'wash',name:'세척실 작업 우선순위 자동 추천 시스템',icon:'',agent:'clean',urls:{worker:'internal:gz:washW',admin:'internal:gz:washA'}},
    {id:'orikon',name:'오리콘·P-BOX 작업실적 통합관리 시스템',icon:'',agent:[],urls:{worker:'internal:gz:pboxW',admin:'internal:gz:pboxA'}},
    {id:'wh',name:'포장재 창고 적치 관리 시스템',icon:'',agent:'stock',urls:{worker:'internal:gz:whW',admin:'internal:gz:whA'}},
    {id:'safevoice',name:'세이프티 보이스 (현장 위험·건의·제보 접수함)',icon:'',agent:'safe',urls:{worker:'internal:gz:svW',admin:'internal:gz:svA'}},{id:'heat',name:'젠프 히트워치 (옥외 체감온도·KOSHA)',icon:'',agent:'safe',urls:{worker:'internal:heat',admin:'internal:heat'}},
    {id:'zenkeeper',name:'ZEN Keeper 안전관리 (제니엘 4대 실천)',icon:'',agent:'safe',urls:{worker:'internal:safe',admin:'internal:safe'}},
  ],
  plan:null, // 주간 생산계획(엑셀 업로드 시 채워짐)
  wh:null,   // 창고 구역별 적치 점검(주1회, 엑셀 업로드 시 채워짐)
};
const AGENTNAME={clean:'세척 Agent',safe:'안전 Agent',stock:'재고 Agent',prod:'생산 Agent',labor:'인력 Agent',qual:'품질 Agent'};
let DB=JSON.parse(JSON.stringify(DEFAULT_DB));
let dataSource='기준값';

