import assert from "node:assert/strict";
import test from "node:test";

import {
  canAcceptZipBuildingCorrection,
  extractExplicitLotRefs,
  hasOmittedExtraLots,
  isLandMultiProbeEligible,
  isUnitLikeLot,
  ownerSearchKeyword,
  selectAggregateBuildingCandidates
} from "../public/address-multilot-rules.mjs";

test("multi-lot parser expands abbreviated lots", () => {
  assert.deepEqual(
    extractExplicitLotRefs("강원 동해시 어달동 12-1,2,5 묵호진동1-83 101동 101호"),
    [
      { legal: "어달동", lot: "12-1" },
      { legal: "어달동", lot: "12-2" },
      { legal: "어달동", lot: "12-5" },
      { legal: "묵호진동", lot: "1-83" }
    ]
  );
});

test("omitted extra lots remain one aggregate row", () => {
  const raw = "울산 남구 삼산동 1482~1513 1498-3외 7필지 2동 601호";
  const refs = extractExplicitLotRefs(raw);
  assert.equal(hasOmittedExtraLots(raw), true);
  assert.deepEqual(refs, [{ legal: "삼산동", lot: "1498-3" }]);
  assert.equal(isLandMultiProbeEligible({ raw, refs, unit: {}, buildingName: "" }), false);
});

test("land probing excludes unit-looking secondary numbers", () => {
  const landRaw = "경기 양주시 백석읍 방성리 162-4 162-12";
  assert.equal(isLandMultiProbeEligible({
    raw: landRaw,
    refs: extractExplicitLotRefs(landRaw),
    unit: {},
    buildingName: ""
  }), true);
  const unitRaw = "강원 평창군 평창읍 종부리 576-1 1-101";
  assert.equal(isLandMultiProbeEligible({
    raw: unitRaw,
    refs: extractExplicitLotRefs(unitRaw),
    unit: {},
    buildingName: ""
  }), false);
  assert.deepEqual(isUnitLikeLot("101-105"), { dong: "101", ho: "105" });
});

test("aggregate buildings collapse by building management number", () => {
  const selected = selectAggregateBuildingCandidates([
    { bdMgtSn: "A", admCd: "1", mnnm: "12", slno: "1", isJip: true, detBdNmList: "101동,202동", bdNm: "삼본아파트" },
    { bdMgtSn: "A", admCd: "1", mnnm: "1", slno: "83", isJip: true, detBdNmList: "101동,202동", bdNm: "삼본아파트" },
    { bdMgtSn: "B", admCd: "1", mnnm: "12", slno: "2", isJip: true, detBdNmList: "상가동", bdNm: "다른건물" }
  ], { dong: "101", ho: "101" });
  assert.equal(selected.length, 2);
  assert.ok(selected.every((candidate) => candidate.bdMgtSn === "A"));
});

test("owner fallback uses distinctive owner cores", () => {
  assert.equal(ownerSearchKeyword("㈜협진주택"), "협진");
  assert.equal(ownerSearchKeyword("(주)해오름건설"), "해오름");
  assert.equal(ownerSearchKeyword("삼본종합건설㈜"), "삼본");
  assert.equal(ownerSearchKeyword("㈜대원주택"), "");
});

test("cross-region building correction needs zip evidence", () => {
  const base = {
    validation: { status: "MISMATCH", reason: "시도 불일치(충남≠세종)" },
    naverPnuOk: true,
    addressMatchEvidence: ["EXACT_ROAD"],
    inputBuildingName: "가락마을아파트",
    resultBuildingName: "가락마을아파트",
    resultAddress: "세종특별자치시 도움1로 10 가락마을아파트",
    zipRegions: ["세종특별자치시|세종시"]
  };
  assert.equal(canAcceptZipBuildingCorrection(base), true);
  assert.equal(canAcceptZipBuildingCorrection({ ...base, zipRegions: ["충청남도|예산군"] }), false);
  assert.equal(canAcceptZipBuildingCorrection({ ...base, inputBuildingName: "현대아파트", resultBuildingName: "현대아파트" }), false);
});
