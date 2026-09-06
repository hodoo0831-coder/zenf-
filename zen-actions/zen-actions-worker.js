/**
 * ZEN 조치 공유 — Cloudflare Worker (D1)
 * 플랫폼의 조치 티켓·이력을 사업장 단위로 공유한다.
 *
 * 왜 필요한가
 *   조치는 localStorage 에만 남아 있었다. 담당자를 지정해도 그 사람 화면에는
 *   아무것도 뜨지 않고, 다른 PC 에서 열면 보드가 비어 있었다.
 *   '담당·기한이 붙은 티켓'이라면 최소한 같은 사업장 안에서는 같은 보드를 봐야 한다.
 *
 * 설계 원칙
 *   - 로컬 우선(local-first). 플랫폼은 localStorage 로 그대로 동작하고,
 *     서버는 그 위에 얹는 동기화 계층이다. 서버가 없거나 끊겨도 조치는 계속 된다.
 *   - 한 번의 왕복으로 push + pull. /api/sync 하나로 끝낸다.
 *   - 충돌은 ts(마지막 수정시각) 비교로 나중 것이 이긴다. 조치 보드 규모에서는
 *     이걸로 충분하고, 사람이 이해하기도 쉽다.
 *   - 이력(actlog)은 append-only. 같은 회차가 두 번 올라와도 PK 로 무시된다.
 *
 * ── 배포 ────────────────────────────────────────────────────
 * 1) D1 생성:      wrangler d1 create zen-actions
 * 2) wrangler.toml 의 database_id 채우기
 * 3) 스키마 적용:  wrangler d1 execute zen-actions --remote --file=schema.sql
 * 4) 배포:         wrangler deploy
 * 5) 플랫폼 → 기준·연동 → 조치 공유 에 배포 주소 입력
 * ────────────────────────────────────────────────────────────
 * 엔드포인트
 *   GET  /api/health
 *   GET  /api/actions?site=            현재 티켓 + 최근 이력 (읽기 전용)
 *   POST /api/sync                     {site, by, actions:{k:{…}}, actlog:[…]}
 *                                      → 병합 후 서버 전체 상태 반환
 *   POST /api/reset  {site}            해당 사업장 전체 삭제 (운영 초기화용)
 */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};
const json = (o, s = 200) =>
  new Response(JSON.stringify(o), { status: s, headers: { "Content-Type": "application/json; charset=utf-8", ...CORS } });
const bad = (m, s = 400) => json({ ok: false, error: m }, s);
const now = () => Date.now();
const num = (v) => (Number.isFinite(+v) ? +v : null);
const str = (v, n = 400) => (v == null ? "" : String(v).slice(0, n));

const LOG_LIMIT = 300;   // 반환할 최근 이력 건수
const MAX_ACTIONS = 200; // 한 번에 올릴 수 있는 티켓 수
const MAX_LOGS = 200;

