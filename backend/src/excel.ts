// ============================================================
// ① 1-1 HMS 출입기록 엑셀 파서
//
// HMS 실 연계(API)는 보안 정책상 불가하므로, 담당자가 HMS에서 내려받은
// 엑셀을 그대로 올리는 경로가 유일한 수집 수단이다. 따라서 파서는
// '깨끗한 표'를 가정하지 않고 실제 내보내기 파일의 지저분함을 견뎌야 한다.
//
// 견디는 것들
//   - 제목행·안내문·빈 줄이 헤더 위에 붙어 있는 경우   → 헤더 행 자동 탐지
//   - 시각이 엑셀 시리얼 숫자(46261.8333)로 들어오는 경우 → 벽시계 시각으로 복원
//   - 날짜/시각 컬럼이 분리된 경우                      → 합쳐서 처리
//   - '입문/출문', '출근/퇴근', 'IN/OUT' 등 표기 차이     → 별칭 테이블로 흡수
//   - 컬럼명이 현장마다 다른 경우                        → import_profile 테이블로 코드 수정 없이 대응
// ============================================================
import * as XLSX from "xlsx";
import { normalizeDt, normalizeDate } from "./datetime";

export type CanonField = "card_no" | "emp_id" | "direction" | "tagged_at" | "work_date" | "time_only" | "gate";

/** 기본 컬럼 별칭. import_profile 테이블에 행을 넣으면 현장별로 덮어쓸 수 있다. */
export const DEFAULT_ALIASES: Record<CanonField, string[]> = {
  card_no:   ["카드번호", "카드No", "카드 번호", "출입증번호", "출입증", "card_no", "cardno", "카드ID"],
  emp_id:    ["사번", "사원번호", "직원번호", "emp_id", "empno", "사원No"],
  direction: ["출입구분", "구분", "입출구분", "출입유형", "direction", "inout", "출입"],
  tagged_at: ["출입일시", "일시", "태깅일시", "출입시각", "발생일시", "tagged_at", "datetime", "일시각"],
  work_date: ["출입일자", "일자", "날짜", "근무일자", "date", "work_date"],
  time_only: ["시각", "시간", "출입시간", "time"],
  gate:      ["게이트", "출입문", "리더기", "장치명", "gate", "출입구", "위치"],
};

/** 출입 방향 표기 별칭. */
const DIRECTION_ALIASES: Record<"IN" | "OUT", string[]> = {
  IN:  ["입문", "입", "출근", "입실", "in", "입장", "entry", "enter"],
  OUT: ["출문", "출", "퇴근", "퇴실", "out", "퇴장", "exit", "leave"],
};

export interface ParsedRow {
  card_no: string;
  direction: "IN" | "OUT";
  tagged_at: string;   // 'YYYY-MM-DD HH:MM:SS'
  gate: string | null;
  emp_id: string | null;
  _row: number;        // 엑셀 원본 행 번호 (1-base) — 오류 안내용
}

export interface RowError {
  row: number;
  message: string;
}

export interface ParseResult {
  sheet_name: string;
  header_row: number;                       // 엑셀 기준 1-base 행 번호
  detected_columns: Record<string, string>; // 표준필드 → 실제 헤더명
  missing_required: CanonField[];
  total_data_rows: number;
  rows: ParsedRow[];
  errors: RowError[];
}

const norm = (v: unknown) => String(v ?? "").replace(/[\s_·.]/g, "").toLowerCase();

/**
 * 엑셀 시리얼 값을 벽시계 시각 문자열로 복원한다.
 * 기준일 1899-12-30 (1900 윤년 버그 포함 체계). UTC 연산으로 처리해
 * 실행 환경의 타임존에 따라 결과가 달라지지 않게 한다.
 */
