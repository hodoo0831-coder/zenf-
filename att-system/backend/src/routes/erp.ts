import { Env, requireUser, requireRole, json, audit, httpError } from '../lib/http';
import { getErpAdapter, AttRow, OtRow } from '../adapters/erpAdapter';
import { hm, calc } from '../lib/calc';

async function aggregate(env: Env, site: string, ym: string) {
  const snapId = `${site}|${ym}`;
  const rows = (await env.DB.prepare('SELECT * FROM snapshot_ledger WHERE snap_id=?').bind(snapId).all()).results as any[];
  const codes = (await env.DB.prepare('SELECT * FROM att_codes').all()).results as any[];
  const codeMap = new Map(codes.map(c => [c.code, c]));
  const emps = (await env.DB.prepare('SELECT emp_id, name FROM employees WHERE site=?').bind(site).all()).results as any[];
  const nameOf = new Map(emps.map(e => [e.emp_id, e.name]));

  const att: AttRow[] = [], ot: OtRow[] = [];
  for (const r of rows) {
    const cd = codeMap.get(r.code);
    if (!cd) continue;
    if (cd.counts_hours && r.tin != null && r.tout != null) {
      const c = calc({ code: r.code, in: r.tin, out: r.tout, brk: null }, false, c2 => codeMap.get(c2));
      att.push({ empId: r.emp_id, name: nameOf.get(r.emp_id) ?? '', date: r.wdate, erpCode: cd.erp_code ?? r.code, inHM: hm(r.tin).slice(0, 5), outHM: hm(r.tout).slice(0, 5) });
      if (c.ot > 0 || c.night > 0 || c.hol > 0) ot.push({ empId: r.emp_id, name: nameOf.get(r.emp_id) ?? '', date: r.wdate, otH: c.ot, nightH: c.night, holH: c.hol });
    }
  }
  return { att, ot };
}

// POST /api/erp/send  { site, ym }  — F-I0102 ERP 직접 전송·확정 (기본), API 미개방이면 오류 반환하고 /export 안내
export async function sendErp(req: Request, env: Env): Promise<Response> {
  const user = await requireUser(req, env);
  requireRole(user, ['jc']);
  const { site, ym } = await req.json<{ site: string; ym: string }>();

  const status = await env.DB.prepare('SELECT stage FROM month_status WHERE site=? AND ym=?').bind(site, ym).first<{ stage: string }>();
  if (!status || status.stage !== '마감') throw httpError(400, '마감 전에는 ERP 전송이 불가합니다');

  const { att, ot } = await aggregate(env, site, ym);
  const adapter = getErpAdapter(env.ERP_MODE);

  if (!adapter.supportsDirect()) {
    return json({
      mode: 'FILE', ok: false,
      note: 'ERP 직접 API가 아직 열리지 않았습니다 (md 6절 "확인 필요" 항목). GET /api/erp/export 로 파일을 받아 ERP에 직접 업로드한 뒤, POST /api/erp/upload-result 로 결과를 기록하세요(F-I0109 폴백 경로).',
      rowsAtt: att.length, rowsOt: ot.length,
    }, 200);
  }

  const r1 = await adapter.sendAttendance(site, ym, att);
  const r2 = await adapter.sendOvertime(site, ym, ot);
  const ok = r1.ok && r2.ok;
  const receipt = r1.receiptNo ?? r2.receiptNo ?? null;

  await env.DB.prepare(
    `INSERT INTO erp_transmissions (site, ym, mode, sent_by, rows_att, rows_ot, receipt_no, reject_count, raw_response) VALUES (?,?,?,?,?,?,?,?,?)`
  ).bind(site, ym, 'DIRECT', user.id, att.length, ot.length, receipt, (r1.rejectCount + r2.rejectCount), JSON.stringify({ r1, r2 })).run();

  await env.DB.prepare(`UPDATE month_status SET erp_status=?, erp_receipt=?, stage=? WHERE site=? AND ym=?`)
    .bind(ok ? '확정' : '응답수신', receipt, ok ? 'ERP확정' : '마감', site, ym).run();

  await audit(env, user.id, 'ERP 직접 전송', `${site} ${ym}`, `att=${att.length} ot=${ot.length} 접수=${receipt ?? '-'} ok=${ok}`);
  return json({ mode: 'DIRECT', ok, receipt, rowsAtt: att.length, rowsOt: ot.length });
}

// GET /api/erp/export?site=&ym=&kind=att|ot  — FILE 폴백 경로 산출물 (F-I0109)
// 실제 파일 바이너리 생성은 워커에서 SheetJS로 만들거나, 프론트에서 이 JSON을 받아 클라이언트 사이드에서 xlsx로 내려받는다.
export async function exportErpRows(req: Request, env: Env): Promise<Response> {
  await requireUser(req, env);
  const url = new URL(req.url);
  const site = url.searchParams.get('site')!, ym = url.searchParams.get('ym')!;
  const { att, ot } = await aggregate(env, site, ym);
  return json({ att, ot, filenameHint: `근태업로드_제니엘_${site}_${ym.replace('-', '')}` });
}

// POST /api/erp/upload-result  { site, ym, ok, receiptNo, note }  — 사람이 ERP에 직접 업로드한 결과 기록 (F-I0109)
export async function recordUploadResult(req: Request, env: Env): Promise<Response> {
  const user = await requireUser(req, env);
  requireRole(user, ['jc']);
  const b = await req.json<{ site: string; ym: string; ok: boolean; receiptNo?: string; note?: string }>();
  await env.DB.prepare(
    `INSERT INTO erp_transmissions (site, ym, mode, sent_by, rows_att, rows_ot, receipt_no, reject_count, raw_response) VALUES (?,?, 'FILE', ?, NULL, NULL, ?, ?, ?)`
  ).bind(b.site, b.ym, user.id, b.receiptNo ?? null, b.ok ? 0 : 1, b.note ?? '').run();
  await env.DB.prepare(`UPDATE month_status SET erp_status=?, erp_receipt=?, stage=? WHERE site=? AND ym=?`)
    .bind(b.ok ? '확정' : '응답수신', b.receiptNo ?? null, b.ok ? 'ERP확정' : '마감', b.site, b.ym).run();
  await audit(env, user.id, 'ERP 업로드 결과 기록(F-I0109)', `${b.site} ${b.ym}`, JSON.stringify(b));
  return json({ ok: true });
}
