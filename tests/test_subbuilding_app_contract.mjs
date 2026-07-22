import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("sub-building narrowing starts from exact-address evidence", async () => {
  const source = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
  assert.equal(source.includes("const addressEvidence = [...addressEvidence];"), false);
  assert.equal(source.includes("const addressEvidence = [...addressNarrowing.evidence];"), true);
  assert.equal(source.includes("narrowByExplicitSubBuilding(deduped, pre?.subBuilding)"), true);
});

test("attached numeric dong-room and basement floor are preserved", async () => {
  const source = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
  assert.equal(source.includes("동\\s*(\\d{2,5}"), true);
  assert.equal(source.includes("floor = floorIntentFromText(text) || null;"), true);
});
