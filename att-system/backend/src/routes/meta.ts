// ── 조회 전용 메타 API (젠타임 콘솔 연결을 위해 추가) ──────────────────────
// 기존 라우트에는 사원·현장·사용자 목록을 내려주는 엔드포인트가 없어서
// 화면이 사번만 표시할 수 있었다. 표시에 필요한 최소 조회만 추가한다.
// 쓰기 없음 · 개인정보는 사번·성명·현장까지만.
import { Env, requireUser, json } from '../lib/http';

// GET /api/users — 로그인 계정 선택용 (SSO 연동 전 임시).
// 기존 프론트가 X-User-Id 를 하드코딩하던 것을 데이터로 대체한다.
// emp_id 는 근로자 계정이 본인 근태를 찾는 데 필요한 연결키다.
export async function listUsers(_req: Request, env: Env): Promise<Response> {
  const rows = await env.DB.prepare(
    'SELECT id, name, role, site, emp_id FROM users WHERE active=1 ORDER BY role, id'
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
