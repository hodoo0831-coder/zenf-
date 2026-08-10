/*
 * zen-integration-api — AP 대전공장 통합 레이어 Worker
 *
 * 기존 시스템(pbox-orikon-db, safecheck, heat-push, wash-db …)을 "읽기만" 해서
 * 하나의 통합 JSON으로 합쳐 대시보드에 실시간으로 내려주고(/today),
 * 그 통합 데이터를 Claude가 요약해 관리자 브리핑을 만든다(/brief).
 *
 * 기존 시스템은 절대 건드리지 않는다. 이 Worker는 상위 한 겹(aggregation)일 뿐.
 *
 * 배포: integration/README.md 참고 (wrangler deploy 한 줄)
 */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};
const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json; charset=utf-8", ...CORS } });

// 상위 시스템에서 JSON 안전하게 가져오기 (타임아웃·에러 격리)
async function fetchJSON(url, ms = 6000) {
  if (!url) return { ok: false, error: "no-url" };
  const t0 = Date.now();
  try {
    const ctrl = new AbortController();
    const id = setTimeout(() => ctrl.abort(), ms);
    const r = await fetch(url, { signal: ctrl.signal, headers: { accept: "application/json" } });
    clearTimeout(id);
    if (!r.ok) return { ok: false, error: "http-" + r.status, latency: Date.now() - t0 };
    const data = await r.json();
    return { ok: true, data, latency: Date.now() - t0 };
  } catch (e) {
    return { ok: false, error: String(e && e.message || e), latency: Date.now() - t0 };
  }
}

const num = (v, d = 0) => (v == null || isNaN(+v) ? d : +v);
const pick = (o, keys, d) => { for (const k of keys) if (o && o[k] != null) return o[k]; return d; };

/* ========================================================================
 * ADAPTERS — 시스템별 원본 JSON → 통합 스키마 매핑.
 * ⚠️ 여기만 각 시스템의 실제 필드명에 맞추면 됩니다. (나머지는 그대로 동작)
 * ====================================================================== */

// P-BOX·오리콘: 금일 작업/오류/성공률/대기
function adaptPbox(raw) {
  if (!raw) return null;
  // 배열(로그)로 오면 집계, 객체(요약)면 필드에서 추출 — 둘 다 대응
  const arr = Array.isArray(raw) ? raw : (raw.rows || raw.results || raw.items || null);
  if (arr) {
    const today = new Date().toISOString().slice(0, 10);
    const t = arr.filter(r => String(pick(r, ["date", "ts", "created_at", "time"], "")).slice(0, 10) === today);
    const rows = t.length ? t : arr;
    const err = rows.filter(r => {
      const s = String(pick(r, ["status", "result", "state"], "")).toLowerCase();
      return s.includes("err") || s.includes("fail") || s.includes("ng") || pick(r, ["error", "is_error"], 0);
    }).length;
    return {
      todayCount: rows.length,
      errorCount: err,
      successRate: rows.length ? +(100 * (rows.length - err) / rows.length).toFixed(1) : 100,
      pending: rows.filter(r => String(pick(r, ["status", "state"], "")).toLowerCase().includes("pend")).length,
    };
  }
  return {
    todayCount: num(pick(raw, ["todayCount", "today_count", "count", "total", "work_count"], 0)),
    errorCount: num(pick(raw, ["errorCount", "error_count", "errors", "ng", "fail"], 0)),
    successRate: num(pick(raw, ["successRate", "success_rate", "rate"], 100)),
    pending: num(pick(raw, ["pending", "waiting", "queue"], 0)),
  };
}

// 세이프체크: 금일 점검/지적/미조치
function adaptSafecheck(raw) {
  if (!raw) return null;
  return {
    checks: num(pick(raw, ["checks", "today", "count", "total"], 0)),
    findings: num(pick(raw, ["findings", "issues", "ng", "defects"], 0)),
    open: num(pick(raw, ["open", "unresolved", "pending"], 0)),
    sites: num(pick(raw, ["sites", "site_count"], 0)),
  };
}

// 폭염(WBGT): 현재 온열지수·단계
function adaptHeat(raw) {
  if (!raw) return null;
  const wbgt = num(pick(raw, ["wbgt", "WBGT", "value", "index"], 0), 0);
  const level = pick(raw, ["level", "grade", "step", "stage"], wbgt >= 31 ? "위험" : wbgt >= 28 ? "경고" : wbgt >= 25 ? "주의" : "관심");
  return { wbgt, level };
}

// 세척: 진행/완료/지연 라인
function adaptWash(raw) {
  if (!raw) return null;
  const arr = Array.isArray(raw) ? raw : (raw.rows || raw.lines || null);
  if (arr) return {
    total: arr.length,
    done: arr.filter(r => String(pick(r, ["status", "state"], "")).includes("완료") || pick(r, ["done"], 0)).length,
    delayed: arr.filter(r => String(pick(r, ["status", "state"], "")).includes("지연")).length,
  };
  return {
    total: num(pick(raw, ["total", "count"], 0)),
    done: num(pick(raw, ["done", "completed"], 0)),
    delayed: num(pick(raw, ["delayed", "delay"], 0)),
  };
}

/* ========================================================================
 * /today — 통합 현황
 * ====================================================================== */
