import { Env, requireUser, json, audit, httpError, requireRole } from '../lib/http';
import { runValidation, Employee, LedgerRow, PlanRow, Rules } from '../lib/validate';

function daysOfMonth(ym: string): string[] {
  const [y, m] = ym.split('-').map(Number);
  const n = new Date(y, m, 0).getDate();
  return Array.from({ length: n }, (_, i) => `${ym}-${String(i + 1).padStart(2, '0')}`);
}
function isWeekend(d: string) { const w = new Date(d + 'T00:00:00').getDay(); return w === 0 || w === 6; }

// POST /api/validate  { site, ym }
export async function validateMonth(req: Request, env: Env): Promise<Response> {
  const user = await requireUser(req, env);
  const { site, ym } = await req.json<{ site: string; ym: string }>();
  const days = daysOfMonth(ym);
  const runId = `${site}|${ym}|${Date.now()}`;

  const employees = (await env.DB.prepare(
    'SELECT emp_id, name, site, shift_default, hire_date, leave_date, jemos_active FROM employees WHERE site=?'
  ).bind(site).all<Employee>()).results;

  const ledgerRaw = (await env.DB.prepare(
    `SELECT l.*, (SELECT COUNT(*) FROM ledger_conflicts c WHERE c.ledger_id=l.id AND c.resolved=0) has_conflict
     FROM ledger l JOIN employees e ON e.emp_id=l.emp_id WHERE e.site=? AND l.wdate LIKE ?`
  ).bind(site, ym + '%').all<LedgerRow>()).results;

  const plans = (await env.DB.prepare(
    `SELECT wp.emp_id, wp.wdate, wp.plan_code, wp.plan_in, wp.plan_out FROM work_plans wp JOIN employees e ON e.emp_id=wp.emp_id WHERE e.site=? AND wp.wdate LIKE ?`
  ).bind(site, ym + '%').all<PlanRow>()).results;

  const approvedOt = (await env.DB.prepare(
    `SELECT ot.emp_id, ot.wdate FROM ot_requests ot JOIN employees e ON e.emp_id=ot.emp_id
     WHERE e.site=? AND ot.wdate LIKE ? AND ot.status='승인'`
  ).bind(site, ym + '%').all<{ emp_id: string; wdate: string }>()).results;

  const rulesRow = await env.DB.prepare('SELECT * FROM rule_settings WHERE site=?').bind(site).first<Rules>();
  if (!rulesRow) throw httpError(400, `${site}의 검증 Rule 기준값이 없습니다 — 시스템관리자가 먼저 등록해야 합니다`);

  const codes = (await env.DB.prepare('SELECT * FROM att_codes WHERE active=1').all()).results as any[];
  const codeMap = new Map(codes.map(c => [c.code, c]));
  const holidays = new Set((await env.DB.prepare('SELECT hdate FROM holidays WHERE site IN (?,?) AND hdate LIKE ?').bind(site, '*', ym + '%').all()).results.map((r: any) => r.hdate));

  const exceptions = runValidation({
    site, ym, days, employees, ledger: ledgerRaw, plans, rules: rulesRow, approvedOt,
    codeOf: c => codeMap.get(c), isHoliday: d => holidays.has(d), isWeekend,
  });

  // 이전 실행에서 처리완료(사유 기재) 된 건은 동일 키(rule+emp+date)면 상태 유지
  const prevDone = (await env.DB.prepare(
    `SELECT rule_id, emp_id, wdate, status, reason, by_user, at FROM exceptions
     WHERE emp_id IN (SELECT emp_id FROM employees WHERE site=?) AND status='처리완료'
     AND wdate LIKE ? OR (wdate IS NULL AND emp_id IN (SELECT emp_id FROM employees WHERE site=?))`
  ).bind(site, ym + '%', site).all()).results as any[];
  const doneKey = new Map(prevDone.map(r => [`${r.rule_id}|${r.emp_id}|${r.wdate ?? r.week_label}`, r]));

  const stmt = env.DB.prepare(
    `INSERT INTO exceptions (rule_id, grade, emp_id, wdate, week_label, message, status, reason, by_user, at, run_id) VALUES (?,?,?,?,?,?,?,?,?,?,?)`
  );
  const batch = exceptions.map(e => {
    const k = `${e.rule_id}|${e.emp_id}|${e.wdate ?? e.week_label}`;
    const prev = doneKey.get(k);
    return stmt.bind(e.rule_id, e.grade, e.emp_id, e.wdate, e.week_label, e.message,
      prev ? '처리완료' : '미처리', prev?.reason ?? null, prev?.by_user ?? null, prev?.at ?? null, runId);
  });
  if (batch.length) await env.DB.batch(batch);

  // 이 실행을 "현재 유효한" 검증 결과로 표시 (이전 run의 예외는 조회에서 제외 — 이력은 DB에 남되 숨김)
  await env.DB.prepare(
    `INSERT INTO month_status (site, ym, last_run_id) VALUES (?,?,?)
     ON CONFLICT(site, ym) DO UPDATE SET last_run_id=excluded.last_run_id`
  ).bind(site, ym, runId).run();

  // 정상/오류/경고 상태를 원장에 반영
  await env.DB.prepare(
    `UPDATE ledger SET status = CASE WHEN confirmed_code IS NOT NULL THEN '수정됨' ELSE '정상' END
     WHERE emp_id IN (SELECT emp_id FROM employees WHERE site=?) AND wdate LIKE ?`
  ).bind(site, ym + '%').run();
  const grading = env.DB.prepare(
    `UPDATE ledger SET status=? WHERE emp_id=? AND wdate=? AND status!='수정됨'`
  );
  const gradeBatch = exceptions.filter(e => e.wdate && exceptions_status_map[e.grade]).map(e =>
    grading.bind(e.grade === '오류' ? '오류' : '경고', e.emp_id, e.wdate)
  );
  if (gradeBatch.length) await env.DB.batch(gradeBatch);

  const errN = exceptions.filter(e => e.grade === '오류').length;
  const warnN = exceptions.filter(e => e.grade === '경고').length;

  // 자동승인 = 근태원장에 기록이 있고(제모스/엑셀/수기 무관) 예외가 하나도 안 걸린 건
  const flaggedDays = new Set(exceptions.filter(e => e.wdate).map(e => `${e.emp_id}|${e.wdate}`));
  const autoApproved = ledgerRaw.filter(r => !flaggedDays.has(`${r.emp_id}|${r.wdate}`)).length;

  await audit(env, user.id, '검증 실행', `${site} ${ym}`, `근태원장 ${ledgerRaw.length}건 · 오류 ${errN} · 경고 ${warnN} · 자동승인 ${autoApproved} · run=${runId}`);
  return json({ runId, ledgerCount: ledgerRaw.length, errN, warnN, autoApproved });
}
const exceptions_status_map = { '오류': true, '경고': true } as const;

