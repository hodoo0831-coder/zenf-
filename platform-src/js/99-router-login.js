/* ============ ROUTER / NAV / LOGIN ============ */
let cur='home';
const NAV_TOOLS={opl:{name:'OPL 교육자료',icon:''},data:{name:'기준 · 연동',icon:''}};
/* 운영 흐름 그대로: 계획→예측 · 현황→실측 · 판단→조치 · 보고 · (참조)기준·관리 */
const NAV_GROUPS=[
  {sec:'① 계획 · 예측',ids:['forecast']},
  {sec:'② 현황 · 실측',ids:['home','ops']},
  {sec:'③ 판단 · 조치',ids:['track']},
  {sec:'④ 보고',ids:['reports','insight']},
  {sec:'기준 · 관리',ids:['judge','data','opl']},
];
function buildNav(){
  const R=ROLES[role],allow=id=>R.allow.includes(id);
  const nm=id=>{const a=AGENTS.find(x=>x.id===id);return a?a.name:(NAV_TOOLS[id]||{}).name;};
  const ic=id=>{const a=AGENTS.find(x=>x.id===id);return a?a.icon:(NAV_TOOLS[id]||{}).icon;};
  const badges={
    track:(()=>{const J=collectJudgments(),n=J.filter(x=>x.lv!=='ok'&&actGet(actKey(x)).st==='todo').length;return n?{t:'미조치 '+n,c:'t-red'}:null;})(),
    safe:DB.safety.wbgt>=28?{t:'경고',c:'t-amber'}:null,
  };
  const link=id=>{const bd=badges[id]?`<span class="badge ${badges[id].c}">${badges[id].t}</span>`:'';
    return `<a data-id="${id}" class="${id===cur?'on':''}" onclick="go('${id}')"><span class="ic">${svic(NAV_ICON[id]||'activity',17)}</span><span>${nm(id)}</span>${bd}</a>`;};
  const body=NAV_GROUPS.map(g=>{const ids=g.ids.filter(allow);if(!ids.length)return '';return `<div class="sec">${g.sec}</div>`+ids.map(link).join('');}).join('');
  document.getElementById('nav').innerHTML=`
    <div class="logo"><div class="t"><span>ZEN</span> Manufacturing</div><div class="s">아모레퍼시픽 헤어앤뷰티 사업장</div></div>
    ${body}
    <div class="spacer"></div>
    <div class="user"><div class="av">${(role==='center'?'이':'홍')}</div><div style="flex:1;min-width:0"><div class="nm">${role==='center'?'이민아':'홍길동'} ${R.name}</div><div class="rl">${scopeLabel()}</div><div class="roleswitch">${['field','admin','center'].map(k=>`<span class="rchip ${role===k?'on':''}" onclick="switchRole('${k}')">${ROLES[k].name}</span>`).join('')}</div></div><div class="out" onclick="logout()" title="로그아웃">⎋</div></div>`;
}
const GO_REDIR={prod:['ops','production'],plan:['forecast','plan'],delay:['forecast','delay'],load:['forecast','load'],
  planhub:['ops','production'],labor:['ops','labor'],clean:['ops','clean'],stock:['ops','stock'],orikonwash:['ops','indirect'],safe:['ops','safe'],qual:['ops','quality'],
  kpi:['insight','kpi'],report:['reports','monthly']};
