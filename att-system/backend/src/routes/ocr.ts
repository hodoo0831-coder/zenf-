import { Env, requireUser, requireRole, json, audit, httpError } from '../lib/http';

// POST /api/ocr/uploads  { site, wdate, imageRef, recognized }
// 주의: 실제 OCR 인식 엔진은 이 백엔드에 없다. imageRef(스토리지 참조)와 recognized(인식 결과 후보, 프론트/외부 OCR 서비스가 채워서 보낸다고 가정)를
// 그대로 '검토대기'로 적재만 한다 — 사람이 확인하기 전에는 근태원장에 절대 반영되지 않는다.
export async function uploadOcr(req: Request, env: Env): Promise<Response> {
  const user = await requireUser(req, env);
  requireRole(user, ['mgr']);
  const b = await req.json<{ site: string; wdate?: string; imageRef: string; recognized?: any }>();
  if (!b.imageRef) throw httpError(400, 'imageRef(원본 이미지 참조)는 필수입니다 — 원본은 삭제 불가로 보관됩니다');
  await env.DB.prepare(
    `INSERT INTO ocr_uploads (site, wdate, image_ref, recognized, uploaded_by) VALUES (?,?,?,?,?)`
  ).bind(b.site, b.wdate ?? null, b.imageRef, JSON.stringify(b.recognized ?? null), user.id).run();
  await audit(env, user.id, 'OCR 이미지 업로드', b.site, b.imageRef);
  return json({ ok: true, status: '검토대기' });
}

// GET /api/ocr/uploads?site=&status=
export async function listOcr(req: Request, env: Env): Promise<Response> {
  await requireUser(req, env);
  const url = new URL(req.url);
  const site = url.searchParams.get('site')!, status = url.searchParams.get('status');
  let q = 'SELECT * FROM ocr_uploads WHERE site=?'; const binds: any[] = [site];
  if (status) { q += ' AND status=?'; binds.push(status); }
  q += ' ORDER BY uploaded_at DESC';
  const rows = await env.DB.prepare(q).bind(...binds).all();
  return json(rows.results);
}

// POST /api/ocr/uploads/:id/confirm  { empId, code, inMin, outMin, reason }
// 사람이 인식 결과를 확인·수정한 뒤 확정 — 이 시점에 비로소 근태원장(수기 채널)에 반영된다.
export async function confirmOcr(req: Request, env: Env, id: string): Promise<Response> {
  const user = await requireUser(req, env);
  requireRole(user, ['mgr']);
  const b = await req.json<{ empId: string; code: string; inMin: number | null; outMin: number | null; reason: string }>();
  if (!b.reason?.trim()) throw httpError(400, '확정 사유는 필수입니다');

  const up = await env.DB.prepare('SELECT * FROM ocr_uploads WHERE id=?').bind(id).first<any>();
  if (!up) throw httpError(404, '대상 없음');
  if (up.status !== '검토대기') throw httpError(400, '이미 처리된 건입니다');
  if (!up.wdate) throw httpError(400, '대상 일자가 지정되지 않았습니다 — 검토 화면에서 먼저 일자를 지정하세요');

  await env.DB.prepare(
    `INSERT INTO ledger (emp_id, wdate, channel, source_ref, raw_payload, proposed_code, proposed_in, proposed_out, status)
     VALUES (?,?,'수기',?,?,?,?,?,'제안')
     ON CONFLICT(emp_id, wdate, channel) DO UPDATE SET proposed_code=excluded.proposed_code, proposed_in=excluded.proposed_in, proposed_out=excluded.proposed_out`
  ).bind(b.empId, up.wdate, `OCR#${id} 확정 — ${user.name}`, JSON.stringify({ ocrId: id, imageRef: up.image_ref, recognized: up.recognized, reason: b.reason }), b.code, b.inMin, b.outMin).run();

  await env.DB.prepare(`UPDATE ocr_uploads SET status='확정', reviewed_by=?, reviewed_at=datetime('now') WHERE id=?`).bind(user.id, id).run();
  await audit(env, user.id, 'OCR 검토 확정', `ocr#${id} → ${b.empId} ${up.wdate}`, b.reason);
  return json({ ok: true, note: '원장에 반영됨 — 재검증하세요' });
}

export async function rejectOcr(req: Request, env: Env, id: string): Promise<Response> {
  const user = await requireUser(req, env);
  requireRole(user, ['mgr']);
  await env.DB.prepare(`UPDATE ocr_uploads SET status='반려', reviewed_by=?, reviewed_at=datetime('now') WHERE id=?`).bind(user.id, id).run();
  await audit(env, user.id, 'OCR 반려', `ocr#${id}`, '');
  return json({ ok: true });
}
