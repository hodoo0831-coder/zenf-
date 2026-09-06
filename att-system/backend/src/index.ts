import { Env, errJson, json } from './lib/http';
import { receiveJemos, jemosStatus } from './routes/jemos';
import { listLedger, ledgerHistory, confirmLedger, manualEntry } from './routes/ledger';
import { validateMonth, listExceptions, resolveException } from './routes/validateRoute';
import { confirm1, confirm2, rejectToSite, closeMonth, monthStatus, confirmChecklist } from './routes/confirm';
import { sendErp, exportErpRows, recordUploadResult } from './routes/erp';
import { getRules, putRules, listCodes, addMapping, listAudit } from './routes/admin';
import { applyExcel } from './routes/excel';
import { mySummary, myLedger, myCorrections, submitCorrection, myOtRequests, submitOtRequest } from './routes/worker';
import { listCorrections, approveCorrection, rejectCorrection, listOtRequests, approveOt, rejectOt } from './routes/corrections';
import { listPlan, setPlan, simulatePlan } from './routes/plan';
import { listFormats, upsertFormat, generateExport, exportHistory, requestFormatChange, listFormatChangeRequests, resolveFormatChangeRequest } from './routes/export';
import { uploadOcr, listOcr, confirmOcr, rejectOcr } from './routes/ocr';
import { listUsers, listSites, listEmployees, listHolidays } from './routes/meta';

