import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";
import {
  MODULE_VERSIONS,
  attachPipelineMetadata,
  dependencyFingerprint,
  isReusableResult,
  resultFingerprint
} from "../public/pipeline-contract.mjs";

const source = fs.readFileSync(new URL("../public/runtime-fixes.js", import.meta.url), "utf8");

function loadRuntime({ fetchImpl } = {}) {
  const context = {
    console,
    URL,
    Headers,
    Response,
    Object,
    Array,
    String,
    RegExp,
    JSON
  };
  context.window = context;
  context.location = { href: "https://example.test/" };
  if (fetchImpl) context.fetch = fetchImpl;
  vm.runInNewContext(source, context);
  return context;
}

function asLegacyNaverResult(row, result) {
  const legacy = { ...result };
  delete legacy.naverAncillaryPolicyVersion;
  legacy.appliedModules = (legacy.appliedModules || [])
    .filter((name) => name !== "NAVER_ANCILLARY_PARENT");
  legacy.moduleVersions = Object.fromEntries(
    legacy.appliedModules.map((name) => [name, MODULE_VERSIONS[name] || "unknown"])
  );
  legacy.dependencyFingerprint = dependencyFingerprint(row, {}, legacy.appliedModules);
  legacy.resultFingerprint = resultFingerprint(legacy);
  return legacy;
}

test("test log panel has a global button style before app.js loads", () => {
  const context = loadRuntime();
  assert.equal(typeof context.btnS, "object");
  assert.equal(context.btnS.borderRadius, 8);
  assert.equal(context.window.btnS, context.btnS);
});

test("apartment search removes ancillary Naver places when a primary building exists", () => {
  const context = loadRuntime();
  const items = [
    {
      title: "<b>영등포푸르지오</b>경로당",
      category: "가정,생활 > 노인복지시설 > 경로당",
      address: "서울 영등포구 영등포동 647"
    },
    {
      title: "<b>영등포푸르지오</b>아파트",
      category: "부동산 > 주거시설 > 아파트",
      address: "서울 영등포구 영등포동 647"
    }
  ];
  const filtered = context.__ADDR_RUNTIME_FIXES__.filterNaverItems(
    items,
    "영등포구 영등포푸르지오"
  );
  assert.equal(filtered.length, 1);
  assert.match(filtered[0].title, /아파트/);
  assert.equal(filtered[0].__ancillaryParentRecovered, undefined);
});

test("ancillary-only exact child recovers only the parent building identity", () => {
  const context = loadRuntime();
  const filtered = context.__ADDR_RUNTIME_FIXES__.filterNaverItems([
    {
      title: "<b>삼도청솔아파트</b> 관리사무소",
      category: "생활 > 관리사무소",
      address: "강원 삼척시 정상동 산17"
    }
  ], "강원 삼척시 삼도청솔아파트");

  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].title, "삼도청솔아파트");
  assert.equal(filtered[0].category, "");
  assert.equal(filtered[0].address, "강원 삼척시 정상동 산17");
  assert.equal(filtered[0].__ancillaryParentRecovered, true);
});

test("ancillary-only result from a different building stays empty", () => {
  const context = loadRuntime();
  const filtered = context.__ADDR_RUNTIME_FIXES__.filterNaverItems([
    {
      title: "당산푸르지오경로당",
      category: "경로당",
      address: "서울 영등포구 당산동"
    }
  ], "영등포구 영등포푸르지오");
  assert.deepEqual(Array.from(filtered), []);
});

test("ancillary parent recovery requires an address", () => {
  const context = loadRuntime();
  const filtered = context.__ADDR_RUNTIME_FIXES__.filterNaverItems([
    { title: "영등포푸르지오경로당", category: "경로당" }
  ], "영등포푸르지오");
  assert.deepEqual(Array.from(filtered), []);
});

test("an explicit 경로당 search is not filtered", () => {
  const context = loadRuntime();
  const items = [{ title: "영등포푸르지오경로당", category: "노인복지시설" }];
  const filtered = context.__ADDR_RUNTIME_FIXES__.filterNaverItems(
    items,
    "영등포푸르지오 경로당"
  );
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0], items[0]);
});

test("the /api/naver response is rewritten with a safe parent candidate", async () => {
  const fetchImpl = async () => new Response(JSON.stringify({
    ok: true,
    items: [
      {
        title: "영등포푸르지오경로당",
        category: "경로당",
        address: "서울 영등포구 영등포동 647"
      }
    ]
  }), {
    status: 200,
    headers: { "content-type": "application/json" }
  });
  const context = loadRuntime({ fetchImpl });
  const response = await context.fetch("/api/naver?query=" + encodeURIComponent("영등포푸르지오"));
  const data = await response.json();
  assert.equal(data.items.length, 1);
  assert.equal(data.items[0].title, "영등포푸르지오");
  assert.equal(data.items[0].__ancillaryParentRecovered, true);
});

test("new L3 results carry the ancillary policy marker and remain reusable", () => {
  const row = { raw: "강원 삼척시 정상동 산17외 삼도청솔아파트 104동 101호", zip: "" };
  const result = attachPipelineMetadata(row, {
    status: "HUMAN_INPUT_ERROR",
    searchLevel: "L3",
    jusoQuery: "삼도청솔아파트 ▸ [네이버:0건]"
  });
  assert.equal(result.naverAncillaryPolicyVersion, "1");
  assert.ok(result.appliedModules.includes("NAVER_ANCILLARY_PARENT"));
  assert.equal(isReusableResult({ ...row, result }), true);
});

test("only legacy L3 Naver zero results are invalidated for one focused rerun", () => {
  const row = { raw: "강원 삼척시 정상동 산17외 삼도청솔아파트 104동 101호", zip: "" };
  const current = attachPipelineMetadata(row, {
    status: "HUMAN_INPUT_ERROR",
    searchLevel: "L3",
    jusoQuery: "삼도청솔아파트 ▸ [네이버:0건]"
  });
  const legacy = asLegacyNaverResult(row, current);
  assert.equal(isReusableResult({ ...row, result: legacy }), false);
});

test("legacy confirmed L3 rows remain reusable and are not globally reworked", () => {
  const row = { raw: "서울 영등포구 영등포동 647 영등포푸르지오 201동 1002호", zip: "" };
  const current = attachPipelineMetadata(row, {
    status: "CONFIRMED",
    source: "naver",
    searchLevel: "L3",
    pnu: "1156010100106470000",
    jibunAddr: "서울특별시 영등포구 영등포동 647 영등포푸르지오",
    unit: { dong: "201", ho: "1002" }
  });
  const legacy = asLegacyNaverResult(row, current);
  assert.equal(isReusableResult({ ...row, result: legacy }), true);
});

test("runtime fixes load after UI safety and before the app module", () => {
  const html = fs.readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
  const safety = html.indexOf('/ui-safety.js');
  const runtime = html.indexOf('/runtime-fixes.js');
  const app = html.indexOf('/app.js');
  assert.ok(safety >= 0);
  assert.ok(runtime > safety);
  assert.ok(app > runtime);
});
