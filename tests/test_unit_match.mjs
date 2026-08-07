import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  alternateRawLotAddress,
  alternateRawLotAddresses,
  buildingEvidenceKind,
  buildingNamesMatch,
  candidateMatchesAddressLot,
  candidateMatchesUnit,
  candidateUnitVariants,
  excludeShopDongForDonglessRequest,
  filterExpectedPropertyClass,
  filterUnitPropertyCandidates,
  propertyClassKey,
  rawUnitRecoverySignature,
  rawUnitRecoveryVariants,
  selectFloorDisambiguatedCandidate,
  selectUniqueRawUnitCandidate,
  summarizeCandidatePropertyClasses,
  targetPropertyClass,
  unitKey
} from "../public/unit-match.mjs";

const vectors = JSON.parse(
  await readFile(new URL("./fixtures/unit-match-vectors.json", import.meta.url), "utf8")
);

test("JavaScript matcher follows the shared unit vectors", () => {
  for (const vector of vectors) {
    assert.equal(
      unitKey(vector.a, vector.kind) === unitKey(vector.b, vector.kind),
      vector.equal,
      JSON.stringify(vector)
    );
  }
});

test("property class filtering is conservative", () => {
  assert.equal(propertyClassKey({ real_cls_cd: "집합건물" }), "집합건물");
  const result = filterExpectedPropertyClass(
    [{ gubun: "토지" }, { gubun: "집합건물" }, { gubun: "건물" }],
    "집합건물"
  );
  assert.equal(result.verified, true);
  assert.equal(result.candidates.length, 1);

  const unknown = filterExpectedPropertyClass([{ gubun: "" }], "집합건물");
  assert.equal(unknown.verified, false);
  assert.deepEqual(unknown.candidates, []);
});

test("unit-bearing general building is allowed only by an explicit IROS unit field", () => {
  const candidates = [
    { unique_no: "STRICT", real_cls_cd: "집합건물", dong: "106", ho: "1102",
      unit_source: { ho: "buld_no_room" } },
    { unique_no: "LAND", real_cls_cd: "토지", ho: "1101",
      unit_source: { ho: "buld_no_inner" } },
    { unique_no: "DETAIL", real_cls_cd: "건물", dong: "106", ho: "1101",
      unit_source: { ho: "detail_text" } },
    { unique_no: "UNIT", real_cls_cd: "건물", dong: "106", ho: "1101",
      unit_source: { ho: "buld_no_inner" } },
    { unique_no: "OTHER", real_cls_cd: "건물", dong: "106", ho: "1102",
      unit_source: { ho: "buld_no_inner" } }
  ];
  const result = filterUnitPropertyCandidates(candidates, "106", "1101");
  assert.equal(result.verified, true);
  assert.equal(result.evidence, "EXPLICIT_UNIT_BUILDING");
  assert.deepEqual(result.candidates.map((candidate) => candidate.unique_no), ["STRICT", "UNIT"]);
  assert.deepEqual(
    result.candidates
      .filter((candidate) => candidateMatchesUnit(candidate, "106", "1101"))
      .map((candidate) => candidate.unique_no),
    ["UNIT"]
  );
  assert.equal(
    filterUnitPropertyCandidates(
      candidates.filter((candidate) => candidate.unique_no !== "STRICT"),
      "106",
      ""
    ).verified,
    false
  );
});

test("raw recovery variants may admit only an explicit unit-bearing building", () => {
  const candidates = [
    { unique_no: "RAW", real_cls_cd: "건물", dong: "501", ho: "101",
      unit_source: { ho: "buld_no_inner" } },
    { unique_no: "DETAIL", real_cls_cd: "건물", dong: "501", ho: "101",
      unit_source: { ho: "detail_text" } },
    { unique_no: "LAND", real_cls_cd: "토지", dong: "501", ho: "101",
      unit_source: { ho: "buld_no_inner" } }
  ];
  const result = filterUnitPropertyCandidates(
    candidates,
    "",
    "101",
    [{ dong: "501", ho: "101", source: "raw_dong_room" }]
  );
  assert.equal(result.evidence, "EXPLICIT_UNIT_BUILDING");
  assert.deepEqual(result.candidates.map((candidate) => candidate.unique_no), ["RAW"]);
});

