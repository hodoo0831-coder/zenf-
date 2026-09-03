// 자동 생성 — 데모 화면 임베드. 직접 수정하지 말 것.
export const DEMO_PAGE = `<title>근태 원천등록 데모</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+KR:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap">
<style>
:root{
  --ink:#16202b; --slate:#3d5875; --slate-d:#2b3f56; --line:#d5dce5; --line-s:#e6ebf1;
  --bg:#f6f8fa; --surf:#ffffff; --surf-2:#eef2f6; --mut:#5f7284;
  --teal:#1a6b58; --teal-bg:#e6f2ee; --amber:#96591a; --amber-bg:#fdf3e3;
  --crim:#9d2823; --crim-bg:#fbeceb; --info:#245a8d; --info-bg:#e8f0f8;
  --shadow:0 1px 2px rgba(22,32,43,.06),0 2px 8px rgba(22,32,43,.04);
  --sans:"IBM Plex Sans KR",-apple-system,"Malgun Gothic",sans-serif;
  --mono:"IBM Plex Mono","IBM Plex Sans KR",monospace;
}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){
  --ink:#e7edf3; --slate:#8fb0d0; --slate-d:#a9c4dd; --line:#2a3644; --line-s:#222d3a;
  --bg:#121821; --surf:#1a2331; --surf-2:#212c3b; --mut:#93a4b6;
  --teal:#5bbfa2; --teal-bg:#15302a; --amber:#d9a05a; --amber-bg:#332616;
  --crim:#e58b85; --crim-bg:#361d1c; --info:#7fb2e0; --info-bg:#16283a;
  --shadow:0 1px 2px rgba(0,0,0,.4),0 2px 10px rgba(0,0,0,.25);
}}
:root[data-theme="dark"]{
  --ink:#e7edf3; --slate:#8fb0d0; --slate-d:#a9c4dd; --line:#2a3644; --line-s:#222d3a;
  --bg:#121821; --surf:#1a2331; --surf-2:#212c3b; --mut:#93a4b6;
  --teal:#5bbfa2; --teal-bg:#15302a; --amber:#d9a05a; --amber-bg:#332616;
  --crim:#e58b85; --crim-bg:#361d1c; --info:#7fb2e0; --info-bg:#16283a;
  --shadow:0 1px 2px rgba(0,0,0,.4),0 2px 10px rgba(0,0,0,.25);
}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font-family:var(--sans);font-size:14px;line-height:1.6;word-break:keep-all}
.mono,.id{font-family:var(--mono);font-variant-numeric:tabular-nums}

/* ---- shell ---- */
.app{display:grid;grid-template-columns:246px 1fr;min-height:100vh}
.rail{background:var(--surf);border-right:1px solid var(--line);padding:16px 0;position:sticky;top:0;height:100vh;overflow-y:auto}
.brand{padding:0 16px 14px;border-bottom:1px solid var(--line-s);margin-bottom:12px}
.brand b{display:block;font-size:15px;font-weight:700;letter-spacing:-.01em}
.brand span{font-size:11px;color:var(--mut);font-family:var(--mono)}
.rgroup{padding:0 12px;margin-bottom:6px}
.rlabel{font-size:10px;font-weight:700;letter-spacing:.13em;color:var(--mut);padding:10px 4px 6px;text-transform:uppercase}
.nav{display:block;width:100%;text-align:left;border:0;background:none;color:var(--ink);font-family:var(--sans);font-size:13px;
     padding:7px 10px;border-radius:5px;cursor:pointer;display:flex;gap:8px;align-items:baseline}
.nav:hover{background:var(--surf-2)}
.nav[aria-current="true"]{background:var(--slate);color:#fff}
.nav[aria-current="true"] .scr{color:rgba(255,255,255,.72)}
.nav .scr{font-family:var(--mono);font-size:10px;color:var(--mut);flex:none;width:52px}
.nav .n{flex:1}
.nav .dot{width:6px;height:6px;border-radius:50%;flex:none;margin-top:6px}
.d-crim{background:var(--crim)} .d-amber{background:var(--amber)} .d-teal{background:var(--teal)} .d-none{background:transparent}

main{padding:22px 26px 72px;max-width:1180px}
.crumb{font-family:var(--mono);font-size:11px;color:var(--mut);margin-bottom:3px}
h1{font-size:21px;font-weight:700;margin:0 0 4px;letter-spacing:-.015em;text-wrap:balance}
.lead{color:var(--mut);margin:0 0 18px;font-size:13px;max-width:64ch}
h2{font-size:14px;font-weight:700;margin:26px 0 10px;padding-bottom:6px;border-bottom:1px solid var(--line-s)}
h2:first-of-type{margin-top:0}
h3{font-size:12.5px;font-weight:700;margin:16px 0 7px;color:var(--slate-d)}
p{margin:0 0 10px}

/* ---- state bar ---- */
.bar{display:flex;gap:1px;background:var(--line);border:1px solid var(--line);border-radius:7px;overflow:hidden;margin-bottom:20px}
.bar>div{flex:1;background:var(--surf);padding:9px 12px;min-width:0}
.bar .k{font-size:10px;color:var(--mut);letter-spacing:.08em;font-weight:600}
.bar .v{font-family:var(--mono);font-size:14px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}

/* ---- feature tags ---- */
.fids{display:flex;flex-wrap:wrap;gap:5px;margin-bottom:16px}
.fid{font-family:var(--mono);font-size:10.5px;font-weight:500;padding:2px 6px;border-radius:3px;
     background:var(--surf-2);color:var(--slate-d);border:1px solid var(--line-s)}
.fid.mvp{background:var(--info-bg);color:var(--info);border-color:transparent}

/* ---- table ---- */
.tw{overflow-x:auto;border:1px solid var(--line);border-radius:7px;background:var(--surf)}
table{width:100%;border-collapse:collapse;font-size:12.5px}
th{text-align:left;padding:8px 11px;background:var(--surf-2);font-weight:600;font-size:11px;
   letter-spacing:.04em;color:var(--mut);white-space:nowrap;border-bottom:1px solid var(--line)}
td{padding:8px 11px;border-bottom:1px solid var(--line-s);vertical-align:top}
tbody tr:last-child td{border-bottom:0}
tbody tr:hover td{background:var(--surf-2)}
td.num,th.num{text-align:right;font-family:var(--mono);font-variant-numeric:tabular-nums}
td.c,th.c{text-align:center}

/* ---- pills ---- */
.pill{display:inline-block;font-size:11px;font-weight:600;padding:1.5px 7px;border-radius:11px;white-space:nowrap}
.p-ok{background:var(--teal-bg);color:var(--teal)}
.p-warn{background:var(--amber-bg);color:var(--amber)}
.p-err{background:var(--crim-bg);color:var(--crim)}
.p-info{background:var(--info-bg);color:var(--info)}
.p-mut{background:var(--surf-2);color:var(--mut)}
.sev{display:inline-block;width:3px;height:13px;border-radius:2px;vertical-align:-2px;margin-right:6px}

/* ---- cards / callouts ---- */
.grid{display:grid;gap:12px}
.g2{grid-template-columns:repeat(auto-fit,minmax(280px,1fr))}
.g3{grid-template-columns:repeat(auto-fit,minmax(210px,1fr))}
.card{background:var(--surf);border:1px solid var(--line);border-radius:7px;padding:14px 15px}
.card .ct{font-size:11px;font-weight:700;letter-spacing:.07em;color:var(--mut);margin-bottom:8px}
.note{border-left:3px solid var(--slate);background:var(--surf);padding:11px 14px;border-radius:0 6px 6px 0;margin:0 0 14px;font-size:12.5px}
.note.warn{border-left-color:var(--amber);background:var(--amber-bg)}
.note.err{border-left-color:var(--crim);background:var(--crim-bg)}
.note.ok{border-left-color:var(--teal);background:var(--teal-bg)}
.note b{font-weight:700}
.note .nt{font-size:10px;font-weight:700;letter-spacing:.1em;display:block;margin-bottom:3px;opacity:.85}

/* ---- kpi ---- */
.kpi{display:grid;grid-template-columns:repeat(auto-fit,minmax(132px,1fr));gap:10px;margin-bottom:16px}
.kpi>div{background:var(--surf);border:1px solid var(--line);border-radius:7px;padding:11px 13px}
.kpi .n{font-family:var(--mono);font-size:23px;font-weight:600;line-height:1.15;letter-spacing:-.02em}
.kpi .l{font-size:11px;color:var(--mut);margin-top:2px}
.kpi .sub{font-size:10.5px;color:var(--mut);font-family:var(--mono);margin-top:3px}
.kpi>div.hot{border-color:var(--crim)} .kpi>div.hot .n{color:var(--crim)}
.kpi>div.warm{border-color:var(--amber)} .kpi>div.warm .n{color:var(--amber)}
.kpi>div.good .n{color:var(--teal)}

/* ---- buttons ---- */
.btns{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:14px 0}
button.b{font-family:var(--sans);font-size:13px;font-weight:600;padding:8px 15px;border-radius:5px;cursor:pointer;
        border:1px solid var(--slate);background:var(--slate);color:#fff}
button.b.sec{background:var(--surf);color:var(--slate-d);border-color:var(--line)}
button.b.sm{font-size:11.5px;padding:4px 9px}
button.b:disabled{opacity:.4;cursor:not-allowed}
button.b:hover:not(:disabled){filter:brightness(1.08)}
:focus-visible{outline:2px solid var(--info);outline-offset:2px}

/* ---- gate ---- */
.gate{border:1px solid var(--line);border-radius:7px;background:var(--surf);overflow:hidden;margin-bottom:16px}
.gate>div{display:flex;gap:10px;padding:9px 13px;border-bottom:1px solid var(--line-s);align-items:baseline;font-size:12.5px}
.gate>div:last-child{border-bottom:0}
.gate .mk{font-family:var(--mono);font-weight:700;flex:none;width:16px}
.gate .pass .mk{color:var(--teal)} .gate .fail .mk{color:var(--crim)}
.gate .why{color:var(--mut);font-size:11.5px;margin-left:auto;text-align:right}

/* ---- misc ---- */
.legend{display:flex;gap:14px;flex-wrap:wrap;font-size:11px;color:var(--mut);margin-bottom:12px}
.legend span b{color:var(--ink)}
.bar-mini{height:5px;background:var(--surf-2);border-radius:3px;overflow:hidden;min-width:56px}
.bar-mini i{display:block;height:100%;background:var(--teal)}
.bar-mini i.w{background:var(--amber)} .bar-mini i.e{background:var(--crim)}
.log{font-family:var(--mono);font-size:11.5px;background:var(--surf);border:1px solid var(--line);border-radius:7px;
     padding:11px 13px;max-height:210px;overflow-y:auto}
.log div{padding:2px 0;border-bottom:1px solid var(--line-s);display:flex;gap:9px}
.log div:last-child{border-bottom:0}
.log .t{color:var(--mut);flex:none}
.chk{list-style:none;padding:0;margin:0 0 12px}
.chk li{padding-left:20px;position:relative;margin-bottom:5px;font-size:12.5px}
.chk li:before{content:"—";position:absolute;left:0;color:var(--mut);font-family:var(--mono)}
.chk li.y:before{content:"✓";color:var(--teal);font-weight:700}
.chk li.n:before{content:"✕";color:var(--crim);font-weight:700}
.hint{font-size:11.5px;color:var(--mut);margin-top:6px}
.foot{margin-top:34px;padding-top:14px;border-top:1px solid var(--line);font-size:11px;color:var(--mut)}
@media (max-width:820px){.app{grid-template-columns:1fr}.rail{position:static;height:auto;border-right:0;border-bottom:1px solid var(--line)}main{padding:16px}}
@media (prefers-reduced-motion:reduce){*{transition:none!important;animation:none!important}}
</style>
<div class="app">
  <nav class="rail" aria-label="화면 이동">
    <div class="brand">
      <b>근태 원천등록 데모</b>
      <span>AX TF · 기능정의서 v1.1</span>
    </div>
    <div id="rail"></div>
  </nav>
  <main id="main"></main>
</div>
<script>
"use strict";
/* ============================================================
   근태 원천등록·ERP 전송 자동화 — 기능별 데모
   기준 문서: 통합 근태관리 시스템 기능정의서 v1.1 (56기능 / MVP 29)
   반영 변경 3건: ①제모스 원천화 ②ERP 직접전송 ③근로자 서명 제외
   ============================================================ */

const FEATS = [{"id":"F-A0103","nm":"로그인 / 로그아웃","l1":"","pri":"MVP","ai":"HUMAN","scr":"SCR-C-01","role":"WMJS"},{"id":"F-A0201","nm":"역할(Role) 부여 · 변경 메뉴지정","l1":"A2.권한·조직배정","pri":"MVP","ai":"HUMAN","scr":"SCR-J-03/SCR-S-05","role":"JS"},{"id":"F-A0202","nm":"현장 배정 (현장관리자)","l1":"A2.권한·조직배정","pri":"MVP","ai":"HUMAN","scr":"SCR-J-03/SCR-S-05","role":"JS"},{"id":"F-A0203","nm":"관리범위 배정 (J/C 다중현장)","l1":"A2.권한·조직배정","pri":"OPT","ai":"HUMAN","scr":"SCR-S-05","role":"S"},{"id":"F-B0201","nm":"고객사근태코드 정의 · 관리","l1":"B2.근태기준","pri":"MVP","ai":"HUMAN","scr":"SCR-S-01","role":"JS"},{"id":"F-B0202","nm":"근무제도 정의 (교대·유연·정상)","l1":"B2.근태기준","pri":"OPT","ai":"HUMAN","scr":"SCR-S-01","role":"JS"},{"id":"F-B0203","nm":"휴일 · 공휴일 캘린더 관리","l1":"B2.근태기준","pri":"MVP","ai":"HUMAN","scr":"SCR-S-01","role":"JS"},{"id":"F-B0204","nm":"소정근로 · 휴게 기준 설정","l1":"B2.근태기준","pri":"MVP","ai":"HUMAN","scr":"SCR-S-01","role":"JS"},{"id":"F-C0101","nm":"월 근무계획 등록","l1":"C.근무계획","pri":"MVP","ai":"HUMAN","scr":"SCR-M-02/SCR-W-02","role":"MJ"},{"id":"F-C0102","nm":"교대패턴 일괄 생성","l1":"C.근무계획","pri":"OPT","ai":"MIX","scr":"SCR-M-02","role":"MJ"},{"id":"F-C0103","nm":"근무계획 변경 · 이력 관리","l1":"C.근무계획","pri":"OPT","ai":"HUMAN","scr":"SCR-M-02","role":"MJ"},{"id":"F-C0104","nm":"내 근무계획 조회 (근로자)","l1":"C.근무계획","pri":"OPT","ai":"HUMAN","scr":"SCR-W-02","role":"W"},{"id":"F-C0105","nm":"주52시간 사전 시뮬레이션","l1":"C.근무계획","pri":"OPT","ai":"MIX","scr":"SCR-M-02/SCR-J-02","role":"MJS"},{"id":"F-D0104","nm":"고객사 시스템 연동 수집 (API)","l1":"C.근무계획","pri":"OPT","ai":"HUMAN","scr":"SCR-S-04","role":"S"},{"id":"F-D0105","nm":"Excel 업로드 수집","l1":"C.근무계획","pri":"MVP","ai":"MIX","scr":"SCR-M-03","role":"MJS"},{"id":"F-D0106","nm":"수기 입력 (현장관리자 대행)","l1":"C.근무계획","pri":"MVP","ai":"MIX","scr":"SCR-M-03","role":"MJS"},{"id":"F-D0108","nm":"수기 근태 이미지 인식 (OCR) 업로드","l1":"C.근무계획","pri":"OPT","ai":"AI","scr":"SCR-M-03","role":"MJS"},{"id":"F-D0107","nm":"근태 수집 현황 모니터링","l1":"C.근무계획","pri":"OPT","ai":"MIX","scr":"SCR-M-03/SCR-J-02","role":"MJS"},{"id":"F-E0101","nm":"원본(RAW) 데이터 적재 · 보존","l1":"E.데이터표준화","pri":"MVP","ai":"AI","scr":"SCR-S-03","role":"S"},{"id":"F-E0102","nm":"근태코드 매핑 변환","l1":"E.데이터표준화","pri":"MVP","ai":"AI","scr":"SCR-S-03","role":"S"},{"id":"F-E0103","nm":"중복 · 누락 정합성 처리","l1":"E.데이터표준화","pri":"MVP","ai":"AI","scr":"SCR-S-03","role":"S"},{"id":"F-E0105","nm":"변환 · 변경 이력 추적","l1":"E.데이터표준화","pri":"OPT","ai":"MIX","scr":"SCR-S-03/SCR-S-06","role":"S"},{"id":"F-F0101","nm":"검증 규칙 실행 (배치 · 실시간)","l1":"F.자동검증","pri":"MVP","ai":"AI","scr":"SCR-M-04/SCR-S-02","role":"MJS"},{"id":"F-F0102","nm":"이상근태(예외) 생성 · 분류","l1":"F.자동검증","pri":"MVP","ai":"AI","scr":"SCR-M-04","role":"MJS"},{"id":"F-F0103","nm":"정상 근태 자동처리 분류","l1":"F.자동검증","pri":"MVP","ai":"AI","scr":"SCR-M-04/SCR-J-02","role":"MJS"},{"id":"F-F0104","nm":"법정 한도 · 가산 대상 검증","l1":"F.자동검증","pri":"MVP","ai":"AI","scr":"SCR-M-04/SCR-J-02","role":"MJS"},{"id":"F-F0105","nm":"예외 우선순위 지정 및 알림","l1":"F.자동검증","pri":"OPT","ai":"MIX","scr":"SCR-M-04/SCR-J-02","role":"MJS"},{"id":"F-F0106","nm":"정상 근태 자동승인 처리","l1":"F.자동검증","pri":"MVP","ai":"AI","scr":"SCR-M-04/SCR-J-02","role":"JS"},{"id":"F-F0107","nm":"근로시간 한도 일일 실시간 판정 · 사전 경고","l1":"F.자동검증","pri":"MVP","ai":"MIX","scr":"SCR-M-01/SCR-J-01","role":"MJS"},{"id":"F-G0101","nm":"내 근태 조회 (예정 vs 실적)","l1":"G.예외처리·승인","pri":"OPT","ai":"HUMAN","scr":"SCR-W-03","role":"W"},{"id":"F-G0102","nm":"근태 수정요청 등록","l1":"G.예외처리·승인","pri":"OPT","ai":"HUMAN","scr":"SCR-W-04","role":"W"},{"id":"F-G0103","nm":"연장근로 신청 · 사후 승인요청","l1":"G.예외처리·승인","pri":"OPT","ai":"HUMAN","scr":"SCR-W-05","role":"W"},{"id":"F-G0203","nm":"확정값 보정 (원본 보존)","l1":"G.예외처리·승인","pri":"MVP","ai":"MIX","scr":"SCR-M-04","role":"MJ"},{"id":"F-G0204","nm":"1차 근태 확정 (현장)","l1":"G.예외처리·승인","pri":"MVP","ai":"HUMAN","scr":"SCR-M-06","role":""},{"id":"F-G0301","nm":"다중 현장 통합 조회","l1":"G.예외처리·승인","pri":"OPT","ai":"HUMAN","scr":"SCR-J-01/SCR-J-02","role":"J"},{"id":"F-G0302","nm":"2차 검토 및 승인","l1":"G.예외처리·승인","pri":"MVP","ai":"HUMAN","scr":"SCR-J-03","role":"J"},{"id":"F-G0303","nm":"현장 반송 (재검토 요청)","l1":"G.예외처리·승인","pri":"OPT","ai":"HUMAN","scr":"SCR-J-03","role":"J"},{"id":"F-G0304","nm":"이상근태 최종 확정","l1":"G.예외처리·승인","pri":"OPT","ai":"HUMAN","scr":"SCR-J-03","role":"J"},{"id":"F-H0101","nm":"월 마감 실행","l1":"H.마감","pri":"MVP","ai":"HUMAN","scr":"SCR-J-04","role":"J"},{"id":"F-H0102","nm":"마감 잠금 (Lock) 설정 ERP에서 급여 만들면 잠가짐","l1":"H.마감","pri":"MVP","ai":"HUMAN","scr":"SCR-J-04","role":"JS"},{"id":"F-H0104","nm":"마감 현황 대시보드","l1":"H.마감","pri":"OPT","ai":"HUMAN","scr":"SCR-J-01","role":"J"},{"id":"F-I0101","nm":"확정 근태 집계 생성","l1":"I.산출물","pri":"MVP","ai":"AI","scr":"SCR-J-05","role":"J"},{"id":"F-I0106","nm":"집계 결과 검증 (합계 대조)","l1":"I.산출물","pri":"MVP","ai":"MIX","scr":"SCR-J-05","role":"JS"},{"id":"F-I0102","nm":"ERP근태 전송 기능","l1":"I.산출물","pri":"MVP","ai":"HUMAN","scr":"SCR-S-03/SCR-J-05","role":"S"},{"id":"F-I0107","nm":"고객사 리포트 생성 (비식별)","l1":"I.산출물","pri":"OPT","ai":"AI","scr":"SCR-J-06","role":"J"},{"id":"F-I0108","nm":"산출물 다운로드 · 배포 이력 관리","l1":"I.산출물","pri":"OPT","ai":"HUMAN","scr":"SCR-J-05/SCR-J-06","role":"JS"},{"id":"F-I0109","nm":"ERP 업로드 결과 기록 · 확인","l1":"I.산출물","pri":"MVP","ai":"HUMAN","scr":"SCR-J-05","role":"J"},{"id":"F-J0101","nm":"검증 Rule 설정 관리","l1":"J.시스템운영","pri":"MVP","ai":"HUMAN","scr":"SCR-S-02","role":"S"},{"id":"F-J0102","nm":"데이터 매핑 규칙 관리","l1":"J.시스템운영","pri":"MVP","ai":"HUMAN","scr":"SCR-S-03","role":"S"},{"id":"F-J0103","nm":"외부 연동 (API · 인터페이스) 설정","l1":"J.시스템운영","pri":"OPT","ai":"HUMAN","scr":"SCR-S-04","role":"S"},{"id":"F-J0104","nm":"권한 · 메뉴 관리","l1":"J.시스템운영","pri":"OPT","ai":"HUMAN","scr":"SCR-S-05","role":"S"},{"id":"F-J0105","nm":"Audit Log 조회","l1":"J.시스템운영","pri":"OPT","ai":"HUMAN","scr":"SCR-S-06","role":"S"},{"id":"F-J0106","nm":"개인정보 마스킹 정책 관리","l1":"J.시스템운영","pri":"OPT","ai":"HUMAN","scr":"SCR-S-05","role":"S"},{"id":"F-J0109","nm":"데이터 백업 · 보존정책 관리","l1":"J.시스템운영","pri":"OPT","ai":"HUMAN","scr":"SCR-S-07","role":"S"},{"id":"F-J0110","nm":"릴리즈 · 형상 관리","l1":"J.시스템운영","pri":"OPT","ai":"HUMAN","scr":"SCR-S-07","role":"S"},{"id":"F-J0111","nm":"자동화 효과 지표 측정","l1":"J.시스템운영","pri":"OPT","ai":"MIX","scr":"SCR-S-07","role":"JS"}];

/* ---------- 화면 정의 : 기능정의서의 화면ID를 그대로 쓴다 ---------- */
const ROLES = {
  C: { nm: "공통",        sub: "인증" },
  W: { nm: "근로자",      sub: "제모스 + 모바일 웹" },
  M: { nm: "현장관리자",  sub: "PC 웹" },
  J: { nm: "J/C 담당",    sub: "PC 웹" },
  S: { nm: "시스템관리자", sub: "PC 웹" },
};

const SCREENS = [
  { id:"MAP",       role:"C", nm:"기능 구현 대조표", f:[] },
  { id:"CHG",       role:"C", nm:"변경 3건 반영 현황", f:[] },
  { id:"SCR-C-01",  role:"C", nm:"로그인",            f:["F-A0103"] },
  { id:"SCR-W-03",  role:"W", nm:"내 근태 (예정 vs 실적)", f:["F-G0101","F-C0104"] },
  { id:"SCR-W-04",  role:"W", nm:"근태 수정요청",      f:["F-G0102","F-G0103"] },
  { id:"SCR-M-01",  role:"M", nm:"현장 대시보드 · 사전경고", f:["F-F0107"] },
  { id:"SCR-M-02",  role:"M", nm:"월 근무계획",        f:["F-C0101","F-C0102","F-C0103","F-C0105"] },
  { id:"SCR-M-03",  role:"M", nm:"근태 수집",          f:["F-D0105","F-D0106","F-D0107","F-D0108"] },
  { id:"SCR-M-04",  role:"M", nm:"예외 처리",          f:["F-F0101","F-F0102","F-F0103","F-F0104","F-F0106","F-G0203"] },
  { id:"SCR-M-06",  role:"M", nm:"1차 근태 확정",      f:["F-G0204"] },
  { id:"SCR-J-01",  role:"J", nm:"통합 대시보드",      f:["F-G0301","F-H0104"] },
  { id:"SCR-J-03",  role:"J", nm:"2차 검토 · 권한 배정", f:["F-G0302","F-G0303","F-A0201","F-A0202"] },
  { id:"SCR-J-04",  role:"J", nm:"월 마감 · 잠금",      f:["F-H0101","F-H0102"] },
  { id:"SCR-J-05",  role:"J", nm:"집계 · ERP 전송",     f:["F-I0101","F-I0106","F-I0102","F-I0109"] },
  { id:"SCR-S-01",  role:"S", nm:"기준정보",           f:["F-B0201","F-B0203","F-B0204"] },
  { id:"SCR-S-02",  role:"S", nm:"검증 Rule 설정",     f:["F-J0101"] },
  { id:"SCR-S-03",  role:"S", nm:"원본 적재 · 매핑",    f:["F-E0101","F-E0102","F-E0103","F-J0102"] },
  { id:"SCR-S-04",  role:"S", nm:"외부 연동",          f:["F-J0103","F-D0104"] },
  { id:"SCR-S-06",  role:"S", nm:"Audit Log",         f:["F-J0105","F-E0105"] },
];
const IMPLEMENTED = new Set(SCREENS.flatMap(s => s.f));

/* ---------- 근태코드 (F-B0201) ---------- */
const CODES = [
  { c:"W01", nm:"정상근무",   erp:"1000", pay:"기본",        use:true },
  { c:"W02", nm:"연장근로",   erp:"2100", pay:"가산 50%",    use:true },
  { c:"W03", nm:"야간근로",   erp:"2200", pay:"가산 50%",    use:true },
  { c:"W04", nm:"휴일근로",   erp:"2300", pay:"8h내 50%/초과 100%", use:true },
  { c:"A01", nm:"연차",       erp:"3100", pay:"유급",        use:true },
  { c:"A02", nm:"반차",       erp:"3110", pay:"유급 0.5",    use:true },
  { c:"L01", nm:"지각",       erp:"4100", pay:"실근무 차감", use:true },
  { c:"L02", nm:"조퇴",       erp:"4200", pay:"실근무 차감", use:true },
  { c:"X01", nm:"무단결근",   erp:"5100", pay:"무급",        use:true },
  { c:"X09", nm:"구코드(폐지)", erp:"—",  pay:"—",           use:false },
];

/* ---------- 검증 Rule (F-J0101) — 기준값은 설정 데이터, 하드코딩 금지 ---------- */
const RULES = [
  { id:"V-01", nm:"근태 미입력",     lv:"오류", desc:"근무 계획일인데 근태 기록 없음", p:"—" },
  { id:"V-02", nm:"중복 입력",       lv:"오류", desc:"동일 사번·일자 근태 2건 이상", p:"—" },
  { id:"V-03", nm:"대상 오류",       lv:"오류", desc:"퇴사일 이후 / 입사일 이전 근태", p:"—" },
  { id:"V-04", nm:"시간 이상치",     lv:"오류", desc:"1일 근무 상한 초과, 출근 > 퇴근", p:"일 16h" },
  { id:"V-05", nm:"휴게 미차감",     lv:"경고", desc:"8시간 초과 근무에 휴게 미반영", p:"4h/30m, 8h/1h" },
  { id:"V-06", nm:"주 52시간",       lv:"사전경고", desc:"주간 누적 초과 또는 초과 예상", p:"52h (경고 90%)" },
  { id:"V-07", nm:"연장 한도",       lv:"사전경고", desc:"주 12시간·월 한도 초과 또는 예상", p:"주 12h" },
  { id:"V-08", nm:"계획 대비 이상",  lv:"경고", desc:"계획 없는 근무 / 편차 초과", p:"±10분" },
  { id:"V-09", nm:"연차 대조",       lv:"경고", desc:"제모스 휴가 신청과 근태 상태 불일치", p:"—" },
  { id:"V-10", nm:"코드 미정의",     lv:"오류", desc:"매핑 테이블에 없는 근태코드", p:"—" },
  { id:"V-11", nm:"위치 이탈",       lv:"경고", desc:"제모스 태그 위치가 배정 현장 반경 밖", p:"반경 300m" },
  { id:"V-12", nm:"태그 결손",       lv:"오류", desc:"출근 태그만 있고 퇴근 태그 없음(또는 반대)", p:"—" },
];

/* ---------- 현장 인원 (12명) ---------- */
const STAFF = [
  { id:"Z2401", nm:"김현수", line:"치약1", zemos:true,  wk:48.5, plan:52 },
  { id:"Z2402", nm:"박정민", line:"치약1", zemos:true,  wk:50.5, plan:56 },
  { id:"Z2403", nm:"이서winner", line:"치약1", zemos:true, wk:38.0, plan:40 },
  { id:"Z2404", nm:"정다혜", line:"튜브2", zemos:true,  wk:40.0, plan:40 },
  { id:"Z2405", nm:"최민석", line:"튜브2", zemos:true,  wk:44.0, plan:48 },
  { id:"Z2406", nm:"한지우", line:"튜브2", zemos:false, wk:40.0, plan:40 },
  { id:"Z2407", nm:"오세훈", line:"염모1", zemos:true,  wk:47.0, plan:52 },
  { id:"Z2408", nm:"윤가람", line:"염모1", zemos:true,  wk:40.0, plan:40 },
  { id:"Z2409", nm:"장태윤", line:"멀티3", zemos:true,  wk:40.0, plan:40 },
  { id:"Z2410", nm:"신유진", line:"멀티3", zemos:false, wk:40.0, plan:40 },
  { id:"Z2411", nm:"고은비", line:"직선1", zemos:true,  wk:40.0, plan:40 },
  { id:"Z2412", nm:"류하준", line:"직선1", zemos:true,  wk:36.0, plan:40 },
];
STAFF[2].nm = "이서연";

/* ---------- 초기 예외 시드 (검증 실행으로 생성됨) ---------- */
const SEED_EXC = [
  { rule:"V-12", emp:"Z2401", d:"09-02", detail:"출근 07:52 태그만 있고 퇴근 태그 없음", ch:"제모스" },
  { rule:"V-01", emp:"Z2404", d:"09-03", detail:"계획일(주간)인데 근태 기록 없음", ch:"—" },
  { rule:"V-11", emp:"Z2407", d:"09-03", detail:"태그 위치가 배정 현장 반경 300m 밖 (측정 412m)", ch:"제모스" },
  { rule:"V-06", emp:"Z2402", d:"09-04", detail:"주 누적 50.5h + 잔여 계획 5.5h = 56.0h → 52h 초과 예상", ch:"산출" },
  { rule:"V-05", emp:"Z2405", d:"09-04", detail:"9.5h 근무에 휴게 30분만 반영 (기준 1h)", ch:"제모스" },
  { rule:"V-10", emp:"Z2406", d:"09-04", detail:"엑셀 업로드 코드 'X09'가 매핑 테이블에 없음", ch:"엑셀" },
  { rule:"V-08", emp:"Z2412", d:"09-05", detail:"계획 없는 근무 (계획 미등록일 태그 발생)", ch:"제모스" },
  { rule:"V-09", emp:"Z2409", d:"09-05", detail:"제모스 연차 신청 있으나 출퇴근 태그 존재", ch:"제모스" },
];

const REASONS = ["미태깅(장비오류)","지각","조퇴","외출","교육","출장","연차 정정","현장 이동","긴급 투입","기타(사유 기재)"];

/* ============================================================
   상태 — 화면이 아니라 데이터가 파이프라인을 움직인다.
   (이식 전제: 판정·집계 로직은 화면에 붙이지 않는다는 설계원칙 반영)
   ============================================================ */
const S = {
  screen: "MAP",
  month: "2026-09",
  site: "AP대전 · 제니엘 제조사업부",
  recv: false,        // 제모스 수신 (F0)
  validated: false,   // 검증 실행 (F-F0101)
  exc: [],            // 예외 (F-F0102)
  fixed1: false,      // 1차 확정 (F-G0204)
  approved: false,    // 2차 승인 (F-G0302)
  closed: false,      // 월 마감 (F-H0101)
  locked: false,      // 마감 잠금 (F-H0102)
  agg: null,          // 집계 (F-I0101)
  erp: null,          // ERP 전송 (F-I0102)
  audit: [],
};

const now = () => {
  const d = new Date();
  const p = n => String(n).padStart(2, "0");
  return \`09-01 \${p(d.getHours())}:\${p(d.getMinutes())}:\${p(d.getSeconds())}\`;
};
function log(actor, msg) {
  S.audit.unshift({ t: now(), actor, msg });
  if (S.audit.length > 60) S.audit.pop();
}
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;" }[c]));
const staffOf = id => STAFF.find(s => s.id === id) || { nm:"?", line:"?" };
const ruleOf  = id => RULES.find(r => r.id === id) || { nm:"?", lv:"경고" };
const openExc = () => S.exc.filter(e => e.st === "open");
const errOpen = () => openExc().filter(e => ruleOf(e.rule).lv === "오류");

/* ---------- 마감 게이트 (F-H0101) ----------
   변경 ③ 반영: '미서명 근로자 존재' 조건을 삭제했다.
   서명 기능이 없는데 조건을 남기면 마감이 영구 차단된다. */
let gate = function () {
  return [
    { k:"제모스 근태 수신",  ok:S.recv,      why:S.recv ? "수신 완료" : "미수신 — 수집 화면에서 실행" },
    { k:"자동 검증 실행",    ok:S.validated, why:S.validated ? "실행 완료" : "미실행" },
    { k:"오류 등급 예외 0건", ok:S.validated && errOpen().length === 0,
      why:errOpen().length ? \`미처리 오류 \${errOpen().length}건\` : "차단 없음" },
    { k:"1차 확정 (현장)",   ok:S.fixed1,    why:S.fixed1 ? "확정 완료" : "미확정" },
    { k:"2차 승인 (J/C)",    ok:S.approved,  why:S.approved ? "승인 완료" : "미승인" },
  ];
};
let canClose = () => gate().every(g => g.ok);

/* ---------- 계산 ---------- */
let totals = function () {
  const base = STAFF.length * 160;
  const ot = STAFF.reduce((a, s) => a + Math.max(0, s.wk - 40) * 4, 0);
  return { head: STAFF.length, base, ot: Math.round(ot * 10) / 10, night: 46.5, holi: 16 };
};

/* ============================================================
   렌더 골격
   ============================================================ */
function fidTags(ids) {
  if (!ids.length) return "";
  return \`<div class="fids">\${ids.map(id => {
    const f = FEATS.find(x => x.id === id);
    return \`<span class="fid \${f && f.pri === "MVP" ? "mvp" : ""}" title="\${f ? esc(f.nm) : ""}">\${id}\${f && f.pri === "MVP" ? " · MVP" : ""}</span>\`;
  }).join("")}</div>\`;
}

function stateBar() {
  const st = S.locked ? ["잠금", "p-err"] : S.closed ? ["마감", "p-info"]
    : S.approved ? ["2차 승인", "p-ok"] : S.fixed1 ? ["1차 확정", "p-ok"]
    : S.validated ? ["검증 완료", "p-warn"] : S.recv ? ["수신 완료", "p-mut"] : ["미수신", "p-mut"];
  return \`<div class="bar">
    <div><div class="k">대상 월</div><div class="v">\${S.month}</div></div>
    <div><div class="k">현장</div><div class="v" style="font-family:var(--sans);font-size:13px">\${esc(S.site)}</div></div>
    <div><div class="k">인원</div><div class="v">\${STAFF.length}명</div></div>
    <div><div class="k">미처리 예외</div><div class="v" style="color:\${openExc().length ? "var(--crim)" : "var(--teal)"}">\${openExc().length}건</div></div>
    <div><div class="k">진행 상태</div><div class="v"><span class="pill \${st[1]}">\${st[0]}</span></div></div>
  </div>\`;
}

function railHTML() {
  let h = "";
  for (const [rk, r] of Object.entries(ROLES)) {
    const list = SCREENS.filter(s => s.role === rk);
    if (!list.length) continue;
    h += \`<div class="rgroup"><div class="rlabel">\${r.nm} · \${r.sub}</div>\`;
    for (const s of list) {
      const d = s.id === "SCR-M-04" && openExc().length ? "d-crim"
        : s.id === "SCR-J-04" && canClose() && !S.closed ? "d-teal"
        : s.id === "SCR-J-05" && S.closed && !S.erp ? "d-amber" : "d-none";
      const hasId = s.id.startsWith("SCR");
      h += \`<button class="nav" data-go="\${s.id}" aria-current="\${S.screen === s.id}">
        \${hasId ? \`<span class="scr">\${s.id}</span>\` : ""}
        <span class="n"\${hasId ? "" : ' style="font-weight:600"'}>\${esc(s.nm)}</span><span class="dot \${d}"></span></button>\`;
    }
    h += \`</div>\`;
  }
  return h;
}

/* ============================================================
   화면별 렌더
   ============================================================ */
const V = {};

/* ---------- 기능 구현 대조표 ---------- */
V.MAP = () => {
  const groups = {};
  for (const f of FEATS) (groups[f.l1 || "기타"] ||= []).push(f);
  const done = FEATS.filter(f => IMPLEMENTED.has(f.id));
  const mvp = FEATS.filter(f => f.pri === "MVP");
  const mvpDone = mvp.filter(f => IMPLEMENTED.has(f.id));

  let rows = "";
  for (const [g, list] of Object.entries(groups)) {
    rows += \`<tr><td colspan="5" style="background:var(--surf-2);font-weight:700;font-size:11.5px">\${esc(g)}</td></tr>\`;
    for (const f of list) {
      const on = IMPLEMENTED.has(f.id);
      const scr = SCREENS.find(s => s.f.includes(f.id));
      rows += \`<tr>
        <td class="mono" style="white-space:nowrap">\${f.id}</td>
        <td>\${esc(f.nm)}</td>
        <td class="c"><span class="pill \${f.pri === "MVP" ? "p-info" : "p-mut"}">\${f.pri}</span></td>
        <td class="c"><span class="pill \${f.ai === "AI" ? "p-ok" : f.ai === "MIX" ? "p-warn" : "p-mut"}">\${f.ai === "AI" ? "자동" : f.ai === "MIX" ? "AI+사람" : "사람"}</span></td>
        <td>\${on ? \`<span class="pill p-ok">구현</span> <span class="mono" style="font-size:10.5px;color:var(--mut)">\${scr.id}</span>\`
                 : \`<span class="pill p-mut">미구현</span> <span style="font-size:11px;color:var(--mut)">\${esc(f.scr || "—")}</span>\`}</td>
      </tr>\`;
    }
  }
  return \`<div class="crumb">기능정의서 v1.1 대조</div>
  <h1>기능 구현 대조표</h1>
  <p class="lead">기능정의서에 정의된 \${FEATS.length}개 기능을 데모 화면에 1:1로 매핑했습니다. 왼쪽 화면 목록의 화면ID는 기능정의서의 화면ID를 그대로 씁니다.</p>
  <div class="kpi">
    <div class="good"><div class="n">\${mvpDone.length}/\${mvp.length}</div><div class="l">MVP 기능 구현</div><div class="sub">필수 범위</div></div>
    <div><div class="n">\${done.length}/\${FEATS.length}</div><div class="l">전체 기능 구현</div><div class="sub">선택 포함</div></div>
    <div><div class="n">\${SCREENS.filter(s => s.id.startsWith("SCR")).length}</div><div class="l">데모 화면</div><div class="sub">역할 5종</div></div>
    <div class="warm"><div class="n">3</div><div class="l">반영한 변경</div><div class="sub">제모스·ERP·서명</div></div>
  </div>
  <div class="note warn"><span class="nt">확인 필요</span>
    미구현 \${FEATS.length - done.length}건은 <b>선택(추가) 기능</b>과 <b>기준정보 초기세팅 항목</b>입니다.
    데모 목적상 MVP 흐름(수집 → 검증 → 확정 → 마감 → ERP 전송)을 먼저 완결시켰습니다.
    선택 기능 중 우선 붙일 것을 지정해 주시면 이어서 만듭니다.</div>
  <div class="tw"><table>
    <thead><tr><th>기능ID</th><th>기능명</th><th class="c">우선순위</th><th class="c">처리 주체</th><th>데모 반영</th></tr></thead>
    <tbody>\${rows}</tbody></table></div>\`;
};

/* ---------- 변경 3건 반영 현황 ---------- */
V.CHG = () => \`<div class="crumb">2026-09-01 확정 변경사항</div>
  <h1>변경 3건 반영 현황</h1>
  <p class="lead">TF에서 확정된 3건을 데모에 반영했습니다. 다만 기존 문서와 어긋나는 지점이 있어 함께 표시합니다.</p>

  <div class="grid g2" style="margin-bottom:18px">
    <div class="card"><div class="ct">① 제모스 원천화</div>
      <p style="margin:0 0 8px"><b>계정·권한·가입·근태기록·연반차 신청의 실제 실행은 제모스.</b> 신규 시스템은 누적 데이터를 끌어와 연동 표시합니다.</p>
      <ul class="chk">
        <li class="y">로그인을 <b>제모스 계정 연동</b>으로 변경 (SCR-C-01)</li>
        <li class="y">근태 원천을 제모스 태그로 (SCR-M-03)</li>
        <li class="y">연차·반차를 제모스 신청 내역 조회로 (SCR-W-03)</li>
        <li class="y">제모스 방향 <b>쓰기 금지</b> — 읽기 전용 명시 (SCR-S-04)</li>
      </ul>
      <div class="note warn" style="margin:0"><span class="nt">확인 필요</span>
        <b>현장 배정·업무 역할(F-A0201/F-A0202)은 제모스에 없는 개념</b>입니다.
        지금은 신규 시스템에서 관리하도록 두었습니다. 이것도 제모스로 넘길지 확정이 필요합니다.</div>
    </div>

    <div class="card"><div class="ct">② ERP 직접 전송</div>
      <p style="margin:0 0 8px">파일 생성·수동 업로드를 <b>직접 전송</b>으로 대체했습니다. J/C 최종 승인분이 ERP에 자동 반영되고 확정됩니다.</p>
      <ul class="chk">
        <li class="y">전송 버튼 + 전송 결과 수신 구조로 구현 (SCR-J-05)</li>
        <li class="y">전송 후 <b>자동 잠금</b> — 되돌리기는 재오픈 승인만 (SCR-J-04)</li>
        <li class="y">양식 주입·파일명 규칙 로직 제거</li>
      </ul>
      <div class="note err" style="margin:0"><span class="nt">문서 충돌</span>
        기능정의서 v1.1의 <span class="mono">F-I0109</span> 처리규칙에 아직
        <b>"ERP 업로드 실행은 사람이 ERP 화면에서 직접 수행하며 본 시스템이 대행하지 않는다"</b>가 남아 있습니다.
        이번 변경과 정반대입니다. 엑셀 원문을 고쳐야 합니다.</div>
    </div>
  </div>

  <div class="card"><div class="ct">③ 근로자 서명 기능 제외</div>
    <p>노무담당관·정우부장 자문 결과에 따라 서명·안내 기능을 제외했습니다. 현장 수용성이 낮고 리스크 절감 효과도 기대하기 어렵다는 판단입니다.</p>
    <ul class="chk">
      <li class="y">서명 요청·서명 화면·근태확인서 PDF 산출 전부 제거</li>
      <li class="y">근로자 화면은 <b>조회 + 수정요청</b>만 남김 (SCR-W-03/04)</li>
    </ul>
    <div class="note err"><span class="nt">반드시 함께 고쳐야 함</span>
      서명을 없앴는데 <b>마감 차단 조건에 '미서명'이 남아 있으면 마감이 영구 차단</b>됩니다.
      기능정의서에서 아래 3개 기능의 처리규칙을 수정해야 합니다.
      <div class="tw" style="margin-top:9px"><table>
        <thead><tr><th>기능ID</th><th>현재 처리규칙 (문제)</th><th>수정안</th></tr></thead>
        <tbody>
          <tr><td class="mono">F-G0204</td><td>"미처리 예외 또는 <b>미서명 근로자</b> 존재 시 확정 차단"</td><td>미서명 조건 삭제</td></tr>
          <tr><td class="mono">F-G0302</td><td>"보정 이력 및 <b>근로자 서명 여부</b> 확인 필수"</td><td>서명 확인 삭제</td></tr>
          <tr><td class="mono">F-F0106</td><td>"자동승인 건도 근로자 확인·<b>서명</b> 대상에 포함"</td><td>'확인'만 유지</td></tr>
          <tr><td class="mono">F-H0101</td><td>"<b>미서명</b>·미확정 현장 존재 시 마감 차단"</td><td>미서명 조건 삭제</td></tr>
        </tbody></table></div>
      데모의 마감 게이트는 이미 미서명 조건을 뺀 상태로 동작합니다.</div>
  </div>\`;

/* ---------- 로그인 ---------- */
V["SCR-C-01"] = () => \`<div class="crumb">SCR-C-01 · 공통</div>
  <h1>로그인</h1>
  <p class="lead">계정 발급·권한은 제모스에서 이뤄집니다. 이 시스템은 제모스 계정으로 인증만 위임받습니다.</p>
  \${fidTags(["F-A0103"])}
  <div class="grid g2">
    <div class="card">
      <div class="ct">제모스 계정 연동 로그인</div>
      <label style="display:block;font-size:12px;font-weight:600;margin-bottom:4px">사번</label>
      <input value="Z2401" readonly style="width:100%;padding:8px;border:1px solid var(--line);border-radius:5px;background:var(--surf-2);color:var(--ink);font-family:var(--mono)">
      <div class="btns"><button class="b" data-act="login">제모스 계정으로 로그인</button></div>
      <p class="hint">데모에서는 왼쪽 목록에서 역할을 직접 바꿔 보실 수 있습니다.</p>
    </div>
    <div class="card"><div class="ct">처리규칙 (F-A0103)</div>
      <ul class="chk">
        <li>연속 인증 실패 5회 시 계정 잠금</li>
        <li>최초 로그인 시 비밀번호 변경 강제</li>
        <li>세션 만료 시간은 설정값 적용</li>
        <li class="y">역할에 따라 접근 메뉴·데이터 범위 결정</li>
      </ul>
      <div class="note warn" style="margin:0"><span class="nt">확인 필요</span>
        제모스가 <b>SSO(OAuth/SAML)를 제공하는지</b> 확정되지 않았습니다.
        미제공이면 계정 동기화 + 별도 인증으로 가야 하며, 이때 "계정 권한도 제모스" 원칙과 어긋납니다.</div>
    </div>
  </div>\`;

/* ---------- 근로자 : 내 근태 ---------- */
V["SCR-W-03"] = () => {
  const me = STAFF[0];
  const days = [
    { d:"09-01", pl:"주간 08:00-17:00", ac:"07:52 / 17:04", cd:"W01", st:"정상" },
    { d:"09-02", pl:"주간 08:00-17:00", ac:"07:52 / —",     cd:"—",   st:"확인 필요" },
    { d:"09-03", pl:"주간 08:00-17:00", ac:"07:58 / 19:30", cd:"W01+W02", st:"정상" },
    { d:"09-04", pl:"연차",             ac:"—",             cd:"A01", st:"정상" },
    { d:"09-05", pl:"주간 08:00-17:00", ac:"08:11 / 17:02", cd:"L01", st:"지각" },
  ];
  return \`<div class="crumb">SCR-W-03 · 근로자 (모바일 웹)</div>
  <h1>내 근태</h1>
  <p class="lead">\${esc(me.nm)} · \${me.id} · \${esc(me.line)} — 출퇴근은 제모스에서 찍고, 확인은 이 화면에서 합니다.</p>
  \${fidTags(["F-G0101","F-C0104"])}
  <div class="note ok"><span class="nt">변경 ③ 반영</span>
    서명 기능이 제외되어 이 화면에는 <b>조회와 수정요청만</b> 있습니다. 월간 근태확인서 서명 절차는 없습니다.</div>
  <div class="tw"><table>
    <thead><tr><th>일자</th><th>계획 (예정)</th><th>제모스 태그 (실적)</th><th class="c">근태코드</th><th class="c">상태</th><th></th></tr></thead>
    <tbody>\${days.map(x => \`<tr>
      <td class="mono">\${x.d}</td><td>\${esc(x.pl)}</td><td class="mono">\${esc(x.ac)}</td>
      <td class="c mono">\${x.cd}</td>
      <td class="c"><span class="pill \${x.st === "정상" ? "p-ok" : x.st === "지각" ? "p-warn" : "p-err"}">\${x.st}</span></td>
      <td class="c">\${x.st !== "정상" ? \`<button class="b sec sm" data-go="SCR-W-04">수정요청</button>\` : ""}</td>
    </tr>\`).join("")}</tbody></table></div>
  <div class="grid g3" style="margin-top:16px">
    <div class="card"><div class="ct">제모스 연차 신청 내역</div>
      <p class="mono" style="margin:0;font-size:12.5px">09-04 연차 1일 · 승인<br>09-18 반차(오후) · 승인</p>
      <p class="hint">신청은 제모스에서. 이 화면은 조회만 합니다.</p></div>
    <div class="card"><div class="ct">이번 주 누적</div>
      <p style="margin:0"><span class="mono" style="font-size:20px;font-weight:600">\${me.wk}h</span> / 52h</p>
      <div class="bar-mini" style="margin-top:6px"><i style="width:\${me.wk / 52 * 100}%"></i></div></div>
    <div class="card"><div class="ct">이달 근태코드</div>
      <p class="mono" style="margin:0;font-size:12.5px">W01 정상 18일<br>W02 연장 22.0h<br>A01 연차 1일</p></div>
  </div>\`;
};

V["SCR-W-04"] = () => \`<div class="crumb">SCR-W-04 · 근로자 (모바일 웹)</div>
  <h1>근태 수정요청</h1>
  <p class="lead">제모스 기록이 실제와 다를 때 정정을 요청합니다. 요청은 현장관리자의 예외 목록으로 올라갑니다.</p>
  \${fidTags(["F-G0102","F-G0103"])}
  <div class="grid g2">
    <div class="card"><div class="ct">요청 작성</div>
      <table style="font-size:12.5px"><tbody>
        <tr><td style="width:78px;color:var(--mut)">대상 일자</td><td class="mono">09-02 (목)</td></tr>
        <tr><td style="color:var(--mut)">제모스 기록</td><td class="mono">출근 07:52 / 퇴근 없음</td></tr>
        <tr><td style="color:var(--mut)">검출 예외</td><td><span class="pill p-err">V-12 태그 결손</span></td></tr>
      </tbody></table>
      <h3>요청 사유</h3>
      <select id="wreason" style="width:100%;padding:8px;border:1px solid var(--line);border-radius:5px;background:var(--surf);color:var(--ink);font-family:var(--sans)">
        \${REASONS.map(r => \`<option>\${r}</option>\`).join("")}</select>
      <h3>정정 요청 내용</h3>
      <textarea id="wnote" rows="3" style="width:100%;padding:8px;border:1px solid var(--line);border-radius:5px;background:var(--surf);color:var(--ink);font-family:var(--sans);font-size:12.5px">17:10에 퇴근했으나 게이트 단말 오류로 태그가 남지 않았습니다. 라인 반장 확인 가능합니다.</textarea>
      <div class="btns"><button class="b" data-act="dispute">수정요청 제출</button></div>
    </div>
    <div class="card"><div class="ct">처리 흐름</div>
      <div class="gate">
        <div class="pass"><span class="mk">1</span><span>근로자 수정요청 제출</span></div>
        <div><span class="mk">2</span><span>현장관리자 예외 목록에 표시</span><span class="why">SCR-M-04</span></div>
        <div><span class="mk">3</span><span>확정값 보정 — 원본은 보존</span><span class="why">F-G0203</span></div>
        <div><span class="mk">4</span><span>보정 후 관련 규칙 자동 재검증</span><span class="why">F-F0101</span></div>
      </div>
      <div class="note" style="margin:0"><span class="nt">원칙</span>
        제모스 원본값은 <b>어떤 권한으로도 수정·삭제되지 않습니다</b>(F-E0101). 보정값이 원본과 별도로 쌓이고, 급여에는 확정값만 쓰입니다.</div>
    </div>
  </div>\`;

/* ---------- 현장관리자 : 대시보드 (사전경고) ---------- */
V["SCR-M-01"] = () => {
  const risk = STAFF.map(s => ({ ...s, exp: s.plan, r: s.plan / 52 }))
    .sort((a, b) => b.r - a.r);
  const over = risk.filter(x => x.exp > 52);
  const near = risk.filter(x => x.exp <= 52 && x.exp >= 46.8);
  return \`<div class="crumb">SCR-M-01 · 현장관리자</div>
  <h1>현장 대시보드</h1>
  <p class="lead">사후 적발이 아니라 사전 경고가 목적입니다. 주 누적 확정시간에 잔여 계획시간을 더해 초과를 미리 띄웁니다.</p>
  \${fidTags(["F-F0107"])}
  <div class="kpi">
    <div class="\${over.length ? "hot" : "good"}"><div class="n">\${over.length}</div><div class="l">주52시간 초과 예상</div><div class="sub">V-06 사전경고</div></div>
    <div class="\${near.length ? "warm" : ""}"><div class="n">\${near.length}</div><div class="l">임계치 90% 도달</div><div class="sub">46.8h 이상</div></div>
    <div class="\${openExc().length ? "hot" : "good"}"><div class="n">\${openExc().length}</div><div class="l">미처리 예외</div><div class="sub">\${errOpen().length}건 마감 차단</div></div>
    <div><div class="n">\${STAFF.filter(s => !s.zemos).length}</div><div class="l">제모스 미사용</div><div class="sub">엑셀·수기 대상</div></div>
  </div>
  \${over.length ? \`<div class="note err"><span class="nt">사전 경고 · 즉시 조치</span>
    \${over.map(x => \`<b>\${esc(x.nm)}</b>(\${x.id}) 주 \${x.exp}h 예상 — 잔여 가능시간 <b class="mono">\${(52 - x.wk).toFixed(1)}h</b>, 계획된 \${(x.plan - x.wk).toFixed(1)}h 중 <b class="mono">\${(x.plan - 52).toFixed(1)}h 조정 필요</b>\`).join("<br>")}
  </div>\` : ""}
  <h2>주간 누적 현황 — 확정 + 잔여 계획</h2>
  <div class="tw"><table>
    <thead><tr><th>사번</th><th>성명</th><th>라인</th><th class="num">확정</th><th class="num">잔여계획</th><th class="num">예상 누적</th><th style="width:120px">한도 소진</th><th class="c">판정</th></tr></thead>
    <tbody>\${risk.map(x => {
      const cls = x.exp > 52 ? "e" : x.exp >= 46.8 ? "w" : "";
      return \`<tr>
        <td class="mono">\${x.id}</td><td>\${esc(x.nm)}</td><td>\${esc(x.line)}</td>
        <td class="num">\${x.wk.toFixed(1)}</td><td class="num">\${(x.plan - x.wk).toFixed(1)}</td>
        <td class="num" style="font-weight:600">\${x.exp.toFixed(1)}</td>
        <td><div class="bar-mini"><i class="\${cls}" style="width:\${Math.min(100, x.exp / 52 * 100)}%"></i></div></td>
        <td class="c">\${x.exp > 52 ? '<span class="pill p-err">초과 예상</span>'
          : x.exp >= 46.8 ? '<span class="pill p-warn">임계 도달</span>' : '<span class="pill p-ok">여유</span>'}</td>
      </tr>\`;
    }).join("")}</tbody></table></div>
  <p class="hint">임계치(52h·경고 90%)는 검증 Rule 설정값입니다 — SCR-S-02에서 변경하며, 코드에 박아두지 않습니다.</p>\`;
};

/* ---------- 월 근무계획 ---------- */
V["SCR-M-02"] = () => \`<div class="crumb">SCR-M-02 · 현장관리자</div>
  <h1>월 근무계획</h1>
  <p class="lead">계획이 없으면 지각·결근을 판정할 수 없습니다. 계획은 검증의 기준선입니다.</p>
  \${fidTags(["F-C0101","F-C0102","F-C0103","F-C0105"])}
  <div class="note warn"><span class="nt">처리규칙 (F-C0101)</span>
    계획 미등록 시 <b>지각·결근 판정 불가</b> → 월 시작 전 등록 필수 알림. 휴일 캘린더와 상충하면 경고합니다.</div>
  <div class="kpi">
    <div class="good"><div class="n">10/12</div><div class="l">계획 등록 인원</div><div class="sub">2명 미등록</div></div>
    <div class="warm"><div class="n">2</div><div class="l">계획 미등록</div><div class="sub">Z2410 · Z2412</div></div>
    <div><div class="n">4</div><div class="l">교대 패턴</div><div class="sub">주간·야간·2교대A/B</div></div>
    <div class="\${STAFF.filter(s => s.plan > 52).length ? "hot" : ""}"><div class="n">\${STAFF.filter(s => s.plan > 52).length}</div><div class="l">계획상 52h 초과</div><div class="sub">F-C0105 시뮬레이션</div></div>
  </div>
  <h2>라인별 계획 등록 현황</h2>
  <div class="tw"><table>
    <thead><tr><th>라인</th><th>인원</th><th>교대 패턴</th><th class="num">월 계획공수</th><th class="c">휴일 상충</th><th class="c">상태</th></tr></thead>
    <tbody>
      <tr><td>치약1</td><td>3명</td><td>2교대 A/B</td><td class="num">496</td><td class="c"><span class="pill p-ok">없음</span></td><td class="c"><span class="pill p-ok">등록</span></td></tr>
      <tr><td>튜브2</td><td>3명</td><td>주간 고정</td><td class="num">384</td><td class="c"><span class="pill p-ok">없음</span></td><td class="c"><span class="pill p-ok">등록</span></td></tr>
      <tr><td>염모1</td><td>2명</td><td>주간 + 연장</td><td class="num">368</td><td class="c"><span class="pill p-warn">추석 1건</span></td><td class="c"><span class="pill p-ok">등록</span></td></tr>
      <tr><td>멀티3</td><td>2명</td><td>주간 고정</td><td class="num">256</td><td class="c"><span class="pill p-ok">없음</span></td><td class="c"><span class="pill p-warn">1명 미등록</span></td></tr>
      <tr><td>직선1</td><td>2명</td><td>주간 고정</td><td class="num">240</td><td class="c"><span class="pill p-ok">없음</span></td><td class="c"><span class="pill p-warn">1명 미등록</span></td></tr>
    </tbody></table></div>
  <div class="note err" style="margin-top:14px"><span class="nt">연쇄 영향</span>
    계획 미등록 2명은 이후 <span class="mono">V-08 계획 대비 이상</span> 예외로 잡힙니다.
    실제로 Z2412가 예외 목록에 <b>"계획 없는 근무"</b>로 올라와 있습니다 — 계획을 먼저 등록해야 해소됩니다.</div>\`;

/* ---------- 근태 수집 ---------- */
V["SCR-M-03"] = () => {
  const zc = STAFF.filter(s => s.zemos).length;
  return \`<div class="crumb">SCR-M-03 · 현장관리자</div>
  <h1>근태 수집</h1>
  <p class="lead">제모스가 기본 경로입니다. 엑셀·수기·이미지는 제모스를 못 쓰는 경우의 예외 경로로만 남깁니다.</p>
  \${fidTags(["F-D0105","F-D0106","F-D0107","F-D0108"])}
  <div class="note ok"><span class="nt">변경 ① 반영</span>
    근태 기록의 실제 발생은 제모스입니다. 이 화면은 <b>제모스에 누적된 기록을 끌어와</b> 원장에 적재하고,
    제모스로는 <b>아무것도 쓰지 않습니다</b>(읽기 전용).</div>

  <h2>채널별 수집 현황</h2>
  <div class="tw"><table>
    <thead><tr><th class="c">순위</th><th>채널</th><th>용도</th><th class="num">대상</th><th class="c">상태</th><th></th></tr></thead>
    <tbody>
      <tr><td class="c mono">1</td><td><b>제모스 출퇴근</b></td><td>디폴트 — 전 인원 기본 경로</td><td class="num">\${zc}명</td>
        <td class="c">\${S.recv ? '<span class="pill p-ok">수신 완료</span>' : '<span class="pill p-mut">미수신</span>'}</td>
        <td class="c">\${S.locked ? '<span class="pill p-err">잠금</span>'
          : S.recv ? \`<button class="b sec sm" data-act="recv">재수신</button>\`
          : \`<button class="b sm" data-act="recv">제모스 수신 실행</button>\`}</td></tr>
      <tr><td class="c mono">2</td><td>관리자 직접 입력</td><td>예외 건 수정, 제모스 미사용 인원</td><td class="num">2명</td>
        <td class="c"><span class="pill p-info">대행입력 태그</span></td><td class="c"><button class="b sec sm" disabled>입력</button></td></tr>
      <tr><td class="c mono">3</td><td>Excel 업로드</td><td>고객사 시스템 근태, 연동 장애 시</td><td class="num">\${12 - zc}명</td>
        <td class="c"><span class="pill p-warn">1건 코드오류</span></td><td class="c"><button class="b sec sm" disabled>업로드</button></td></tr>
      <tr><td class="c mono">4</td><td>수기 이미지 (OCR)</td><td>수기 노트 운영 현장</td><td class="num">0명</td>
        <td class="c"><span class="pill p-mut">미사용</span></td><td class="c"><button class="b sec sm" disabled>업로드</button></td></tr>
    </tbody></table></div>

  \${S.recv ? \`<div class="note ok" style="margin-top:14px"><span class="nt">수신 로그 (F-D0107)</span>
    \${S.collectMsg ? \`제모스 수신 어댑터 응답: <b class="mono">\${esc(S.collectMsg)}</b> · 원본 전건 보관\` : \`제모스 태그 <b class="mono">\${zc * 21}건</b> 수신 · 대상 \${zc}명 · 중복 태그 <b class="mono">14건</b>은 최초 출근·최종 퇴근으로 집계(원본 전건 보관) · 미매칭 카드 <b class="mono">0건</b>\`}<br>
    <span style="color:var(--mut)">다음 단계: 예외 처리 화면에서 검증을 실행하십시오.</span></div>\` : ""}

  \${(S.unmapped && S.unmapped.length) ? \`<h2>미매핑 키 — 사원 마스터에 없는 제모스 계정 (Q2 리스크)</h2>
  <div class="note err"><span class="nt">마감 차단 항목</span>
    제모스 계정 식별자에 사번이 없어, 내부 키를 <b>ERP 사번에 사람이 연결</b>해야 합니다. 연결 전에는 이 태그가 누구 것인지 확정할 수 없어 마감이 막힙니다.</div>
  <div class="tw"><table>
    <thead><tr><th>채널</th><th>제모스 키</th><th>일자</th><th class="num">태그</th><th>연결할 사번</th><th></th></tr></thead>
    <tbody>\${S.unmapped.map(u => \`<tr>
      <td>\${esc(u.channel)}</td><td class="mono">\${esc(u.source_key)}</td><td class="mono">\${esc(u.work_date)}</td><td class="num">\${u.tag_count}</td>
      <td><select id="map-\${esc(u.source_key)}" style="padding:5px;border:1px solid var(--line);border-radius:4px;background:var(--surf);color:var(--ink);font-family:var(--sans);font-size:12px">
        \${STAFF.filter(x => !x.zemos).map(x => \`<option value="\${x.id}">\${x.id} \${esc(x.nm)} (\${esc(x.line)})</option>\`).join("")}
        \${STAFF.filter(x => x.zemos).map(x => \`<option value="\${x.id}">\${x.id} \${esc(x.nm)}</option>\`).join("")}</select></td>
      <td class="c">\${S.locked ? "" : \`<button class="b sm" data-map="\${esc(u.source_key)}">매핑</button>\`}</td></tr>\`).join("")}</tbody></table></div>\` : ""}

  <h2>처리규칙</h2>
  <div class="grid g2">
    <div class="card"><div class="ct">엑셀 업로드 (F-D0105)</div>
      <ul class="chk">
        <li>양식 검증 후 부적합 행은 <b>반입 차단</b></li>
        <li>동일 기간 재업로드 시 <b>덮어쓰기/누적 선택 필수</b></li>
        <li>업로드 파일 원본 보관</li>
      </ul></div>
    <div class="card"><div class="ct">수기 입력 (F-D0106)</div>
      <ul class="chk">
        <li>수기 건은 <b>'대행입력' 태그</b> 부여</li>
        <li>사유 미입력 시 <b>저장 차단</b></li>
        <li class="n">근로자 확인 필수 대상 — <b>서명 제외로 '확인'만</b> (변경 ③)</li>
      </ul></div>
  </div>\`;
};

/* ---------- 예외 처리 ---------- */
V["SCR-M-04"] = () => {
  if (!S.recv) return \`<div class="crumb">SCR-M-04 · 현장관리자</div>
    <h1>예외 처리</h1>
    <div class="note warn"><span class="nt">선행 기능 미완</span>
      제모스 근태 수신이 먼저입니다. <b>근태 수집</b> 화면에서 수신을 실행하십시오.
      <div class="btns" style="margin-bottom:0"><button class="b" data-go="SCR-M-03">근태 수집으로 이동</button></div></div>\`;

  const byRule = {};
  for (const e of S.exc) (byRule[e.rule] ||= []).push(e);
  const rows = S.exc.map((e, i) => {
    const r = ruleOf(e.rule), st = staffOf(e.emp);
    const col = r.lv === "오류" ? "var(--crim)" : r.lv === "사전경고" ? "var(--amber)" : "var(--amber)";
    return \`<tr>
      <td class="mono" style="white-space:nowrap"><span class="sev" style="background:\${col}"></span>\${e.rule}</td>
      <td>\${esc(r.nm)}</td>
      <td class="mono">\${e.d}</td>
      <td>\${esc(st.nm)} <span class="mono" style="color:var(--mut);font-size:11px">\${e.emp}</span></td>
      <td style="min-width:250px">\${esc(e.detail)}</td>
      <td class="c"><span class="pill \${r.lv === "오류" ? "p-err" : "p-warn"}">\${r.lv}</span></td>
      <td class="c">\${e.st === "open" ? '<span class="pill p-mut">미처리</span>'
        : \`<span class="pill p-ok">처리완료</span><div style="font-size:10.5px;color:var(--mut);margin-top:2px">\${esc(e.reason || "")}</div>\`}</td>
      <td class="c">\${S.locked ? "" : e.st === "open"
        ? \`<button class="b sm" data-fix="\${i}">보정</button>\`
        : \`<button class="b sec sm" data-undo="\${i}">되돌리기</button>\`}</td>
    </tr>\`;
  }).join("");

  return \`<div class="crumb">SCR-M-04 · 현장관리자</div>
  <h1>예외 처리</h1>
  <p class="lead">정상 근무는 자동 처리·자동 승인되고, 어긋난 건만 이 목록에 올라옵니다. 관리자가 볼 대상이 전 인원에서 예외 건으로 좁혀집니다.</p>
  \${fidTags(["F-F0101","F-F0102","F-F0103","F-F0104","F-F0106","F-G0203"])}
  <div class="kpi">
    <div class="\${errOpen().length ? "hot" : "good"}"><div class="n">\${errOpen().length}</div><div class="l">오류 (마감 차단)</div><div class="sub">해소 필수</div></div>
    <div class="\${openExc().length - errOpen().length ? "warm" : ""}"><div class="n">\${openExc().length - errOpen().length}</div><div class="l">경고</div><div class="sub">사유 기재 후 통과</div></div>
    <div class="good"><div class="n">\${S.validated ? STAFF.length * 21 - S.exc.length : "—"}</div><div class="l">자동 처리·승인</div><div class="sub">F-F0103 / F-F0106</div></div>
    <div><div class="n">\${S.exc.filter(e => e.st !== "open").length}/\${S.exc.length}</div><div class="l">처리 완료</div><div class="sub">보정 이력 보존</div></div>
  </div>

  <div class="btns">
    \${S.validated
      ? \`<button class="b sec" data-act="validate" \${S.locked ? "disabled" : ""}>검증 재실행</button>
         <button class="b" data-act="fixall" \${S.locked || !openExc().length ? "disabled" : ""}>미처리 전건 일괄 보정</button>\`
      : \`<button class="b" data-act="validate">자동 검증 실행 (V-01~V-12)</button>\`}
    \${S.validated ? \`<span class="hint" style="margin:0">재실행해도 처리완료 상태는 보존됩니다 (F-F0101)</span>\` : ""}
  </div>

  \${!S.validated ? \`<div class="note"><span class="nt">대기</span>
    검증을 실행하면 12개 규칙을 전 인원·전 일자에 적용해 예외를 생성합니다. 실패 시 부분 반영 없이 트랜잭션 단위로 되돌립니다.</div>\`
  : \`<div class="tw"><table>
      <thead><tr><th>Rule</th><th>유형</th><th>일자</th><th>대상자</th><th>내용</th><th class="c">등급</th><th class="c">처리</th><th></th></tr></thead>
      <tbody>\${rows}</tbody></table></div>
    <div class="note \${errOpen().length ? "err" : "ok"}" style="margin-top:14px"><span class="nt">확정 가능 여부</span>
      \${errOpen().length
        ? \`오류 등급 <b>\${errOpen().length}건</b>이 남아 1차 확정이 차단됩니다. 경고는 사유를 적으면 통과합니다.\`
        : \`오류 0건 — <b>1차 확정이 가능합니다.</b>\`}
      <div class="btns" style="margin-bottom:0"><button class="b" data-go="SCR-M-06" \${errOpen().length ? "disabled" : ""}>1차 확정으로 이동</button></div></div>\`}

  <h2>원본 보존 원칙 (F-E0101 · F-G0203)</h2>
  <div class="note"><span class="nt">보정이란</span>
    제모스 원본값을 고치는 것이 아니라 <b>확정값을 따로 만드는 것</b>입니다.
    원본은 어떤 권한으로도 수정·삭제되지 않고, 보정에는 사유가 반드시 붙고, 보정 후 관련 규칙이 자동 재검증됩니다.
    마감 후 보정은 재오픈 승인이 필요합니다.</div>\`;
};

/* ---------- 1차 확정 ---------- */
V["SCR-M-06"] = () => {
  const blk = !S.validated || errOpen().length > 0;
  return \`<div class="crumb">SCR-M-06 · 현장관리자</div>
  <h1>1차 근태 확정</h1>
  <p class="lead">현장이 책임지고 한 번 닫는 단계입니다. 확정 후에는 현장의 임의 수정이 제한됩니다.</p>
  \${fidTags(["F-G0204"])}
  <div class="note ok"><span class="nt">변경 ③ 반영</span>
    원 처리규칙의 <b>"미서명 근로자 존재 시 확정 차단"에서 미서명 조건을 삭제</b>했습니다.
    서명 기능이 없는데 조건을 남기면 확정이 영구 차단됩니다.</div>
  <div class="gate">
    <div class="\${S.validated ? "pass" : "fail"}"><span class="mk">\${S.validated ? "✓" : "✕"}</span>
      <span>자동 검증 실행 완료</span><span class="why">F-F0101</span></div>
    <div class="\${S.validated && !errOpen().length ? "pass" : "fail"}"><span class="mk">\${S.validated && !errOpen().length ? "✓" : "✕"}</span>
      <span>오류 등급 예외 해소</span><span class="why">\${errOpen().length ? \`미처리 \${errOpen().length}건\` : "0건"}</span></div>
    <div class="pass"><span class="mk">✓</span><span>보정 사유 전건 기재</span>
      <span class="why">\${S.exc.filter(e => e.st !== "open").length}건 이력 보존</span></div>
    <div class="pass"><span class="mk">—</span><span style="color:var(--mut)"><s>근로자 서명 완료</s> — 변경 ③으로 조건 삭제</span><span class="why">해당 없음</span></div>
  </div>
  <div class="btns">
    \${S.fixed1
      ? \`<span class="pill p-ok" style="font-size:12px;padding:5px 12px">1차 확정 완료</span>
         <button class="b sec" data-act="unfix1" \${S.approved || S.locked ? "disabled" : ""}>확정 해제</button>\`
      : \`<button class="b" data-act="fix1" \${blk ? "disabled" : ""}>1차 확정 실행</button>\`}
    \${blk && !S.fixed1 ? \`<span class="hint" style="margin:0">오류 예외를 먼저 해소하십시오</span>\` : ""}
  </div>
  \${S.fixed1 ? \`<div class="note ok"><span class="nt">다음 단계</span>
    J/C 담당의 2차 검토·승인 대상으로 넘어갔습니다.
    <div class="btns" style="margin-bottom:0"><button class="b" data-go="SCR-J-03">2차 검토로 이동</button></div></div>\` : ""}
  <h2>확정 대상 요약</h2>
  <div class="tw"><table>
    <thead><tr><th>라인</th><th class="num">인원</th><th class="num">정상</th><th class="num">보정</th><th class="num">확정 공수</th><th class="c">상태</th></tr></thead>
    <tbody>\${["치약1","튜브2","염모1","멀티3","직선1"].map(ln => {
      const m = STAFF.filter(s => s.line === ln);
      const fx = S.exc.filter(e => staffOf(e.emp).line === ln && e.st !== "open").length;
      const op = S.exc.filter(e => staffOf(e.emp).line === ln && e.st === "open").length;
      return \`<tr><td>\${ln}</td><td class="num">\${m.length}</td>
        <td class="num">\${m.length * 21 - fx - op}</td><td class="num">\${fx}</td>
        <td class="num">\${(m.reduce((a, s) => a + s.wk * 4, 0)).toFixed(0)}</td>
        <td class="c">\${op ? \`<span class="pill p-err">미처리 \${op}</span>\` : '<span class="pill p-ok">확정 가능</span>'}</td></tr>\`;
    }).join("")}</tbody></table></div>\`;
};

/* ---------- J/C 통합 대시보드 ---------- */
V["SCR-J-01"] = () => {
  const sites = [
    { nm:"AP대전 · 제조사업부", head:12, cur:true },
    { nm:"코스비전 · 생산도급", head:55, cur:false, st:"확정 완료", exc:2 },
    { nm:"코스비전 · 업무도급", head:55, cur:false, st:"검증 완료", exc:7 },
    { nm:"AP대전 · 업무도급",   head:91, cur:false, st:"수신 완료", exc:0 },
  ];
  return \`<div class="crumb">SCR-J-01 · J/C 담당</div>
  <h1>통합 대시보드</h1>
  <p class="lead">담당 현장 전체의 마감 진행 상태를 한 화면에서 봅니다. 마감이 막힌 현장과 막은 원인이 함께 보입니다.</p>
  \${fidTags(["F-G0301","F-H0104"])}
  <div class="kpi">
    <div><div class="n">4</div><div class="l">담당 현장</div><div class="sub">2개 법인</div></div>
    <div><div class="n">213</div><div class="l">관리 인원</div><div class="sub">J/C 1인 기준</div></div>
    <div class="\${canClose() ? "good" : "warm"}"><div class="n">\${canClose() ? 1 : 0}/4</div><div class="l">마감 가능 현장</div><div class="sub">게이트 통과</div></div>
    <div class="hot"><div class="n">\${openExc().length + 9}</div><div class="l">전체 미처리 예외</div><div class="sub">4개 현장 합</div></div>
  </div>
  <div class="tw"><table>
    <thead><tr><th>현장</th><th class="num">인원</th><th class="c">진행 단계</th><th class="num">미처리</th><th style="width:150px">마감 게이트</th><th class="c"></th></tr></thead>
    <tbody>\${sites.map(x => {
      if (x.cur) {
        const pass = gate().filter(g => g.ok).length;
        return \`<tr style="background:var(--info-bg)">
          <td><b>\${esc(x.nm)}</b> <span class="pill p-info">현재</span></td><td class="num">\${x.head}</td>
          <td class="c">\${S.closed ? '<span class="pill p-info">마감</span>' : S.approved ? '<span class="pill p-ok">2차 승인</span>' : S.fixed1 ? '<span class="pill p-ok">1차 확정</span>' : S.validated ? '<span class="pill p-warn">검증 완료</span>' : S.recv ? '<span class="pill p-mut">수신 완료</span>' : '<span class="pill p-mut">미수신</span>'}</td>
          <td class="num" style="color:\${openExc().length ? "var(--crim)" : "var(--teal)"}">\${openExc().length}</td>
          <td><div class="bar-mini"><i class="\${pass === 5 ? "" : "w"}" style="width:\${pass / 5 * 100}%"></i></div>
            <span class="mono" style="font-size:10.5px;color:var(--mut)">\${pass}/5 통과</span></td>
          <td class="c"><button class="b sec sm" data-go="SCR-J-04">마감</button></td></tr>\`;
      }
      return \`<tr><td>\${esc(x.nm)}</td><td class="num">\${x.head}</td>
        <td class="c"><span class="pill p-mut">\${x.st}</span></td>
        <td class="num" style="color:\${x.exc ? "var(--crim)" : "var(--teal)"}">\${x.exc}</td>
        <td><div class="bar-mini"><i class="w" style="width:\${x.exc ? 60 : 80}%"></i></div>
          <span class="mono" style="font-size:10.5px;color:var(--mut)">\${x.exc ? "3/5" : "4/5"} 통과</span></td>
        <td class="c"><button class="b sec sm" disabled>조회</button></td></tr>\`;
    }).join("")}</tbody></table></div>
  <p class="hint">데모에서는 AP대전 제조사업부 현장만 실제로 동작합니다. 나머지 3개 현장은 다중 현장 조회 화면 구성을 보여주기 위한 예시 값입니다.</p>\`;
};

/* ---------- 2차 검토 · 권한 배정 ---------- */
V["SCR-J-03"] = () => \`<div class="crumb">SCR-J-03 · J/C 담당</div>
  <h1>2차 검토 · 권한 배정</h1>
  <p class="lead">현장이 1차 확정한 건만 올라옵니다. 보정 이력을 확인하고 승인하거나 현장으로 반송합니다.</p>
  \${fidTags(["F-G0302","F-G0303","F-A0201","F-A0202"])}
  <div class="note ok"><span class="nt">변경 ③ 반영</span>
    원 처리규칙의 <b>"근로자 서명 여부 확인 필수"를 삭제</b>했습니다. 검토 항목은 보정 이력과 사유만 남습니다.</div>
  <div class="gate">
    <div class="\${S.fixed1 ? "pass" : "fail"}"><span class="mk">\${S.fixed1 ? "✓" : "✕"}</span>
      <span>1차 확정 완료 건만 대상</span><span class="why">\${S.fixed1 ? "대상 1개 현장" : "미확정 — 검토 불가"}</span></div>
    <div class="pass"><span class="mk">✓</span><span>보정 이력·사유 확인</span>
      <span class="why">\${S.exc.filter(e => e.st !== "open").length}건</span></div>
    <div class="pass"><span class="mk">—</span><span style="color:var(--mut)"><s>근로자 서명 여부 확인</s> — 변경 ③으로 삭제</span><span class="why">해당 없음</span></div>
  </div>
  <div class="btns">
    \${S.approved
      ? \`<span class="pill p-ok" style="font-size:12px;padding:5px 12px">2차 승인 완료</span>
         <button class="b sec" data-act="unapprove" \${S.closed ? "disabled" : ""}>승인 취소</button>\`
      : \`<button class="b" data-act="approve" \${!S.fixed1 ? "disabled" : ""}>2차 승인</button>
         <button class="b sec" data-act="reject" \${!S.fixed1 ? "disabled" : ""}>현장 반송</button>\`}
  </div>
  \${S.approved ? \`<div class="note ok"><span class="nt">다음 단계</span>월 마감을 실행할 수 있습니다.
    <div class="btns" style="margin-bottom:0"><button class="b" data-go="SCR-J-04">월 마감으로 이동</button></div></div>\` : ""}

  <h2>보정 이력 (승인 검토 대상)</h2>
  <div class="tw"><table>
    <thead><tr><th>Rule</th><th>대상자</th><th>일자</th><th>보정 사유</th><th class="c">상태</th></tr></thead>
    <tbody>\${S.exc.length ? S.exc.map(e => \`<tr>
      <td class="mono">\${e.rule}</td><td>\${esc(staffOf(e.emp).nm)}</td><td class="mono">\${e.d}</td>
      <td>\${esc(e.reason || "—")}</td>
      <td class="c">\${e.st === "open" ? '<span class="pill p-mut">미처리</span>' : '<span class="pill p-ok">보정 완료</span>'}</td>
    </tr>\`).join("") : \`<tr><td colspan="5" style="color:var(--mut)">검증 미실행 — 보정 이력이 없습니다</td></tr>\`}</tbody></table></div>

  <h2>권한 · 현장 배정 (F-A0201 · F-A0202)</h2>
  <div class="note warn"><span class="nt">확인 필요 — 변경 ①과 충돌</span>
    변경 ①에 따르면 계정·권한은 제모스에서 관리합니다. 그런데 <b>현장 배정과 업무 역할은 제모스에 없는 개념</b>입니다.
    데모에서는 신규 시스템이 관리하도록 두었습니다. 어느 쪽으로 확정할지 결정이 필요합니다.</div>
  <div class="tw"><table>
    <thead><tr><th>계정</th><th>역할</th><th>배정 현장</th><th class="c">주/부담당</th><th class="c">출처</th></tr></thead>
    <tbody>
      <tr><td class="mono">Z1102 이민아</td><td>현장관리자</td><td>AP대전 · 제조사업부</td><td class="c">주담당</td><td class="c"><span class="pill p-warn">신규 시스템</span></td></tr>
      <tr><td class="mono">Z1108 박주노</td><td>현장관리자</td><td>코스비전 · 생산도급</td><td class="c">주담당</td><td class="c"><span class="pill p-warn">신규 시스템</span></td></tr>
      <tr><td class="mono">Z0901 (J/C)</td><td>J/C 담당</td><td>4개 현장</td><td class="c">—</td><td class="c"><span class="pill p-warn">신규 시스템</span></td></tr>
      <tr><td class="mono">Z2401~2412</td><td>근로자</td><td>AP대전 · 제조사업부</td><td class="c">—</td><td class="c"><span class="pill p-info">제모스 연동</span></td></tr>
    </tbody></table></div>
  <p class="hint">처리규칙: 현장별 주담당 1명 필수 / 배정 기간 중복 시 경고 / 미배정 현장 발생 시 J/C 알림 — 미배정 현장이 있으면 마감이 차단됩니다(F-A0203).</p>\`;

/* ---------- 월 마감 · 잠금 ---------- */
V["SCR-J-04"] = () => \`<div class="crumb">SCR-J-04 · J/C 담당</div>
  <h1>월 마감 · 잠금</h1>
  <p class="lead">게이트를 다 통과해야 마감이 열립니다. 마감 시점의 데이터는 스냅샷으로 굳어집니다.</p>
  \${fidTags(["F-H0101","F-H0102"])}
  <h2>마감 게이트 (F-H0101)</h2>
  <div class="gate">
    \${gate().map(g => \`<div class="\${g.ok ? "pass" : "fail"}">
      <span class="mk">\${g.ok ? "✓" : "✕"}</span><span>\${esc(g.k)}</span><span class="why">\${esc(g.why)}</span></div>\`).join("")}
    <div class="pass"><span class="mk">—</span>
      <span style="color:var(--mut)"><s>미서명 근로자 없음</s> — 변경 ③으로 조건 삭제</span><span class="why">해당 없음</span></div>
  </div>
  \${!canClose() && !S.closed ? \`<div class="note err"><span class="nt">마감 차단</span>
    \${gate().filter(g => !g.ok).map(g => \`<b>\${esc(g.k)}</b> — \${esc(g.why)}\`).join("<br>")}</div>\` : ""}
  <div class="btns">
    \${S.closed
      ? \`<span class="pill p-info" style="font-size:12px;padding:5px 12px">\${S.month} 마감 완료</span>
         \${S.locked
           ? \`<span class="pill p-err" style="font-size:12px;padding:5px 12px">잠금</span>
              <button class="b sec" data-act="reopen">재오픈 승인 요청</button>\`
           : \`<button class="b sec" data-act="unclose">마감 취소</button>\`}\`
      : \`<button class="b" data-act="close" \${canClose() ? "" : "disabled"}>월 마감 실행</button>\`}
  </div>
  \${S.closed ? \`<div class="note \${S.locked ? "err" : "ok"}"><span class="nt">\${S.locked ? "잠금 상태" : "마감 완료"}</span>
    \${S.locked
      ? \`ERP 전송이 완료되어 <b>자동 잠금</b>되었습니다. 수집·보정·요청 기능은 모두 차단되고 조회·산출물 생성만 허용됩니다. 해제는 재오픈 절차만 가능합니다.\`
      : \`마감 스냅샷이 보존되었습니다. 집계·ERP 전송으로 진행하십시오.
         <div class="btns" style="margin-bottom:0"><button class="b" data-go="SCR-J-05">집계 · ERP 전송으로 이동</button></div>\`}</div>\` : ""}
  <h2>잠금 규칙 (F-H0102)</h2>
  <div class="grid g2">
    <div class="card"><div class="ct">잠금 시 차단</div>
      <ul class="chk"><li class="n">근태 수집 (제모스 재수신 포함)</li><li class="n">확정값 보정</li><li class="n">근로자 수정요청</li></ul></div>
    <div class="card"><div class="ct">잠금 시 허용</div>
      <ul class="chk"><li class="y">전체 조회</li><li class="y">산출물 재생성</li><li class="y">Audit Log 조회</li></ul></div>
  </div>
  <div class="note warn"><span class="nt">변경 ② 영향</span>
    원안은 "ERP에서 급여를 만들면 잠긴다"였습니다. 직접 전송으로 바뀌면 <b>전송 시점에 이 시스템이 스스로 잠그는 것</b>이 맞습니다.
    데모는 전송 완료 시 자동 잠금으로 구현했습니다. 급여 확정 시점과 어긋날 수 있어 ERP 담당 확인이 필요합니다.</div>\`;

/* ---------- 집계 · ERP 전송 ---------- */
V["SCR-J-05"] = () => {
  const t = totals();
  return \`<div class="crumb">SCR-J-05 · J/C 담당</div>
  <h1>집계 · ERP 전송</h1>
  <p class="lead">마감된 확정값만 집계합니다. 합계가 어긋나면 전송을 막습니다.</p>
  \${fidTags(["F-I0101","F-I0106","F-I0102","F-I0109"])}
  <div class="note ok"><span class="nt">변경 ② 반영</span>
    <b>파일 생성 → ERP 직접 전송</b>으로 대체했습니다. J/C가 최종 승인한 근태가 ERP에 자동 반영·확정되며,
    업로드 양식·파일명 규칙·수동 업로드 절차는 모두 제거했습니다.</div>

  \${!S.closed ? \`<div class="note warn"><span class="nt">선행 조건</span>
    마감 완료 데이터만 집계 대상입니다(F-I0101). 먼저 월 마감을 실행하십시오.
    <div class="btns" style="margin-bottom:0"><button class="b" data-go="SCR-J-04">월 마감으로 이동</button></div></div>\`
  : \`<div class="btns">
      \${S.agg ? \`<button class="b sec" data-act="agg">집계 재생성</button>\` : \`<button class="b" data-act="agg">확정 근태 집계 생성</button>\`}
      \${S.agg ? \`<button class="b" data-act="send" \${S.erp ? "disabled" : ""}>ERP 전송 실행</button>\` : ""}
    </div>\`}

  \${S.agg ? \`<h2>집계 결과 (F-I0101)</h2>
  <div class="kpi">
    <div><div class="n">\${t.head}</div><div class="l">대상 인원</div><div class="sub">현장 이동자 0명</div></div>
    <div><div class="n">\${t.base}</div><div class="l">기본 공수 (h)</div><div class="sub">W01</div></div>
    <div class="warm"><div class="n">\${t.ot}</div><div class="l">연장 (h)</div><div class="sub">W02 · 가산 50%</div></div>
    <div><div class="n">\${t.night}</div><div class="l">야간 (h)</div><div class="sub">W03 · 가산 50%</div></div>
    <div><div class="n">\${t.holi}</div><div class="l">휴일 (h)</div><div class="sub">W04 · 50/100%</div></div>
  </div>
  <h2>합계 대조 검증 (F-I0106)</h2>
  <div class="gate">
    <div class="pass"><span class="mk">✓</span><span>확정 근태 합계 = 집계 합계</span><span class="why mono">\${t.base + t.ot + t.night + t.holi}h = \${t.base + t.ot + t.night + t.holi}h</span></div>
    <div class="pass"><span class="mk">✓</span><span>대상 인원 = 재직 인원</span><span class="why mono">\${t.head}명 = \${t.head}명</span></div>
    <div class="pass"><span class="mk">✓</span><span>근태코드 전건 매핑 완료</span><span class="why">미정의 코드 0건</span></div>
  </div>
  <p class="hint">불일치가 있으면 산출물 생성을 차단하고 자동 보정은 하지 않습니다 — 원인 확인 후 수동 처리 원칙(F-I0106).</p>\` : ""}

  \${S.erp ? \`<h2>ERP 전송 결과 (F-I0102 · F-I0109)</h2>
  <div class="note ok"><span class="nt">전송 완료</span>
    <table style="font-size:12.5px;margin-top:4px"><tbody>
      <tr><td style="color:var(--mut);width:110px">전송 일시</td><td class="mono">\${esc(S.erp.at)}</td></tr>
      <tr><td style="color:var(--mut)">전송 건수</td><td class="mono">\${S.erp.rows}건 (월근태 \${t.head}건 · 시간외 \${S.erp.rows - t.head}건)</td></tr>
      <tr><td style="color:var(--mut)">ERP 응답</td><td><span class="pill p-ok">정상 반영</span> <span class="mono">\${esc(S.erp.ref || ("RCV-" + S.month.replace("-", "") + "-0001"))}</span></td></tr>
      <tr><td style="color:var(--mut)">반려</td><td class="mono">0건</td></tr>
      <tr><td style="color:var(--mut)">후속</td><td>마감 자동 잠금 처리됨 (F-H0102)</td></tr>
    </tbody></table></div>
  <div class="note err"><span class="nt">문서 충돌 — 수정 필요</span>
    기능정의서 v1.1 <span class="mono">F-I0109</span> 처리규칙에 여전히
    <b>"★ ERP 업로드 실행 자체는 사람이 ERP 화면에서 직접 수행하며 본 시스템이 대행하지 않는다"</b>가 남아 있습니다.
    변경 ②(직접 전송)와 정면으로 어긋나므로 엑셀 원문을 고쳐야 합니다.
    <span class="mono">F-I0102</span>의 <b>"[TBD] 양식 확정 후 상세 규칙"</b>도 전송 규격(인터페이스 항목·응답 코드)으로 다시 써야 합니다.</div>\` : ""}

  \${S.agg && !S.erp ? \`<div class="note warn"><span class="nt">전송 전 확인</span>
    전송하면 ERP에 <b>즉시 반영·확정</b>되고 마감이 자동 잠깁니다. 되돌리려면 재오픈 승인이 필요합니다.</div>\` : ""}

  <h2>근태코드 → ERP 코드 매핑</h2>
  <div class="tw"><table>
    <thead><tr><th>내부코드</th><th>근태 유형</th><th>ERP 코드</th><th>급여 처리</th><th class="c">사용</th></tr></thead>
    <tbody>\${CODES.map(c => \`<tr>
      <td class="mono">\${c.c}</td><td>\${esc(c.nm)}</td><td class="mono">\${c.erp}</td><td>\${esc(c.pay)}</td>
      <td class="c">\${c.use ? '<span class="pill p-ok">사용</span>' : '<span class="pill p-mut">사용중지</span>'}</td>
    </tr>\`).join("")}</tbody></table></div>\`;
};

/* ---------- 시스템관리자 : 기준정보 ---------- */
V["SCR-S-01"] = () => \`<div class="crumb">SCR-S-01 · 시스템관리자</div>
  <h1>기준정보</h1>
  <p class="lead">도입 시 1회 구축하는 항목입니다. 여기 값이 틀리면 검증·집계 전체가 틀어집니다.</p>
  \${fidTags(["F-B0201","F-B0203","F-B0204"])}
  <h2>고객사 근태코드 (F-B0201)</h2>
  <div class="tw"><table>
    <thead><tr><th>코드</th><th>명칭</th><th>ERP 코드</th><th>급여 처리</th><th class="c">상태</th><th class="c"></th></tr></thead>
    <tbody>\${CODES.map(c => \`<tr>
      <td class="mono">\${c.c}</td><td>\${esc(c.nm)}</td><td class="mono">\${c.erp}</td><td>\${esc(c.pay)}</td>
      <td class="c">\${c.use ? '<span class="pill p-ok">사용</span>' : '<span class="pill p-mut">사용중지</span>'}</td>
      <td class="c"><button class="b sec sm" disabled>\${c.use ? "사용중지" : "재사용"}</button></td>
    </tr>\`).join("")}</tbody></table></div>
  <p class="hint">사용 중인 코드는 삭제할 수 없고 사용중지만 가능합니다. 코드 속성을 바꾸면 영향 기간을 지정하고 재계산 여부를 판단합니다.</p>

  <div class="grid g2" style="margin-top:20px">
    <div class="card"><div class="ct">휴일 · 공휴일 캘린더 (F-B0203)</div>
      <table style="font-size:12.5px"><tbody>
        <tr><td class="mono" style="width:74px">09-16~18</td><td>추석 연휴</td><td class="c"><span class="pill p-info">법정</span></td></tr>
        <tr><td class="mono">10-03</td><td>개천절</td><td class="c"><span class="pill p-info">법정</span></td></tr>
        <tr><td class="mono">09-30</td><td>현장 정기보수 (AP대전)</td><td class="c"><span class="pill p-warn">현장 예외</span></td></tr>
      </tbody></table>
      <p class="hint">현장 예외 휴일이 상위 캘린더보다 우선합니다. 과거 확정월 캘린더를 바꾸면 재계산 경고가 뜹니다.</p></div>
    <div class="card"><div class="ct">소정근로 · 휴게 기준 (F-B0204)</div>
      <table style="font-size:12.5px"><tbody>
        <tr><td style="color:var(--mut);width:96px">1일 소정근로</td><td class="mono">8h</td></tr>
        <tr><td style="color:var(--mut)">주 소정근로</td><td class="mono">40h</td></tr>
        <tr><td style="color:var(--mut)">휴게 (4h 초과)</td><td class="mono">30분</td></tr>
        <tr><td style="color:var(--mut)">휴게 (8h 초과)</td><td class="mono">60분</td></tr>
        <tr><td style="color:var(--mut)">야간 시간대</td><td class="mono">22:00 ~ 06:00</td></tr>
      </tbody></table>
      <div class="note ok" style="margin:8px 0 0"><span class="nt">검증됨</span>
        4시간당 30분 · 8시간당 1시간 기준을 충족합니다. 미달로 설정하면 저장이 차단됩니다.</div></div>
  </div>\`;

/* ---------- 검증 Rule 설정 ---------- */
V["SCR-S-02"] = () => \`<div class="crumb">SCR-S-02 · 시스템관리자</div>
  <h1>검증 Rule 설정</h1>
  <p class="lead">기준값을 코드에 박지 않습니다. 가산율·주52시간·허용 오차는 전부 이 화면의 설정 데이터입니다.</p>
  \${fidTags(["F-J0101"])}
  <div class="legend">
    <span><span class="sev" style="background:var(--crim)"></span><b>오류</b> — 마감 차단</span>
    <span><span class="sev" style="background:var(--amber)"></span><b>경고 / 사전경고</b> — 사유 기재 후 통과</span>
  </div>
  <div class="tw"><table>
    <thead><tr><th>Rule</th><th>명칭</th><th>판정 내용</th><th>기준값</th><th class="c">등급</th><th class="c">발생</th></tr></thead>
    <tbody>\${RULES.map(r => {
      const n = S.exc.filter(e => e.rule === r.id).length;
      return \`<tr>
        <td class="mono"><span class="sev" style="background:\${r.lv === "오류" ? "var(--crim)" : "var(--amber)"}"></span>\${r.id}</td>
        <td>\${esc(r.nm)}</td><td style="color:var(--mut)">\${esc(r.desc)}</td>
        <td class="mono">\${esc(r.p)}</td>
        <td class="c"><span class="pill \${r.lv === "오류" ? "p-err" : "p-warn"}">\${r.lv}</span></td>
        <td class="c mono">\${n ? \`<b style="color:var(--crim)">\${n}</b>\` : "0"}</td></tr>\`;
    }).join("")}</tbody></table></div>
  <div class="note warn" style="margin-top:14px"><span class="nt">v2에서 추가된 규칙</span>
    <span class="mono">V-11 위치 이탈</span>과 <span class="mono">V-12 태그 결손</span>은 제모스 출퇴근을 원천으로 삼으면서 생긴 규칙입니다.
    제모스 GPS·비콘 값을 쓰므로 <b>위치정보 활용 동의 범위</b>가 신규 시스템까지 미치는지 확인이 필요합니다.</div>
  <div class="note"><span class="nt">처리규칙 (F-J0101)</span>
    운영 반영 전 검증 환경 테스트 필수 / 기준값 하드코딩 금지 / 변경 시 적용 시점을 명시하고 과거 데이터 재계산 여부를 판단합니다.</div>\`;

/* ---------- 원본 적재 · 매핑 ---------- */
V["SCR-S-03"] = () => \`<div class="crumb">SCR-S-03 · 시스템관리자</div>
  <h1>원본 적재 · 매핑</h1>
  <p class="lead">입력은 여러 채널, 원장은 하나입니다. 원본은 손대지 않고, 채널 우선순위로 대표값을 정합니다.</p>
  \${fidTags(["F-E0101","F-E0102","F-E0103","F-J0102"])}
  <div class="grid g3">
    <div class="card"><div class="ct">원본(RAW) 적재 · F-E0101</div>
      <p class="mono" style="margin:0;font-size:20px;font-weight:600">\${S.recv ? STAFF.filter(s => s.zemos).length * 21 : 0}건</p>
      <p class="hint">원본은 어떤 권한으로도 수정·삭제 불가. 모든 후속 값이 원본 식별자와 연결됩니다.</p></div>
    <div class="card"><div class="ct">코드 매핑 변환 · F-E0102</div>
      <p class="mono" style="margin:0;font-size:20px;font-weight:600">\${S.validated ? "1" : "0"}건 실패</p>
      <p class="hint">미정의 코드는 변환 실패로 분류하고 알립니다 — <b>임의 추정 금지</b>.</p></div>
    <div class="card"><div class="ct">정합성 처리 · F-E0103</div>
      <p class="mono" style="margin:0;font-size:20px;font-weight:600">\${S.recv ? "14" : "0"}건 정리</p>
      <p class="hint">중복 태그는 최초 출근·최종 퇴근으로 대표값 선정. 삭제 대신 비활성 처리.</p></div>
  </div>
  <h2>채널 우선순위 (F-E0103)</h2>
  <div class="gate">
    <div class="pass"><span class="mk">1</span><span><b>제모스 출퇴근 태그</b></span><span class="why">원천 — 변경 ① 반영</span></div>
    <div class="pass"><span class="mk">2</span><span>고객사 출입통제 시스템</span><span class="why">엑셀 수집</span></div>
    <div class="pass"><span class="mk">3</span><span>관리자 대행입력</span><span class="why">사유 필수</span></div>
    <div class="pass"><span class="mk">4</span><span>수기 이미지 OCR</span><span class="why">항상 제안값</span></div>
  </div>
  <p class="hint">같은 사번·일자에 제모스 값과 다른 채널 값이 함께 있으면 <b>자동으로 덮어쓰지 않고</b> 양쪽을 나란히 보여 관리자가 고릅니다. 자동 판단이 불가한 건은 예외로 넘깁니다.</p>
  <h2>매핑 규칙 (F-J0102)</h2>
  <div class="note err"><span class="nt">현재 미매핑 1건</span>
    엑셀 업로드에 <span class="mono">X09</span> 코드가 들어왔으나 매핑 테이블에 없습니다(사용중지된 구코드).
    <b>자동 추정하지 않고</b> 관리자 확인 후 등록해야 합니다 — 이 건이 <span class="mono">V-10</span> 예외로 마감을 막고 있습니다.</div>\`;

/* ---------- 외부 연동 ---------- */
V["SCR-S-04"] = () => \`<div class="crumb">SCR-S-04 · 시스템관리자</div>
  <h1>외부 연동</h1>
  <p class="lead">연동이 죽어도 업무는 멈추지 않아야 합니다. 모든 수신 채널에는 수기 대체 경로가 함께 있습니다.</p>
  \${fidTags(["F-J0103","F-D0104"])}
  <div class="tw"><table>
    <thead><tr><th>시스템</th><th class="c">방향</th><th>연동 방식</th><th>용도</th><th class="c">상태</th><th>대체 경로</th></tr></thead>
    <tbody>
      <tr><td><b>제모스</b></td><td class="c"><span class="pill p-info">수신 전용</span></td>
        <td>DB 읽기 전용 <span class="pill p-warn">확정 필요</span></td><td>근태 원천 · 연차 · 배치</td>
        <td class="c">\${S.recv ? '<span class="pill p-ok">정상</span>' : '<span class="pill p-mut">대기</span>'}</td><td>엑셀 업로드</td></tr>
      <tr><td>ERP (근태)</td><td class="c"><span class="pill p-err">송신</span></td>
        <td><b>직접 전송</b> <span class="pill p-ok">변경 ②</span></td><td>월근태 · 시간외근무 확정</td>
        <td class="c">\${S.erp ? '<span class="pill p-ok">전송 완료</span>' : '<span class="pill p-mut">대기</span>'}</td><td>—</td></tr>
      <tr><td>ERP (인사)</td><td class="c"><span class="pill p-info">수신</span></td><td>파일 다운로드</td><td>사원 마스터</td>
        <td class="c"><span class="pill p-ok">정상</span></td><td>수기 등록</td></tr>
      <tr><td>그룹웨어</td><td class="c"><span class="pill p-mut">양방향</span></td><td>조회 + 메일</td><td>휴가 대조, 정정 요청</td>
        <td class="c"><span class="pill p-ok">정상</span></td><td>수기 확인</td></tr>
      <tr><td>데이사인</td><td class="c"><span class="pill p-info">수신</span></td><td>자동 수신</td><td>단기자 계약·태그</td>
        <td class="c"><span class="pill p-mut">미연결</span></td><td>엑셀 업로드</td></tr>
    </tbody></table></div>
  <div class="note err" style="margin-top:14px"><span class="nt">★ 최우선 미결 — 09.05</span>
    <b>제모스 데이터 수신 방식이 확정되지 않았습니다.</b> A) 조회 API · B) DB 읽기 전용 계정 · C) 일 배치 파일 중 하나를 이노파크와 정해야 합니다.
    이게 막히면 <b>수집·검증·확정·마감·전송 전체가 멈춥니다.</b> 데모는 B(DB 읽기)를 가정했습니다.</div>
  <div class="note"><span class="nt">불변 원칙</span>
    어느 방안이든 신규 시스템은 <b>제모스에 쓰기(write)를 하지 않습니다.</b> 계정·근태기록·연반차의 실제 실행은 제모스에만 있습니다.</div>\`;

/* ---------- Audit Log ---------- */
V["SCR-S-06"] = () => \`<div class="crumb">SCR-S-06 · 시스템관리자</div>
  <h1>Audit Log</h1>
  <p class="lead">조회·다운로드·수정·승인이 전부 남습니다. 이 데모에서 실제로 수행한 동작이 아래에 쌓입니다.</p>
  \${fidTags(["F-J0105","F-E0105"])}
  <div class="log">\${S.audit.length
    ? S.audit.map(a => \`<div><span class="t">\${a.t}</span><span class="t" style="width:88px">\${esc(a.actor)}</span><span>\${esc(a.msg)}</span></div>\`).join("")
    : \`<div style="color:var(--mut)">기록이 없습니다 — 다른 화면에서 동작을 수행하면 여기에 쌓입니다.</div>\`}</div>
  <div class="note" style="margin-top:14px"><span class="nt">보존 정책 (F-J0109)</span>
    근태 데이터 3년 보관 후 자동 파기 / 접근 로그 1년 보관. 개인정보는 사번·성명·근태로 한정하고 권한을 분리합니다.</div>
  <div class="note warn"><span class="nt">확인 필요</span>
    제모스 <b>위치정보(GPS·비콘)</b>는 근태 판정 목적에 한정해 최소 보관합니다. 다만
    <b>제모스에서 받은 동의가 신규 시스템으로 이관되는지</b>는 전략기획실 확인이 필요합니다(09.05).</div>\`;

/* ============================================================
   동작 — 데이터가 바뀌면 게이트가 따라 열리고 닫힌다
   ============================================================ */
const ACT = {
  login() { S.screen = "SCR-M-01"; log("Z2401", "제모스 계정 연동 로그인 — 역할: 현장관리자"); },

  dispute() {
    const r = document.getElementById("wreason");
    const reason = r ? r.value : REASONS[0];
    if (!S.exc.some(e => e.emp === "Z2401" && e.d === "09-02")) {
      S.exc.push({ rule:"V-12", emp:"Z2401", d:"09-02", ch:"근로자", st:"open",
        detail:\`[근로자 요청] \${reason} — 17:10 퇴근했으나 단말 오류로 태그 없음\` });
    }
    log("Z2401", \`근태 수정요청 제출 — 09-02 / \${reason}\`);
    S.screen = "SCR-M-04";
  },

  recv() {
    if (S.locked) return;
    S.recv = true;
    const n = STAFF.filter(s => s.zemos).length * 21;
    log("SYSTEM", \`제모스 근태 수신 \${n}건 · 중복 태그 14건 대표값 선정 · 원본 전건 보존\`);
  },

  validate() {
    if (S.locked) return;
    const keep = new Map(S.exc.filter(e => e.st !== "open").map(e => [e.rule + e.emp + e.d, e]));
    S.exc = SEED_EXC.map(e => keep.get(e.rule + e.emp + e.d) || { ...e, st:"open" });
    S.validated = true;
    S.fixed1 = false; S.approved = false;
    log("SYSTEM", \`검증 규칙 V-01~V-12 실행 — 예외 \${S.exc.length}건 생성 (오류 \${errOpen().length}건)\`);
  },

  fix(i) {
    const e = S.exc[i]; if (!e || S.locked) return;
    const reason = REASONS[i % REASONS.length];
    e.st = "fixed"; e.reason = reason;
    log("Z1102", \`확정값 보정 — \${e.rule} / \${staffOf(e.emp).nm} \${e.d} / 사유: \${reason} (원본 보존)\`);
  },

  undo(i) {
    const e = S.exc[i]; if (!e || S.locked) return;
    e.st = "open"; delete e.reason;
    S.fixed1 = false; S.approved = false;
    log("Z1102", \`보정 되돌리기 — \${e.rule} / \${staffOf(e.emp).nm} \${e.d}\`);
  },

  fixall() {
    if (S.locked) return;
    let n = 0;
    S.exc.forEach((e, i) => { if (e.st === "open") { ACT.fix(i); n++; } });
    log("Z1102", \`미처리 예외 \${n}건 일괄 보정\`);
  },

  fix1() {
    if (!S.validated || errOpen().length) return;
    S.fixed1 = true;
    log("Z1102", "1차 근태 확정 (현장) — 이후 현장 임의 수정 제한");
  },
  unfix1() { S.fixed1 = false; S.approved = false; log("Z1102", "1차 확정 해제"); },

  approve() {
    if (!S.fixed1) return;
    S.approved = true;
    log("Z0901", "2차 검토 승인 (J/C) — 현장 수정 권한 제한");
  },
  unapprove() { S.approved = false; S.closed = false; log("Z0901", "2차 승인 취소"); },
  reject() {
    S.fixed1 = false; S.approved = false;
    log("Z0901", "현장 반송 (재검토 요청) — 1차 확정 해제");
    S.screen = "SCR-M-04";
  },

  close() {
    if (!canClose()) return;
    S.closed = true;
    log("Z0901", \`\${S.month} 월 마감 실행 — 마감 시점 데이터 스냅샷 보존\`);
  },
  unclose() { S.closed = false; S.agg = null; log("Z0901", "월 마감 취소"); },
  reopen() {
    S.locked = false; S.closed = false; S.erp = null; S.agg = null;
    log("Z0901", "재오픈 승인 — 잠금 해제 (마감 후 보정 가능)");
  },

  agg() {
    if (!S.closed) return;
    const t = totals();
    S.agg = { at: now(), sum: t.base + t.ot + t.night + t.holi };
    log("SYSTEM", \`확정 근태 집계 생성 — \${t.head}명 / 총 \${S.agg.sum}h · 합계 대조 일치\`);
  },

  send() {
    if (!S.agg || S.erp) return;
    const t = totals();
    S.erp = { at: now(), rows: t.head * 2 - 2 };
    S.locked = true;
    log("Z0901", \`ERP 근태 직접 전송 — \${S.erp.rows}건 정상 반영 (반려 0건)\`);
    log("SYSTEM", "전송 완료로 마감 자동 잠금 (F-H0102)");
  },
};

/* ============================================================
   렌더 · 이벤트
   ============================================================ */
function render() {
  const sc = SCREENS.find(s => s.id === S.screen) || SCREENS[0];
  const showBar = sc.id !== "MAP" && sc.id !== "CHG" && sc.id !== "SCR-C-01";
  document.getElementById("rail").innerHTML = railHTML();
  const live = typeof LIVE !== "undefined" && LIVE.on;
  const modeBar = live
    ? \`<div class="note \${S.banner ? "err" : "ok"}" style="margin-bottom:12px;padding:7px 12px;font-size:11.5px"><b>실서버 연결</b> — \${S.banner ? esc(S.banner) : \`데이터가 D1에 저장됩니다 · \${esc(LIVE.base || location.origin)}\`}</div>\`
    : \`<div class="note warn" style="margin-bottom:12px;padding:7px 12px;font-size:11.5px"><b>목업 모드</b> — 브라우저 안에서만 동작합니다. 주소 뒤에 <code>?api=Worker주소</code>를 붙이면 실서버로 전환됩니다.</div>\`;
  document.getElementById("main").innerHTML = modeBar +
    (showBar ? stateBar() : "") +
    (V[sc.id] ? V[sc.id]() : \`<h1>\${esc(sc.nm)}</h1><p class="lead">이 화면은 데모 범위에 포함되지 않았습니다.</p>\`) +
    \`<div class="foot">근태 원천등록 · ERP 전송 자동화 — 기능별 데모 · 기능정의서 v1.1 기준 (\${FEATS.length}기능 / MVP \${FEATS.filter(f => f.pri === "MVP").length})<br>
     데모용 예시 데이터입니다. 실제 인사·근태 데이터가 아닙니다.</div>\`;
  document.getElementById("main").scrollTop = 0;
  window.scrollTo(0, 0);
}

document.addEventListener("click", ev => {
  const t = ev.target.closest("[data-go],[data-act],[data-fix],[data-undo],[data-map]");
  if (!t) return;
  if (t.dataset.go) { S.screen = t.dataset.go; render(); return; }
  const run = r => { if (r && typeof r.then === "function") r.then(render); else render(); };
  if (t.dataset.act && ACT[t.dataset.act]) { run(ACT[t.dataset.act]()); return; }
  if (t.dataset.fix !== undefined) { run(ACT.fix(+t.dataset.fix)); return; }
  if (t.dataset.undo !== undefined) { run(ACT.undo(+t.dataset.undo)); return; }
  if (t.dataset.map !== undefined) { run(ACT.map && ACT.map(t.dataset.map)); return; }
});

log("SYSTEM", "데모 세션 시작 — 기능정의서 v1.1 / 변경 3건 반영");
render();

/* ============================================================
   실서버 연결 (2단계) — 목업 상태를 API로 교체한다.
   활성 조건: ?api=<Worker 주소>  또는  Worker가 /demo 로 직접 서빙 (같은 origin)
   비활성이면 위의 목업 그대로 동작한다 (회의 중 서버가 죽어도 데모는 산다).
   ============================================================ */
var LIVE = (() => {
  const q = new URLSearchParams(location.search).get("api");
  if (q) { try { localStorage.setItem("attApi", q); } catch {} return { on: true, base: q.replace(/\\/$/, "") }; }
  if (location.pathname.replace(/\\/$/, "").endsWith("/demo")) return { on: true, base: "" };
  try { const s = localStorage.getItem("attApi"); if (s) return { on: true, base: s }; } catch {}
  return { on: false, base: "" };
})();

if (LIVE.on) {
  const ACTOR = { W: "Z2401", M: "Z1102", J: "Z0901", S: "SYSADM", C: "Z1102" };
  const api = async (method, path, body) => {
    const role = (SCREENS.find(s => s.id === S.screen) || {}).role || "M";
    const r = await fetch(LIVE.base + path, {
      method, headers: { "content-type": "application/json", "x-actor": ACTOR[role] || "demo" },
      body: body ? JSON.stringify(body) : undefined,
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || \`HTTP \${r.status}\`);
    return d;
  };
  const get = p => api("GET", p);
  const post = (p, b) => api("POST", p, b || {});
  const qs = () => \`month=\${encodeURIComponent(S.month)}&site=\${encodeURIComponent(S.site.split(" ")[0])}\`;
  const siteKey = () => S.site.split(" ")[0];

  /* ---- 서버 상태 → 화면 상태 ---- */
  async function refresh() {
    try {
      const [st, agg, erp, au, um] = await Promise.all([get(\`/api/state?\${qs()}\`), get(\`/api/aggregate?\${qs()}\`), get(\`/api/erp?\${qs()}\`), get(\`/api/audit\`), get(\`/api/unmapped\`)]);
      S.unmapped = um || [];
      const p = st.period, stage = p.stage;
      S.recv = (st.collection && st.collection.length > 0) || p.ledger_rows > 0;
      S.validated = !!p.validated;
      S.exc = st.exceptions.map(e => ({
        id: e.id, rule: e.rule_id, emp: e.emp_id, d: e.work_date.slice(5),
        detail: (e.detail && e.detail.message) || "", ch: e.source === "worker" ? "근로자" : "제모스",
        st: e.status === "open" ? "open" : "fixed", reason: e.status === "open" ? undefined : (e.reason || "보정 완료"),
        level: e.level,
      }));
      S.fixed1 = ["fixed1", "approved", "closed", "locked"].includes(stage);
      S.approved = ["approved", "closed", "locked"].includes(stage);
      S.closed = ["closed", "locked"].includes(stage);
      S.locked = stage === "locked";
      S.period = p;
      S.agg = agg ? { at: agg.created_at, sum: agg.base_hours + agg.ot_hours + agg.night_hours + agg.holi_hours, live: agg } : null;
      S.erp = erp && erp.length ? { at: erp[0].sent_at, rows: erp[0].sent_rows, ref: erp[0].erp_ref } : null;
      S.audit = (au || []).map(a => ({ t: String(a.at).slice(5, 19), actor: a.actor, msg: \`\${a.action} \${a.target || ""}\` }));
      S.collect = st.collection && st.collection[0] ? st.collection[0] : null;
      // 인원·주간 누적
      const wk = new Map((st.weekly || []).map(w => [w.emp_id, w]));
      STAFF.length = 0;
      for (const s of st.staff) {
        const w = wk.get(s.emp_id) || { actual: 0, remaining_plan: 0 };
        STAFF.push({ id: s.emp_id, nm: s.name, line: s.line || "-", zemos: !!s.zemos_user,
          wk: Number(w.actual || 0), plan: Number(w.actual || 0) + Number(w.remaining_plan || 0) });
      }
      S.banner = null;
    } catch (e) { S.banner = \`서버 연결 실패: \${e.message} — \${LIVE.base || "같은 origin"}\`; }
  }

  /* ---- 게이트·합계는 서버 값을 쓴다 ---- */
  gate = () => (S.period ? S.period.gate.map(g => ({ k: g.key, ok: g.ok, why: g.why })) : []);
  canClose = () => !!(S.period && S.period.can_close);
  const totalsMock = totals;
  totals = () => S.agg && S.agg.live
    ? { head: S.agg.live.head_count, base: S.agg.live.base_hours, ot: S.agg.live.ot_hours, night: S.agg.live.night_hours, holi: S.agg.live.holi_hours }
    : totalsMock();

  /* ---- 동작 → API ---- */
  const wrap = fn => async (...a) => { try { await fn(...a); } catch (e) { S.banner = e.message; } await refresh(); };
  const period = act => post(\`/api/period/\${act}\`, { month: S.month, site: siteKey() });
  Object.assign(ACT, {
    login: () => { S.screen = "SCR-M-01"; },
    recv: wrap(async () => {
      // 제모스 수신 어댑터 계약을 그대로 태운다. 시드에 이미 있는 태그라 '중복 무시'로 잡히는 것이 정상.
      const r = await post("/api/collect/zemos", { target_date: \`\${S.month}-01\`, site: siteKey(), rows: [
        { zemos_key: "ZK-2401", direction: "IN",  tagged_at: \`\${S.month}-01T07:52:00\`, lat: 36.3505, lng: 127.3846 },
        { zemos_key: "ZK-2401", direction: "OUT", tagged_at: \`\${S.month}-01 17:04:00\`, lat: 36.3505, lng: 127.3846 },
        { zemos_key: "ZK-9999", direction: "IN",  tagged_at: \`\${S.month}-03 08:01:00\` },
      ] });
      S.collectMsg = \`신규 \${r.inserted} · 중복 무시 \${r.duplicates_ignored} · 미매핑 키 \${r.unmapped_keys}\`;
    }),
    validate: wrap(() => post("/api/validate/run", { month: S.month, site: siteKey() })),
    fix: wrap(i => { const e = S.exc[i]; return e && post(\`/api/exceptions/\${e.id}/correct\`, { reason_code: REASONS[i % REASONS.length], note: "데모 보정" }); }),
    undo: wrap(i => { const e = S.exc[i]; return e && post(\`/api/exceptions/\${e.id}/reopen\`); }),
    fixall: wrap(async () => { for (const e of S.exc.filter(x => x.st === "open")) await post(\`/api/exceptions/\${e.id}/correct\`, { reason_code: "반장 확인", note: "일괄 보정" }); }),
    fix1: wrap(() => period("fix1")), unfix1: wrap(() => period("unfix1")),
    approve: wrap(() => period("approve")), unapprove: wrap(() => period("unfix1")),
    reject: wrap(async () => { await period("reject"); S.screen = "SCR-M-04"; }),
    close: wrap(() => period("close")), unclose: wrap(() => period("unclose")), reopen: wrap(() => period("reopen")),
    map: wrap(key => { const sel = document.getElementById(\`map-\${key}\`); return post("/api/mapping", { source_key: key, emp_id: sel ? sel.value : "", channel: "zemos" }); }),
    agg: wrap(() => post("/api/aggregate", { month: S.month, site: siteKey() })),
    send: wrap(() => post("/api/erp/send", { month: S.month, site: siteKey() })),
    dispute: wrap(async () => {
      const n = document.getElementById("wnote"); const r = document.getElementById("wreason");
      await post("/api/self/dispute", { emp_id: "Z2401", work_date: \`\${S.month}-02\`, note: \`[\${r ? r.value : ""}] \${n ? n.value : ""}\` });
      S.screen = "SCR-M-04";
    }),
  });

  refresh().then(render);
}

</script>
`;
