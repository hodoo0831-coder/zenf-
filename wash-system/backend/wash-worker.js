// ============================================
// wash-db Worker v2 - state blob sync
// 세척실 AI 통합 시스템 백엔드
// Bindings 필요: DB (D1 database, name: wash-data)
// ============================================

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400'
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json;charset=UTF-8', ...CORS }
  });
}

let _stateTableChecked = false;
async function ensureStateTable(env) {
  if (_stateTableChecked) return;
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS state_blob (
      id TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `).run();
  _stateTableChecked = true;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    if (method === 'OPTIONS') {
      return new Response(null, { headers: CORS });
    }

    try {
      if (path === '/' || path === '/health') {
        return json({ ok: true, service: 'wash-db', version: 2, ts: Date.now() });
      }

      // ==========================================
      // GET /api/state - 앱 전체 상태 blob 조회
      // ==========================================
      if (path === '/api/state' && method === 'GET') {
        await ensureStateTable(env);
        const row = await env.DB.prepare(
          `SELECT data, updated_at FROM state_blob WHERE id = 'current'`
        ).first();

        if (!row) {
          return json({
            ok: true,
            data: { waiting: {}, washing: {}, records: [] },
            updatedAt: 0,
            ts: Date.now()
          });
        }
        return json({
          ok: true,
          data: JSON.parse(row.data),
          updatedAt: row.updated_at,
          ts: Date.now()
        });
      }

      // ==========================================
      // POST /api/state - 앱 전체 상태 저장
      // Body: { waiting: {}, washing: {}, records: [] }
      // ==========================================
      if (path === '/api/state' && method === 'POST') {
        await ensureStateTable(env);
        const body = await request.json();
        const { waiting = {}, washing = {}, records = [] } = body;
        const dataStr = JSON.stringify({ waiting, washing, records });
        const now = Date.now();

        await env.DB.prepare(`
          INSERT INTO state_blob (id, data, updated_at)
          VALUES ('current', ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            data = excluded.data,
            updated_at = excluded.updated_at
        `).bind(dataStr, now).run();

        return json({ ok: true, updatedAt: now });
      }

      // POST /api/state/clear - 상태 초기화
      if (path === '/api/state/clear' && method === 'POST') {
        await ensureStateTable(env);
        await env.DB.prepare(`DELETE FROM state_blob WHERE id = 'current'`).run();
        return json({ ok: true });
      }

      return json({ ok: false, error: 'not found', path }, 404);
    } catch (err) {
      return json({ ok: false, error: err.message, stack: err.stack }, 500);
    }
  }
};