test("export target class and raw IROS classes stay separate", () => {
  assert.equal(targetPropertyClass({ isJip: false, unit: { ho: "1101" } }), "집합건물");
  assert.equal(targetPropertyClass({ isJip: false, unit: {} }), "");
  assert.equal(
    summarizeCandidatePropertyClasses([
      { real_cls_cd: "토지" }, { real_cls_cd: "건물" }, { real_cls_cd: "집합건물" }
    ]),
    "집합건물|건물|토지"
  );
});

test("composite IROS dong and room prefixes are normalized safely", () => {
  const candidate = { dong: "에이,비,상가", ho: "비-0102" };
  assert.equal(candidateMatchesUnit(candidate, "B", "102"), true);
  assert.equal(candidateMatchesUnit(candidate, "A", "102"), false);
  assert.equal(candidateUnitVariants({ dong: "204", ho: "204-1" }).length, 1);
  assert.equal(candidateMatchesUnit({ dong: "204", ho: "204-1" }, "204", "204-1"), true);
});

test("self-dong prefixed ho decomposes only when it names the candidate's own dong", () => {
  // 부산 범일역풍림아이원 실측: 동 "103", 호 "103동902" (46행)
  assert.equal(candidateMatchesUnit({ dong: "103", ho: "103동902" }, "103", "902"), true);
  // 층까지 붙은 표기: 동 "101", 호 "101동1902"
  assert.equal(candidateMatchesUnit({ dong: "101", ho: "101동1902" }, "101", "1902"), true);
  // 접두어가 그 후보의 동과 다르면 절대 분해하지 않는다
  assert.equal(candidateMatchesUnit({ dong: "103", ho: "104동902" }, "103", "902"), false);
  assert.equal(candidateMatchesUnit({ dong: "103", ho: "104동902" }, "104", "902"), false);
  // 동 표기가 없는 후보의 "N동M" 호도 분해하지 않는다 (근거 없는 추측 금지)
  assert.equal(candidateMatchesUnit({ dong: "", ho: "103동902" }, "103", "902"), false);
  // 원래 표기 그대로도 계속 매칭된다 (회귀 방지)
  assert.equal(candidateMatchesUnit({ dong: "103", ho: "103동902" }, "103", "103동902"), true);
});

test("raw N-M호 recovery is fallback-only evidence for a missing dong", () => {
  assert.deepEqual(
    rawUnitRecoveryVariants(
      "경북 경주시 안강읍 한동그린타운 501-101호",
      { dong: "", ho: "101" }
    ),
    [{ dong: "501", ho: "101", source: "raw_dong_room" }]
  );
  assert.deepEqual(
    rawUnitRecoveryVariants(
      "경기도 이천시 응암리 97-3외 이화아파트 201동 101호",
      { dong: "201", ho: "101" }
    ),
    []
  );
  assert.deepEqual(
    rawUnitRecoveryVariants("울산 동구 방어동 비동4-501", { dong: "B", ho: "501" }),
    []
  );
});

test("raw floor-room variants preserve floor evidence and cache separation", () => {
  const one = rawUnitRecoveryVariants(
    "진흥아파트 101동 1층8호",
    { dong: "101", ho: "8" }
  );
  assert.deepEqual(one, [
    { dong: "101", ho: "108", source: "raw_floor_room" },
    { dong: "101", ho: "1-8", source: "raw_floor_room" },
    { dong: "101", ho: "1층8", source: "raw_floor_room" }
  ]);
  assert.notEqual(
    rawUnitRecoverySignature("진흥아파트 101동 1층8호", { dong: "101", ho: "8" }),
    rawUnitRecoverySignature("진흥아파트 101동 6층8호", { dong: "101", ho: "8" })
  );
});

