import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  analyzeBatchUpload,
  buildSourceRawValues,
  summarizeRefineStatuses
} from "../public/batch-ui-stats.mjs";

test("upload figures separate source rows, refine rows, and actual calls", () => {
  const source = ["서울 강남구 역삼동 1", " 서울   강남구 역삼동 1 ", "부산 해운대구 우동 2", ""];
  assert.deepEqual(analyzeBatchUpload(source, 3, 2), {
    sourceRows: 4,
    addressRows: 3,
    emptyRows: 1,
    refineRows: 3,
    refineTargets: 2,
    duplicateReuse: 1
  });
});

test("address and detail columns are combined once", () => {
  const values = buildSourceRawValues([
    ["서울 서초구 반포동 1", "101동 101호"],
    ["부산 기장군 기장읍 교리 271-8", ""]
  ], 0, 1);
  assert.deepEqual(values, ["서울 서초구 반포동 1 101동 101호", "부산 기장군 기장읍 교리 271-8"]);
});

test("all result statuses belong to exactly one display bucket", () => {
  const statuses = [
    "CONFIRMED",
    "NAVER_CONFIRMED_PNU_FAILED",
    "AMBIGUOUS",
    "VALIDATION_FAILED",
    "HUMAN_INPUT_ERROR",
    "SYSTEM_ERROR",
    "FAILED",
    "FUTURE_UNKNOWN_STATUS"
  ];
  const summary = summarizeRefineStatuses(statuses.map((status) => ({ result: { status } })));
  assert.deepEqual(summary, { total: 8, confirmed: 1, review: 4, failed: 3 });
  assert.equal(summary.confirmed + summary.review + summary.failed, summary.total);
});

test("functional status counts stay separate from display summary", async () => {
  const source = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
  for (const marker of [
    "const stat = rows.reduce",
    "const refineSummary = summarizeRefineStatuses(rows);",
    "정제대상 원문",
    "실제 정제 호출",
    "중복 결과 재사용",
    "refineSummary.confirmed",
    "현재까지 결과 다운로드"
  ]) assert.ok(source.includes(marker), marker);
  assert.equal(source.includes("최대 중복그룹"), false);
});
