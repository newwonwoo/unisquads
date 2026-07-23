import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("build info loader runs before app module", async () => {
  const html = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
  assert.ok(html.indexOf('/build-info.js') < html.indexOf('/app.js'));
});

test("unit parser module version is bumped", async () => {
  const module = await import("../public/pipeline-contract.mjs");
  assert.equal(module.MODULE_VERSIONS.UNIT_PARSE, "9");
});