test("raw unit recovery takes the first variant that is unique on its own", () => {
  const candidates = [
    { unique_no: "A", dong: "501", ho: "101" },
    { unique_no: "B", dong: "502", ho: "101" }
  ];
  const picked = selectUniqueRawUnitCandidate(
    candidates,
    "한동그린타운 501-101호",
    { dong: "", ho: "101" }
  );
  assert.equal(picked?.candidate.unique_no, "A");

  // 등기부의 호 표기는 건물마다 하나로 통일돼 있다. 표준 표기(608)가 정확히
  // 한 건이면, 다른 세대가 실제로 "6-8호"라는 이유로 버리지 않는다.
  // 변형 전체를 한꺼번에 보던 이전 계약이 진흥아파트 136행을 통째로 막았다.
  const standardFirst = selectUniqueRawUnitCandidate(
    [
      { unique_no: "A", dong: "101", ho: "608" },
      { unique_no: "B", dong: "101", ho: "6-8" }
    ],
    "진흥아파트 101동 6층8호",
    { dong: "101", ho: "8" }
  );
  assert.equal(standardFirst?.candidate.unique_no, "A");
  assert.equal(standardFirst?.variant.ho, "608");

  // 같은 변형 안에서 여러 건이면 여전히 확정하지 않는다.
  const ambiguous = selectUniqueRawUnitCandidate(
    [
      { unique_no: "A", dong: "101", ho: "608" },
      { unique_no: "B", dong: "101", ho: "608" }
    ],
    "진흥아파트 101동 6층8호",
    { dong: "101", ho: "8" }
  );
  assert.equal(ambiguous, null);
});

test("dongless request excludes shop-dong twins only when no real dong is involved", () => {
  // 횡성 서도아파트 실측: 동 없는 요청의 호 102가 무동 세대 + 상가동 세대
  const apt = { unique_no: "APT", dong: "", ho: "102" };
  const shop = { unique_no: "SHOP", dong: "상가", ho: "102" };
  assert.deepEqual(
    excludeShopDongForDonglessRequest([apt, shop]).map((c) => c.unique_no),
    ["APT"]
  );
  // 숫자 동이 섞여 있으면 어느 동인지 알 수 없다 — 배제하지 않는다
  const tower = { unique_no: "T101", dong: "101", ho: "102" };
  assert.equal(excludeShopDongForDonglessRequest([apt, shop, tower]).length, 3);
  // 전부 무동이거나 전부 상가면 그대로 둔다
  assert.equal(excludeShopDongForDonglessRequest([apt]).length, 1);
  assert.equal(excludeShopDongForDonglessRequest([shop]).length, 1);
});

test("floor field disambiguates identical dong-ho candidates only with raw floor evidence", () => {
  // 청주 진흥아파트 실측: 동 101 호 "1"이 floor 1~6으로 6건, 원문 "101동 3층1호" (136행)
  const candidates = [1, 2, 3, 4, 5, 6].map((floor) => ({
    unique_no: `F${floor}`, dong: "101", ho: "1", floor: String(floor),
    real_cls_cd: "집합건물"
  }));
  const picked = selectFloorDisambiguatedCandidate(
    candidates,
    "충북 청주시 청원구 내수읍 마산리 123 진흥아파트 101동 3층1호",
    { dong: "101", ho: "1" }
  );
  assert.equal(picked?.candidate.unique_no, "F3");
  assert.equal(picked?.matched_floor, "3");

  // 같은 층이 두 건이면 확정하지 않는다
  const dup = [...candidates, { unique_no: "F3B", dong: "101", ho: "1", floor: "3" }];
  assert.equal(selectFloorDisambiguatedCandidate(
    dup,
    "충북 청주시 청원구 내수읍 마산리 123 진흥아파트 101동 3층1호",
    { dong: "101", ho: "1" }
  ), null);

  // 원문에 층 표기가 없으면 손대지 않는다
  assert.equal(selectFloorDisambiguatedCandidate(
    candidates,
    "충북 청주시 청원구 내수읍 마산리 123 진흥아파트 101동 1호",
    { dong: "101", ho: "1" }
  ), null);

  // 지하는 실측 근거가 없으므로 확정하지 않는다
  assert.equal(selectFloorDisambiguatedCandidate(
    candidates,
    "충북 청주시 내수읍 마산리 123 진흥아파트 101동 지하3층1호",
    { dong: "101", ho: "1" }
  ), null);

  // 원문 층 호가 요청 호와 다르면 손대지 않는다
  assert.equal(selectFloorDisambiguatedCandidate(
    candidates,
    "충북 청주시 내수읍 마산리 123 진흥아파트 101동 3층2호",
    { dong: "101", ho: "1" }
  ), null);

  // floor 필드가 비어 있는 등기부에서는 동작하지 않는다
  assert.equal(selectFloorDisambiguatedCandidate(
    [{ unique_no: "A", dong: "101", ho: "1", floor: "" },
     { unique_no: "B", dong: "101", ho: "1", floor: "" }],
    "진흥아파트 101동 3층1호",
    { dong: "101", ho: "1" }
  ), null);
});

