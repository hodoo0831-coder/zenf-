import { Env, requireUser, requireRole, json, audit } from '../lib/http';
import { getJemosAdapter } from '../adapters/jemosAdapter';
import { hm } from '../lib/calc';

// POST /api/jemos/receive  { site, date }
// F0 처리규칙: 수신 즉시 원장에 '제안값'으로 적재, 채널=제모스, 원본 payload 보관,
//              위치 반경 밖이면 gps_status='out', 중복 태그는 최초출근·최종퇴근 집계(원본 전건 보관)
export async function receiveJemos(req: Request, env: Env): Promise<Response> {
  const user = await requireUser(req, env);
  requireRole(user, ['mgr', 'jc', 'sys']); // 배치는 보통 크론이지만, 수동 재수신은 이 권한들만

  const { site, date } = await req.json<{ site: string; date: string }>();
  const adapter = getJemosAdapter(env.JEMOS_MODE, env.DB);
  const tags = await adapter.fetchDailyTags(site, date);

  const planned = await env.DB.prepare(
    `SELECT COUNT(*) n FROM work_plans wp JOIN employees e ON e.emp_id=wp.emp_id
     WHERE e.site=? AND wp.wdate=? AND wp.plan_code IN ('WK','HW') AND e.jemos_active=1`
  ).bind(site, date).first<{ n: number }>();

  let dup = 0, gpsOut = 0, missingOut = 0;
  for (const t of tags) {
    if (t.rawRows.length > 2) dup++;
    if (t.gps === 'out') gpsOut++;
    if (t.outMin == null) missingOut++;

    const emp = await env.DB.prepare('SELECT emp_id FROM employees WHERE jemos_id=?').bind(t.jemosId).first<{ emp_id: string }>();
    if (!emp) continue; // 매핑 안 된 사번 — 별도 알림 대상(미구현, TODO)

    const existing = await env.DB.prepare('SELECT id, channel FROM ledger WHERE emp_id=? AND wdate=? AND channel=?')
      .bind(emp.emp_id, t.date, '제모스').first<{ id: number }>();

    const payload = JSON.stringify(t.rawRows);
    if (existing) {
      await env.DB.prepare(
        `UPDATE ledger SET raw_payload=?, proposed_in=?, proposed_out=?, gps_status=?, received_at=datetime('now') WHERE id=?`
      ).bind(payload, t.inMin, t.outMin, t.gps, existing.id).run();
    } else {
      await env.DB.prepare(
        `INSERT INTO ledger (emp_id, wdate, channel, source_ref, raw_payload, proposed_code, proposed_in, proposed_out, gps_status, status)
         VALUES (?,?,?,?,?,?,?,?,?,'제안')`
      ).bind(emp.emp_id, t.date, '제모스', `JEMOS ${date}`, payload, 'WK', t.inMin, t.outMin, t.gps).run();

      // 같은 사번·일자에 엑셀/수기 채널 값이 이미 있으면 충돌 마킹 (F1 처리규칙 3)
      const other = await env.DB.prepare(`SELECT id, channel, proposed_code, proposed_in, proposed_out FROM ledger WHERE emp_id=? AND wdate=? AND channel!='제모스'`)
        .bind(emp.emp_id, t.date).first<any>();
      if (other) {
        const newRow = await env.DB.prepare('SELECT id FROM ledger WHERE emp_id=? AND wdate=? AND channel=?').bind(emp.emp_id, t.date, '제모스').first<{ id: number }>();
        await env.DB.prepare(`INSERT OR REPLACE INTO ledger_conflicts (ledger_id, other_channel, other_payload) VALUES (?,?,?)`)
          .bind(newRow!.id, other.channel, JSON.stringify(other)).run();
      }
    }
  }

  await env.DB.prepare(
    `INSERT INTO jemos_receipts (site, rdate, n_records, n_expected, n_dup, n_gps_out, n_missing_out, ok)
     VALUES (?,?,?,?,?,?,?,1)
     ON CONFLICT(site, rdate) DO UPDATE SET n_records=excluded.n_records, n_expected=excluded.n_expected,
       n_dup=excluded.n_dup, n_gps_out=excluded.n_gps_out, n_missing_out=excluded.n_missing_out, received_at=datetime('now')`
  ).bind(site, date, tags.length, planned?.n ?? 0, dup, gpsOut, missingOut).run();

  await audit(env, user.id, '제모스 수신', `${site} ${date}`, `${tags.length}건 적재 (계획 ${planned?.n ?? 0}명, 미태깅 감지는 검증 단계 V-01)`);
  return json({ received: tags.length, expected: planned?.n ?? 0, dup, gpsOut, missingOut });
}

// GET /api/jemos/status?site=...&ym=...
export async function jemosStatus(req: Request, env: Env): Promise<Response> {
  await requireUser(req, env);
  const url = new URL(req.url);
  const site = url.searchParams.get('site')!, ym = url.searchParams.get('ym')!;
  const rows = await env.DB.prepare(
    `SELECT * FROM jemos_receipts WHERE site=? AND rdate LIKE ? ORDER BY rdate DESC`
  ).bind(site, ym + '%').all();
  return json(rows.results);
}
