import { Env, requireUser, requireRole, json, audit, httpError } from '../lib/http';

// GET /api/corrections?site=&ym=&status=
export async function listCorrections(req: Request, env: Env): Promise<Response> {
  await requireUser(req, env);
  const url = new URL(req.url);
  const site = url.searchParams.get('site')!, ym = url.searchParams.get('ym') ?? '', status = url.searchParams.get('status');
  let q = `SELECT c.* FROM correction_requests c JOIN employees e ON e.emp_id=c.emp_id WHERE e.site=?`;
  const binds: any[] = [site];
  if (ym) { q += ' AND c.wdate LIKE ?'; binds.push(ym + '%'); }
  if (status) { q += ' AND c.status=?'; binds.push(status); }
  q += ' ORDER BY c.requested_at DESC';
  const rows = await env.DB.prepare(q).bind(...binds).all();
  return json(rows.results);
}

// POST /api/corrections/:id/approve  { reason? }
// 승인되면 F-G0203(확정값 보정)으로 이어진다 — ledger.confirmed_* 갱신 + 이력 기록.
export async function approveCorrection(req: Request, env: Env, id: string): Promise<Response> {
  const user = await requireUser(req, env);
  requireRole(user, ['mgr', 'jc']);
  const c = await env.DB.prepare('SELECT * FROM correction_requests WHERE id=?').bind(id).first<any>();
  if (!c) throw httpError(404, '대상 정정요청 없음');
  if (c.status !== '승인대기') throw httpError(400, '이미 처리된 요청입니다');

  let ledgerId = c.ledger_id;
  if (!ledgerId) {
    // 미수집 일자에 대한 요청 — 수기 채널로 신규 레코드 생성
    await env.DB.prepare(
      `INSERT INTO ledger (emp_id, wdate, channel, source_ref, raw_payload, proposed_code, proposed_in, proposed_out, status)
       VALUES (?,?,'수기',?,?,?,?,?,'제안')
       ON CONFLICT(emp_id, wdate, channel) DO NOTHING`
    ).bind(c.emp_id, c.wdate, `정정요청#${c.id} 승인 반영`, JSON.stringify({ from: 'correction_request', id: c.id }), c.requested_code, c.requested_in, c.requested_out).run();
    const row = await env.DB.prepare(`SELECT id FROM ledger WHERE emp_id=? AND wdate=? AND channel='수기'`).bind(c.emp_id, c.wdate).first<{ id: number }>();
    ledgerId = row!.id;
  }

  const before = await env.DB.prepare('SELECT * FROM ledger WHERE id=?').bind(ledgerId).first<any>();
  const beforeSnap = JSON.stringify({ code: before.confirmed_code ?? before.proposed_code, in: before.confirmed_in ?? before.proposed_in, out: before.confirmed_out ?? before.proposed_out });
  const afterSnap = JSON.stringify({ code: c.requested_code, in: c.requested_in, out: c.requested_out });

  await env.DB.prepare(`UPDATE ledger SET confirmed_code=?, confirmed_in=?, confirmed_out=?, status='수정됨' WHERE id=?`)
    .bind(c.requested_code, c.requested_in, c.requested_out, ledgerId).run();
  await env.DB.prepare(`INSERT INTO ledger_history (ledger_id, by_user, before_json, after_json, reason) VALUES (?,?,?,?,?)`)
    .bind(ledgerId, user.id, beforeSnap, afterSnap, `정정요청 승인 — ${c.reason}`).run();
  await env.DB.prepare(`UPDATE correction_requests SET status='승인', reviewed_by=?, reviewed_at=datetime('now') WHERE id=?`).bind(user.id, id).run();

  await audit(env, user.id, '정정요청 승인', `correction#${id} (${c.emp_id} ${c.wdate})`, `${beforeSnap} → ${afterSnap}`);
  return json({ ok: true, note: '확정값에 반영됨 — 재검증하세요' });
}

// POST /api/corrections/:id/reject  { note }
export async function rejectCorrection(req: Request, env: Env, id: string): Promise<Response> {
  const user = await requireUser(req, env);
  requireRole(user, ['mgr', 'jc']);
  const { note } = await req.json<{ note: string }>();
  if (!note?.trim()) throw httpError(400, '반려 사유는 필수입니다');
  await env.DB.prepare(`UPDATE correction_requests SET status='반려', reviewed_by=?, reviewed_at=datetime('now'), review_note=? WHERE id=?`)
    .bind(user.id, note, id).run();
  await audit(env, user.id, '정정요청 반려', `correction#${id}`, note);
  return json({ ok: true });
}

// GET /api/ot-requests?site=&ym=&status=
export async function listOtRequests(req: Request, env: Env): Promise<Response> {
  await requireUser(req, env);
  const url = new URL(req.url);
  const site = url.searchParams.get('site')!, ym = url.searchParams.get('ym') ?? '', status = url.searchParams.get('status');
  let q = `SELECT o.* FROM ot_requests o JOIN employees e ON e.emp_id=o.emp_id WHERE e.site=?`;
  const binds: any[] = [site];
  if (ym) { q += ' AND o.wdate LIKE ?'; binds.push(ym + '%'); }
  if (status) { q += ' AND o.status=?'; binds.push(status); }
  q += ' ORDER BY o.requested_at DESC';
  const rows = await env.DB.prepare(q).bind(...binds).all();
  return json(rows.results);
}

// POST /api/ot-requests/:id/approve — 현장관리자 ◆ (F-G0103). 승인된 건만 V-14에서 빠진다.
export async function approveOt(req: Request, env: Env, id: string): Promise<Response> {
  const user = await requireUser(req, env);
  requireRole(user, ['mgr']);
  await env.DB.prepare(`UPDATE ot_requests SET status='승인', reviewed_by=?, reviewed_at=datetime('now') WHERE id=? AND status='승인대기'`)
    .bind(user.id, id).run();
  await audit(env, user.id, '연장근로 승인', `ot#${id}`, '');
  return json({ ok: true, note: '재검증하면 V-14에서 제외됩니다' });
}

export async function rejectOt(req: Request, env: Env, id: string): Promise<Response> {
  const user = await requireUser(req, env);
  requireRole(user, ['mgr']);
  await env.DB.prepare(`UPDATE ot_requests SET status='반려', reviewed_by=?, reviewed_at=datetime('now') WHERE id=? AND status='승인대기'`)
    .bind(user.id, id).run();
  await audit(env, user.id, '연장근로 반려', `ot#${id}`, '');
  return json({ ok: true });
}
