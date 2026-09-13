// ============================================================
// 근태원장 생성 + 자동 검증 (기능정의서 V-01 ~ V-12)
//   F-E0102/E0103  원본 → 대표값 (채널 우선순위, 최초 IN · 최종 OUT)
//   F-F0101~F0104  검증 규칙 실행, 예외 생성, 한도 검증
//   F-F0107        주52시간 사전 경고 (확정 + 잔여 계획)
// 기준값은 전부 rule_config에서 읽는다 — 하드코딩 금지 (F-J0101)
// ============================================================
import { toEpoch, mondayOf } from "./datetime";

export interface Env { DB: D1Database; }

export const RULES: Record<string, { name: string; level: "오류" | "경고" | "사전경고" }> = {
  "V-01": { name: "근태 미입력",     level: "오류" },
  "V-02": { name: "중복 입력",       level: "오류" },
  "V-03": { name: "대상 오류",       level: "오류" },
  "V-04": { name: "시간 이상치",     level: "오류" },
  "V-05": { name: "휴게 미차감",     level: "경고" },
  "V-06": { name: "주 52시간",       level: "사전경고" },
  "V-07": { name: "연장 한도",       level: "사전경고" },
  "V-08": { name: "계획 대비 이상",  level: "경고" },
  "V-09": { name: "연차 대조",       level: "경고" },
  "V-10": { name: "코드 미정의",     level: "오류" },
  "V-11": { name: "위치 이탈",       level: "경고" },
  "V-12": { name: "태그 결손",       level: "오류" },
};

const CHANNEL_PRIORITY: Record<string, number> = { zemos: 1, excel: 2, manual: 3, ocr: 4 };
const OFF_SHIFTS = new Set(["휴무", "연차", "반차", "휴일"]);

type Cfg = Record<string, number>;
async function loadCfg(db: D1Database): Promise<Cfg> {
  const rows = await db.prepare("SELECT rule_id, param_name, param_value FROM rule_config").all();
  const c: Cfg = {};
  for (const r of rows.results as any[]) c[`${r.rule_id}:${r.param_name}`] = Number(r.param_value);
  return c;
}
const cfg = (c: Cfg, k: string, d: number) => (Number.isFinite(c[k]) ? c[k] : d);

interface Raw { id: number; channel: string; emp_id: string; direction: "IN" | "OUT"; tagged_at: string; lat: number | null; lng: number | null; break_min?: number | null; }
interface Plan { emp_id: string; work_date: string; shift: string; planned_start: string | null; planned_end: string | null; planned_hours: number | null; }
interface Staff { emp_id: string; name: string; site: string; hired_at: string | null; terminated_at: string | null; }

const dateOf = (s: string) => s.slice(0, 10);
const shiftDate = (d: string, days: number) => new Date(toEpoch(`${d} 00:00:00`) + days * 86400000).toISOString().slice(0, 10);

/** 태그를 근무일에 귀속시킨다. 야간조의 익일 새벽 태그는 전일 근무일로 본다. */
function workDateOf(taggedAt: string, nightCutoffHour: number): string {
  const h = Number(taggedAt.slice(11, 13));
  const d = dateOf(taggedAt);
  return h < nightCutoffHour ? shiftDate(d, -1) : d;
}
function hoursBetween(a: string, b: string) { return (toEpoch(b) - toEpoch(a)) / 3600000; }
/** 휴게 차감(분). 4h 초과 30분, 8h 초과 60분 — 기준값은 설정 */
function breakFor(hours: number, c: Cfg) {
  if (hours > 8) return cfg(c, "V-05:break_per_8h_min", 60);
  if (hours > 4) return cfg(c, "V-05:break_per_4h_min", 30);
  return 0;
}

async function insertExc(db: D1Database, rule: string, emp: string, date: string, detail: object): Promise<boolean> {
  const dup = await db.prepare("SELECT id FROM exception WHERE rule_id=? AND emp_id=? AND work_date=? AND status!='rejected'")
    .bind(rule, emp, date).first();
  if (dup) return false;   // 동일 건 중복 생성 방지 (F-F0102) · 처리완료 상태 보존 (F-F0101)
  await db.prepare("INSERT INTO exception (rule_id, emp_id, work_date, level, detail) VALUES (?,?,?,?,?)")
    .bind(rule, emp, date, RULES[rule].level, JSON.stringify(detail)).run();
  return true;
}

export interface RunSummary {
  month: string; site: string; staff: number; ledger_rows: number;
  exceptions_created: number; by_rule: Record<string, number>; unmapped: number;
}

