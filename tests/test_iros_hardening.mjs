import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import * as XLSX from "xlsx";

import {
  IROS_RUN_VERSIONS,
  buildIrosSnapshot,
  irosOutcomeStats,
  irosProgressStats,
  isIrosExportFinal,
  isProtectedIrosSuccess,
  isReusableIrosResult,
  markStaleIrosRows,
  needsUnitBearingBuildingRematch,
  withIrosVersions
} from "../public/iros-run-contract.mjs";
import {
  applyWorksheetLayout,
  buildVerifiedWorkbookArray,
  hasZipEndOfCentralDirectory,
  recordsForMode,
  validateWorkbookArray
} from "../public/xlsx-integrity.mjs";

const confirmedRow = (reg) => ({
  raw: "서울특별시 서초구 반포동 1 101동 101호",
  result: {
    status: "CONFIRMED",
    isJip: true,
    unit: { dong: "101", ho: "101" }
  },
  reg
});

test("old successful unique numbers stay locked across matcher/parser versions", () => {
  const rows = markStaleIrosRows([
    confirmedRow({
      status: "RESOLVED",
      unique_no: "1234-5678-901234",
      collector_version: "iros-collector-v4",
      parser_version: "iros-parser-v3",
      matcher_version: "iros-matcher-v4",
      stale: true,
      stale_reason: "IROS_VERSION_MISMATCH"
    })
  ]);
  assert.equal(rows[0].reg.stale, undefined);
  assert.equal(isProtectedIrosSuccess(rows[0].reg), true);
  assert.equal(isReusableIrosResult(rows[0].reg), true);
  const progress = irosProgressStats(rows);
  assert.equal(progress.total, 1);
  assert.equal(progress.done, 1);
  assert.equal(progress.stale, 0);
  assert.equal(isIrosExportFinal(rows), true);
});

test("only the explicit unit-bearing building failure is selected for targeted rematch", () => {
  const target = confirmedRow({
    status: "REG_VALIDATION_FAILED",
    failure_stage: "PROPERTY_CLASS",
    candidates: [
      { unique_no: "LAND", real_cls_cd: "토지", ho: "101",
        unit_source: { ho: "buld_no_inner" } },
      { unique_no: "UNIT", real_cls_cd: "건물", dong: "101", ho: "101",
        unit_source: { ho: "buld_no_inner" } }
    ],
    collector_version: "iros-collector-v4",
    parser_version: "iros-parser-v4",
    matcher_version: "iros-matcher-v8",
    recovery_version: "iros-recovery-v5"
  });
  assert.equal(needsUnitBearingBuildingRematch(target), true);
  const [marked] = markStaleIrosRows([target]);
  assert.equal(marked.reg.stale, true);
  assert.equal(marked.reg.stale_reason, "UNIT_BEARING_BUILDING_REMATCH");

  const unitFailure = confirmedRow({
    ...target.reg,
    status: "REG_UNIT_NOT_FOUND",
    failure_stage: "UNIT"
  });
  assert.equal(needsUnitBearingBuildingRematch(unitFailure), true);

  const unrelated = confirmedRow({
    ...target.reg,
    candidates: [{ unique_no: "LAND", real_cls_cd: "토지", ho: "101",
      unit_source: { ho: "buld_no_inner" } }]
  });
  assert.equal(needsUnitBearingBuildingRematch(unrelated), false);
  const [kept] = markStaleIrosRows([unrelated]);
  assert.equal(kept.reg.stale, undefined);
  assert.equal(isReusableIrosResult(kept.reg), true);
});

test("raw unit failures use a new matcher cache key without unlocking successes", () => {
  const rawFailure = confirmedRow({
    status: "REG_UNIT_NOT_FOUND",
    failure_stage: "UNIT",
    complete: true,
    candidates: [
      { unique_no: "RAW", real_cls_cd: "집합건물", dong: "501", ho: "101" }
    ],
    collector_version: "iros-collector-v4",
    parser_version: "iros-parser-v4",
    matcher_version: "iros-matcher-v9",
    recovery_version: "iros-recovery-v5"
  });
  rawFailure.raw = "경북 경주시 한동그린타운 501-101호";
  rawFailure.result.unit = { dong: "", ho: "101" };
  const [marked] = markStaleIrosRows([rawFailure]);
  assert.equal(marked.reg.stale_reason, "RAW_UNIT_REMATCH");
  assert.equal(marked.reg.stale_module, "R-IROS-RAW-UNIT@1");

  const [success] = markStaleIrosRows([
    confirmedRow({
      status: "RESOLVED",
      unique_no: "LOCKED",
      matcher_version: "iros-matcher-v9",
      stale: true,
      stale_module: "R-IROS-RAW-UNIT@1"
    })
  ]);
  assert.equal(success.reg.unique_no, "LOCKED");
  assert.equal(success.reg.stale, undefined);
  assert.equal(success.reg.stale_module, undefined);
});

