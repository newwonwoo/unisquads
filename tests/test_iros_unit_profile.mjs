import assert from "node:assert/strict";
import test from "node:test";

import {
  buildBuildingUnitProfiles,
  extractUnitIntent,
  matchUnitByBuildingProfile,
  unitIntentSignature
} from "../public/iros-unit-profile.mjs";

test("unit intent preserves original dong-floor-room semantics", () => {
  assert.deepEqual(
    extractUnitIntent("진흥아파트 101동 6층8호", { dong: "101", ho: "8" }),
    {
      dong: "101",
      ho: "8",
      floor: "6",
      room: "8",
      recoveredDong: "",
      subBuilding: null,
      evidence: ["RAW_FLOOR_ROOM"]
    }
  );
  assert.notEqual(
    unitIntentSignature("진흥아파트 101동 1층8호", { dong: "101", ho: "8" }),
    unitIntentSignature("진흥아파트 101동 6층8호", { dong: "101", ho: "8" })
  );
});

test("commercial basement intent remains structured", () => {
  const intent = extractUnitIntent(
    "경남 양산시 평산동 태원아파트 평산리 564 상가 지하1층3호",
    { dong: "", floor: "B1", ho: "3" }
  );
  assert.equal(intent.floor, "B1");
  assert.equal(intent.room, "3");
  assert.deepEqual(intent.subBuilding, { kind: "COMMERCIAL", token: "상가" });
  assert.equal(intent.evidence.includes("RAW_BASEMENT_ROOM"), true);
  assert.equal(intent.evidence.includes("RAW_SUB_BUILDING_COMMERCIAL"), true);
});

test("one-digit N-M without floor text is not forced into a dong", () => {
  const intent = extractUnitIntent("울산 동구 방어동 비동4-501", { dong: "B", ho: "501" });
  assert.equal(intent.recoveredDong, "");
  assert.equal(intent.floor, "");
});

test("building profiles learn numeric room composition from candidate distribution", () => {
  const profiles = buildBuildingUnitProfiles([
    { unique_no: "1", buldnm: "진흥아파트", dong: "101", ho: "108" },
    { unique_no: "2", buldnm: "진흥아파트", dong: "101", ho: "208" },
    { unique_no: "3", buldnm: "진흥아파트", dong: "101", ho: "608" },
    { unique_no: "4", buldnm: "진흥아파트", dong: "101", ho: "609" }
  ]);
  assert.equal(profiles.length, 1);
  assert.equal(profiles[0].hoFormats.has("NUMERIC"), true);
  assert.equal(profiles[0].numericWidths.has(2), true);
});

test("numeric floor-room matching follows the observed building profile", () => {
  const candidates = [
    { unique_no: "1", buldnm: "진흥아파트", dong: "101", ho: "108" },
    { unique_no: "2", buldnm: "진흥아파트", dong: "101", ho: "208" },
    { unique_no: "3", buldnm: "진흥아파트", dong: "101", ho: "608" },
    { unique_no: "4", buldnm: "진흥아파트", dong: "101", ho: "609" }
  ];
  const matched = matchUnitByBuildingProfile(
    candidates,
    "진흥아파트 101동 6층8호",
    { dong: "101", ho: "8" },
    "진흥아파트"
  );
  assert.equal(matched.status, "UNIQUE");
  assert.equal(matched.candidate.unique_no, "3");
  assert.equal(matched.strategy, "PROFILE_FLOOR_ROOM_NUMERIC");
});

test("hyphen and floor-text buildings use their own observed conventions", () => {
  const hyphen = matchUnitByBuildingProfile(
    [
      { unique_no: "A", buldnm: "한빛빌라", dong: "101", ho: "5-1" },
      { unique_no: "B", buldnm: "한빛빌라", dong: "101", ho: "6-8" }
    ],
    "한빛빌라 101동 6층8호",
    { dong: "101", ho: "8" },
    "한빛빌라"
  );
  assert.equal(hyphen.status, "UNIQUE");
  assert.equal(hyphen.candidate.unique_no, "B");
  assert.equal(hyphen.strategy, "PROFILE_FLOOR_ROOM_HYPHEN");

  const text = matchUnitByBuildingProfile(
    [
      { unique_no: "C", buldnm: "대양연립", dong: "가", ho: "5층1" },
      { unique_no: "D", buldnm: "대양연립", dong: "가", ho: "6층8" }
    ],
    "대양연립 가동 6층8호",
    { dong: "가", ho: "8" },
    "대양연립"
  );
  assert.equal(text.status, "UNIQUE");
  assert.equal(text.candidate.unique_no, "D");
  assert.equal(text.strategy, "PROFILE_FLOOR_ROOM_TEXT");
});

