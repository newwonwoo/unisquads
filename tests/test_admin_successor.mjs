import assert from "node:assert/strict";
import test from "node:test";

import { findAdminSuccessor } from "../public/admin-successor.mjs";

test("explicit Incheon 2026 successor districts are recognized", () => {
  assert.equal(findAdminSuccessor("서구", "서해구", "SGG", { sido: "인천" })?.ruleId, "SGG_INCHEON_SEOGU_SEOHAE");
  assert.equal(findAdminSuccessor("중구", "제물포구", "SGG", { sido: "인천" })?.ruleId, "SGG_INCHEON_JUNGGU_JEMULPO");
  assert.equal(findAdminSuccessor("중구", "영종구", "SGG", { sido: "인천" })?.ruleId, "SGG_INCHEON_JUNGGU_YEONGJONG");
  assert.equal(findAdminSuccessor("남구", "미추홀구", "SGG", { sido: "인천" })?.ruleId, "SGG_INCHEON_NAMGU_MICHUHOL");
  assert.equal(findAdminSuccessor("서구", "서해구", "SGG", { sido: "부산" }), null);
});
