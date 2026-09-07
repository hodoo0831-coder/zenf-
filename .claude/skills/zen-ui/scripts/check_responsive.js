#!/usr/bin/env node
/**
 * 320~1920 반응형 검증 — 가로 넘침 · 40px 미만 터치 타깃 · JS 오류를 잡는다.
 *
 *   node check_responsive.js file:///path/to/app.html
 *   node check_responsive.js http://localhost:8791/app.html --states states.js
 *   node check_responsive.js <url> --shots /tmp/shots     # 폭별 스크린샷도 저장
 *
 * 브라우저를 못 찾으면 CHROMIUM_PATH 또는 PLAYWRIGHT_BROWSERS_PATH 로 알려준다.
 * states 는 한 페이지에서 순서대로 실행되므로, 앞 상태가 남긴 모달·필터가 뒤에 영향을 준다.
 *
 * states.js 는 화면 전환이 있는 앱에서 각 화면을 돌아보게 하는 목록이다:
 *
 *   module.exports = [
 *     { name: '로그인' },                                  // js 없으면 첫 화면 그대로
 *     { name: '관리자/대시보드', js: 'fillAcct("m01"); go("m-home")' },
 *   ];
 *
 * 넘침이 잡히면 어떤 엘리먼트가 범인인지 같이 찍는다. overflow-x:auto 컨테이너 안에서
 * 넘치는 것은 정상이므로 제외한다(넓은 표는 자기 안에서만 스크롤해야 한다).
 */
const path = require('path');
const fs = require('fs');

const WIDTHS = [320, 390, 768, 1024, 1280, 1920];
const MIN_TOUCH = 39.9;   // 40px 목표. 애니메이션 transform 때문에 39.97 등으로 읽히는 것 허용
const SETTLE_MS = 380;    // 진입 애니메이션이 끝난 뒤 재야 실제 크기가 나온다

function findChromium() {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  const roots = [process.env.PLAYWRIGHT_BROWSERS_PATH, '/opt/pw-browsers'].filter(Boolean);
  for (const root of roots) {
    if (!fs.existsSync(root)) continue;
    for (const dir of fs.readdirSync(root)) {
      for (const rel of ['chrome-linux/headless_shell', 'chrome-linux/chrome']) {
        const p = path.join(root, dir, rel);
        if (fs.existsSync(p)) return p;
      }
    }
    const bare = path.join(root, 'chromium');
    if (fs.existsSync(bare)) return bare;
  }
  return null;                // playwright 기본 경로에 맡긴다
}

function arg(flag) {
  const i = process.argv.indexOf(flag);
  return i > -1 ? process.argv[i + 1] : null;
}

(async () => {
  const target = process.argv[2];
  if (!target || target.startsWith('--')) {
    console.error('사용법: node check_responsive.js <url|file://...> [--states states.js] [--shots dir]');
    process.exit(2);
  }
  const statesPath = arg('--states');
  const shotDir = arg('--shots');
  const states = statesPath
    ? require(path.resolve(statesPath))
    : [{ name: '기본' }];
  if (shotDir) fs.mkdirSync(shotDir, { recursive: true });

  let chromium;
  try { ({ chromium } = require('playwright')); }
  catch (e) {
    console.error('playwright를 못 찾았습니다. 설치돼 있는 디렉터리를 알려주거나 설치하세요:\n' +
      '  NODE_PATH=/어딘가/node_modules node check_responsive.js …\n' +
      '  또는  npm i playwright   (브라우저가 이미 있으면 PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1)');
    process.exit(2);
  }
  const exe = findChromium();
  const browser = await chromium.launch(exe ? { executablePath: exe } : {});
  const fails = [];

  for (const w of WIDTHS) {
    const ctx = await browser.newContext({ viewport: { width: w, height: 820 }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', e => errs.push(String(e)));
    page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
    await page.goto(target, { waitUntil: 'load' });

    for (const st of states) {
      if (st.js) {
        try { await page.evaluate(st.js); }
        catch (e) { fails.push(`w=${w} ${st.name} 상태 전환 실패 :: ${e.message}`); continue; }
      }
      await page.waitForTimeout(SETTLE_MS);

      const r = await page.evaluate(minTouch => {
        const de = document.documentElement;
        const over = de.scrollWidth - de.clientWidth;
        const bad = [];
        if (over > 0) {
          document.querySelectorAll('body *').forEach(el => {
            const b = el.getBoundingClientRect();
            if (!(b.right > de.clientWidth + 1 && b.width > 0 && el.offsetParent !== null)) return;
            // 가로 스크롤 컨테이너 안이면 정상
            let p = el.parentElement, scrollable = false;
            while (p) {
              if (/auto|scroll/.test(getComputedStyle(p).overflowX)) { scrollable = true; break; }
              p = p.parentElement;
            }
            if (!scrollable) bad.push(el.tagName + '.' + el.className + ' right=' + Math.round(b.right));
          });
        }
        const small = [];
        // 진짜 버튼뿐 아니라 눌리는 모든 것 — div[onclick], role=button, tabindex 도 본다
        const TAPPABLE = 'button, select, input, textarea, a[href], [role="button"], ' +
                         '[onclick], [tabindex]:not([tabindex="-1"])';
        document.querySelectorAll(TAPPABLE).forEach(el => {
          const b = el.getBoundingClientRect();
          if (b.width === 0 && b.height === 0) return;          // 숨겨진 것
          if (el.querySelector(TAPPABLE)) return;                // 눌리는 것을 감싼 껍데기
          if (b.height < minTouch) {
            small.push(el.tagName + '.' + (el.className || '') + ' h=' + b.height.toFixed(1) +
              ' "' + (el.textContent || '').trim().slice(0, 16) + '"');
          }
        });
        return { over, bad: bad.slice(0, 4), small: small.slice(0, 4), len: document.body.innerHTML.length };
      }, MIN_TOUCH);

      const tag = `w=${w} ${st.name}`;
      if (r.over > 0) fails.push(`${tag} 가로넘침 ${r.over}px :: ${r.bad.join(' | ') || '(범인 못 찾음 — body 자체일 수 있음)'}`);
      if (r.small.length && w < 1024) fails.push(`${tag} 터치타깃 40px 미만 :: ${r.small.join(' | ')}`);
      if (r.len < 200) fails.push(`${tag} 화면이 비어 있음`);

      if (shotDir) {
        const safe = `${w}_${st.name}`.replace(/[^\w가-힣.-]+/g, '_');
        await page.screenshot({ path: path.join(shotDir, safe + '.png'), fullPage: false });
      }
    }
    if (errs.length) fails.push(`w=${w} JS 오류 :: ${[...new Set(errs)].slice(0, 5).join(' || ')}`);
    await ctx.close();
  }
  await browser.close();

  if (fails.length) {
    console.log(fails.slice(0, 60).join('\n'));
    console.log('\n실패 %d건', fails.length);
    process.exit(1);
  }
  console.log('ALL CLEAN — %d개 폭 × %d개 화면, 실패 0', WIDTHS.length, states.length);
})();
