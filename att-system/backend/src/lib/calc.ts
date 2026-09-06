// 근로시간 산출. 원본 로직은 근태자동화_기능데모_v2.html 의 calc()에서
// 검증 완료(30명·31일 시나리오, V-01~V-13 전건 재현) 후 그대로 이식.

export interface AttCode {
  code: string; counts_hours: boolean; erp_code?: string;
}
export interface CalcInput {
  code: string; in: number | null; out: number | null; brk: number | null;
}
export interface CalcResult {
  stay: number; brk: number; work: number; ot: number; night: number; hol: number;
}

const BREAKS: [number, number][] = [[4, 30], [8, 60]]; // [근로시간h 이상, 휴게분]
const STD_DAY_HOURS = 8;

const q = (x: number) => Math.floor(x * 2) / 2; // 30분 단위 절사

export function calc(
  v: CalcInput,
  isHolidayOrWeekend: boolean,
  codeOf: (c: string) => AttCode | undefined
): CalcResult {
  const zero = { stay: 0, brk: 0, work: 0, ot: 0, night: 0, hol: 0 };
  const cd = codeOf(v.code);
  if (v.in == null || v.out == null || !cd || !cd.counts_hours) return zero;

  let out = v.out;
  if (out < v.in) out += 1440; // 익일 퇴근(야간)
  const stay = (out - v.in) / 60;

  let brk = v.brk ?? 0;
  if (v.brk == null) for (const [h, b] of BREAKS) if (stay >= h) brk = b;

  const work = Math.max(0, stay - brk / 60);
  const holiday = isHolidayOrWeekend || v.code === 'HW';
  const ot = holiday ? 0 : q(Math.max(0, work - STD_DAY_HOURS));
  const hol = holiday ? q(work) : 0;

  let nightMin = 0;
  for (const [a, b] of [[1320, 1800], [-120, 360]] as [number, number][]) {
    nightMin += Math.max(0, Math.min(out, b) - Math.max(v.in, a));
  }
  const night = q(Math.max(0, nightMin / 60));

  return { stay, brk, work, ot, night, hol };
}

export function hm(min: number | null): string {
  if (min == null) return '—';
  const mm = ((min % 1440) + 1440) % 1440;
  const h = String(Math.floor(mm / 60)).padStart(2, '0');
  const m = String(mm % 60).padStart(2, '0');
  return `${h}:${m}${min >= 1440 ? '+1' : ''}`;
}

export function parseHM(s: string | null | undefined): number | null {
  if (!s) return null;
  const [h, m] = s.split(':').map(Number);
  return h * 60 + m;
}
