import assert from "node:assert/strict";
import test from "node:test";
import {
  attachPipelineMetadata,
  cloneResult,
  dependencyFingerprint,
  fingerprintValue,
  isReusableResult,
  resultFingerprint
} from "../public/pipeline-contract.mjs";

const row = {
  rowId: "row-1",
  raw: "서울특별시 서초구 서초동 967 A동 204-1호",
  zip: "06600",
  extra: ["소유자"],
  unitOverride: { dong: "A", ho: "204-1" }
};
const result = {
  status: "CONFIRMED",
  pnu: "1165010800109670000",
  unit: { dong: "A", ho: "204-1" },
  source: "juso",
  validation: { status: "MATCH" }
};

test("same inputs create the same pipeline fingerprints", () => {
  const a = attachPipelineMetadata(row, result, { groupHints: "UNIT" });
  const b = attachPipelineMetadata(row, { ...result }, { groupHints: "UNIT" });
  assert.equal(a.dependencyFingerprint, b.dependencyFingerprint);
  assert.equal(a.resultFingerprint, b.resultFingerprint);
  assert.equal(isReusableResult({ ...row, result: a }, { groupHints: "UNIT" }), true);
});

test("changed input or upstream evidence invalidates only that result", () => {
  const enriched = attachPipelineMetadata(row, result, { groupHints: "UNIT" });
  assert.notEqual(
    dependencyFingerprint(
      { ...row, zip: "06601" },
      { groupHints: "UNIT" },
      enriched.appliedModules
    ),
    enriched.dependencyFingerprint
  );
  assert.equal(isReusableResult({ ...row, result: enriched }, { groupHints: "JIBUN" }), false);
});

test("result mutation and shared object mutation are detected", () => {
  const enriched = attachPipelineMetadata(row, result);
  const cloned = cloneResult(enriched);
  cloned.unit.ho = "999";
  assert.equal(enriched.unit.ho, "204-1");
  assert.notEqual(resultFingerprint(cloned), enriched.resultFingerprint);
});

test("canonical fingerprints ignore object key order", () => {
  assert.equal(fingerprintValue({ a: 1, b: 2 }), fingerprintValue({ b: 2, a: 1 }));
});

test("explicit old-address evidence is recorded as an applied module", () => {
  const enriched = attachPipelineMetadata(row, {
    ...result,
    validation: {
      status: "MATCH",
      oldAddressMap: { version: "admin-successor-v1", from: "배방면", to: "배방읍" }
    }
  });
  assert.ok(enriched.appliedModules.includes("OLD_ADDRESS"));
});
