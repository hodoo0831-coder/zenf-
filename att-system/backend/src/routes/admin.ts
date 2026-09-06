import { Env, requireUser, requireRole, json, audit, httpError } from '../lib/http';

// GET /api/rules?site=
export async function getRules(req: Request, env: Env): Promise<Response> {
  await requireUser(req, env);
  const site = new URL(req.url).searchParams.get('site')!;
  const r = await env.DB.prepare('SELECT * FROM rule_settings WHERE site=?').bind(site).first();
  return json(r ?? null);
}

// PUT /api/rules  { site, tol_min, day_max_h, week_max_h, ot_week_h, ot_month_h, gps_radius_m, auto_approve_days }
export async function putRules(req: Request, env: Env): Promise<Response> {
  const user = await requireUser(req, env);
  requireRole(user, ['sys']);
  const b = await req.json<any>();
  await env.DB.prepare(
    `INSERT INTO rule_settings (site, tol_min, day_max_h, week_max_h, ot_week_h, ot_month_h, gps_radius_m, auto_approve_days)
     VALUES (?,?,?,?,?,?,?,?)
     ON CONFLICT(site) DO UPDATE SET tol_min=excluded.tol_min, day_max_h=excluded.day_max_h, week_max_h=excluded.week_max_h,
       ot_week_h=excluded.ot_week_h, ot_month_h=excluded.ot_month_h, gps_radius_m=excluded.gps_radius_m, auto_approve_days=excluded.auto_approve_days`
  ).bind(b.site, b.tol_min, b.day_max_h, b.week_max_h, b.ot_week_h, b.ot_month_h, b.gps_radius_m, b.auto_approve_days).run();
  await audit(env, user.id, 'Rule 기준값 변경', b.site, JSON.stringify(b));
  return json({ ok: true, note: '다음 검증 실행부터 적용됩니다' });
}

// GET /api/codes
export async function listCodes(req: Request, env: Env): Promise<Response> {
  await requireUser(req, env);
  const rows = await env.DB.prepare('SELECT * FROM att_codes ORDER BY code').all();
  return json(rows.results);
}

// POST /api/codes/mapping  { site, rawLabel, code }  — F-J0102
export async function addMapping(req: Request, env: Env): Promise<Response> {
  const user = await requireUser(req, env);
  requireRole(user, ['jc', 'sys']);
  const { site, rawLabel, code } = await req.json<{ site: string; rawLabel: string; code: string }>();
  const cd = await env.DB.prepare('SELECT code FROM att_codes WHERE code=?').bind(code).first();
  if (!cd) throw httpError(400, `존재하지 않는 표준코드: ${code}`);
  await env.DB.prepare(
    `INSERT INTO code_mappings (site, raw_label, code) VALUES (?,?,?) ON CONFLICT(site, raw_label) DO UPDATE SET code=excluded.code`
  ).bind(site, rawLabel, code).run();
  await audit(env, user.id, '매핑 규칙 추가', `${site}: ${rawLabel}`, `→ ${code}`);
  return json({ ok: true, note: '검증을 다시 실행하면 V-10 오류가 해소됩니다' });
}

// GET /api/audit?site=  (site 필터는 target LIKE로 단순 처리 — TODO: 정교화)
export async function listAudit(req: Request, env: Env): Promise<Response> {
  const user = await requireUser(req, env);
  requireRole(user, ['sys', 'jc']);
  const rows = await env.DB.prepare('SELECT * FROM audit_log ORDER BY at DESC LIMIT 500').all();
  return json(rows.results);
}
