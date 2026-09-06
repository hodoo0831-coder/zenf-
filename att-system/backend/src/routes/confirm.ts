import { Env, requireUser, requireRole, json, audit, httpError } from '../lib/http';

async function getStatus(env: Env, site: string, ym: string) {
  let s = await env.DB.prepare('SELECT * FROM month_status WHERE site=? AND ym=?').bind(site, ym).first<any>();
  if (!s) {
    await env.DB.prepare('INSERT INTO month_status (site, ym) VALUES (?,?)').bind(site, ym).run();
    s = await env.DB.prepare('SELECT * FROM month_status WHERE site=? AND ym=?').bind(site, ym).first<any>();
  }
  return s;
}

// GET /api/month/checklist?site=&ym=  — m-close 확정 전 체크리스트 4개 (§6-2)
export async function confirmChecklist(req: Request, env: Env): Promise<Response> {
  await requireUser(req, env);
  const url = new URL(req.url);
  const site = url.searchParams.get('site')!, ym = url.searchParams.get('ym')!;
  const check = await evalChecklist(env, site, ym);
  return json(check);
}

async function evalChecklist(env: Env, site: string, ym: string) {
  const ms0 = await env.DB.prepare('SELECT last_run_id FROM month_status WHERE site=? AND ym=?').bind(site, ym).first<{ last_run_id: string | null }>();
  const openErr = ms0?.last_run_id ? (await env.DB.prepare(
    `SELECT COUNT(*) n FROM exceptions x JOIN employees e ON e.emp_id=x.emp_id WHERE e.site=? AND x.run_id=? AND x.grade='오류' AND x.status!='처리완료'`
  ).bind(site, ms0.last_run_id).first<{ n: number }>())?.n ?? 0 : -1; // -1 = 검증 미실행
  const openWarn = ms0?.last_run_id ? (await env.DB.prepare(
    `SELECT COUNT(*) n FROM exceptions x JOIN employees e ON e.emp_id=x.emp_id WHERE e.site=? AND x.run_id=? AND x.grade='경고' AND x.status!='처리완료'`
  ).bind(site, ms0.last_run_id).first<{ n: number }>())?.n ?? 0 : -1;
  const pendingCorr = (await env.DB.prepare(
    `SELECT COUNT(*) n FROM correction_requests c JOIN employees e ON e.emp_id=c.emp_id WHERE e.site=? AND c.wdate LIKE ? AND c.status='승인대기'`
  ).bind(site, ym + '%').first<{ n: number }>())?.n ?? 0;
  const pendingOt = (await env.DB.prepare(
    `SELECT COUNT(*) n FROM ot_requests o JOIN employees e ON e.emp_id=o.emp_id WHERE e.site=? AND o.wdate LIKE ? AND o.status='승인대기'`
  ).bind(site, ym + '%').first<{ n: number }>())?.n ?? 0;
  const conflicts = (await env.DB.prepare(
    `SELECT COUNT(*) n FROM ledger_conflicts lc JOIN ledger l ON l.id=lc.ledger_id JOIN employees e ON e.emp_id=l.emp_id
     WHERE e.site=? AND l.wdate LIKE ? AND lc.resolved=0`
  ).bind(site, ym + '%').first<{ n: number }>())?.n ?? 0;
  const notCollected = ms0?.last_run_id ? 0 : 1; // 검증 미실행 = 수집완료 판정 불가로 취급

  return {
    noOpenExceptions: openErr === 0 && openWarn === 0, openErr, openWarn,
    noPendingRequests: pendingCorr === 0 && pendingOt === 0, pendingCorr, pendingOt,
    collectDone: !notCollected,
    channelConflictResolved: conflicts === 0, conflicts,
    allOk: openErr === 0 && openWarn === 0 && pendingCorr === 0 && pendingOt === 0 && !notCollected && conflicts === 0,
  };
}

// POST /api/month/confirm1  { site, ym, opinion? }  — 현장관리자 1차 확정, 현장×월 단위 (F-G0204)
export async function confirm1(req: Request, env: Env): Promise<Response> {
  const user = await requireUser(req, env);
  requireRole(user, ['mgr']);
  const { site, ym, opinion } = await req.json<{ site: string; ym: string; opinion?: string }>();

  const check = await evalChecklist(env, site, ym);
  if (!check.allOk && !opinion?.trim())
    throw httpError(400, `확정 조건 미충족 — 오류${check.openErr} 경고${check.openWarn} 대기신청${check.pendingCorr + check.pendingOt} 채널충돌${check.conflicts}. 부득이하면 확정자 의견을 사유와 함께 입력하세요`);
  if (check.openErr > 0) throw httpError(400, `오류 ${check.openErr}건은 의견 기재로도 넘어갈 수 없습니다 — 실제 보정이 필요합니다`);

  await env.DB.prepare(
    `UPDATE month_status SET stage='1차확정', confirm1_at=datetime('now'), confirm1_by=?, confirm1_opinion=? WHERE site=? AND ym=?`
  ).bind(user.id, opinion ?? null, site, ym).run();
  await audit(env, user.id, '1차 확정 (현장×월)', `${site} ${ym}`, opinion ? `예외 확정 — ${opinion}` : '조건 충족 확정 — J/C 2차 검토 상신');
  return json({ ok: true, check });
}

