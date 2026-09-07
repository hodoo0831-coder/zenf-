import { Env, json, httpError, audit } from '../lib/http';
import { hashPassword, newSalt, newToken, tokenHash, safeEqual, sessionExpiry, PW_ITER } from '../lib/auth';

/* POST /api/auth/login  { id, password }
   성공하면 세션 토큰을 준다. 이후 요청은 Authorization: Bearer <token> 을 붙인다.

   아이디가 없을 때와 비밀번호가 틀렸을 때 같은 메시지·같은 작업량을 쓴다.
   응답이 다르면 어떤 아이디가 실재하는지 알려주는 셈이 된다. */
export async function login(req: Request, env: Env): Promise<Response> {
  const body = await req.json<{ id?: string; password?: string }>().catch(() => ({} as any));
  const id = (body.id || '').trim();
  const password = body.password || '';
  if (!id || !password) throw httpError(400, '아이디와 비밀번호를 입력하세요.');

  const row = await env.DB.prepare(
    'SELECT id, name, role, site, pw_hash, pw_salt, pw_iter, must_change FROM users WHERE id=? AND active=1'
  ).bind(id).first<any>();

  // 없는 아이디라도 해싱을 한 번 돌려 응답 시간을 비슷하게 맞춘다
  const salt = row?.pw_salt || 'no-such-user-placeholder-salt';
  const iter = row?.pw_iter || PW_ITER;
  const calc = await hashPassword(password, salt, iter);

  if (!row || !row.pw_hash || !safeEqual(calc, row.pw_hash)) {
    throw httpError(401, '아이디 또는 비밀번호가 올바르지 않습니다.');
  }

  const token = newToken();
  await env.DB.prepare(
    'INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?,?,?)'
  ).bind(await tokenHash(token), row.id, sessionExpiry()).run();
  await env.DB.prepare("UPDATE users SET last_login_at=datetime('now') WHERE id=?").bind(row.id).run();
  await audit(env, row.id, '로그인', row.id, '');

  return json({
    token,
    user: { id: row.id, name: row.name, role: row.role, site: row.site },
    mustChangePassword: !!row.must_change,
  });
}

/** POST /api/auth/logout — 이 토큰만 지운다. 다른 기기 세션은 살려둔다. */
export async function logout(req: Request, env: Env): Promise<Response> {
  const token = bearer(req);
  if (token) await env.DB.prepare('DELETE FROM sessions WHERE token_hash=?').bind(await tokenHash(token)).run();
  return json({ ok: true });
}

/** GET /api/auth/me — 새로고침 후 세션이 아직 살아 있는지 확인하는 용도 */
export async function me(req: Request, env: Env): Promise<Response> {
  const u = await userFromSession(req, env);
  if (!u) throw httpError(401, '세션이 만료되었습니다. 다시 로그인하세요.');
  return json({ user: u });
}

/* POST /api/auth/password  { current, next }
   본인 비밀번호만 바꾼다. 남의 것을 바꾸는 기능은 여기 없다 —
   초기화가 필요하면 시스템관리자가 별도 절차로 처리한다. */
export async function changePassword(req: Request, env: Env): Promise<Response> {
  const u = await userFromSession(req, env);
  if (!u) throw httpError(401, '로그인이 필요합니다.');
  const body = await req.json<{ current?: string; next?: string }>().catch(() => ({} as any));
  const next = body.next || '';
  if (next.length < 8) throw httpError(400, '새 비밀번호는 8자 이상이어야 합니다.');

  const row = await env.DB.prepare('SELECT pw_hash, pw_salt, pw_iter FROM users WHERE id=?')
    .bind(u.id).first<any>();
  const calc = await hashPassword(body.current || '', row.pw_salt, row.pw_iter);
  if (!safeEqual(calc, row.pw_hash)) throw httpError(401, '현재 비밀번호가 올바르지 않습니다.');

  const salt = newSalt();
  await env.DB.prepare('UPDATE users SET pw_hash=?, pw_salt=?, pw_iter=?, must_change=0 WHERE id=?')
    .bind(await hashPassword(next, salt), salt, PW_ITER, u.id).run();
  // 비밀번호가 바뀌면 다른 기기 세션은 모두 끊는다
  await env.DB.prepare('DELETE FROM sessions WHERE user_id=?').bind(u.id).run();
  await audit(env, u.id, '비밀번호 변경', u.id, '전 세션 로그아웃');
  return json({ ok: true });
}

export function bearer(req: Request): string | null {
  const h = req.headers.get('Authorization') || '';
  return h.startsWith('Bearer ') ? h.slice(7).trim() : null;
}

/** 토큰 → 사용자. 만료됐거나 없으면 null. */
export async function userFromSession(req: Request, env: Env) {
  const token = bearer(req);
  if (!token) return null;
  const row = await env.DB.prepare(
    `SELECT u.id, u.name, u.role, u.site
       FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = ? AND s.expires_at > datetime('now') AND u.active = 1`
  ).bind(await tokenHash(token)).first<any>();
  return row || null;
}

/** 만료 세션 청소 — 로그인할 때 곁다리로 부른다. 별도 크론이 필요 없다. */
export async function sweepSessions(env: Env) {
  await env.DB.prepare("DELETE FROM sessions WHERE expires_at <= datetime('now')").run();
}
