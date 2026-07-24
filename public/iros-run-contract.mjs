export const IROS_RUN_VERSIONS = Object.freeze({
  collector: "iros-collector-v4",
  parser: "iros-parser-v4",
  matcher: "iros-matcher-v8",
  recovery: "iros-recovery-v5"
});

export const IROS_RETRYABLE_STATUSES = Object.freeze([
  "REG_SERVICE_UNAVAILABLE",
  "REG_COLLECTION_DEFERRED",
  "REG_PARTIAL_RESPONSE",
  "REG_PARSE_ERROR",
  "REG_PARSE_INCOMPLETE",
  "REG_HTTP_ERROR",
  "REG_SESSION_ERROR",
  "REG_RATE_LIMIT",
  "REG_TIMEOUT",
  "REG_ERROR"
]);

const RETRYABLE = new Set(IROS_RETRYABLE_STATUSES);

export function irosVersionManifest() {
  return { ...IROS_RUN_VERSIONS };
}

export function isSameIrosVersionManifest(value, current = IROS_RUN_VERSIONS) {
  return Boolean(value) &&
    value.collector === current.collector &&
    value.parser === current.parser &&
    value.matcher === current.matcher &&
    value.recovery === current.recovery;
}

export function withIrosVersions(reg, current = IROS_RUN_VERSIONS) {
  return {
    ...(reg || {}),
    collector_version: current.collector,
    parser_version: current.parser,
    matcher_version: current.matcher,
    recovery_version: current.recovery
  };
}

export function isCurrentIrosResult(reg, current = IROS_RUN_VERSIONS) {
  if (!reg || typeof reg !== "object") return false;
  return reg.collector_version === current.collector &&
    reg.parser_version === current.parser &&
    reg.matcher_version === current.matcher &&
    reg.recovery_version === current.recovery;
}

export function isRetryableIrosStatus(status) {
  return RETRYABLE.has(String(status || ""));
}

// 2026-07 태원아파트 실측 패턴:
// 아파트명 뒤 101-107은 동 범위이고, 뒤의 상가 층·호가 실제 전유부다.
// 이전 프로파일(v2)이 이 형식을 REG_MULTI/REG_UNIT_NOT_FOUND로 끝낸 경우만
// 한 번 재매칭한다. 전역 matcher 버전은 올리지 않아 다른 완료건은 재조회하지 않는다.
export function needsCommercialRangeUnitRematch(reg) {
  const status = String(reg?.status || "");
  if (!new Set(["REG_MULTI", "MULTIPLE", "REG_UNIT_NOT_FOUND"]).has(status)) return false;

  const signature = String(reg?.match_evidence?.unit_intent_signature || "");
  if (!signature.startsWith("iros-unit-profile-v2:")) return false;
  if (!signature.includes(":COMMERCIAL:")) return false;

  // v2에서는 1층6호를 106호로 먼저 합성해 RAW_FLOOR_ROOM 근거가
  // 서명에 남지 않을 수 있다. 따라서 엄격한 원문 패턴은 strict에서 확인한다.
  // strict에는 review 사유 + 정제 건물명 + 원문 정규화값이 저장된다.
  // 하이픈이 제거된 연속 6~8자리 동 범위 뒤에 상가 층·호가 있는 경우만 연다.
  const strict = String(reg?.match_evidence?.strict || "").toLowerCase();
  return /\d{6,8}.*(?:상가|근린생활시설|근생|판매시설).*(?:(?:지하|b)\d+|\d+)층\d+호/.test(strict);
}

export function isReusableIrosResult(reg, current = IROS_RUN_VERSIONS) {
  if (!isCurrentIrosResult(reg, current)) return false;
  if (!reg.status || reg.stale === true || reg.recovery_pending === true) return false;
  if (isRetryableIrosStatus(reg.status)) return false;
  if (needsCommercialRangeUnitRematch(reg)) return false;
  return true;
}

