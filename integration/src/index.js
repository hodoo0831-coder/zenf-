/*
 * zen-integration-api — AP 대전공장 통합 레이어 Worker
 *
 * 기존 시스템을 "읽기만" 해서 하나의 통합 JSON으로 합치고(/today),
 * 그 통합 데이터를 Claude가 요약해 관리자 브리핑을 만든다(/brief).
 *
 * ● P-BOX·오리콘: 프로덕션 D1(work_records)을 직접 바인딩해 읽는다.
 *   (pbox-orikon-db 와 같은 DB. 기존 시스템은 무변경 — 읽기만.)
 *   공동작업(worker "A+B+C", worker_count) → 인원수로 분배해 개인 실적 산출.
 * ● 폭염/세이프체크/세척: 준비되면 UPSTREAM_* URL 채우면 자동 확장(HTTP fetch).
 *
 * 배포: integration/README.md
 */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};
const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json; charset=utf-8", ...CORS } });

const num = (v, d = 0) => (v == null || isNaN(+v) ? d : +v);
const r1 = (n) => Math.round(n * 10) / 10;
const pick = (o, keys, d) => { for (const k of keys) if (o && o[k] != null) return o[k]; return d; };

async function fetchJSON(url, ms = 6000) {
  if (!url) return { ok: false, error: "no-url" };
  const t0 = Date.now();
  try {
    const ctrl = new AbortController();
    const id = setTimeout(() => ctrl.abort(), ms);
    const r = await fetch(url, { signal: ctrl.signal, headers: { accept: "application/json" } });
    clearTimeout(id);
    if (!r.ok) return { ok: false, error: "http-" + r.status, latency: Date.now() - t0 };
    return { ok: true, data: await r.json(), latency: Date.now() - t0 };
  } catch (e) { return { ok: false, error: String(e && e.message || e), latency: Date.now() - t0 }; }
}

/* ========================================================================
 * P-BOX·오리콘 — work_records 집계 (공동작업 인원수 분배)
 * 실제 스키마: system,date,worker,worker_count,part,work_type,qty_plt,qty_ea,man_hour
 * ====================================================================== */
function aggregateWork(rows) {
  const recs = (rows || []).map((r) => {
    const workers = String(pick(r, ["worker", "작업자"], "")).split(/[+,·]/).map((s) => s.trim()).filter(Boolean);
    const wc = num(pick(r, ["worker_count", "wc"], 0)) || workers.length || 1;
    return {
      date: String(pick(r, ["date", "작업일"], "")).slice(0, 10),
      workers, wc,
      part: pick(r, ["part", "부위"], "") || "미구분",
      type: pick(r, ["work_type", "작업유형", "type"], "") || "기타",
      plt: num(pick(r, ["qty_plt", "plt", "PLT"], 0)),
      ea: num(pick(r, ["qty_ea", "ea", "EA"], 0)),
      mh: num(pick(r, ["man_hour", "mh", "MH"], 0)),
    };
  });
  const totalPLT = r1(recs.reduce((a, r) => a + r.plt, 0));
  const totalEA = recs.reduce((a, r) => a + r.ea, 0);
  const totalMH = r1(recs.reduce((a, r) => a + r.mh, 0));
  const days = new Set(recs.map((r) => r.date).filter(Boolean)).size;
  const groupPLT = (key) => { const m = {}; recs.forEach((r) => { const k = r[key] || "기타"; m[k] = r1((m[k] || 0) + r.plt); }); return m; };
  // 개인 분배 (공동작업은 인원수로 나눔)
  const wmap = {};
  recs.forEach((r) => { const d = r.wc || r.workers.length || 1; r.workers.forEach((w) => { const o = wmap[w] || (wmap[w] = { name: w, mh: 0, plt: 0, ea: 0 }); o.plt += r.plt / d; o.mh += r.mh / d; o.ea += r.ea / d; }); });
  const workers = Object.values(wmap).map((w) => ({ name: w.name, mh: r1(w.mh), plt: r1(w.plt), ea: Math.round(w.ea), pltPerMH: w.mh ? +(w.plt / w.mh).toFixed(2) : 0 })).sort((a, b) => b.plt - a.plt);
  const dmap = {}; recs.forEach((r) => { if (r.date) dmap[r.date] = r1((dmap[r.date] || 0) + r.plt); });
  const daily = Object.keys(dmap).sort().map((d) => ({ date: d, plt: dmap[d] }));
  return {
    records: recs.length, totalPLT, totalEA, totalMH, days,
    pltPerMH: totalMH ? +(totalPLT / totalMH).toFixed(2) : 0,
    eaPerMH: totalMH ? Math.round(totalEA / totalMH) : 0,
    dailyAvgPLT: days ? r1(totalPLT / days) : 0,
    byPart: groupPLT("part"), byType: groupPLT("type"), workers, daily,
  };
}