async function buildToday(env) {
  const [pb, sc, ht, ws] = await Promise.all([
    fetchJSON(env.UPSTREAM_PBOX),
    fetchJSON(env.UPSTREAM_SAFECHECK),
    fetchJSON(env.UPSTREAM_HEAT),
    fetchJSON(env.UPSTREAM_WASH),
  ]);
  const sources = {
    pbox: { ok: pb.ok, latency: pb.latency, error: pb.error },
    safecheck: { ok: sc.ok, latency: sc.latency, error: sc.error },
    heat: { ok: ht.ok, latency: ht.latency, error: ht.error },
    wash: { ok: ws.ok, latency: ws.latency, error: ws.error },
  };
  const kpi = {
    pboxOrikon: pb.ok ? adaptPbox(pb.data) : null,
    safecheck: sc.ok ? adaptSafecheck(sc.data) : null,
    heat: ht.ok ? adaptHeat(ht.data) : null,
    wash: ws.ok ? adaptWash(ws.data) : null,
  };
  const alerts = [];
  if (kpi.heat && kpi.heat.wbgt >= 28) alerts.push({ level: "warn", title: `폭염 ${kpi.heat.level} · WBGT ${kpi.heat.wbgt}℃`, detail: "휴식·수분 조치 필요", src: "heat" });
  if (kpi.pboxOrikon && kpi.pboxOrikon.errorCount > 0) alerts.push({ level: "warn", title: `P-BOX·오리콘 오류 ${kpi.pboxOrikon.errorCount}건`, detail: `성공률 ${kpi.pboxOrikon.successRate}%`, src: "pbox" });
  if (kpi.safecheck && kpi.safecheck.open > 0) alerts.push({ level: "bad", title: `세이프체크 미조치 ${kpi.safecheck.open}건`, detail: `금일 지적 ${kpi.safecheck.findings}건`, src: "safecheck" });
  if (kpi.wash && kpi.wash.delayed > 0) alerts.push({ level: "warn", title: `세척 지연 ${kpi.wash.delayed}라인`, detail: "우선순위 재조정 필요", src: "wash" });

  return {
    asOf: new Date().toISOString(),
    site: env.SITE || "AP 대전공장",
    sources,
    kpi,
    alerts,
  };
}

/* ========================================================================
 * /brief — 통합 데이터 → Claude 요약(관리자 한 줄 + 카톡 보고문)
 * ====================================================================== */
async function buildBrief(env, today) {
  if (!env.ANTHROPIC_API_KEY) {
    // 키 없으면 규칙 기반 폴백(데모에서 키 없이도 동작)
    return ruleBrief(today);
  }
  const sys = "너는 AP 대전공장 통합관제 AI다. 아래 실시간 통합현황(JSON)을 근거로 한국어로 답한다. " +
    "과장 없이 숫자에 기반해 관리자가 아침에 바로 읽을 보고를 쓴다.";
  const user = "다음 통합현황을 요약해줘.\n\n" + JSON.stringify(today) +
    "\n\n형식(JSON만 출력):\n{\"oneLine\":\"관리자 한 줄 요약(핵심 리스크+수치)\",\"kakao\":\"카톡 보고문(3~5줄, 이모지·불릿 가능, 조치 제안 포함)\"}";
  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: env.MODEL || "claude-haiku-4-5-20251001",
        max_tokens: 700,
        system: sys,
        messages: [{ role: "user", content: user }],
      }),
    });
    const d = await r.json();
    const text = (d && d.content && d.content[0] && d.content[0].text) || "";
    const m = text.match(/\{[\s\S]*\}/);
    if (m) { try { return { ...JSON.parse(m[0]), model: d.model }; } catch (e) {} }
    return { oneLine: text.slice(0, 120), kakao: text, model: d.model };
  } catch (e) {
    return ruleBrief(today, String(e && e.message || e));
  }
}

function ruleBrief(t, note) {
  const k = t.kpi || {};
  const bits = [];
  if (k.pboxOrikon) bits.push(`P-BOX·오리콘 ${k.pboxOrikon.todayCount}건(오류 ${k.pboxOrikon.errorCount}·성공률 ${k.pboxOrikon.successRate}%)`);
  if (k.heat) bits.push(`폭염 WBGT ${k.heat.wbgt}℃(${k.heat.level})`);
  if (k.safecheck) bits.push(`세이프체크 지적 ${k.safecheck.findings}·미조치 ${k.safecheck.open}`);
  if (k.wash) bits.push(`세척 ${k.wash.done}/${k.wash.total} 완료·지연 ${k.wash.delayed}`);
  const top = (t.alerts && t.alerts[0]) ? t.alerts[0].title : "특이사항 없음";
  return {
    oneLine: `[통합현황] ${top} · ${bits.slice(0, 2).join(" / ") || "정상 가동"}`,
    kakao: `📋 AP 대전공장 통합 브리핑 (${t.asOf.slice(0, 16).replace("T", " ")})\n` +
      bits.map(b => "• " + b).join("\n") +
      `\n\n⚠️ 우선: ${top}`,
    model: "rule-fallback",
    note: note || "ANTHROPIC_API_KEY 미설정 — 규칙기반 요약",
  };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return new Response(null, { headers: CORS });
    try {
      if (url.pathname === "/" || url.pathname === "/health")
        return json({ ok: true, service: "zen-integration-api", now: new Date().toISOString() });

      if (url.pathname === "/today") return json(await buildToday(env));

      if (url.pathname === "/brief") {
        let today;
        if (request.method === "POST") { try { today = await request.json(); } catch (e) {} }
        if (!today || !today.kpi) today = await buildToday(env);
        return json({ ...(await buildBrief(env, today)), today });
      }
      return json({ ok: false, error: "not-found", routes: ["/today", "/brief", "/health"] }, 404);
    } catch (e) {
      return json({ ok: false, error: String(e && e.message || e) }, 500);
    }
  },
};