export default {
  async fetch(req, env) {
    if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
    const url = new URL(req.url);
    const p = url.pathname.replace(/\/+$/, "");
    try {
      await ensure(env);

      if (p === "/api/health") return json({ ok: true, time: now() });

      if (p === "/api/actions") {
        const site = str(url.searchParams.get("site") || "default", 120);
        return json({ ok: true, site, ...(await readAll(env, site)) });
      }

      if (p === "/api/sync" && req.method === "POST") {
        const b = await req.json();
        const site = str(b.site || "default", 120);
        const by = str(b.by || "", 80);
        const actions = b.actions && typeof b.actions === "object" ? b.actions : {};
        const logs = Array.isArray(b.actlog) ? b.actlog : [];

        const keys = Object.keys(actions).slice(0, MAX_ACTIONS);
        if (keys.length) {
          /* 들어온 티켓의 현재 ts 를 한 번에 읽어 비교 — 나중 수정본만 반영 */
          const marks = keys.map(() => "?").join(",");
          const cur = await env.DB.prepare(
            `SELECT k, ts FROM actions WHERE site=? AND k IN (${marks})`
          ).bind(site, ...keys).all();
          const seen = {};
          for (const r of cur.results || []) seen[r.k] = r.ts || 0;

          const stmts = [];
          for (const k of keys) {
            const a = actions[k] || {};
            const ts = num(a.ts) || now();
            if ((seen[k] || 0) >= ts) continue;      // 서버 쪽이 더 최신이면 건너뛴다
            stmts.push(
              env.DB.prepare(
                `INSERT INTO actions (site,k,area,title,rule,st,owner,due,note,what,txt,seq,verify,cleared,opened_at,done_at,ts,by)
                 VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
                 ON CONFLICT(site,k) DO UPDATE SET
                   area=excluded.area, title=excluded.title, rule=excluded.rule, st=excluded.st,
                   owner=excluded.owner, due=excluded.due, note=excluded.note, what=excluded.what,
                   txt=excluded.txt, seq=excluded.seq, verify=excluded.verify, cleared=excluded.cleared,
                   opened_at=excluded.opened_at, done_at=excluded.done_at, ts=excluded.ts, by=excluded.by`
              ).bind(
                site, str(k, 200), str(a.area, 40), str(a.title, 300), str(a.rule, 300),
                str(a.st || "todo", 12), str(a.owner, 80), num(a.due), str(a.note, 500),
                str(a.what, 500), str(a.txt, 2000), num(a.seq) || 1, str(a.verify, 12),
                a.cleared ? 1 : 0, num(a.openedAt), num(a.doneAt), ts, by
              )
            );
          }
          if (stmts.length) await env.DB.batch(stmts);
        }

        if (logs.length) {
          const stmts = logs.slice(0, MAX_LOGS).map((e) => {
            const closed = num(e.closedAt) || now();
            const id = `${site}|${str(e.k, 200)}|${num(e.seq) || 1}|${closed}`;
            return env.DB.prepare(
              `INSERT OR IGNORE INTO actlog
               (id,site,k,area,title,rule,seq,owner,what,outcome,opened_at,done_at,closed_at,overdue,by)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
            ).bind(
              id, site, str(e.k, 200), str(e.area, 40), str(e.r, 300), str(e.rule, 300),
              num(e.seq) || 1, str(e.owner, 80), str(e.what, 500), str(e.outcome, 40),
              num(e.openedAt), num(e.doneAt), closed, e.overdue ? 1 : 0, by
            );
          });
          await env.DB.batch(stmts);
        }

        return json({ ok: true, site, at: now(), ...(await readAll(env, site)) });
      }

      if (p === "/api/reset" && req.method === "POST") {
        const b = await req.json();
        const site = str(b.site || "", 120);
        if (!site) return bad("site 필요");
        await env.DB.batch([
          env.DB.prepare(`DELETE FROM actions WHERE site=?`).bind(site),
          env.DB.prepare(`DELETE FROM actlog WHERE site=?`).bind(site),
        ]);
        return json({ ok: true, site });
      }

      return bad("not found", 404);
    } catch (e) {
      return bad(String((e && e.message) || e), 500);
    }
  },
};

async function readAll(env, site) {
  const a = await env.DB.prepare(`SELECT * FROM actions WHERE site=?`).bind(site).all();
  const l = await env.DB.prepare(
    `SELECT * FROM actlog WHERE site=? ORDER BY closed_at DESC LIMIT ${LOG_LIMIT}`
  ).bind(site).all();
  const actions = {};
  for (const r of a.results || []) {
    actions[r.k] = {
      area: r.area, title: r.title, rule: r.rule, st: r.st, owner: r.owner,
      due: r.due, note: r.note, what: r.what, txt: r.txt, seq: r.seq,
      verify: r.verify || null, cleared: !!r.cleared,
      openedAt: r.opened_at, doneAt: r.done_at, ts: r.ts, by: r.by,
    };
  }
  const actlog = (l.results || []).map((r) => ({
    k: r.k, area: r.area, r: r.title, rule: r.rule, seq: r.seq, owner: r.owner,
    what: r.what, outcome: r.outcome, openedAt: r.opened_at, doneAt: r.done_at,
    closedAt: r.closed_at, overdue: !!r.overdue, by: r.by,
  })).reverse();          /* 플랫폼은 오래된 것부터 담아 두므로 순서를 맞춘다 */
  return { actions, actlog };
}

let ready = false;
async function ensure(env) {
  if (ready) return;
  await env.DB.batch([
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS actions (
      site TEXT NOT NULL, k TEXT NOT NULL,
      area TEXT, title TEXT, rule TEXT, st TEXT DEFAULT 'todo',
      owner TEXT, due INTEGER, note TEXT, what TEXT, txt TEXT,
      seq INTEGER DEFAULT 1, verify TEXT, cleared INTEGER DEFAULT 0,
      opened_at INTEGER, done_at INTEGER, ts INTEGER, by TEXT,
      PRIMARY KEY (site, k))`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS actlog (
      id TEXT PRIMARY KEY, site TEXT NOT NULL, k TEXT,
      area TEXT, title TEXT, rule TEXT, seq INTEGER, owner TEXT,
      what TEXT, outcome TEXT, opened_at INTEGER, done_at INTEGER,
      closed_at INTEGER, overdue INTEGER, by TEXT)`),
    env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_actlog_site ON actlog(site, closed_at DESC)`),
  ]);
  ready = true;
}
