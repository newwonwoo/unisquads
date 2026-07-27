import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

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

test("test log panel has a global button style before app.js loads", () => {
  const context = loadRuntime();
  assert.equal(typeof context.btnS, "object");
  assert.equal(context.btnS.borderRadius, 8);
  assert.equal(context.window.btnS, context.btnS);
});

test("apartment search removes ancillary Naver places", () => {
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
});

test("ancillary-only result becomes empty so the app continues to the next query", () => {
  const context = loadRuntime();
  const filtered = context.__ADDR_RUNTIME_FIXES__.filterNaverItems([
    { title: "영등포푸르지오경로당", category: "노인복지시설" }
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
});

test("the /api/naver response is filtered before app candidate scoring", async () => {
  const fetchImpl = async () => new Response(JSON.stringify({
    ok: true,
    items: [
      { title: "영등포푸르지오경로당", category: "경로당" },
      { title: "영등포푸르지오아파트", category: "주거시설 > 아파트" }
    ]
  }), {
    status: 200,
    headers: { "content-type": "application/json" }
  });
  const context = loadRuntime({ fetchImpl });
  const response = await context.fetch("/api/naver?query=" + encodeURIComponent("영등포푸르지오"));
  const data = await response.json();
  assert.equal(data.items.length, 1);
  assert.match(data.items[0].title, /아파트/);
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
