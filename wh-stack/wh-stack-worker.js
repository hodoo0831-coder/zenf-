/**
 * 포장재 창고 적치 관리 시스템 — Cloudflare Worker (D1)
 * 작업자 앱(입력) ↔ 관리자 시스템(확인)을 잇는 공용 API
 *
 * ── 배포 순서 ────────────────────────────────────────────────
 * 1) D1 생성:            wrangler d1 create wh-stack
 * 2) wrangler.toml 바인딩:
 *      [[d1_databases]]
 *      binding = "DB"
 *      database_name = "wh-stack"
 *      database_id = "<생성된 id>"
 * 3) 스키마 적용:        wrangler d1 execute wh-stack --remote --file=schema.sql
 * 4) 배포:               wrangler deploy
 *    (대시보드에서 만들 때도 동일 — Worker 코드 붙여넣고 D1 바인딩명 DB 로 연결)
 * ─────────────────────────────────────────────────────────────
 * 엔드포인트
 *   GET  /api/health
 *   GET  /api/state?date=YYYY-MM-DD            전 구역 제출 현황 + 로케이션 값
 *   GET  /api/zone?date=&zone=                 한 구역 값(작업자 앱 프리필)
 *   GET  /api/summary?date=                    구역별 합계(관리자 KPI용)
 *   GET  /api/dates                            최근 기준일 목록
 *   POST /api/submit                           작업자 제출(업서트)
 *        {date, zone, worker, note, items:[{loc, capa, qty}]}
 *   POST /api/confirm  {date, zone, by}        관리자 확인 처리
 *   POST /api/reopen   {date, zone}            확인 취소(재입력 허용)
 */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};
const json = (o, s = 200) =>
  new Response(JSON.stringify(o), { status: s, headers: { "Content-Type": "application/json; charset=utf-8", ...CORS } });
const bad = (m, s = 400) => json({ ok: false, error: m }, s);
const today = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10); // KST
const now = () => new Date(Date.now() + 9 * 3600e3).toISOString().replace("T", " ").slice(0, 19);