test("current terminal results are reusable while partial results retry", () => {
  const resolved = withIrosVersions({ status: "RESOLVED", unique_no: "1234-5678-901234" });
  const partial = withIrosVersions({ status: "REG_PARTIAL_RESPONSE", complete: false });
  assert.equal(isReusableIrosResult(resolved), true);
  assert.equal(isReusableIrosResult(partial), false);
  const progress = irosProgressStats([confirmedRow(resolved), confirmedRow(partial)]);
  assert.deepEqual(
    { total: progress.total, done: progress.done, retryable: progress.retryable },
    { total: 2, done: 1, retryable: 1 }
  );
});

test("IROS judgement and unique-number extraction remain separate KPIs", () => {
  const rows = [
    confirmedRow(withIrosVersions({ status: "RESOLVED", unique_no: "1" })),
    confirmedRow(withIrosVersions({ status: "REG_MULTI" })),
    confirmedRow(withIrosVersions({ status: "REG_UNIT_NOT_FOUND" })),
    confirmedRow(withIrosVersions({ status: "REG_NOT_FOUND" })),
    confirmedRow(withIrosVersions({ status: "REG_PARTIAL_RESPONSE" })),
    confirmedRow(null),
    { result: { status: "CONFIRMED", isJip: true, unit: { dong: "101", ho: "" } }, reg: null }
  ];
  const outcome = irosOutcomeStats(rows);
  assert.deepEqual({
    addressConfirmed: outcome.addressConfirmed,
    inputRequired: outcome.inputRequired,
    target: outcome.target,
    judged: outcome.judged,
    resolved: outcome.resolved,
    multiple: outcome.multiple,
    unitNotFound: outcome.unitNotFound,
    otherFailure: outcome.otherFailure,
    retryRequired: outcome.retryRequired,
    unstarted: outcome.unstarted
  }, {
    addressConfirmed: 7,
    inputRequired: 1,
    target: 6,
    judged: 4,
    resolved: 1,
    multiple: 1,
    unitNotFound: 1,
    otherFailure: 1,
    retryRequired: 1,
    unstarted: 1
  });
  assert.equal(outcome.resolved + outcome.multiple + outcome.unitNotFound + outcome.otherFailure, outcome.judged);
  assert.equal(outcome.judged + outcome.retryRequired + outcome.unstarted, outcome.target);
});

test("snapshot persists all four IROS module versions and phase checkpoint", () => {
  const snapshot = buildIrosSnapshot([], ["부동산번호"], {
    phase: "alternate",
    baseDone: 919,
    baseTotal: 919,
    alternateDone: 12,
    alternateTotal: 28,
    unitDone: 13225,
    unitTotal: 16848
  });
  assert.equal(snapshot.v, 3);
  assert.deepEqual(snapshot.irosVersions, IROS_RUN_VERSIONS);
  assert.equal(snapshot.irosRun.phase, "alternate");
  assert.equal(snapshot.irosRun.alternateTotal, 28);
});

test("compressed XLSX round-trip validates rows, headers, summary, and ZIP end", () => {
  const headers = ["원본주소", "등기고유번호", "IROS매칭근거"];
  const detailRows = [headers, ["주소1", "1111-1111-111111", "{\"ho\":\"101\"}"], ["주소2", "2222-2222-222222", "{\"ho\":\"202\"}"]];
  const detail = XLSX.utils.aoa_to_sheet(detailRows);
  applyWorksheetLayout(XLSX, detail, headers);
  const summary = XLSX.utils.aoa_to_sheet([
    ["결과"],
    [],
    ["전체 처리 건수", 2]
  ]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, summary, "요약");
  XLSX.utils.book_append_sheet(wb, detail, "전체(중복표시)");

  const expectations = {
    summarySheet: "요약",
    detailSheet: "전체(중복표시)",
    expectedHeaders: 3,
    expectedRows: 2,
    expectedSummaryTotal: 2
  };
  const bytes = buildVerifiedWorkbookArray(XLSX, wb, expectations);
  assert.equal(hasZipEndOfCentralDirectory(bytes), true);
  const audit = validateWorkbookArray(XLSX, bytes, expectations);
  assert.equal(audit.detailRows, 2);
  assert.equal(detail["!cols"].length, headers.length);
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
    "narrowCandidatesByBuildingIntent",
    "기본 PNU ${batchBaseDone}/${batchBaseTotal}",
    "batchWorkflow.statusLabel",
    "BATCH_PRIMARY_ACTIONS.DOWNLOAD_ALL",
    "네이버지번주소",
    "finally {",
    "batchActivityRef.current = { ...batchActivityRef.current, iros: false };",
    "setBatchRegBusy(false);"
  ]) {
    assert.ok(source.includes(marker), marker);
  }
});

// This commit intentionally triggers the branch validation workflow.
