---
name: zen-ui
description: 젠키퍼·제니엘(ZEN 스위트) 사내 웹앱의 화면 디자인 시스템 — 네이비 강조 + 나눔고딕 내장 + 백지·헤어라인 에디토리얼 톤을, 외부 CDN 없는 단일 HTML 파일로 만든다. 320~1920 반응형 검증 스크립트와 서브셋 나눔고딕 woff2를 함께 제공한다. 사용자가 zenf-/ZEN 스위트/젠타임/젠키퍼 앱을 새로 만들거나 기존 화면의 디자인·글꼴·색·레이아웃·비율을 손볼 때, "우리 스타일로", "내 스타일로", "젠키퍼 톤으로", "사내 앱 하나 만들어줘", "이 화면 좀 깔끔하게" 같은 요청을 할 때 반드시 이 스킬을 먼저 읽는다. 제니엘/AX T/F 현장용 관리 화면(근태·생산·점검·대시보드 등)을 단일 HTML로 만드는 요청이면 디자인을 명시적으로 언급하지 않아도 사용한다.
---

# ZEN 스위트 화면 디자인

제니엘 제조·도급 현장에서 쓰는 관리 화면을 만들 때의 규칙과 재료.
톤은 **백지 + 헤어라인 + 네이비 강조**의 에디토리얼 스타일이다. 그림자·둥근 모서리·
그라데이션으로 꾸미지 않고, 여백과 선과 글자 굵기로 위계를 만든다.

## 새 앱이면 여기서 시작

셸(상단바·컨텍스트바·사이드바·모바일 탭바·드로어·모달·토스트)과 글꼴 내장을 매번 다시
만들지 말고 뼈대를 뽑아 쓴다. 그 자리에서 더블클릭하면 뜨는 완성된 단일 HTML이 나온다.

```bash
python3 scripts/new_app.py 젠체크.html \
  --name 젠체크 --roman ZENCHECK --sub "현장 점검 관리" \
  --title "젠체크 · 현장 점검" --desc "현장 점검 결과를 모아 한 장으로"
# 날짜 축이 없는 앱이면 --slim (근태 그리드·달력 CSS 제외)
```

그 다음 할 일은 세 가지뿐이다 — `USERS`·`MENUS`에 역할과 메뉴를 정의하고, `VIEWS`에
화면 함수를 채우고, `renderCtx()`의 컨텍스트 바를 이 앱에 맞게 바꾼다. 셸·라우팅·
모바일 대응은 이미 돌아간다.

기존 화면을 손보는 작업이면 이 절은 건너뛰고 아래 규칙만 본다.

## 협상 불가 제약

이 넷은 취향이 아니라 운영 조건이다. 어기면 현장에서 앱이 안 뜬다.

1. **단일 HTML 파일 · 외부 CDN 금지.** 현장 PC는 외부망이 막혀 있는 경우가 있고, 파일을
   메신저로 주고받으며 더블클릭으로 여는 일이 흔하다. 라이브러리·글꼴·아이콘은 파일 안에
   인라인으로 넣거나 `vendor/`에 두고 같은 배포에서 서빙한다. 빌드 과정 없이 그대로 뜬다.
2. **모든 화면 반응형.** 320px(구형 폰)부터 1920px까지 **가로 스크롤 0**. 모바일 우선으로
   쓰고 `@media (min-width:768px)` / `(min-width:1024px)`로 넓힌다. 현장관리자는 폰으로,
   J/C·본사는 PC로 같은 화면을 본다.
3. **터치 타깃 최소 40px.** 장갑 낀 손과 작업화 신은 채로 누른다.
4. **UI 텍스트는 한국어.** 코드·식별자만 영문.

## 색

```css
:root{
  --navy:#0f2438; --navy2:#16365b;          /* 강조 · 주버튼 · 활성 상태 */
  --green:#5b7f52; --green-d:#4a6b43; --green-l:#eef4ec;   /* 정상·성공에만 */
  --ink:#141f29; --muted:#5f6d77; --faint:#8b969e;
  --bg:#ffffff; --card:#ffffff; --line:#e3e7e9; --line2:#eef1f2; --wash:#f7f8f8;
  --err:#c25a52;  --err-l:#fbf0ef;
  --warn:#cb9447; --warn-l:#fdf5ea;
  --ok:#4a8a60;   --ok-l:#eef6f0;
  --info:#48688d; --info-l:#eef2f7;
  --r:3px;              /* 모서리는 거의 각지게 */
  --sh:none;            /* 그림자 없음 */
  --pad:20px;           /* 데스크톱에서 24px */
  --gut:0px;            /* 초광폭 가운데 여백 — 아래 "1760px 이상" 참조 */
}
@media (min-width:1024px){ :root{--pad:24px} }
```

