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

test("building-part leaves and trailing unit pairs are not parcel evidence", () => {
  assert.deepEqual(
    extractExplicitLotRefs("서울 광진구 자양동 767-1 101-101"),
    [{ legal: "자양동", lot: "767-1" }]
  );
  assert.deepEqual(
    extractExplicitLotRefs("인천 남동구 만수동 창대장터상가 1-110"),
    []
  );
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

test("건물명이 동으로 시작해도 앞 지번을 잃지 않는다", () => {
  // "414-2 동산apt"의 동산을 동 표기로 읽어 414-2가 통째로 빠지던 문제.
  // 광주 동산아파트는 414와 414-2 두 지번에 걸쳐 있는데 414로만 조회돼
  // 101동이 후보에 아예 없었다(실측 134행).
  assert.deepEqual(
    extractExplicitLotRefs("광주 서구 농성동 414,414-2 동산apt 제 101동 101"),
    [{ legal: "농성동", lot: "414" }, { legal: "농성동", lot: "414-2" }]
  );
  assert.deepEqual(
    extractExplicitLotRefs("서울 강서구 등촌동 691-1 동성아파트 101-402"),
    [{ legal: "등촌동", lot: "691-1" }]
  );
});

test("숫자에 붙은 동·호·층은 여전히 지번이 아니다", () => {
  // 완화는 뒤에 한글이 이어질 때만이다. 101동·608호는 그대로 세대 표기다.
  assert.deepEqual(
    extractExplicitLotRefs("서울 강남구 역삼동 736-25 101동 608호"),
    [{ legal: "역삼동", lot: "736-25" }]
  );
  assert.deepEqual(
    extractExplicitLotRefs("경기 이천시 부발읍 응암리 97-3외 이화아파트 201동 101호"),
    [{ legal: "응암리", lot: "97-3" }]
  );
  assert.deepEqual(
    extractExplicitLotRefs("충남 천안시 북면 상동리 91-6, 441-1 중앙아파트 101-405"),
    [{ legal: "상동리", lot: "91-6" }, { legal: "상동리", lot: "441-1" }]
  );
});