test("raw alternate lot stays in the same legal dong", () => {
  assert.equal(
    alternateRawLotAddress(
      "경기도 이천시 부발읍 응암리 97-3외 이화아파트 201동 101호",
      "경기도 이천시 부발읍 응암리 96 이화아파트"
    ),
    "경기도 이천시 부발읍 응암리 97-3 이화아파트"
  );
  assert.equal(
    alternateRawLotAddress("경기도 이천시 증포동 218-7", "경기도 이천시 증포동 218-7"),
    ""
  );
  assert.equal(
    alternateRawLotAddress("경기도 이천시 증포동 218-7", "경기도 이천시 관고동 218-1"),
    ""
  );
});

test("all explicitly written alternate lots are retained without inventing omitted lots", () => {
  assert.deepEqual(
    alternateRawLotAddresses(
      "충남 천안시 북면 상동리 91-6, 441-1 중앙아파트 101-1001",
      "충청남도 천안시 동남구 북면 상동리 91-6 중앙아파트"
    ),
    ["충청남도 천안시 동남구 북면 상동리 441-1 중앙아파트"]
  );
  assert.deepEqual(
    alternateRawLotAddresses(
      "강원 동해시 어달동 12-1,2,5 아파트 101동 101호",
      "강원특별자치도 동해시 어달동 12-1 아파트"
    ),
    [
      "강원특별자치도 동해시 어달동 12-2 아파트",
      "강원특별자치도 동해시 어달동 12-5 아파트"
    ]
  );
  assert.deepEqual(
    alternateRawLotAddresses(
      "울산 남구 삼산동 1498-3 외 7필지 2동 601호",
      "울산광역시 남구 삼산동 1498-3"
    ),
    []
  );
});

test("exact lot excludes neighboring sublots in a broad IROS response", () => {
  assert.equal(
    candidateMatchesAddressLot(
      { lot_no: "85", add_item: "동림동 85" },
      "광주광역시 북구 동림동 85"
    ),
    true
  );
  assert.equal(
    candidateMatchesAddressLot(
      { lot_no: "85-2", add_item: "동림동 85-2 외 1필지" },
      "광주광역시 북구 동림동 85"
    ),
    false
  );
  assert.equal(
    candidateMatchesAddressLot(
      { lot_no: "85", add_item: "동림동 85-2 외 1필지" },
      "광주광역시 북구 동림동 85-2"
    ),
    true
  );
});

test("building comparison stays conservative for renamed and unrelated names", () => {
  assert.equal(buildingNamesMatch("태평양임대아파트", "태평양임대아파트"), true);
  assert.equal(buildingNamesMatch("태평양아파트", "태평양임대아파트"), false);
  assert.equal(buildingNamesMatch("현대아파트", "동해대동아파트"), false);
  assert.equal(
    buildingEvidenceKind("태평양임대아파트", "태평양아파트", "강릉시 입암동 태평양임대아파트 101동 201호"),
    "raw_exact_name"
  );
  assert.equal(
    buildingEvidenceKind("동해대동아파트", "현대아파트", "동해시 천곡동 현대아파트 30동 1102호"),
    ""
  );
});
