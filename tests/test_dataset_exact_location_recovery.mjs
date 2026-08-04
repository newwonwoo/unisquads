import assert from "node:assert/strict";
import test from "node:test";

globalThis.window = { storage: {} };
globalThis.React = { createElement() { return {}; } };
globalThis.ReactDOM = { createRoot() { return { render() {} }; } };
globalThis.document = { getElementById() { return {}; } };

const { resolveDatasetMultiPnuGroups } = await import("../public/app.js");

const PNU = "1121510500107670001";

test("an exact-location failure inherits one direct PNU but keeps its own unit", () => {
  const rows = [
    {
      rowId: "anchor",
      raw: "서울 광진구 자양동 767-1 101동 101호",
      zip: "143190",
      owner: "같은소유자",
      result: {
        status: "CONFIRMED",
        pnu: PNU,
        jibunAddr: "서울특별시 광진구 자양동 767-1",
        roadAddr: "서울특별시 광진구 자양로 1",
        bdMgtSn: "1121510500107670001000001",
        bdNm: "테스트아파트",
        isJip: true,
        source: "juso",
        validation: { status: "MATCH" }
      }
    },
    {
      rowId: "failure",
      raw: "서울 광진구 자양동 767-1 102동 202호",
      zip: "143190",
      owner: "다른소유자",
      result: { status: "FAILED", validation: { status: "NOT_AVAILABLE" } }
    }
  ];

  assert.equal(resolveDatasetMultiPnuGroups(rows), 1);
  assert.equal(rows[1].result.status, "CONFIRMED");
  assert.equal(rows[1].result.pnu, PNU);
  assert.deepEqual(rows[1].result.unit, { dong: "102", ho: "202" });
  assert.equal(rows[1].result.source, "데이터셋위치교차검증");
});

test("owner and zip alone do not promote a failure without a candidate intersection", () => {
  const rows = [
    {
      rowId: "anchor",
      raw: "서울 광진구 자양동 767-1 101동 101호",
      zip: "143190",
      owner: "같은소유자",
      result: {
        status: "CONFIRMED",
        pnu: PNU,
        jibunAddr: "서울특별시 광진구 자양동 767-1",
        source: "juso",
        validation: { status: "MATCH" }
      }
    },
    {
      rowId: "failure",
      raw: "서울 광진구 102동 202호",
      zip: "143190",
      owner: "같은소유자",
      result: { status: "FAILED", validation: { status: "NOT_AVAILABLE" } }
    }
  ];

  assert.equal(resolveDatasetMultiPnuGroups(rows), 0);
  assert.equal(rows[1].result.status, "FAILED");
});
