import assert from "node:assert/strict";
import test from "node:test";
import { parseCompactAlphaUnit } from "../public/address-quality-rules.mjs";
import {
  attachPipelineMetadata,
  dependencyFingerprint,
  isReusableResult,
  resultFingerprint
} from "../public/pipeline-contract.mjs";
import {
  extractBuildingRangeIntent,
  extractCommercialFloorRoomIntent
} from "../public/address-subbuilding-rules.mjs";
import {
  extractUnitIntent,
  matchUnitByBuildingProfile
} from "../public/iros-unit-profile.mjs";
import {
  isReusableIrosResult,
  markStaleIrosRows,
  needsCommercialRangeUnitRematch,
  withIrosVersions
} from "../public/iros-run-contract.mjs";

test("층과 호를 실제 호수로 조합한다", () => {
  assert.deepEqual(parseCompactAlphaUnit("서울 강남구 역삼동 1 101동 3층1호"), {
    dong: "101", floor: "3", ho: "301", matched: " 101동 3층1호", index: 12, evidence: "dong_floor_ho_composed"
  });
  assert.equal(parseCompactAlphaUnit("101동 5층12호").ho, "512");
  assert.equal(parseCompactAlphaUnit("101동 11층3호").ho, "1103");
});

test("이미 완성된 호수는 다시 조합하지 않는다", () => {
  assert.equal(parseCompactAlphaUnit("101동 11층1103호").ho, "1103");
  assert.equal(parseCompactAlphaUnit("3층301호").ho, "301");
});

test("건물명 뒤 단독 숫자는 전처리 단계에서 확정하지 않는다", () => {
  assert.equal(parseCompactAlphaUnit("부산 금정구 남산동 9 우남이채롬 108"), null);
  assert.equal(parseCompactAlphaUnit("서울 노원구 공릉동 123-4 서일이츠뷰 302"), null);
});

test("PNU 확정 뒤에만 건물명 말미 3~4자리 숫자를 호로 승격한다", () => {
  const confirmed = attachPipelineMetadata(
    { raw: "부산 금정구 남산동 9 우남이채롬 108" },
    { status: "CONFIRMED", pnu: "2641010900100090000", unit: { dong: null, ho: null } }
  );
  assert.equal(confirmed.unit.ho, "108");
  assert.equal(confirmed.unitRecovery.kind, "confirmed_pnu_building_trailing_ho");

  const notConfirmed = attachPipelineMetadata(
    { raw: "부산 금정구 남산동 9 우남이채롬 108" },
    { status: "AMBIGUOUS", pnu: "", unit: { dong: null, ho: null } }
  );
  assert.equal(notConfirmed.unit.ho, null);
  assert.equal(notConfirmed.unitRecovery, undefined);
});

test("세대수·면적·연도 표현은 PNU가 있어도 호로 보지 않는다", () => {
  for (const raw of [
    "서울 노원구 공릉동 123-4 서일이츠뷰 총 302세대",
    "서울 노원구 공릉동 123-4 서일이츠뷰 전용 302",
    "서울 노원구 공릉동 123-4 서일이츠뷰 2026년"
  ]) {
    const result = attachPipelineMetadata(
      { raw },
      { status: "CONFIRMED", pnu: "1135010300101230004", unit: { dong: null, ho: null } }
    );
    assert.equal(result.unit.ho, null);
    assert.equal(result.unitRecovery, undefined);
  }
});

const TAEWON_ROWS = [
  {
    raw: "경남 양산시 평산동 태원아파트 101-107 평산리 564 상가 지하1층3호",
    oldUnit: { dong: null, floor: "B1", ho: "3" },
    floor: "B1",
    room: "3"
  },
  {
    raw: "경남 양산시 평산동 태원아파트 101-107 상가 1층6호",
    oldUnit: { dong: null, floor: "1", ho: "106" },
    floor: "1",
    room: "6"
  },
  {
    raw: "경남 양산시 평산동 태원아파트 101-107 상가 2층16호",
    oldUnit: { dong: null, floor: "2", ho: "216" },
    floor: "2",
    room: "16"
  }
];

test("101-107은 동 범위이고 뒤 상가 층·호가 실제 전유부다", () => {
  for (const item of TAEWON_ROWS) {
    const range = extractBuildingRangeIntent(item.raw);
    const commercial = extractCommercialFloorRoomIntent(item.raw);
    assert.deepEqual(
      [range.start, range.end, commercial.floor, commercial.room],
      ["101", "107", item.floor, item.room]
    );

    const intent = extractUnitIntent(item.raw, item.oldUnit);
    assert.equal(intent.dong, "");
    assert.equal(intent.floor, item.floor);
    assert.equal(intent.room, item.room);
    assert.equal(intent.subBuilding.kind, "COMMERCIAL");
    assert.equal(intent.buildingRange.kind, "DONG_RANGE");
  }
});

