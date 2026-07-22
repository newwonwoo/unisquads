import assert from "node:assert/strict";
import test from "node:test";

import {
  BATCH_PRIMARY_ACTIONS,
  BATCH_WORKFLOW_PHASES,
  deriveBatchWorkflowState
} from "../public/batch-workflow-state.mjs";

test("address-complete batch exposes initial IROS lookup action", () => {
  const state = deriveBatchWorkflowState({
    rowCount: 20029,
    batchDone: 20029,
    bridgeUp: true,
    irosStarted: false,
    irosOutcome: { target: 17563 }
  });
  assert.equal(state.phase, BATCH_WORKFLOW_PHASES.IROS_READY);
  assert.equal(state.primaryAction, BATCH_PRIMARY_ACTIONS.LOOKUP_IROS);
  assert.equal(state.primaryLabel, "등기고유번호 일괄조회 (17,563건)");
});

test("incomplete IROS run changes the primary action to resume with remaining count", () => {
  const state = deriveBatchWorkflowState({
    rowCount: 20029,
    batchDone: 20029,
    bridgeUp: true,
    irosStarted: true,
    irosFinalReady: false,
    irosProgress: { total: 17563, done: 16354, remaining: 1209 },
    irosOutcome: {
      target: 17563,
      judged: 16354,
      resolved: 16349,
      multiple: 2,
      otherFailure: 3,
      retryRequired: 0
    }
  });
  assert.equal(state.phase, BATCH_WORKFLOW_PHASES.IROS_INCOMPLETE);
  assert.equal(state.primaryAction, BATCH_PRIMARY_ACTIONS.RESUME_IROS);
  assert.equal(state.primaryLabel, "등기조회 이어서 (1,209건)");
  assert.match(state.statusLabel, /등기조회 미완료/);
  assert.match(state.statusLabel, /남은 1,209건/);
});

test("final IROS state replaces lookup with full download", () => {
  const state = deriveBatchWorkflowState({
    rowCount: 20029,
    batchDone: 20029,
    bridgeUp: true,
    irosStarted: true,
    irosFinalReady: true,
    irosProgress: { total: 17563, done: 17563, remaining: 0 },
    irosOutcome: { target: 17563, judged: 17563, resolved: 17558 }
  });
  assert.equal(state.phase, BATCH_WORKFLOW_PHASES.IROS_COMPLETE);
  assert.equal(state.primaryAction, BATCH_PRIMARY_ACTIONS.DOWNLOAD_ALL);
  assert.equal(state.primaryLabel, "전체 결과 다운로드");
  assert.match(state.statusLabel, /✅ 등기조회 완료/);
});

test("running state never exposes a competing primary action", () => {
  const state = deriveBatchWorkflowState({
    rowCount: 100,
    batchDone: 100,
    bridgeUp: true,
    irosStarted: true,
    batchRegBusy: true,
    irosProgress: { total: 90, done: 45, remaining: 45 },
    irosOutcome: { target: 90, judged: 45 }
  });
  assert.equal(state.phase, BATCH_WORKFLOW_PHASES.IROS_RUNNING);
  assert.equal(state.primaryAction, BATCH_PRIMARY_ACTIONS.NONE);
  assert.match(state.statusLabel, /등기조회 진행 중/);
});

test("address-only completion still provides a usable download action", () => {
  const state = deriveBatchWorkflowState({
    rowCount: 10,
    batchDone: 10,
    bridgeUp: false,
    irosStarted: false,
    irosOutcome: { target: 7 }
  });
  assert.equal(state.phase, BATCH_WORKFLOW_PHASES.ADDRESS_COMPLETE);
  assert.equal(state.primaryAction, BATCH_PRIMARY_ACTIONS.DOWNLOAD_ADDRESS);
  assert.equal(state.primaryLabel, "주소정제 결과 다운로드");
});
