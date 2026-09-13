-- ============================================================
-- 근태 원천등록 · ERP 전송 자동화 — D1 스키마 v0.4
-- 기준: 통합 근태관리 시스템 기능정의서 v1.1 (56기능 / MVP 29)
-- 반영: ①제모스 원천화 ②ERP 직접전송 ③근로자 서명 제외
--
-- 설계 원칙 (기능정의서 공통 원칙 4)
--   1. 입력은 다양, 원장은 하나 — raw_record(채널별 원본) → ledger(근태원장)
--   2. 제모스가 디폴트, 나머지는 예외 — channel 우선순위로 대표값 선정
--   3. 규칙은 코드가 아니라 데이터 — rule_config / att_code / import_profile
--   4. 제안값과 확정값을 구분 — ledger.stage = proposed / fixed
-- ============================================================

-- ---------- 기준정보 ----------

-- 사원 마스터 (ERP 동기화) — F-B03xx
CREATE TABLE IF NOT EXISTS staff (
  emp_id        TEXT PRIMARY KEY,          -- ERP 사번 (시스템 전체의 기준 키)
  name          TEXT NOT NULL,
  site          TEXT NOT NULL,             -- 현장
  line          TEXT,
  contract      TEXT,                      -- 파견 / 도급 / 본사
  zemos_key     TEXT,                      -- 제모스 내부 키 (Q2 회신 후 채움). 없으면 제모스 수신 불가
  zemos_user    INTEGER NOT NULL DEFAULT 1,-- 제모스 사용 여부 (0이면 엑셀·수기 대상)
  status        TEXT NOT NULL DEFAULT 'active',  -- active / leave / terminated
  hired_at      TEXT,
  terminated_at TEXT,
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_staff_zemos ON staff(zemos_key);

-- 근태코드 ↔ ERP 코드 — F-B0201 / F-J0102
CREATE TABLE IF NOT EXISTS att_code (
  code       TEXT PRIMARY KEY,             -- 내부코드 W01 / A01 / L01 …
  name       TEXT NOT NULL,
  erp_code   TEXT,                         -- NULL이면 V-10 코드 미정의
  pay_rule   TEXT,                         -- 기본 / 가산 50% / 무급 …
  in_use     INTEGER NOT NULL DEFAULT 1,   -- 사용중인 코드는 삭제 불가, 사용중지만
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 검증 규칙 기준값 — F-J0101 (하드코딩 금지)
CREATE TABLE IF NOT EXISTS rule_config (
  rule_id     TEXT NOT NULL,
  param_name  TEXT NOT NULL,
  param_value TEXT NOT NULL,
  updated_by  TEXT,
  updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (rule_id, param_name)
);

-- 엑셀 컬럼 별칭 — F-D0105 (현장별 양식 차이를 코드 수정 없이 흡수)
CREATE TABLE IF NOT EXISTS import_profile (
  field      TEXT NOT NULL,
  alias      TEXT NOT NULL,
  updated_by TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (field, alias)
);

-- ---------- 계획 ----------

-- 월 근무계획 — F-C0101 (계획 없으면 지각·결근 판정 불가)
CREATE TABLE IF NOT EXISTS work_plan (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  emp_id        TEXT NOT NULL REFERENCES staff(emp_id),
  work_date     TEXT NOT NULL,             -- YYYY-MM-DD
  shift         TEXT NOT NULL,             -- 주간 / 야간 / 2교대A / 휴무 / 연차 …
  planned_start TEXT,                      -- HH:MM
  planned_end   TEXT,
  planned_hours REAL,
  registered_by TEXT,
  registered_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(emp_id, work_date)
);

-- ---------- 수집 (원본) ----------

-- 원본 적재 — F-E0101. 어떤 권한으로도 수정·삭제 불가.
-- 채널: zemos / excel / manual / ocr
CREATE TABLE IF NOT EXISTS raw_record (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  channel      TEXT NOT NULL CHECK (channel IN ('zemos','excel','manual','ocr')),
  source_key   TEXT NOT NULL,              -- 채널의 식별자: zemos_key / 사번 / 카드번호
  emp_id       TEXT,                       -- 매핑된 사번 (없으면 unmapped_key로)
  direction    TEXT NOT NULL CHECK (direction IN ('IN','OUT')),
  tagged_at    TEXT NOT NULL,              -- 'YYYY-MM-DD HH:MM:SS' (datetime.ts 정규화)
  lat          REAL,                       -- 제모스 GPS (V-11)
  lng          REAL,
  site_hint    TEXT,                       -- 게이트/단말/현장
  payload      TEXT,                       -- 원본 JSON 그대로
  batch_id     TEXT NOT NULL,
  received_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(channel, source_key, direction, tagged_at)   -- 재수신·재업로드 이중적재 차단
);
CREATE INDEX IF NOT EXISTS idx_raw_emp_date ON raw_record(emp_id, tagged_at);

-- 수신 로그 — F-D0107 / F0
CREATE TABLE IF NOT EXISTS collection_log (
  batch_id        TEXT PRIMARY KEY,
  channel         TEXT NOT NULL,
  target_date     TEXT NOT NULL,
  received_count  INTEGER NOT NULL DEFAULT 0,
  duplicate_count INTEGER NOT NULL DEFAULT 0,
  unmapped_count  INTEGER NOT NULL DEFAULT 0,
  status          TEXT NOT NULL,           -- success / partial / failed
  file_name       TEXT,
  fail_reason     TEXT,
  started_at      TEXT NOT NULL DEFAULT (datetime('now')),
  finished_at     TEXT
);

-- 미매핑 키 — 제모스 키·카드번호가 사원 마스터에 없을 때 (Q2 리스크의 실체)
CREATE TABLE IF NOT EXISTS unmapped_key (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  channel     TEXT NOT NULL,
  source_key  TEXT NOT NULL,
  work_date   TEXT NOT NULL,
  tag_count   INTEGER NOT NULL DEFAULT 0,
  status      TEXT NOT NULL DEFAULT 'open',   -- open / mapped / ignored
  resolved_emp_id TEXT REFERENCES staff(emp_id),
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  resolved_at TEXT,
  UNIQUE(channel, source_key, work_date)
);

-- ---------- 근태원장 ----------

-- 근태원장 — F1. 사번×일자당 1행. 제안값(proposed) → 확정값(fixed)
CREATE TABLE IF NOT EXISTS ledger (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  emp_id       TEXT NOT NULL REFERENCES staff(emp_id),
  work_date    TEXT NOT NULL,
  channel      TEXT NOT NULL,              -- 대표값을 만든 채널 (우선순위 zemos > excel > manual > ocr)
  first_in     TEXT,                       -- 대표 출근 (최초 IN)
  last_out     TEXT,                       -- 대표 퇴근 (최종 OUT)
  work_hours   REAL,                       -- 휴게 차감 후
  break_min    INTEGER NOT NULL DEFAULT 0,
  att_code     TEXT,                       -- 근태코드 (W01 / L01 / A01 …)
  stage        TEXT NOT NULL DEFAULT 'proposed', -- proposed / fixed
  status       TEXT NOT NULL DEFAULT 'normal',   -- normal / exception / corrected
  raw_ids      TEXT,                       -- 근거 원본 id 목록 JSON (원칙 ①)
  updated_at   TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(emp_id, work_date)
);
CREATE INDEX IF NOT EXISTS idx_ledger_date ON ledger(work_date);

-- ---------- 검증 · 예외 · 보정 ----------

-- 예외 — F-F0102. 기능정의서 V-01~V-12
CREATE TABLE IF NOT EXISTS exception (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  rule_id     TEXT NOT NULL,
  emp_id      TEXT NOT NULL REFERENCES staff(emp_id),
  work_date   TEXT NOT NULL,
  level       TEXT NOT NULL,               -- 오류(마감차단) / 경고 / 사전경고
  detail      TEXT,                        -- JSON
  status      TEXT NOT NULL DEFAULT 'open',-- open / fixed / pending_approval / rejected
  source      TEXT NOT NULL DEFAULT 'system', -- system / worker(수정요청 F-G0102)
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  resolved_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_exc_status ON exception(status, work_date);

-- 보정 이력 — F-G0203 (원본 절대 미수정, 사유 필수)
CREATE TABLE IF NOT EXISTS correction (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  exception_id  INTEGER NOT NULL REFERENCES exception(id),
  reason_code   TEXT NOT NULL,
  note          TEXT,
  before_value  TEXT,
  after_value   TEXT,
  corrected_by  TEXT NOT NULL,
  corrected_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 승인 이력 — F-G0302 / F-G0303
CREATE TABLE IF NOT EXISTS approval (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  exception_id INTEGER REFERENCES exception(id),
  period_key   TEXT,                       -- 기간 단위 승인이면 'YYYY-MM|site'
  decision     TEXT NOT NULL CHECK (decision IN ('approved','rejected')),
  approver     TEXT NOT NULL,
  comment      TEXT,
  decided_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ---------- 확정 · 마감 · 산출 ----------

-- 기간 상태 — F-G0204 1차확정 / F-G0302 2차승인 / F-H0101 마감 / F-H0102 잠금
-- 변경 ③: 서명 관련 상태·조건 없음
CREATE TABLE IF NOT EXISTS period (
  period_key  TEXT PRIMARY KEY,            -- 'YYYY-MM|site'
  month       TEXT NOT NULL,
  site        TEXT NOT NULL,
  stage       TEXT NOT NULL DEFAULT 'open',-- open / fixed1 / approved / closed / locked
  fixed1_by   TEXT, fixed1_at TEXT,
  approved_by TEXT, approved_at TEXT,
  closed_by   TEXT, closed_at TEXT,
  locked_at   TEXT,
  snapshot    TEXT                         -- 마감 시점 집계 스냅샷 JSON (불변)
);

-- 확정 근태 집계 — F-I0101 / F-I0106
CREATE TABLE IF NOT EXISTS aggregate (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  period_key  TEXT NOT NULL REFERENCES period(period_key),
  version     INTEGER NOT NULL DEFAULT 1,
  head_count  INTEGER NOT NULL,
  base_hours  REAL NOT NULL,
  ot_hours    REAL NOT NULL,
  night_hours REAL NOT NULL,
  holi_hours  REAL NOT NULL,
  check_ok    INTEGER NOT NULL,            -- 합계 대조 통과 여부
  check_log   TEXT,                        -- 대조 항목별 JSON
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ERP 직접 전송 결과 — F-I0102 / F-I0109 (변경 ②)
CREATE TABLE IF NOT EXISTS erp_transfer (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  period_key   TEXT NOT NULL REFERENCES period(period_key),
  aggregate_id INTEGER NOT NULL REFERENCES aggregate(id),
  sent_rows    INTEGER NOT NULL,
  result       TEXT NOT NULL,              -- accepted / rejected / pending
  erp_ref      TEXT,                       -- ERP 접수번호
  reject_log   TEXT,                       -- 반려 사유·행번호 JSON
  sent_by      TEXT NOT NULL,
  sent_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 감사 로그 — F-J0105
CREATE TABLE IF NOT EXISTS audit_log (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  actor     TEXT NOT NULL,
  action    TEXT NOT NULL,
  target    TEXT,
  detail    TEXT,
  at        TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ---------- 기본값 ----------

INSERT OR IGNORE INTO rule_config (rule_id, param_name, param_value) VALUES
  ('V-04', 'max_daily_hours',    '16'),
  ('V-05', 'break_per_4h_min',   '30'),
  ('V-05', 'break_per_8h_min',   '60'),
  ('V-06', 'weekly_limit_hours', '52'),
  ('V-06', 'warn_ratio',         '0.9'),
  ('V-07', 'weekly_ot_limit',    '12'),
  ('V-08', 'tolerance_min',      '10'),
  ('V-11', 'site_radius_m',      '300'),
  ('V-12', 'night_cutoff_hour',  '4');

INSERT OR IGNORE INTO att_code (code, name, erp_code, pay_rule) VALUES
  ('W01','정상근무','1000','기본'),
  ('W02','연장근로','2100','가산 50%'),
  ('W03','야간근로','2200','가산 50%'),
  ('W04','휴일근로','2300','8h내 50% / 초과 100%'),
  ('A01','연차','3100','유급'),
  ('A02','반차','3110','유급 0.5'),
  ('L01','지각','4100','실근무 차감'),
  ('L02','조퇴','4200','실근무 차감'),
  ('X01','무단결근','5100','무급');