// GET /api/exceptions?site=&ym=&status=&rule=
export async function listExceptions(req: Request, env: Env): Promise<Response> {
  await requireUser(req, env);
  const url = new URL(req.url);
  const site = url.searchParams.get('site')!, ym = url.searchParams.get('ym') ?? '';
  const status = url.searchParams.get('status');

  const ms = ym ? await env.DB.prepare('SELECT last_run_id FROM month_status WHERE site=? AND ym=?').bind(site, ym).first<{ last_run_id: string }>() : null;
  if (ym && !ms?.last_run_id) return json([]); // 아직 검증을 한 번도 실행하지 않음

  let q = `SELECT x.* FROM exceptions x JOIN employees e ON e.emp_id=x.emp_id WHERE e.site=?`;
  const binds: any[] = [site];
  if (ym) { q += ` AND x.run_id=?`; binds.push(ms!.last_run_id); }
  if (status) { q += ' AND x.status=?'; binds.push(status); }
  q += ' ORDER BY (x.grade=\'오류\') DESC, x.rule_id, x.wdate';
  const rows = await env.DB.prepare(q).bind(...binds).all();
  return json(rows.results);
}

// POST /api/exceptions/:id/resolve  { reason }
export async function resolveException(req: Request, env: Env, id: string): Promise<Response> {
  const user = await requireUser(req, env);
  requireRole(user, ['mgr', 'jc']);
  const { reason } = await req.json<{ reason: string }>();
  if (!reason?.trim()) throw httpError(400, '사유는 필수입니다');

  const ex = await env.DB.prepare('SELECT grade FROM exceptions WHERE id=?').bind(id).first<{ grade: string }>();
  if (!ex) throw httpError(404, '대상 예외 없음');
  if (ex.grade === '오류')
    throw httpError(400, '오류 등급은 사유만으로 통과할 수 없습니다 — /api/ledger/manual 또는 /api/ledger/:id/confirm 으로 실제 근태 기록을 보정한 뒤 재검증하세요');

  await env.DB.prepare(`UPDATE exceptions SET status='처리완료', reason=?, by_user=?, at=datetime('now') WHERE id=?`)
    .bind(reason, user.id, id).run();
  await audit(env, user.id, '경고 확인', `exception#${id}`, reason);
  return json({ ok: true });
}