async function readWorkRecords(env) {
  if (!env.PBOX_DB) return null;
  try {
    const { results } = await env.PBOX_DB
      .prepare("SELECT system,date,worker,worker_count,part,work_type,qty_plt,qty_ea,man_hour FROM work_records")
      .all();
    return results || [];
  } catch (e) { return { __error: String(e && e.message || e) }; }
}

/* 다른 시스템 어댑터 (준비되면 UPSTREAM_* 채우면 동작) */
function adaptHeat(raw) { if (!raw) return null; const wbgt = num(pick(raw, ["wbgt", "WBGT", "value", "index"], 0)); return { wbgt, level: pick(raw, ["level", "grade", "step"], wbgt >= 31 ? "위험" : wbgt >= 28 ? "경고" : wbgt >= 25 ? "주의" : "관심") }; }
function adaptSafecheck(raw) { if (!raw) return null; return { checks: num(pick(raw, ["checks", "count", "total"], 0)), findings: num(pick(raw, ["findings", "issues", "ng"], 0)), open: num(pick(raw, ["open", "unresolved"], 0)) }; }
function adaptWash(raw) { if (!raw) return null; const a = Array.isArray(raw) ? raw : (raw.rows || raw.lines || null); if (a) return { total: a.length, delayed: a.filter((r) => String(pick(r, ["status", "state"], "")).includes("지연")).length }; return { total: num(pick(raw, ["total"], 0)), delayed: num(pick(raw, ["delayed"], 0)) }; }

/* ========================================================================
 * /today — 통합 현황
 * ====================================================================== */
async function buildToday(env) {
  const rows = await readWorkRecords(env);
  const dbErr = rows && rows.__error ? rows.__error : null;
  const all = Array.isArray(rows) ? rows : [];
  const isPbox = (r) => /p.?box/i.test(String(r.system));
  const isOrikon = (r) => /오리콘|orikon/i.test(String(r.system));
  const pbox = all.length ? aggregateWork(all.filter(isPbox)) : null;
  const orikon = all.length ? aggregateWork(all.filter(isOrikon)) : null;
  const combined = all.length ? aggregateWork(all) : null;

  const [ht, sc, ws] = await Promise.all([
    fetchJSON(env.UPSTREAM_HEAT), fetchJSON(env.UPSTREAM_SAFECHECK), fetchJSON(env.UPSTREAM_WASH),
  ]);

  const kpi = {
    pbox, orikon, pboxOrikon: combined,
    heat: ht.ok ? adaptHeat(ht.data) : null,
    safecheck: sc.ok ? adaptSafecheck(sc.data) : null,
    wash: ws.ok ? adaptWash(ws.data) : null,
  };
  const sources = {
    pboxOrikon: { ok: Array.isArray(rows), via: "D1:work_records", records: all.length, error: dbErr },
    heat: { ok: ht.ok, error: ht.error }, safecheck: { ok: sc.ok, error: sc.error }, wash: { ok: ws.ok, error: ws.error },
  };
  const alerts = [];
  if (kpi.heat && kpi.heat.wbgt >= 28) alerts.push({ level: "warn", title: `폭염 ${kpi.heat.level} · WBGT ${kpi.heat.wbgt}℃`, detail: "휴식·수분 조치", src: "heat" });
  if (pbox && pbox.workers.length) {
    const low = pbox.workers.filter((w) => w.pltPerMH > 0 && w.pltPerMH < pbox.pltPerMH * 0.6);
    if (low.length) alerts.push({ level: "warn", title: "P-BOX 생산성 편차", detail: `${low.map((w) => w.name).join("·")} ${low[0].pltPerMH} PLT/MH (평균 ${pbox.pltPerMH})`, src: "pbox" });
  }
  if (kpi.safecheck && kpi.safecheck.open > 0) alerts.push({ level: "bad", title: `세이프체크 미조치 ${kpi.safecheck.open}건`, detail: `금일 지적 ${kpi.safecheck.findings}건`, src: "safecheck" });

  return { asOf: new Date().toISOString(), site: env.SITE || "AP 대전공장", sources, kpi, alerts };
}

