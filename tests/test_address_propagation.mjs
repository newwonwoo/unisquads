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

test("an ambiguous row is confirmed only when its candidate set intersects the group PNU", () => {
  const rows = makeRows();
  rows[1].raw = "서울특별시 송파구 가락동 913 헬리오시티 102동 1002호";
  rows[1].result = attachPipelineMetadata(rows[1], {
    status: "AMBIGUOUS",
    candidates: [
      {
        pnu: "1171010700109130000",
        jibunAddr: "서울특별시 송파구 가락동 913",
        roadAddr: "서울특별시 송파구 송파대로 345",
        bdMgtSn: "1171010700109130000000001",
        bdNm: "헬리오시티",
        isJip: true
      },
      {
        pnu: "1171010700109140000",
        jibunAddr: "서울특별시 송파구 가락동 914",
        roadAddr: "",
        bdMgtSn: "1171010700109140000000001",
        bdNm: "다른아파트",
        isJip: true
      }
    ],
    unit: { dong: "102", ho: "1002" },
    source: "juso"
  });

  let ctx = evidenceContext(rows);
  assert.equal(app.propagateAddressGroup(rows, ctx.groupHints, ctx.evidenceFor), 1);
  assert.equal(rows[1].result.source, "주소군후보교집합");
  assert.equal(rows[1].result.pnu, "1171010700109130000");
  assert.ok(rows[1].result.addressMatchEvidence.includes("GROUP_CANDIDATE_INTERSECTION"));

  const firstFingerprint = rows[1].result.resultFingerprint;
  ctx = evidenceContext(rows);
  assert.equal(isReusableResult(rows[1], ctx.evidenceFor(rows[1])), true);
  assert.equal(app.propagateAddressGroup(rows, ctx.groupHints, ctx.evidenceFor), 1);
  assert.equal(rows[1].result.source, "주소군후보교집합");
  assert.equal(rows[1].result.resultFingerprint, firstFingerprint);
});

test("group propagation does not select an ambiguous candidate outside the group PNU", () => {
  const rows = makeRows();
  rows[1].raw = "서울특별시 송파구 가락동 914 다른아파트 102동 1002호";
  rows[1].result = attachPipelineMetadata(rows[1], {
    status: "AMBIGUOUS",
    candidates: [{
      pnu: "1171010700109140000",
      jibunAddr: "서울특별시 송파구 가락동 914",
      bdNm: "다른아파트",
      isJip: true
    }],
    unit: { dong: "102", ho: "1002" },
    source: "juso"
  });
  const ctx = evidenceContext(rows);
  assert.equal(app.propagateAddressGroup(rows, ctx.groupHints, ctx.evidenceFor), 0);
  assert.equal(rows[1].result.status, "AMBIGUOUS");
});

test("owner and postal-code propagation recovers an addressless unit only from one direct PNU", () => {
  const source = {
    rowId: "row-a",
    raw: "경남 고성군 하이면 덕호리 628-3 송림아파트 A동 101호",
    zip: "638930",
    extra: ["송림주택건설㈜"]
  };
  const target = {
    rowId: "row-b",
    raw: "경남 고성군 하이면 A-1-102",
    zip: "638930",
    extra: ["송림주택건설㈜"]
  };
  source.result = attachPipelineMetadata(source, {
    status: "CONFIRMED",
    pnu: "4882033021106280003",
    jibunAddr: "경상남도 고성군 하이면 덕호리 628-3",
    roadAddr: "",
    bdMgtSn: "4882033021106280003000001",
    bdNm: "송림아파트",
    unit: { dong: "A", ho: "101" },
    source: "juso"
  });
  target.result = attachPipelineMetadata(target, {
    status: "FAILED",
    failKind: "PERMANENT",
    unit: { dong: "A", ho: "102" },
    source: "juso"
  });
  const rows = [source, target];

  let ctx = evidenceContext(rows);
  assert.equal(app.propagateAddressGroup(rows, ctx.groupHints, ctx.evidenceFor), 1);
  assert.equal(rows[1].result.source, "소유자주소군전파");
  assert.equal(rows[1].result.pnu, "4882033021106280003");
  assert.deepEqual(rows[1].result.unit, { dong: "A", ho: "102" });

  const firstFingerprint = rows[1].result.resultFingerprint;
  ctx = evidenceContext(rows);
  assert.equal(isReusableResult(rows[1], ctx.evidenceFor(rows[1])), true);
  app.propagateAddressGroup(rows, ctx.groupHints, ctx.evidenceFor);
  assert.equal(rows[1].result.resultFingerprint, firstFingerprint);
});

test("owner and postal-code propagation closes when two direct PNU values exist", () => {
  const rows = makeRows();
  rows[0].zip = "638930";
  rows[0].extra = ["동일소유자"];
  rows[1].zip = "638930";
  rows[1].extra = ["동일소유자"];
  rows[1].raw = "경남 고성군 하이면 A-1-102";
  rows[1].result = attachPipelineMetadata(rows[1], {
    status: "FAILED", failKind: "PERMANENT", source: "juso",
    unit: { dong: "A", ho: "102" }
  });
  const other = {
    rowId: "row-3",
    raw: "경남 고성군 하이면 다른리 10 다른아파트 101동 101호",
    zip: "638930",
    extra: ["동일소유자"]
  };
  other.result = attachPipelineMetadata(other, {
    status: "CONFIRMED",
    pnu: "4882033021100100000",
    jibunAddr: "경상남도 고성군 하이면 다른리 10",
    unit: { dong: "101", ho: "101" },
    source: "juso"
  });
  rows.push(other);
  const ctx = evidenceContext(rows);
  assert.equal(app.propagateAddressGroup(rows, ctx.groupHints, ctx.evidenceFor), 0);
  assert.equal(rows[1].result.status, "FAILED");
});
