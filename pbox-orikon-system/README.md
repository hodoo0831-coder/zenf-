# P-BOX · 오리콘 세척 실적 관리 시스템

ZENIEL × AMOREPACIFIC 대전공장
현장 작업자가 모바일로 세척 실적을 입력하면 관리자 대시보드에 실시간 반영되는 시스템.

---

## 구성

| 폴더 | 내용 | 배포처 |
|---|---|---|
| `worker-api/` | Cloudflare Worker + D1 (조회·저장·삭제 API) | Cloudflare Workers |
| `worker-site/` | 작업자 입력 앱 (P-BOX / 오리콘) | Netlify · orikon-pbox-worker |
| `admin-site/` | 관리자 대시보드 | Netlify |
| `docs/` | 데이터 규칙·운영 메모 | — |

```
worker-site/            admin-site/
  index.html   랜딩       index.html   랜딩
  pbox/                  pbox/
  orikon/                orikon/
```

---

## 데이터 흐름

```
작업자 앱  ──POST /records──►  Cloudflare Worker  ──►  D1 (work_records)
                                      │
관리자 대시보드  ◄──GET /records──────┘   (5초마다 자동 갱신)
작업자 앱  ──DELETE /records/{id}──►
```

**서버 API** : `https://pbox-orikon-db.hodoo0831.workers.dev`

| 메서드 | 경로 | 용도 |
|---|---|---|
| GET | `/records?system=P-BOX&limit=5000` | 조회 |
| POST | `/records` | 저장 |
| DELETE | `/records/{id}` | 삭제 |
| GET | `/health` | 상태 진단 (테이블·컬럼·건수) |

**id 규칙** : 로컬 id 앞에 접두사. P-BOX → `pbox_`, 오리콘 → `oricon_`

---

## 환산 기준

| | 1 PLT | 부위 | 작업유형 |
|---|---|---|---|
| P-BOX | 90 EA | 박스 / 커버 | 세척 / 간지 |
| 오리콘 | 120 EA | 中 / 大 | 세척 / 분류 / 수리 |

M·H = 투입인원 × 작업시간

---

## 배포 방법

**Cloudflare Worker**
1. dash.cloudflare.com → Workers & Pages → `pbox-orikon-db`
2. Edit code → `worker-api/worker.js` 내용 전체 붙여넣기 → 배포
3. `/health` 로 확인

**Netlify (작업자 / 관리자)**
- 해당 프로젝트 → 프로덕션 배포 영역에 폴더 드래그
- GitHub 연동 시 push 하면 자동 배포

---

## 주요 기능

**작업자 앱**
- 부위·작업유형 선택, PLT/EA 입력, 시간·인원 기록
- 삭제 시 서버까지 반영 (통신 실패하면 화면에서도 유지)
- 오프라인 입력분 자동 동기화

**관리자 대시보드**
- KPI 스트립 + 스파크라인, 일자별 캘린더 히트맵
- 탭 구성 : 개요 / 주간계획 / 기간·패턴 / 작업자 / 이상 감지 / 작업 기록
- 주간계획표 엑셀 업로드 → 소요량 자동 인식 → 실적 대비 달성률
- 중복 의심 자동 감지 · 기록 제외
- 경영보고서 내보내기 (엑셀 8시트 / PPT 11매 / PDF)

---

## 주의

- 관리자의 「제외」는 해당 브라우저에만 저장됨 (서버 데이터는 유지)
- Worker 코드 수정 시 **전체를 통째로** 교체할 것. 일부만 붙여넣으면 조회·저장이 사라짐
- 배포 실수 시 Cloudflare → Deployments → Rollback 으로 복구 가능
