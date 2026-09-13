// ============================================================
// 근태 원천등록 · ERP 전송 자동화 — Cloudflare Worker v0.4
// 기능정의서 v1.1 기준. 화면과 로직 분리 — 판정·집계·전송은 전부 여기(API)에 있다.
// 라우트 주석의 F-코드는 기능정의서 기능ID.
//
// 인증: 파일럿 단계 미구현. 제모스는 SSO 미제공(세션 쿠키 방식) 확인됨.
//   → Cloudflare Access로 접근 차단 + X-Actor 헤더로 행위자 식별. 실사용 전 자체 인증 필수.
// ============================================================
import { runMonth, RULES, Env } from "./rules";
import { normalizeDt, normalizeDate } from "./datetime";
import { parseHmsWorkbook, DEFAULT_ALIASES, CanonField } from "./excel";
import { UPLOAD_PAGE } from "./ui";
import { DEMO_PAGE } from "./demo";

const CORS = {
  "access-control-allow-origin": "*",           // 파일럿: 데모 페이지가 별도 도메인. Access 적용 후 좁힌다
  "access-control-allow-methods": "GET,POST,OPTIONS",
  "access-control-allow-headers": "content-type,x-actor",
};
const json = (d: unknown, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json; charset=utf-8", ...CORS } });
const err = (m: string, s = 400) => json({ error: m }, s);
const pkey = (month: string, site: string) => `${month}|${site}`;

async function audit(db: D1Database, actor: string, action: string, target: string, detail?: unknown) {
  await db.prepare("INSERT INTO audit_log (actor, action, target, detail) VALUES (?,?,?,?)").bind(actor, action, target, detail ? JSON.stringify(detail) : null).run();
}
async function getPeriod(db: D1Database, month: string, site: string) {
  let p = await db.prepare("SELECT * FROM period WHERE period_key=?").bind(pkey(month, site)).first<any>();
  if (!p) { await db.prepare("INSERT INTO period (period_key, month, site) VALUES (?,?,?)").bind(pkey(month, site), month, site).run(); p = { period_key: pkey(month, site), month, site, stage: "open" }; }
  return p;
}
const isLocked = (p: any) => p.stage === "locked";

/** 원본 적재 공통 — 채널 무관 같은 규칙 (UNIQUE + OR IGNORE = 이중적재 차단) */
async function ingest(db: D1Database, channel: string, rows: { source_key: string; direction: string; tagged_at: string; lat?: number | null; lng?: number | null; site_hint?: string | null; payload?: unknown }[],
  meta: { targetDate: string; fileName?: string | null; skipped?: number }) {
  const keyCol = channel === "zemos" ? "zemos_key" : "emp_id";
  const staff = (await db.prepare(`SELECT emp_id, ${keyCol} AS k FROM staff WHERE ${keyCol} IS NOT NULL`).all()).results as any[];
  const keyToEmp = new Map(staff.map(s => [String(s.k), s.emp_id]));
  const before = (await db.prepare("SELECT COUNT(*) AS n FROM raw_record").first<{ n: number }>())?.n ?? 0;
  const batchId = `${channel}_${meta.targetDate}_${Date.now()}`;
  const stmt = db.prepare("INSERT OR IGNORE INTO raw_record (channel, source_key, emp_id, direction, tagged_at, lat, lng, site_hint, payload, batch_id) VALUES (?,?,?,?,?,?,?,?,?,?)");
  const unm = db.prepare("INSERT INTO unmapped_key (channel, source_key, work_date, tag_count) VALUES (?,?,?,1) ON CONFLICT(channel, source_key, work_date) DO UPDATE SET tag_count=tag_count+1");
  const stmts: D1PreparedStatement[] = []; let unmapped = 0;
  for (const r of rows) {
    const emp = keyToEmp.get(String(r.source_key)) ?? null;
    if (!emp) { unmapped++; stmts.push(unm.bind(channel, r.source_key, r.tagged_at.slice(0, 10))); }
    stmts.push(stmt.bind(channel, r.source_key, emp, r.direction, r.tagged_at, r.lat ?? null, r.lng ?? null, r.site_hint ?? null, r.payload ? JSON.stringify(r.payload) : null, batchId));
  }
  for (let i = 0; i < stmts.length; i += 100) await db.batch(stmts.slice(i, i + 100));
  const after = (await db.prepare("SELECT COUNT(*) AS n FROM raw_record").first<{ n: number }>())?.n ?? 0;
  const inserted = after - before, duplicates = rows.length - inserted;
  await db.prepare("INSERT INTO collection_log (batch_id, channel, target_date, received_count, duplicate_count, unmapped_count, status, file_name, finished_at) VALUES (?,?,?,?,?,?,?,?, datetime('now'))")
    .bind(batchId, channel, meta.targetDate, inserted, duplicates, unmapped, (meta.skipped ?? 0) > 0 ? "partial" : "success", meta.fileName ?? null).run();
  return { batch_id: batchId, submitted: rows.length, inserted, duplicates_ignored: duplicates, unmapped_keys: unmapped, skipped_error_rows: meta.skipped ?? 0 };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") return new Response(null, { headers: CORS });
    const url = new URL(request.url); const path = url.pathname; const db = env.DB;
    const q = (k: string) => url.searchParams.get(k);
    const actor = request.headers.get("x-actor") || "anonymous";
    const body = async <T,>() => (await request.json()) as T;
    try {
      if (path === "/" && request.method === "GET") return new Response(UPLOAD_PAGE, { headers: { "content-type": "text/html; charset=utf-8" } });
      if ((path === "/demo" || path === "/demo/") && request.method === "GET") return new Response(DEMO_PAGE, { headers: { "content-type": "text/html; charset=utf-8" } });

      // ---------- 기준정보 ----------
      if (path === "/api/staff" && request.method === "GET") return json((await db.prepare("SELECT * FROM staff ORDER BY emp_id").all()).results);
      if (path === "/api/staff" && request.method === "POST") {
        const rows = await body<any[]>(); const list = Array.isArray(rows) ? rows : [rows];
        await db.batch(list.map(s => db.prepare(
          `INSERT INTO staff (emp_id, name, site, line, contract, zemos_key, zemos_user, hired_at) VALUES (?,?,?,?,?,?,?,?)
           ON CONFLICT(emp_id) DO UPDATE SET name=excluded.name, site=excluded.site, line=excluded.line, contract=excluded.contract,
           zemos_key=COALESCE(excluded.zemos_key, staff.zemos_key), zemos_user=excluded.zemos_user, updated_at=datetime('now')`)
          .bind(s.emp_id, s.name, s.site, s.line ?? null, s.contract ?? null, s.zemos_key ?? null, s.zemos_user ?? 1, s.hired_at ?? null)));
        return json({ ok: true, count: list.length });
      }
      if (path === "/api/codes" && request.method === "GET") return json((await db.prepare("SELECT * FROM att_code ORDER BY code").all()).results);
      if (path === "/api/rules" && request.method === "GET") {
        const cfgRows = (await db.prepare("SELECT * FROM rule_config ORDER BY rule_id, param_name").all()).results as any[];
        return json(Object.entries(RULES).map(([id, r]) => ({ id, ...r, params: cfgRows.filter(x => x.rule_id === id).map(x => `${x.param_name}=${x.param_value}`) })));
      }
      if (path === "/api/rules" && request.method === "POST") {
        const b = await body<{ rule_id: string; param_name: string; param_value: string }>();
        if (!b.rule_id || !b.param_name || b.param_value == null) return err("rule_id, param_name, param_value 필요");
        await db.prepare("INSERT INTO rule_config (rule_id, param_name, param_value, updated_by) VALUES (?,?,?,?) ON CONFLICT(rule_id, param_name) DO UPDATE SET param_value=excluded.param_value, updated_by=excluded.updated_by, updated_at=datetime('now')")
          .bind(b.rule_id, b.param_name, String(b.param_value), actor).run();
        await audit(db, actor, "rule.update", `${b.rule_id}:${b.param_name}`, b); return json({ ok: true });
      }
      if (path === "/api/import-profile" && request.method === "GET") return json({ registered: (await db.prepare("SELECT * FROM import_profile").all()).results, defaults: DEFAULT_ALIASES });
      if (path === "/api/import-profile" && request.method === "POST") {
        const b = await body<{ field: CanonField; alias: string }>();
        if (!(b.field in DEFAULT_ALIASES)) return err(`field는 ${Object.keys(DEFAULT_ALIASES).join(", ")} 중 하나`);
        await db.prepare("INSERT OR IGNORE INTO import_profile (field, alias, updated_by) VALUES (?,?,?)").bind(b.field, b.alias, actor).run(); return json({ ok: true });
      }

      // ---------- 근무계획 F-C0101 ----------
      if (path === "/api/plan" && request.method === "GET") {
        const rows = (await db.prepare("SELECT p.*, s.name, s.line FROM work_plan p JOIN staff s ON s.emp_id=p.emp_id WHERE p.work_date LIKE ? AND s.site=? ORDER BY p.emp_id, p.work_date").bind(`${q("month")}%`, q("site")).all()).results;
        return json(rows);
      }
      if (path === "/api/plan" && request.method === "POST") {
        const rows = await body<any[]>(); const list = Array.isArray(rows) ? rows : [rows];
        const p = await getPeriod(db, list[0]?.work_date?.slice(0, 7), q("site") || list[0]?.site || ""); if (isLocked(p)) return err("잠금 상태 — 계획 변경 불가", 423);
        await db.batch(list.map(r => db.prepare(
          `INSERT INTO work_plan (emp_id, work_date, shift, planned_start, planned_end, planned_hours, registered_by) VALUES (?,?,?,?,?,?,?)
           ON CONFLICT(emp_id, work_date) DO UPDATE SET shift=excluded.shift, planned_start=excluded.planned_start, planned_end=excluded.planned_end, planned_hours=excluded.planned_hours, registered_by=excluded.registered_by, registered_at=datetime('now')`)
          .bind(r.emp_id, normalizeDate(r.work_date), r.shift, r.planned_start ?? null, r.planned_end ?? null, r.planned_hours ?? null, actor)));
        await audit(db, actor, "plan.upsert", `${list.length}건`); return json({ ok: true, count: list.length });
      }

      // ---------- 수집 F0 / F-D0105 / F-D0106 ----------
      // 제모스 수신 어댑터 — Q1 회신(API/DB/배치) 어느 쪽이든 이 형태로 넣는다. 제모스에는 쓰지 않는다.
      if (path === "/api/collect/zemos" && request.method === "POST") {
        const b = await body<{ target_date: string; site: string; rows: any[] }>();
        if (!Array.isArray(b.rows) || !b.rows.length) return err("rows 필요");
        const p = await getPeriod(db, normalizeDate(b.target_date).slice(0, 7), b.site); if (isLocked(p)) return err("잠금 상태 — 수집 불가", 423);
        const rows = []; for (let i = 0; i < b.rows.length; i++) { const r = b.rows[i]; try {
          if (!r.zemos_key) throw new Error("zemos_key 없음"); if (r.direction !== "IN" && r.direction !== "OUT") throw new Error("direction은 IN/OUT");
          rows.push({ source_key: String(r.zemos_key), direction: r.direction, tagged_at: normalizeDt(r.tagged_at), lat: r.lat, lng: r.lng, site_hint: r.site, payload: r });
        } catch (e: any) { return err(`${i + 1}행: ${e.message}`); } }
        const res = await ingest(db, "zemos", rows, { targetDate: normalizeDate(b.target_date) });
        await audit(db, "ZEMOS", "collect.zemos", b.site, res); return json(res);
      }
      const isPreview = path === "/api/collect/excel/preview";
      if ((isPreview || path === "/api/collect/excel") && request.method === "POST") {
        const form = await request.formData(); const file = form.get("file") as unknown as { name?: string; size?: number; arrayBuffer?: () => Promise<ArrayBuffer> } | null;
        if (!file || typeof file.arrayBuffer !== "function") return err("file 필드에 엑셀 파일을 첨부하십시오");
        const aliases: Record<CanonField, string[]> = JSON.parse(JSON.stringify(DEFAULT_ALIASES));
        for (const r of (await db.prepare("SELECT field, alias FROM import_profile").all()).results as any[]) aliases[r.field as CanonField]?.push(r.alias);
        let parsed; try { parsed = parseHmsWorkbook(await file.arrayBuffer!(), { sheetName: (form.get("sheet") as string) || undefined, aliases }); } catch (e: any) { return err(`엑셀을 읽지 못했습니다: ${e.message}`); }
        if (parsed.missing_required.length) return err(`필수 컬럼 없음: ${parsed.missing_required.join(", ")} · 인식: ${JSON.stringify(parsed.detected_columns)}`);
        const dates = parsed.rows.map(r => r.tagged_at.slice(0, 10)).sort();
        const summary = { file_name: file.name, sheet_name: parsed.sheet_name, header_row: parsed.header_row, detected_columns: parsed.detected_columns, total_data_rows: parsed.total_data_rows, parsed_rows: parsed.rows.length, error_rows: parsed.errors.length, date_range: dates.length ? { from: dates[0], to: dates[dates.length - 1] } : null, errors: parsed.errors.slice(0, 50), sample: parsed.rows.slice(0, 10) };
        if (isPreview) return json({ mode: "preview", committed: false, ...summary });
        const allowPartial = String(form.get("allow_partial") ?? "") === "true";
        if (parsed.errors.length && !allowPartial) return json({ mode: "commit", committed: false, reason: `오류 ${parsed.errors.length}행 — 전량 미적재. allow_partial=true로 건너뛰기 가능`, ...summary }, 422);
        if (!parsed.rows.length) return err("적재할 행 없음");
        const site = (form.get("site") as string) || "";
        const p = await getPeriod(db, dates[0].slice(0, 7), site); if (isLocked(p)) return err("잠금 상태 — 수집 불가", 423);
        // 엑셀 채널의 source_key는 사번 우선, 없으면 카드번호(사원 마스터의 zemos_key 대체로 매핑 시도)
        const res = await ingest(db, "excel", parsed.rows.map(r => ({ source_key: r.emp_id ?? r.card_no, direction: r.direction, tagged_at: r.tagged_at, site_hint: r.gate, payload: r })), { targetDate: dates[0], fileName: file.name, skipped: parsed.errors.length });
        await audit(db, actor, "collect.excel", file.name ?? "", res); return json({ mode: "commit", committed: true, ...res, ...summary });
      }
      if (path === "/api/collect/manual" && request.method === "POST") {
        const b = await body<{ emp_id: string; direction: "IN" | "OUT"; tagged_at: string; reason: string }>();
        if (!b.emp_id || !b.direction || !b.tagged_at) return err("emp_id, direction, tagged_at 필요");
        if (!b.reason?.trim()) return err("수기 입력은 사유가 필수입니다 (F-D0106)");
        const res = await ingest(db, "manual", [{ source_key: b.emp_id, direction: b.direction, tagged_at: normalizeDt(b.tagged_at), payload: { ...b, tag: "대행입력", by: actor } }], { targetDate: b.tagged_at.slice(0, 10) });
        await audit(db, actor, "collect.manual", b.emp_id, b); return json(res);
      }
      if (path === "/api/collect/log" && request.method === "GET") return json((await db.prepare("SELECT * FROM collection_log ORDER BY started_at DESC LIMIT 50").all()).results);
      if (path === "/api/unmapped" && request.method === "GET") return json((await db.prepare("SELECT * FROM unmapped_key WHERE status=? ORDER BY work_date DESC").bind(q("status") || "open").all()).results);
      if (path === "/api/mapping" && request.method === "POST") {
        const b = await body<{ source_key: string; emp_id: string; channel?: string }>();
        if (!b.source_key || !b.emp_id) return err("source_key, emp_id 필요");
        const ch = b.channel || "zemos";
        if (!(await db.prepare("SELECT 1 FROM staff WHERE emp_id=?").bind(b.emp_id).first())) return err(`사원 마스터에 없는 사번: ${b.emp_id}`, 404);
        await db.batch([
          ...(ch === "zemos" ? [db.prepare("UPDATE staff SET zemos_key=? WHERE emp_id=?").bind(b.source_key, b.emp_id)] : []),
          db.prepare("UPDATE raw_record SET emp_id=? WHERE channel=? AND source_key=? AND emp_id IS NULL").bind(b.emp_id, ch, b.source_key),
          db.prepare("UPDATE unmapped_key SET status='mapped', resolved_emp_id=?, resolved_at=datetime('now') WHERE channel=? AND source_key=? AND status='open'").bind(b.emp_id, ch, b.source_key),
        ]);
        await audit(db, actor, "mapping.set", `${ch}:${b.source_key}→${b.emp_id}`); return json({ ok: true });
      }

      // ---------- 검증 F-F0101 ----------
      if (path === "/api/validate/run" && request.method === "POST") {
        const b = await body<{ month: string; site: string; as_of?: string }>(); if (!b.month || !b.site) return err("month, site 필요");
        const p = await getPeriod(db, b.month, b.site); if (isLocked(p)) return err("잠금 상태 — 검증 불가", 423);
        return json(await runMonth(db, b.month, b.site, b.as_of ? normalizeDate(b.as_of) : undefined));
      }
      if (path === "/api/ledger" && request.method === "GET") {
        const rows = (await db.prepare("SELECT l.*, s.name, s.line FROM ledger l JOIN staff s ON s.emp_id=l.emp_id WHERE l.work_date LIKE ? AND s.site=? " + (q("emp") ? "AND l.emp_id=? " : "") + "ORDER BY l.emp_id, l.work_date")
          .bind(...[`${q("month")}%`, q("site"), ...(q("emp") ? [q("emp")] : [])]).all()).results; return json(rows);
      }
      if (path === "/api/exceptions" && request.method === "GET") {
        const rows = (await db.prepare(`SELECT e.*, COALESCE(s.name,'(미등록)') AS name, s.line FROM exception e LEFT JOIN staff s ON s.emp_id=e.emp_id
          WHERE e.work_date LIKE ? AND (s.site=? OR s.site IS NULL) ` + (q("status") ? "AND e.status=? " : "") +
          `ORDER BY CASE e.level WHEN '오류' THEN 0 WHEN '사전경고' THEN 1 ELSE 2 END, e.work_date, e.emp_id`)
          .bind(...[`${q("month")}%`, q("site"), ...(q("status") ? [q("status")] : [])]).all()).results;
        return json(rows.map((r: any) => ({ ...r, rule_name: RULES[r.rule_id]?.name, detail: safeJson(r.detail) })));
      }
      let m = path.match(/^\/api\/exceptions\/(\d+)\/correct$/);
      if (m && request.method === "POST") {
        const id = +m[1]; const b = await body<{ reason_code: string; note?: string; before_value?: unknown; after_value?: unknown; requires_approval?: boolean }>();
        if (!b.reason_code) return err("보정 사유(reason_code) 필수 — F-G0203");
        const e = await db.prepare("SELECT * FROM exception WHERE id=?").bind(id).first<any>(); if (!e) return err("예외 없음", 404);
        const p = await getPeriod(db, e.work_date.slice(0, 7), (await db.prepare("SELECT site FROM staff WHERE emp_id=?").bind(e.emp_id).first<any>())?.site ?? "");
        if (p.stage === "closed" || p.stage === "locked") return err("마감 후 보정은 재오픈 승인 필요 (F-G0203)", 423);
        const st = b.requires_approval ? "pending_approval" : "fixed";
        await db.batch([
          db.prepare("INSERT INTO correction (exception_id, reason_code, note, before_value, after_value, corrected_by) VALUES (?,?,?,?,?,?)").bind(id, b.reason_code, b.note ?? null, JSON.stringify(b.before_value ?? null), JSON.stringify(b.after_value ?? null), actor),
          db.prepare("UPDATE exception SET status=?, resolved_at=CASE WHEN ?='fixed' THEN datetime('now') ELSE NULL END WHERE id=?").bind(st, st, id),
          db.prepare("UPDATE ledger SET status='corrected', updated_at=datetime('now') WHERE emp_id=? AND work_date=? AND stage!='fixed'").bind(e.emp_id, e.work_date),
        ]);
        await audit(db, actor, "exception.correct", String(id), b); return json({ ok: true, status: st });
      }
      m = path.match(/^\/api\/exceptions\/(\d+)\/reopen$/);
      if (m && request.method === "POST") { await db.prepare("UPDATE exception SET status='open', resolved_at=NULL WHERE id=?").bind(+m[1]).run(); await audit(db, actor, "exception.reopen", m[1]); return json({ ok: true }); }
      if (path === "/api/self/dispute" && request.method === "POST") {
        const b = await body<{ emp_id: string; work_date: string; note: string }>(); if (!b.emp_id || !b.work_date || !b.note) return err("emp_id, work_date, note 필요");
        await db.prepare("INSERT INTO exception (rule_id, emp_id, work_date, level, detail, source) VALUES ('DISPUTE',?,?,'경고',?,'worker')").bind(b.emp_id, normalizeDate(b.work_date), JSON.stringify({ message: b.note })).run();
        await audit(db, b.emp_id, "self.dispute", b.work_date); return json({ ok: true });
      }

      // ---------- 기간 F-G0204 / F-G0302 / F-H0101 / F-H0102 (변경 ③: 서명 조건 없음) ----------
      if (path === "/api/period" && request.method === "GET") return json(await periodState(db, q("month")!, q("site")!));
      m = path.match(/^\/api\/period\/(fix1|unfix1|approve|reject|close|unclose|reopen)$/);
      if (m && request.method === "POST") {
        const b = await body<{ month: string; site: string; comment?: string }>(); const p = await getPeriod(db, b.month, b.site); const k = p.period_key; const act = m[1];
        const st = await periodState(db, b.month, b.site);
        const set = async (stage: string, extra = "") => db.prepare(`UPDATE period SET stage=? ${extra} WHERE period_key=?`).bind(stage, k).run();
        if (act === "fix1")   { if (p.stage !== "open") return err(`현재 단계(${p.stage})에서는 1차 확정을 다시 할 수 없습니다`, 409); if (st.errors_open) return err(`오류 등급 예외 ${st.errors_open}건 미처리 — 1차 확정 차단`, 409); await set("fixed1", `, fixed1_by='${actor}', fixed1_at=datetime('now')`); await db.prepare("UPDATE ledger SET stage='fixed' WHERE work_date LIKE ? AND emp_id IN (SELECT emp_id FROM staff WHERE site=?)").bind(`${b.month}%`, b.site).run(); }
        if (act === "unfix1") { if (["approved","closed","locked"].includes(p.stage)) return err("승인 이후 해제 불가", 409); await set("open"); await db.prepare("UPDATE ledger SET stage='proposed' WHERE work_date LIKE ? AND emp_id IN (SELECT emp_id FROM staff WHERE site=?)").bind(`${b.month}%`, b.site).run(); }
        if (act === "approve") { if (p.stage !== "fixed1") return err("1차 확정 완료 건만 승인 가능", 409); await set("approved", `, approved_by='${actor}', approved_at=datetime('now')`); await db.prepare("INSERT INTO approval (period_key, decision, approver, comment) VALUES (?,'approved',?,?)").bind(k, actor, b.comment ?? null).run(); }
        if (act === "reject")  { if (p.stage !== "fixed1") return err("1차 확정 상태에서만 반송 가능", 409); await set("open"); await db.prepare("UPDATE ledger SET stage='proposed' WHERE work_date LIKE ? AND emp_id IN (SELECT emp_id FROM staff WHERE site=?)").bind(`${b.month}%`, b.site).run(); await db.prepare("INSERT INTO approval (period_key, decision, approver, comment) VALUES (?,'rejected',?,?)").bind(k, actor, b.comment ?? null).run(); }
        if (act === "close")   { if (!st.can_close) return err(`마감 차단: ${st.gate.filter((g: any) => !g.ok).map((g: any) => g.key).join(", ")}`, 409); const snap = await computeAggregate(db, b.month, b.site); await set("closed", `, closed_by='${actor}', closed_at=datetime('now'), snapshot='${JSON.stringify(snap).replace(/'/g, "''")}'`); }
        if (act === "unclose") { if (p.stage !== "closed") return err("마감 상태에서만 취소 가능", 409); await set("approved"); }
        if (act === "reopen")  { if (p.stage !== "locked") return err("잠금 상태에서만 재오픈", 409); await set("closed", ", locked_at=NULL"); }
        await audit(db, actor, `period.${act}`, k, b.comment); return json(await periodState(db, b.month, b.site));
      }

      // ---------- 산출 F-I0101 / F-I0106 / F-I0102 / F-I0109 ----------
      if (path === "/api/aggregate" && request.method === "POST") {
        const b = await body<{ month: string; site: string }>(); const p = await getPeriod(db, b.month, b.site);
        if (!["closed", "locked"].includes(p.stage)) return err("마감 완료 데이터만 집계 대상 (F-I0101)", 409);
        const a = await computeAggregate(db, b.month, b.site);
        const ver = ((await db.prepare("SELECT MAX(version) AS v FROM aggregate WHERE period_key=?").bind(p.period_key).first<{ v: number }>())?.v ?? 0) + 1;
        const r = await db.prepare("INSERT INTO aggregate (period_key, version, head_count, base_hours, ot_hours, night_hours, holi_hours, check_ok, check_log) VALUES (?,?,?,?,?,?,?,?,?)")
          .bind(p.period_key, ver, a.head_count, a.base_hours, a.ot_hours, a.night_hours, a.holi_hours, a.check_ok ? 1 : 0, JSON.stringify(a.checks)).run();
        await audit(db, actor, "aggregate.create", p.period_key, { version: ver, check_ok: a.check_ok }); return json({ id: r.meta.last_row_id, version: ver, ...a });
      }
      if (path === "/api/aggregate" && request.method === "GET") { const r = await db.prepare("SELECT * FROM aggregate WHERE period_key=? ORDER BY version DESC LIMIT 1").bind(pkey(q("month")!, q("site")!)).first<any>(); return json(r ? { ...r, check_log: safeJson(r.check_log) } : null); }
      if (path === "/api/erp/send" && request.method === "POST") {
        // 변경 ②: 직접 전송. 실제 ERP 규격(Q5)은 미확정 — 지금은 어댑터 자리만 두고 수락 응답을 모사한다.
        const b = await body<{ month: string; site: string }>(); const p = await getPeriod(db, b.month, b.site);
        if (p.stage !== "closed") return err(p.stage === "locked" ? "이미 전송·잠금됨 — 재전송은 재오픈 후" : "마감 완료 후 전송 가능", 409);
        const agg = await db.prepare("SELECT * FROM aggregate WHERE period_key=? ORDER BY version DESC LIMIT 1").bind(p.period_key).first<any>();
        if (!agg) return err("집계를 먼저 생성하십시오", 409); if (!agg.check_ok) return err("합계 대조 불일치 — 전송 차단 (F-I0106)", 409);
        const rows = agg.head_count * 2; const ref = `RCV-${b.month.replace("-", "")}-${String(agg.version).padStart(4, "0")}`;
        await db.batch([
          db.prepare("INSERT INTO erp_transfer (period_key, aggregate_id, sent_rows, result, erp_ref, sent_by) VALUES (?,?,?,'accepted',?,?)").bind(p.period_key, agg.id, rows, ref, actor),
          db.prepare("UPDATE period SET stage='locked', locked_at=datetime('now') WHERE period_key=?").bind(p.period_key),   // F-H0102 전송 완료 시 자동 잠금
        ]);
        await audit(db, actor, "erp.send", p.period_key, { rows, ref }); return json({ ok: true, result: "accepted", erp_ref: ref, sent_rows: rows, locked: true, note: "ERP 전송 규격 미확정(Q5) — 수락 응답 모사" });
      }
      if (path === "/api/erp" && request.method === "GET") return json((await db.prepare("SELECT * FROM erp_transfer WHERE period_key=? ORDER BY sent_at DESC").bind(pkey(q("month")!, q("site")!)).all()).results);

      // ---------- 대시보드 번들 / 감사 ----------
      if (path === "/api/state" && request.method === "GET") {
        const month = q("month")!, site = q("site")!;
        const [period, staff, exc, weekly, log] = await Promise.all([
          periodState(db, month, site),
          db.prepare("SELECT emp_id, name, line, zemos_user, zemos_key FROM staff WHERE site=? AND status!='terminated' ORDER BY emp_id").bind(site).all(),
          db.prepare("SELECT e.*, COALESCE(s.name,'(미등록)') AS name, (SELECT reason_code FROM correction c WHERE c.exception_id=e.id ORDER BY c.id DESC LIMIT 1) AS reason FROM exception e LEFT JOIN staff s ON s.emp_id=e.emp_id WHERE e.work_date LIKE ? AND (s.site=? OR s.site IS NULL) ORDER BY CASE e.level WHEN '오류' THEN 0 WHEN '사전경고' THEN 1 ELSE 2 END, e.work_date").bind(`${month}%`, site).all(),
          db.prepare(`SELECT l.emp_id, s.name, s.line, ROUND(SUM(COALESCE(l.work_hours,0)),1) AS actual,
                        (SELECT ROUND(SUM(COALESCE(planned_hours,8)),1) FROM work_plan w WHERE w.emp_id=l.emp_id AND w.work_date LIKE ? AND w.shift NOT IN ('휴무','연차','반차','휴일') AND w.work_date > (SELECT COALESCE(MAX(x.work_date),'') FROM ledger x JOIN staff y ON y.emp_id=x.emp_id WHERE y.site=s.site AND x.work_date LIKE ? AND x.channel!='plan')) AS remaining_plan
                      FROM ledger l JOIN staff s ON s.emp_id=l.emp_id WHERE l.work_date LIKE ? AND s.site=? GROUP BY l.emp_id`).bind(`${month}%`, `${month}%`, `${month}%`, site).all(),
          db.prepare("SELECT * FROM collection_log ORDER BY started_at DESC LIMIT 5").all(),
        ]);
        return json({ month, site, period, staff: staff.results, exceptions: (exc.results as any[]).map(r => ({ ...r, rule_name: RULES[r.rule_id]?.name, detail: safeJson(r.detail) })), weekly: weekly.results, collection: log.results });
      }
      if (path === "/api/audit" && request.method === "GET") return json((await db.prepare("SELECT * FROM audit_log ORDER BY id DESC LIMIT 100").all()).results);

      return err("Not found", 404);
    } catch (e: any) { return err(`서버 오류: ${e.message ?? String(e)}`, 500); }
  },
};