// POST /api/month/confirm2  { site, ym }  — J/C 2차 승인 (F-G0302)
export async function confirm2(req: Request, env: Env): Promise<Response> {
  const user = await requireUser(req, env);
  requireRole(user, ['jc']);
  const { site, ym } = await req.json<{ site: string; ym: string }>();
  const s = await getStatus(env, site, ym);
  if (s.stage !== '1차확정') throw httpError(400, '1차 확정 전에는 2차 승인할 수 없습니다');
  await env.DB.prepare(`UPDATE month_status SET stage='2차승인', confirm2_at=datetime('now'), confirm2_by=? WHERE site=? AND ym=?`)
    .bind(user.id, site, ym).run();
  await audit(env, user.id, '2차 승인', `${site} ${ym}`, '마감 가능');
  return json({ ok: true });
}

// POST /api/month/reject  { site, ym, reason }  — 현장 반송 (F-G0303)
export async function rejectToSite(req: Request, env: Env): Promise<Response> {
  const user = await requireUser(req, env);
  requireRole(user, ['jc']);
  const { site, ym, reason } = await req.json<{ site: string; ym: string; reason: string }>();
  if (!reason?.trim()) throw httpError(400, '반송 사유는 필수입니다');
  await env.DB.prepare(`UPDATE month_status SET stage='검증', confirm1_at=NULL, confirm1_by=NULL, return_count=return_count+1 WHERE site=? AND ym=?`).bind(site, ym).run();
  await audit(env, user.id, '현장 반송', `${site} ${ym}`, reason);
  return json({ ok: true });
}

// POST /api/month/close  { site, ym }  — 월마감·스냅샷 봉인 (F-H0101/0102)
export async function closeMonth(req: Request, env: Env): Promise<Response> {
  const user = await requireUser(req, env);
  requireRole(user, ['jc']);
  const { site, ym } = await req.json<{ site: string; ym: string }>();
  const s = await getStatus(env, site, ym);
  if (s.stage !== '2차승인') throw httpError(400, '2차 승인 전에는 마감할 수 없습니다');

  // 같은 (사번,일자)에 채널이 여러 개일 수 있다(제모스 + 엑셀/수기).
  // snapshot_ledger 의 PK 는 (snap_id, emp_id, wdate) 이므로 하루에 한 행만 봉인해야 한다.
  // 우선순위 — ① 관리자가 확정한 값이 있는 행 ② 제모스(디폴트 채널) ③ 최근 적재 순.
  // (기준문서 §4-1 "제모스가 디폴트, 나머지는 예외" · §3-1 "ERP와 급여는 확정값만 사용")
  const rows = (await env.DB.prepare(
    `SELECT l.emp_id, l.wdate, COALESCE(l.confirmed_code,l.proposed_code) code,
            COALESCE(l.confirmed_in,l.proposed_in) tin, COALESCE(l.confirmed_out,l.proposed_out) tout, l.channel
     FROM ledger l JOIN employees e ON e.emp_id=l.emp_id
     WHERE e.site=? AND l.wdate LIKE ?
       AND l.id = (SELECT l2.id FROM ledger l2
                    WHERE l2.emp_id = l.emp_id AND l2.wdate = l.wdate
                    ORDER BY (l2.confirmed_code IS NOT NULL) DESC,
                             (l2.channel = '제모스') DESC,
                             l2.id DESC
                    LIMIT 1)
     ORDER BY l.emp_id, l.wdate`
  ).bind(site, ym + '%').all()).results as any[];

  const snapId = `${site}|${ym}`;
  await env.DB.prepare('DELETE FROM snapshot_ledger WHERE snap_id=?').bind(snapId).run();
  const ins = env.DB.prepare('INSERT INTO snapshot_ledger (snap_id, emp_id, wdate, code, tin, tout, channel) VALUES (?,?,?,?,?,?,?)');
  if (rows.length) await env.DB.batch(rows.map(r => ins.bind(snapId, r.emp_id, r.wdate, r.code, r.tin, r.tout, r.channel)));

  const hash = `sha256:${await sha256Hex(JSON.stringify(rows))}`;
  await env.DB.prepare(`UPDATE month_status SET stage='마감', closed_at=datetime('now'), closed_by=?, snapshot_hash=? WHERE site=? AND ym=?`)
    .bind(user.id, hash, site, ym).run();
  await audit(env, user.id, '월 마감', `${site} ${ym}`, `스냅샷 ${rows.length}건 · ${hash}`);
  return json({ ok: true, rows: rows.length, hash });
}

async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 16) + '…';
}

// GET /api/month/status?site=&ym=
export async function monthStatus(req: Request, env: Env): Promise<Response> {
  await requireUser(req, env);
  const url = new URL(req.url);
  const s = await getStatus(env, url.searchParams.get('site')!, url.searchParams.get('ym')!);
  return json(s);
}
