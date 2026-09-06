import { calc, AttCode } from './calc';

export interface Employee {
  emp_id: string; name: string; site: string; shift_default: string;
  hire_date: string | null; leave_date: string | null; jemos_active: number;
}
export interface LedgerRow {
  id: number; emp_id: string; wdate: string; channel: string; gps_status: string;
  proposed_code: string | null; proposed_in: number | null; proposed_out: number | null; proposed_brk: number | null;
  confirmed_code: string | null; confirmed_in: number | null; confirmed_out: number | null;
  has_conflict: number;
}
export interface PlanRow { emp_id: string; wdate: string; plan_code: string; plan_in?: number | null; plan_out?: number | null; }
export interface Rules {
  tol_min: number; day_max_h: number; week_max_h: number; ot_week_h: number; ot_month_h: number; gps_radius_m: number;
}
export interface Exception {
  rule_id: string; grade: '오류' | '경고'; emp_id: string; wdate: string | null; week_label: string | null; message: string;
}

// 기준: 근태시스템-메뉴및기능정의-v2.md §7 (V-01~V-15)
export const RULEDEF: Record<string, { name: string; grade: '오류' | '경고' }> = {
  'V-01': { name: '미입력', grade: '오류' },
  'V-02': { name: '중복', grade: '오류' },
  'V-03': { name: '대상 오류', grade: '오류' },
  'V-04': { name: '시간 이상치', grade: '오류' },
  'V-05': { name: '휴게 미차감', grade: '경고' },
  'V-06': { name: '주 52시간', grade: '경고' },
  'V-07': { name: '연장 한도', grade: '경고' },
  'V-08': { name: '계획 대비 이상', grade: '경고' },        // 계획 없는 근무 (지각·조퇴는 V-13으로 분리)
  'V-09': { name: '연차 대조', grade: '경고' },
  'V-10': { name: '코드 미정의', grade: '오류' },
  'V-11': { name: '위치 이탈', grade: '경고' },
  'V-12': { name: '태그 결손', grade: '오류' },
  'V-13': { name: '지각·조퇴', grade: '경고' },              // 신설 — 예정 대비 ±10분 초과
  'V-14': { name: '미승인 연장', grade: '경고' },            // 신설 — 연장 발생 && 승인 건 없음
  'V-15': { name: '채널 불일치', grade: '경고' },            // 구 V-13 (채널 충돌)에서 번호만 이동
};

const eff = (r: LedgerRow) => ({
  code: r.confirmed_code ?? r.proposed_code!,
  in: r.confirmed_code ? r.confirmed_in : r.proposed_in,
  out: r.confirmed_code ? r.confirmed_out : r.proposed_out,
});

function mondayOf(dateStr: string): Date {
  const d = new Date(dateStr + 'T00:00:00');
  const dow = (d.getDay() + 6) % 7; // 0=Mon
  d.setDate(d.getDate() - dow);
  return d;
}
function fmt(d: Date) { return d.toISOString().slice(0, 10); }

/**
 * 한 현장·한 월 전체를 검증한다. (F-F0101 규칙 실행)
 * 순수 함수 — D1 접근은 route 레이어에서 데이터를 모아 넘기고, 결과를 저장한다.
 */
export interface ApprovedOt { emp_id: string; wdate: string; }

