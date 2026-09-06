// 제모스 데이터 수신 어댑터 (F0)
// md §"확인 필요": 방안 A(조회 API) / B(DB 읽기전용) / C(일 배치파일) 중 미확정.
// 이 어댑터 인터페이스만 고정해두고, 방식이 정해지면 구현체만 교체한다.
// 신규 시스템은 제모스에 절대 쓰기(write)를 하지 않는다 — 아래 인터페이스에 write 메서드 없음.

export interface JemosTag {
  jemosId: string;      // 제모스 사번/AT코드
  date: string;         // YYYY-MM-DD
  inMin: number | null; // 출근(분)
  outMin: number | null;// 퇴근(분)
  gps: 'ok' | 'out';
  rawRows: unknown[];   // 원본 payload (다중 태그 포함, 그대로 보관)
}
export interface JemosLeaveRequest {
  jemosId: string; date: string; type: 'AL' | 'HL';
}

export interface JemosAdapter {
  /** 특정 일자의 출퇴근 태그 전건을 가져온다. 방안 C(배치)면 파일 파싱, A/B면 API/DB 조회. */
  fetchDailyTags(site: string, date: string): Promise<JemosTag[]>;
  /** 연차·반차 신청 내역 (F0 수신 대상 데이터 표) */
  fetchLeaveRequests(site: string, date: string): Promise<JemosLeaveRequest[]>;
  /** 헬스체크 — 수신 실패 감시(F0 처리규칙 6) 용도 */
  ping(): Promise<boolean>;
}

/**
 * MOCK 구현 — 실 연동 확정 전까지 사용.
 * 이노파크와 협의 후 아래 셋 중 하나로 교체:
 *   - JemosApiAdapter   (방안 A: 조회 API)
 *   - JemosDbReadAdapter(방안 B: 읽기전용 DB 커넥션)
 *   - JemosBatchFileAdapter(방안 C: 일 1회 파일 — 예: SFTP/오브젝트스토리지에서 당일 파일을 받아 파싱)
 */
export class JemosMockAdapter implements JemosAdapter {
  async fetchDailyTags(_site: string, _date: string): Promise<JemosTag[]> {
    return []; // 실제 연동 전에는 F0가 빈 값을 반환 → 엑셀/수기 예외 채널로만 원장이 채워짐
  }
  async fetchLeaveRequests(): Promise<JemosLeaveRequest[]> { return []; }
  async ping(): Promise<boolean> { return true; }
}

/**
 * DEMO 구현 — 실 연동 확정 전, 파이프라인에 실제 데이터를 태워보기 위한 것.
 * 사내 시연·검증용이며 실 연동이 아니다. MOCK 과 마찬가지로 제모스에 쓰기를 하지 않는다.
 *
 * 근무계획(work_plans)이 WK/HW 인 날에만, jemos_active=1 인 인원의 태그를 만든다.
 * 같은 (사번,일자)면 항상 같은 값이 나오도록 결정적 해시를 쓴다 — 재수신해도 값이 흔들리지 않는다.
 * 일부러 섞는 것: 미태깅 · 퇴근태그 결손 · 지각 · 조퇴 · 연장 · 위치이탈 · 중복태그.
 * 검증엔진(V-01·V-11·V-12·V-13·V-14 등)이 실제로 발동하는지 보기 위함이다.
 */
export class JemosDemoAdapter implements JemosAdapter {
  constructor(private db: D1Database) {}

  private static h(seed: string): number {
    let x = 2166136261;
    for (let i = 0; i < seed.length; i++) { x ^= seed.charCodeAt(i); x = Math.imul(x, 16777619); }
    return ((x >>> 0) % 100000) / 100000;
  }

  async fetchDailyTags(site: string, date: string): Promise<JemosTag[]> {
    const rows = (await this.db.prepare(
      `SELECT e.jemos_id, e.emp_id, wp.plan_code, wp.plan_in, wp.plan_out
         FROM employees e
         JOIN work_plans wp ON wp.emp_id = e.emp_id AND wp.wdate = ?
        WHERE e.site = ? AND e.jemos_active = 1 AND e.jemos_id IS NOT NULL
          AND wp.plan_code IN ('WK','HW')
          AND (e.leave_date IS NULL OR e.leave_date >= ?)`
    ).bind(date, site, date).all()).results as any[];

    const tags: JemosTag[] = [];
    for (const r of rows) {
      const k = `${r.jemos_id}|${date}`;
      const r1 = JemosDemoAdapter.h(k + 'a');
      const r2 = JemosDemoAdapter.h(k + 'b');
      const r3 = JemosDemoAdapter.h(k + 'c');

      // 미태깅 — 약 4%. 검증에서 V-01 로 잡힌다.
      if (r1 < 0.04) continue;

      const planIn = r.plan_in ?? 480;
      const planOut = r.plan_out ?? 1020;

      // 출근 편차: 대부분 ±7분, 8% 정도가 지각(+12~50분) → V-13
      const dev = r2 < 0.92 ? Math.round((r2 / 0.92 - 0.5) * 14) : 12 + Math.round(((r2 - 0.92) / 0.08) * 38);
      const inMin = planIn + dev;

      // 연장: 28% 가 1~3시간
      const extra = r3 > 0.72 ? 60 * (1 + Math.floor(JemosDemoAdapter.h(k + 'd') * 3)) : 0;
      let outMin: number | null = planOut + extra + Math.round((JemosDemoAdapter.h(k + 'e') - 0.5) * 16);

      // 조퇴 — 3%
      if (JemosDemoAdapter.h(k + 'f') > 0.97) outMin = planOut - 60 - Math.round(JemosDemoAdapter.h(k + 'g') * 90);
      // 퇴근 태그 결손 — 4.5% → V-12
      if (JemosDemoAdapter.h(k + 'h') > 0.955) outMin = null;

      // 위치 이탈 — 3.5% → V-11 (동의 범위 확정 전까지는 판정 결과만 쓰고 좌표는 남기지 않는다)
      const gps: 'ok' | 'out' = JemosDemoAdapter.h(k + 'i') > 0.965 ? 'out' : 'ok';

      // 중복 태그 — 8%. 원본은 전건 보관하고 집계는 최초 출근·최종 퇴근.
      const rawRows: unknown[] = [{ type: 'IN', at: `${date} ${JemosDemoAdapter.hm(inMin)}`, gps }];
      if (JemosDemoAdapter.h(k + 'j') > 0.92) {
        rawRows.push({ type: 'IN', at: `${date} ${JemosDemoAdapter.hm(inMin + 3)}`, gps, note: '중복 태그' });
      }
      if (outMin != null) rawRows.push({ type: 'OUT', at: `${date} ${JemosDemoAdapter.hm(outMin)}`, gps });

      tags.push({ jemosId: r.jemos_id, date, inMin, outMin, gps, rawRows });
    }
    return tags;
  }

  private static hm(min: number): string {
    const m = ((min % 1440) + 1440) % 1440;
    return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  }

  async fetchLeaveRequests(): Promise<JemosLeaveRequest[]> { return []; }
  async ping(): Promise<boolean> { return true; }
}

export function getJemosAdapter(mode: string, db?: D1Database): JemosAdapter {
  switch (mode) {
    // case 'A_API': return new JemosApiAdapter(...)
    // case 'B_DB':  return new JemosDbReadAdapter(...)
    // case 'C_BATCH': return new JemosBatchFileAdapter(...)
    case 'DEMO': return db ? new JemosDemoAdapter(db) : new JemosMockAdapter();
    default: return new JemosMockAdapter();
  }
}