/** 원장 생성 + 검증. 원장 INSERT는 batch로 묶어 부분 반영을 막는다 (F-F0101) */
export async function runMonth(db: D1Database, month: string, site: string, asOf?: string): Promise<RunSummary> {
  const c = await loadCfg(db);
  const nightCut = cfg(c, "V-12:night_cutoff_hour", 4);

  const staffRows = (await db.prepare("SELECT emp_id, name, site, hired_at, terminated_at FROM staff WHERE site=? AND status!='terminated'").bind(site).all()).results as unknown as Staff[];
  const staffMap = new Map(staffRows.map(s => [s.emp_id, s]));
  const empIds = staffRows.map(s => s.emp_id);
  if (!empIds.length) return { month, site, staff: 0, ledger_rows: 0, exceptions_created: 0, by_rule: {}, unmapped: 0 };
  const ph = empIds.map(() => "?").join(",");

  const raws = (await db.prepare(
    `SELECT id, channel, emp_id, direction, tagged_at, lat, lng, json_extract(payload, '$.break_min') AS break_min FROM raw_record
     WHERE emp_id IN (${ph}) AND tagged_at >= ? AND tagged_at < datetime(?, '+1 month', '+1 day') ORDER BY tagged_at`
  ).bind(...empIds, `${month}-01 00:00:00`, `${month}-01`).all()).results as unknown as Raw[];

  const plans = (await db.prepare(
    `SELECT emp_id, work_date, shift, planned_start, planned_end, planned_hours FROM work_plan WHERE emp_id IN (${ph}) AND work_date LIKE ?`
  ).bind(...empIds, `${month}%`).all()).results as unknown as Plan[];
  const planMap = new Map(plans.map(p => [`${p.emp_id}|${p.work_date}`, p]));
  const codes = new Set(((await db.prepare("SELECT code FROM att_code WHERE in_use=1 AND erp_code IS NOT NULL").all()).results as any[]).map(r => r.code));

  // ---- 사번×근무일 귀속 ----
  // OUT은 '직전 미결 IN'의 근무일에 붙인다 (야간조 20:00→익일 05:00). 짝이 없거나 상한을 넘으면 시각 기준 규칙으로.
  const maxSpan = cfg(c, "V-04:max_daily_hours", 16);
  const groups = new Map<string, Raw[]>();
  const pendingIn = new Map<string, { wd: string; at: string }>();   // emp → 마지막 미결 IN
  let latestTag = `${month}-01`;
  for (const r of raws) {
    let wd: string;
    if (r.direction === "IN") { wd = workDateOf(r.tagged_at, nightCut); pendingIn.set(r.emp_id, { wd, at: r.tagged_at }); }
    else {
      const p = pendingIn.get(r.emp_id);
      if (p && hoursBetween(p.at, r.tagged_at) >= 0 && hoursBetween(p.at, r.tagged_at) <= maxSpan) { wd = p.wd; pendingIn.delete(r.emp_id); }
      else wd = workDateOf(r.tagged_at, nightCut);
    }
    if (!wd.startsWith(month)) continue;
    if (wd > latestTag) latestTag = wd;
    const k = `${r.emp_id}|${wd}`;
    (groups.get(k) || groups.set(k, []).get(k)!).push(r);
  }
  // V-01은 '이미 지난 날'만 판정한다. 기본 기준일 = 해당 월 마지막 태그일 (미래 계획일을 미입력으로 잡지 않는다)
  const cutoffDate = asOf ?? latestTag;

  const by: Record<string, number> = {};
  let created = 0, ledgerRows = 0;
  const bump = async (rule: string, emp: string, date: string, detail: object) => {
    if (await insertExc(db, rule, emp, date, detail)) { created++; by[rule] = (by[rule] || 0) + 1; }
  };
  const stmts: D1PreparedStatement[] = [];
  const ledgerHours = new Map<string, number>();
  const siteLat = c["SITE:lat"], siteLng = c["SITE:lng"];

  for (const [k, list] of groups) {
    const [emp, wd] = k.split("|");
    const st = staffMap.get(emp)!;
    const channels = new Set(list.map(r => r.channel));
    const best = Math.min(...list.map(r => CHANNEL_PRIORITY[r.channel] ?? 9));
    const rep = list.filter(r => (CHANNEL_PRIORITY[r.channel] ?? 9) === best);
    const repCh = rep[0].channel;
    // V-02 채널 충돌 — 자동 덮어쓰기 금지, 관리자가 선택
    if (channels.size > 1) await bump("V-02", emp, wd, { channels: [...channels], message: "복수 채널 기록 — 관리자가 대표값 선택 필요 (자동 덮어쓰기 금지)" });

    const ins = rep.filter(r => r.direction === "IN").sort((a, b) => a.tagged_at.localeCompare(b.tagged_at));
    const outs = rep.filter(r => r.direction === "OUT").sort((a, b) => a.tagged_at.localeCompare(b.tagged_at));
    const firstIn = ins[0]?.tagged_at ?? null;
    const lastOut = outs[outs.length - 1]?.tagged_at ?? null;
    const plan = planMap.get(k);

    if (st.hired_at && wd < st.hired_at) await bump("V-03", emp, wd, { message: `입사일(${st.hired_at}) 이전 근태` });
    if (st.terminated_at && wd > st.terminated_at) await bump("V-03", emp, wd, { message: `퇴사일(${st.terminated_at}) 이후 근태` });
    if ((firstIn && !lastOut) || (!firstIn && lastOut))
      await bump("V-12", emp, wd, { first_in: firstIn, last_out: lastOut, message: firstIn ? "출근 태그만 있고 퇴근 태그 없음" : "퇴근 태그만 있고 출근 태그 없음" });

    if (Number.isFinite(siteLat) && Number.isFinite(siteLng)) {
      const radius = cfg(c, "V-11:site_radius_m", 300);
      for (const r of rep) {
        if (r.lat == null || r.lng == null) continue;
        const dLat = (r.lat - siteLat) * 111320, dLng = (r.lng - siteLng) * 111320 * Math.cos(siteLat * Math.PI / 180);
        const dist = Math.hypot(dLat, dLng);
        if (dist > radius) { await bump("V-11", emp, wd, { distance_m: Math.round(dist), radius_m: radius, message: `태그 위치가 현장 반경 ${radius}m 밖 (측정 ${Math.round(dist)}m)` }); break; }
      }
    }

    let hours: number | null = null, brk = 0, code: string | null = null, status = "normal";
    if (firstIn && lastOut) {
      const gross = hoursBetween(firstIn, lastOut);
      if (gross < 0) { await bump("V-04", emp, wd, { message: "출근 시각이 퇴근 시각보다 늦음", first_in: firstIn, last_out: lastOut }); status = "exception"; }
      else {
        const required = breakFor(gross, c);
        const declared = rep.map(r => (r as any).break_min).find((v: unknown) => Number.isFinite(v)) as number | undefined;
        brk = declared ?? required;                 // 원천(제모스·엑셀)이 휴게를 선언하면 그 값을, 아니면 규칙대로 자동 차감
        hours = Math.round((gross - brk / 60) * 100) / 100;
        const maxH = cfg(c, "V-04:max_daily_hours", 16);
        if (hours > maxH) { await bump("V-04", emp, wd, { work_hours: hours, max: maxH, message: `1일 근무 ${hours}h — 상한 ${maxH}h 초과` }); status = "exception"; }
        if (declared != null && declared < required) await bump("V-05", emp, wd, { gross: Math.round(gross * 100) / 100, break_min: declared, required_min: required, message: `${Math.round(gross * 10) / 10}h 근무에 휴게 ${declared}분만 반영 (기준 ${required}분)` });
        code = "W01";
        if (plan && plan.planned_start && !OFF_SHIFTS.has(plan.shift)) {
          const tol = cfg(c, "V-08:tolerance_min", 10);
          const lateMin = (toEpoch(firstIn) - toEpoch(`${wd} ${plan.planned_start}:00`)) / 60000;
          if (lateMin > tol) { code = "L01"; await bump("V-08", emp, wd, { late_min: Math.round(lateMin), message: `계획 출근 ${plan.planned_start} 대비 ${Math.round(lateMin)}분 지각` }); }
          if (plan.planned_end) {
            const endAt = plan.planned_end < plan.planned_start ? `${shiftDate(wd, 1)} ${plan.planned_end}:00` : `${wd} ${plan.planned_end}:00`;
            const earlyMin = (toEpoch(endAt) - toEpoch(lastOut)) / 60000;
            if (earlyMin > tol) { if (code !== "L01") code = "L02"; await bump("V-08", emp, wd, { early_min: Math.round(earlyMin), message: `계획 퇴근 ${plan.planned_end} 대비 ${Math.round(earlyMin)}분 조퇴` }); }
          }
        }
      }
    }
    if (!plan) await bump("V-08", emp, wd, { message: "계획 없는 근무 — 근무계획 미등록 상태에서 태그 발생", tags: list.length });
    else if (OFF_SHIFTS.has(plan.shift) && list.length) await bump("V-09", emp, wd, { shift: plan.shift, message: `${plan.shift} 신청 상태인데 출퇴근 태그 존재` });
    if (code && !codes.has(code)) { await bump("V-10", emp, wd, { code, message: `근태코드 ${code}가 매핑 테이블에 없음` }); status = "exception"; }
    if (hours != null) ledgerHours.set(k, hours);

    stmts.push(db.prepare(
      `INSERT INTO ledger (emp_id, work_date, channel, first_in, last_out, work_hours, break_min, att_code, status, raw_ids)
       VALUES (?,?,?,?,?,?,?,?,?,?)
       ON CONFLICT(emp_id, work_date) DO UPDATE SET channel=excluded.channel, first_in=excluded.first_in, last_out=excluded.last_out,
         work_hours=excluded.work_hours, break_min=excluded.break_min, att_code=excluded.att_code, raw_ids=excluded.raw_ids,
         status=excluded.status, updated_at=datetime('now')
       WHERE ledger.stage != 'fixed'`
    ).bind(emp, wd, repCh, firstIn, lastOut, hours, brk, code, status, JSON.stringify(rep.map(r => r.id))));
    ledgerRows++;
  }

  // V-01 미입력 · 휴무/연차 원장행
  for (const p of plans) {
    const k = `${p.emp_id}|${p.work_date}`;
    if (groups.has(k)) continue;
    if (OFF_SHIFTS.has(p.shift)) {
      const code = p.shift === "연차" ? "A01" : p.shift === "반차" ? "A02" : null;
      stmts.push(db.prepare(`INSERT INTO ledger (emp_id, work_date, channel, att_code, work_hours, status) VALUES (?,?,'plan',?,?,'normal') ON CONFLICT(emp_id, work_date) DO NOTHING`)
        .bind(p.emp_id, p.work_date, code, code === "A01" ? 8 : code === "A02" ? 4 : 0));
      ledgerRows++; continue;
    }
    if (p.work_date <= cutoffDate) await bump("V-01", p.emp_id, p.work_date, { shift: p.shift, message: "근무 계획일인데 근태 기록 없음 — 결근 자동 처리 금지, 반장 확인" });
  }
  for (let i = 0; i < stmts.length; i += 100) await db.batch(stmts.slice(i, i + 100));

  // ---- V-06 / V-07 주간 한도 — 실적 + 잔여 계획 → '초과 예상' (F-F0107 사전 경고) ----
  const limit = cfg(c, "V-06:weekly_limit_hours", 52), warn = cfg(c, "V-06:warn_ratio", 0.9), otLimit = cfg(c, "V-07:weekly_ot_limit", 12);
  const weekly = new Map<string, { actual: number; plan: number; lastDate: string }>();
  for (const [k, h] of ledgerHours) {
    const [emp, wd] = k.split("|"); const wk = `${emp}|${mondayOf(wd)}`;
    const w = weekly.get(wk) || { actual: 0, plan: 0, lastDate: wd };
    w.actual += h; if (wd > w.lastDate) w.lastDate = wd; weekly.set(wk, w);
  }
  for (const p of plans) {
    if (OFF_SHIFTS.has(p.shift) || ledgerHours.has(`${p.emp_id}|${p.work_date}`) || p.work_date <= cutoffDate) continue;
    const wk = `${p.emp_id}|${mondayOf(p.work_date)}`;
    const w = weekly.get(wk) || { actual: 0, plan: 0, lastDate: p.work_date };
    w.plan += p.planned_hours ?? 8; weekly.set(wk, w);
  }
  for (const [wk, w] of weekly) {
    const [emp, monday] = wk.split("|");
    const expected = Math.round((w.actual + w.plan) * 10) / 10;
    if (expected > limit) await bump("V-06", emp, w.lastDate, { week_start: monday, actual: w.actual, remaining_plan: w.plan, expected, limit, remaining_allowed: Math.max(0, Math.round((limit - w.actual) * 10) / 10), message: `주 누적 ${w.actual}h + 잔여 계획 ${w.plan}h = ${expected}h → ${limit}h 초과 예상` });
    else if (expected >= limit * warn) await bump("V-06", emp, w.lastDate, { week_start: monday, expected, limit, message: `주 누적 예상 ${expected}h — 한도의 ${Math.round(warn * 100)}% 도달` });
    const ot = Math.max(0, expected - 40);
    if (ot > otLimit) await bump("V-07", emp, w.lastDate, { week_start: monday, ot_expected: ot, limit: otLimit, message: `주 연장 예상 ${ot}h — 한도 ${otLimit}h 초과` });
  }

  const unmapped = (await db.prepare("SELECT COUNT(*) AS n FROM unmapped_key WHERE status='open' AND work_date LIKE ?").bind(`${month}%`).first<{ n: number }>())?.n ?? 0;
  await db.prepare("INSERT INTO audit_log (actor, action, target, detail) VALUES ('SYSTEM','validate.run',?,?)")
    .bind(`${month}|${site}`, JSON.stringify({ ledger_rows: ledgerRows, exceptions_created: created, by_rule: by })).run();
  return { month, site, staff: staffRows.length, ledger_rows: ledgerRows, exceptions_created: created, by_rule: by, unmapped };
}
