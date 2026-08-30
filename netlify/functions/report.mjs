// 현장 위험 신고 API — Netlify Functions v2 + Netlify Blobs
// POST /api/report            : 신고 접수 (작업자, 인증 없음)
// POST /api/report {action:"update"} : 상태·메모 변경 (PIN 필요)
// GET  /api/report            : 전체 목록 (PIN 필요)
// GET  /api/report?photo=<id> : 첨부 사진 (PIN 필요)
// PIN은 환경변수 ADMIN_PIN (미설정 시 1234)
import { getStore } from "@netlify/blobs";

export const config = { path: "/api/report" };

const store = () => getStore({ name: "hazard-reports", consistency: "strong" });
const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
const authed = (req) =>
  (req.headers.get("x-sv-pin") || "") === (process.env.ADMIN_PIN || "1234");
const clean = (v, n) => String(v == null ? "" : v).slice(0, n);

export default async (req) => {
  const s = store();

  if (req.method === "POST") {
    let body;
    try {
      body = await req.json();
    } catch {
      return json({ ok: false, error: "bad json" }, 400);
    }

    // 관리자: 상태·조치 메모 변경
    if (body.action === "update") {
      if (!authed(req)) return json({ ok: false, error: "pin" }, 401);
      const id = clean(body.id, 40).replace(/[^A-Za-z0-9-]/g, "");
      const cur = await s.get("r_" + id, { type: "json" });
      if (!cur) return json({ ok: false, error: "not found" }, 404);
      if (body.status) cur.status = clean(body.status, 20);
      if (body.memo !== undefined) cur.memo = clean(body.memo, 2000);
      cur.updated_at = new Date().toISOString();
      await s.setJSON("r_" + id, cur);
      return json({ ok: true });
    }

    // 작업자: 신규 접수 (같은 id 재전송은 덮어쓰기 → 오프라인 재전송에 안전)
    const id =
      clean(body.report_id, 40).replace(/[^A-Za-z0-9-]/g, "") || "SV-" + Date.now();
    const photo =
      typeof body.photo === "string" &&
      body.photo.startsWith("data:image/") &&
      body.photo.length < 4500000
        ? body.photo
        : "";
    const rec = {
      id,
      type: clean(body.type, 20),
      category: clean(body.category, 40),
      site: clean(body.site, 40),
      location: clean(body.location, 80),
      severity: clean(body.severity, 10),
      content: clean(body.content, 4000),
      reporter: clean(body.reporter, 40),
      contact: clean(body.contact, 60),
      submitted_at: clean(body.submitted_at, 40),
      received_at: new Date().toISOString(),
      status: "접수",
      memo: "",
      hasPhoto: !!photo,
    };
    if (!rec.content || !rec.type)
      return json({ ok: false, error: "missing fields" }, 400);
    await s.setJSON("r_" + id, rec);
    if (photo) await s.set("p_" + id, photo);
    return json({ ok: true, id });
  }

  if (req.method === "GET") {
    if (!authed(req)) return json({ ok: false, error: "pin" }, 401);
    const url = new URL(req.url);
    const photoId = url.searchParams.get("photo");
    if (photoId) {
      const p = await s.get("p_" + photoId.replace(/[^A-Za-z0-9-]/g, ""));
      return json({ ok: true, photo: p || "" });
    }
    const { blobs } = await s.list({ prefix: "r_" });
    const items = await Promise.all(
      blobs.map((b) => s.get(b.key, { type: "json" }))
    );
    const reports = items.filter(Boolean);
    reports.sort((a, b) =>
      String(b.received_at || "").localeCompare(String(a.received_at || ""))
    );
    return json({ ok: true, reports });
  }

  return json({ ok: false, error: "method" }, 405);
};
