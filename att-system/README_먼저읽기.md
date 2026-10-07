# 근태 원천등록 · ERP 자동화 — 먼저 읽기

2026-09-07 기준. **처음 보는 사람은 `시연대본_산출물정리.md`부터 읽으세요.**

## 이 폴더 구성

| 경로 | 내용 |
| --- | --- |
| `../ZEN_Attendance.html` | **젠타임** — 화면 전체. 단일 HTML, 더블클릭하면 데모 모드로 뜸 |
| `backend/` | API 서버 (Cloudflare Workers + D1). 스키마·검증룰·확정·마감·전송 |
| `기준문서_메뉴및기능정의_v2.md` | **개발 착수 기준.** 이견이 있으면 이 문서로 맞춘다 |
| `시연대본_산출물정리.md` | 무엇이 유효/폐기인지 + 시연 대본 |
| `ZEN_근태시스템_구성도.pptx` | 발표용 구성도 2장 (도형 편집 가능) |

예전 패키지의 `frontend/index.html`·`worker.html` 두 화면은 젠타임 하나로 합쳐졌습니다.
역할 4개(근로자·현장관리자·J/C·시스템관리자)가 한 파일 안에서 갈립니다.

## 그냥 보려면

`ZEN_Attendance.html`을 더블클릭. 서버 없이 가상 데이터로 전 기능이 돕니다.
로그인 화면의 데모 계정을 누르면 자동 입력됩니다(비밀번호 전부 `1234`, 전부 가상 인물).

## 서버까지 붙이려면

```bash
cd backend
npm install
npx wrangler d1 execute att_db --local --file=./schema.sql
npx wrangler d1 execute att_db --local --file=./seed.sql
npx wrangler d1 execute att_db --local --file=./migrations/001_auth.sql   # 로그인 테이블
npx wrangler dev --local --port 8787
```

계정에 초기 비밀번호를 심는 방법과 인증 구조는 `backend/README.md`의 "로그인" 절.

그다음 `ZEN_Attendance.html` 주소 뒤에 `?api=http://localhost:8787`을 붙이면
라이브 모드 — 아이디·비밀번호로 로그인하고, 모든 값이 서버·D1에서 옵니다.
서버 시드 계정: `U-MGR`(현장관리자) · `U-JC`(J/C) · `U-SYS`(시스템관리자) · `W-01`/`W-02`(근로자).

## 화면마다 주소가 있습니다

`#/m-att?ym=2026-08&site=…` 처럼 화면·대상월·현장이 주소에 담깁니다.
링크를 복사해 보내면 상대가 같은 화면을 엽니다. 뒤로가기도 됩니다.

## 아직 안 정해진 것 (어댑터로 빼둠)

- 제모스 연동 방식 A/B/C → `backend/src/adapters/jemosAdapter.ts` (지금은 DEMO 합성 태그)
- ERP 직접 API 개방 → `backend/src/adapters/erpAdapter.ts` (지금은 FILE 폴백)
- 제모스 SSO → `backend/src/routes/auth.ts` 의 비밀번호 확인부만 교체

제모스에는 쓰기(write)를 하지 않습니다. 읽기 전용 수신만 합니다.
