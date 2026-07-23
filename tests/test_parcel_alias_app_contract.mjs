import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("parcel alias probe runs before ordinary multi-lot and primary JUSO lookup", async () => {
  const source = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
  const fn = source.indexOf("async function probeExplicitParcelAliases");
  const call = source.indexOf("await probeExplicitParcelAliases(pre, clients, tried)");
  const multi = source.indexOf("await probeExplicitLots(pre, clients, tried)");
  const primary = source.indexOf("if (!skipJuso)");
  assert.notEqual(fn, -1);
  assert.notEqual(call, -1);
  assert.notEqual(multi, -1);
  assert.notEqual(primary, -1);
  assert.equal(call < multi, true);
  assert.equal(call < primary, true);
  assert.equal(source.includes('level: "M0_PARCEL_ALIAS"'), true);
  assert.equal(source.includes('"EXPLICIT_PARCEL_ALIAS_QUERY"'), true);
});
