import assert from "node:assert/strict";
import test from "node:test";

test("deployed browser module links without executing the UI", async () => {
  globalThis.window = { storage: {} };
  globalThis.React = { createElement() { return {}; } };
  globalThis.ReactDOM = {
    createRoot() {
      return { render() {} };
    }
  };
  globalThis.document = { getElementById() { return {}; } };

  const app = await import("../public/app.js");

  assert.equal(
    app.validateRegion(
      "충청남도 아산시 배방면 100",
      "충청남도 아산시 배방읍 100"
    ).oldAddressMap?.ruleId,
    "BJD_BAEBANG_PROMOTION"
  );
  assert.equal(
    app.validateRegion(
      "충청남도 가상시 가상면 100",
      "충청남도 가상시 가상읍 100"
    ).status,
    "MISMATCH"
  );
  assert.equal(
    app.validateRegion(
      "서울특별시 강남구 역삼동 1",
      "서울특별시 송파구 역삼동 1"
    ).status,
    "MISMATCH"
  );
  assert.equal(
    app.validateRegion(
      "충청남도 당진군 송악면 1",
      "충청남도 당진시 송악면 1"
    ).oldAddressMap?.ruleId,
    "SGG_DANGJIN_PROMOTION"
  );
  assert.equal(
    app.validateRegion(
      "경상남도 거제시 신현읍 문동리 238",
      "경상남도 거제시 문동동 238"
    ).oldAddressMap?.ruleId,
    "BJD_MUNDONG_REFORM"
  );
});
