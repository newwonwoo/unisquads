import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  IROS_RUN_VERSIONS,
  buildIrosSnapshot,
  irosOutcomeStats,
  irosProgressStats,
  isIrosExportFinal,
  isReusableIrosResult,
  markStaleIrosRows,
  withIrosVersions
} from "../public/iros-run-contract.mjs";
import {
  buildVerifiedWorkbookArray,
  recordsForMode
} from "../public/xlsx-integrity.mjs";

function confirmedRow(reg = null, unit = { dong: "101", ho: "101" }) {
  return {
    result: {
      status: "CONFIRMED",
      isJip: true,
      unit
    },
    reg
  };
}

test("old matcher/parser results are stale and not final", () => {
  const rows = [confirmedRow({
    status: "RESOLVED",
    collector_version: "old",
    parser_version: "old",
    matcher_version: "old",
    recovery_version: "old"
  })];
  const marked = markStaleIrosRows(rows);
  assert.equal(marked[0].reg.stale, true);
  assert.equal(irosProgressStats(marked).stale, 1);
  assert.equal(isIrosExportFinal(marked), false);
});

test("current terminal results are reusable while partial results retry", () => {
  const good = withIrosVersions({ status: "REG_UNIT_NOT_FOUND", complete: true });
  const partial = withIrosVersions({ status: "REG_PARTIAL_RESPONSE", complete: false });
  assert.equal(isReusableIrosResult(good), true);
  assert.equal(isReusableIrosResult(partial), false);
});

test("IROS judgement and unique-number extraction remain separate KPIs", () => {
  const rows = [
    confirmedRow(withIrosVersions({ status: "RESOLVED", unique_no: "1" })),
    confirmedRow(withIrosVersions({ status: "REG_MULTI" })),
    confirmedRow(withIrosVersions({ status: "REG_UNIT_NOT_FOUND" })),
    confirmedRow(withIrosVersions({ status: "REG_NOT_FOUND" })),
    confirmedRow(null),
    confirmedRow(withIrosVersions({ status: "REG_HTTP_ERROR" })),
    confirmedRow(withIrosVersions({ status: "UNIT_INPUT_REQUIRED" }), { dong: null, ho: null })
  ];
  const out = irosOutcomeStats(rows);
  assert.deepEqual(out, {
    addressConfirmed: 7,
    inputRequired: 1,
    target: 6,
    judged: 4,
    resolved: 1,
    multiple: 1,
    unitNotFound: 1,
    otherFailure: 1,
    stale: 0,
    retryable: 1,
    pendingRecovery: 0,
    retryRequired: 1,
    unstarted: 1,
    pending: 2
  });
});

test("snapshot persists all four IROS module versions and phase checkpoint", () => {
  const snapshot = buildIrosSnapshot([], ["부동산번호"], {
    phase: "alternate",
    baseDone: 10,
    baseTotal: 10,
    alternateDone: 2,
    alternateTotal: 5,
    interrupted: true
  });
  assert.equal(snapshot.irosVersions.collector, IROS_RUN_VERSIONS.collector);
  assert.equal(snapshot.irosVersions.parser, IROS_RUN_VERSIONS.parser);
  assert.equal(snapshot.irosVersions.matcher, IROS_RUN_VERSIONS.matcher);
  assert.equal(snapshot.irosVersions.recovery, IROS_RUN_VERSIONS.recovery);
  assert.equal(snapshot.irosRun.phase, "alternate");
  assert.equal(snapshot.irosRun.alternateDone, 2);
  assert.equal(snapshot.extraHeaders[0], "부동산번호");
});

test("compressed XLSX round-trip validates rows, headers, summary, and ZIP end", async () => {
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();
  const summary = XLSX.utils.aoa_to_sheet([
    ["주소정제·등기조회 결과"],
    ["전체 처리 건수", 2]
  ]);
  const detail = XLSX.utils.aoa_to_sheet([
    ["원본주소", "등기고유번호"],
    ["주소1", "1"],
    ["주소2", "2"]
  ]);
  XLSX.utils.book_append_sheet(wb, summary, "요약");
  XLSX.utils.book_append_sheet(wb, detail, "전체(중복표시)");
  const bytes = buildVerifiedWorkbookArray(XLSX, wb, {
    summarySheet: "요약",
    detailSheet: "전체(중복표시)",
    expectedHeaders: 2,
    expectedRows: 2,
    expectedSummaryTotal: 2
  });
  assert.equal(bytes[0], 0x50);
  assert.equal(bytes[1], 0x4b);
});

test("mode-specific record count is explicit for integrity validation", () => {
  const records = [
    { dup: "최초", status: "CONFIRMED", regNo: "1" },
    { dup: "중복", status: "CONFIRMED", regNo: "1" },
    { dup: "", status: "FAILED", regNo: "" }
  ];
  assert.equal(recordsForMode(records, "all").length, 3);
  assert.equal(recordsForMode(records, "unique").length, 2);
  assert.equal(recordsForMode(records, "fail").length, 1);
});

test("patched app contains the required hardening contracts", async () => {
  const source = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
  for (const marker of [
    "buildVerifiedWorkbookArray",
    "현재까지 결과 다운로드",
    "recovery_version: IROS_RUN_VERSIONS.recovery",
    "R-IROS-UNIT-PROFILE",
    "unit_profile_recovery",
    "subBuilding: pre?.subBuilding || null",
    "narrowByExplicitSubBuilding",
    "기본 PNU ${batchBaseDone}/${batchBaseTotal}",
    "batchWorkflow.statusLabel",
    "BATCH_PRIMARY_ACTIONS.DOWNLOAD_ALL",
    "네이버지번주소",
    "finally {\n      setBatchRegBusy(false);"
  ]) {
    assert.ok(source.includes(marker), marker);
  }
});

// This commit intentionally triggers the branch validation workflow.
