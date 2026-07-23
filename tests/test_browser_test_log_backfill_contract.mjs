import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("existing saved batch is imported once by result fingerprint", async () => {
  const source = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
  assert.equal(source.includes("기존 브라우저 저장 작업"), true);
  assert.equal(source.includes("imported_existing_snapshot: true"), true);
  assert.equal(source.includes("firstResult.pipelineVersion || \"unknown\""), true);
  assert.equal(source.includes("item?.summary?.fingerprint === imported.summary.fingerprint"), true);
  assert.equal(source.includes("const savedBatch = await idbGet(BATCH_KEY)"), true);
});

test("snapshot phase uses real address and IROS progress", async () => {
  const source = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
  assert.equal(source.includes("const progress = irosProgressStats(savedRows)"), true);
  assert.equal(source.includes('phase = progress.final'), true);
  assert.equal(source.includes('pipeline_version: firstResult.pipelineVersion'), true);
  assert.equal(source.includes('matcher: firstReg.matcher_version'), true);
});
