export interface Env {
  DB: D1Database;
  JEMOS_MODE: string;
  ERP_MODE: string;
  // DEV 일 때만 X-User-Id 헤더 인증을 허용한다. 운영에서는 반드시 비워두거나 PROD.
  AUTH_MODE?: string;
}

// §1-1 역할 4개: 근로자(worker) / 현장관리자(mgr) / J·C(jc) / 시스템관리자(sys).
// 본사인사·고객사 역할은 J/C로 통합됨(문서 각주) — 별도 role 없음.
export interface AuthedUser { id: string; name: string; role: 'mgr' | 'jc' | 'sys' | 'worker'; site: string | null; }

/* 세션 토큰으로 사용자를 확인한다 (Authorization: Bearer <token>).
   X-User-Id 헤더는 AUTH_MODE=DEV 일 때만 받는다 — 헤더는 누구나 바꿔 보낼 수
   있으므로 그것만으로는 인증이 아니다. 운영 설정에서 DEV 를 켜지 말 것. */
export async function requireUser(req: Request, env: Env): Promise<AuthedUser> {
  const auth = req.headers.get('Authorization') || '';
  if (auth.startsWith('Bearer ')) {
    const token = auth.slice(7).trim();
    const digest = await sha256Hex(token);
    const row = await env.DB.prepare(
      `SELECT u.id, u.name, u.role, u.site
         FROM sessions s JOIN users u ON u.id = s.user_id
        WHERE s.token_hash = ? AND s.expires_at > datetime('now') AND u.active = 1`
    ).bind(digest).first<AuthedUser>();
    if (!row) throw httpError(401, '세션이 만료되었습니다. 다시 로그인하세요.');
    return row;
  }

  if (env.AUTH_MODE === 'DEV') {
    const uid = req.headers.get('X-User-Id');
    if (uid) {
      const row = await env.DB.prepare('SELECT id, name, role, site FROM users WHERE id=? AND active=1')
        .bind(uid).first<AuthedUser>();
      if (row) return row;
    }
  }
  throw httpError(401, '로그인이 필요합니다.');
}

async function sha256Hex(v: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(v));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

export function requireRole(user: AuthedUser, roles: AuthedUser['role'][]) {
  if (!roles.includes(user.role)) throw httpError(403, `이 작업은 ${roles.join('/')} 권한이 필요합니다 (현재: ${user.role})`);
}

/** 필수 쿼리 파라미터. 빠지면 500 이 아니라 400 으로 이유를 말해준다. */
export function reqParam(url: URL, name: string): string {
  const v = url.searchParams.get(name);
  if (!v) throw httpError(400, `${name} 파라미터가 필요합니다.`);
  return v;
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
