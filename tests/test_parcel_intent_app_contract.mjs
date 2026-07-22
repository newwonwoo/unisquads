import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("address resolve applies explicit parcel intent before building intent", async () => {
  const source = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
  const parcel = source.indexOf("narrowCandidatesByExplicitParcel(deduped");
  const building = source.indexOf("narrowCandidatesByBuildingIntent(deduped");
  assert.notEqual(parcel, -1);
  assert.notEqual(building, -1);
  assert.equal(parcel < building, true);
  assert.equal(source.includes("candidateIntentDiagnostics"), true);
});
