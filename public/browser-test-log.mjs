export const TEST_LOG_SCHEMA_VERSION = "browser-test-log-v2";
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

function rowIdentifier(row, index) {
  return text(row?.rowId ?? row?.sourceRowId ?? row?.id ?? index);
}

function sourceFingerprint(rows) {
  const parts = (Array.isArray(rows) ? rows : []).map((row, index) =>
    `${rowIdentifier(row, index)}|${fnv1a64(row?.raw || "")}`
  );
  return `fnv1a64:${fnv1a64(parts.join("\n"))}`;
}

function runFingerprint(rows) {
  const parts = (Array.isArray(rows) ? rows : []).map((row, index) => {
    const result = row?.result || {};
    const reg = row?.reg || {};
    return [
      rowIdentifier(row, index),
      fnv1a64(row?.raw || ""),
      result.status || "",
      result.pnu || "",
      result.bdMgtSn || result.bd_mgt_sn || "",
      result.unit?.dong || "",
      result.unit?.ho || "",
      reg.status || "",
      reg.unique_no || ""
    ].join("|");
  });
  return `fnv1a64:${fnv1a64(parts.join("\n"))}`;
}

function compactRowOutcomes(rows) {
  const source = Array.isArray(rows) ? rows : [];
  const seen = new Map();
  return source.map((row, index) => {
    const result = row?.result || {};
    const reg = row?.reg || {};
    const baseId = rowIdentifier(row, index);
    const ordinal = seen.get(baseId) || 0;
    seen.set(baseId, ordinal + 1);
    const rowId = ordinal === 0 ? baseId : `${baseId}#${ordinal + 1}`;
    return {
      row_id: rowId,
      source_hash: `fnv1a64:${fnv1a64(row?.raw || "")}`,
      address_status: text(result.status || "NOT_STARTED"),
      pnu: text(result.pnu),
      bd_mgt_sn: text(result.bdMgtSn || result.bd_mgt_sn),
      iros_status: text(reg.status || "NOT_STARTED"),
      unique_no: text(reg.unique_no)
    };
  });
}

function formatBuildTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return text(value);
  try {
    return date.toLocaleString("sv-SE", {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    }).replace(",", "");
  } catch {
    return date.toISOString().slice(0, 16).replace("T", " ");
  }
}

function buildInfo(meta = {}) {
  if (meta?.upload?.imported_existing_snapshot) return {};
  const globalInfo = typeof globalThis !== "undefined" ? globalThis.__APP_BUILD_INFO__ : null;
  const source = meta.build_info || globalInfo || {};
  return {
    git_commit_sha: text(source.git_commit_sha),
    vercel_deployment_id: text(source.vercel_deployment_id),
    deployed_at: text(source.deployed_at),
    app_version: text(source.app_version),
    app_asset_sha256: text(source.app_asset_sha256),
    loaded_at: text(source.loaded_at)
  };
}