export function excelSerialToDt(serial: number): string {
  if (!Number.isFinite(serial) || serial <= 0) throw new Error(`엑셀 시각 값이 올바르지 않습니다: ${serial}`);
  const EPOCH = Date.UTC(1899, 11, 30);
  // 초 단위 반올림 — 부동소수 오차로 07:59:59.9997 같은 값이 나오는 것을 막는다
  const ms = EPOCH + Math.round(serial * 86400) * 1000;
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ` +
    `${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`
  );
}

/** 시각 셀 하나를 정규화한다. 엑셀 시리얼과 문자열 표기를 모두 받는다. */
function cellToDt(v: unknown): string {
  if (typeof v === "number") return excelSerialToDt(v);
  if (v instanceof Date) return excelSerialToDt((v.getTime() - Date.UTC(1899, 11, 30)) / 86400000);
  return normalizeDt(v);
}

/** 날짜 셀 + 시각 셀이 분리되어 있을 때 합친다. */
function combineDateTime(dateCell: unknown, timeCell: unknown): string {
  const datePart =
    typeof dateCell === "number" ? excelSerialToDt(dateCell).slice(0, 10) : normalizeDate(dateCell);
  if (typeof timeCell === "number") {
    // 시각만 있는 셀은 0~1 사이 소수(하루의 비율)
    const secs = Math.round((timeCell % 1) * 86400);
    const p = (n: number) => String(n).padStart(2, "0");
    return `${datePart} ${p(Math.floor(secs / 3600))}:${p(Math.floor((secs % 3600) / 60))}:${p(secs % 60)}`;
  }
  const t = String(timeCell ?? "").trim();
  const m = /^(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?$/.exec(t);
  if (!m) throw new Error(`시각 형식을 인식할 수 없습니다: ${t}`);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${datePart} ${p(+m[1])}:${p(+m[2])}:${p(+(m[3] ?? 0))}`;
}

function toDirection(v: unknown): "IN" | "OUT" {
  const s = norm(v);
  if (!s) throw new Error("출입구분이 비어 있습니다");
  for (const [dir, aliases] of Object.entries(DIRECTION_ALIASES)) {
    if (aliases.some((a) => s === norm(a) || s.includes(norm(a)))) return dir as "IN" | "OUT";
  }
  throw new Error(`출입구분을 알 수 없습니다: ${String(v)} (입문/출문, 출근/퇴근, IN/OUT 형태를 인식합니다)`);
}

/**
 * 헤더 행을 찾는다. HMS 내보내기는 제목·조회조건·빈 줄이 위에 붙는 경우가 많아
 * 1행을 헤더로 가정하면 전부 실패한다. 별칭이 가장 많이 맞는 행을 헤더로 본다.
 */
function detectHeader(aoa: unknown[][], aliases: Record<CanonField, string[]>) {
  let best = { row: -1, score: 0, map: {} as Record<string, number> };
  const scan = Math.min(aoa.length, 30);
  for (let r = 0; r < scan; r++) {
    const cells = aoa[r] ?? [];
    const map: Record<string, number> = {};
    let score = 0;
    for (let c = 0; c < cells.length; c++) {
      const cell = norm(cells[c]);
      if (!cell) continue;
      for (const [field, list] of Object.entries(aliases) as [CanonField, string[]][]) {
        if (map[field] !== undefined) continue;
        if (list.some((a) => cell === norm(a))) { map[field] = c; score++; break; }
      }
    }
    if (score > best.score) best = { row: r, score, map };
  }
  return best;
}

export function parseHmsWorkbook(
  buf: ArrayBuffer,
  opts: { sheetName?: string; aliases?: Record<CanonField, string[]>; maxRows?: number } = {}
): ParseResult {
  const aliases = opts.aliases ?? DEFAULT_ALIASES;
  const wb = XLSX.read(buf, { type: "array", cellDates: false, raw: true });
  const sheetName = opts.sheetName ?? wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  if (!ws) throw new Error(`시트를 찾을 수 없습니다: ${sheetName} (있는 시트: ${wb.SheetNames.join(", ")})`);

  const aoa = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: true, defval: null, blankrows: false });
  const head = detectHeader(aoa, aliases);
  if (head.row < 0 || head.score < 2) {
    throw new Error(
      "헤더 행을 찾지 못했습니다. 카드번호·출입일시·출입구분에 해당하는 컬럼이 있는지 확인하거나, " +
        "import_profile 테이블에 현장 컬럼명을 등록하십시오."
    );
  }

  const idx = head.map;
  const headerCells = aoa[head.row] ?? [];
  const detected: Record<string, string> = {};
  for (const [f, c] of Object.entries(idx)) detected[f] = String(headerCells[c] ?? "");

  // 필수: 인원 식별자(카드번호 또는 사번) + 방향 + 시각(단일 또는 날짜+시각)
  const missing: CanonField[] = [];
  if (idx.card_no === undefined && idx.emp_id === undefined) missing.push("card_no");
  if (idx.direction === undefined) missing.push("direction");
  const hasSplit = idx.work_date !== undefined && idx.time_only !== undefined;
  if (idx.tagged_at === undefined && !hasSplit) missing.push("tagged_at");

  const rows: ParsedRow[] = [];
  const errors: RowError[] = [];
  const limit = opts.maxRows ?? Infinity;
  let dataRows = 0;

  if (missing.length === 0) {
    for (let r = head.row + 1; r < aoa.length; r++) {
      const cells = aoa[r] ?? [];
      const excelRow = r + 1;
      // 전부 빈 줄(합계행 앞 여백 등)은 건너뛴다
      if (cells.every((c) => c === null || String(c ?? "").trim() === "")) continue;
      dataRows++;
      if (rows.length >= limit) continue;

      try {
        const cardNo =
          idx.card_no !== undefined ? String(cells[idx.card_no] ?? "").trim() : "";
        const empId = idx.emp_id !== undefined ? String(cells[idx.emp_id] ?? "").trim() : "";
        if (!cardNo && !empId) throw new Error("카드번호와 사번이 모두 비어 있습니다");

        const taggedAt = hasSplit && idx.tagged_at === undefined
          ? combineDateTime(cells[idx.work_date!], cells[idx.time_only!])
          : cellToDt(cells[idx.tagged_at!]);

        rows.push({
          card_no: cardNo || `EMP:${empId}`,   // 카드번호가 없으면 사번 기반 키로 대체
          direction: toDirection(cells[idx.direction!]),
          tagged_at: taggedAt,
          gate: idx.gate !== undefined ? (String(cells[idx.gate] ?? "").trim() || null) : null,
          emp_id: empId || null,
          _row: excelRow,
        });
      } catch (e: any) {
        errors.push({ row: excelRow, message: e.message ?? String(e) });
      }
    }
  }

  return {
    sheet_name: sheetName,
    header_row: head.row + 1,
    detected_columns: detected,
    missing_required: missing,
    total_data_rows: dataRows,
    rows,
    errors,
  };
}
