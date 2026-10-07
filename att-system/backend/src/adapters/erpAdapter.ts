// ERP 전송 어댑터 (F-I0102, 09.04 개편: 파일 생성 → 직접 전송 기본 경로)
// md 6절: ERP API 개방 여부 미확정 → 개방 전까지는 F-I0109 파일 경로가 폴백.

export interface AttRow { empId: string; name: string; date: string; erpCode: string; inHM: string; outHM: string; memo?: string; }
export interface OtRow  { empId: string; name: string; date: string; otH: number; nightH: number; holH: number; }

export interface ErpSendResult { ok: boolean; receiptNo?: string; rejectCount: number; rawResponse: unknown; }

export interface ErpAdapter {
  /** true면 DIRECT(API) 경로, false면 FILE(생성만 하고 사람이 ERP에 직접 업로드) 경로 */
  supportsDirect(): boolean;
  sendAttendance(site: string, ym: string, rows: AttRow[]): Promise<ErpSendResult>;
  sendOvertime(site: string, ym: string, rows: OtRow[]): Promise<ErpSendResult>;
}

/** DIRECT 모드 — 실제 ERP API 스펙 확정 후 fetch 호출부만 채우면 됨 */
export class ErpDirectAdapter implements ErpAdapter {
  constructor(private baseUrl: string, private authHeader: () => Promise<string>) {}
  supportsDirect() { return true; }
  async sendAttendance(site: string, ym: string, rows: AttRow[]): Promise<ErpSendResult> {
    // TODO: 실제 ERP API 확정 후 구현
    // const res = await fetch(`${this.baseUrl}/attendance/batch`, { method:'POST', headers:{Authorization: await this.authHeader()}, body: JSON.stringify({site,ym,rows}) });
    throw new Error('ERP Direct API 미구성 — ERP_MODE=FILE 로 두고 F-I0109 경로 사용');
  }
  async sendOvertime(): Promise<ErpSendResult> {
    throw new Error('ERP Direct API 미구성');
  }
}

/** FILE 모드 — 산출물만 만들고, 사람이 ERP에 직접 업로드 후 결과를 /erp/upload-result 로 기록(F-I0109) */
export class ErpFileFallbackAdapter implements ErpAdapter {
  supportsDirect() { return false; }
  async sendAttendance(): Promise<ErpSendResult> {
    return { ok: false, rejectCount: 0, rawResponse: 'FILE 모드 — /api/erp/export 로 파일을 받아 ERP에서 직접 업로드하세요' };
  }
  async sendOvertime(): Promise<ErpSendResult> {
    return { ok: false, rejectCount: 0, rawResponse: 'FILE 모드' };
  }
}

export function getErpAdapter(mode: string): ErpAdapter {
  if (mode === 'DIRECT') return new ErpDirectAdapter('', async () => '');
  return new ErpFileFallbackAdapter();
}