export function runValidation(params: {
  site: string; ym: string; days: string[]; // ['2026-08-01', ...]
  employees: Employee[];
  ledger: LedgerRow[];               // 이번 달 전 건
  plans: PlanRow[];
  rules: Rules;
  approvedOt: ApprovedOt[];          // 승인된 연장근로 신청 (V-14 판정용, §6-1 SCR-W-05)
  codeOf: (c: string) => AttCode | undefined;
  isHoliday: (date: string) => boolean;
  isWeekend: (date: string) => boolean;
}): Exception[] {
  const { employees, ledger, plans, rules, codeOf, isHoliday, isWeekend, days, approvedOt } = params;
  const approvedOtSet = new Set(approvedOt.map(a => `${a.emp_id}|${a.wdate}`));
  const ex: Exception[] = [];
  const push = (rule: string, empId: string, wdate: string | null, msg: string, weekLabel?: string) => {
    const def = RULEDEF[rule];
    ex.push({ rule_id: rule, grade: def.grade, emp_id: empId, wdate, week_label: weekLabel ?? null, message: msg });
  };

  const ledgerByKey = new Map<string, LedgerRow>();
  ledger.forEach(r => ledgerByKey.set(`${r.emp_id}|${r.wdate}`, r));
  const planByKey = new Map<string, string>();
  plans.forEach(p => planByKey.set(`${p.emp_id}|${p.wdate}`, p.plan_code));

  for (const emp of employees) {
    // ── 일 단위 룰 ──
    for (const d of days) {
      const key = `${emp.emp_id}|${d}`;
      const rec = ledgerByKey.get(key);
      const pc = planByKey.get(key) ?? 'OFF';
      const holidayOrWE = isHoliday(d) || isWeekend(d);

      if (rec) {
        const v = eff(rec);
        if (rec.has_conflict) push('V-15', emp.emp_id, d, `제모스 값과 다른 채널 값이 동시 존재 — 자동 덮어쓰기 금지, 관리자가 선택`);
        if (emp.leave_date && d > emp.leave_date && v.code !== 'OFF' && v.code !== 'AB')
          push('V-03', emp.emp_id, d, `퇴사일 ${emp.leave_date} 이후 근태 — 등록 차단, 인사 확인 요청`);
        const cd = v.code ? codeOf(v.code) : undefined;
        if (!v.code || !cd) push('V-10', emp.emp_id, d, `표기 "${v.code}" 매핑 규칙 없음 — 추정하지 않음`);
        else if (cd.counts_hours) {
          if ((v.in == null) !== (v.out == null))
            push('V-12', emp.emp_id, d, v.in == null ? '출근 태그 없음' : `퇴근 태그 없음 (출근 ${v.in})`);
          else if (v.in != null && v.out != null) {
            const c = calc({ code: v.code, in: v.in, out: v.out, brk: null }, holidayOrWE, codeOf);
            if (c.stay > rules.day_max_h) push('V-04', emp.emp_id, d, `체류 ${c.stay.toFixed(1)}h > 상한 ${rules.day_max_h}h`);
            if (c.work > 8 && c.brk === 0) push('V-05', emp.emp_id, d, `근무 ${c.work.toFixed(1)}h인데 휴게 0분`);
            if (pc === 'OFF' && !rec.confirmed_code) push('V-08', emp.emp_id, d, `계획 없는 근무 (기록 존재)`);
            if (pc === 'AL' && v.code !== 'AL') push('V-09', emp.emp_id, d, `제모스 연차 신청일인데 출퇴근 태그 존재`);

            // V-13 지각·조퇴 — 예정 대비 ±허용오차(기본 10분) 초과 (§7 V-13)
            if (pc === 'WK' || pc === 'HW') {
              const plan = params.plans.find(p => p.emp_id === emp.emp_id && p.wdate === d);
              const planIn = plan?.plan_in, planOut = plan?.plan_out;
              if (planIn != null && v.in - planIn > rules.tol_min)
                push('V-13', emp.emp_id, d, `지각 — 계획 ${planIn} / 태그 ${v.in} (+${v.in - planIn}분)`);
              else if (planOut != null) {
                let out = v.out!; if (out < v.in) out += 1440;
                if (planOut - out > rules.tol_min)
                  push('V-13', emp.emp_id, d, `조퇴 — 계획 ${planOut} / 태그 ${v.out} (−${planOut - out}분)`);
              }
            }

            // V-14 미승인 연장 — 연장(ot>0 또는 hol>0)이 발생했는데 승인된 연장근로 신청이 없음 (§6-1 SCR-W-05, §7 V-14)
            if ((c.ot > 0 || c.hol > 0) && !approvedOtSet.has(`${emp.emp_id}|${d}`))
              push('V-14', emp.emp_id, d, `연장 ${c.ot > 0 ? c.ot.toFixed(1) + 'h' : c.hol.toFixed(1) + 'h(휴일)'} 발생 — 승인된 연장근로 신청 없음, 가산 대상 제외`);
          }
        }
        if (rec.gps_status === 'out' && !rec.confirmed_code)
          push('V-11', emp.emp_id, d, `태그 위치 반경 ${rules.gps_radius_m}m 밖`);
      } else if ((pc === 'WK' || pc === 'HW') && !(emp.leave_date && d > emp.leave_date)) {
        push('V-01', emp.emp_id, d, emp.jemos_active
          ? '계획일 태그 없음 — 결근 자동처리 금지, 확인 필요'
          : '제모스 미사용 인원 — 엑셀·수기 입력 필요');
      }
    }

    // ── 주 단위 룰 (V-06/V-07, 사전 경고 포함) ──
    const seen = new Set<string>();
    for (const d of days) {
      const mon = fmt(mondayOf(d));
      if (seen.has(mon)) continue;
      seen.add(mon);
      const weekDays = days.filter(x => fmt(mondayOf(x)) === mon);
      let done = 0, ot = 0, rem = 0;
      for (const wd of weekDays) {
        const rec = ledgerByKey.get(`${emp.emp_id}|${wd}`);
        if (rec) {
          const v = eff(rec);
          if (v.code && codeOf(v.code)) {
            const c = calc({ code: v.code, in: v.in, out: v.out, brk: null }, isHoliday(wd) || isWeekend(wd), codeOf);
            done += c.work; ot += c.ot + c.hol;
          }
        } else {
          const pc = planByKey.get(`${emp.emp_id}|${wd}`);
          if (pc === 'WK' || pc === 'HW') rem += 8;
        }
      }
      const label = `${weekDays[0]}~${weekDays[weekDays.length - 1]}`;
      if (done > rules.week_max_h) push('V-06', emp.emp_id, null, `주 ${done.toFixed(1)}h — ${rules.week_max_h}h 초과 확정`, label);
      else if (done + rem > rules.week_max_h)
        push('V-06', emp.emp_id, null, `확정 ${done.toFixed(1)}h + 잔여 계획 ${rem}h = ${(done + rem).toFixed(1)}h — 초과 예상, 잔여 가능 ${Math.max(0, rules.week_max_h - done).toFixed(1)}h`, label);
      if (ot > rules.ot_week_h) push('V-07', emp.emp_id, null, `연장 ${ot.toFixed(1)}h > 주 ${rules.ot_week_h}h`, label);
      else if (rem > 0 && done + rem > rules.week_max_h)
        push('V-07', emp.emp_id, null, `연장 ${ot.toFixed(1)}h + 잔여 계획으로 주 ${rules.ot_week_h}h 초과 예상`, label);
    }
  }
  return ex;
}
