import assert from "node:assert/strict";
import test from "node:test";
import {
  browserTestLogsToCsv,
  compareTestRuns,
  createBrowserTestRun,
  updateBrowserTestRun,
  upsertBrowserTestRun
} from "../public/browser-test-log.mjs";

const baselineRows = [
  { rowId: "1", raw: "주소1", result: { status: "CONFIRMED", pnu: "P1", bdMgtSn: "B1" }, reg: { status: "RESOLVED", unique_no: "U1" } },
  { rowId: "2", raw: "주소2", result: { status: "AMBIGUOUS" }, reg: { status: "REG_NOT_FOUND" } },
  { rowId: "3", raw: "주소3", result: { status: "CONFIRMED", pnu: "P3", bdMgtSn: "B3" }, reg: { status: "RESOLVED", unique_no: "U3" } }
];

const currentRows = [
  { rowId: "1", raw: "주소1", result: { status: "FAILED", pnu: "", bdMgtSn: "" }, reg: { status: "REG_NOT_FOUND" } },
  { rowId: "2", raw: "주소2", result: { status: "CONFIRMED", pnu: "P2", bdMgtSn: "B2" }, reg: { status: "RESOLVED", unique_no: "U2" } },
  { rowId: "3", raw: "주소3", result: { status: "CONFIRMED", pnu: "P3X", bdMgtSn: "B3X" }, reg: { status: "RESOLVED", unique_no: "U3X" } }
];

test("빌드 식별자를 실행 로그와 기존 화면 표시 필드에 남긴다", () => {
  globalThis.__APP_BUILD_INFO__ = {
    git_commit_sha: "977b44eba151c7bc639bad9689a726601b2aea10",
    vercel_deployment_id: "dpl_test",
    deployed_at: "2026-07-23T04:11:00.000Z",
    app_version: "addr-pipeline-v7+977b44e.asset",
    app_asset_sha256: "asset",
    loaded_at: "2026-07-23T04:12:00.000Z"
  };
  const run = createBrowserTestRun({ pipeline_version: "addr-pipeline-v7" }, baselineRows);
  assert.equal(run.execution.git_commit_sha.slice(0, 7), "977b44e");
  assert.equal(run.execution.vercel_deployment_id, "dpl_test");
  assert.equal(run.execution.app_version, "addr-pipeline-v7+977b44e.asset");
  assert.match(run.execution.pipeline_version, /addr-pipeline-v7 · build 977b44e · 2026-07-23 13:11/);
});

test("동일 입력의 직전 완료 실행과 자동 회귀 비교한다", () => {
  const base = updateBrowserTestRun(createBrowserTestRun({ id: "base", pipeline_version: "v7", file_name: "same.xlsx", file_size: 100, file_last_modified: 1, source_rows: 3 }, baselineRows), baselineRows, { phase: "complete", updated_at: "2026-07-22T00:00:00.000Z" });
  const current = updateBrowserTestRun(createBrowserTestRun({ id: "current", pipeline_version: "v7", file_name: "same.xlsx", file_size: 100, file_last_modified: 1, source_rows: 3 }, currentRows), currentRows, { phase: "complete", updated_at: "2026-07-23T00:00:00.000Z" });
  const compared = compareTestRuns(base, current);
  assert.equal(compared.status, "FAIL");
  assert.equal(compared.metrics.confirmed_to_unconfirmed.count, 1);
  assert.equal(compared.metrics.confirmed_pnu_changed.count, 1);
  assert.equal(compared.metrics.building_management_no_changed.count, 1);
  assert.equal(compared.metrics.iros_unique_no_changed.count, 1);
  assert.equal(compared.metrics.iros_success_to_failure.count, 1);
  assert.equal(compared.metrics.newly_confirmed.count, 1);
  assert.equal(compared.changed_rows.length, 3);
  assert.equal("raw" in compared.changed_rows[0], false);
});

test("upsert 시 직전 동일 파일 결과를 찾아 회귀 정보를 붙인다", () => {
  const base = updateBrowserTestRun(createBrowserTestRun({ id: "base", pipeline_version: "v7", file_name: "same.xlsx", file_size: 100, file_last_modified: 1, source_rows: 3 }, baselineRows), baselineRows, { phase: "complete", updated_at: "2026-07-22T00:00:00.000Z" });
  const current = updateBrowserTestRun(createBrowserTestRun({ id: "current", pipeline_version: "v7", file_name: "same.xlsx", file_size: 100, file_last_modified: 1, source_rows: 3 }, currentRows), currentRows, { phase: "complete", updated_at: "2026-07-23T00:00:00.000Z" });
  const logs = upsertBrowserTestRun([base], current);
  assert.equal(logs[0].regression.baseline_run_id, "base");
  assert.equal(logs[0].regression.metrics.newly_confirmed.count, 1);
  assert.equal(logs[0].row_outcomes[0].source_hash.startsWith("fnv1a64:"), true);
  assert.equal("raw" in logs[0].row_outcomes[0], false);
});

test("CSV에도 빌드와 회귀 지표를 포함한다", () => {
  const run = updateBrowserTestRun(createBrowserTestRun({ id: "x", pipeline_version: "v7" }, baselineRows), baselineRows, { phase: "complete" });
  const csv = browserTestLogsToCsv([run]);
  assert.match(csv, /git_commit_sha/);
  assert.match(csv, /regression_status/);
  assert.match(csv, /newly_confirmed/);
});

test("이전 행이 사라지면 확정 및 IROS 회귀로 잡는다", () => {
  const base = updateBrowserTestRun(createBrowserTestRun({ id: "base-missing", pipeline_version: "v7" }, baselineRows), baselineRows, { phase: "complete" });
  const current = updateBrowserTestRun(createBrowserTestRun({ id: "current-missing", pipeline_version: "v7" }, baselineRows.slice(1)), baselineRows.slice(1), { phase: "complete" });
  const compared = compareTestRuns(base, current);
  assert.equal(compared.metrics.confirmed_to_unconfirmed.count, 1);
  assert.equal(compared.metrics.iros_success_to_failure.count, 1);
  assert.equal(compared.changed_rows.some((row) => row.changes.includes("ROW_MISSING")), true);
});
