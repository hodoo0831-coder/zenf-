#!/usr/bin/env node
/**
 * ZEN Manufacturing Platform 빌드
 *
 *   node platform-src/build.cjs            → ZEN_Manufacturing_Platform_11.0.html + index.html 생성
 *   node platform-src/build.cjs --check    → 쓰지 않고, 지금 파일과 같은지만 확인(다르면 종료코드 1)
 *
 * 플랫폼은 단일 HTML 한 장으로 배포된다(외부 CDN 없음). 이 스크립트가 그 한 장을
 * 소스 조각에서 조립한다. 조각을 고치고 다시 빌드하면 된다 — 결과 HTML 을 직접 고치지 않는다.
 *
 *   platform-src/
 *     template.html     페이지 뼈대(로그인·앱 마크업). @@이름@@ 자리에 아래 조각이 들어간다
 *     css/              스타일 — 파일 이름 순서 = 덮어쓰기 순서(뒤가 이긴다)
 *     js/               앱 코드 — 파일 이름 순서 = 실행 순서
 *     build.cjs         이 파일
 *   vendor/xlsx.mini.min.js   엑셀 파서(내장)
 *
 * 내장 앱 14개(현장 앱·문서)는 레포에 있는 원본 파일을 그대로 읽어 넣는다. 복사본을 두지 않는다.
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const ROOT = path.resolve(__dirname, '..');
const SRC = __dirname;
const R = (...p) => path.join(ROOT, ...p);
const S = (...p) => path.join(SRC, ...p);
const read = (f) => fs.readFileSync(f, 'utf8');
/* 조각 파일은 끝에 줄바꿈이 하나 붙어 저장된다 — 읽을 때 한 번 벗겨 원래 줄 경계를 복원한다 */
const part = (f) => read(f).replace(/\n$/, '');

/* ───────── 조립 순서 ───────── */
const CSS_MAIN = ['10-base', '20-login', '30-slots-heatmap', '40-sidebar', '50-components', '55-rulebook-hero'];
const JS_APP = ['00-core', '10-ui-helpers', '20-live-feeds', '30-state-integrations', '40-computed-home',
  '50-reports-opslog', '60-judgment-actions', '70-insight-export', '80-agent-views',
  '90-data-plan', '95-data-ops', '99-router-login'];

/* ───────── 글꼴 — .claude/skills/zen-ui/scripts/embed_fonts.py 와 같은 결과 ───────── */
function fontFace() {
  const HEAD = '/* 나눔고딕 내장 — 외부 CDN 없이 어디서 열어도 같은 글꼴로 보이게 한다.\n' +
    '   라틴 + 한국어 상용 음절(KS X 1001)로 서브셋. 굵기는 400·700 두 벌.\n' +
    '   500/600 지정은 각각 400/700으로 그려지니 중간값을 쓰지 말 것. */';
  const out = [HEAD];
  for (const [w, f] of [[400, 'nanum_400.woff2'], [700, 'nanum_700.woff2']]) {
    const b64 = fs.readFileSync(R('.claude/skills/zen-ui/assets', f)).toString('base64');
    out.push("@font-face{font-family:'NanumGothicEmbedded';font-style:normal;" +
      'font-weight:' + w + ';font-display:swap;\n' +
      '  src:url(data:font/woff2;base64,' + b64 + ") format('woff2')}");
  }
  return out.join('\n') + '\n';
}

/* ───────── 내장 앱 — 내장할 때 두 가지를 덧붙인다 ─────────
 * ① storage shim: 내장 앱은 blob: 로 뜨는데, 플랫폼을 file:// 로 열면 blob 의 출처가 opaque 가 되어
 *    localStorage 접근이 SecurityError 를 던진다. 접근이 안 될 때만 메모리 저장소로 대체한다.
 * ② 창고 앱은 Worker 주소를 외부 config.js 에서 읽는데 blob 에는 그 파일이 없으므로 내용을 인라인한다. */
const STORAGE_SHIM = '<script>(function(){function mk(){var m={};return{getItem:function(k){return Object.prototype.hasOwnProperty.call(m,k)?m[k]:null},' +
  'setItem:function(k,v){m[k]=String(v)},removeItem:function(k){delete m[k]},clear:function(){m={}},' +
  'key:function(i){return Object.keys(m)[i]||null},get length(){return Object.keys(m).length}};}' +
  'function fix(n){try{window[n].getItem("__probe__");}catch(e){try{Object.defineProperty(window,n,{value:mk(),configurable:true});}catch(_){}}}' +
  'fix("localStorage");fix("sessionStorage");})();<\/script>';
