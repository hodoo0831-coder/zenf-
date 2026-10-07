/* ===== 역할 스코프(담당 라인/구역) ===== */
const ZONES={'Oral Care':['튜브','치약충전','일회용','초격차'],'HnB':['HnB'],'FnC':['FnC']};
let scope=null; // null=전체
let scopeName='전체';
function myLines(){ if(!scope||!scope.length) return DB.lines; const f=DB.lines.filter(l=>scope.includes(l.key)); return f.length?f:DB.lines; }
function scoped(){ return !!(scope&&scope.length&&myLines().length<DB.lines.length); }
function scopeLabel(){ return scope&&scope.length?('담당: '+scopeName):'전체 권한'; }

/* ===== localStorage 지속성 ===== */
const LS_KEY='zen_mfg_platform_v1';
function saveDB(){try{localStorage.setItem(LS_KEY,JSON.stringify({DB,dataSource}));}catch(e){}}
function loadDB(){try{const s=localStorage.getItem(LS_KEY);if(s){const o=JSON.parse(s);if(o&&o.DB&&o.DB.lines){DB=o.DB;if(DB.plan===undefined)DB.plan=null;if(DB.wh===undefined)DB.wh=null;if(!DB.extSys||!DB.extSys.length||!DB.extSys[0].urls)DB.extSys=JSON.parse(JSON.stringify(DEFAULT_DB.extSys));
    /* 연동시스템 배치(agent/name/icon)는 항상 코드 기준으로 정렬 — URL만 사용자 값 유지 */
    DB.extSys.forEach(s=>{const d=DEFAULT_DB.extSys.find(x=>x.id===s.id);if(d){s.agent=d.agent;s.name=d.name;s.icon=d.icon;const dw=d.urls&&d.urls.worker||'';const isBuiltin=dw.indexOf('internal:')===0||!/^https?:/i.test(dw);const sw=s.urls&&s.urls.worker||'';const staleExt=/(wash-worker|wash-admin|orikon-pbox-worker|orikon-pbox-admin)\.netlify\.app/i.test(sw);if(isBuiltin&&(staleExt||dw.indexOf('internal:')===0))s.urls=JSON.parse(JSON.stringify(d.urls));}});
    /* 코드에 새로 추가된 연동 시스템(예: ZEN Keeper)을 저장데이터에도 채움 */
    DEFAULT_DB.extSys.forEach(d=>{if(!DB.extSys.find(s=>s.id===d.id))DB.extSys.push(JSON.parse(JSON.stringify(d)));});
    dataSource=o.dataSource||'저장됨';return true;}}}catch(e){}return false;}
/* ===== 외부 연동 시스템 (배포 URL · 역할별 + 현장/관리자 토글) ===== */
let sysView={}; // {시스템id: 'worker'|'admin'} — 역할 기본값 위에 사용자 토글 오버라이드
var sysForcePreview=false; // 녹화 전용: 외부 배포 화면 대신 대표 미리보기 표시(샌드박스 네트워크 차단 회피)
function sysVar(s){return sysView[s.id]||(role==='field'?'worker':'admin');}
function sysUrl(s){const d=(typeof SYS_SUB!=='undefined')&&SYS_SUB[s.id];
  const u=d?(d.urls[sysSubK(s)]||{}):(s.urls||{});const v=sysVar(s);
  return v==='worker'?(u.worker||u.admin||''):(u.admin||u.worker||'');}
function sysVariant(s){return sysVar(s)==='worker'?'현장(작업자)용':'관리자용';}
function setSysView(id,v){sysView[id]=v;go(cur);}
function sysToggle(s){const u=s.urls||{};if(!(u.worker&&u.admin&&u.worker!==u.admin))return '';const v=sysVar(s);
  return `<span style="display:inline-flex;gap:5px;margin-right:8px"><button class="btn ${v==='worker'?'p':''}" style="padding:5px 11px" onclick="setSysView('${s.id}','worker')">현장용</button><button class="btn ${v==='admin'?'p':''}" style="padding:5px 11px" onclick="setSysView('${s.id}','admin')">관리자용</button></span>`;}
