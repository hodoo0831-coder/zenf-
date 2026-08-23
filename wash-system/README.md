# 세척실 AI 통합 시스템

**Wash Room AI System** — AP 대전공장 세척실 운영을 위한 다기기 실시간 연동 시스템

`ZENIEL × AMOREPACIFIC DAEJEON`

---

## 📋 개요

기존 단일 태블릿 기반의 세척실 관리 시스템을, 다기기 실시간 연동이 가능한 웹 시스템으로 재구축한 프로젝트입니다. 생산라인·세척실·관리자가 각자의 화면에서 동시에 접속해 데이터를 공유합니다.

**패턴 참조**: P-BOX / 오리콘 세척관리 시스템과 동일 구조

---

## 🌐 배포 URL

| 구분 | URL | 접근 |
|---|---|---|
| 작업자용 앱 | https://wash-worker.netlify.app | 게이트 없음 |
| 관리자용 대시보드 | https://wash-admin.netlify.app | `zeniel1996` |
| 백엔드 API | https://wash-db.hodoo0831.workers.dev | 내부용 |

---

## 🏗️ 시스템 구조

```
📺 터치스크린 1 (생산도급)          📺 터치스크린 2 (세척실)
   wash-worker.netlify.app             wash-worker.netlify.app
        ↓                                    ↑
        └──→ ☁️ Cloud (wash-db) ←──────┘
                    ↓
             💻 관리자 PC (wash-admin)
```

**세부 아키텍처**: [`docs/system-doc.html`](docs/system-doc.html) 참조

---

## 📁 파일 구조

```
wash-system/
├── README.md                       ← 지금 이 문서
├── frontend/
│   ├── index.html                  작업자용 앱 (Netlify - wash-worker)
│   └── dashboard.html              관리자용 대시보드 (Netlify - wash-admin)
├── backend/
│   ├── wash-worker.js              Cloudflare Worker 코드
│   └── schema.sql                  D1 데이터베이스 스키마
└── docs/
    └── system-doc.html             시스템 구조·구축과정 도식화
```

---

## ⚙️ 기술 스택

| 영역 | 사용 기술 |
|---|---|
| Frontend | Vanilla JS · HTML · CSS · localStorage |
| Backend | Cloudflare Workers (JavaScript) |
| Database | Cloudflare D1 (SQLite) |
| Hosting | Netlify (frontend) · Cloudflare (backend) |
| Sync | REST API · fetch() · JSON |
| Cost | 전부 무료 티어 |

---

## 🚀 배포 방법

### 1. 백엔드 (Cloudflare)

**D1 데이터베이스 생성**
1. Cloudflare 대시보드 → Storage & Databases → D1
2. `wash-data` 이름으로 생성
3. Console 탭에서 `backend/schema.sql` 실행

**Worker 배포**
1. Workers & Pages → Create → Workers
2. 이름: `wash-db`
3. 코드 편집기에서 `backend/wash-worker.js` 붙여넣기
4. 저장 및 배포

**D1 바인딩 연결**
1. Worker 설정 → 바인딩 추가
2. D1 데이터베이스 선택
3. 변수 이름: `DB` (⚠️ 대문자)
4. Database: `wash-data` 선택
5. 저장 후 재배포

**검증**
```
https://wash-db.hodoo0831.workers.dev/health
→ {"ok":true,"service":"wash-db","version":2,...}
```

### 2. 프론트엔드 (Netlify)

**작업자용 앱**
1. https://app.netlify.com/drop
2. `frontend/index.html` 드래그
3. 사이트 이름 변경 → `wash-worker`

**관리자용 대시보드**
1. 새 사이트 배포
2. `frontend/dashboard.html`을 `index.html`로 이름 변경 후 드래그
3. 사이트 이름 변경 → `wash-admin`

---

## 🔐 보안

| 대상 | 방식 |
|---|---|
| 작업자용 앱 | 오픈 (현장 사용) |
| 관리자용 대시보드 | 진입 비번 `zeniel1996` |
| 데이터 전송 | HTTPS 암호화 |
| DB 접근 | Cloudflare 계정 인증 |

---

## 🔄 동기화 방식

- **작업자용 앱**: 저장 시 400ms 디바운스로 자동 push + 10초마다 pull
- **관리자용 대시보드**: 5초마다 pull-only (읽기 전용)
- **오프라인 시**: localStorage에 저장 → 온라인 복귀 시 자동 재전송

---

## 📊 API 엔드포인트

| Method | Path | 용도 |
|---|---|---|
| GET | `/health` | 상태 확인 |
| GET | `/api/state` | 전체 상태 조회 (waiting + washing + records) |
| POST | `/api/state` | 전체 상태 저장 |
| POST | `/api/state/clear` | 상태 초기화 (관리자용) |

**응답 형식**
```json
{
  "ok": true,
  "data": {
    "waiting": {},
    "washing": {},
    "records": []
  },
  "updatedAt": 1786095479172,
  "ts": 1786095479172
}
```

---

## 👥 담당

- **기획·운영**: ZENIEL 사업3팀
- **개발 원본**: 이민아 대리 (v2.7 / v3.4)
- **다기기 연동 재구축**: 2026.08.07

---

## 📝 버전

- **v1.0** (2026.08.07) — 초기 배포, Cloudflare Worker + D1 백엔드, Netlify 프론트엔드

---

## 📄 라이선스

내부 사용 전용 (Internal Use Only)

© 2026 ZENIEL Manufacturing Business Division
