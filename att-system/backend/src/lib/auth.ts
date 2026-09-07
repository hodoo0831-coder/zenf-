/* 로그인 · 세션
   ------------------------------------------------------------------
   지금까지는 X-User-Id 헤더 하나로 사람을 구분했다. 헤더는 누구나 바꿔 보낼 수
   있으니 그건 식별이지 인증이 아니었다. 여기서 비밀번호 확인과 세션을 붙인다.

   설계 의도
   - 비밀번호는 PBKDF2-SHA256(10만회)로만 저장한다. 평문·역산 가능한 형태로는
     어디에도 남기지 않는다. Workers에는 bcrypt가 없고 WebCrypto는 네이티브라
     PBKDF2가 현실적인 선택이다.
   - 세션 토큰은 DB에 원문이 아니라 SHA-256 해시로 넣는다. DB가 통째로 유출돼도
     그 값으로 로그인할 수는 없다.
   - 제모스 SSO가 확정되면 verifyPassword 자리만 갈아끼운다. 나머지 코드는
     "세션이 유효한가"만 보므로 건드릴 필요가 없다 (제모스·ERP 어댑터와 같은 방식).
*/

const ITER = 100000;
const SESSION_HOURS = 12;

const enc = new TextEncoder();

function toHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

function randomHex(bytes: number): string {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return [...a].map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function hashPassword(pw: string, salt: string, iter = ITER): Promise<string> {
  const key = await crypto.subtle.importKey('raw', enc.encode(pw), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: enc.encode(salt), iterations: iter, hash: 'SHA-256' }, key, 256);
  return toHex(bits);
}

export function newSalt(): string { return randomHex(16); }
export function newToken(): string { return randomHex(32); }

export async function tokenHash(token: string): Promise<string> {
  return toHex(await crypto.subtle.digest('SHA-256', enc.encode(token)));
}

/** 길이가 달라도 같은 시간을 쓰도록 — 비교 시간으로 값을 유추하지 못하게 한다. */
export function safeEqual(a: string, b: string): boolean {
  const len = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < len; i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

export function sessionExpiry(): string {
  return new Date(Date.now() + SESSION_HOURS * 3600 * 1000).toISOString().replace('T', ' ').slice(0, 19);
}

export const PW_ITER = ITER;
export const PW_SESSION_HOURS = SESSION_HOURS;
