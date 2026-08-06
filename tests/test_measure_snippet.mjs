import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { build } from "../scripts/build-measure-snippet.mjs";

const snippet = await readFile(new URL("../measure-snippet.js", import.meta.url), "utf8");

// 손으로 옮겨 적은 사본은 반드시 어긋난다. 실제 모듈에서 생성한 결과와
// 커밋된 파일이 같아야 한다.
test("붙여넣기 스니펫이 실제 모듈과 어긋나지 않는다", async () => {
  assert.equal(snippet, await build());
});

test("스니펫은 모듈 문법 없이 콘솔에서 그대로 평가된다", () => {
  // import/export가 남아 있으면 콘솔 붙여넣기가 SyntaxError로 죽는다.
  assert.equal(/^\s*import\s/m.test(snippet), false);
  assert.equal(/^\s*export\s/m.test(snippet), false);
  // 전체가 하나의 IIFE여야 부분 붙여넣기 사고가 나지 않는다.
  assert.equal(snippet.trimStart().startsWith("//"), true);
  assert.ok(snippet.includes("(() => {"));
});

test("스니펫은 읽기만 하고 조회·저장·전송을 하지 않는다", () => {
  // 측정은 이미 저장된 결과만 본다. 새 조회나 쓰기가 섞이면 안 된다.
  assert.equal(/\bfetch\s*\(/.test(snippet), false);
  assert.equal(/XMLHttpRequest/.test(snippet), false);
  assert.equal(/navigator\.sendBeacon/.test(snippet), false);
  assert.equal(/"readwrite"/.test(snippet), false);
  assert.equal(/\.put\s*\(/.test(snippet), false);
  assert.equal(/\.delete\s*\(/.test(snippet), false);
  assert.ok(snippet.includes('transaction("batch")'));
});

test("스니펫 출력에는 원문주소·소유자가 들어가지 않는다", async () => {
  const { measure, report } = await import("../public/recovery-impact.mjs");
  const rows = JSON.parse(await readFile(
    new URL("./fixtures/recovery-impact-snapshot.json", import.meta.url), "utf8"
  )).rows;
  const text = report(measure(rows));
  for (const row of rows) {
    assert.equal(text.includes(row.raw), false, row.rowId);
    if (row.result?.jibunAddr) assert.equal(text.includes(row.result.jibunAddr), false, row.rowId);
  }
  assert.equal(/소유자|주민|\d{6}-\d{7}/.test(text), false);
});
