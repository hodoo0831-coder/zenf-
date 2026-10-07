import { Env, AuthedUser, requireUser, requireRole, json, httpError } from '../lib/http';
import { calc, hm, parseHM } from '../lib/calc';

// 근로자는 "확정 대상월" 한 달만 조회 가능(§11-④). 설정값 1곳 — 나중에 "진행 중인 당월"로 바꾸려면 여기만 고치면 됨.
const TARGET_YM = '2026-08';

async function myEmpId(env: Env, user: AuthedUser): Promise<string> {
  const row = await env.DB.prepare('SELECT emp_id FROM users WHERE id=?').bind(user.id).first<{ emp_id: string }>();
  if (!row?.emp_id) throw httpError(400, '이 계정에 연결된 사번이 없습니다');
  return row.emp_id;
}

function assertTargetMonth(ym: string) {
  if (ym !== TARGET_YM) throw httpError(403, `근로자는 확정 대상월(${TARGET_YM})만 조회할 수 있습니다`);
}

// GET /api/me/summary — SCR-W-01 내 대시보드
export async function mySummary(req: Request, env: Env): Promise<Response> {
  const user = await requireUser(req, env);
  requireRole(user, ['worker']);
  const empId = await myEmpId(env, user);

  const ledgerRows = (await env.DB.prepare(
    `SELECT * FROM ledger WHERE emp_id=? AND wdate LIKE ?`
  ).bind(empId, TARGET_YM + '%').all()).results as any[];
  const codes = (await env.DB.prepare('SELECT * FROM att_codes').all()).results as any[];
  const codeMap = new Map(codes.map(c => [c.code, c]));

  let work = 0, ot = 0, night = 0, hol = 0, al = 0;
  for (const r of ledgerRows) {
    const code = r.confirmed_code ?? r.proposed_code;
    const cd = codeMap.get(code);
    if (!cd) continue;
    if (code === 'AL') { al++; continue; }
    if (!cd.counts_hours) continue;
    const tin = r.confirmed_code ? r.confirmed_in : r.proposed_in;
    const tout = r.confirmed_code ? r.confirmed_out : r.proposed_out;
    if (tin == null || tout == null) continue;
    const c = calc({ code, in: tin, out: tout, brk: null }, false, cc => codeMap.get(cc));
    work += c.work; ot += c.ot; night += c.night; hol += c.hol;
  }

  const exceptions = (await env.DB.prepare(
    `SELECT COUNT(*) n FROM exceptions WHERE emp_id=? AND status!='처리완료' AND (wdate LIKE ? OR week_label LIKE ?)`
  ).bind(empId, TARGET_YM + '%', TARGET_YM + '%').first<{ n: number }>());

  const corrections = (await env.DB.prepare(
    `SELECT status, COUNT(*) n FROM correction_requests WHERE emp_id=? AND wdate LIKE ? GROUP BY status`
  ).bind(empId, TARGET_YM + '%').all()).results;
  const otReq = (await env.DB.prepare(
    `SELECT status, COUNT(*) n FROM ot_requests WHERE emp_id=? AND wdate LIKE ? GROUP BY status`
  ).bind(empId, TARGET_YM + '%').all()).results;

  const rules = await env.DB.prepare('SELECT week_max_h FROM rule_settings WHERE site=?').bind(user.site).first<{ week_max_h: number }>();

  return json({
    ym: TARGET_YM, workHours: +work.toFixed(1), otHours: +ot.toFixed(1), nightHours: +night.toFixed(1), holHours: +hol.toFixed(1), annualLeaveDays: al,
    openExceptions: exceptions?.n ?? 0,
    corrections, otRequests: otReq,
    weekMaxH: rules?.week_max_h ?? 52,
    note: '게이지·잔여시간은 프론트에서 주단위로 다시 계산 — 여기선 월 합계만 제공',
  });
}

// GET /api/me/ledger — SCR-W-03 내 근태 확인 (예정 vs 실적, 원본/확정값 병렬)
export async function myLedger(req: Request, env: Env): Promise<Response> {
  const user = await requireUser(req, env);
  requireRole(user, ['worker']);
  const empId = await myEmpId(env, user);
  const url = new URL(req.url);
  const ym = url.searchParams.get('ym') ?? TARGET_YM;
  assertTargetMonth(ym);

  const plans = (await env.DB.prepare('SELECT * FROM work_plans WHERE emp_id=? AND wdate LIKE ? ORDER BY wdate').bind(empId, ym + '%').all()).results as any[];
  const ledgerRows = (await env.DB.prepare('SELECT * FROM ledger WHERE emp_id=? AND wdate LIKE ?').bind(empId, ym + '%').all()).results as any[];
  const ledgerByDate = new Map(ledgerRows.map(r => [r.wdate, r]));

  const days = plans.map(p => {
    const r = ledgerByDate.get(p.wdate);
    return {
      wdate: p.wdate, planCode: p.plan_code, planIn: p.plan_in, planOut: p.plan_out,
      recorded: !!r,
      channel: r?.channel ?? null,
      proposed: r ? { code: r.proposed_code, in: hm(r.proposed_in), out: hm(r.proposed_out) } : null,
      confirmed: r?.confirmed_code ? { code: r.confirmed_code, in: hm(r.confirmed_in), out: hm(r.confirmed_out) } : null,
      status: r?.status ?? '기록 없음',
    };
  });
  return json(days);
}

