#!/usr/bin/env node
// 정제 판정 회귀 감사 — "정제 100건이 다음 버전에 90건이 되는" 회귀를
// 배포 전에 잡는다.
//
// 성공 잠금(isProtectedAddressSuccess)은 저장된 결과를 지킬 뿐 규칙의
// 안전을 증명하지 않는다 — 새 규칙으로 처음부터 돌리면 덜 정제될 수 있다.
// 그래서 실측 원본주소 표본이 실제로 쓰는 JUSO 응답(문제지)을 얼려 두고
// (record-refinement-corpus.mjs), 운영 판정 함수 preprocess()+resolve()를
// 그대로 재생해 판정(확정/기각/검토)을 기준선과 비교한다.
//
// 확정이었던 행이 기각·검토로 바뀌면 그게 정제율 회귀다 — 규칙을 재배열이
// 아니라 기권 조건으로 고쳐서 변화가 사라질 때까지 수정한다.
//
//   node scripts/audit-refinement.mjs            비교
//   node scripts/audit-refinement.mjs --update    기준선 갱신(사유를 커밋에)

globalThis.window = { storage: {} };
globalThis.React = { createElement() { return {}; }, Fragment: {} };
globalThis.ReactDOM = { createRoot() { return { render() {} }; } };
globalThis.document = { getElementById() { return {}; } };
globalThis.localStorage = { getItem() { return null; }, setItem() {} };

import { readFile, writeFile } from "node:fs/promises";
const { preprocess, resolve } = await import("../public/app.js");

const CORPUS = new URL("../tests/fixtures/refinement-corpus.json", import.meta.url);
const BASELINE = new URL("../tests/fixtures/refinement-baseline.json", import.meta.url);
const update = process.argv.includes("--update");
const verbose = process.argv.includes("--verbose");

// 판정에서 하류로 흘러가는 것만 서명한다: 상태·확정 주소·건물·동호·검토.
function signatureOf(decision) {
  if (!decision) return "NONE";
  const unit = decision.unit || {};
  return [
    decision.status ?? "",
    decision.reason ?? "",
    decision.jibunAddr ?? "",
    decision.bdMgtSn ?? "",
    decision.bdNm ?? "",
    unit.dong ?? "", unit.ho ?? "",
    decision.reviewNeeded ?? "",
    decision.source ?? ""
  ].join("␞");
}

const corpus = JSON.parse(await readFile(CORPUS, "utf8"));
const report = {};
for (const row of corpus.rows) {
  const pre = preprocess(row.raw);
  // 운영과 같은 순서: 기록된 질의를 차례로 보고 첫 비어있지 않은 응답을 쓴다.
  const hits = (row.queries.find((entry) => entry.hits?.length)?.hits) || [];
  report[row.raw] = signatureOf(resolve(hits, pre));
}
const total = corpus.rows.length;

if (update) {
  await writeFile(BASELINE, `${JSON.stringify(report)}\n`, "utf8");
  console.log(`정제 판정 기준선 갱신 — 표본 ${total}행. 사유를 커밋에 남기세요.`);
  process.exit(0);
}

let baseline;
try { baseline = JSON.parse(await readFile(BASELINE, "utf8")); }
catch { console.error("기준선이 없습니다. --update로 만드세요."); process.exit(2); }

const diffs = [];
let lostConfirm = 0;
for (const [raw, sig] of Object.entries(report)) {
  const before = baseline[raw];
  if (before === undefined || before === sig) continue;
  if (before.startsWith("CONFIRMED␞") && !sig.startsWith("CONFIRMED␞")) lostConfirm += 1;
  diffs.push({ raw, before, after: sig });
}

console.log(`정제 판정 감사 — 실측 표본 ${total}행 (얼린 JUSO 응답 재생)`);
if (!diffs.length) {
  console.log("✓ 정제 판정 변화 없음 — 확정이 기각으로 바뀐 행 0건");
  process.exit(0);
}
console.log(`\n✕ 정제 판정 변화: ${diffs.length}건` +
  (lostConfirm ? ` — 그중 확정→비확정 ${lostConfirm}건 (정제율 회귀!)` : ""));
for (const d of (verbose ? diffs : diffs.slice(0, 10))) {
  console.log(`  ${d.raw}`);
  console.log(`      이전 ${d.before}`);
  console.log(`      이번 ${d.after}`);
}
if (!verbose && diffs.length > 10) console.log(`  … 외 ${diffs.length - 10}건 (--verbose)`);
console.log("\n의도한 변화라면 근거(실측 확인)를 갖춘 뒤 --update 하세요.");
process.exit(1);