**네이비가 강조색이고 초록은 상태색이다.** 좌측 메뉴 활성 표시, 주버튼, 진행바, 단계
번호, 체크 표시 — 전부 네이비. 초록은 "정상 판정 / 마감 완료 / 검증 통과"처럼 **의미가
초록인 자리에만** 남긴다. 초록을 강조색으로 쓰면 상태 배지와 구분이 안 돼 화면이 읽히지
않는다.

역할·인물 아바타는 색으로 사람을 구분하지 말고 네이비 농담 한 줄로 위계를 준다
(말단 `#6b7f95` → 중간 `#47607a` → 상위 `#2e4d6b` → 최상위 `#0f2438`).

## 글꼴 — 여기서 가장 많이 실수한다

나눔고딕을 서브셋해서 파일에 내장한다. `assets/nanum_400.woff2`(158KB) ·
`assets/nanum_700.woff2`(217KB)를 그대로 쓰면 되고,
`scripts/embed_fonts.py`가 `@font-face` 블록을 base64로 찍어준다.
(`new_app.py`로 만들었다면 이미 들어 있다 — 기존 파일에 글꼴만 넣을 때 쓴다.)

```bash
python3 scripts/embed_fonts.py > fontface.css     # 붙여넣을 CSS가 나온다
```

라틴 + KS X 1001 상용 음절 2,350자 + 앱에서 쓰는 글자로 서브셋해 둔 것이라, 시드에 없던
이름이 들어와도 대부분 같은 글꼴로 나온다. 파일이 375KB 늘지만 Netlify가 gzip으로
내보내므로 실제 전송량은 그보다 작고, 첫 로딩 한 번뿐이다.

```css
body{font-family:'NanumGothicEmbedded','NanumGothic','Nanum Gothic','나눔고딕',
  'Malgun Gothic','맑은 고딕',system-ui,-apple-system,sans-serif;
  font-size:14px; line-height:1.66; color:var(--ink); background:var(--bg);
  -webkit-font-smoothing:antialiased;
  font-variant-numeric:tabular-nums; font-feature-settings:"tnum" 1}
```

**굵기는 400과 700, 두 벌뿐이다.** 이게 함정이다. CSS 폰트 매칭 규칙상
`font-weight:500`은 아래로 내려가 **400으로 그려지고**, `600`은 위로 올라가 **700이
된다**. 즉 라벨을 500으로 지정하면 굵어지기는커녕 보통 굵기로 나온다. 화면이 전체적으로
얇고 흐릿해 보이면 십중팔구 이것이다.

그러니 **중간값을 쓰지 말고 400 아니면 700으로 정한다**:

| 자리 | 굵기 |
|---|---|
| 본문·설명 문단, 표 안의 일반 텍스트 | 400 |
| 페이지 제목(h1), 카드·모달 제목, 타일 수치 | 700 |
| 라벨·표 머리글·좌측 메뉴·탭바·태그·칩·버튼 | 700 |
| 데이터 그리드의 숫자 | 700 (스캔이 쉬워진다) |

큰 표제를 300~400으로 얇게 뽑는 디스플레이 조판은 나눔고딕에서 하지 않는다. 얇은 획이
한글에서 뭉개져서 세련되기는커녕 흐리멍덩해진다.

문단은 400으로 두되 회색을 너무 밝히지 않는다(`--muted:#5f6d77`, `--faint:#8b969e`).
굵기로 못 주는 대비를 색으로 준다.

## 비율 — 화면이 허전하거나 답답할 때 볼 것

**페이지 머리를 짧게.** 제목·설명·칩이 화면 위쪽을 40% 잡아먹으면 정작 일하는 표가
접힌다. 1440에서 31일치 근태 그리드가 잘리던 것이 머리를 줄이자 한 화면에 들어왔다.

```css
.ph{margin-bottom:22px}
.ph .k{font-size:10.5px;font-weight:700;letter-spacing:.14em;color:var(--faint)}
.ph h1{font-size:clamp(22px,4.6vw,30px);font-weight:700;line-height:1.3;
  letter-spacing:-.035em;color:var(--navy);margin-top:7px}
.ph p{font-size:13.5px;color:var(--muted);margin-top:9px;line-height:1.75;max-width:62ch}
```

설명 문단은 `max-width:62ch`로 묶는다. 1920에서 한 줄이 150자로 늘어나면 눈이 다음 줄을
못 찾는다.

**초광폭(1760px+)에서는 셸 전체를 가운데로.** 본문만 가운데 정렬하면 사이드바와 본문
사이가 텅 비어 어색하다. 사이드바+본문을 한 덩어리로 묶고, 상단바·컨텍스트바에 **같은
여백**을 줘서 로고·메뉴·본문이 한 세로선에 맞게 한다.

