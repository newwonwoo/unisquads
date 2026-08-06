import assert from "node:assert/strict";
import test from "node:test";
import {
  VERIFIED_UNIT_PROPAGATION_VERSION,
  applyVerifiedUnitPropagation,
  buildVerifiedUnitIndex,
  planVerifiedUnitPropagation,
  verifiedUnitKey
} from "../public/verified-unit-propagation.mjs";

const PNU = "2629010100101000000";

const resolvedRow = (rowId, uniqueNo, unit = { dong: "106", ho: "1002" }) => ({
  rowId,
  result: { status: "CONFIRMED", pnu: PNU, unit },
  reg: { status: "RESOLVED", unique_no: uniqueNo, complete: true, candidates: [{ unique_no: uniqueNo }] }
});

const failedRow = (rowId, status, candidates, unit = { dong: "106", ho: "1002" }) => ({
  rowId,
  result: { status: "CONFIRMED", pnu: PNU, unit },
  reg: { status, complete: true, candidates }
});

test("전파 키는 PNU와 정규화된 동·호로만 만든다", () => {
  assert.equal(verifiedUnitKey({ pnu: PNU, unit: { dong: "제106동", ho: "제1002호" } }), `${PNU}|106|1002`);
  assert.equal(verifiedUnitKey({ pnu: PNU, unit: { dong: "에이", ho: "101" } }), `${PNU}|A|101`);
  assert.equal(verifiedUnitKey({ pnu: PNU, unit: { ho: "1002" } }), `${PNU}||1002`);
  assert.equal(verifiedUnitKey({ pnu: PNU, unit: { dong: "106" } }), "");
  assert.equal(verifiedUnitKey({ pnu: "짧음", unit: { ho: "1" } }), "");
});

test("같은 키의 고유번호가 두 종류면 그 키는 전파에서 제외한다", () => {
  const clean = buildVerifiedUnitIndex([resolvedRow("a", "X"), resolvedRow("b", "X")]);
  assert.equal(clean.get(`${PNU}|106|1002`).unique_no, "X");
  assert.deepEqual(clean.get(`${PNU}|106|1002`).source_row_ids, ["a", "b"]);

  const conflicted = buildVerifiedUnitIndex([resolvedRow("a", "X"), resolvedRow("b", "Y")]);
  assert.equal(conflicted.has(`${PNU}|106|1002`), false);
});

test("완전수집 뒤의 세대 실패만 검증된 고유번호를 받는다", () => {
  const rows = [
    resolvedRow("a", "X"),
    failedRow("b", "REG_MULTI", [{ unique_no: "X" }, { unique_no: "Z" }]),
    failedRow("c", "REG_UNIT_NOT_FOUND", [{ unique_no: "X" }])
  ];
  const plan = planVerifiedUnitPropagation(rows);
  assert.deepEqual(plan.map((item) => item.rowId), ["b", "c"]);
  assert.equal(plan[0].unique_no, "X");
  assert.equal(plan[0].from_status, "REG_MULTI");
  assert.equal(plan[0].evidence.version, VERIFIED_UNIT_PROPAGATION_VERSION);
  assert.deepEqual(plan[0].evidence.source_row_ids, ["a"]);
});

test("확정 고유번호가 대상행 후보에 없으면 전파하지 않는다", () => {
  const rows = [
    resolvedRow("a", "X"),
    failedRow("b", "REG_MULTI", [{ unique_no: "Y" }, { unique_no: "Z" }])
  ];
  assert.equal(planVerifiedUnitPropagation(rows).length, 0);
});

test("동·호가 다르거나 부분응답·재시도 상태이면 전파 대상이 아니다", () => {
  const other = failedRow("b", "REG_UNIT_NOT_FOUND", [{ unique_no: "X" }], { dong: "107", ho: "1002" });
  assert.equal(planVerifiedUnitPropagation([resolvedRow("a", "X"), other]).length, 0);

  const partial = { ...failedRow("c", "REG_PARTIAL_RESPONSE", [{ unique_no: "X" }]), };
  assert.equal(planVerifiedUnitPropagation([resolvedRow("a", "X"), partial]).length, 0);

  const incomplete = failedRow("d", "REG_UNIT_NOT_FOUND", [{ unique_no: "X" }]);
  incomplete.reg.complete = false;
  assert.equal(planVerifiedUnitPropagation([resolvedRow("a", "X"), incomplete]).length, 0);

  const stale = failedRow("e", "REG_UNIT_NOT_FOUND", [{ unique_no: "X" }]);
  stale.reg.stale = true;
  assert.equal(planVerifiedUnitPropagation([resolvedRow("a", "X"), stale]).length, 0);
});

test("기존 성공행은 전파의 대상이 되지 않는다", () => {
  const rows = [resolvedRow("a", "X"), resolvedRow("b", "X")];
  assert.equal(planVerifiedUnitPropagation(rows).length, 0);
});

test("전파 결과는 근거와 원래 실패상태를 함께 남긴다", () => {
  const target = failedRow("b", "REG_MULTI", [{ unique_no: "X" }, { unique_no: "Z" }]);
  const [propagation] = planVerifiedUnitPropagation([resolvedRow("a", "X"), target]);
  const reg = applyVerifiedUnitPropagation(target.reg, propagation);
  assert.equal(reg.status, "RESOLVED");
  assert.equal(reg.unique_no, "X");
  assert.deepEqual(reg.candidates, [{ unique_no: "X" }]);
  assert.equal(reg.strategy, "VERIFIED_UNIT_PROPAGATION");
  assert.equal(reg.unit_propagation.from_status, "REG_MULTI");
  assert.equal(reg.unit_propagation.from_candidate_count, 2);
  assert.equal(
    reg.applied_modules.includes(`R-IROS-VERIFIED-UNIT-PROPAGATION@${VERIFIED_UNIT_PROPAGATION_VERSION}`),
    true
  );
});
