/* ============ DATA OPS ============ */
function syncSrcTag(){
  const t=document.getElementById('srcTag'); if(t){t.textContent='데이터: '+dataSource;t.classList.toggle('live',dataSource!=='기준값');}
  const r=document.getElementById('refreshTag');
  const _feeds=[]; if(LIVE.status==='live')_feeds.push('실적');
  if(typeof WASHLIVE!=='undefined'&&WASHLIVE)_feeds.push('세척');
  if(typeof HEATLIVE!=='undefined'&&HEATLIVE)_feeds.push('기상');
  if(typeof WHLIVE!=='undefined'&&WHLIVE&&whLiveN())_feeds.push('적치');
  if(t){t.textContent='데이터: '+(_feeds.length?_feeds.join('+')+' 실측':dataSource);t.classList.toggle('live',_feeds.length>0);}
  if(r){
    if(!_feeds.length){
      const why=liveErr?' · '+liveErr:'';
      r.innerHTML='<span class="dot" style="background:#b9922e"></span> 기준 데이터 · 미연결'
        +'<button class="btn" style="padding:2px 9px;margin-left:7px;font-size:11px" onclick="liveRetry()">다시 연결</button>';
      r.title=why?('실시간 연결 실패'+why):'실시간 연결 시도 전';
    }else{
      const ago=liveAt?Math.round((Date.now()-liveAt)/1000):0;
      const miss=['실적','세척','기상','적치'].filter(x=>_feeds.indexOf(x)<0);
      r.innerHTML='<span class="dot"></span> 자동 갱신 중 · '+_feeds.join('+')
        +(miss.length?' <span style="color:#b9922e">('+miss.join('·')+' 미연결)</span>':'');
      r.title='마지막 갱신 '+(ago<60?ago+'초 전':Math.round(ago/60)+'분 전');
    }
  }
}
function rerender(){go(cur);buildNav();syncSrcTag();}
function _markManual(){
  if(dataSource==='기준값')dataSource='수동 편집';
  const tag=document.getElementById('srcTag');
  if(tag){tag.textContent='데이터: '+dataSource;tag.classList.toggle('live',dataSource!=='기준값');}
  const now=document.getElementById('srcNow'); if(now)now.textContent=dataSource;
}
function editLine(i,k,v){
  if(v===''||v==='-'||v==='.')return;
  const n=+v; if(isNaN(n))return;
  DB.lines[i][k]=n; _markManual();
  clearTimeout(editLine._t); editLine._t=setTimeout(saveDB,400);
}
function editLineCommit(i,k,el){
  const v=el.value, n=(v===''||isNaN(+v))?0:+v;
  DB.lines[i][k]=n; if(String(el.value)!==String(n)&&v!=='')el.value=n;
  _markManual(); saveDB();
}
function resetDB(){DB=JSON.parse(JSON.stringify(DEFAULT_DB));dataSource='기준값';planWeek=0;try{localStorage.removeItem(LS_KEY);}catch(e){}toast('기준값으로 복원했습니다 (저장 데이터 삭제)');rerender();}
const IMPORT_MAP={'라인':'key','필요':'need','출근':'on','연차':'leave','교육':'edu','목표':'target','실적':'actual','capa':'capa','CAPA':'capa','불량%':'defect','불량':'defect','세척경과h':'clElapsed','세척경과':'clElapsed','전환0~1':'clTransfer','전환':'clTransfer'};
function applyRows(rows){
  // rows: array of objects keyed by header
  let n=0;
  rows.forEach(r=>{
    const keyName=r['라인']||r['key']||r['구역'];if(!keyName)return;
    const line=DB.lines.find(l=>l.key===String(keyName).trim());if(!line)return;
    Object.keys(r).forEach(h=>{const f=IMPORT_MAP[String(h).trim()];if(f&&f!=='key'){const val=+r[h];if(!isNaN(val))line[f]=val;}});
    n++;
  });
  return n;
}
function importFile(file){
  if(!file)return;const name=file.name.toLowerCase();const rd=new FileReader();
  rd.onload=e=>{
    try{
      if(name.endsWith('.csv')){
        const n=applyRows(csvToRows(e.target.result));
        if(n>0){dataSource=file.name;saveDB();toast(n+'개 라인 데이터를 반영했습니다');rerender();}
        else toast('매칭되는 라인이 없습니다 (헤더/라인명 확인)');
        return;
      }
      const wb=XLSX.read(e.target.result,{type:'binary'});
      if(isStaffWB(wb)){
        const st=applyStaffMaster(wb,file.name);
        if(DB.plan)applyPlanCascade(DB.plan,DB.loadPlanName||'주간계획',DB.loadPlan||{});
        rerender();
        toast('인원 기준 반영 — '+st.upd+'개 라인 표준·가용 인원 갱신'+(st.miss.length?' · 미매칭 '+st.miss.length+'건':'')+' — 부하율·필요인원 재계산');
        go('load');return;
      }
      if(isCapaWB(wb)){
        const cp=applyCapaMaster(wb,file.name);
        if(DB.plan)applyPlanCascade(DB.plan,DB.loadPlanName||'주간계획',DB.loadPlan||{});
        rerender();
        toast('CAPA 기준 반영 — '+cp.upd+'개 라인 갱신'+(cp.added?' · 신규 '+cp.added:'')+' — 부하율·필요인원 재계산');
        go('load');return;
      }
      if(isWhWB(wb)){
        DB.wh=parseWarehouse(wb);whWeek=0;dataSource=file.name;saveDB();
        const w=DB.wh.weeks[0];
        toast('창고 적치 점검 인식: '+DB.wh.weeks.length+'주 · '+w.zones.length+'구역 · 전체 적치율 '+whTotRate(w)+'%');
        rerender();go('stock');return;
      }
      if(isPlanWB(wb)){
        const plan=parsePlan(wb);
        const s=applyPlanCascade(plan,file.name);
        const w=DB.plan.weeks[0];
        toast('주간계획 반영 — '+s.weeks+'주 · '+w.resources.length+'개 리소스 · 총 '+w.resources.reduce((a,r)=>a+r.weekTotal,0).toLocaleString()+'개 · 라인 목표 '+s.nLines+'개 갱신 · 과부하 '+s.over+'그룹 · 조치 '+s.opened+'건');
        rerender();go('plan');return;
      }
      const n=applyRows(XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{defval:''}));
      if(n>0){dataSource=file.name;saveDB();toast(n+'개 라인 데이터를 반영했습니다');rerender();}
      else toast('인식 가능한 데이터가 없습니다. 템플릿 형식 또는 주간계획 형식을 확인하세요.');
    }catch(err){toast('파일 파싱 실패: '+err.message);}
  };
  if(name.endsWith('.csv'))rd.readAsText(file);else rd.readAsBinaryString(file);
}
function csvToRows(text){
  const lines=text.split(/\r?\n/).filter(x=>x.trim());if(!lines.length)return[];
  const head=splitCSV(lines[0]);
  return lines.slice(1).map(ln=>{const c=splitCSV(ln);const o={};head.forEach((h,i)=>o[h.trim()]=c[i]);return o;});
}
function splitCSV(line){const out=[];let cur='',q=false;for(let i=0;i<line.length;i++){const ch=line[i];if(ch==='"'){q=!q;}else if(ch===','&&!q){out.push(cur);cur='';}else cur+=ch;}out.push(cur);return out;}
function dbToAOA(){
  const head=['라인',...EDIT_COLS.map(c=>c.t)];
  const rows=DB.lines.map(l=>[l.key,...EDIT_COLS.map(c=>l[c.k])]);
  return [head,...rows];
}
function exportXLSX(){const ws=XLSX.utils.aoa_to_sheet(dbToAOA());const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,'라인데이터');XLSX.writeFile(wb,'ZEN_라인데이터_템플릿.xlsx');toast('엑셀 템플릿을 내려받았습니다');}
function exportCSV(){const aoa=dbToAOA();const csv=aoa.map(r=>r.join(',')).join('\n');dl('ZEN_라인데이터.csv','﻿'+csv,'text/csv');toast('CSV를 내려받았습니다');}
function exportReport(){const el=document.querySelector('.report-doc');dl('ZEN_생산일보_'+new Date().toISOString().slice(0,10).replace(/-/g,'')+'.txt',el.innerText,'text/plain');toast('보고서를 내보냈습니다');}
function dl(fn,content,mime){const b=new Blob([content],{type:mime});const u=URL.createObjectURL(b);const a=document.createElement('a');a.href=u;a.download=fn;a.click();URL.revokeObjectURL(u);}
function genReport(t){openReport(t&&t.indexOf('월')>=0?'monthly':t&&t.indexOf('주')>=0?'weekly':'daily');}
function openReport(kind){
  const jump=id=>{const el=document.getElementById(id);if(el)el.scrollIntoView({behavior:'smooth',block:'start'});};
  if(kind==='weekly'){vtab.track='log';go('track');return;}
  const needGo=cur!=='insight'||vtab.insight!=='report';
  vtab.insight='report';
  if(needGo)go('insight');
  setTimeout(()=>jump(kind==='monthly'?'monthlyReport':'dailyBrief'), needGo?120:30);
}

