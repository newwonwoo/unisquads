import assert from "node:assert/strict";
import test from "node:test";

import {
  buildAmbiguousPnuProbePlan,
  selectUniqueIrosPnuAttempt
} from "../public/ambiguous-pnu-recovery.mjs";

const A = "1121510500107670001";
const B = "1121510500107670002";

const row = {
  result: {
    status: "AMBIGUOUS",
    unit: { dong: "101", ho: "1002" },
    candidates: [
      { pnu: A, jibunAddr: "서울 광진구 자양동 767-1", isJip: true },
      { pnu: B, jibunAddr: "서울 광진구 자양동 767-2", isJip: true }
    ]
  }
};

test("all distinct PNU candidates become probes when a room is explicit", () => {
  const plan = buildAmbiguousPnuProbePlan(row);
  assert.deepEqual(plan.probes.map((probe) => probe.pnu), [A, B]);
  assert.equal(plan.ho, "1002");
});

test("one resolved PNU and one terminal miss select the resolved PNU", () => {
  const plan = buildAmbiguousPnuProbePlan(row);
  const selected = selectUniqueIrosPnuAttempt(plan, [
    { probe: plan.probes[0], reg: { status: "RESOLVED", unique_no: "1100-2000-000001" } },
    { probe: plan.probes[1], reg: { status: "REG_UNIT_NOT_FOUND" } }
  ]);
  assert.equal(selected.status, "UNIQUE");
  assert.equal(selected.pnu, A);
});

test("partial collection or two resolved PNU candidates never auto-select", () => {
  const plan = buildAmbiguousPnuProbePlan(row);
  assert.equal(selectUniqueIrosPnuAttempt(plan, [
    { probe: plan.probes[0], reg: { status: "RESOLVED", unique_no: "1100-2000-000001" } },
    { probe: plan.probes[1], reg: { status: "REG_PARTIAL_RESPONSE" } }
  ]).status, "RETRY_REQUIRED");
  assert.equal(selectUniqueIrosPnuAttempt(plan, [
    { probe: plan.probes[0], reg: { status: "RESOLVED", unique_no: "1100-2000-000001" } },
    { probe: plan.probes[1], reg: { status: "RESOLVED", unique_no: "1100-2000-000002" } }
  ]).status, "AMBIGUOUS");
});
