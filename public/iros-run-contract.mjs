import { extractBuildingRangeIntent } from "./address-subbuilding-rules.mjs";
import { UNIT_PROFILE_VERSION } from "./iros-unit-profile.mjs";

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
const COMMERCIAL_RANGE_RETRY_STATUSES = new Set([
  "REG_MULTI",
  "MULTIPLE",
  "REG_UNIT_NOT_FOUND"
]);
const UNIT_PROFILE_RETRY_STATUSES = new Set([
  "REG_MULTI",
  "MULTIPLE",
  "REG_UNIT_NOT_FOUND"
]);

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

function unitProfileVersionFromSignature(value) {
  const signature = String(value || "");
  const match = /^(iros-unit-profile-v\d+)(?::|$)/.exec(signature);
  return match?.[1] || "";
}

// 프로파일 버전은 matcher manifest와 별도로 발전할 수 있다. 전체 matcher 버전을
// 올리면 정상 성공건까지 재조회되므로, 구버전 프로파일로 끝난 세대미일치·복수결과만
// 현재 프로파일로 재매칭한다. 성공 결과와 건물명/부동산구분 검증실패는 건드리지 않는다.
export function needsUnitProfileVersionRematch(
  reg,
  currentProfileVersion = UNIT_PROFILE_VERSION
) {
  const status = String(reg?.status || "");
  if (!UNIT_PROFILE_RETRY_STATUSES.has(status)) return false;
  const recordedVersion = unitProfileVersionFromSignature(
    reg?.match_evidence?.unit_intent_signature
  );
  const currentVersion = String(currentProfileVersion || "");
  return Boolean(recordedVersion && currentVersion && recordedVersion !== currentVersion);
}

// 아파트명 뒤 101-107 같은 동 범위를 적고, 그 뒤 상가 층·호가 명시된 행 중
// 구버전 프로파일이 복수/세대없음으로 끝난 결과만 재매칭한다.
// 행 원문을 직접 확인하므로 동일 패턴이 아닌 완료건은 건드리지 않는다.
export function needsCommercialRangeUnitRematch(reg, rawAddress = "") {
  const status = String(reg?.status || "");
  if (!COMMERCIAL_RANGE_RETRY_STATUSES.has(status)) return false;
  const signature = String(reg?.match_evidence?.unit_intent_signature || "");
  if (signature && !signature.startsWith("iros-unit-profile-v2:")) return false;
  return Boolean(extractBuildingRangeIntent(rawAddress));
}

export function isReusableIrosResult(reg, current = IROS_RUN_VERSIONS) {
  if (!isCurrentIrosResult(reg, current)) return false;
  if (!reg.status || reg.stale === true || reg.recovery_pending === true) return false;
  return !isRetryableIrosStatus(reg.status);
}

export function rowRequiresIros(row) {
  const result = row?.result;
  if (!result || result.status !== "CONFIRMED") return false;
  if (result.isJip && !result.unit?.ho) return false;
  return true;
}

export function markStaleIrosRows(rows, current = IROS_RUN_VERSIONS) {
  return (rows || []).map((row) => {
    if (!row?.reg) return row;

    if (needsCommercialRangeUnitRematch(row.reg, row.raw || "")) {
      return {
        ...row,
        reg: {
          ...row.reg,
          stale: true,
          stale_reason: "COMMERCIAL_RANGE_UNIT_REMATCH"
        }
      };
    }

    if (needsUnitProfileVersionRematch(row.reg)) {
      return {
        ...row,
        reg: {
          ...row.reg,
          stale: true,
          stale_reason: "UNIT_PROFILE_VERSION_REMATCH",
          stale_profile_versions: {
            from: unitProfileVersionFromSignature(
              row.reg?.match_evidence?.unit_intent_signature
            ),
            to: UNIT_PROFILE_VERSION
          }
        }
      };
    }

    if (isCurrentIrosResult(row.reg, current)) return row;
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
    if (reg?.stale === true || !isCurrentIrosResult(reg, current)) stale += 1;
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
    if (reg.stale === true || !isCurrentIrosResult(reg, current)) {
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