/* ========================================================================
 * /brief — Claude 요약 (키 없으면 규칙기반)
 * ====================================================================== */
async function buildBrief(env, today) {
  if (!env.ANTHROPIC_API_KEY) return ruleBrief(today);
  const sys = "너는 AP 대전공장 통합관제 AI다. 아래 실시간 통합현황(JSON)의 숫자에만 근거해 한국어로, 관리자가 아침에 바로 읽을 보고를 과장 없이 쓴다.";
  const user = "다음 통합현황을 요약해줘.\n\n" + JSON.stringify(today) +
    "\n\nJSON만 출력:\n{\"oneLine\":\"관리자 한 줄(핵심 수치+리스크)\",\"kakao\":\"카톡 보고문 3~5줄, 불릿·이모지 가능, 조치 제안 포함\"}";
  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: env.MODEL || "claude-haiku-4-5-20251001", max_tokens: 700, system: sys, messages: [{ role: "user", content: user }] }),
    });
    const d = await r.json();
    const text = (d && d.content && d.content[0] && d.content[0].text) || "";
    const m = text.match(/\{[\s\S]*\}/);
    if (m) { try { return { ...JSON.parse(m[0]), model: d.model }; } catch (e) {} }
    return { oneLine: text.slice(0, 120), kakao: text, model: d.model };
  } catch (e) { return ruleBrief(today, String(e && e.message || e)); }
}
function ruleBrief(t, note) {
  const k = t.kpi || {}, bits = [];
  if (k.pbox) bits.push(`P-BOX ${k.pbox.totalPLT} PLT(${(k.pbox.totalEA || 0).toLocaleString()} EA)·${k.pbox.totalMH} MH·생산성 ${k.pbox.pltPerMH} PLT/MH`);
  if (k.orikon) bits.push(`오리콘 ${k.orikon.totalPLT} PLT(${(k.orikon.totalEA || 0).toLocaleString()} EA)·${k.orikon.totalMH} MH`);
  if (k.heat) bits.push(`폭염 WBGT ${k.heat.wbgt}℃(${k.heat.level})`);
  if (k.safecheck) bits.push(`세이프체크 지적 ${k.safecheck.findings}·미조치 ${k.safecheck.open}`);
  const top = (t.alerts && t.alerts[0]) ? t.alerts[0].title + " — " + t.alerts[0].detail : "특이사항 없음";
  return {
    oneLine: `[통합현황] ${bits.slice(0, 2).join(" / ") || "정상 가동"} · 우선 ${top}`,
    kakao: `📋 AP 대전공장 통합 브리핑 (${t.asOf.slice(0, 16).replace("T", " ")})\n` + bits.map((b) => "• " + b).join("\n") + `\n\n⚠️ 우선조치: ${top}`,
    model: "rule-fallback", note: note || "ANTHROPIC_API_KEY 미설정 — 규칙기반 요약",
  };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return new Response(null, { headers: CORS });
    try {
      if (url.pathname === "/" || url.pathname === "/health")
        return json({ ok: true, service: "zen-integration-api", d1: !!env.PBOX_DB, now: new Date().toISOString() });
      if (url.pathname === "/today") return json(await buildToday(env));
      if (url.pathname === "/brief") {
        let today; if (request.method === "POST") { try { today = await request.json(); } catch (e) {} }
        if (!today || !today.kpi) today = await buildToday(env);
        return json({ ...(await buildBrief(env, today)), today });
      }
      return json({ ok: false, error: "not-found", routes: ["/today", "/brief", "/health"] }, 404);
    } catch (e) { return json({ ok: false, error: String(e && e.message || e) }, 500); }
  },
};
