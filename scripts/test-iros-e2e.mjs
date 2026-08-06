#!/usr/bin/env node
// IROS 세대매칭만 실제 앱으로 돌려보는 회귀 테스트.
//
// 주소 정제·등기 브리지를 모두 가로채고, 실제 실행에서 실패했던 유형의
// 등기 후보를 그대로 돌려준다. 그래서 확인하는 것은 매칭 로직 하나다.
//
//   node scripts/test-iros-e2e.mjs                실행 후 통과/실패 표
//   node scripts/test-iros-e2e.mjs --keep-open    브라우저를 닫지 않는다
//   node scripts/test-iros-e2e.mjs --case 진흥    한 케이스만
//
// 준비:  npm install     (playwright · react18 · react-dom18 · xlsx)
// 실행:  npm run test:iros

import { chromium } from "playwright";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CASES, buildCsv, expectationOf } from "./iros-e2e-cases.mjs";

const ROOT = fileURLToPath(new URL("../public", import.meta.url));
const args = process.argv.slice(2);
const keepOpen = args.includes("--keep-open");
const only = (() => {
  const i = args.indexOf("--case");
  return i >= 0 ? args[i + 1] : "";
})();

const cases = only ? CASES.filter((c) => c.name.includes(only)) : CASES;
if (!cases.length) {
  console.error(`케이스를 찾지 못했습니다: ${only}`);
  console.error(`가능한 이름: ${CASES.map((c) => c.name).join(", ")}`);
  process.exit(2);
}

// ── 정적 서버 ────────────────────────────────────────────────────────────
const TYPES = {
  ".js": "text/javascript", ".mjs": "text/javascript",
  ".html": "text/html", ".json": "application/json", ".csv": "text/csv"
};
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]);
  if (p === "/") p = "/index.html";
  const file = path.join(ROOT, p);
  if (!file.startsWith(ROOT) || !fs.existsSync(file)) { res.writeHead(404); return res.end("nf"); }
  res.writeHead(200, { "content-type": TYPES[path.extname(file)] || "application/octet-stream" });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const port = server.address().port;

// CDN UMD는 로컬 빌드로 대체한다(이 환경은 외부망이 막혀 있다).
const VENDOR = {
  "react.production.min.js": "node_modules/react/umd/react.development.js",
  "react-dom.production.min.js": "node_modules/react-dom/umd/react-dom.development.js",
  "xlsx.full.min.js": "node_modules/xlsx/dist/xlsx.full.min.js"
};
const repoRoot = fileURLToPath(new URL("..", import.meta.url));
for (const [name, rel] of Object.entries(VENDOR)) {
  if (!fs.existsSync(path.join(repoRoot, rel))) {
    console.error(`벤더 파일이 없습니다: ${rel}`);
    console.error("npm i react react-dom xlsx 로 설치한 뒤 다시 실행하세요.");
    process.exit(2);
  }
}

// ── 케이스별 목업 색인 ───────────────────────────────────────────────────
const byRaw = new Map();
for (const c of cases) for (const row of c.rows) byRaw.set(row.raw, { c, row });

const jusoCalls = [];
const resolveCalls = [];

function jusoReply(keyword) {
  jusoCalls.push(keyword);
  for (const c of cases) {
    if (!c.juso) continue;
    const hit = c.juso.match.test(keyword);
    if (hit) return { common: ok(1), juso: [c.juso.item] };
  }
  return { common: ok(0), juso: [] };
}
const ok = (n) => ({
  errorCode: "0", errorMessage: "정상",
  totalCount: String(n), currentPage: "1", countPerPage: "10"
});

function resolveReply(addr) {
  resolveCalls.push(addr);
  const c = cases.find((x) => x.iros.match.test(addr));
  const candidates = c ? c.iros.candidates : [];
  return {
    status: "OK",
    all_candidates: candidates,
    candidates,
    complete: true,
    query_scope: "EXACT_LOT",
    strategy: "FULL_COLLECT",
    total_count: candidates.length,
    received_count: candidates.length,
    raw_received_count: candidates.length,
    parsed_count: candidates.length,
    unique_candidate_count: candidates.length,
    parse_error_count: 0,
    pages_fetched: 1,
    expected_pages: 1,
    effective_page_unit: 50,
    requested_page_unit: 50,
    capability_source: "mock",
    content_hash: `mock-${c?.name || "none"}-${candidates.length}`,
    schema_fingerprint: "mock-v1"
  };
}

// ── 실행 ─────────────────────────────────────────────────────────────────
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const page = await browser.newPage();
const pageErrors = [];
page.on("pageerror", (e) => pageErrors.push(e.message));

await page.route("**/*", async (route) => {
  const url = route.request().url();
  for (const [name, rel] of Object.entries(VENDOR)) {
    if (url.includes(name)) {
      return route.fulfill({
        status: 200, contentType: "text/javascript",
        body: fs.readFileSync(path.join(repoRoot, rel), "utf8")
      });
    }
  }
  const json = (obj) => route.fulfill({
    status: 200, contentType: "application/json", body: JSON.stringify(obj)
  });
  if (url.includes("/api/juso")) {
    return json(jusoReply(decodeURIComponent(new URL(url).searchParams.get("keyword") || "")));
  }
  if (url.includes("/api/resolve")) {
    return json(resolveReply(decodeURIComponent(new URL(url).searchParams.get("addr") || "")));
  }
  if (url.includes("/api/naver")) return json({ ok: true, items: [], total: 0 });
  if (url.includes("/api/units")) return json({ units: [] });
  if (url.includes("/api/health")) return json({ ok: true });
  if (url.includes("/api/")) return json({ ok: true, items: [] });
  return route.continue();
});

