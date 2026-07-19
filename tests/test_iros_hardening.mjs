import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import * as XLSX from "xlsx";

import {
  IROS_RUN_VERSIONS,
  buildIrosSnapshot,
  irosProgressStats,
  isIrosExportFinal,
  isReusableIrosResult,
  markStaleIrosRows,
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

test("old matcher/parser results are stale and not final", () => {
  const rows = markStaleIrosRows([
    confirmedRow({
      status: "RESOLVED",
      collector_version: "iros-collector-v4",
      parser_version: "iros-parser-v3",
      matcher_version: "iros-matcher-v4"
    })
  ]);
  assert.equal(rows[0].reg.stale, true);
  assert.equal(isReusableIrosResult(rows[0].reg), false);
  const progress = irosProgressStats(rows);
  assert.equal(progress.total, 1);
  assert.equal(progress.done, 0);
  assert.equal(progress.stale, 1);
  assert.equal(isIrosExportFinal(rows), false);
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
    "중간결과 다운로드 (PARTIAL)",
    "recovery_version: IROS_RUN_VERSIONS.recovery",
    "기본 PNU ${batchBaseDone}/${batchBaseTotal}",
    "finally {\n      setBatchRegBusy(false);"
  ]) {
    assert.ok(source.includes(marker), marker);
  }
});

// This commit intentionally triggers the branch validation workflow.
