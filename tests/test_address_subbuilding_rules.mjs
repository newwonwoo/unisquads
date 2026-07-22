import assert from "node:assert/strict";
import test from "node:test";

import {
  candidateSupportsSubBuilding,
  extractSubBuildingIntent,
  floorIntentFromText,
  narrowByExplicitSubBuilding
} from "../public/address-subbuilding-rules.mjs";

test("commercial sub-building and basement floor are preserved from the source", () => {
  const raw = "경남 양산시 평산동 태원아파트 101-107 평산리 564 상가 지하1층3호";
  assert.deepEqual(extractSubBuildingIntent(raw), { kind: "COMMERCIAL", token: "상가" });
  assert.equal(floorIntentFromText(raw), "B1");
});

test("commercial evidence is accepted from JUSO and IROS candidate fields", () => {
  const intent = { kind: "COMMERCIAL", token: "상가" };
  assert.equal(candidateSupportsSubBuilding({ detBdNmList: "101동,102동,상가동" }, intent), true);
  assert.equal(candidateSupportsSubBuilding({ buldnm: "태원아파트", dong: "상가", ho: "지하1층3" }, intent), true);
  assert.equal(candidateSupportsSubBuilding({ bdNm: "태원아파트", detBdNmList: "101동,102동" }, intent), false);
});

test("explicit sub-building narrows only when supporting candidates exist", () => {
  const source = [
    { bdNm: "태원아파트", detBdNmList: "101동,102동" },
    { bdNm: "태원아파트", detBdNmList: "상가동" }
  ];
  const narrowed = narrowByExplicitSubBuilding(source, { kind: "COMMERCIAL", token: "상가" });
  assert.equal(narrowed.applied, true);
  assert.equal(narrowed.candidates.length, 1);
  assert.equal(narrowed.evidence, "EXPLICIT_SUB_BUILDING:COMMERCIAL");

  const untouched = narrowByExplicitSubBuilding(
    [{ bdNm: "태원아파트", detBdNmList: "101동,102동" }],
    { kind: "COMMERCIAL", token: "상가" }
  );
  assert.equal(untouched.applied, false);
  assert.equal(untouched.candidates.length, 1);
});

test("ordinary road or locality text is not classified as a commercial part", () => {
  assert.equal(extractSubBuildingIntent("서울 중구 상가로 12"), null);
  assert.equal(extractSubBuildingIntent("부산 상가동 101호"), null);
});