test("commercial basement profile selects the commercial unit only", () => {
  const result = matchUnitByBuildingProfile(
    [
      { unique_no: "R", buldnm: "태원아파트", dong: "102", ho: "1204" },
      { unique_no: "S", buldnm: "태원아파트", dong: "상가", ho: "지하1층3" },
      { unique_no: "S2", buldnm: "태원아파트", dong: "상가", ho: "지하1층4" }
    ],
    "태원아파트 상가 지하1층3호",
    { dong: "", floor: "B1", ho: "3" },
    "태원아파트",
    { kind: "COMMERCIAL", token: "상가" }
  );
  assert.equal(result.status, "UNIQUE");
  assert.equal(result.candidate.unique_no, "S");
  assert.equal(result.strategy, "PROFILE_BASEMENT_ROOM");
  assert.equal(result.audit.sub_building_filter_applied, true);
});

test("raw N-M room is interpreted by the building candidate structure", () => {
  const matched = matchUnitByBuildingProfile(
    [
      { unique_no: "A", buldnm: "한동그린타운", dong: "501", ho: "101" },
      { unique_no: "B", buldnm: "한동그린타운", dong: "502", ho: "101" }
    ],
    "한동그린타운 501-101호",
    { dong: "", ho: "101" },
    "한동그린타운"
  );
  assert.equal(matched.status, "UNIQUE");
  assert.equal(matched.candidate.unique_no, "A");
  assert.equal(matched.strategy, "PROFILE_RAW_DONG_ROOM_DIRECT");
});

test("different building profiles never collapse into one guessed result", () => {
  const result = matchUnitByBuildingProfile(
    [
      { unique_no: "A", buldnm: "가람아파트", dong: "101", ho: "608" },
      { unique_no: "B", buldnm: "나래아파트", dong: "101", ho: "608" },
      { unique_no: "C", buldnm: "가람아파트", dong: "101", ho: "108" },
      { unique_no: "D", buldnm: "나래아파트", dong: "101", ho: "108" },
      { unique_no: "E", buldnm: "가람아파트", dong: "101", ho: "208" },
      { unique_no: "F", buldnm: "나래아파트", dong: "101", ho: "208" }
    ],
    "101동 6층8호",
    { dong: "101", ho: "8" },
    ""
  );
  assert.equal(result.status, "AMBIGUOUS");
  assert.equal(result.candidate, null);
});

test("exact building name can deterministically select one profile", () => {
  const result = matchUnitByBuildingProfile(
    [
      { unique_no: "A", buldnm: "가람아파트", dong: "101", ho: "608" },
      { unique_no: "B", buldnm: "나래아파트", dong: "101", ho: "608" },
      { unique_no: "C", buldnm: "가람아파트", dong: "101", ho: "108" },
      { unique_no: "D", buldnm: "나래아파트", dong: "101", ho: "108" },
      { unique_no: "E", buldnm: "가람아파트", dong: "101", ho: "208" },
      { unique_no: "F", buldnm: "나래아파트", dong: "101", ho: "208" }
    ],
    "가람아파트 101동 6층8호",
    { dong: "101", ho: "8" },
    "가람아파트"
  );
  assert.equal(result.status, "UNIQUE");
  assert.equal(result.candidate.unique_no, "A");
  assert.equal(result.audit.exact_building_filter_applied, true);
});

test("multiple notations pointing to different unique numbers remain ambiguous", () => {
  const result = matchUnitByBuildingProfile(
    [
      { unique_no: "A", buldnm: "진흥아파트", dong: "101", ho: "608" },
      { unique_no: "B", buldnm: "진흥아파트", dong: "101", ho: "6-8" },
      { unique_no: "C", buldnm: "진흥아파트", dong: "101", ho: "108" },
      { unique_no: "D", buldnm: "진흥아파트", dong: "101", ho: "208" }
    ],
    "진흥아파트 101동 6층8호",
    { dong: "101", ho: "8" },
    "진흥아파트"
  );
  assert.equal(result.status, "AMBIGUOUS");
});
