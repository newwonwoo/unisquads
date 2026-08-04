import assert from "node:assert/strict";
import test from "node:test";

import {
  ADDRESS_REQUERY_ROUTES,
  buildAddressRequeryEvidence,
} from "../public/address-requery-evidence.mjs";

test("failed rows retain an exact lot requery route", () => {
  const evidence = buildAddressRequeryEvidence({
    sidoFull: "울산광역시", sgg: "남구", emd: "삼산동", jibun: "1498-3",
    road: "", buldNo: "", bldName: "", unit: { dong: "2", ho: "601" },
  }, { status: "FAILED" });
  assert.equal(evidence.route, ADDRESS_REQUERY_ROUTES.LOT_EXACT);
  assert.match(evidence.query, /삼산동 1498-3/);
});

test("spaced numbered-road input retains an exact road route", () => {
  const evidence = buildAddressRequeryEvidence({
    sidoFull: "부산광역시", sgg: "부산진구", emd: "범천동",
    road: "범일로154번길", buldNo: "33", jibun: "", bldName: "",
    unit: { dong: "101", ho: "404" },
  }, { status: "AMBIGUOUS" });
  assert.equal(evidence.route, ADDRESS_REQUERY_ROUTES.ROAD_EXACT);
  assert.match(evidence.query, /범일로154번길 33/);
});

test("building and unit group routes stay distinct from unidentifiable input", () => {
  const building = buildAddressRequeryEvidence({
    sidoFull: "인천광역시", sgg: "서구", emd: "왕길동",
    road: "", buldNo: "", jibun: "", bldName: "유승아파트",
    unit: { dong: "105", ho: "302" },
  }, { status: "FAILED" });
  const unit = buildAddressRequeryEvidence({
    sidoFull: "경상북도", sgg: "봉화군", eup: "봉화읍", emd: "",
    road: "", buldNo: "", jibun: "", bldName: "",
    unit: { dong: "102", ho: "101" },
  }, { status: "FAILED" });
  const none = buildAddressRequeryEvidence({
    sidoFull: "", sgg: "", eup: "", emd: "", road: "", buldNo: "",
    jibun: "", bldName: "", unit: { dong: "", ho: "" },
  }, { status: "FAILED" });
  assert.equal(building.route, ADDRESS_REQUERY_ROUTES.BUILDING);
  assert.equal(unit.route, ADDRESS_REQUERY_ROUTES.UNIT_GROUP);
  assert.equal(none.route, ADDRESS_REQUERY_ROUTES.UNIDENTIFIABLE);
});

test("confirmed rows are never marked for address requery", () => {
  assert.equal(buildAddressRequeryEvidence({ emd: "삼산동", jibun: "1498-3" }, {
    status: "CONFIRMED",
  }), null);
});