test("확정 PNU는 유지하고 상가 층·호만 구조화한다", () => {
  for (const item of TAEWON_ROWS) {
    const row = { raw: item.raw };
    const result = attachPipelineMetadata(row, {
      status: "CONFIRMED",
      pnu: "4833011900105640000",
      jibunAddr: "경상남도 양산시 평산동 564 태원아파트",
      unit: item.oldUnit
    });
    assert.equal(result.pnu, "4833011900105640000");
    assert.equal(result.unit.dong, null);
    assert.equal(result.unit.floor, item.floor);
    assert.equal(result.unit.ho, item.room);
    assert.equal(result.commercialRangeUnitRecovery.rangeStart, "101");
    assert.equal(result.commercialRangeUnitRecovery.rangeEnd, "107");
    assert.ok(result.appliedModules.includes("COMMERCIAL_RANGE_UNIT"));
  }
});

test("신규 상가 범위 규칙은 해당 행만 주소 재정제 대상으로 만든다", () => {
  const raw = TAEWON_ROWS[1].raw;
  const row = { raw };
  const current = attachPipelineMetadata(row, {
    status: "CONFIRMED",
    pnu: "4833011900105640000",
    unit: { dong: null, floor: "1", ho: "106" }
  });
  assert.equal(isReusableResult({ ...row, result: current }), true);

  const legacy = { ...current };
  delete legacy.commercialRangeUnitRecovery;
  legacy.appliedModules = legacy.appliedModules.filter((name) => name !== "COMMERCIAL_RANGE_UNIT");
  legacy.moduleVersions = Object.fromEntries(
    Object.entries(legacy.moduleVersions).filter(([name]) => name !== "COMMERCIAL_RANGE_UNIT")
  );
  legacy.dependencyFingerprint = dependencyFingerprint(row, {}, legacy.appliedModules);
  legacy.resultFingerprint = resultFingerprint(legacy);
  assert.equal(isReusableResult({ ...row, result: legacy }), false);

  const normalRow = { raw: "경남 양산시 평산동 태원아파트 102동1204호" };
  const normal = attachPipelineMetadata(normalRow, {
    status: "CONFIRMED",
    pnu: "4833011900105640000",
    unit: { dong: "102", ho: "1204" }
  });
  assert.equal(isReusableResult({ ...normalRow, result: normal }), true);
});

test("상가 후보는 후보 소재지의 층·호로 한 건에 수렴한다", () => {
  const candidates = [
    { unique_no: "A", dong: "", ho: "3", buldnm: "태원아파트 상가", sojae: "경상남도 양산시 평산동 564 상가 지하1층 3호" },
    { unique_no: "B", dong: "", ho: "6", buldnm: "태원아파트 상가", sojae: "경상남도 양산시 평산동 564 상가 제1층 제6호" },
    { unique_no: "C", dong: "", ho: "16", buldnm: "태원아파트 상가", sojae: "경상남도 양산시 평산동 564 상가 제2층 제16호" }
  ];
  const expected = ["A", "B", "C"];

  TAEWON_ROWS.forEach((item, index) => {
    const matched = matchUnitByBuildingProfile(
      candidates,
      item.raw,
      item.oldUnit,
      "태원아파트",
      { kind: "COMMERCIAL", token: "상가" }
    );
    assert.equal(matched.status, "UNIQUE");
    assert.equal(matched.candidate.unique_no, expected[index]);
    assert.ok(matched.strategy.includes("CANDIDATE_TEXT"));
  });
});

test("기존 실패 중 원문이 태원형 패턴인 행만 IROS 재매칭한다", () => {
  const legacy = withIrosVersions({
    status: "REG_MULTI",
    match_evidence: {
      unit_intent_signature: "iros-unit-profile-v2:-:106:1:-:-:COMMERCIAL:RAW_SUB_BUILDING_COMMERCIAL"
    }
  });
  assert.equal(isReusableIrosResult(legacy), true);
  assert.equal(needsCommercialRangeUnitRematch(legacy, TAEWON_ROWS[1].raw), true);

  const [marked] = markStaleIrosRows([{
    raw: TAEWON_ROWS[1].raw,
    result: { status: "CONFIRMED", unit: { dong: null, ho: "106" } },
    reg: legacy
  }]);
  assert.equal(marked.reg.stale, true);
  assert.equal(marked.reg.stale_reason, "COMMERCIAL_RANGE_UNIT_REMATCH");
  assert.equal(isReusableIrosResult(marked.reg), false);

  const [ordinary] = markStaleIrosRows([{
    raw: "경남 양산시 평산동 태원아파트 102동1204호",
    result: { status: "CONFIRMED", unit: { dong: "102", ho: "1204" } },
    reg: legacy
  }]);
  assert.equal(needsCommercialRangeUnitRematch(legacy, ordinary.raw), false);
  assert.equal(ordinary.reg.stale, undefined);
  assert.equal(isReusableIrosResult(ordinary.reg), true);
});
