# zen-integration-api — AP 대전공장 통합 레이어

기존 시스템(P-BOX·오리콘, 세이프체크, 폭염, 세척)을 **읽기만** 해서
하나의 통합 JSON으로 합치고, Claude로 관리자 브리핑까지 만드는 Worker.
**기존 시스템은 건드리지 않습니다.** 위에 한 겹만 얹습니다.

## 엔드포인트
| 경로 | 설명 |
|---|---|
| `GET /today` | 여러 시스템을 실시간으로 읽어 통합 현황 JSON 반환 (대시보드가 이걸 fetch) |
| `GET/POST /brief` | 통합현황 → Claude 요약 `{oneLine, kakao}` (관리자 한 줄 + 카톡 보고문) |
| `GET /health` | 상태 확인 |

## 배포 (5분)
```bash
cd integration

# 1) wrangler 준비 (한 번만)
npm i -g wrangler        # 또는 npx wrangler ...
wrangler login           # 브라우저로 Cloudflare 로그인

# 2) 상위 시스템 주소 넣기
#    wrangler.toml 의 UPSTREAM_PBOX 를 실제 P-BOX 데이터 주소로 수정
#    (JSON 내려주는 경로. 예: https://pbox-orikon-db.<sub>.workers.dev/api)

# 3) (선택) AI 브리핑용 Claude 키 — 없으면 규칙기반 요약으로 동작
wrangler secret put ANTHROPIC_API_KEY

# 4) 배포
wrangler deploy
```
배포되면 주소가 나옵니다: `https://zen-integration-api.<당신-subdomain>.workers.dev`

## 확인
```
https://zen-integration-api.<sub>.workers.dev/today
https://zen-integration-api.<sub>.workers.dev/brief
```
`/today` 가 `sources.pbox.ok = true` 로 나오면 라이브 연결 성공.

## 필드 맞추기 (딱 한 곳)
P-BOX가 내려주는 실제 JSON 필드명이 다르면 `src/index.js` 의
`adaptPbox()` 함수 안 필드명만 고치면 됩니다. (나머지는 그대로 동작)
→ 실제 `/today` 원본 JSON 샘플을 주시면 제가 맞춰 드립니다.

## 다음 단계
`/today` 가 살아나면, 대시보드(ZEN_Manufacturing_Platform_11.0.html) 홈이
이 주소를 fetch 해서 **실데이터가 한 화면에 뜨는 장면**을 만듭니다.
그 배포 주소를 알려주시면 대시보드에 바로 연결하겠습니다.
