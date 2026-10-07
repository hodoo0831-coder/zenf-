# 플랫폼 소스 (platform-src)

`ZEN_Manufacturing_Platform_11.0.html` 과 `index.html` 은 **여기서 조립한 결과물**이다.
결과 HTML 을 직접 고치지 않는다 — 조각을 고치고 다시 빌드한다.

```bash
node platform-src/build.cjs            # 두 HTML 생성
node platform-src/build.cjs --check    # 쓰지 않고 지금 파일과 같은지만 확인 (다르면 종료코드 1)
```

빌드는 Node 만 있으면 된다(추가 설치 없음). 결과는 결정적이라 같은 소스면 같은 바이트가 나온다.
Netlify 배포에는 빌드 단계가 없다 — 빌드한 HTML 을 커밋하면 그대로 서빙된다.

## 어디를 고치나

| 하고 싶은 것 | 고칠 곳 |
|---|---|
| 화면·로직·판단 룰 | `js/` — 파일 이름 순서가 실행 순서 |
| 색·간격·글꼴 | `css/` — 파일 이름 순서가 덮어쓰기 순서(뒤가 이긴다) |
| 로그인·앱 뼈대 마크업 | `template.html` |
| 내장 현장 앱 | **원본 파일** (`wash-system/`, `wh-stack/`, `ZEN_SafeVoice.html` …) 을 고치고 다시 빌드 |
| 내장 앱 목록 추가 | `build.cjs` 의 `EMBED` + `template.html` 끝의 `zd-` 블록 + `js/00-core.js` 의 `_zd` 사용처 |

## js/ — 앱 코드 (13개)

| 파일 | 내용 |
|---|---|
| `00-core.js` | 공용 헬퍼·차트·표준 4단·**DB(단일 진실원)** |
| `10-ui-helpers.js` | 모듈 탭·아이콘·일일 보고문 |
| `20-live-feeds.js` | **실시간 직결** — 실적·세척·안전(온열)·창고 적치·인력 |
| `30-state-integrations.js` | 역할 스코프·localStorage·외부 연동 시스템 |
| `40-computed-home.js` | 파생값·에이전트/역할·컨트롤타워·부하율 마스터·일간 필요 인원 |
| `50-reports-opslog.js` | 계획·예측·보고·일자별 운영 기록 |
| `60-judgment-actions.js` | **AI 판단 센터·판단 룰 카탈로그·조치 추적·조치 공유** |
| `70-insight-export.js` | 성과지표·분석 내보내기 |
| `80-agent-views.js` | 인력·세척·창고·안전·품질·KPI 화면, 보고서 오버레이, 엑셀/PDF/PPT 내보내기 |
| `90-data-plan.js` | 데이터 관리·주간 생산계획·실적·창고 점검 업로드 |
| `95-data-ops.js` | 데이터 입출력 |
| `99-router-login.js` | 라우터·메뉴·로그인 |
| `countup.js` | KPI 숫자 카운트업 (`go` 를 감싸므로 마지막에 실행) |

## css/ — 스타일 (10개, 쌓인 순서 그대로)

`10~55` 는 원래 한 덩어리였던 기본 스타일을 주제별로 자른 것이다.
`60-vivid` → `70-responsive` → `80-polish` → `90-white` 는 **그 위에 차례로 덮어쓴 층**이다.

> 이 층 구조가 `!important` 를 늘렸다. 한 겹으로 합치는 정리는 소스가 생겼으니 이제 안전하게 할 수 있다 —
> 합친 뒤 `--check` 가 아니라 스크린샷 비교로 확인한다(바이트가 달라지는 게 맞다).

## 파일 구조 — 왜 데이터를 맨 뒤에 두나

내장 앱 14개(약 6MB)는 `<script type="text/plain" id="zd-…">` 블록으로 **파일 맨 뒤**에 있다.
앞에 두면 브라우저가 7MB 를 다 받아야 앱 코드를 실행할 수 있어 느린 회선에서 로그인이 안 열린다.
앱 코드(`js/`)는 약 260KB 라 파일 앞쪽 1MB 지점에서 끝난다.

## 검증

수정 후:
1. `node platform-src/build.cjs`
2. 브라우저로 `index.html` 열어 로그인·주요 화면 확인
3. 레포 루트에서 `node .claude/skills/zen-ui/scripts/check_responsive.js file://$PWD/index.html` (320~1920 폭)
