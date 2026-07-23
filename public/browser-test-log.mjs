export const TEST_LOG_SCHEMA_VERSION = "browser-test-log-v1";
export const TEST_LOG_STORAGE_KEY = "addr-refine:test-runs:v1";
export const TEST_LOG_ACTIVE_KEY = "addr-refine:test-runs:active:v1";
export const TEST_LOG_LIMIT = 30;

const FINAL_IROS_STATUSES = new Set([
  "RESOLVED",
  "REG_MULTI",
  "REG_UNIT_NOT_FOUND",
  "REG_NOT_FOUND",
  "REG_VALIDATION_FAILED",
  "UNIT_INPUT_REQUIRED"
]);

const RETRY_IROS_STATUSES = new Set([
  "REG_PARTIAL_RESPONSE",
  "REG_PARSE_INCOMPLETE",
  "REG_PARSE_ERROR",
  "REG_HTTP_ERROR",
  "REG_SESSION_ERROR",
  "REG_RATE_LIMIT",
  "REG_SERVICE_UNAVAILABLE",
  "REG_COLLECTION_DEFERRED"
]);

function text(value) {
  return value == null ? "" : String(value);
}

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function histogram(values) {
  const out = {};
  for (const value of values) {
    const key = text(value) || "EMPTY";
    out[key] = (out[key] || 0) + 1;
  }
  return out;
}

function fnv1a64(input) {
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  const bytes = new TextEncoder().encode(text(input));
  for (const byte of bytes) {
    hash ^= BigInt(byte);
    hash = BigInt.asUintN(64, hash * prime);
  }
  return hash.toString(16).padStart(16, "0");
}

function runFingerprint(rows) {
  const parts = (Array.isArray(rows) ? rows : []).map((row, index) => {
    const result = row?.result || {};
    const reg = row?.reg || {};
    return [
      row?.rowId || index,
      fnv1a64(row?.raw || ""),
      result.status || "",
      result.pnu || "",
      result.bdMgtSn || "",
      result.unit?.dong || "",
      result.unit?.ho || "",
      reg.status || "",
      reg.unique_no || ""
    ].join("|");
  });
  return `fnv1a64:${fnv1a64(parts.join("\n"))}`;
}

export function summarizeTestRows(rows) {
  const source = Array.isArray(rows) ? rows : [];
  const addressStatuses = source.map((row) => row?.result?.status || "NOT_STARTED");
  const irosStatuses = source.map((row) => row?.reg?.status || "NOT_STARTED");
  const addressHistogram = histogram(addressStatuses);
  const irosHistogram = histogram(irosStatuses);
  const addressProcessed = source.filter((row) => Boolean(row?.result)).length;
  const addressConfirmed = addressHistogram.CONFIRMED || 0;
  const inputRequired = irosHistogram.UNIT_INPUT_REQUIRED || 0;
  const irosEligible = Math.max(0, addressConfirmed - inputRequired);
  const irosResolved = irosHistogram.RESOLVED || 0;
  const irosDone = source.filter((row) => {
    const status = row?.reg?.status || "";
    return FINAL_IROS_STATUSES.has(status) || row?.reg?.complete === true;
  }).length;
  const irosRetry = source.filter((row) => RETRY_IROS_STATUSES.has(row?.reg?.status || "")).length;
  return {
    total_rows: source.length,
    fingerprint: runFingerprint(source),
    address: {
      processed: addressProcessed,
      confirmed: addressConfirmed,
      confirmed_rate: source.length ? addressConfirmed / source.length : 0,
      review: (addressHistogram.AMBIGUOUS || 0) +
        (addressHistogram.VALIDATION_FAILED || 0) +
        (addressHistogram.NAVER_CONFIRMED_PNU_FAILED || 0),
      failed: (addressHistogram.FAILED || 0) +
        (addressHistogram.HUMAN_INPUT_ERROR || 0) +
        (addressHistogram.SYSTEM_ERROR || 0),
      statuses: addressHistogram
    },
    iros: {
      eligible: irosEligible,
      done: irosDone,
      resolved: irosResolved,
      resolved_rate: irosEligible ? irosResolved / irosEligible : 0,
      multi: irosHistogram.REG_MULTI || 0,
      unit_not_found: irosHistogram.REG_UNIT_NOT_FOUND || 0,
      validation_failed: irosHistogram.REG_VALIDATION_FAILED || 0,
      input_required: inputRequired,
      retry_required: irosRetry,
      statuses: irosHistogram
    }
  };
}

