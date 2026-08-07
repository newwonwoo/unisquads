#!/usr/bin/env node
// 전처리(원문 파싱) 회귀 감사 — 회귀 리스크 4층위의 첫 층.
//
// 실제 20,023행 실행의 고유 원본주소 전수(19,819건)에 운영 preprocess()를
// 그대로 돌려 파싱 결과(정제문·지번·법정동·동·호·건물명)를 기준선으로
// 고정한다. 전처리가 바뀌면 그 아래 모든 층(공통모듈·개별모듈·배치)이
// 다른 입력을 받으므로, 여기가 최상류 감사다.
//
// preprocess는 app.js가 export하는 운영 함수 그대로다(추출 복제본 아님).
// 브라우저 전역만 스텁한다 — 기존 test_address_resolution.mjs와 같은 방식.
//
//   node scripts/audit-preprocess.mjs            비교
//   node scripts/audit-preprocess.mjs --update    기준선 갱신(사유를 커밋에)

globalThis.window = { storage: {} };
globalThis.React = { createElement() { return {}; }, Fragment: {} };
globalThis.ReactDOM = { createRoot() { return { render() {} }; } };
globalThis.document = { getElementById() { return {}; } };
globalThis.localStorage = { getItem() { return null; }, setItem() {} };

import { readFile, writeFile } from "node:fs/promises";
const { preprocess } = await import("../public/app.js");

const BASELINE = new URL("../tests/fixtures/preprocess-baseline.json", import.meta.url);
const CORPUS = new URL("../tests/fixtures/preprocess-corpus.json", import.meta.url);
const update = process.argv.includes("--update");
const verbose = process.argv.includes("--verbose");

// 파싱 결과 중 하류 판정에 실제로 흘러가는 필드만 서명한다.
function signatureOf(pre) {
  const unit = pre?.unit || {};
  return [
    pre?.cleaned ?? "",
    pre?.searchText ?? "",
    pre?.sido ?? "", pre?.sgg ?? "", pre?.eup ?? "", pre?.emd ?? "",
    pre?.jibun ?? "",
    unit.dong ?? "", unit.ho ?? "", unit.floor ?? "",
    pre?.bldName ?? "",
    pre?.road ?? "", pre?.buldNo ?? ""
  ].join("␞");
}

const corpus = JSON.parse(await readFile(CORPUS, "utf8"));
const report = {};
for (const raw of corpus.raws) {
  report[raw] = signatureOf(preprocess(raw));
}
const total = corpus.raws.length;

if (update) {
  await writeFile(BASELINE, `${JSON.stringify(report)}\n`, "utf8");
  console.log(`전처리 기준선 갱신 — 원본주소 ${total}건. 사유를 커밋에 남기세요.`);
  process.exit(0);
}

let baseline;
try { baseline = JSON.parse(await readFile(BASELINE, "utf8")); }
catch { console.error("기준선이 없습니다. --update로 만드세요."); process.exit(2); }

const diffs = [];
for (const [raw, sig] of Object.entries(report)) {
  if (baseline[raw] !== undefined && baseline[raw] !== sig) {
    diffs.push({ raw, before: baseline[raw], after: sig });
  }
}

console.log(`전처리 감사 — 원본주소 ${total}건`);
if (!diffs.length) {
  console.log("✓ 파싱 결과 변화 없음");
  process.exit(0);
}
console.log(`\n✕ 파싱 결과 변화: ${diffs.length}건 — 하류 전 층위가 다른 입력을 받습니다`);
for (const d of (verbose ? diffs : diffs.slice(0, 10))) {
  console.log(`  ${d.raw}`);
  console.log(`      이전 ${d.before}`);
  console.log(`      이번 ${d.after}`);
}
if (!verbose && diffs.length > 10) console.log(`  … 외 ${diffs.length - 10}건 (--verbose)`);
console.log("\n의도한 변화라면 다른 감사·E2E까지 통과를 확인한 뒤 --update 하세요.");
process.exit(1);
