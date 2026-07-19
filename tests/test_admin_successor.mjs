import assert from "node:assert/strict";
import test from "node:test";
import {
  ADMIN_SUCCESSOR_MAP_VERSION,
  findAdminSuccessor,
  findOldAdminTokens,
  listAdminSuccessorRules,
  modernizeKnownAdminTokens
} from "../public/admin-successor.mjs";

test("known old administrative names map only in the forward direction", () => {
  const promoted = findAdminSuccessor("배방면", "배방읍", "BJD");
  assert.equal(promoted?.ruleId, "BJD_BAEBANG_PROMOTION");
  assert.equal(promoted?.version, ADMIN_SUCCESSOR_MAP_VERSION);
  assert.equal(findAdminSuccessor("배방읍", "배방면", "BJD"), null);
});

test("same-root suffix changes are not accepted without an explicit rule", () => {
  assert.equal(findAdminSuccessor("가상면", "가상읍", "BJD"), null);
  assert.equal(findAdminSuccessor("고령읍", "대가야읍", "BJD")?.kind, "BJD");
});

test("context-scoped district reform cannot leak to another province", () => {
  assert.equal(findAdminSuccessor("서구", "검단구", "SGG", { sido: "인천" })?.kind, "SGG");
  assert.equal(findAdminSuccessor("서구", "검단구", "SGG", { sido: "대전" }), null);
});

test("known old city names are modernized as whole tokens", () => {
  assert.equal(
    modernizeKnownAdminTokens("충청남도 당진군 송악면 1"),
    "충청남도 당진시 송악면 1"
  );
  assert.equal(modernizeKnownAdminTokens("마산시 창원시 1"), "창원시 창원시 1");
  assert.ok(listAdminSuccessorRules().length >= 18);
});

test("rows carrying old tokens expose versioned dependency evidence", () => {
  const evidence = findOldAdminTokens("충청남도 당진군 송악면 1");
  assert.equal(evidence?.version, ADMIN_SUCCESSOR_MAP_VERSION);
  assert.ok(evidence?.rules.some((rule) => rule.ruleId === "SGG_DANGJIN_PROMOTION"));
  assert.equal(findOldAdminTokens("충청남도 당진시 송악읍 1"), null);
});