export function rowRequiresIros(row) {
  const result = row?.result;
  if (!result || result.status !== "CONFIRMED") return false;
  if (result.isJip && !result.unit?.ho) return false;
  return true;
}

export function markStaleIrosRows(rows, current = IROS_RUN_VERSIONS) {
  return (rows || []).map((row) => {
    if (!row?.reg || isCurrentIrosResult(row.reg, current)) return row;
    return {
      ...row,
      reg: {
        ...row.reg,
        stale: true,
        stale_reason: "IROS_VERSION_MISMATCH",
        stale_versions: {
          collector: row.reg.collector_version || "",
          parser: row.reg.parser_version || "",
          matcher: row.reg.matcher_version || "",
          recovery: row.reg.recovery_version || ""
        }
      }
    };
  });
}

export function irosProgressStats(rows, current = IROS_RUN_VERSIONS) {
  let total = 0;
  let done = 0;
  let stale = 0;
  let retryable = 0;
  let pendingRecovery = 0;
  for (const row of rows || []) {
    if (!rowRequiresIros(row)) continue;
    total += 1;
    const reg = row?.reg;
    if (!isCurrentIrosResult(reg, current)) stale += 1;
    else if (reg?.recovery_pending) pendingRecovery += 1;
    else if (isRetryableIrosStatus(reg?.status)) retryable += 1;
    else if (isReusableIrosResult(reg, current)) done += 1;
  }
  return {
    total,
    done,
    remaining: Math.max(0, total - done),
    stale,
    retryable,
    pendingRecovery,
    final: total === done && stale === 0 && retryable === 0 && pendingRecovery === 0
  };
}

export function irosOutcomeStats(rows, current = IROS_RUN_VERSIONS) {
  const out = {
    addressConfirmed: 0,
    inputRequired: 0,
    target: 0,
    judged: 0,
    resolved: 0,
    multiple: 0,
    unitNotFound: 0,
    otherFailure: 0,
    stale: 0,
    retryable: 0,
    pendingRecovery: 0,
    retryRequired: 0,
    unstarted: 0,
    pending: 0
  };
  for (const row of rows || []) {
    const result = row?.result;
    if (!result || !["CONFIRMED", "확정"].includes(result.status)) continue;
    out.addressConfirmed += 1;
    if ((result.isJip && !result.unit?.ho) || row?.reg?.status === "UNIT_INPUT_REQUIRED") {
      out.inputRequired += 1;
      continue;
    }
    out.target += 1;
    const reg = row?.reg;
    if (!reg) continue;
    if (!isCurrentIrosResult(reg, current)) {
      out.stale += 1;
      continue;
    }
    if (reg.recovery_pending === true) {
      out.pendingRecovery += 1;
      continue;
    }
    if (isRetryableIrosStatus(reg.status)) {
      out.retryable += 1;
      continue;
    }
    if (!reg.status) continue;
    out.judged += 1;
    if (reg.status === "RESOLVED") out.resolved += 1;
    else if (reg.status === "REG_MULTI" || reg.status === "MULTIPLE") out.multiple += 1;
    else if (reg.status === "REG_UNIT_NOT_FOUND") out.unitNotFound += 1;
    else out.otherFailure += 1;
  }
  out.retryRequired = out.stale + out.retryable + out.pendingRecovery;
  out.pending = Math.max(0, out.target - out.judged);
  out.unstarted = Math.max(0, out.pending - out.retryRequired);
  return out;
}

export function isIrosExportFinal(rows, current = IROS_RUN_VERSIONS) {
  return irosProgressStats(rows, current).final;
}

export function buildIrosSnapshot(rows, extraHeaders, irosRun = {}) {
  return {
    v: 3,
    rows,
    extraHeaders: Array.isArray(extraHeaders) ? extraHeaders : [],
    irosVersions: irosVersionManifest(),
    irosRun: {
      ...irosRun,
      updatedAt: new Date().toISOString()
    }
  };
}
