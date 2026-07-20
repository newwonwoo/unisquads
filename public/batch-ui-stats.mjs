const REVIEW_STATUSES = new Set([
  "NAVER_CONFIRMED_PNU_FAILED",
  "AMBIGUOUS",
  "VALIDATION_FAILED",
  "HUMAN_INPUT_ERROR"
]);

function normalizeRawKeyDefault(value) {
  return String(value ?? "").normalize("NFC").trim().replace(/\s+/g, " ");
}

export function buildSourceRawValues(body, addrIdx = 0, detailIdx = -1) {
  return (body || []).map((row) => {
    const addr = String(row?.[addrIdx] ?? "").trim();
    const detail = detailIdx >= 0 ? String(row?.[detailIdx] ?? "").trim() : "";
    return detail ? `${addr} ${detail}`.replace(/\s+/g, " ").trim() : addr;
  });
}

export function analyzeBatchUpload(rawValues, refineRows, refineTargets, normalizeKey = normalizeRawKeyDefault) {
  const values = Array.isArray(rawValues) ? rawValues : [];
  let addressRows = 0;
  for (const value of values) if (normalizeKey(value)) addressRows++;
  const safeRefineRows = Math.max(0, Number(refineRows) || 0);
  const safeRefineTargets = Math.max(0, Number(refineTargets) || 0);
  return {
    sourceRows: values.length,
    addressRows,
    emptyRows: Math.max(0, values.length - addressRows),
    refineRows: safeRefineRows,
    refineTargets: safeRefineTargets,
    duplicateReuse: Math.max(0, safeRefineRows - safeRefineTargets)
  };
}

export function summarizeRefineStatuses(rows) {
  const summary = { total: 0, confirmed: 0, review: 0, failed: 0 };
  for (const row of rows || []) {
    const status = row?.result?.status;
    if (!status) continue;
    summary.total++;
    if (status === "CONFIRMED" || status === "확정") summary.confirmed++;
    else if (REVIEW_STATUSES.has(status)) summary.review++;
    else summary.failed++;
  }
  return summary;
}
