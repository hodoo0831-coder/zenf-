# 근태 원천등록·ERP 자동화 — 백엔드 (Cloudflare Workers + D1)

기준 문서: `근태ERP자동화_기능명세서_v2.md` (F0~F6) + 2026-09-04 확정사항 3건
(제모스 로그인 이관 / ERP 직접전송 기본화 / 서명 기능 제외)

## 무엇이 실제로 동작하나

- **스키마 전체** (`schema.sql`) — 근태원장 4단 구조(원본·제안·보정·확정), 예외, 마감스냅샷, 감사로그
- **검증 엔진** (`src/lib/validate.ts`) — V-01~V-13 전체. 데모(`근태자동화_기능데모_v2.html`)에서
  30명·31일·528건 시나리오로 이미 검증한 로직을 그대로 이식했습니다.
- **API 라우트** — F0 수신 / F1 보정·대행입력·엑셀반영 / F2 검증·예외처리 / 1·2차확정 / 마감 / F3 ERP 전송

## 아직 안 된 것 (의도적으로 어댑터로 분리해둔 부분)

md 6절 "사전 확인 필요사항"이 아직 안 풀렸기 때문에, 아래 두 지점은 **가짜 어댑터(Mock)** 로 되어 있습니다.
실제 값이 정해지면 해당 파일만 고치면 되고, 나머지 코드는 안 건드려도 됩니다.

| 지점 | 파일 | 지금 상태 | 정해지면 할 일 |
| --- | --- | --- | --- |
| 제모스 연동 (A/B/C 중 택1) | `src/adapters/jemosAdapter.ts` | `JemosMockAdapter` — 항상 빈 배열 반환 | 확정된 방식으로 `fetchDailyTags` 구현체 추가, `wrangler.toml`의 `JEMOS_MODE` 변경 |
| ERP API 개방 여부 | `src/adapters/erpAdapter.ts` | `ERP_MODE=FILE` — `/api/erp/export`로 데이터만 내려줌 | API 열리면 `ErpDirectAdapter.sendAttendance/sendOvertime`의 `fetch()` 호출부 채우고 `ERP_MODE=DIRECT` |

그 전까지는:
- 제모스 데이터가 안 들어오니 F0는 항상 0건 — 이 상태에서도 **엑셀 업로드/수기 입력(F1 예외채널)만으로 시스템이 정상 동작**합니다.
- ERP는 `/api/erp/export`로 집계 데이터를 받아 프론트에서 SheetJS로 xlsx를 만들어 사람이 직접 업로드하고,
  `/api/erp/upload-result`로 결과만 기록합니다(F-I0109 폴백 경로 그대로).

## 로그인 (2026-09 추가)

`X-User-Id` 헤더 하나로 사람을 구분하던 것을 **비밀번호 + 세션 토큰**으로 바꿨습니다.
헤더는 누구나 바꿔 보낼 수 있으니 그건 식별이지 인증이 아니었습니다.

```
POST /api/auth/login     { id, password }  → { token, user, mustChangePassword }
POST /api/auth/logout    Authorization: Bearer <token>
GET  /api/auth/me        Authorization: Bearer <token>
POST /api/auth/password  { current, next }   (본인 것만 · 8자 이상)
```

이후 모든 요청에 `Authorization: Bearer <token>` 을 붙입니다.

- 비밀번호는 **PBKDF2-SHA256 10만회**로만 저장합니다(`pw_hash`/`pw_salt`/`pw_iter`).
  평문이나 역산 가능한 형태로는 어디에도 남기지 않습니다.
- 세션 토큰은 DB에 **원문이 아니라 SHA-256 해시**로 넣습니다. DB가 통째로 새도
  그 값으로 로그인할 수는 없습니다. 유효기간 12시간.
- 없는 아이디와 틀린 비밀번호에 **같은 메시지·비슷한 응답 시간**을 씁니다.
  다르면 어떤 아이디가 실재하는지 알려주는 셈입니다.
- 비밀번호를 바꾸면 그 사람의 **다른 기기 세션도 전부 끊습니다.**
- `GET /api/users`(계정 목록)는 **시스템관리자 전용**으로 잠갔습니다.

### 이미 만든 DB에 적용

```bash
npx wrangler d1 execute att_db --local --file=./migrations/001_auth.sql
```

그다음 계정에 초기 비밀번호를 심어야 로그인할 수 있습니다. 해시는 서버와 같은
파라미터(PBKDF2-SHA256 · 10만회 · 16바이트 salt)로 계산한 값을 넣어야 합니다.
`must_change=1` 로 두면 첫 로그인 직후 변경 화면이 뜹니다.

### AUTH_MODE

`wrangler.toml` 의 `AUTH_MODE="DEV"` 일 때만 예전 `X-User-Id` 헤더 인증이 함께
동작합니다. **배포할 때는 반드시 `PROD` 로 바꾸거나 지우십시오.** DEV 로 두면
헤더만으로 아무나 사칭할 수 있습니다.

### 제모스 SSO 로 갈 때

`src/routes/auth.ts` 의 `login()` 안에서 비밀번호를 확인하는 부분만 제모스 인증
호출로 바꾸면 됩니다. 나머지 코드는 "세션이 유효한가"만 보므로 손댈 필요가
없습니다 — 제모스·ERP 어댑터와 같은 구조입니다.

## 아직 안 만든 것

- 프론트엔드 (관리자·J/C용 실제 화면 — 데모 HTML의 UI를 이 API에 붙이는 작업, 다음 단계)
- F5 수기 이미지 OCR
- F6 대시보드 (쿼리는 스키마로 다 가능, 화면만 없음)
- 문자 발송(정정요청 알림), 그룹웨어 메일 연동

## 로컬 개발

```bash
npm install
npm run db:init:local          # 로컬 D1에 스키마 적용
# 시드 데이터(사원마스터·근태코드·매핑·Rule)는 별도 seed.sql 필요 — 요청하면 데모 데이터 기준으로 만들어줄게
npx wrangler dev
```

## 배포

```bash
npx wrangler d1 create att_db          # 나온 database_id를 wrangler.toml에 채워넣기
npm run db:init:remote
npm run deploy
```

Cloudflare 계정 접근 권한이 있는 곳(로컬/Cursor)에서 실행해야 합니다 — 이 환경에서는 실제 배포까지는 못 했습니다.

## API 요약

| 메서드 | 경로 | 설명 |
| --- | --- | --- |
| POST | /api/jemos/receive | F0 제모스 일 배치 수신 |
| GET | /api/ledger | 원장 조회 |
| POST | /api/ledger/:id/confirm | 보정 저장 (사유 필수) |
| POST | /api/ledger/manual | 관리자 대행 입력 |
| POST | /api/excel/apply | 엑셀 업로드 반영 |
| POST | /api/validate | 검증 실행 (V-01~V-13) |
| GET | /api/exceptions | 예외 목록 |
| POST | /api/exceptions/:id/resolve | 경고 사유 기재 처리 |
| POST | /api/month/confirm1 · confirm2 · reject · close | 확정·마감 |
| POST | /api/erp/send | ERP 직접 전송 (또는 FILE 모드 안내) |
| GET | /api/erp/export | ERP 폴백용 데이터 |
| PUT | /api/rules | 검증 Rule 기준값 (시스템관리자) |
| POST | /api/codes/mapping | 표기→표준코드 매핑 추가 |