function inAgent(s,agentId){return Array.isArray(s.agent)?s.agent.includes(agentId):s.agent===agentId;}
/* 예시(미배포) URL 판별 — 실제 배포 URL로 바꾸면 자동으로 임베드로 전환됨 */
const LIVE_ALT={
  wash:{worker:'https://wash-worker.netlify.app/',admin:'https://wash-admin.netlify.app/'},
  orikon:{worker:'https://orikon-pbox-worker.netlify.app/',admin:'https://orikon-pbox-admin.netlify.app/'}
};
const SYS_EXAMPLE=/(wash-worker|wash-admin|orikon-pbox-worker|orikon-pbox-admin)\.netlify\.app/i;
function isExampleUrl(u){return SYS_EXAMPLE.test(u||'');}
/* 연동 준비 슬롯 미리보기 — 현장(작업자 입력)/관리자(집계) 대표 화면 (예시, 배포 시 실시간 연동) */
function sysPreview(s){
  const w=sysVar(s)==='worker', nm=s.name;
  const tile=(t,v,c)=>`<div class="spv-t"><div class="l">${t}</div><div class="v">${v}</div><i style="background:${c}"></i></div>`;
  const kpi=(t,v,d,c)=>`<div class="spv-k"><div class="l">${t}</div><div class="v">${v}</div><div class="d" style="color:${c}">${d}</div></div>`;
  const bar=(n,p,c)=>`<div class="spv-b"><span>${n}</span><div class="tr"><i style="width:${p}%;background:${c}"></i></div><b>${p}%</b></div>`;
  // 시스템별 대표 콘텐츠 (기획서 정체성 반영)
  const P=s.id==='wash'?{
    wsub:'대기 설비·생산 종료·세척시간·긴급도·가용인원 입력 → 추천 순위 확인',
    tiles:[tile('세척 대기','4 설비','#17934f'),tile('최우선','튜브 성형','#dc4b4b'),tile('예상 완료','15:40','#12b886'),tile('긴급','1 건','#f59f00')],
    asub:'점수 기반 순서·예상 완료시간 자동 추천 · 현장 수정 가능(사유 기록)',
    kpis:[kpi('자동판단율','95%','목표치','#39b98a'),kpi('세척 대기','4 설비','실시간','#5ab0ff'),kpi('지연위험','1 건','주의','#d98a2b')],
    cap:'점수 기반 우선순위 (긴급도·여유시간·가용인원)',
    bars:[bar('1위 튜브 성형',89,'#dc4b4b'),bar('2위 치약충전',76,'#f59f00'),bar('3위 일회용',64,'#17934f')],
    note:'추천 순위는 현장 수정 가능 · 변경사유 저장 → 지속 학습'
  }:{
    wsub:'작업 직후 대형 터치 버튼 — 유형·수량·시간 즉시 등록 (오리콘/P-BOX)',
    tiles:[tile('P-BOX 세척','5,310 EA','#17934f'),tile('오리콘 세척','720 EA','#12b886'),tile('총 투입','207.9 MH','#8a63d2'),tile('누계 (8/7~14 실측)','65 PLT','#f59f00')],
    asub:'5초 주기 다기기 자동 집계 · 공동작업 분배·단위 환산 · 이상치 경보 — D1 실측 8/7~8/14',
    kpis:[kpi('MH 생산성','0.33','PLT/MH (P-BOX)','#39b98a'),kpi('집계 주기','5초','다기기 자동','#5ab0ff'),kpi('이상치','1건','생산성 편차','#d98a2b')],
    cap:'작업자별 생산성 (PLT/MH · 공동작업 자동 분배 · 실측)',
    bars:[bar('박지연 0.47',100,'#12b886'),bar('정철훈 0.42',89,'#17934f'),bar('이동동 0.11',23,'#dc4b4b')],
    note:'편차 자동 경보 — 이동동 0.11 PLT/MH (평균 0.33 ▼66%) · D1 실측'
  };
  const body=w?`
    <div class="spv-h"><span class="spv-badge w">현장(작업자)용</span><span class="spv-nm">${nm}</span></div>
    <div class="spv-sub">${P.wsub}</div>
    <div class="spv-grid2">${P.tiles.join('')}</div>
    <div class="spv-act"><div class="save">＋ 실적 저장</div><div class="ph">사진 첨부</div></div>`:`
    <div class="spv-h"><span class="spv-badge a">관리자용</span><span class="spv-nm">${nm}</span></div>
    <div class="spv-sub">${P.asub}</div>
    <div class="spv-grid3">${P.kpis.join('')}</div>
    <div class="spv-cap">${P.cap}</div>${P.bars.join('')}
    <div class="mini" style="margin-top:10px;color:#8fb4d6;line-height:1.5">${P.note}</div>`;
  const flow=`<div style="margin-top:14px;padding-top:12px;border-top:1px solid rgba(255,255,255,.09);display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:12px;font-weight:700;color:#8fb4d6">
    <span style="background:#12b886;color:#04110b;padding:3px 9px;border-radius:20px">현장 입력</span><span style="color:#5f7d9c">→</span>
    <span style="background:rgba(255,255,255,.06);padding:3px 9px;border-radius:20px;color:#e3e7e9">플랫폼 자동 집계</span><span style="color:#5f7d9c">→</span>
    <span style="background:rgba(90,176,255,.16);padding:3px 9px;border-radius:20px;color:#9ff0cf">생산 Agent · AI 판단 센터 반영</span></div>`;
  return `<div class="spv ${w?'w':'a'}">${body}${flow}</div>`;
}
function renderSysLinks(agentId){
  const list=(DB.extSys||[]).filter(s=>inAgent(s,agentId));
  if(!list.length)return '';
  return `<div>`+list.map(s=>sysCard(s)).join('')+`</div>`;
}
function sysIco(s){return svic(({wash:'droplet',orikon:'package',heat:'thermometer'})[s.id]||'factory',16);}
/* 상대경로 연동 앱이 배포본에 없을 때(404) 원본 404 페이지 대신 안내로 대체 */
async function probeEmbeds(){
  const list=[...document.querySelectorAll('#view iframe[data-probe]')];
  for(const fr of list){
    const u=fr.getAttribute('data-probe'); if(!u)continue;
    let ok=false;
    try{ const r=await fetch(u,{method:'HEAD'}); ok=r.ok; }catch(e){ ok=false; }
    if(ok)continue;
    const live=fr.getAttribute('data-live')||'', nm=fr.getAttribute('data-nm')||'연동 앱';
    fr.insertAdjacentHTML('afterend',`<div style="border:1.5px dashed var(--line2);border-radius:14px;padding:20px 18px;background:var(--bg);text-align:center">
      <div style="font-size:15px;font-weight:700;color:var(--navy)">${nm} — 이 배포본에 앱 파일이 포함되어 있지 않습니다</div>
      <div class="mini" style="margin-top:6px;line-height:1.6">현재 주소에 <code>${u}</code> 경로가 없어 화면을 띄울 수 없습니다.<br>레포 전체(플랫폼 + 연동 앱 폴더)를 배포하면 이 자리에 실제 앱이 표시됩니다.</div>
      ${live?`<button class="btn p" style="margin-top:12px" onclick="window.open('${live}','_blank')">↗ 실배포 앱 새 창으로 열기</button>`:''}
    </div>`);
    fr.remove();
  }
}
function sysCard(s){
  const url=sysUrl(s),v=sysVariant(s),ic=sysIco(s),internal=isInternal(url),src=sysResolve(url);
  const openUrl=(src||'').replace(/'/g,'%27');
  const liveKey=internal?url.replace('internal:',''):'';
  const head=(state,ok,extra)=>`<h3><span style="display:inline-flex;vertical-align:-3px;color:var(--accent)">${ic}</span> ${s.name} <span class="hint"${ok?' style="color:#3f9d6b"':''}>${ok?'● ':'외부 연동 · '}${state}</span><span style="margin-left:auto;display:flex;gap:6px;align-items:center">${sysToggle(s)}${extra||''}${url&&!internal?`<button class="btn" onclick="window.open('${openUrl}','_blank')">↗ 새 창</button>`:''}</span></h3>`;
  // 0) 내장 앱(오프라인) ↔ 실배포 토글
  if(internal){const d=SYS_SUB[s.id], subK=sysSubK(s);
    /* 선택된 시스템명이 제목에 두 번 들어가지 않게 접두어를 걷어낸다 */
    const base=d?(s.name.replace(/^\s*오리콘[·・]?\s*P-?BOX\s*/i,'')||s.name):s.name;
    const nm=d?((d.list.find(x=>x.k===subK)||{}).n+' '+base):s.name;
    return dualEmbed(liveKey,nm,ic,src,'78vh',null,subToggle(s)+sysToggle(s),sysLiveUrl(s));}
  // 1) URL 없음 — 미연결
  if(!url) return `<div class="card" style="margin-top:14px">${head('미연결')}<p class="mini">연동 URL이 없습니다. <a onclick="go('data')" style="color:#7fb8ff;cursor:pointer">데이터 관리 → 연동 시스템</a>에서 등록하세요.</p></div>`;
  // 2) 녹화 전용 — 실배포 대신 대표 미리보기(샌드박스 네트워크 차단 회피)
  if(sysForcePreview) return `<div class="card" style="margin-top:14px;padding:13px">${head(v+' · 미리보기')}
    ${sysPreview(s)}
    <div class="syshint"><b>실배포 연결</b> · <span style="word-break:break-all">${url}</span> — 실기기/브라우저에서 이 자리에 실시간 임베드됩니다.</div></div>`;
  // 3) 실배포 URL — 실시간 임베드
  const rel=!/^https?:/i.test(url);           /* 배포본에 파일이 없을 수 있는 상대경로 */
  const liveAlt=(LIVE_ALT[s.id]&&LIVE_ALT[s.id][sysVar(s)])||'';
  return `<div class="card" style="margin-top:14px;padding:13px">${head(v+' · 실배포',true)}<iframe class="safe" src="${url.replace(/"/g,'&quot;')}" title="${s.name}" style="height:64vh" loading="lazy"${rel?` data-probe="${url.replace(/"/g,'&quot;')}" data-live="${liveAlt}" data-nm="${s.name}"`:''}></iframe><div class="mini" style="margin-top:6px">현장/관리자 토글로 배포 화면을 전환합니다. 비어 보이면 ‘↗ 새 창’.</div></div>`;
}
function setSysUrl(id,which,url){const s=(DB.extSys||[]).find(x=>x.id===id);if(!s)return;s.urls=s.urls||{};s.urls[which]=(url||'').trim();saveDB();toast(s.name+' '+(which==='worker'?'작업자용':'관리자용')+(s.urls[which]?' URL 저장됨':' 해제'));}

