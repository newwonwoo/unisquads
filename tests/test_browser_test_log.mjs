import assert from "node:assert/strict";
import test from "node:test";

import {
  browserTestLogsToCsv,
  createBrowserTestRun,
  summarizeTestRows,
  updateBrowserTestRun,
  upsertBrowserTestRun
} from "../public/browser-test-log.mjs";

const rows = [
  { rowId: "1", raw: "서울 강남구 A", result: { status: "CONFIRMED", pnu: "1" }, reg: { status: "RESOLVED", unique_no: "A", complete: true } },
  { rowId: "2", raw: "서울 강남구 B", result: { status: "CONFIRMED", pnu: "2" }, reg: { status: "REG_UNIT_NOT_FOUND", complete: true } },
  { rowId: "3", raw: "서울 강남구 C", result: { status: "CONFIRMED", pnu: "3" }, reg: { status: "UNIT_INPUT_REQUIRED", complete: true } },
  { rowId: "4", raw: "서울 강남구 D", result: { status: "AMBIGUOUS" } },
  { rowId: "5", raw: "서울 강남구 E", result: { status: "FAILED" } }
];

test("summarizes address and IROS outcomes without storing raw addresses", () => {
  const summary = summarizeTestRows(rows);
  assert.equal(summary.total_rows, 5);
  assert.equal(summary.address.confirmed, 3);
  assert.equal(summary.address.review, 1);
  assert.equal(summary.address.failed, 1);
  assert.equal(summary.iros.eligible, 2);
  assert.equal(summary.iros.resolved, 1);
  assert.equal(summary.iros.unit_not_found, 1);
  assert.equal(summary.iros.input_required, 1);
  assert.match(summary.fingerprint, /^fnv1a64:[0-9a-f]{16}$/);
  assert.equal(JSON.stringify(summary).includes("서울 강남구 A"), false);
});

test("updates the same run and preserves deterministic result fingerprint", () => {
  const run = createBrowserTestRun({ id: "run-1", started_at: "2026-07-23T00:00:00.000Z" }, rows);
  const updated = updateBrowserTestRun(run, rows, {
    phase: "complete",
    updated_at: "2026-07-23T00:01:00.000Z"
  });
  assert.equal(updated.id, "run-1");
  assert.equal(updated.duration_ms, 60000);
  assert.equal(updated.summary.fingerprint, run.summary.fingerprint);
  assert.equal(updated.completed_at, "2026-07-23T00:01:00.000Z");
});

test("upserts newest run first and enforces history limit", () => {
  const logs = [
    { id: "old", updated_at: "2026-07-22T00:00:00.000Z" },
    { id: "same", updated_at: "2026-07-22T01:00:00.000Z" }
  ];
  const next = upsertBrowserTestRun(logs, { id: "same", updated_at: "2026-07-23T00:00:00.000Z" }, 2);
  assert.deepEqual(next.map((item) => item.id), ["same", "old"]);
});

test("CSV includes summary fields but not row-level raw addresses", () => {
  const run = createBrowserTestRun({
    id: "run-1",
    file_name: "result.xlsx",
    pipeline_version: "addr-pipeline-v7",
    browser: { user_agent: "test-browser" },
    iros_versions: { matcher: "iros-matcher-v8" }
  }, rows);
  const csv = browserTestLogsToCsv([run]);
  assert.match(csv, /addr-pipeline-v7/);
  assert.match(csv, /iros-matcher-v8/);
  assert.equal(csv.includes("서울 강남구 A"), false);
});
