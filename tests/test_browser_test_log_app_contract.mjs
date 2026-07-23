import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("batch workflow records browser-local address and IROS test phases", async () => {
  const source = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
  assert.equal(source.includes('from "./browser-test-log.mjs"'), true);
  assert.equal(source.includes('recordTestRun("address_running"'), true);
  assert.equal(source.includes('"address_complete"'), true);
  assert.equal(source.includes('recordTestRun("iros_running"'), true);
  assert.equal(source.includes('recordTestRun(interrupted ? "iros_interrupted" : "complete"'), true);
  assert.equal(source.includes("TEST_LOG_STORAGE_KEY"), true);
  assert.equal(source.includes("TEST_LOG_ACTIVE_KEY"), true);
});

test("test log UI supports browser history export and deletion", async () => {
  const source = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
  assert.equal(source.includes("function TestLogPanel"), true);
  assert.equal(source.includes("브라우저 테스트 로그"), true);
  assert.equal(source.includes("원본주소와 API 키는 기록하지 않음"), true);
  assert.equal(source.includes('downloadTestLogs("json")'), true);
  assert.equal(source.includes('downloadTestLogs("csv")'), true);
  assert.equal(source.includes("테스트 로그 ("), true);
});
