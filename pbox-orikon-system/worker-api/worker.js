// ═══════════════════════════════════════════════════════════
//  pbox-orikon-db  ·  완성본 Worker
//  GET  /records?system=P-BOX&limit=5000   조회
//  POST /records                           저장
//  DELETE /records/{id}                    삭제
//  GET  /health                            상태 진단
//
//  ※ D1 바인딩 이름과 테이블 이름을 자동으로 찾습니다.
//    (DB / D1 / MY_DB 무엇이든, work_records / records 무엇이든)
// ═══════════════════════════════════════════════════════════

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
};

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...CORS }
  });
}

// D1 바인딩 자동 탐색
function getDB(env) {
  for (const k of Object.keys(env)) {
    const v = env[k];
    if (v && typeof v.prepare === 'function') return v;
  }
  return null;
}

// 테이블 이름 자동 탐색 (이름에 record 가 들어간 테이블)
let TABLE = null;
async function getTable(db) {
  if (TABLE) return TABLE;
  const r = await db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
  ).all();
  const names = (r.results || []).map(x => x.name);
  TABLE = names.find(n => /record/i.test(n)) || names[0];
  return TABLE;
}

// 테이블에 실제 존재하는 컬럼만 추리기
let COLS = null;
async function getCols(db, table) {
  if (COLS) return COLS;
  const r = await db.prepare(`PRAGMA table_info(${table})`).all();
  COLS = (r.results || []).map(x => x.name);
  return COLS;
}

// 작업자 앱이 camelCase 로 보내도 받아들이도록 변환
const KEYMAP = {
  workerCount: 'worker_count',
  workType: 'work_type',
  qtyPlt: 'qty_plt',   qty: 'qty_plt',
  qtyEa: 'qty_ea',     ea: 'qty_ea',
  inputUnit: 'input_unit',
  startTime: 'start_time',
  endTime: 'end_time',
  manHour: 'man_hour',
  createdAt: 'created_at'
};
function normalize(body) {
  const out = {};
  for (const [k, v] of Object.entries(body || {})) {
    out[KEYMAP[k] || k] = v;
  }
  return out;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, '') || '/';
    const method = request.method;

    if (method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: { ...CORS, 'Access-Control-Max-Age': '86400' } });
    }

    const db = getDB(env);
    if (!db) return json({ ok: false, error: 'D1 바인딩을 찾을 수 없습니다' }, 500);

    try {
      const table = await getTable(db);
      if (!table) return json({ ok: false, error: '테이블을 찾을 수 없습니다' }, 500);

      // ── 상태 진단 ──
      if (path === '/health' || path === '/') {
        const c = await db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).first();
        return json({ ok: true, table, columns: await getCols(db, table), total: c?.n ?? 0 });
      }

      // ── 조회 ──
      if (method === 'GET' && path === '/records') {
        const system = url.searchParams.get('system');
        const limit = Math.min(parseInt(url.searchParams.get('limit') || '5000', 10) || 5000, 10000);
        const cols = await getCols(db, table);
        const orderBy = cols.includes('created_at') ? 'created_at DESC' : 'rowid DESC';

        let stmt;
        if (system && cols.includes('system')) {
          stmt = db.prepare(`SELECT * FROM ${table} WHERE system = ? ORDER BY ${orderBy} LIMIT ?`).bind(system, limit);
        } else {
          stmt = db.prepare(`SELECT * FROM ${table} ORDER BY ${orderBy} LIMIT ?`).bind(limit);
        }
        const r = await stmt.all();
        const records = r.results || [];
        return json({ ok: true, records, count: records.length });
      }

      // ── 저장 ──
      if (method === 'POST' && path === '/records') {
        const raw = await request.json().catch(() => null);
        if (!raw) return json({ ok: false, error: '본문이 비어 있습니다' }, 400);

        const body = normalize(raw);
        const cols = await getCols(db, table);

        if (!body.id) {
          const prefix = String(body.system || 'rec').toLowerCase().replace(/[^a-z0-9]/g, '') || 'rec';
          body.id = `${prefix}_${Date.now()}`;
        }
        if (!body.created_at && cols.includes('created_at')) {
          body.created_at = new Date().toISOString();
        }

        const use = cols.filter(c => body[c] !== undefined);
        if (!use.length) return json({ ok: false, error: '저장할 값이 없습니다' }, 400);

        const sql = `INSERT INTO ${table} (${use.join(',')}) VALUES (${use.map(() => '?').join(',')})`;
        await db.prepare(sql).bind(...use.map(c => body[c] ?? null)).run();

        return json({ ok: true, id: body.id });
      }

      // ── 삭제 ──
      if (method === 'DELETE' && path.startsWith('/records/')) {
        const id = decodeURIComponent(path.slice('/records/'.length));
        if (!id) return json({ ok: false, error: 'id 없음' }, 400);
        const res = await db.prepare(`DELETE FROM ${table} WHERE id = ?`).bind(id).run();
        return json({ ok: true, id, deleted: res.meta?.changes ?? 0 });
      }

      // ── 삭제 (호환용) ──
      if (method === 'POST' && path === '/records/delete') {
        const body = await request.json().catch(() => ({}));
        if (!body.id) return json({ ok: false, error: 'id 없음' }, 400);
        const res = await db.prepare(`DELETE FROM ${table} WHERE id = ?`).bind(body.id).run();
        return json({ ok: true, id: body.id, deleted: res.meta?.changes ?? 0 });
      }

      return json({ ok: false, error: `경로 없음: ${method} ${path}` }, 404);

    } catch (e) {
      return json({ ok: false, error: String(e && e.message || e) }, 500);
    }
  }
};