function go(id){
  let _rg=0;while(GO_REDIR[id]&&_rg++<4){const[a,t]=GO_REDIR[id];vtab[a]=t;id=a;}
  if(!ROLES[role].allow.includes(id)&&!['data','safeapp'].includes(id))id='home';
  if(id==='data'&&!ROLES[role].allow.includes('data'))id='home';
  cur=id;
  const meta=AGENTS.find(a=>a.id===id)||{name:{data:'데이터 관리',safeapp:'안전 관리 (ZENF)',opl:'OPL 생성기'}[id],sub:{data:'엑셀/CSV 업로드 · 직접 편집으로 대시보드 구동',safeapp:'기존 안전 앱 통합 화면',opl:'점검·이슈 내용 → 원포인트레슨(적발→준수기준+서명부) 자동 생성'}[id]};
  document.getElementById('vTitle').textContent=meta.name;
  document.getElementById('vSub').textContent=meta.sub;
  let html=(V[id]||(()=>'<div class="card">준비 중</div>'))();
  document.getElementById('view').innerHTML=html;hydrateIcons(document.getElementById('view'));probeEmbeds();
  document.querySelectorAll('.nav a').forEach(a=>a.classList.toggle('on',a.dataset.id===id));
  if(id==='data')setTimeout(setupDrop,0);
  closeNav();
  window.scrollTo({top:0});
}
function setupDrop(){const d=document.getElementById('drop');if(!d)return;
  ['dragover','dragenter'].forEach(ev=>d.addEventListener(ev,e=>{e.preventDefault();d.classList.add('hi');}));
  ['dragleave','drop'].forEach(ev=>d.addEventListener(ev,e=>{e.preventDefault();d.classList.remove('hi');}));
  d.addEventListener('drop',e=>{if(e.dataTransfer.files[0])importFile(e.dataTransfer.files[0]);});
}
// login — 역할별 스코프 옵션
function fillScope(r){
  const sel=document.getElementById('scopeSel'),lbl=document.getElementById('scopeLbl');
  let opts=[];
  if(r==='field'){lbl.textContent='담당 사업부 (현장)';
    sel.innerHTML=Object.keys(ZONES).map(z=>`<option value="${z}">${z}</option>`).join('');}
  else if(r==='admin'){lbl.textContent='담당 사업부 (관리자)';
    sel.innerHTML=[`<option value="전체">전체</option>`].concat(Object.keys(ZONES).map(z=>`<option value="${z}">${z}</option>`)).join('');}
  else{lbl.textContent='운영 범위 (센터)';sel.innerHTML=`<option value="전체">전체 라인 (종합 상황판 · 전권)</option>`;}
  sel.disabled=(r==='center');
}
document.querySelectorAll('#roles button').forEach(b=>b.onclick=()=>{document.querySelectorAll('#roles button').forEach(x=>x.classList.remove('on'));b.classList.add('on');fillScope(b.dataset.role);});
/* 보안: 비밀번호는 SHA-256 해시로만 보관 — 소스 열람으로 원문 확인 불가 */
const ACCESS_HASH='3d1e557b540ac045b3b327994a351f08a443f9216f9b2b8d3a0f42b58671ac83';
async function sha256(t){const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(t));return Array.from(new Uint8Array(b)).map(x=>x.toString(16).padStart(2,'0')).join('');}
function _lock(){try{return JSON.parse(localStorage.getItem('zen_lock')||'{}');}catch(e){return {};}}
let _idleT=null;
function armIdle(){const R=()=>{clearTimeout(_idleT);_idleT=setTimeout(()=>{logout();const e=document.getElementById('pwErr');if(e){e.textContent='30분 미사용으로 잠금 — 다시 로그인하세요';e.style.display='block';}},30*60*1000);};
  if(!armIdle._on){['click','keydown','touchstart'].forEach(ev=>document.addEventListener(ev,R,{passive:true}));armIdle._on=1;}R();}
