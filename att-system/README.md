# att-system — 근태 원천등록 · ERP 자동화

제니엘 AX T/F 1그룹 근태 과제의 **백엔드(API·DB)** 와 기준 문서.
화면은 저장소 루트의 `ZEN_Attendance.html`(젠타임)이 담당한다.

```
[제모스]  출퇴근 · 연차/반차 · 계정          ← 수정 불가 · 읽기 전용 수신
    ▼
backend/            Cloudflare Workers + D1   ← 판정·검증·확정·마감·전송 로직 전부
    ▲ REST (X-User-Id)
ZEN_Attendance.html 젠타임 콘솔 (근로자·현장관리자·J/C·시스템관리자)
    ▼
[ERP]  ERP_HR.TB_MON_ATT / TB_OT_ATT        ← DB 직접 INSERT (권한 확정 대기)
```

## 문서

| 파일 | 성격 |
| --- | --- |
| `기준문서_메뉴및기능정의_v2.md` | **개발 기준.** 메뉴·화면·검증룰 V-01~V-15·확정단위·ERP 전송 방식이 모두 여기 기준 |
| `시연대본_산출물정리.md` | 무엇이 유효/폐기인지 + 시연 대본 |
| `README_먼저읽기.md` | 패키지 안내 |

> 저장소 루트의 `ZEN_Attendance.html` 안에는 기능정의서 v1.1 의 56개 기능이
> 데이터로 들어 있다(시스템관리자 → 기능정의서 화면). 기능ID 체계는 유효하나
> 개별 설명은 위 기준문서가 우선한다.

## 백엔드 실행

```bash
cd att-system/backend
npm install
npx wrangler d1 execute att_db --local --file=./schema.sql
npx wrangler d1 execute att_db --local --file=./seed.sql
npx wrangler dev --local --port 8787
```

`wrangler.toml` 의 `database_id` 는 `wrangler d1 create att_db` 후 채운다.
로컬 실행만 할 때는 아무 값이나 넣어도 된다.

### 환경 변수

| 변수 | 값 | 뜻 |
| --- | --- | --- |
| `JEMOS_MODE` | `MOCK` | 항상 0건 — 실연동 확정 전 기본값 |
| | `DEMO` | **시연용 합성 태그.** 근무계획이 있는 날에 결정적 난수로 태그를 만든다. 미태깅·퇴근결손·지각·연장·위치이탈·중복태그를 섞어 검증엔진이 실제로 발동하는지 본다. 실연동이 아니다 |
| | `A_API` / `B_DB` / `C_BATCH` | 수신 방식 확정 후 구현체 교체 (어댑터 인터페이스는 고정돼 있음) |
| `ERP_MODE` | `FILE` | 폴백 — 산출물만 만들고 사람이 ERP에 업로드 후 결과 기록 (F-I0109) |
| | `DIRECT` | ERP DB 직접 INSERT. **API 스펙·권한 확정 후에만 켠다** |

## 화면 연결

젠타임을 API에 붙이려면 주소 뒤에 `?api=` 를 붙인다.

```
ZEN_Attendance.html?api=http://localhost:8787
```

한 번 넣으면 브라우저에 기억된다. 주소를 비우면 **데모 모드**로 떨어져
파일만 열어도 전 화면이 돈다(데이터는 브라우저 안에서만 산다).
로그인 화면 맨 아래 "백엔드 주소 설정"에서도 바꿀 수 있다.

계정: `U-MGR`(현장관리자) · `U-JC`(J/C) · `U-SYS`(시스템관리자) · `W-01`/`W-02`(근로자)

## 시연 순서

```
① 제모스 일 배치 수신   x-recv 화면 → "제모스 일 배치 수신"  (JEMOS_MODE=DEMO)
② 검증 실행             "검증 실행 (V-01~15)"
③ 예외 처리             오류는 사유로 못 넘어간다 — 실제 보정해야 해소된다
④ 1차 확정 (현장관리자)  체크리스트 4조건 · 오류 0건이어야 통과
⑤ 2차 승인 · 마감 (J/C)  마감 시 스냅샷 봉인(해시)
⑥ 집계 · 대조           원장 합계 = 집계 합계 100% 일치 확인
⑦ ERP 전송              FILE 모드면 "API 미개방" 정직한 응답
```

## 이 저장소에서 추가한 것

원본(2026-09-04 TF 패키지)에 아래를 더했다. 나머지는 그대로다.

- `src/routes/meta.ts` — 조회 전용 API 4개(`/api/users` `/api/sites` `/api/employees` `/api/holidays`).
  기존에는 사원·현장 목록을 내려주는 엔드포인트가 없어 화면이 사번만 표시할 수 있었다. 쓰기 없음.
- `src/adapters/jemosAdapter.ts` — `JemosDemoAdapter` 추가(`JEMOS_MODE=DEMO`). 제모스에 쓰기 없음.
- `src/routes/confirm.ts` — **마감 버그 수정.** 같은 (사번,일자)에 채널이 둘 이상이면
  `snapshot_ledger` PK(snap_id, emp_id, wdate) 충돌로 마감이 실패했다.
  하루 한 행만 봉인하도록 우선순위를 넣었다 — ① 확정값이 있는 행 ② 제모스 ③ 최근.

## 아직 안 되는 것

| 항목 | 상태 | 왜 |
| --- | --- | --- |
| 제모스 실연동 | ⛔ | 수신 방식 A/B/C 미확정 (기준문서 §12 ★) |
| ERP DB 직접 INSERT | ⛔ | **코드가 아니라 인프라 문제.** Workers가 사내 ERP DB에 닿을 수 있는지, 쓰기 권한·테이블 스펙부터 |
| 로그인 | ⚠️ | `X-User-Id` 헤더 임시 인증. SSO 미정 |
| OCR 인식 | ⚠️ | 큐만 있고 인식 엔진 없음 — 사람이 값을 넣어 확정 |
| Cloudflare 배포 | ⛔ | 계정 접근 권한이 있는 환경에서 `wrangler deploy` 필요 |

**개인정보** — 실제 사번·성명은 보안 승인 전까지 넣지 않는다(기준문서 §12).
현재 seed 는 전부 가상 데이터다.
