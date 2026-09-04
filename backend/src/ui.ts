// ============================================================
// 행정담당용 업로드 화면. 외부 CDN을 쓰지 않는다 —
// 사내망에서 외부 스크립트가 차단되면 화면이 통째로 죽기 때문이다.
// ============================================================
export const UPLOAD_PAGE = `<!doctype html>
<html lang="ko"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>근태 엑셀 업로드 (예외 경로) — 근태 데이터 허브</title>
<style>
:root{--navy:#12314f;--line:#d7dee6;--soft:#f4f7fa;--red:#b3261e;--green:#1b6b3a;--amber:#a3591b}
*{box-sizing:border-box}
body{font-family:"Malgun Gothic","맑은 고딕",system-ui,sans-serif;margin:0;background:#eef2f6;color:#1c2430;font-size:14px}
.wrap{max-width:960px;margin:0 auto;padding:24px 16px 64px}
h1{font-size:20px;color:var(--navy);margin:0 0 4px}
.sub{color:#5c6b7c;margin:0 0 20px;font-size:13px}
.card{background:#fff;border:1px solid var(--line);border-radius:6px;padding:20px;margin-bottom:16px}
.card h2{font-size:15px;color:var(--navy);margin:0 0 12px;padding-bottom:8px;border-bottom:2px solid var(--soft)}
label{display:block;font-weight:700;font-size:13px;margin:12px 0 4px}
input[type=file],input[type=text]{width:100%;padding:8px;border:1px solid var(--line);border-radius:4px;font-size:13px}
.row{display:flex;gap:12px;flex-wrap:wrap}.row>div{flex:1;min-width:180px}
button{padding:10px 18px;border-radius:4px;border:1px solid var(--navy);font-size:14px;font-weight:700;cursor:pointer}
button.p{background:var(--navy);color:#fff}
button.s{background:#fff;color:var(--navy)}
button:disabled{opacity:.45;cursor:not-allowed}
.btns{margin-top:16px;display:flex;gap:8px;align-items:center}
.hint{font-size:12px;color:#5c6b7c;margin-top:6px;line-height:1.5}
table{width:100%;border-collapse:collapse;font-size:12.5px;margin-top:8px}
th{background:var(--navy);color:#fff;text-align:left;padding:6px 8px;font-weight:700}
td{border-bottom:1px solid var(--line);padding:6px 8px}
tr:nth-child(even) td{background:var(--soft)}
.kpi{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:12px}
.kpi div{flex:1;min-width:110px;border:1px solid var(--line);border-top:3px solid var(--navy);padding:10px;text-align:center;background:#fff}
.kpi .n{font-size:20px;font-weight:800;color:var(--navy)}
.kpi .l{font-size:11px;color:#5c6b7c}
.kpi.bad div{border-top-color:var(--red)} .kpi.bad .n{color:var(--red)}
.msg{padding:12px;border-radius:4px;margin-top:12px;font-size:13px;line-height:1.6}
.msg.ok{background:#e8f5ec;border:1px solid #a8d5b8;color:var(--green)}
.msg.no{background:#fdecea;border:1px solid #f0bdb8;color:var(--red)}
.msg.warn{background:#fdf6ec;border:1px solid #e8c9a0;color:var(--amber)}
.hide{display:none}
code{background:var(--soft);padding:1px 4px;border-radius:3px;font-size:12px}
</style></head><body><div class="wrap">

<h1>근태 엑셀 업로드 (예외 경로)</h1>
<p class="sub">근태 데이터 허브 &middot; ① 수집 &mdash; 제모스 미도입 인원·연동 장애 시에만 사용합니다. 기본 경로는 제모스 수신입니다.</p>

<div class="card">
  <h2>1단계 · 파일 선택 후 검사</h2>
  <label>엑셀 파일 (.xlsx / .xlsm / .xls)</label>
  <input type="file" id="f" accept=".xlsx,.xlsm,.xls">
  <div class="row">
    <div><label>시트 이름 <span style="font-weight:400;color:#5c6b7c">(비우면 첫 시트)</span></label>
      <input type="text" id="sheet" placeholder="예: 출입기록"></div>
    <div><label>대상 일자 <span style="font-weight:400;color:#5c6b7c">(비우면 파일에서 자동 판단)</span></label>
      <input type="text" id="td" placeholder="YYYY-MM-DD"></div>
  </div>
  <p class="hint">검사 단계에서는 <b>저장하지 않습니다.</b> 컬럼 인식 결과와 오류를 먼저 확인한 뒤 2단계에서 적재하십시오.</p>
  <div class="btns"><button class="p" id="bp">검사하기</button><span id="st" class="hint"></span></div>
</div>

<div class="card hide" id="res">
  <h2>2단계 · 인식 결과 확인</h2>
  <div id="kpi"></div>
  <div id="cols"></div>
  <div id="errs"></div>
  <div id="samp"></div>
  <div class="btns">
    <button class="p" id="bc">이대로 적재하기</button>
    <button class="s" id="bcp" title="오류 행을 건너뛰고 정상 행만 적재합니다">오류 행 건너뛰고 적재</button>
  </div>
  <div id="out"></div>
</div>

<script>
const $=id=>document.getElementById(id);
let last=null;

function esc(s){return String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));}

function kpi(d){
  const bad=d.error_rows>0;
  $('kpi').innerHTML='<div class="kpi'+(bad?' bad':'')+'">'
    +'<div><div class="n">'+d.total_data_rows+'</div><div class="l">전체 데이터 행</div></div>'
    +'<div><div class="n">'+d.parsed_rows+'</div><div class="l">정상 인식</div></div>'
    +'<div><div class="n">'+d.error_rows+'</div><div class="l">오류 행</div></div>'
    +'<div><div class="n">'+d.distinct_cards+'</div><div class="l">카드 수</div></div>'
    +'<div><div class="n" style="font-size:14px">'+(d.date_range?d.date_range.from+'<br>~ '+d.date_range.to:'-')+'</div><div class="l">기간</div></div>'
    +'</div>';
  $('cols').innerHTML='<p class="hint">시트 <b>'+esc(d.sheet_name)+'</b> · 헤더 '+d.header_row+'행 인식</p>'
    +'<table><tr><th>표준 항목</th><th>엑셀 컬럼명</th></tr>'
    +Object.entries(d.detected_columns).map(([k,v])=>'<tr><td>'+esc(k)+'</td><td>'+esc(v)+'</td></tr>').join('')
    +'</table>';
  $('errs').innerHTML = d.error_rows
    ? '<div class="msg warn"><b>오류 '+d.error_rows+'행</b> — 기본은 <b>전량 미적재</b>입니다. 파일을 고쳐 다시 올리거나, 해당 행을 빼고 넣으려면 아래 회색 버튼을 쓰십시오.</div>'
      +'<table><tr><th style="width:70px">엑셀 행</th><th>내용</th></tr>'
      +d.errors.map(e=>'<tr><td>'+e.row+'</td><td>'+esc(e.message)+'</td></tr>').join('')+'</table>'
    : '<div class="msg ok">오류 없음. 그대로 적재하면 됩니다.</div>';
  $('samp').innerHTML = d.sample && d.sample.length
    ? '<p class="hint" style="margin-top:14px"><b>미리보기</b> (앞 '+d.sample.length+'행)</p>'
      +'<table><tr><th>카드번호</th><th>구분</th><th>시각</th><th>게이트</th></tr>'
      +d.sample.map(r=>'<tr><td>'+esc(r.card_no)+'</td><td>'+r.direction+'</td><td>'+esc(r.tagged_at)+'</td><td>'+esc(r.gate||'')+'</td></tr>').join('')+'</table>'
    : '';
}

function body(partial){
  const fd=new FormData();
  fd.append('file',$('f').files[0]);
  if($('sheet').value.trim()) fd.append('sheet',$('sheet').value.trim());
  fd.append('site',$('site').value.trim()||'AP대전');
  if(partial) fd.append('allow_partial','true');
  return fd;
}

async function send(url,partial,btn){
  if(!$('f').files[0]){ $('st').textContent='파일을 먼저 선택하십시오.'; return null; }
  document.querySelectorAll('button').forEach(b=>b.disabled=true);
  $('st').textContent='처리 중...';
  try{
    const r=await fetch(url,{method:'POST',body:body(partial)});
    const d=await r.json();
    $('st').textContent='';
    return {ok:r.ok,d};
  }catch(e){
    $('st').textContent='요청 실패: '+e.message; return null;
  }finally{
    document.querySelectorAll('button').forEach(b=>b.disabled=false);
  }
}

$('bp').onclick=async()=>{
  $('out').innerHTML='';
  const r=await send('/api/collect/excel/preview',false);
  if(!r) return;
  $('res').classList.remove('hide');
  if(!r.ok){ $('kpi').innerHTML=''; $('cols').innerHTML=''; $('samp').innerHTML='';
    $('errs').innerHTML='<div class="msg no">'+esc(r.d.error)+'</div>'; return; }
  last=r.d; kpi(r.d);
};

async function commit(partial){
  const r=await send('/api/collect/excel',partial);
  if(!r) return;
  if(!r.ok){
    $('out').innerHTML='<div class="msg no">'+esc(r.d.reason||r.d.error||'적재 실패')+'</div>'; return;
  }
  const d=r.d;
  $('out').innerHTML='<div class="msg ok"><b>적재 완료</b><br>'
    +'신규 '+d.inserted+'건 · 중복 무시 '+d.duplicates_ignored+'건 · 오류 건너뜀 '+d.skipped_error_rows+'건<br>'
    +'배치 <code>'+esc(d.batch_id)+'</code> · 미매핑 키 '+d.unmapped_keys+'건<br>'
    +'다음 단계: 검증 실행 <code>POST /api/validate/run {month, site}</code></div>';
}
$('bc').onclick=()=>commit(false);
$('bcp').onclick=()=>commit(true);
</script>
</div></body></html>`;
