// ── 조회 전용 메타 API (젠타임 콘솔 연결을 위해 추가) ──────────────────────
// 기존 라우트에는 사원·현장·사용자 목록을 내려주는 엔드포인트가 없어서
// 화면이 사번만 표시할 수 있었다. 표시에 필요한 최소 조회만 추가한다.
// 쓰기 없음 · 개인정보는 사번·성명·현장까지만.
import { Env, requireUser, requireRole, json } from '../lib/http';

// GET /api/users — 계정 목록. 시스템관리자 전용.
// 로그인 화면에서 계정을 고르게 하던 용도였으나 실제 로그인이 붙으면서 그 쓰임은
// 사라졌다. 누가 계정을 갖고 있는지는 공개 정보가 아니므로 인증·권한을 건다.
export async function listUsers(req: Request, env: Env): Promise<Response> {
  const u = await requireUser(req, env);
  requireRole(u, ['sys']);
  const rows = await env.DB.prepare(
    'SELECT id, name, role, site, emp_id, active, last_login_at FROM users ORDER BY role, id'
  ).all();
  return json(rows.results);
}

// GET /api/sites — 현장 목록 + 검증 기준값 + 인원수
export async function listSites(req: Request, env: Env): Promise<Response> {
  await requireUser(req, env);
  const rows = await env.DB.prepare(
    `SELECT e.site,
            COUNT(*)                                   AS emp_count,
            SUM(CASE WHEN e.jemos_active=1 THEN 1 ELSE 0 END) AS jemos_count,
            r.tol_min, r.day_max_h, r.week_max_h, r.ot_week_h, r.ot_month_h,
            r.gps_radius_m, r.auto_approve_days
       FROM employees e
       LEFT JOIN rule_settings r ON r.site = e.site
      GROUP BY e.site
      ORDER BY e.site`
  ).all();
  return json(rows.results);
}

// GET /api/employees?site= — 사원 목록 (이름 표시용)
export async function listEmployees(req: Request, env: Env): Promise<Response> {
  await requireUser(req, env);
  const site = new URL(req.url).searchParams.get('site');
  const q = site
    ? env.DB.prepare('SELECT * FROM employees WHERE site=? ORDER BY emp_id').bind(site)
    : env.DB.prepare('SELECT * FROM employees ORDER BY site, emp_id');
  const rows = await q.all();
  return json(rows.results);
}

// GET /api/holidays?ym= — 휴일 캘린더 (F-B0203)
export async function listHolidays(req: Request, env: Env): Promise<Response> {
  await requireUser(req, env);
  const ym = new URL(req.url).searchParams.get('ym');
  const q = ym
    ? env.DB.prepare('SELECT * FROM holidays WHERE hdate LIKE ? ORDER BY hdate').bind(ym + '%')
    : env.DB.prepare('SELECT * FROM holidays ORDER BY hdate');
  const rows = await q.all();
  return json(rows.results);
}