export default {
  async fetch(req, env) {
    if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
    const url = new URL(req.url);
    const p = url.pathname.replace(/\/+$/, "");
    try {
      await ensure(env);

      if (p === "/api/health") return json({ ok: true, time: now() });

      if (p === "/api/dates") {
        const r = await env.DB.prepare(
          `SELECT date, COUNT(*) AS zones, SUM(total) AS qty FROM submits GROUP BY date ORDER BY date DESC LIMIT 60`
        ).all();
        return json({ ok: true, dates: r.results || [] });
      }

      if (p === "/api/state") {
        const date = url.searchParams.get("date") || today();
        const s = await env.DB.prepare(`SELECT * FROM submits WHERE date=?`).bind(date).all();
        const k = await env.DB.prepare(`SELECT zone, loc, capa, qty FROM stock WHERE date=?`).bind(date).all();
        const items = {};
        for (const r of k.results || []) (items[r.zone] = items[r.zone] || []).push(r);
        return json({ ok: true, date, submits: s.results || [], items });
      }

      if (p === "/api/zone") {
        const date = url.searchParams.get("date") || today();
        const zone = url.searchParams.get("zone");
        if (!zone) return bad("zone 필요");
        const s = await env.DB.prepare(`SELECT * FROM submits WHERE date=? AND zone=?`).bind(date, zone).first();
        const k = await env.DB.prepare(`SELECT loc, capa, qty FROM stock WHERE date=? AND zone=?`).bind(date, zone).all();
        return json({ ok: true, date, zone, submit: s || null, items: k.results || [] });
      }

      if (p === "/api/summary") {
        const date = url.searchParams.get("date") || today();
        const r = await env.DB.prepare(
          `SELECT zone, SUM(qty) AS qty, SUM(capa) AS capa, COUNT(*) AS locs FROM stock WHERE date=? GROUP BY zone`
        ).bind(date).all();
        return json({ ok: true, date, zones: r.results || [] });
      }

      if (p === "/api/submit" && req.method === "POST") {
        const b = await req.json();
        const date = b.date || today();
        if (!b.zone || !Array.isArray(b.items)) return bad("zone / items 필요");
        const locked = await env.DB.prepare(`SELECT status FROM submits WHERE date=? AND zone=?`).bind(date, b.zone).first();
        if (locked && locked.status === "confirmed") return bad("관리자 확인 완료 구역 — 재입력하려면 확인 취소 필요", 409);

        const stmts = [env.DB.prepare(`DELETE FROM stock WHERE date=? AND zone=?`).bind(date, b.zone)];
        let total = 0, capa = 0;
        for (const it of b.items) {
          const q = Math.max(0, Number(it.qty) || 0), c = Math.max(0, Number(it.capa) || 0);
          total += q; capa += c;
          stmts.push(
            env.DB.prepare(`INSERT INTO stock (date,zone,loc,capa,qty,worker,updated_at) VALUES (?,?,?,?,?,?,?)`)
              .bind(date, b.zone, String(it.loc), c, q, b.worker || "", now())
          );
        }
        stmts.push(
          env.DB.prepare(
            `INSERT INTO submits (date,zone,worker,note,total,capa,locs,status,submitted_at)
             VALUES (?,?,?,?,?,?,?,'submitted',?)
             ON CONFLICT(date,zone) DO UPDATE SET
               worker=excluded.worker, note=excluded.note, total=excluded.total, capa=excluded.capa,
               locs=excluded.locs, status='submitted', submitted_at=excluded.submitted_at`
          ).bind(date, b.zone, b.worker || "", b.note || "", total, capa, b.items.length, now())
        );
        await env.DB.batch(stmts);
        return json({ ok: true, date, zone: b.zone, total, capa, at: now() });
      }

      if (p === "/api/confirm" && req.method === "POST") {
        const b = await req.json();
        const date = b.date || today();
        if (!b.zone) return bad("zone 필요");
        await env.DB.prepare(
          `UPDATE submits SET status='confirmed', confirmed_by=?, confirmed_at=? WHERE date=? AND zone=?`
        ).bind(b.by || "admin", now(), date, b.zone).run();
        return json({ ok: true });
      }

      if (p === "/api/purge" && req.method === "POST") {
        const b = await req.json();
        if (!b.date) return bad("date 필요");
        if (b.zone) {
          await env.DB.batch([
            env.DB.prepare(`DELETE FROM stock WHERE date=? AND zone=?`).bind(b.date, b.zone),
            env.DB.prepare(`DELETE FROM submits WHERE date=? AND zone=?`).bind(b.date, b.zone),
          ]);
          return json({ ok: true, date: b.date, zone: b.zone });
        }
        await env.DB.batch([
          env.DB.prepare(`DELETE FROM stock WHERE date=?`).bind(b.date),
          env.DB.prepare(`DELETE FROM submits WHERE date=?`).bind(b.date),
        ]);
        return json({ ok: true, date: b.date, scope: "all" });
      }

      if (p === "/api/reopen" && req.method === "POST") {
        const b = await req.json();
        const date = b.date || today();
        if (!b.zone) return bad("zone 필요");
        await env.DB.prepare(
          `UPDATE submits SET status='submitted', confirmed_by=NULL, confirmed_at=NULL WHERE date=? AND zone=?`
        ).bind(date, b.zone).run();
        return json({ ok: true });
      }

      return bad("not found", 404);
    } catch (e) {
      return bad(String(e && e.message || e), 500);
    }
  },
};

let ready = false;
async function ensure(env) {
  if (ready) return;
  await env.DB.batch([
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS stock (
      date TEXT NOT NULL, zone TEXT NOT NULL, loc TEXT NOT NULL,
      capa INTEGER DEFAULT 0, qty INTEGER DEFAULT 0, worker TEXT, updated_at TEXT,
      PRIMARY KEY (date, zone, loc))`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS submits (
      date TEXT NOT NULL, zone TEXT NOT NULL, worker TEXT, note TEXT,
      total INTEGER DEFAULT 0, capa INTEGER DEFAULT 0, locs INTEGER DEFAULT 0,
      status TEXT DEFAULT 'submitted', submitted_at TEXT, confirmed_by TEXT, confirmed_at TEXT,
      PRIMARY KEY (date, zone))`),
    env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_stock_date ON stock(date)`),
  ]);
  ready = true;
}