await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: "load" });
await page.waitForTimeout(1500);

const csvPath = path.join(ROOT, "__iros-e2e.csv");
fs.writeFileSync(csvPath, buildCsv(cases));

await page.getByText("일괄 정제 (엑셀)").first().click();
await page.waitForTimeout(400);
await page.setInputFiles("input[type=file]", csvPath);
await page.waitForTimeout(2000);

const clickButton = (re) => page.evaluate((pattern) => {
  const button = [...document.querySelectorAll("button")]
    .find((b) => new RegExp(pattern).test(b.innerText.trim()));
  if (!button) return false;
  button.click();
  return true;
}, re.source);

// 1단계: 주소 정제
if (!await clickButton(/^일괄 정제 \(\d+행\)/)) {
  console.error("일괄 정제 버튼을 찾지 못했습니다.");
  await finish(2);
}
await waitUntilIdle(/^일괄 정제/, 60_000);

// 2단계: 등기 조회 — 주소가 끝나면 같은 자리 버튼이 등기 조회로 바뀐다
const irosClicked = await clickButton(/등기고유번호 일괄조회|등기조회 이어서/);
if (!irosClicked) {
  console.error("등기 조회 버튼을 찾지 못했습니다. 현재 버튼:");
  console.error(await page.evaluate(() =>
    [...document.querySelectorAll("button")].map((b) => b.innerText.trim()).filter(Boolean)));
  await finish(2);
}
await waitUntilIdle(/등기고유번호 일괄조회/, 90_000);

async function waitUntilIdle(labelRe, timeoutMs) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    await page.waitForTimeout(700);
    const busy = await page.evaluate(() =>
      Boolean(document.body.innerText.match(/기본 PNU \d+\/\d+|정제 중|조회 중/)));
    if (!busy) {
      // 진행 표시가 사라진 뒤 한 번 더 확인해 깜빡임을 거른다
      await page.waitForTimeout(900);
      const stillBusy = await page.evaluate(() =>
        Boolean(document.body.innerText.match(/기본 PNU \d+\/\d+|정제 중|조회 중/)));
      if (!stillBusy) return;
    }
  }
  console.error(`시간 초과: ${labelRe}`);
}

const rows = await page.evaluate(async () => {
  const record = await new Promise((resolve, reject) => {
    const request = indexedDB.open("addr-refine", 1);
    request.onsuccess = () => {
      const get = request.result.transaction("batch").objectStore("batch").get("rows-progress");
      get.onsuccess = () => resolve(get.result?.value);
      get.onerror = () => reject(get.error);
    };
    request.onerror = () => reject(request.error);
  });
  return (record?.rows || []).map((r) => ({
    raw: r.raw,
    addressStatus: r.result?.status || "",
    jibun: r.result?.jibunAddr || "",
    dong: r.result?.unit?.dong || "",
    ho: r.result?.unit?.ho || "",
    regStatus: r.reg?.status || "",
    uniqueNo: r.reg?.unique_no || "",
    modules: (r.reg?.applied_modules || []).map((m) => m.id || m).join(","),
    message: r.reg?.message || ""
  }));
});

fs.unlinkSync(csvPath);

// ── 채점 ─────────────────────────────────────────────────────────────────
const byRawResult = new Map(rows.map((r) => [r.raw, r]));
let pass = 0, fail = 0;
const failures = [];

console.log(`\nIROS 세대매칭 E2E — 케이스 ${cases.length}종 / ${rows.length}행\n`);
for (const c of cases) {
  const results = c.rows.map((row) => ({ row, got: byRawResult.get(row.raw) }));
  const bad = results.filter(({ row, got }) => {
    const want = expectationOf(row);
    if (!got) return true;
    return want.uniqueNo !== got.uniqueNo;
  });
  const mark = bad.length ? "✕" : "✓";
  console.log(`${mark} ${c.name}  (${results.length - bad.length}/${results.length})`);
  console.log(`    ${c.why}`);
  if (bad.length) {
    fail += bad.length;
    for (const { row, got } of bad.slice(0, 3)) {
      const want = expectationOf(row);
      failures.push({ case: c.name, raw: row.raw, want: want.uniqueNo, got });
      console.log(`      원문 ${row.raw}`);
      console.log(`      기대 고유번호 ${want.uniqueNo || "(없음)"} / 실제 ${got?.uniqueNo || "(없음)"}` +
        `  [주소 ${got?.addressStatus || "?"} · 등기 ${got?.regStatus || "미조회"}] ${got?.modules || ""}`);
      if (got?.jibun) console.log(`      확정 ${got.jibun}  동 ${got.dong} 호 ${got.ho}`);
      if (got?.message) console.log(`      메시지 ${got.message}`);
    }
  }
  pass += results.length - bad.length;
}

console.log(`\n합계 ${pass}행 통과 / ${fail}행 실패`);
if (pageErrors.length) {
  console.log(`\n⚠ 페이지 오류 ${pageErrors.length}건`);
  pageErrors.slice(0, 3).forEach((e) => console.log(`   ${e}`));
}
console.log(`(JUSO 호출 ${jusoCalls.length} · IROS 조회 ${resolveCalls.length})`);

await finish(fail || pageErrors.length ? 1 : 0);

async function finish(code) {
  if (keepOpen) {
    console.log("\n--keep-open: 브라우저를 열어 둡니다. Ctrl+C로 종료하세요.");
    return;
  }
  await browser.close();
  server.close();
  process.exit(code);
}
