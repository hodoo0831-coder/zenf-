# ZEN 스위트 (zenf-)

제니엘 제조/도급 현장용 단일 HTML 앱 모음. Netlify 정적 배포(`netlify.toml`),
서버가 필요한 앱은 `netlify/functions/` 서버리스 함수 + Netlify Blobs 사용.

## 필수 규칙

- **모든 앱은 무조건 반응형으로 만든다.** 모바일(320px)부터 태블릿·PC(1920px)까지
  전 구간에서 가로 스크롤 없이 동작해야 하며, 완성 전에 최소
  320 / 390 / 768 / 1280 / 1920 폭에서 검증한다. 모바일 우선으로 작성하고
  넓은 화면은 `@media (min-width:768px)`, `@media (min-width:1024px)`로 확장한다.
- 터치 타깃은 최소 40px 이상.
- 앱은 단일 HTML 파일로 만든다(외부 CDN 의존 금지 — 라이브러리는 인라인
  내장하거나 `vendor/`에 두고 같은 배포에서 서빙).
- UI 텍스트는 한국어, 브랜딩은 젠키퍼(ZenKeeper)·제니엘 그린 팔레트
  (`--green:#5b7f52`, `--navy:#0f2438`, `--bg:#eef1f1`).

## 배포

- main 브랜치 → Netlify 자동 배포. 빌드 과정 없음(정적 서빙).
- 짧은 경로는 `netlify.toml`의 redirects에 추가한다.
