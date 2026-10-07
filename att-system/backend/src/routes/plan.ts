import { Env, requireUser, requireRole, json, audit, httpError } from '../lib/http';

// GET /api/plan?site=&ym=
export async function listPlan(req: Request, env: Env): Promise<Response> {
  await requireUser(req, env);
  const url = new URL(req.url);
  const site = url.searchParams.get('site')!, ym = url.searchParams.get('ym')!;
  const rows = await env.DB.prepare(
    `SELECT wp.* FROM work_plans wp JOIN employees e ON e.emp_id=wp.emp_id WHERE e.site=? AND wp.wdate LIKE ? ORDER BY wp.emp_id, wp.wdate`
  ).bind(site, ym + '%').all();
  return json(rows.results);
}

// PUT /api/plan  { empId, date, planCode, planIn, planOut, reason? }
// F-C0103: 당일 이후만 변경 가능(과거 소급은 사유 필수) / 마감월은 변경 불가
export async function setPlan(req: Request, env: Env): Promise<Response> {
  const user = await requireUser(req, env);
  requireRole(user, ['mgr', 'jc']);
  const b = await req.json<{ empId: string; date: string; planCode: string; planIn: number | null; planOut: number | null; reason?: string }>();

  const emp = await env.DB.prepare('SELECT site FROM employees WHERE emp_id=?').bind(b.empId).first<{ site: string }>();
  if (!emp) throw httpError(404, '대상 사원 없음');
  const ym = b.date.slice(0, 7);
  const ms = await env.DB.prepare('SELECT stage FROM month_status WHERE site=? AND ym=?').bind(emp.site, ym).first<{ stage: string }>();
  if (ms?.stage === '마감' || ms?.stage === 'ERP확정') throw httpError(400, '마감된 월의 근무계획은 변경할 수 없습니다');

  const today = new Date().toISOString().slice(0, 10);
  if (b.date < today && !b.reason?.trim()) throw httpError(400, '과거 소급 변경은 사유가 필수입니다');

  await env.DB.prepare(
    `INSERT INTO work_plans (emp_id, wdate, plan_code, plan_in, plan_out) VALUES (?,?,?,?,?)
     ON CONFLICT(emp_id, wdate) DO UPDATE SET plan_code=excluded.plan_code, plan_in=excluded.plan_in, plan_out=excluded.plan_out`
  ).bind(b.empId, b.date, b.planCode, b.planIn, b.planOut).run();

  await audit(env, user.id, '근무계획 변경', `${b.empId} ${b.date}`, `${b.planCode} ${b.reason ? '/ ' + b.reason : ''} (재검증 대상)`);
  return json({ ok: true });
}

// GET /api/plan/simulate?site=&ym=  — F-C0105 주52시간 사전 시뮬레이션 (계획만으로)
export async function simulatePlan(req: Request, env: Env): Promise<Response> {
  await requireUser(req, env);
  const url = new URL(req.url);
  const site = url.searchParams.get('site')!, ym = url.searchParams.get('ym')!;
  const rows = (await env.DB.prepare(
    `SELECT wp.emp_id, wp.wdate, wp.plan_code FROM work_plans wp JOIN employees e ON e.emp_id=wp.emp_id WHERE e.site=? AND wp.wdate LIKE ?`
  ).bind(site, ym + '%').all()).results as any[];
  const rules = await env.DB.prepare('SELECT week_max_h FROM rule_settings WHERE site=?').bind(site).first<{ week_max_h: number }>();
  const cap = rules?.week_max_h ?? 52;

  const byEmpWeek = new Map<string, number>();
  for (const r of rows) {
    if (r.plan_code !== 'WK' && r.plan_code !== 'HW') continue;
    const d = new Date(r.wdate + 'T00:00:00');
    const dow = (d.getDay() + 6) % 7;
    d.setDate(d.getDate() - dow);
    const key = `${r.emp_id}|${d.toISOString().slice(0, 10)}`;
    byEmpWeek.set(key, (byEmpWeek.get(key) ?? 0) + 8);
  }
  const over = [...byEmpWeek.entries()].filter(([, h]) => h > cap).map(([k, h]) => {
    const [empId, week] = k.split('|');
    return { empId, week, hours: h, cap };
  });
  return json({ cap, overCount: over.length, over });
}