function safeJson(s: any) { try { return typeof s === "string" ? JSON.parse(s) : s; } catch { return s; } }

/** 마감 게이트 (F-H0101). 변경 ③: '미서명' 조건 없음 — 서명 기능이 없는데 조건이 남으면 마감이 영구 차단된다. */
async function periodState(db: D1Database, month: string, site: string) {
  const p = await getPeriod(db, month, site);
  const cnt = async (sql: string, ...b: unknown[]) => (await db.prepare(sql).bind(...b).first<{ n: number }>())?.n ?? 0;
  const errorsOpen = await cnt("SELECT COUNT(*) AS n FROM exception e JOIN staff s ON s.emp_id=e.emp_id WHERE e.work_date LIKE ? AND s.site=? AND e.level='오류' AND e.status IN ('open','pending_approval')", `${month}%`, site);
  const warnOpen = await cnt("SELECT COUNT(*) AS n FROM exception e JOIN staff s ON s.emp_id=e.emp_id WHERE e.work_date LIKE ? AND s.site=? AND e.level!='오류' AND e.status='open'", `${month}%`, site);
  const unmapped = await cnt("SELECT COUNT(*) AS n FROM unmapped_key WHERE work_date LIKE ? AND status='open'", `${month}%`);
  const ledger = await cnt("SELECT COUNT(*) AS n FROM ledger l JOIN staff s ON s.emp_id=l.emp_id WHERE l.work_date LIKE ? AND s.site=?", `${month}%`, site);
  const validated = await cnt("SELECT COUNT(*) AS n FROM audit_log WHERE action='validate.run' AND target=?", `${month}|${site}`) > 0;
  const gate = [
    { key: "근태 수신·검증 실행", ok: validated && ledger > 0, why: validated ? `원장 ${ledger}행` : "미실행" },
    { key: "오류 등급 예외 0건", ok: validated && errorsOpen === 0, why: errorsOpen ? `미처리 오류 ${errorsOpen}건` : "차단 없음" },
    { key: "미매핑 키 0건", ok: unmapped === 0, why: unmapped ? `미매핑 ${unmapped}건` : "없음" },
    { key: "1차 확정 (현장)", ok: ["fixed1", "approved", "closed", "locked"].includes(p.stage), why: p.fixed1_at ?? "미확정" },
    { key: "2차 승인 (J/C)", ok: ["approved", "closed", "locked"].includes(p.stage), why: p.approved_at ?? "미승인" },
  ];
  return { ...p, errors_open: errorsOpen, warnings_open: warnOpen, unmapped_open: unmapped, ledger_rows: ledger, validated, gate, can_close: p.stage === "approved" && gate.every(g => g.ok), signature_required: false };
}

