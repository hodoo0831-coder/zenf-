-- 로그인 붙이기 — users 에 비밀번호 칸, 세션 테이블 신설
-- 적용:  npx wrangler d1 execute att_db --local --file=./migrations/001_auth.sql
-- 이미 만들어진 DB에도 그대로 돌릴 수 있게 한 컬럼씩 나눠 둔다.
-- (D1/SQLite 는 ADD COLUMN IF NOT EXISTS 를 지원하지 않으므로,
--  두 번째 실행에서 "duplicate column" 오류가 나면 그건 이미 적용됐다는 뜻이다.)

ALTER TABLE users ADD COLUMN pw_hash       TEXT;
ALTER TABLE users ADD COLUMN pw_salt       TEXT;
ALTER TABLE users ADD COLUMN pw_iter       INTEGER;
ALTER TABLE users ADD COLUMN must_change   INTEGER NOT NULL DEFAULT 1;
ALTER TABLE users ADD COLUMN last_login_at TEXT;

CREATE TABLE IF NOT EXISTS sessions (
  token_hash  TEXT PRIMARY KEY,            -- 토큰 원문이 아니라 SHA-256. DB가 새도 로그인은 못 한다
  user_id     TEXT NOT NULL REFERENCES users(id),
  expires_at  TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_exp  ON sessions(expires_at);
