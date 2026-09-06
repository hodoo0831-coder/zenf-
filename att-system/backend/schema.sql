-- ══════════════════════════════════════════════════════════════
-- 근태 원천등록·ERP 자동화 — D1 스키마
-- 기준: 근태시스템-메뉴및기능정의-v2.md (§0~14) — 검증구조·현장×월 확정·근로자 화면 반영
-- ══════════════════════════════════════════════════════════════

-- 사원 마스터 (ERP 인사에서 수신 — 파일 다운로드, F4 연동표 §4)
CREATE TABLE employees (
  emp_id        TEXT PRIMARY KEY,           -- ERP 사번
  jemos_id      TEXT UNIQUE,                -- 제모스 사번/AT코드 (F-J0102 매핑 대상)
  name          TEXT NOT NULL,
  site          TEXT NOT NULL,
  contract_type TEXT,                       -- 도급/파견
  shift_default TEXT DEFAULT '주간',
  jemos_active  INTEGER NOT NULL DEFAULT 1, -- 제모스 사용 인원 여부 (F6 사용률 지표 근거)
  hire_date     TEXT,
  leave_date    TEXT,                       -- 퇴사일 (V-03 판정 기준)
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 사용자(관리자·J/C·시스템관리자·근로자). 근로자는 emp_id로 본인 데이터만 접근(§1-1, §6-1)
-- F-A0103 정정: 근로자도 로그인은 있음(모바일 웹) — 서명만 없는 것이지 조회·정정요청까지는 있다.
CREATE TABLE users (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  role          TEXT NOT NULL CHECK(role IN ('mgr','jc','sys','worker')),
  site          TEXT,
  emp_id        TEXT REFERENCES employees(emp_id),  -- role='worker'일 때만 값 있음
  active        INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 근태코드 (F-B0201) — ERP 코드 매핑 포함
CREATE TABLE att_codes (
  code          TEXT PRIMARY KEY,           -- WK/HW/AL/HL/AB/OFF ...
  name          TEXT NOT NULL,
  paid          TEXT,
  counts_hours  INTEGER NOT NULL DEFAULT 0, -- 근로시간 산입 여부
  leave_deduct  REAL NOT NULL DEFAULT 0,    -- 연차 차감 일수
  erp_code      TEXT,
  active        INTEGER NOT NULL DEFAULT 1
);

-- 표기 매핑 규칙 (F-J0102) — 현장별 원본 표기 → 표준코드
CREATE TABLE code_mappings (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  site          TEXT NOT NULL,
  raw_label     TEXT NOT NULL,
  code          TEXT NOT NULL REFERENCES att_codes(code),
  effective_from TEXT NOT NULL DEFAULT (date('now')),
  UNIQUE(site, raw_label)
);

-- 휴일 캘린더 (F-B0203)
CREATE TABLE holidays (
  site          TEXT NOT NULL DEFAULT '*',  -- '*' = 전사 공통, 특정 현장이면 현장코드
  hdate         TEXT NOT NULL,
  name          TEXT NOT NULL,
  PRIMARY KEY (site, hdate)
);

-- 검증 Rule 기준값 (F-J0101) — 현장·계약형태별 설정 가능
CREATE TABLE rule_settings (
  site          TEXT PRIMARY KEY,
  tol_min       INTEGER NOT NULL DEFAULT 10,   -- 지각/조퇴 허용오차(분)
  day_max_h     REAL    NOT NULL DEFAULT 14,   -- 1일 체류 상한
  week_max_h    REAL    NOT NULL DEFAULT 52,   -- 주 최대 근로
  ot_week_h     REAL    NOT NULL DEFAULT 12,   -- 주 연장 한도
  ot_month_h    REAL    NOT NULL DEFAULT 52,   -- 월 연장 한도
  gps_radius_m  INTEGER NOT NULL DEFAULT 200,  -- 현장 반경(V-11)
  auto_approve_days INTEGER NOT NULL DEFAULT 2 -- 이의없음 자동승인 유예(F-F0106)
);

-- 월 근무계획 (F-C0101)
CREATE TABLE work_plans (
  emp_id        TEXT NOT NULL REFERENCES employees(emp_id),
  wdate         TEXT NOT NULL,               -- YYYY-MM-DD
  plan_code     TEXT NOT NULL,               -- WK/OFF/AL/HW
  plan_in       INTEGER,                     -- 분 단위 (자정 기준)
  plan_out      INTEGER,
  PRIMARY KEY (emp_id, wdate)
);

-- ══ 근태원장 — 4단 구조: 원본 → 제안값 → 관리자보정값 → 최종확정값 ══
CREATE TABLE ledger (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  emp_id        TEXT NOT NULL REFERENCES employees(emp_id),
  wdate         TEXT NOT NULL,
  channel       TEXT NOT NULL CHECK(channel IN ('제모스','엑셀','수기','이미지')),
  source_ref    TEXT,                        -- 원본 출처 (배치파일명/엑셀행/입력자 등)
  raw_payload   TEXT NOT NULL,                -- ① 원본 — JSON, 불변
  proposed_code TEXT,                         -- ② 제안값
  proposed_in   INTEGER,
  proposed_out  INTEGER,
  proposed_brk  INTEGER,
  gps_status    TEXT DEFAULT 'ok',            -- ok/out (V-11)
  confirmed_code TEXT,                        -- ③→④ 관리자 보정 후 최종 확정값 (동일 컬럼, 이력은 ledger_history)
  confirmed_in  INTEGER,
  confirmed_out INTEGER,
  status        TEXT NOT NULL DEFAULT '제안', -- 제안/정상/경고/오류/수정됨
  auto_approved INTEGER NOT NULL DEFAULT 0,
  auto_approve_due TEXT,                      -- 유예기간 만료일 (F-F0106)
  received_at   TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(emp_id, wdate, channel)
);
CREATE INDEX idx_ledger_emp_date ON ledger(emp_id, wdate);

-- 보정 이력 (F-E0105) — 원본은 절대 수정하지 않고 매 보정마다 append
CREATE TABLE ledger_history (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  ledger_id     INTEGER NOT NULL REFERENCES ledger(id),
  at            TEXT NOT NULL DEFAULT (datetime('now')),
  by_user       TEXT NOT NULL,
  before_json   TEXT NOT NULL,
  after_json    TEXT NOT NULL,
  reason        TEXT NOT NULL                 -- 사유 필수
);

-- 채널 충돌 (제모스 vs 엑셀/수기 동시 존재 — V-13)
CREATE TABLE ledger_conflicts (
  ledger_id     INTEGER NOT NULL REFERENCES ledger(id),
  other_channel TEXT NOT NULL,
  other_payload TEXT NOT NULL,
  resolved      INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (ledger_id, other_channel)
);

-- 검증 예외 (F-F0102) — V-01~V-13 결과
CREATE TABLE exceptions (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  rule_id       TEXT NOT NULL,               -- V-01 ...
  grade         TEXT NOT NULL CHECK(grade IN ('오류','경고')),
  emp_id        TEXT NOT NULL,
  wdate         TEXT,                        -- 일자 단위 예외는 값 있음, 주단위(V-06/07)는 NULL
  week_label    TEXT,
  message       TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT '미처리', -- 미처리/처리완료
  reason        TEXT,
  by_user       TEXT,
  at            TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  run_id        TEXT NOT NULL                -- 검증 실행 배치 ID
);
CREATE INDEX idx_exc_status ON exceptions(status, grade);

-- 1차/2차 확정, 마감
CREATE TABLE month_status (
  site          TEXT NOT NULL,
  ym            TEXT NOT NULL,                -- YYYY-MM
  stage         TEXT NOT NULL DEFAULT '수집', -- 수집/검증/1차확정/2차승인/마감/ERP확정
  confirm1_at   TEXT, confirm1_by TEXT, confirm1_opinion TEXT,  -- 조건 미충족 시 사유 필수(§6-2 m-close)
  confirm2_at   TEXT, confirm2_by TEXT, confirm2_opinion TEXT,
  closed_at     TEXT, closed_by TEXT, snapshot_hash TEXT,
  return_count  INTEGER NOT NULL DEFAULT 0,     -- 반송 누적 횟수
  erp_status    TEXT DEFAULT '대기',           -- 대기/전송중/응답수신/확정
  erp_receipt   TEXT, erp_version INTEGER NOT NULL DEFAULT 0,  -- 멱등 재전송 버전(§8-2)
  last_run_id   TEXT,                          -- 가장 최근 검증 실행 ID (exceptions 필터 기준)
  PRIMARY KEY (site, ym)
);

-- 마감 스냅샷 (F-H0102) — ledger 확정값의 불변 사본
CREATE TABLE snapshot_ledger (
  snap_id       TEXT NOT NULL,                -- site|ym
  emp_id        TEXT NOT NULL, wdate TEXT NOT NULL,
  code          TEXT, tin INTEGER, tout INTEGER, channel TEXT,
  PRIMARY KEY (snap_id, emp_id, wdate)
);

-- ERP 전송 로그 (F-I0102 직접전송 / F-I0109 파일폴백 공통)
-- §8 ERP DB 직접 INSERT — 트랜잭션 단위(현장×월), 멱등 재전송(버전↑, 기존 행 삭제 후 재적재), 전송 후 역조회 대조
CREATE TABLE erp_transmissions (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  site          TEXT NOT NULL, ym TEXT NOT NULL,
  mode          TEXT NOT NULL,                -- DIRECT(DB Insert) / FILE(ERP API 미개방 시 폴백)
  version       INTEGER NOT NULL DEFAULT 1,
  sent_at       TEXT NOT NULL DEFAULT (datetime('now')),
  sent_by       TEXT NOT NULL,
  rows_att      INTEGER, rows_ot INTEGER,
  recon_ok      INTEGER,                       -- 역조회 대조 결과 (§8-2 4번)
  recon_detail  TEXT,
  receipt_no    TEXT, reject_count INTEGER DEFAULT 0,
  rolled_back   INTEGER NOT NULL DEFAULT 0,
  raw_response  TEXT
);

-- 제모스 수신 로그 (F0)
CREATE TABLE jemos_receipts (
  site          TEXT NOT NULL, rdate TEXT NOT NULL,
  received_at   TEXT NOT NULL DEFAULT (datetime('now')),
  n_records     INTEGER NOT NULL, n_expected INTEGER,
  n_dup INTEGER DEFAULT 0, n_gps_out INTEGER DEFAULT 0, n_missing_out INTEGER DEFAULT 0,
  ok            INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (site, rdate)
);

-- 근태 수정요청 (SCR-W-04, F-G0102) — 근로자가 낸다. 원본은 절대 안 건드리고 "요청 건"만 생성.
-- 승인되면 F-G0203(관리자 확정값 보정)으로 이어진다.
CREATE TABLE correction_requests (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  ledger_id     INTEGER REFERENCES ledger(id),     -- 대상 근태원장 건 (없을 수도 있음 — 미수집일자에 대한 요청)
  emp_id        TEXT NOT NULL REFERENCES employees(emp_id),
  wdate         TEXT NOT NULL,
  field         TEXT NOT NULL,                      -- 출근/퇴근/근태구분/휴게
  requested_code TEXT, requested_in INTEGER, requested_out INTEGER,
  reason        TEXT NOT NULL,
  evidence_ref  TEXT,                                -- 증빙파일 참조 (업로드는 별도 스토리지)
  status        TEXT NOT NULL DEFAULT '승인대기' CHECK(status IN ('승인대기','승인','반려')),
  requested_at  TEXT NOT NULL DEFAULT (datetime('now')),
  reviewed_by   TEXT, reviewed_at TEXT, review_note TEXT
);
CREATE INDEX idx_corr_emp ON correction_requests(emp_id, wdate);

-- 연장근로 신청 (SCR-W-05, F-G0103) — 승인된 건만 가산 대상. 미승인 연장은 V-14로 계속 남는다.
CREATE TABLE ot_requests (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  emp_id        TEXT NOT NULL REFERENCES employees(emp_id),
  wdate         TEXT NOT NULL,
  timing        TEXT NOT NULL CHECK(timing IN ('사전','사후')),
  start_min     INTEGER NOT NULL, end_min INTEGER NOT NULL,
  reason        TEXT NOT NULL,                        -- 사후 신청은 프론트에서 10자 이상 강제
  status        TEXT NOT NULL DEFAULT '승인대기' CHECK(status IN ('승인대기','승인','반려')),
  requested_at  TEXT NOT NULL DEFAULT (datetime('now')),
  reviewed_by   TEXT, reviewed_at TEXT
);
CREATE INDEX idx_ot_emp ON ot_requests(emp_id, wdate);

-- ══ F-I0110 내보내기 양식 — 파라미터 조합으로 저장, 현장이 늘어도 개발 불필요 (§9) ══
CREATE TABLE export_formats (
  id            TEXT PRIMARY KEY,             -- FMT-00 ...
  name          TEXT NOT NULL,
  site          TEXT,                          -- NULL=전사 공통
  row_axis      TEXT NOT NULL,                 -- 콤마구분: 사번,성명,직군,현장
  col_axis      TEXT NOT NULL DEFAULT '일자',  -- 일자 | 주차
  cell_value    TEXT NOT NULL,                 -- 코드만 | 코드+시각 | 실근로시간
  code_display  TEXT NOT NULL DEFAULT '코드명',-- 내부코드 | 코드명 | 현장고유표기
  totals        TEXT NOT NULL DEFAULT '근무일수,실근로,연장,야간,휴일,연차,결근',
  purpose       TEXT NOT NULL DEFAULT '내부 관리', -- 현장 제출 | 고객사 제출 | 내부 관리
  anon_forced   INTEGER NOT NULL DEFAULT 0,    -- 고객사 제출은 강제 1, 편집화면에서도 변경 불가 (§9-5-2)
  active        INTEGER NOT NULL DEFAULT 1,
  version       INTEGER NOT NULL DEFAULT 1,
  updated_by    TEXT, updated_at TEXT DEFAULT (datetime('now'))
);

-- 대표 표기(역매핑) — 현장 고유표기가 code_display로 선택됐을 때 코드→표기 결정 (§9-2)
-- 우선순위: 현장 전용 표기 > 전체 공용 표기(site IS NULL) > (없으면 route에서 코드명으로 폴백)
CREATE TABLE code_labels (
  site          TEXT NOT NULL DEFAULT '*',    -- '*' = 전체 공용
  code          TEXT NOT NULL,
  label         TEXT NOT NULL,
  PRIMARY KEY (site, code)
);

-- 양식 변경 요청 큐 — 현장관리자가 올리고 시스템관리자가 반영/반려 (§9-3)
CREATE TABLE format_change_requests (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  site          TEXT NOT NULL, requested_by TEXT NOT NULL,
  request       TEXT NOT NULL,                 -- 자유서술 요청 내용
  status        TEXT NOT NULL DEFAULT '대기' CHECK(status IN ('대기','반영','반려')),
  requested_at  TEXT NOT NULL DEFAULT (datetime('now')),
  resolved_by   TEXT, resolved_at TEXT, resolve_note TEXT
);

-- 다운로드 이력 — 사유 없으면 다운로드 자체가 차단됨(§9-6), 삭제 불가
CREATE TABLE export_history (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  at            TEXT NOT NULL DEFAULT (datetime('now')),
  by_user       TEXT NOT NULL, by_role TEXT NOT NULL,
  format_id     TEXT NOT NULL, site TEXT NOT NULL, ym TEXT NOT NULL,
  rows          INTEGER NOT NULL, anon INTEGER NOT NULL,
  reason        TEXT NOT NULL, ip TEXT
);

-- 수기 이미지 OCR 큐 (F-D0108) — 인식 결과는 검토대기로만 적재, 사람 확인 전 확정 금지, 원본 이미지 삭제 불가
CREATE TABLE ocr_uploads (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  site          TEXT NOT NULL, wdate TEXT,
  image_ref     TEXT NOT NULL,                 -- 원본 이미지 참조(스토리지 경로/URL) — 삭제 불가
  recognized    TEXT,                          -- 인식 결과 JSON (사번·근태·시각 후보들, 신뢰도 포함)
  status        TEXT NOT NULL DEFAULT '검토대기' CHECK(status IN ('검토대기','확정','반려')),
  uploaded_by   TEXT NOT NULL, uploaded_at TEXT NOT NULL DEFAULT (datetime('now')),
  reviewed_by   TEXT, reviewed_at TEXT
);

-- Audit Log (F-J0105) — 삭제·수정 불가 원칙 (애플리케이션 레벨에서 강제)
CREATE TABLE audit_log (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  at            TEXT NOT NULL DEFAULT (datetime('now')),
  by_user       TEXT NOT NULL,
  action        TEXT NOT NULL,
  target        TEXT,
  detail        TEXT
);