async function doLogin(){
  const pwEl=document.getElementById('pw'),pwErr=document.getElementById('pwErr');
  const L=_lock();
  if(L.until&&Date.now()<L.until){if(pwErr){pwErr.textContent='입력 5회 초과 — '+Math.ceil((L.until-Date.now())/1000)+'초 후 다시 시도하세요';pwErr.style.display='block';}return;}
  if(pwEl){const h=await sha256(pwEl.value||'');
    if(h!==ACCESS_HASH){const n=(L.n||0)+1,lock=n>=5;
      try{localStorage.setItem('zen_lock',JSON.stringify(lock?{n:0,until:Date.now()+30000}:{n}));}catch(e){}
      if(pwErr){pwErr.textContent=lock?'입력 5회 초과 — 30초간 잠금됩니다':'비밀번호가 올바르지 않습니다 ('+n+'/5)';pwErr.style.display='block';}
      pwEl.value='';pwEl.focus();return;}}
  try{localStorage.removeItem('zen_lock');}catch(e){}
  if(pwErr)pwErr.style.display='none';
  armIdle();
  role=document.querySelector('#roles button.on').dataset.role;
  const v=document.getElementById('scopeSel').value;
  if(role==='field'){scope=(ZONES[v]?ZONES[v].slice():[v]);scopeName=v;}
  else if(role==='admin'){if(v==='전체'){scope=null;scopeName='전체';}else{scope=ZONES[v]||null;scopeName=v;}}
  else{scope=null;scopeName='전체';}
  document.getElementById('login').style.display='none';
  document.getElementById('app').classList.add('show');
  cur=(DB.plan&&ROLES[role].allow.includes('plan'))?'plan':'home';
  buildNav();go(cur);applyBig();clockTick();
  syncSrcTag();
  preloadGzDocs();
  liveStart();
  try{localStorage.setItem('zen_session',JSON.stringify({role,scope:document.getElementById('scopeSel').value,ts:Date.now()}));}catch(e){}
}
function _p2(n){return String(n).padStart(2,'0');}
function todayKR(){const d=new Date(),wd=['일','월','화','수','목','금','토'][d.getDay()];return `${d.getFullYear()}.${_p2(d.getMonth()+1)}.${_p2(d.getDate())} (${wd})`;}
function weekKR(){const e=new Date(),s=new Date(e.getTime()-6*864e5);return `${_p2(s.getMonth()+1)}/${_p2(s.getDate())} ~ ${_p2(e.getMonth()+1)}/${_p2(e.getDate())}`;}
function prevMonthKR(){const d=new Date();d.setDate(1);d.setMonth(d.getMonth()-1);return `${d.getFullYear()}년 ${d.getMonth()+1}월`;}
function clockTick(){const el=document.getElementById('topDate');if(!el)return;const d=new Date();el.textContent=`${todayKR()} ${_p2(d.getHours())}:${_p2(d.getMinutes())}`;}
setInterval(clockTick,30000);
let bigMode=false;
function applyBig(){const st=document.querySelector('.stage');if(st)st.style.zoom=bigMode?'1.18':'';const bb=document.getElementById('bigBtn');if(bb)bb.classList.toggle('p',bigMode);}
function toggleBig(){bigMode=!bigMode;applyBig();try{localStorage.setItem('zen_big',bigMode?'1':'0');}catch(e){}}
function toggleNav(){const n=document.getElementById('nav'),s=document.getElementById('navScrim');const open=!n.classList.contains('open');n.classList.toggle('open',open);s.classList.toggle('on',open);}
function closeNav(){const n=document.getElementById('nav');if(n)n.classList.remove('open');const s=document.getElementById('navScrim');if(s)s.classList.remove('on');}
try{bigMode=localStorage.getItem('zen_big')==='1';}catch(e){}
function switchRole(r){if(!ROLES[r]||r===role)return;role=r;
  if(r==='field'){const first=DEFAULT_DB.lines[0].key;scope=[first];scopeName=first+' 라인';}
  else{scope=null;scopeName='전체';}
  try{localStorage.setItem('zen_session',JSON.stringify({role,scope:r==='field'?scope[0]:'전체',ts:Date.now()}));}catch(e){}
  const c=ROLES[role].allow.includes(cur)?cur:'home';buildNav();go(c);toast(ROLES[r].name+' 화면으로 전환');}
function logout(){try{localStorage.removeItem('zen_session');}catch(e){}document.getElementById('app').classList.remove('show');document.getElementById('login').style.display='flex';}
document.getElementById('pw').addEventListener('keydown',e=>{if(e.key==='Enter')doLogin();});
// startup: restore saved data + default scope UI
loadDB();
fillScope('center');
// 시작 시 항상 역할 선택 로그인 화면 표시 — 지난번 역할만 미리 선택해 편의 제공
(function preselectRole(){try{const s=JSON.parse(localStorage.getItem('zen_session')||'null');if(!s||!ROLES[s.role])return;
  if(s.ts&&Date.now()-s.ts>8*3600*1000){localStorage.removeItem('zen_session');return;}
  document.querySelectorAll('#roles button').forEach(x=>x.classList.toggle('on',x.dataset.role===s.role));
  fillScope(s.role);
  const sel=document.getElementById('scopeSel');if(s.scope&&[...sel.options].some(o=>o.value===s.scope))sel.value=s.scope;
}catch(e){}})();