function makeRunId(now) {
  const stamp = text(now).replace(/\D/g, "").slice(0, 17) || String(Date.now());
  const random = Math.random().toString(36).slice(2, 8);
  return `${stamp}-${random}`;
}

export function createBrowserTestRun(meta = {}, rows = []) {
  const now = meta.started_at || new Date().toISOString();
  return {
    schema_version: TEST_LOG_SCHEMA_VERSION,
    id: meta.id || makeRunId(now),
    phase: meta.phase || "uploaded",
    started_at: now,
    updated_at: now,
    completed_at: null,
    duration_ms: 0,
    reason: "",
    file: {
      name: text(meta.file_name),
      size: number(meta.file_size),
      last_modified: number(meta.file_last_modified),
      type: text(meta.file_type),
      source_rows: number(meta.source_rows)
    },
    execution: {
      mode: text(meta.mode),
      bridge_mode: text(meta.bridge_mode),
      pipeline_version: text(meta.pipeline_version),
      module_versions: meta.module_versions || {},
      iros_versions: meta.iros_versions || {}
    },
    browser: meta.browser || {},
    upload: meta.upload || {},
    progress: meta.progress || {},
    summary: summarizeTestRows(rows)
  };
}

export function updateBrowserTestRun(run, rows, patch = {}) {
  const now = patch.updated_at || new Date().toISOString();
  const startedAt = new Date(run?.started_at || now).getTime();
  const terminal = patch.phase === "complete" ||
    patch.phase === "address_interrupted" ||
    patch.phase === "iros_interrupted" ||
    patch.phase === "error";
  return {
    ...(run || createBrowserTestRun({}, rows)),
    ...patch,
    schema_version: TEST_LOG_SCHEMA_VERSION,
    updated_at: now,
    completed_at: terminal ? now : (run?.completed_at || null),
    duration_ms: Math.max(0, new Date(now).getTime() - startedAt),
    reason: text(patch.reason ?? run?.reason),
    progress: { ...(run?.progress || {}), ...(patch.progress || {}) },
    summary: summarizeTestRows(rows)
  };
}

export function upsertBrowserTestRun(logs, run, limit = TEST_LOG_LIMIT) {
  const source = Array.isArray(logs) ? logs : [];
  const next = [run, ...source.filter((item) => item?.id !== run?.id)]
    .filter(Boolean)
    .sort((a, b) => text(b.updated_at).localeCompare(text(a.updated_at)));
  return next.slice(0, Math.max(1, number(limit) || TEST_LOG_LIMIT));
}

function csvCell(value) {
  const stringValue = text(value);
  return `"${stringValue.replace(/"/g, '""')}"`;
}

export function browserTestLogsToCsv(logs) {
  const headers = [
    "run_id", "phase", "started_at", "completed_at", "duration_seconds",
    "file_name", "file_size", "pipeline_version", "iros_matcher_version",
    "total_rows", "address_confirmed", "address_rate", "iros_eligible",
    "iros_resolved", "iros_rate", "iros_multi", "iros_unit_not_found",
    "iros_validation_failed", "iros_input_required", "iros_retry_required",
    "fingerprint", "browser", "reason"
  ];
  const rows = (Array.isArray(logs) ? logs : []).map((run) => [
    run?.id, run?.phase, run?.started_at, run?.completed_at,
    Math.round(number(run?.duration_ms) / 1000), run?.file?.name, run?.file?.size,
    run?.execution?.pipeline_version, run?.execution?.iros_versions?.matcher,
    run?.summary?.total_rows, run?.summary?.address?.confirmed,
    number(run?.summary?.address?.confirmed_rate).toFixed(6), run?.summary?.iros?.eligible,
    run?.summary?.iros?.resolved, number(run?.summary?.iros?.resolved_rate).toFixed(6),
    run?.summary?.iros?.multi, run?.summary?.iros?.unit_not_found,
    run?.summary?.iros?.validation_failed, run?.summary?.iros?.input_required,
    run?.summary?.iros?.retry_required, run?.summary?.fingerprint,
    run?.browser?.user_agent, run?.reason
  ]);
  return [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
}