const CORS = {
  'Access-Control-Allow-Origin': '*', // TODO: 배포 시 실제 프론트 도메인으로 제한
  'Access-Control-Allow-Headers': 'Content-Type, X-User-Id',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
};

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
    const url = new URL(req.url);
    const p = url.pathname;
    const seg = p.split('/').filter(Boolean); // ['api', ...]

    try {
      let res: Response;
      if (p === '/api/jemos/receive' && req.method === 'POST') res = await receiveJemos(req, env);
      else if (p === '/api/jemos/status' && req.method === 'GET') res = await jemosStatus(req, env);

      else if (p === '/api/ledger' && req.method === 'GET') res = await listLedger(req, env);
      else if (seg[1] === 'ledger' && seg[3] === 'history' && req.method === 'GET') res = await ledgerHistory(req, env, seg[2]);
      else if (seg[1] === 'ledger' && seg[3] === 'confirm' && req.method === 'POST') res = await confirmLedger(req, env, seg[2]);
      else if (p === '/api/ledger/manual' && req.method === 'POST') res = await manualEntry(req, env);

      else if (p === '/api/excel/apply' && req.method === 'POST') res = await applyExcel(req, env);

      else if (p === '/api/validate' && req.method === 'POST') res = await validateMonth(req, env);
      else if (p === '/api/exceptions' && req.method === 'GET') res = await listExceptions(req, env);
      else if (seg[1] === 'exceptions' && seg[3] === 'resolve' && req.method === 'POST') res = await resolveException(req, env, seg[2]);

      else if (p === '/api/month/confirm1' && req.method === 'POST') res = await confirm1(req, env);
      else if (p === '/api/month/confirm2' && req.method === 'POST') res = await confirm2(req, env);
      else if (p === '/api/month/reject' && req.method === 'POST') res = await rejectToSite(req, env);
      else if (p === '/api/month/close' && req.method === 'POST') res = await closeMonth(req, env);
      else if (p === '/api/month/status' && req.method === 'GET') res = await monthStatus(req, env);
      else if (p === '/api/month/checklist' && req.method === 'GET') res = await confirmChecklist(req, env);

      else if (p === '/api/me/summary' && req.method === 'GET') res = await mySummary(req, env);
      else if (p === '/api/me/ledger' && req.method === 'GET') res = await myLedger(req, env);
      else if (p === '/api/me/corrections' && req.method === 'GET') res = await myCorrections(req, env);
      else if (p === '/api/me/corrections' && req.method === 'POST') res = await submitCorrection(req, env);
      else if (p === '/api/me/ot-requests' && req.method === 'GET') res = await myOtRequests(req, env);
      else if (p === '/api/me/ot-requests' && req.method === 'POST') res = await submitOtRequest(req, env);

      else if (p === '/api/corrections' && req.method === 'GET') res = await listCorrections(req, env);
      else if (seg[1] === 'corrections' && seg[3] === 'approve' && req.method === 'POST') res = await approveCorrection(req, env, seg[2]);
      else if (seg[1] === 'corrections' && seg[3] === 'reject' && req.method === 'POST') res = await rejectCorrection(req, env, seg[2]);
      else if (p === '/api/ot-requests' && req.method === 'GET') res = await listOtRequests(req, env);
      else if (seg[1] === 'ot-requests' && seg[3] === 'approve' && req.method === 'POST') res = await approveOt(req, env, seg[2]);
      else if (seg[1] === 'ot-requests' && seg[3] === 'reject' && req.method === 'POST') res = await rejectOt(req, env, seg[2]);

      else if (p === '/api/plan' && req.method === 'GET') res = await listPlan(req, env);
      else if (p === '/api/plan' && req.method === 'PUT') res = await setPlan(req, env);
      else if (p === '/api/plan/simulate' && req.method === 'GET') res = await simulatePlan(req, env);

      else if (p === '/api/export/formats' && req.method === 'GET') res = await listFormats(req, env);
      else if (p === '/api/export/formats' && req.method === 'POST') res = await upsertFormat(req, env);
      else if (p === '/api/export/generate' && req.method === 'POST') res = await generateExport(req, env);
      else if (p === '/api/export/history' && req.method === 'GET') res = await exportHistory(req, env);
      else if (p === '/api/export/format-requests' && req.method === 'POST') res = await requestFormatChange(req, env);
      else if (p === '/api/export/format-requests' && req.method === 'GET') res = await listFormatChangeRequests(req, env);
      else if (seg[1] === 'export' && seg[2] === 'format-requests' && seg[4] === 'resolve' && req.method === 'POST') res = await resolveFormatChangeRequest(req, env, seg[3]);

      else if (p === '/api/ocr/uploads' && req.method === 'POST') res = await uploadOcr(req, env);
      else if (p === '/api/ocr/uploads' && req.method === 'GET') res = await listOcr(req, env);
      else if (seg[1] === 'ocr' && seg[2] === 'uploads' && seg[4] === 'confirm' && req.method === 'POST') res = await confirmOcr(req, env, seg[3]);
      else if (seg[1] === 'ocr' && seg[2] === 'uploads' && seg[4] === 'reject' && req.method === 'POST') res = await rejectOcr(req, env, seg[3]);

      else if (p === '/api/erp/send' && req.method === 'POST') res = await sendErp(req, env);
      else if (p === '/api/erp/export' && req.method === 'GET') res = await exportErpRows(req, env);
      else if (p === '/api/erp/upload-result' && req.method === 'POST') res = await recordUploadResult(req, env);

      else if (p === '/api/rules' && req.method === 'GET') res = await getRules(req, env);
      else if (p === '/api/rules' && req.method === 'PUT') res = await putRules(req, env);
      else if (p === '/api/codes' && req.method === 'GET') res = await listCodes(req, env);
      else if (p === '/api/codes/mapping' && req.method === 'POST') res = await addMapping(req, env);
      else if (p === '/api/audit' && req.method === 'GET') res = await listAudit(req, env);

      else if (p === '/api/users' && req.method === 'GET') res = await listUsers(req, env);
      else if (p === '/api/sites' && req.method === 'GET') res = await listSites(req, env);
      else if (p === '/api/employees' && req.method === 'GET') res = await listEmployees(req, env);
      else if (p === '/api/holidays' && req.method === 'GET') res = await listHolidays(req, env);

      else if (p === '/api/health') res = json({ ok: true, jemosMode: env.JEMOS_MODE, erpMode: env.ERP_MODE });
      else res = json({ error: 'Not found' }, 404);

      const h = new Headers(res.headers);
      Object.entries(CORS).forEach(([k, v]) => h.set(k, v));
      return new Response(res.body, { status: res.status, headers: h });
    } catch (e) {
      const res = errJson(e);
      const h = new Headers(res.headers);
      Object.entries(CORS).forEach(([k, v]) => h.set(k, v));
      return new Response(res.body, { status: res.status, headers: h });
    }
  },
};
