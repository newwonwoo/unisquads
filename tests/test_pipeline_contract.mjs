import assert from "node:assert/strict";
import test from "node:test";
import {
  MODULE_VERSIONS,
  attachPipelineMetadata,
  cloneResult,
  dependencyFingerprint,
  fingerprintValue,
  isProtectedAddressSuccess,
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

test("confirmed PNU stays locked across a pipeline-only version change", () => {
  const legacy = {
    ...result,
    pipelineVersion: "addr-pipeline-v6"
  };
  assert.equal(isProtectedAddressSuccess({ ...row, result: legacy }), true);
  assert.equal(isReusableResult({ ...row, result: legacy }, { groupHints: "CHANGED" }), true);
});

test("a targeted commercial-range repair can bypass the confirmed PNU lock", () => {
  const targeted = {
    ...result,
    pipelineVersion: "addr-pipeline-v6",
    unit: { dong: "", ho: "3" }
  };
  const targetedRow = {
    ...row,
    raw: "경기 오산시 원동 태원아파트 101-107 상가 지하1층 3호",
    result: targeted
  };
  assert.equal(isProtectedAddressSuccess(targetedRow), true);
  assert.equal(isReusableResult(targetedRow), false);
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
      oldAddressMap: { version: "admin-successor-v2", from: "배방면", to: "배방읍" }
    }
  });
  assert.ok(enriched.appliedModules.includes("OLD_ADDRESS"));
});

test("only the changed parsing contracts expose their new module versions", () => {
  assert.equal(MODULE_VERSIONS.UNIT_PARSE, "9");
  assert.equal(MODULE_VERSIONS.REGION_VALIDATE, "6");
  assert.equal(MODULE_VERSIONS.JUSO_LOOKUP, "9");
  assert.equal(MODULE_VERSIONS.NAVER_RECOVERY, "5");
  assert.equal(MODULE_VERSIONS.NAVER_PNU_EXACT_LOT, "1");
});

test("only legacy Naver PNU failures rerun the exact-address recovery once", () => {
  const failedRow = {
    ...row,
    result: {
      status: "NAVER_CONFIRMED_PNU_FAILED",
      searchLevel: "L3",
      naverAddr: "전라남도 순천시 용당동 431 용당피오레"
    }
  };
  assert.equal(isReusableResult(failedRow), false);

  const attempted = attachPipelineMetadata(failedRow, {
    ...failedRow.result,
    naverPnuRecoveryVersion: "1"
  });
  assert.equal(attempted.appliedModules.includes("NAVER_PNU_EXACT_LOT"), true);
  assert.equal(isReusableResult({ ...failedRow, result: attempted }), true);
});
