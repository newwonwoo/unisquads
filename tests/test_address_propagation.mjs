import assert from "node:assert/strict";
import test from "node:test";
import {
  attachPipelineMetadata,
  cloneResult,
  isReusableResult
} from "../public/pipeline-contract.mjs";

globalThis.window = { storage: {} };
globalThis.React = { createElement() { return {}; } };
globalThis.ReactDOM = { createRoot() { return { render() {} }; } };
globalThis.document = { getElementById() { return {}; } };

const app = await import("../public/app.js");

function makeRows() {
  const source = {
    rowId: "row-1",
    raw: "서울특별시 송파구 가락동 913 헬리오시티 101동 1001호",
    zip: "05800",
    extra: ["홍길동"]
  };
  const target = {
    rowId: "row-2",
    raw: "서울특별시 송파구 가락동 102동 1002호",
    zip: "05800",
    extra: ["홍길동"]
  };
  source.result = attachPipelineMetadata(source, {
    status: "CONFIRMED",
    pnu: "1171010700109130000",
    jibunAddr: "서울특별시 송파구 가락동 913",
    roadAddr: "서울특별시 송파구 송파대로 345",
    bdMgtSn: "1171010700109130000000001",
    bdNm: "헬리오시티",
    unit: { dong: "101", ho: "1001" },
    source: "juso"
  });
  target.result = attachPipelineMetadata(target, {
    status: "FAILED",
    failKind: "PERMANENT",
    unit: { dong: "102", ho: "1002" },
    source: "juso"
  });
  return [source, target];
}

function evidenceContext(rows) {
  const groupHints = app.buildGroupHints(rows);
  const dongsoAnchors = app.buildDongsoAnchors(rows);
  const propagated = app.buildCurrentPropagationEvidence(rows, groupHints);
  const evidenceFor = (row) => ({
    ...app.pipelineEvidenceForRow(row, groupHints, dongsoAnchors),
    ...(propagated.get(app.propagationRowKey(row)) || {})
  });
  return { groupHints, evidenceFor };
}

test("address-group propagation is repeatable and invalidates on source change", () => {
  const rows = makeRows();
  let ctx = evidenceContext(rows);
  assert.equal(app.propagateAddressGroup(rows, ctx.groupHints, ctx.evidenceFor), 1);
  assert.equal(rows[1].result.source, "주소군전파");
  assert.equal(rows[1].result.pnu, "1171010700109130000");

  const first = cloneResult(rows[1].result);
  ctx = evidenceContext(rows);
  assert.equal(isReusableResult(rows[1], ctx.evidenceFor(rows[1])), true);
  app.propagateAddressGroup(rows, ctx.groupHints, ctx.evidenceFor);
  assert.equal(rows[1].result.resultFingerprint, first.resultFingerprint);
  assert.equal(rows[1].result.dependencyFingerprint, first.dependencyFingerprint);

  rows[0].result = attachPipelineMetadata(rows[0], {
    ...rows[0].result,
    pnu: "1171010700109140000",
    jibunAddr: "서울특별시 송파구 가락동 914"
  });
  ctx = evidenceContext(rows);
  assert.equal(isReusableResult(rows[1], ctx.evidenceFor(rows[1])), false);
  app.propagateAddressGroup(rows, ctx.groupHints, ctx.evidenceFor);
  assert.equal(rows[1].result.pnu, "1171010700109140000");
  assert.notEqual(rows[1].result.resultFingerprint, first.resultFingerprint);
});
