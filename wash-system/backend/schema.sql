-- ============================================
-- wash-db D1 스키마
-- 세척실 AI 통합 시스템 백엔드
-- ============================================

CREATE TABLE IF NOT EXISTS wash_records (
  id            TEXT PRIMARY KEY,        -- 고유 ID (라인코드-타임스탬프 or UUID)
  line_id       TEXT NOT NULL,           -- 라인 코드 (예: 'W-01')
  line_name     TEXT,                    -- 라인 이름 (예: '직선 1호')
  line_group    TEXT,                    -- 라인 그룹 (직선/튜브/염모 등)
  viscosity     TEXT,                    -- 점도 (LOW/MED/HIGH)
  status        TEXT NOT NULL,           -- WAITING | WASHING | DONE
  arrived_at    INTEGER,                 -- 도착 등록 시각 (Unix ms)
  started_at    INTEGER,                 -- 세척 시작 시각
  completed_at  INTEGER,                 -- 세척 완료 시각
  requester     TEXT,                    -- 도착 등록한 사람
  worker_name   TEXT,                    -- 세척 담당자
  note          TEXT,                    -- 비고
  meta          TEXT,                    -- 추가 필드 JSON
  updated_at    INTEGER NOT NULL         -- 마지막 갱신 시각
);

CREATE INDEX IF NOT EXISTS idx_status ON wash_records(status);
CREATE INDEX IF NOT EXISTS idx_updated ON wash_records(updated_at);
CREATE INDEX IF NOT EXISTS idx_completed ON wash_records(completed_at);
