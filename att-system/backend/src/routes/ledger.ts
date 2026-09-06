import { Env, requireUser, requireRole, json, audit, httpError } from '../lib/http';

// GET /api/ledger?site=&ym=&empId=(옵션)
export async function listLedger(req: Request, env: Env): Promise<Response> {
  await requireUser(req, env);
  const url = new URL(req.url);
  const site = url.searchParams.get('site')!, ym = url.searchParams.get('ym')!;
  const empId = url.searchParams.get('empId');
  let q = `SELECT l.* FROM ledger l JOIN employees e ON e.emp_id=l.emp_id WHERE e.site=? AND l.wdate LIKE ?`;
  const binds: any[] = [site, ym + '%'];
  if (empId) { q += ' AND l.emp_id=?'; binds.push(empId); }
  q += ' ORDER BY l.wdate, l.emp_id';
  const rows = await env.DB.prepare(q).bind(...binds).all();
  return json(rows.results);
}

// GET /api/ledger/:id/history
export async function ledgerHistory(req: Request, env: Env, id: string): Promise<Response> {
  await requireUser(req, env);
  const rows = await env.DB.prepare('SELECT * FROM ledger_history WHERE ledger_id=? ORDER BY at DESC').bind(id).all();
  return json(rows.results);
}

// POST /api/ledger/:id/confirm  { code, inHM, outHM, reason }
// F-G0203: 확정값 보정(원본 보존). 사유 없으면 저장 차단. 이력 append.
export async function confirmLedger(req: Request, env: Env, id: string): Promise<Response> {
  const user = await requireUser(req, env);
  requireRole(user, ['mgr', 'jc', 'sys']);
  if (user.role === 'sys') throw httpError(403, '시스템관리자는 운영 데이터를 만들지 않습니다');

  const body = await req.json<{ code: string; inMin: number | null; outMin: number | null; reason: string }>();
  if (!body.reason?.trim()) throw httpError(400, '보정 사유는 필수입니다');

  const before = await env.DB.prepare('SELECT * FROM ledger WHERE id=?').bind(id).first<any>();
  if (!before) throw httpError(404, '대상 근태 건 없음');

  const beforeSnap = JSON.stringify({ code: before.confirmed_code ?? before.proposed_code, in: before.confirmed_in ?? before.proposed_in, out: before.confirmed_out ?? before.proposed_out });
  const afterSnap = JSON.stringify({ code: body.code, in: body.inMin, out: body.outMin });

  await env.DB.prepare(
    `UPDATE ledger SET confirmed_code=?, confirmed_in=?, confirmed_out=?, status='수정됨' WHERE id=?`
  ).bind(body.code, body.inMin, body.outMin, id).run();

  await env.DB.prepare(
    `INSERT INTO ledger_history (ledger_id, by_user, before_json, after_json, reason) VALUES (?,?,?,?,?)`
  ).bind(id, user.id, beforeSnap, afterSnap, body.reason).run();

  await env.DB.prepare(`UPDATE ledger_conflicts SET resolved=1 WHERE ledger_id=?`).bind(id).run();

  await audit(env, user.id, '확정값 보정', `ledger#${id} (${before.emp_id} ${before.wdate})`, `${beforeSnap} → ${afterSnap} / ${body.reason}`);
  return json({ ok: true, note: '보정 저장 완료 — 원본은 변경되지 않았습니다. /api/validate를 다시 실행해 재검증하세요.' });
}

// POST /api/ledger/manual  { empId, date, code, inMin, outMin, reason }  — 관리자 대행 입력 (F-D0106)
export async function manualEntry(req: Request, env: Env): Promise<Response> {
  const user = await requireUser(req, env);
  requireRole(user, ['mgr', 'jc']);
  const b = await req.json<{ empId: string; date: string; code: string; inMin: number | null; outMin: number | null; reason: string }>();
  if (!b.reason?.trim()) throw httpError(400, '입력 사유는 필수입니다');

  await env.DB.prepare(
    `INSERT INTO ledger (emp_id, wdate, channel, source_ref, raw_payload, proposed_code, proposed_in, proposed_out, status)
     VALUES (?,?,'수기',?,?,?,?,?,'제안')
     ON CONFLICT(emp_id, wdate, channel) DO UPDATE SET proposed_code=excluded.proposed_code, proposed_in=excluded.proposed_in, proposed_out=excluded.proposed_out`
  ).bind(b.empId, b.date, `관리자 대행 입력 — ${user.name}`, JSON.stringify({ 입력자: user.id, 사유: b.reason }), b.code, b.inMin, b.outMin).run();

  await audit(env, user.id, '수기 입력(대행)', `${b.empId} ${b.date}`, `${b.code} / ${b.reason} — 대행입력 태그`);
  return json({ ok: true, tag: '대행입력' });
}
