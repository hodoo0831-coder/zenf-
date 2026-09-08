# ZEN 스위트 (zenf-)

제니엘 제조·도급 현장용 웹앱 모음. 앱은 전부 **단일 HTML 파일**이고 `main`에 올리면
Netlify가 그대로 서빙한다(빌드 없음). 서버가 필요한 것만 별도 백엔드를 둔다.

## 지금 서빙되는 것 — 이 셋이 제품이다

| 주소 | 파일 | 무엇 | 백엔드 |
| --- | --- | --- | --- |
| `/` `/platform` | `index.html` (= `ZEN_Manufacturing_Platform_11.0.html`) | ZEN Manufacturing 허브 — AP 대전공장 통합 관제. 창고앱(wh-stack)은 외부 URL로 연결 | 없음 |
| `/zentime` `/attendance` `/att` | `ZEN_Attendance.html` | **젠타임** — 근태 원천등록·검증·확정·마감·ERP 전송. 4역할 36화면 | `att-system/backend` (Workers + D1) |
| `/report` `/r` `/safevoice` `/admin` | `ZEN_SafeVoice.html` | 세이프보이스 — 현장 위험 신고·개선 제안 (QR 접수) | `netlify/functions/report.mjs` + Blobs |

젠타임은 파일을 **더블클릭하면 데모 모드**(가상 데이터, 오프라인)로 뜨고, 주소 뒤에
`?api=<백엔드주소>`를 붙이면 **라이브 모드**(진짜 로그인, D1 데이터)로 동작한다.

## 나머지 앱 — 서빙은 되지만 허브에서 잇지 않는다

| 파일 | 무엇 | 상태 |
| --- | --- | --- |
| `ZEN_HeatWatch.html` | 히트워치 · 옥외작업 체감온도 판정 | 독립 |
| `ZEN_LaborCalc.html` `ZEN_Labor_Load.html` | 인력 부족·여유 자동계산 (AP 대전 생산도급) — 두 파일이 같은 제목 | 중복 의심 |
| `ZEN_Monthly_Report.html` | 월 마감 자동 보고서 v4.0 | 독립 |
| `ZEN_OPL_Generator.html` | 원포인트레슨(OPL) 자동생성 | 독립 |
| `ZEN_Workforce_Agent.html` | AP 생산동 실시간 인력 현황 | 독립 |
| `ZEN_Manufacturing_Suite.html` | 통합 관제 에이전트 (허브의 이전 형태) | 독립 |
| `ZENF_Safety_App_v65.html` | 젠키퍼 · 제니엘 4대 실천 (`index (1).html`과 같은 내용) | v54는 구버전 |
| `agent_표준구성.html` `구조재편_비교.html` | 설명용 한 장짜리 | 문서 성격 |

## 보고·기록물 (앱 아님)

`ZEN_ZAIC_보고자료.pptx` · `ZEN_기술보고서.pptx` · `ZAIC_*.docx` · `ZEN_나레이션_대본.md` ·
`ZEN_데모영상_최종.mp4` · `ZEN_데모영상_auto.webm` (영상 둘이 46MB — 현재 공개 주소로 내려받아진다)

## 다른 시스템의 소스 (여기서 서빙하지 않음)

`pbox-orikon-system/` P-BOX·오리콘 세척 실적 · `wash-system/` 세척실 AI · `integration/` 통합 API ·
`wh-stack/` 창고 앱 — 전부 AP 대전공장의 별도 시스템. 허브는 이들을 **외부 URL**로 부른다.

## 젠타임 개발 — 절차 셋

```bash
# 실행
open ZEN_Attendance.html                      # 데모 모드. 이걸로 시연·설명 끝
cd att-system/backend && npm install
npx wrangler d1 execute att_db --local --file=./schema.sql
npx wrangler d1 execute att_db --local --file=./seed.sql
npx wrangler d1 execute att_db --local --file=./migrations/001_auth.sql
npx wrangler dev --local --port 8787          # 라이브 모드: 화면 주소 뒤 ?api=http://localhost:8787

# 검증  (att-system/tests/ — 반응형 320~1920 · 기능 56 · 인증 · 마감 체인)
cd att-system && npm test

# 배포
git push origin main                          # Netlify 자동. 백엔드는 wrangler deploy (AUTH_MODE=PROD 확인)
```

기준 문서와 백엔드 구조는 `att-system/README_먼저읽기.md` → `att-system/README.md` 순으로.
화면 디자인 규칙·글꼴·검증 스크립트는 `.claude/skills/zen-ui/` (새 앱 뼈대: `scripts/new_app.py`).

## 규칙

`CLAUDE.md` 참조 — 반응형 320~1920 · 터치 40px · 단일 HTML · CDN 금지 · 네이비 강조 ·
사람 이름·사번은 보안 승인 전까지 가상.