function withShim(html) {
  const m = html.match(/<meta[^>]+charset[^>]*>/i);
  if (m) return html.replace(m[0], m[0] + STORAGE_SHIM);
  const h = html.match(/<head[^>]*>/i);
  if (h) return html.replace(h[0], h[0] + STORAGE_SHIM);
  return STORAGE_SHIM + html;
}
const WH_CONFIG = () => read(R('wh-stack/config.js'));
function withWhConfig(html) {
  return html.replace(/<script src="\.\/config\.js"><\/script>/,
    () => '<script>' + WH_CONFIG().replace(/<\/script>/gi, '<\\/script>') + '<\/script>');
}

/* id → [원본 파일, 인코딩, 창고 config 인라인 여부]
 * b64 = 클릭할 때 풀어 여는 문서, gz = 시작 때 미리 풀어 두는 현장 앱 */
const EMBED = {
  opl: ['ZEN_OPL_Generator.html', 'b64'], mon: ['ZEN_Monthly_Report.html', 'b64'],
  lab: ['ZEN_LaborCalc.html', 'b64'], safe: ['ZENF_Safety_App_v65.html', 'b64'],
  heat: ['ZEN_HeatWatch.html', 'b64'],
  svW: ['ZEN_SafeVoice.html', 'gz'],
  washW: ['wash-system/frontend/index.html', 'gz'], washA: ['wash-system/frontend/dashboard.html', 'gz'],
  pboxA: ['pbox-orikon-system/admin-site/pbox/index.html', 'gz'], pboxW: ['pbox-orikon-system/worker-site/pbox/index.html', 'gz'],
  oriA: ['pbox-orikon-system/admin-site/orikon/index.html', 'gz'], oriW: ['pbox-orikon-system/worker-site/orikon/index.html', 'gz'],
  whA: ['wh-stack/admin.html', 'gz', true], whW: ['wh-stack/worker.html', 'gz', true],
};
function embed(id) {
  const [file, kind, wh] = EMBED[id];
  let html = read(R(file));
  if (wh) html = withWhConfig(html);
  html = withShim(html);
  const buf = Buffer.from(html, 'utf8');
  return kind === 'gz' ? zlib.gzipSync(buf, { level: 9 }).toString('base64') : buf.toString('base64');
}

/* ───────── 조립 ───────── */
function build() {
  const slot = {
    'css-main': '\n' + fontFace() + '\n' + CSS_MAIN.map((n) => part(S('css', n + '.css'))).join('\n'),
    'css-vivid': part(S('css/60-vivid.css')),
    'css-responsive': part(S('css/70-responsive.css')),
    'css-polish': part(S('css/80-polish.css')),
    'css-white': part(S('css/90-white.css')),
    'js-xlsx': read(R('vendor/xlsx.mini.min.js')),
    'js-app': JS_APP.map((n) => part(S('js', n + '.js'))).join('\n'),
    'js-countup': part(S('js/countup.js')),
  };
  for (const id of Object.keys(EMBED)) slot['blob:' + id] = embed(id);

  let html = read(S('template.html'));
  const used = new Set();
  /* 함수 인자로 넘긴다 — 문자열로 넘기면 내용 속 $& 같은 패턴이 치환 기호로 해석된다 */
  html = html.replace(/@@([^@]+)@@/g, (m, name) => {
    if (!(name in slot)) throw new Error('템플릿에 정의되지 않은 자리: ' + name);
    used.add(name); return slot[name];
  });
  for (const name of Object.keys(slot)) if (!used.has(name)) throw new Error('쓰이지 않은 조각: ' + name);
  return html;
}

const OUT = ['ZEN_Manufacturing_Platform_11.0.html', 'index.html'];
const html = build();
const check = process.argv.includes('--check');
if (check) {
  let bad = 0;
  for (const f of OUT) {
    const have = fs.existsSync(R(f)) ? read(R(f)) : null;
    const same = have === html;
    console.log((same ? '✓ 동일  ' : '✗ 다름  ') + f + (same ? '' : '  (빌드 ' + html.length + ' / 현재 ' + (have ? have.length : '없음') + ')'));
    if (!same) bad++;
  }
  process.exit(bad ? 1 : 0);
}
for (const f of OUT) fs.writeFileSync(R(f), html);
console.log('BUILD OK · ' + (html.length / 1048576).toFixed(2) + ' MB · ' + OUT.join(' + '));
