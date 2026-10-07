import { Env, requireUser, requireRole, json, audit, httpError } from '../lib/http';

interface ParsedRow { empId: string; date: string; rawCode: string; code: string; inMin: number | null; outMin: number | null; brk: number | null; sourceRef: string; }

// POST /api/excel/apply  { site, rows: ParsedRow[] }
// 클라이언트가 SheetJS로 열 자동매핑·근태코드 매핑까지 마친 뒤 반입 가능 행만 전달한다고 가정
// (프론트 구현은 데모 근태자동화_기능데모_v2.html 의 parseXls()/rXlsPreview() 로직 재사용)
export async function applyExcel(req: Request, env: Env): Promise<Response> {
  const user = await requireUser(req, env);
  requireRole(user, ['mgr', 'jc']);
  const { rows, fileName } = await req.json<{ rows: ParsedRow[]; fileName: string }>();
  if (!rows?.length) throw httpError(400, '반입할 행이 없습니다');

  let n = 0;
  for (const r of rows) {
    const existing = await env.DB.prepare(`SELECT id, channel FROM ledger WHERE emp_id=? AND wdate=? AND channel='제모스'`).bind(r.empId, r.date).first<{ id: number }>();

    await env.DB.prepare(
      `INSERT INTO ledger (emp_id, wdate, channel, source_ref, raw_payload, proposed_code, proposed_in, proposed_out, proposed_brk, status)
       VALUES (?,?,'엑셀',?,?,?,?,?,?,'제안')
       ON CONFLICT(emp_id, wdate, channel) DO UPDATE SET raw_payload=excluded.raw_payload,
         proposed_code=excluded.proposed_code, proposed_in=excluded.proposed_in, proposed_out=excluded.proposed_out, proposed_brk=excluded.proposed_brk`
    ).bind(r.empId, r.date, `${fileName}`, JSON.stringify({ rawCode: r.rawCode, sourceRef: r.sourceRef }), r.code, r.inMin, r.outMin, r.brk).run();

    if (existing) {
      // 제모스가 이미 있으면 자동 덮어쓰지 않고 충돌로 등록 (F1 처리규칙 3)
      const excelRow = await env.DB.prepare(`SELECT id FROM ledger WHERE emp_id=? AND wdate=? AND channel='엑셀'`).bind(r.empId, r.date).first<{ id: number }>();
      await env.DB.prepare(`INSERT OR REPLACE INTO ledger_conflicts (ledger_id, other_channel, other_payload) VALUES (?,?,?)`)
        .bind(existing.id, '엑셀', JSON.stringify(r)).run();
    }
    n++;
  }
  await audit(env, user.id, '엑셀 반영', fileName, `${n}행 → 원장 제안값`);
  return json({ ok: true, applied: n, note: '자동검증에서 미매핑 표기(V-10)·채널 불일치(V-15) 여부를 확인하세요' });
}
