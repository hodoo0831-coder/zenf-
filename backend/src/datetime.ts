// ============================================================
// 태깅 시각 정규화 — 저장 포맷을 'YYYY-MM-DD HH:MM:SS' 하나로 고정한다.
//
// 왜 필요한가:
//   검증 쿼리는 SQLite 문자열 비교로 기간을 자른다. 같은 시각이라도
//   '2026-08-28T02:10:00'(ISO T)은 '2026-08-28 04:00:00'(상한선)보다 크게 비교되어
//   야간조의 익일 새벽 태깅이 조회 범위에서 통째로 빠진다.
//   → 결과적으로 야간조 전원이 V-02(퇴근 미태깅)로 오판된다.
//   수집 시점에 한 포맷으로 강제 정규화해서 원천 차단한다.
// ============================================================

/** 현장 표준시(KST) UTC 오프셋(분). 해외 사업장 확장 시 이 값만 조정한다. */
const SITE_UTC_OFFSET_MIN = 9 * 60;

const pad = (n: number, w = 2) => String(n).padStart(w, "0");

function fmtFromUtcParts(d: Date): string {
  return (
    `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ` +
    `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`
  );
}

/**
 * 다양한 입력 표기를 'YYYY-MM-DD HH:MM:SS'로 정규화한다.
 * - 타임존(Z 또는 ±HH:MM)이 붙은 값은 현장 표준시로 환산한다.
 * - 타임존이 없는 값은 이미 현장 시각으로 보고 자릿수만 맞춘다.
 * - 인식 불가한 값은 던진다 (조용히 통과시키면 마감 정산이 틀어진다).
 */
export function normalizeDt(input: unknown): string {
  const s = String(input ?? "").trim();
  if (!s) throw new Error("시각 값이 비어 있습니다");

  // 1) 명시적 타임존이 있는 경우 → 현장 표준시로 환산
  if (/(?:Z|[+-]\d{2}:?\d{2})$/.test(s)) {
    const ms = Date.parse(s.replace(" ", "T"));
    if (Number.isNaN(ms)) throw new Error(`시각 형식을 인식할 수 없습니다: ${s}`);
    return fmtFromUtcParts(new Date(ms + SITE_UTC_OFFSET_MIN * 60000));
  }

  // 2) 타임존 없는 값 → 자릿수만 정규화 (런타임 로컬 타임존에 의존하지 않는다)
  const m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})[ T](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?$/.exec(s);
  if (!m) throw new Error(`시각 형식을 인식할 수 없습니다: ${s}`);
  const [, y, mo, d, h, mi, sec] = m;
  const norm = `${y}-${pad(+mo)}-${pad(+d)} ${pad(+h)}:${pad(+mi)}:${pad(+(sec ?? 0))}`;

  // 존재하지 않는 날짜(2026-02-31 등) 차단
  const chk = new Date(`${norm.replace(" ", "T")}Z`);
  if (Number.isNaN(chk.getTime()) || fmtFromUtcParts(chk) !== norm) {
    throw new Error(`존재하지 않는 시각입니다: ${s}`);
  }
  return norm;
}

/** 'YYYY-MM-DD' 형식만 허용한다. */
export function normalizeDate(input: unknown): string {
  const s = String(input ?? "").trim();
  const m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(s);
  if (!m) throw new Error(`날짜 형식이 올바르지 않습니다 (YYYY-MM-DD): ${s}`);
  return `${m[1]}-${pad(+m[2])}-${pad(+m[3])}`;
}

/** 정규화된 시각 문자열을 epoch(ms)로. 런타임 타임존과 무관하게 동작한다. */
export function toEpoch(canonical: string): number {
  const ms = Date.parse(`${canonical.replace(" ", "T")}Z`);
  if (Number.isNaN(ms)) throw new Error(`시각 파싱 실패: ${canonical}`);
  return ms;
}

/** 해당 날짜가 속한 주의 월요일(YYYY-MM-DD). */
export function mondayOf(workDate: string): string {
  const base = toEpoch(`${workDate} 00:00:00`);
  const dow = (new Date(base).getUTCDay() + 6) % 7; // 0 = 월요일
  return new Date(base - dow * 86400000).toISOString().slice(0, 10);
}
