import assert from "node:assert/strict";
import test from "node:test";

import {
  buildingAnchorMatches,
  isDistinctiveBuildingName,
  isPositivePropagationReview,
  normalizeAttachedAdminSpacing,
  normalizeOwnerKey,
  parseCompactAlphaUnit
} from "../public/address-quality-rules.mjs";

test("compact alphabet dong-floor-ho is parsed before administrative tokens", () => {
  assert.deepEqual(parseCompactAlphaUnit("울산 동구 방어동 비동4-501"), {
    dong: "B", floor: "4", ho: "501", matched: " 비동4-501", index: 9
  });
  assert.deepEqual(parseCompactAlphaUnit("울산 동구 방어동 B동 6-702"), {
    dong: "B", floor: "6", ho: "702", matched: " B동 6-702", index: 9
  });
});

test("real legal-dong looking tokens are not reclassified as alphabet buildings", () => {
  assert.equal(parseCompactAlphaUnit("경북 포항시 남구 이동4-501"), null);
  assert.equal(parseCompactAlphaUnit("경기 수원시 팔달구 지동4-501"), null);
});

test("attached administrative tokens gain validation-only boundaries", () => {
  assert.equal(
    normalizeAttachedAdminSpacing("충남 당진시 송악읍 영천리 반촌리420-6 반촌명지아파트"),
    "충남 당진시 송악읍 영천리 반촌리 420-6 반촌명지아파트"
  );
});

test("owner normalization changes corporate notation only", () => {
  assert.equal(normalizeOwnerKey("대륙산업개발(주)"), normalizeOwnerKey("대륙산업개발㈜"));
  assert.notEqual(normalizeOwnerKey("대륙산업개발㈜"), normalizeOwnerKey("우미종합개발㈜"));
});

test("building anchors allow distinctive regional prefixes but reject generic names", () => {
  assert.equal(buildingAnchorMatches("예산우방유쉘아파트", "우방유쉘아파트"), true);
  assert.equal(buildingAnchorMatches("부전타워", "부전타워 상가동"), true);
  assert.equal(buildingAnchorMatches("신현대아파트", "현대아파트"), false);
  assert.equal(isDistinctiveBuildingName("우방유쉘아파트"), true);
  assert.equal(isDistinctiveBuildingName("현대아파트"), false);
});

test("only positive review flags can seed propagation", () => {
  assert.equal(isPositivePropagationReview("bldname_matched"), true);
  assert.equal(isPositivePropagationReview("juso_multi"), true);
  assert.equal(isPositivePropagationReview("naver_jibun_mismatch"), false);
});
