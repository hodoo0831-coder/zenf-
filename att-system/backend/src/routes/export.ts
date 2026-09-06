import { Env, requireUser, requireRole, json, audit, httpError } from '../lib/http';
import { calc, hm } from '../lib/calc';

// GET /api/export/formats?site=
export async function listFormats(req: Request, env: Env): Promise<Response> {
  await requireUser(req, env);
  const site = new URL(req.url).searchParams.get('site');
  const rows = site
    ? await env.DB.prepare('SELECT * FROM export_formats WHERE active=1 AND (site=? OR site IS NULL) ORDER BY id').bind(site).all()
    : await env.DB.prepare('SELECT * FROM export_formats WHERE active=1 ORDER BY id').all();
  return json(rows.results);
}

// POST /api/export/formats  (시스템관리자 전용 — 구조는 관리자, §9-3)
export async function upsertFormat(req: Request, env: Env): Promise<Response> {
  const user = await requireUser(req, env);
  requireRole(user, ['sys']);
  const b = await req.json<any>();
  await env.DB.prepare(
    `INSERT INTO export_formats (id,name,site,row_axis,col_axis,cell_value,code_display,totals,purpose,anon_forced,updated_by)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)
     ON CONFLICT(id) DO UPDATE SET name=excluded.name, site=excluded.site, row_axis=excluded.row_axis, col_axis=excluded.col_axis,
       cell_value=excluded.cell_value, code_display=excluded.code_display, totals=excluded.totals, purpose=excluded.purpose,
       anon_forced=excluded.anon_forced, version=version+1, updated_by=excluded.updated_by, updated_at=datetime('now')`
  ).bind(b.id, b.name, b.site ?? null, b.rowAxis, b.colAxis ?? '일자', b.cellValue, b.codeDisplay ?? '코드명',
    b.totals ?? '근무일수,실근로,연장,야간,휴일,연차,결근', b.purpose ?? '내부 관리', b.purpose === '고객사 제출' ? 1 : (b.anonForced ? 1 : 0), user.id).run();
  await audit(env, user.id, '내보내기 양식 저장', b.id, JSON.stringify(b));
  return json({ ok: true });
}

// 코드 → 표기 결정 (§9-2 대표 표기 선정: 현장 전용 > 전체 공용 > 코드명)
async function labelOf(env: Env, site: string, code: string, codeName: string, display: string): Promise<string> {
  if (display === '내부코드') return code;
  if (display === '코드명') return codeName;
  // 현장고유표기
  const own = await env.DB.prepare('SELECT label FROM code_labels WHERE site=? AND code=?').bind(site, code).first<{ label: string }>();
  if (own) return own.label;
  const common = await env.DB.prepare(`SELECT label FROM code_labels WHERE site='*' AND code=?`).bind(code).first<{ label: string }>();
  if (common) return common.label;
  return codeName; // 후보 없으면 코드명 폴백 (문서: 정리 필요 표시는 UI 몫)
}

