import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  alternateRawLotAddress,
  buildingEvidenceKind,
  buildingNamesMatch,
  candidateMatchesAddressLot,
  candidateMatchesUnit,
  candidateUnitVariants,
  filterExpectedPropertyClass,
  propertyClassKey,
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