function executionMetadata(meta = {}) {
  const logicalPipeline = text(meta.pipeline_version);
  const build = buildInfo(meta);
  const shortSha = build.git_commit_sha ? build.git_commit_sha.slice(0, 7) : "";
  const displayVersion = [
    logicalPipeline,
    shortSha ? `build ${shortSha}` : "",
    formatBuildTime(build.deployed_at)
  ].filter(Boolean).join(" · ");
  return {
    mode: text(meta.mode),
    bridge_mode: text(meta.bridge_mode),
    // 기존 화면이 이 필드를 그대로 표시하므로 배포 식별자까지 포함한다.
    pipeline_version: displayVersion || logicalPipeline,
    logical_pipeline_version: logicalPipeline,
    module_versions: meta.module_versions || {},
    iros_versions: meta.iros_versions || {},
    git_commit_sha: build.git_commit_sha,
    vercel_deployment_id: build.vercel_deployment_id,
    deployed_at: build.deployed_at,
    app_version: build.app_version,
    app_asset_sha256: build.app_asset_sha256,
    browser_loaded_at: build.loaded_at
  };
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
    source_fingerprint: sourceFingerprint(source),
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

function fileIdentity(file = {}) {
  const parts = [
    text(file.name),
    number(file.size),
    number(file.last_modified),
    number(file.source_rows)
  ];
  if (!parts[0]) return "";
  return `fnv1a64:${fnv1a64(parts.join("|"))}`;
}

export function createBrowserTestRun(meta = {}, rows = []) {
  const now = meta.started_at || new Date().toISOString();
  const file = {
    name: text(meta.file_name),
    size: number(meta.file_size),
    last_modified: number(meta.file_last_modified),
    type: text(meta.file_type),
    source_rows: number(meta.source_rows)
  };
  file.identity = fileIdentity(file);
  return {
    schema_version: TEST_LOG_SCHEMA_VERSION,
    id: meta.id || makeRunId(now),
    phase: meta.phase || "uploaded",
    started_at: now,
    updated_at: now,
    completed_at: null,
    duration_ms: 0,
    reason: "",
    file,
    execution: executionMetadata(meta),
    browser: meta.browser || {},
    upload: meta.upload || {},
    progress: meta.progress || {},
    row_outcomes: compactRowOutcomes(rows),
    regression: null,
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
    row_outcomes: compactRowOutcomes(rows),
    summary: summarizeTestRows(rows)
  };
}

function metric(count, review = false) {
  return {
    count,
    status: count === 0 ? "PASS" : (review ? "REVIEW" : "FAIL")
  };
}

function compactState(row) {
  return {
    address_status: text(row?.address_status),
    pnu: text(row?.pnu),
    bd_mgt_sn: text(row?.bd_mgt_sn),
    iros_status: text(row?.iros_status),
    unique_no: text(row?.unique_no)
  };
}

export function compareTestRuns(previousRun, currentRun) {
  const previousRows = Array.isArray(previousRun?.row_outcomes) ? previousRun.row_outcomes : [];
  const currentRows = Array.isArray(currentRun?.row_outcomes) ? currentRun.row_outcomes : [];
  if (!previousRows.length || !currentRows.length) {
    return {
      status: "NO_BASELINE",
      baseline_run_id: previousRun?.id || null,
      compared_at: new Date().toISOString(),
      changed_rows: [],
      metrics: {}
    };
  }
  const previousMap = new Map(previousRows.map((row) => [text(row.row_id), row]));
  const currentMap = new Map(currentRows.map((row) => [text(row.row_id), row]));
  const changedRows = [];
  const counts = {
    confirmed_to_unconfirmed: 0,
    confirmed_pnu_changed: 0,
    building_management_no_changed: 0,
    iros_unique_no_changed: 0,
    iros_success_to_failure: 0,
    newly_confirmed: 0
  };

  for (const current of currentRows) {
    const previous = previousMap.get(text(current.row_id));
    if (!previous) {
      if (current.address_status === "CONFIRMED") {
        counts.newly_confirmed += 1;
        changedRows.push({
          row_id: text(current.row_id),
          changes: ["ROW_ADDED", "NEWLY_CONFIRMED"],
          before: null,
          after: compactState(current)
        });
      }
      continue;
    }
    const changes = [];
    const previousConfirmed = previous.address_status === "CONFIRMED";
    const currentConfirmed = current.address_status === "CONFIRMED";
    const previousIrosSuccess = previous.iros_status === "RESOLVED" && Boolean(previous.unique_no);
    const currentIrosSuccess = current.iros_status === "RESOLVED" && Boolean(current.unique_no);

    if (previousConfirmed && !currentConfirmed) {
      counts.confirmed_to_unconfirmed += 1;
      changes.push("CONFIRMED_TO_UNCONFIRMED");
    }
    if (previousConfirmed && currentConfirmed && previous.pnu !== current.pnu) {
      counts.confirmed_pnu_changed += 1;
      changes.push("CONFIRMED_PNU_CHANGED");
    }
    if (previousConfirmed && currentConfirmed && previous.bd_mgt_sn !== current.bd_mgt_sn) {
      counts.building_management_no_changed += 1;
      changes.push("BUILDING_MANAGEMENT_NO_CHANGED");
    }
    if (previousIrosSuccess && currentIrosSuccess && previous.unique_no !== current.unique_no) {
      counts.iros_unique_no_changed += 1;
      changes.push("IROS_UNIQUE_NO_CHANGED");
    }
    if (previousIrosSuccess && !currentIrosSuccess) {
      counts.iros_success_to_failure += 1;
      changes.push("IROS_SUCCESS_TO_FAILURE");
    }
    if (!previousConfirmed && currentConfirmed) {
      counts.newly_confirmed += 1;
      changes.push("NEWLY_CONFIRMED");
    }
    if (changes.length) {
      changedRows.push({
        row_id: text(current.row_id),
        changes,
        before: compactState(previous),
        after: compactState(current)
      });
    }
  }

  for (const previous of previousRows) {
    if (currentMap.has(text(previous.row_id))) continue;
    const changes = ["ROW_MISSING"];
    if (previous.address_status === "CONFIRMED") {
      counts.confirmed_to_unconfirmed += 1;
      changes.push("CONFIRMED_TO_UNCONFIRMED");
    }
    if (previous.iros_status === "RESOLVED" && previous.unique_no) {
      counts.iros_success_to_failure += 1;
      changes.push("IROS_SUCCESS_TO_FAILURE");
    }
    changedRows.push({
      row_id: text(previous.row_id),
      changes,
      before: compactState(previous),
      after: null
    });
  }

  const metrics = {
    confirmed_to_unconfirmed: metric(counts.confirmed_to_unconfirmed),
    confirmed_pnu_changed: metric(counts.confirmed_pnu_changed),
    building_management_no_changed: metric(counts.building_management_no_changed, true),
    iros_unique_no_changed: metric(counts.iros_unique_no_changed),
    iros_success_to_failure: metric(counts.iros_success_to_failure),
    newly_confirmed: { count: counts.newly_confirmed, status: "INFO" }
  };
  const hardFailure = [
    metrics.confirmed_to_unconfirmed,
    metrics.confirmed_pnu_changed,
    metrics.iros_unique_no_changed,
    metrics.iros_success_to_failure
  ].some((item) => item.status === "FAIL");
  const reviewRequired = metrics.building_management_no_changed.status === "REVIEW";
  return {
    status: hardFailure ? "FAIL" : (reviewRequired ? "REVIEW" : "PASS"),
    baseline_run_id: previousRun?.id || null,
    baseline_completed_at: previousRun?.completed_at || previousRun?.updated_at || null,
    compared_at: new Date().toISOString(),
    source_fingerprint: currentRun?.summary?.source_fingerprint || "",
    metrics,
    changed_rows: changedRows
  };
}

function attachRegression(logs, run) {
  if (run?.phase !== "complete") return run;
  const source = Array.isArray(logs) ? logs : [];
  const fingerprint = run?.summary?.source_fingerprint;
  const baseline = source
    .filter((item) => item?.id !== run?.id && item?.phase === "complete")
    .filter((item) => {
      const sameFile = run?.file?.identity && item?.file?.identity === run.file.identity;
      const sameSource = fingerprint && item?.summary?.source_fingerprint === fingerprint;
      return sameFile || sameSource;
    })
    .filter((item) => Array.isArray(item?.row_outcomes) && item.row_outcomes.length > 0)
    .sort((a, b) => text(b.completed_at || b.updated_at).localeCompare(text(a.completed_at || a.updated_at)))[0];
  return {
    ...run,
    regression: baseline ? compareTestRuns(baseline, run) : {
      status: "NO_BASELINE",
      baseline_run_id: null,
      compared_at: new Date().toISOString(),
      source_fingerprint: fingerprint || "",
      metrics: {},
      changed_rows: []
    }
  };
}

export function upsertBrowserTestRun(logs, run, limit = TEST_LOG_LIMIT) {
  const source = Array.isArray(logs) ? logs : [];
  const enrichedRun = attachRegression(source, run);
  const next = [enrichedRun, ...source.filter((item) => item?.id !== enrichedRun?.id)]
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
    "file_name", "file_size", "pipeline_version", "logical_pipeline_version",
    "git_commit_sha", "vercel_deployment_id", "deployed_at", "app_version",
    "iros_matcher_version", "total_rows", "address_confirmed", "address_rate",
    "iros_eligible", "iros_resolved", "iros_rate", "iros_multi",
    "iros_unit_not_found", "iros_validation_failed", "iros_input_required",
    "iros_retry_required", "source_fingerprint", "fingerprint",
    "regression_status", "confirmed_to_unconfirmed", "confirmed_pnu_changed",
    "building_management_no_changed", "iros_unique_no_changed",
    "iros_success_to_failure", "newly_confirmed", "browser", "reason"
  ];
  const rows = (Array.isArray(logs) ? logs : []).map((run) => [
    run?.id, run?.phase, run?.started_at, run?.completed_at,
    Math.round(number(run?.duration_ms) / 1000), run?.file?.name, run?.file?.size,
    run?.execution?.pipeline_version, run?.execution?.logical_pipeline_version,
    run?.execution?.git_commit_sha, run?.execution?.vercel_deployment_id,
    run?.execution?.deployed_at, run?.execution?.app_version,
    run?.execution?.iros_versions?.matcher, run?.summary?.total_rows,
    run?.summary?.address?.confirmed, number(run?.summary?.address?.confirmed_rate).toFixed(6),
    run?.summary?.iros?.eligible, run?.summary?.iros?.resolved,
    number(run?.summary?.iros?.resolved_rate).toFixed(6), run?.summary?.iros?.multi,
    run?.summary?.iros?.unit_not_found, run?.summary?.iros?.validation_failed,
    run?.summary?.iros?.input_required, run?.summary?.iros?.retry_required,
    run?.summary?.source_fingerprint, run?.summary?.fingerprint,
    run?.regression?.status,
    run?.regression?.metrics?.confirmed_to_unconfirmed?.count,
    run?.regression?.metrics?.confirmed_pnu_changed?.count,
    run?.regression?.metrics?.building_management_no_changed?.count,
    run?.regression?.metrics?.iros_unique_no_changed?.count,
    run?.regression?.metrics?.iros_success_to_failure?.count,
    run?.regression?.metrics?.newly_confirmed?.count,
    run?.browser?.user_agent, run?.reason
  ]);
  return [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
}