// POST /api/export/generate  { formatId, site, ym, options?, reason }
export async function generateExport(req: Request, env: Env): Promise<Response> {
  const user = await requireUser(req, env);
  requireRole(user, ['mgr', 'jc', 'sys']);
  const b = await req.json<{ formatId: string; site: string; ym: string; options?: any; reason: string }>();
  if (!b.reason?.trim()) throw httpError(400, '다운로드 사유는 필수입니다 (F-I0108)');

  const fmt = await env.DB.prepare('SELECT * FROM export_formats WHERE id=? AND active=1').bind(b.formatId).first<any>();
  if (!fmt) throw httpError(404, '존재하지 않거나 비활성화된 양식입니다');

  const codes = (await env.DB.prepare('SELECT * FROM att_codes').all()).results as any[];
  const codeMap = new Map(codes.map(c => [c.code, c]));

  // 마감된 월이면 스냅샷, 아니면 원장 실시간값 사용
  const ms = await env.DB.prepare('SELECT stage FROM month_status WHERE site=? AND ym=?').bind(b.site, b.ym).first<{ stage: string }>();
  const useSnapshot = ms?.stage === '마감' || ms?.stage === 'ERP확정';
  const rows = useSnapshot
    ? (await env.DB.prepare('SELECT emp_id, wdate, code, tin AS tin, tout AS tout FROM snapshot_ledger WHERE snap_id=?').bind(`${b.site}|${b.ym}`).all()).results as any[]
    : (await env.DB.prepare(
        `SELECT l.emp_id, l.wdate, COALESCE(l.confirmed_code,l.proposed_code) code, COALESCE(l.confirmed_in,l.proposed_in) tin, COALESCE(l.confirmed_out,l.proposed_out) tout
         FROM ledger l JOIN employees e ON e.emp_id=l.emp_id WHERE e.site=? AND l.wdate LIKE ?`
      ).bind(b.site, b.ym + '%').all()).results as any[];

  const emps = (await env.DB.prepare('SELECT emp_id, name, site, contract_type FROM employees WHERE site=?').bind(b.site).all()).results as any[];
  const empMap = new Map(emps.map(e => [e.emp_id, e]));
  const anon = fmt.anon_forced === 1; // §9-5-2 고객사 제출은 강제 ON, 편집화면에서도 변경 불가

  const byEmp = new Map<string, any[]>();
  for (const r of rows) { if (!byEmp.has(r.emp_id)) byEmp.set(r.emp_id, []); byEmp.get(r.emp_id)!.push(r); }

  const outRows: any[] = [];
  let sumWork = 0, sumOt = 0, sumHol = 0, sumNight = 0;
  for (const [empId, empRows] of byEmp) {
    const emp = empMap.get(empId); if (!emp) continue;
    const cells: Record<string, string> = {};
    let days = 0, work = 0, ot = 0, night = 0, hol = 0, al = 0, ab = 0;
    for (const r of empRows) {
      const cd = codeMap.get(r.code); if (!cd) continue;
      const label = await labelOf(env, b.site, r.code, cd.name, fmt.code_display);
      let cellText = label;
      if (cd.counts_hours && r.tin != null && r.tout != null) {
        const c = calc({ code: r.code, in: r.tin, out: r.tout, brk: null }, false, cc => codeMap.get(cc));
        days++; work += c.work; ot += c.ot; night += c.night; hol += c.hol;
        if (fmt.cell_value === '코드+시각') cellText = `${label} ${hm(r.tin).slice(0, 5)}~${hm(r.tout).slice(0, 5)}`;
        else if (fmt.cell_value === '실근로시간') cellText = c.work.toFixed(1);
      } else if (r.code === 'AL') al++; else if (r.code === 'AB') ab++;
      cells[r.wdate.slice(8)] = cellText;
    }
    sumWork += work; sumOt += ot; sumHol += hol; sumNight += night;
    outRows.push({
      empId: anon ? `익명-${outRows.length + 1}` : empId,
      name: anon ? '' : emp.name,
      jikgun: emp.contract_type,
      cells, days, work: +work.toFixed(1), ot: +ot.toFixed(1), night: +night.toFixed(1), hol: +hol.toFixed(1), al, ab,
    });
  }

  // 합계 대조 행 (§9-5-1 고정 규칙) — 확정 근태 원장 합계와 비교
  const ledgerSum = (await env.DB.prepare(
    useSnapshot
      ? `SELECT code, tin, tout FROM snapshot_ledger WHERE snap_id=?`
      : `SELECT COALESCE(l.confirmed_code,l.proposed_code) code, COALESCE(l.confirmed_in,l.proposed_in) tin, COALESCE(l.confirmed_out,l.proposed_out) tout
         FROM ledger l JOIN employees e ON e.emp_id=l.emp_id WHERE e.site=? AND l.wdate LIKE ?`
  ).bind(...(useSnapshot ? [`${b.site}|${b.ym}`] : [b.site, b.ym + '%'])).all()).results as any[];
  let checkWork = 0;
  for (const r of ledgerSum) { const cd = codeMap.get(r.code); if (cd?.counts_hours && r.tin != null && r.tout != null) checkWork += calc({ code: r.code, in: r.tin, out: r.tout, brk: null }, false, cc => codeMap.get(cc)).work; }
  const reconOk = Math.abs(checkWork - sumWork) < 0.05;

  await env.DB.prepare(
    `INSERT INTO export_history (by_user, by_role, format_id, site, ym, rows, anon, reason) VALUES (?,?,?,?,?,?,?,?)`
  ).bind(user.id, user.role, b.formatId, b.site, b.ym, outRows.length, anon ? 1 : 0, b.reason).run();
  await audit(env, user.id, '내보내기 다운로드', `${fmt.id} ${b.site} ${b.ym}`, `${outRows.length}행 · 비식별=${anon} · ${b.reason}`);

  return json({
    format: { id: fmt.id, name: fmt.name, purpose: fmt.purpose, anon },
    rows: outRows, totals: { work: +sumWork.toFixed(1), ot: +sumOt.toFixed(1), night: +sumNight.toFixed(1), hol: +sumHol.toFixed(1) },
    reconciliation: { ledgerWork: +checkWork.toFixed(1), exportWork: +sumWork.toFixed(1), ok: reconOk },
    filenameHint: `근태_${b.site}_${b.ym.replace('-', '')}_${b.formatId}v${fmt.version}${anon ? '_비식별' : ''}.csv`,
  });
}

// GET /api/export/history?site=
export async function exportHistory(req: Request, env: Env): Promise<Response> {
  const user = await requireUser(req, env);
  requireRole(user, ['jc', 'sys']);
  const site = new URL(req.url).searchParams.get('site');
  const rows = site
    ? await env.DB.prepare('SELECT * FROM export_history WHERE site=? ORDER BY at DESC LIMIT 300').bind(site).all()
    : await env.DB.prepare('SELECT * FROM export_history ORDER BY at DESC LIMIT 300').all();
  return json(rows.results);
}

// POST /api/export/format-requests  { site, request }  — 현장관리자 변경요청 (§9-3)
export async function requestFormatChange(req: Request, env: Env): Promise<Response> {
  const user = await requireUser(req, env);
  requireRole(user, ['mgr']);
  const { site, request } = await req.json<{ site: string; request: string }>();
  if (!request?.trim()) throw httpError(400, '요청 내용은 필수입니다');
  await env.DB.prepare('INSERT INTO format_change_requests (site, requested_by, request) VALUES (?,?,?)').bind(site, user.id, request).run();
  await audit(env, user.id, '양식 변경요청', site, request);
  return json({ ok: true });
}

export async function listFormatChangeRequests(req: Request, env: Env): Promise<Response> {
  const user = await requireUser(req, env);
  requireRole(user, ['sys']);
  const rows = await env.DB.prepare('SELECT * FROM format_change_requests ORDER BY requested_at DESC').all();
  return json(rows.results);
}

export async function resolveFormatChangeRequest(req: Request, env: Env, id: string): Promise<Response> {
  const user = await requireUser(req, env);
  requireRole(user, ['sys']);
  const { status, note } = await req.json<{ status: '반영' | '반려'; note?: string }>();
  await env.DB.prepare(`UPDATE format_change_requests SET status=?, resolved_by=?, resolved_at=datetime('now'), resolve_note=? WHERE id=?`)
    .bind(status, user.id, note ?? null, id).run();
  return json({ ok: true });
}
