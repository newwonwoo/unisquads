import assert from "node:assert/strict";
import test from "node:test";
import {
  irosOutcomeStats,
  irosProgressStats,
  isReusableIrosResult,
  markStaleIrosRows,
  rowRequiresIros
} from "../public/iros-run-contract.mjs";

const pendingRow = {
  rowId: "r1",
  raw: "서울 강남구 역삼동 1 101동 101호",
  result: {
    status: "CONFIRMED",
    pnu: "1168010100100010000",
    isJip: true,
    unit: { dong: "101", ho: "101" }
  }
  // reg 없음 — 주소는 정제됐고 등기조회는 아직 하지 않은 상태
};

const resolvedRow = {
  rowId: "r2",
  result: {
    status: "CONFIRMED",
    pnu: "1168010100100020000",
    isJip: true,
    unit: { dong: "101", ho: "102" }
  },
  reg: { status: "RESOLVED", unique_no: "U1", complete: true }
};

// 저장된 배치를 다시 열 때 가장 먼저 지나가는 경로다. 여기서 예외가 나면
// 앱이 마운트 도중 죽어 화면 전체가 오류 폴백으로 대체된다(=검은 화면).
test("조회 이력이 없는 행은 재사용 판정에서 예외 없이 false다", () => {
  assert.equal(isReusableIrosResult(pendingRow.reg), false);
  assert.equal(isReusableIrosResult(undefined), false);
  assert.equal(isReusableIrosResult(null), false);
  assert.equal(isReusableIrosResult({}), false);
});

test("reg 없는 행이 섞여도 진행률 집계가 끝까지 돈다", () => {
  assert.equal(rowRequiresIros(pendingRow), true);

  const only = irosProgressStats([pendingRow]);
  assert.equal(only.total, 1);
  assert.equal(only.done, 0);
  assert.equal(only.remaining, 1);
  assert.equal(only.final, false);

  const mixed = irosProgressStats([pendingRow, resolvedRow, { rowId: "r3" }]);
  assert.equal(mixed.total, 2);
  assert.equal(mixed.done, 1);
  assert.equal(mixed.remaining, 1);
});

test("reg 없는 행이 섞여도 결과 집계와 stale 표기가 끝까지 돈다", () => {
  const outcome = irosOutcomeStats([pendingRow, resolvedRow]);
  assert.equal(outcome.addressConfirmed, 2);
  assert.equal(outcome.target, 2);
  assert.equal(outcome.judged, 1);
  assert.equal(outcome.resolved, 1);
  assert.equal(outcome.pending, 1);

  const marked = markStaleIrosRows([pendingRow, resolvedRow]);
  assert.equal(marked.length, 2);
  assert.equal(marked[0].reg, undefined);
  assert.equal(marked[1].reg.status, "RESOLVED");
});

test("빈 배치와 잘못된 입력도 예외를 던지지 않는다", () => {
  for (const input of [[], null, undefined, [null], [{}], [{ result: null }]]) {
    assert.equal(irosProgressStats(input).total, 0);
    assert.equal(irosOutcomeStats(input).target, 0);
  }
});
