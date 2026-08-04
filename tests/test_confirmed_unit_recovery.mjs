import assert from "node:assert/strict";
import test from "node:test";

import { recoverConfirmedUnit } from "../public/confirmed-unit-recovery.mjs";
import { attachPipelineMetadata } from "../public/pipeline-contract.mjs";

const confirmed = (overrides = {}) => ({
  status: "CONFIRMED",
  pnu: "1162010100108590017",
  unit: { dong: null, ho: null },
  ...overrides
});

test("confirmed PNU gates explicit trailing unit recovery", () => {
  const raw = "서울 관악구 관악로 195 관악위버폴리스 101-1002";
  assert.equal(recoverConfirmedUnit(raw, { status: "AMBIGUOUS", pnu: "" }), null);
  assert.deepEqual(recoverConfirmedUnit(raw, confirmed()).unit, {
    dong: "101",
    ho: "1002"
  });
});

test("common legacy building-unit notations stay structurally distinct", () => {
  const rows = [
    ["서울 광진구 자양동 227-7 더샵스타시티 A-4403", { dong: "A", ho: "4403" }],
    ["서울 성동구 행당동 419-1 삼부@101-1105", { dong: "101", ho: "1105" }],
    ["경북 경주시 강동면 유금리 378 위덕삼성타운 101/101 외959세대", { dong: "101", ho: "101" }],
    ["경기 연천군 전곡읍 전곡리 411-3 명정아파트2동 707", { dong: "2", ho: "707" }],
    ["충남 논산시 강경읍 대흥리 35 조흥아파트 106동 비01", { dong: "106", ho: "B01" }],
    ["강원 태백시 황지동 403-5 선명3차아파트 제에이-201", { dong: "A", ho: "201" }]
  ];
  for (const [raw, expected] of rows) {
    assert.deepEqual(recoverConfirmedUnit(raw, confirmed()).unit, expected, raw);
  }
});

test("floor evidence is not collapsed into a guessed dong", () => {
  assert.deepEqual(
    recoverConfirmedUnit(
      "서울 강동구 천호동 565 현대코아아파트 지1-146-1",
      confirmed()
    ).unit,
    { dong: null, floor: "B1", ho: "146-1" }
  );
  assert.deepEqual(
    recoverConfirmedUnit(
      "전북 전주시 덕진구 반월동 382 남양반월타운101-3-305",
      confirmed()
    ).unit,
    { dong: "101", floor: "3", ho: "305" }
  );
  assert.equal(
    recoverConfirmedUnit(
      "전북 전주시 덕진구 반월동 382 남양반월타운101-3-405",
      confirmed()
    ),
    null
  );
});

test("parcel, road, count and range tails are not reclassified as units", () => {
  for (const raw of [
    "충남 계룡시 엄사면 번영로 113-32",
    "인천 계양구 작전동 580외 10필지 작전2-2현대아파트",
    "경기 의정부시 신곡동 드림밸리아파트 제110동",
    "경기 포천시 신북면 기지리 거산아파트 72건",
    "광주 동구 학동 학2마을아파트 201~208동"
  ]) {
    assert.equal(recoverConfirmedUnit(raw, confirmed()), null, raw);
  }
});

test("the pipeline records the local recovery module without changing PNU", () => {
  const row = { raw: "서울 관악구 관악로 195 관악위버폴리스 101-1002" };
  const result = attachPipelineMetadata(row, confirmed());
  assert.equal(result.pnu, "1162010100108590017");
  assert.deepEqual(result.unit, { dong: "101", ho: "1002" });
  assert.ok(result.appliedModules.includes("CONFIRMED_UNIT_EVIDENCE"));
});