```css
@media (min-width:1760px){ :root{--gut:calc((100vw - 1700px) / 2)} }
.topbar{padding:10px calc(14px + var(--gut))}
.ctxbar{padding:9px calc(14px + var(--gut))}
.shell{display:flex;padding:0 var(--gut)}
```

`100vw`는 스크롤바를 포함하지만 padding으로만 쓰면 넘침이 생기지 않는다.

**사이드바 구분선은 화면 높이만큼.** `align-self:flex-start`인 sticky 사이드바는 내용
높이만큼만 자라서 세로선이 화면 중간에 뚝 끊긴다. `height:calc(100vh - <상단 높이>)`로
고정한다.

**표는 여백을 줄이되 터치 타깃은 지킨다.** 셀 padding을 데스크톱에서 9px까지 줄이면
목록이 9행 → 11행 보인다. 행 안의 버튼은 여전히 `min-height:40px`이다.

**표 첫·끝 칸을 카드 제목선에 맞춘다.** 카드 제목은 `--pad`, 표 셀은 14px이면 7px씩
어긋나 보인다.

```css
.card-b.np table.tb th:first-child,.card-b.np table.tb td:first-child{padding-left:var(--pad)}
.card-b.np table.tb th:last-child, .card-b.np table.tb td:last-child {padding-right:var(--pad)}
```

**넓은 표는 반드시 자기 컨테이너 안에서만 스크롤한다** (`.tw{overflow-x:auto}`).
페이지 본문이 가로로 밀리면 안 된다.

## 컴포넌트

`assets/base.css`에 실제로 검증된 전체 CSS가 들어 있다(약 430줄). `new_app.py`가 이걸
넣어주지만, 기존 파일에 붙일 때는 통째로 복사하고 안 쓰는 블록을 지우는 편이 처음부터
쓰는 것보다 빠르고 안전하다.

- 화면 골격(상단바·컨텍스트바·사이드바·탭바·드로어), 카드, 통계 타일, 표, 진행 단계,
  체크리스트, 모달, 토스트, 배지·태그, 근태 그리드, 달력, 로그인 화면이 들어 있다.
- 각 블록이 어떤 상황에 맞고 어떻게 조합하는지는 `references/patterns.md`를 읽는다.
  화면을 새로 짤 때 **어떤 컴포넌트를 고를지 고민되면 먼저 여기를 본다.**

## 완성 전 검증

눈으로 보고 "괜찮네" 하면 320px에서 반드시 깨져 있다. 스크립트로 확인한다.

```bash
node scripts/check_responsive.js file:///path/to/app.html
node scripts/check_responsive.js file:///path/to/app.html --states states.js
```

6개 폭(320/390/768/1024/1280/1920)에서 가로 넘침·40px 미만 터치 타깃·JS 오류를 잡고,
넘친 경우 **어떤 엘리먼트가 범인인지** 찍어준다. 화면 전환이 있는 앱이면 `--states`로
상태 목록을 준다:

```js
// states.js
module.exports = [
  { name: '로그인' },                                   // js 없으면 첫 화면 그대로
  { name: '현장관리자/대시보드', js: 'fillAcct("m01"); go("m-home")' },
  { name: '현장관리자/근태원장', js: 'fillAcct("m01"); go("m-att")' },
];
```

`ALL CLEAN`이 나올 때까지 고친다. 실패가 뜨면 **테스트를 느슨하게 하지 말고 앱을 고친다** —
단, 진입 애니메이션의 transform 때문에 40px이 39.97px로 측정되는 것처럼 측정 자체가
문제일 때는 대기 시간을 늘리거나 허용오차를 조정하는 게 맞다. 안정된 뒤의 실제 값을
확인하고 판단한다.

`--shots <디렉터리>`를 주면 폭별 스크린샷도 저장한다. **넘침 0이어도 비율은 이상할 수
있으니** 반드시 눈으로 확인한다 — 위 "비율" 절의 문제들은 전부 스크린샷에서 발견한 것이다.

playwright가 스킬 폴더에 없으므로, 프로젝트에 설치돼 있으면 그쪽을 가리킨다:

```bash
NODE_PATH=<프로젝트>/node_modules node scripts/check_responsive.js …
```

## 배포 (zenf- 저장소)

`main` 브랜치 → Netlify 자동 배포, 빌드 없음. 짧은 경로는 `netlify.toml`의 redirects에
추가한다(`/zentime`, `/attendance` 같은 식).

## 실제 데이터를 넣기 전에

시연·데모용 데이터는 **전부 가상 이름·가상 사번**으로 만든다. 실제 사번·성명 등
개인정보는 보안 승인 전까지 넣지 않는다. 현장명·고객사명은 실명을 써도 되지만, 사람
이름은 승인 전까지 가상으로 둔다.
