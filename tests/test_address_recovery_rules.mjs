import assert from "node:assert/strict";
import test from "node:test";

import {
  canAcceptNaverRegionCorrection,
  isBuildingPartToken,
  sameBuildingIdentity,
  shouldEscalateJusoMultiToNaver
} from "../public/address-recovery-rules.mjs";

test("building parts are not treated as administrative districts", () => {
  for (const token of ["상가", "상가동", "제상가동"]) {
    assert.equal(isBuildingPartToken(token), true, token);
  }
  assert.equal(isBuildingPartToken("평산동"), false);
});

test("JUSO multi candidates escalate only when a building name exists", () => {
  assert.equal(shouldEscalateJusoMultiToNaver(10, "태원아파트"), true);
  assert.equal(shouldEscalateJusoMultiToNaver(1, "태원아파트"), false);
  assert.equal(shouldEscalateJusoMultiToNaver(10, ""), false);
});

test("building identity remains narrow", () => {
  assert.equal(sameBuildingIdentity("부전타워", "부전타워"), true);
  assert.equal(sameBuildingIdentity("부전타워", "부전타워 상가동"), true);
  assert.equal(sameBuildingIdentity("태원아파트", "다른태원아파트"), true);
  assert.equal(sameBuildingIdentity("현대아파트", "신현대아파트"), false);
});

test("Naver administrative correction requires all exact evidence", () => {
  const base = {
    level: "L3",
    validation: { status: "MISMATCH", reason: "법정동 불일치(만화리≠교리)" },
    naverPnuOk: true,
    reviewNeeded: null,
    addressMatchEvidence: ["EXACT_ROAD"],
    inputBuildingName: "부전타워",
    resultBuildingName: "부전타워"
  };
  assert.equal(canAcceptNaverRegionCorrection(base), true);
  assert.equal(canAcceptNaverRegionCorrection({ ...base, validation: { status: "MISMATCH", reason: "시도 불일치(부산≠경기)" } }), false);
  assert.equal(canAcceptNaverRegionCorrection({ ...base, naverPnuOk: false }), false);
  assert.equal(canAcceptNaverRegionCorrection({ ...base, reviewNeeded: "naver_jibun_mismatch" }), false);
  assert.equal(canAcceptNaverRegionCorrection({ ...base, addressMatchEvidence: [] }), false);
  assert.equal(canAcceptNaverRegionCorrection({ ...base, resultBuildingName: "신도그랑피아" }), false);
});
