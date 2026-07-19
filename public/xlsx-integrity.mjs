const WRAP_HEADERS = new Set([
  "비고",
  "juso검색어",
  "검증사유",
  "적용모듈",
  "주소매칭근거",
  "IROS전략",
  "IROS검색범위",
  "IROS부동산구분",
  "IROS캐시해시",
  "IROS매칭근거"
]);

export function columnWidthForHeader(header) {
  const h = String(header || "");
  if (h === "원본주소" || h === "지번주소" || h === "도로명주소") return 34;
  if (h === "juso검색어") return 42;
  if (h === "비고" || h === "검증사유") return 30;
  if (h === "적용모듈" || h === "주소매칭근거") return 28;
  if (h === "IROS매칭근거") return 38;
  if (h === "IROS캐시해시" || h === "결과지문" || h === "의존성지문" || h === "전파근거해시") return 24;
  if (h.startsWith("IROS")) return 18;
  if (h === "등기고유번호" || h === "건물관리번호" || h === "PNU") return 22;
  if (h.endsWith("상태") || h.endsWith("버전") || h === "실패코드") return 17;
  if (h === "동" || h === "호" || h === "중복그룹" || h === "후보건수") return 10;
  return Math.min(24, Math.max(12, h.length + 4));
}

export function applyWorksheetLayout(XLSX, ws, headers) {
  ws["!cols"] = (headers || []).map((header) => ({ wch: columnWidthForHeader(header) }));
  ws["!freeze"] = { xSplit: 0, ySplit: 1 };
  if (!ws?.["!ref"]) return ws;

  const range = XLSX.utils.decode_range(ws["!ref"]);
  const wrapColumns = [];
  (headers || []).forEach((header, index) => {
    if (WRAP_HEADERS.has(String(header || ""))) wrapColumns.push(index);
  });
  for (const c of wrapColumns) {
    for (let r = range.s.r; r <= range.e.r; r++) {
      const ref = XLSX.utils.encode_cell({ r, c });
      const cell = ws[ref];
      if (!cell) continue;
      cell.s = {
        ...(cell.s || {}),
        alignment: {
          ...(cell.s?.alignment || {}),
          wrapText: true,
          vertical: "top"
        }
      };
    }
  }
  return ws;
}

export function recordsForMode(records, mode) {
  return (records || []).filter((record) => {
    if (mode === "unique" && record.dup === "중복") return false;
    if (mode === "fail") {
      const ok = (record.status === "확정" || record.status === "CONFIRMED") && record.regNo;
      return !ok;
    }
    return true;
  });
}

export function hasZipEndOfCentralDirectory(bytes) {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || []);
  const start = Math.max(0, view.length - 65557);
  for (let i = view.length - 22; i >= start; i--) {
    if (view[i] === 0x50 && view[i + 1] === 0x4b && view[i + 2] === 0x05 && view[i + 3] === 0x06) {
      return true;
    }
  }
  return false;
}

function findSummaryTotal(XLSX, ws) {
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false, defval: "" });
  const row = rows.find((values) => String(values?.[0] || "").trim() === "전체 처리 건수");
  return row ? Number(row[1]) : NaN;
}

export function validateWorkbookArray(XLSX, bytes, expectations) {
  if (!hasZipEndOfCentralDirectory(bytes)) {
    throw new Error("XLSX ZIP 종료정보가 없습니다.");
  }
  const wb = XLSX.read(bytes, { type: "array", cellStyles: true });
  const summaryName = expectations.summarySheet || "요약";
  const detailName = expectations.detailSheet;
  const summary = wb.Sheets[summaryName];
  const detail = wb.Sheets[detailName];
  if (!summary || !detail) throw new Error("요약 또는 상세 시트가 없습니다.");
  if (!detail["!ref"]) throw new Error("상세 시트 범위가 없습니다.");

  const range = XLSX.utils.decode_range(detail["!ref"]);
  const headerCount = range.e.c - range.s.c + 1;
  const detailRows = Math.max(0, range.e.r - range.s.r);
  const summaryTotal = findSummaryTotal(XLSX, summary);

  if (headerCount !== expectations.expectedHeaders) {
    throw new Error(`헤더 수 불일치: ${headerCount}/${expectations.expectedHeaders}`);
  }
  if (detailRows !== expectations.expectedRows) {
    throw new Error(`상세행 수 불일치: ${detailRows}/${expectations.expectedRows}`);
  }
  if (summaryTotal !== expectations.expectedSummaryTotal) {
    throw new Error(`요약 합계 불일치: ${summaryTotal}/${expectations.expectedSummaryTotal}`);
  }
  return { headerCount, detailRows, summaryTotal, byteLength: bytes.byteLength || bytes.length || 0 };
}

export function buildVerifiedWorkbookArray(XLSX, wb, expectations) {
  const bytes = XLSX.write(wb, {
    type: "array",
    bookType: "xlsx",
    compression: true,
    cellStyles: true
  });
  validateWorkbookArray(XLSX, bytes, expectations);
  return bytes;
}

export function downloadWorkbookArray(bytes, fileName) {
  const blob = new Blob([bytes], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
