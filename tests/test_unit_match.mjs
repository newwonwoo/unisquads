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
  filterExpectedPropertyClass,
  propertyClassKey,
  rawUnitRecoverySignature,
  rawUnitRecoveryVariants,
  selectUniqueRawUnitCandidate,
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

test("composite IROS dong and room prefixes are normalized safely", () => {
  const candidate = { dong: "에이,비,상가", ho: "비-0102" };
  assert.equal(candidateMatchesUnit(candidate, "B", "102"), true);
  assert.equal(candidateMatchesUnit(candidate, "A", "102"), false);
  assert.equal(candidateUnitVariants({ dong: "204", ho: "204-1" }).length, 1);
  assert.equal(candidateMatchesUnit({ dong: "204", ho: "204-1" }, "204", "204-1"), true);
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

test("raw unit recovery resolves only when all variants converge to one candidate", () => {
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

  const ambiguous = selectUniqueRawUnitCandidate(
    [
      { unique_no: "A", dong: "101", ho: "608" },
      { unique_no: "B", dong: "101", ho: "6-8" }
    ],
    "진흥아파트 101동 6층8호",
    { dong: "101", ho: "8" }
  );
  assert.equal(ambiguous, null);
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
