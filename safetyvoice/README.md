# 세이프티 보이스 (배포본)

현장 위험사항·건의사항·제보를 QR 로 받는 앱. 두 화면이 하나의 저장소(젠키퍼 Cloudflare Worker)를 공유한다.

| 화면 | 배포 주소 | 이 폴더 |
|---|---|---|
| 현장(신고) | https://safetyvoice-worker.netlify.app | `worker.html` (받는 중) |
| 관리자 | https://safetyvoice-admin.netlify.app | `admin.html` |

- 저장소 API(`https://zenkeeper.hodoo0831.workers.dev`): 관리자는 `GET /reports` → `{reports:[…]}`, 상태·답변 저장은 `POST /` `{action:'update', id, status, reply}`.
- 이전 `ZEN_SafeVoice.html`(Netlify Function + Blobs, `/api/report`)은 다른 구현이다 — 배포본은 이 폴더.