/** 확정 근태 집계 + 합계 대조 (F-I0101 / F-I0106). 마감 스냅샷에도 같은 함수를 쓴다. */
async function computeAggregate(db: D1Database, month: string, site: string) {
  const rows = (await db.prepare("SELECT l.*, s.emp_id AS sid FROM ledger l JOIN staff s ON s.emp_id=l.emp_id WHERE l.work_date LIKE ? AND s.site=?").bind(`${month}%`, site).all()).results as any[];
  const emps = new Set(rows.map(r => r.emp_id));
  let base = 0, ot = 0, night = 0, holi = 0;
  for (const r of rows) { const h = r.work_hours ?? 0; if (r.att_code === "W04") holi += h; else { base += Math.min(h, 8); ot += Math.max(0, h - 8); } if (r.last_out && (r.last_out.slice(11, 13) >= "22" || r.last_out.slice(11, 13) < "06")) night += Math.min(h, 2); }
  const r1 = (x: number) => Math.round(x * 10) / 10;
  const total = r1(base + ot + night + holi), ledgerTotal = r1(rows.reduce((a, r) => a + (r.work_hours ?? 0), 0) + night);
  const staffN = (await db.prepare("SELECT COUNT(*) AS n FROM staff WHERE site=? AND status!='terminated'").bind(site).first<{ n: number }>())?.n ?? 0;
  const unmappedCode = rows.filter(r => r.att_code && !["W01","W02","W03","W04","A01","A02","L01","L02","X01"].includes(r.att_code)).length;
  const checks = [
    { key: "확정 근태 합계 = 집계 합계", ok: Math.abs(total - ledgerTotal) < 0.05, lhs: ledgerTotal, rhs: total },
    { key: "대상 인원 ≤ 재직 인원", ok: emps.size <= staffN, lhs: emps.size, rhs: staffN },
    { key: "근태코드 전건 매핑", ok: unmappedCode === 0, lhs: unmappedCode, rhs: 0 },
  ];
  return { head_count: emps.size, base_hours: r1(base), ot_hours: r1(ot), night_hours: r1(night), holi_hours: r1(holi), total_hours: total, checks, check_ok: checks.every(c => c.ok) };
}