// GET /api/me/corrections — 내 정정요청 이력
export async function myCorrections(req: Request, env: Env): Promise<Response> {
  const user = await requireUser(req, env);
  requireRole(user, ['worker']);
  const empId = await myEmpId(env, user);
  const rows = await env.DB.prepare('SELECT * FROM correction_requests WHERE emp_id=? ORDER BY requested_at DESC').bind(empId).all();
  return json(rows.results);
}

// POST /api/me/corrections — SCR-W-04 근태 수정요청 (원본은 안 건드리고 요청 건만 생성)
export async function submitCorrection(req: Request, env: Env): Promise<Response> {
  const user = await requireUser(req, env);
  requireRole(user, ['worker']);
  const empId = await myEmpId(env, user);
  const b = await req.json<{ wdate: string; field: string; code?: string; inHM?: string; outHM?: string; reason: string; evidenceRef?: string }>();
  if (!b.reason?.trim()) throw httpError(400, '사유는 필수입니다');
  assertTargetMonth(b.wdate.slice(0, 7));

  const monthStatus = await env.DB.prepare('SELECT stage FROM month_status WHERE site=? AND ym=?').bind(user.site, b.wdate.slice(0, 7)).first<{ stage: string }>();
  if (monthStatus?.stage === '마감' || monthStatus?.stage === 'ERP확정') throw httpError(400, '마감된 월은 수정요청을 할 수 없습니다');

  const ledgerRow = await env.DB.prepare(`SELECT id FROM ledger WHERE emp_id=? AND wdate=? ORDER BY channel='제모스' DESC LIMIT 1`).bind(empId, b.wdate).first<{ id: number }>();

  await env.DB.prepare(
    `INSERT INTO correction_requests (ledger_id, emp_id, wdate, field, requested_code, requested_in, requested_out, reason, evidence_ref)
     VALUES (?,?,?,?,?,?,?,?,?)`
  ).bind(ledgerRow?.id ?? null, empId, b.wdate, b.field, b.code ?? null, parseHM(b.inHM), parseHM(b.outHM), b.reason, b.evidenceRef ?? null).run();

  return json({ ok: true, status: '승인대기', note: '현장관리자에게 알림이 갑니다. 승인되면 확정값 보정으로 반영됩니다.' });
}

// GET /api/me/ot-requests
export async function myOtRequests(req: Request, env: Env): Promise<Response> {
  const user = await requireUser(req, env);
  requireRole(user, ['worker']);
  const empId = await myEmpId(env, user);
  const rows = await env.DB.prepare('SELECT * FROM ot_requests WHERE emp_id=? ORDER BY requested_at DESC').bind(empId).all();
  return json(rows.results);
}

// POST /api/me/ot-requests — SCR-W-05 연장근로 신청 (사전/사후, 사후는 사유 10자 이상)
export async function submitOtRequest(req: Request, env: Env): Promise<Response> {
  const user = await requireUser(req, env);
  requireRole(user, ['worker']);
  const empId = await myEmpId(env, user);
  const b = await req.json<{ wdate: string; timing: '사전' | '사후'; startHM: string; endHM: string; reason: string }>();
  if (!b.reason?.trim()) throw httpError(400, '업무 사유는 필수입니다');
  if (b.timing === '사후' && b.reason.trim().length < 10) throw httpError(400, '사후 신청은 상세 사유 10자 이상이 필요합니다');
  assertTargetMonth(b.wdate.slice(0, 7));

  const monthStatus = await env.DB.prepare('SELECT stage FROM month_status WHERE site=? AND ym=?').bind(user.site, b.wdate.slice(0, 7)).first<{ stage: string }>();
  if (monthStatus?.stage === '마감' || monthStatus?.stage === 'ERP확정') throw httpError(400, '마감된 월은 연장근로를 신청할 수 없습니다');

  await env.DB.prepare(
    `INSERT INTO ot_requests (emp_id, wdate, timing, start_min, end_min, reason) VALUES (?,?,?,?,?,?)`
  ).bind(empId, b.wdate, b.timing, parseHM(b.startHM), parseHM(b.endHM), b.reason).run();

  return json({ ok: true, status: '승인대기', note: '승인 전까지는 검증에서 V-14(미승인 연장)로 남습니다' });
}
