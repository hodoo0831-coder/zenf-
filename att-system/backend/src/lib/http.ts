export interface Env {
  DB: D1Database;
  JEMOS_MODE: string;
  ERP_MODE: string;
}

// TODO: 실제 로그인 붙기 전까지 X-User-Id 헤더로 사용자를 식별한다.
// F-A0103 개편: 근로자 로그인 없음 — users 테이블은 관리자/J·C/시스템관리자/본사인사만 담는다.
// §1-1 역할 4개: 근로자(worker) / 현장관리자(mgr) / J·C(jc) / 시스템관리자(sys).
// 본사인사·고객사 역할은 J/C로 통합됨(문서 각주) — 별도 role 없음.
export interface AuthedUser { id: string; name: string; role: 'mgr' | 'jc' | 'sys' | 'worker'; site: string | null; }

export async function requireUser(req: Request, env: Env): Promise<AuthedUser> {
  const uid = req.headers.get('X-User-Id');
  if (!uid) throw httpError(401, '로그인이 필요합니다 (X-User-Id 헤더 누락 — 실제 SSO 연동 전 임시 인증)');
  const row = await env.DB.prepare('SELECT id, name, role, site FROM users WHERE id=? AND active=1').bind(uid).first<AuthedUser>();
  if (!row) throw httpError(401, '유효하지 않은 사용자');
  return row;
}

export function requireRole(user: AuthedUser, roles: AuthedUser['role'][]) {
  if (!roles.includes(user.role)) throw httpError(403, `이 작업은 ${roles.join('/')} 권한이 필요합니다 (현재: ${user.role})`);
}

export class HttpError extends Error { constructor(public status: number, message: string) { super(message); } }
export function httpError(status: number, message: string) { return new HttpError(status, message); }

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8' } });
}
export function errJson(e: unknown): Response {
  if (e instanceof HttpError) return json({ error: e.message }, e.status);
  console.error(e);
  return json({ error: e instanceof Error ? e.message : String(e) }, 500);
}

export async function audit(env: Env, by: string, action: string, target: string, detail: string) {
  await env.DB.prepare('INSERT INTO audit_log (by_user, action, target, detail) VALUES (?,?,?,?)')
    .bind(by, action, target, detail).run();
}
