// 젠타임(통합 근태관리) 상태 API — Netlify Functions v2 + Netlify Blobs
//
//   GET  /api/att            : 전체 상태 + 버전 반환
//   GET  /api/att?ver=1      : 버전만 반환 (폴링용 · 가벼움)
//   POST /api/att            : 변경분 병합 저장 (PIN 필요)
//   POST /api/att {action:"reset"} : 상태 초기화 (PIN 필요)
//
// 저장하는 것은 "사람이 한 행위"의 변경분(delta)뿐이다.
// 근태 원장의 기준값(제모스 수신분)은 클라이언트가 시드로 생성하고,
// 그 위에 이 delta 를 덮어 최종 상태를 만든다.
//
// PIN 은 환경변수 ZENTIME_PIN (미설정 시 1234).
// ※ 파일럿 검증용이다. 실제 사번·성명 등 개인정보는 넣지 않는다.
import { getStore } from "@netlify/blobs";

export const config = { path: "/api/att" };

const KEY = "state";
const store = () => getStore({ name: "zentime", consistency: "strong" });

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });

const authed = (req) =>
  (req.headers.get("x-zt-pin") || "") === (process.env.ZENTIME_PIN || "1234");

const EMPTY = {
  ver: 0,
  updated_at: "",
  updated_by: "",
  dayFix: {},   // "사번|YM|일" → 확정값 보정
  sitest: {},   // "현장|YM"    → 1차확정·2차승인·마감 상태
  reqs: [],     // 정정·연장 요청
  erptx: [],    // ERP 전송 이력
  audit: [],    // 감사 로그
  planlog: [],  // 근무계획 등록·변경 이력
  dist: [],     // 고객사 리포트 배포 이력
  maps: [],     // 매핑 규칙
  unmapped: [], // 미매핑 코드
  rules: {},    // 검증 Rule on/off
};

const LIMIT = { audit: 800, reqs: 500, erptx: 300, planlog: 300, dist: 300 };

/* 배열 병합 — 키가 같으면 나중 것으로 덮고, 없으면 추가 (append-only 보존) */
function mergeList(base, incoming, keyOf, max) {
  const map = new Map();
  for (const it of Array.isArray(base) ? base : []) map.set(keyOf(it), it);
  for (const it of Array.isArray(incoming) ? incoming : []) map.set(keyOf(it), it);
  const out = [...map.values()];
  out.sort((a, b) =>
    String(b.at || b.t || "").localeCompare(String(a.at || a.t || ""))
  );
  return out.slice(0, max);
}

/* 값이 무한정 커지는 것을 막는 상한. 자르면 데이터가 조용히 사라지므로
   실제 사용량보다 넉넉하게 잡는다 (현장 3 × 4개월 기준 수십 건 수준). */
const MAX_KEYS = 5000;
function trim(v, n) {
  return typeof v === "string" ? v.slice(0, n) : v;
}
function sanitize(obj, n = 600) {
  if (!obj || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.slice(0, MAX_KEYS).map((x) => sanitize(x, n));
  const out = {};
  for (const k of Object.keys(obj).slice(0, MAX_KEYS)) out[k] = sanitize(trim(obj[k], n), n);
  return out;
}

function merge(cur, inc) {
  const next = { ...cur };
  next.dayFix = { ...(cur.dayFix || {}), ...sanitize(inc.dayFix || {}) };
  next.sitest = { ...(cur.sitest || {}), ...sanitize(inc.sitest || {}) };
  next.rules = { ...(cur.rules || {}), ...sanitize(inc.rules || {}) };

  next.reqs = mergeList(cur.reqs, sanitize(inc.reqs), (r) => r.id, LIMIT.reqs);
  next.audit = mergeList(
    cur.audit,
    sanitize(inc.audit),
    (a) => [a.t, a.u, a.act, a.tgt].join("|"),
    LIMIT.audit
  );
  next.erptx = mergeList(
    cur.erptx,
    sanitize(inc.erptx),
    (t) => [t.ym, t.site, t.ver, t.at].join("|"),
    LIMIT.erptx
  );
  next.planlog = mergeList(
    cur.planlog,
    sanitize(inc.planlog),
    (p) => [p.ym, p.site, p.at, p.act].join("|"),
    LIMIT.planlog
  );
  next.dist = mergeList(
    cur.dist,
    sanitize(inc.dist),
    (d) => [d.ym, d.site, d.at].join("|"),
    LIMIT.dist
  );

  // 매핑 규칙·미매핑 목록은 관리자가 통째로 관리 → 마지막 값 채택
  if (Array.isArray(inc.maps)) next.maps = sanitize(inc.maps).slice(0, 300);
  if (Array.isArray(inc.unmapped)) next.unmapped = sanitize(inc.unmapped).slice(0, 300);

  return next;
}

async function read(s) {
  const cur = await s.get(KEY, { type: "json" });
  return cur && typeof cur === "object" ? { ...EMPTY, ...cur } : { ...EMPTY };
}

export default async (req) => {
  const s = store();

  if (req.method === "GET") {
    const url = new URL(req.url);
    const cur = await read(s);
    if (url.searchParams.get("ver") !== null) {
      return json({
        ok: true,
        ver: cur.ver,
        updated_at: cur.updated_at,
        updated_by: cur.updated_by,
      });
    }
    return json({ ok: true, ver: cur.ver, state: cur });
  }

  if (req.method === "POST") {
    if (!authed(req)) return json({ ok: false, error: "pin" }, 401);

    let body;
    try {
      body = await req.json();
    } catch {
      return json({ ok: false, error: "bad json" }, 400);
    }

    if (body.action === "reset") {
      const fresh = { ...EMPTY, updated_at: new Date().toISOString(), updated_by: trim(body.by, 40) || "" };
      await s.setJSON(KEY, fresh);
      return json({ ok: true, ver: 0, state: fresh });
    }

    const inc = body.state;
    if (!inc || typeof inc !== "object")
      return json({ ok: false, error: "no state" }, 400);

    const cur = await read(s);
    const next = merge(cur, inc);
    next.ver = (cur.ver || 0) + 1;
    next.updated_at = new Date().toISOString();
    next.updated_by = trim(body.by, 40) || "";

    await s.setJSON(KEY, next);
    return json({ ok: true, ver: next.ver, state: next });
  }

  return json({ ok: false, error: "method" }, 405);
};
