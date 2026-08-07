#!/usr/bin/env node
// 공통모듈 회귀 감사 — 모든 판정 모듈이 공유하는 원시함수의 출력을 실측
// 입력 전수에 대해 기준선으로 고정한다.
//
// 회귀 리스크의 층위:
//   전처리  → 원문 파싱(아직 app.js 인라인 — 미커버, 인수인계 참조)
//   공통모듈 → unitKey·dongAliasKey·candidateUnitVariants·extractLegalLot 등
//             ← 이 감사가 커버. 여기가 바뀌면 모든 모듈이 한꺼번에 흔들린다.
//   개별모듈 → 판정 규칙(회귀 감사 + 단위 반례가 커버)
//   모듈배치 → 사다리 순서(간섭 감사 2종이 커버)
//
// 판정 기준선(matching-baseline)도 공통모듈 변화를 간접 감지하지만, 판정까지
// 도달하지 않는 경로(주소 체인의 buildingNamesMatch 등)와 "어느 원시함수가
// 바뀌었는지"는 못 짚는다. 이 감사는 원시함수 단위로 짚는다.
//
//   node scripts/audit-common-primitives.mjs            비교
//   node scripts/audit-common-primitives.mjs --update    기준선 갱신(사유를 커밋에)

import { readFile, writeFile } from "node:fs/promises";
import {
  buildingKey, candidateHasNoDong, candidateUnitVariants, dongAliasKey,
  extractLegalLot, propertyClassKey, unitKey
} from "../public/unit-match.mjs";
import { hasRegionalLotAddress, lotScopedText } from "../public/address-failed-requery.mjs";
import { loadCorpus } from "./audit-requests.mjs";

const BASELINE = new URL("../tests/fixtures/common-primitives-baseline.json", import.meta.url);
const update = process.argv.includes("--update");

function candidateSignature(c) {
  return [
    dongAliasKey(c.dong),
    unitKey(c.ho, "ho"),
    candidateUnitVariants(c).map((v) => `${v.source}:${v.dong}:${v.ho}`).join("+"),
    propertyClassKey(c),
    buildingKey(c.buldnm),
    candidateHasNoDong(c) ? "noDong" : "hasDong"
  ].join("|");
}

function addressSignature(text) {
  const lot = extractLegalLot(text);
  return [
    lot ? `${lot.legal}/${lot.mountain ? "산" : ""}${lot.lot}` : "-",
    lotScopedText(text),
    hasRegionalLotAddress(text) ? "regional" : "-"
  ].join("|");
}

const corpus = await loadCorpus();
const report = {};
let items = 0;
for (const entry of corpus.lots) {
  const per = { candidates: {}, addresses: {} };
  entry.candidates.forEach((c, i) => { per.candidates[i] = candidateSignature(c); items++; });
  const addresses = new Set([entry.id, entry.raw, ...entry.candidates.map((c) => c.sojae),
    ...entry.candidates.map((c) => c.add_item)].filter(Boolean));
  for (const a of addresses) { per.addresses[a] = addressSignature(a); items++; }
  report[entry.id] = per;
}

if (update) {
  await writeFile(BASELINE, `${JSON.stringify(report)}\n`, "utf8");
  console.log(`공통모듈 기준선 갱신 — 항목 ${items}건. 사유를 커밋에 남기세요.`);
  process.exit(0);
}

let baseline;
try { baseline = JSON.parse(await readFile(BASELINE, "utf8")); }
catch { console.error("기준선이 없습니다. --update로 만드세요."); process.exit(2); }

const diffs = [];
for (const [lotId, per] of Object.entries(report)) {
  const base = baseline[lotId] || { candidates: {}, addresses: {} };
  for (const kind of ["candidates", "addresses"]) {
    for (const [key, sig] of Object.entries(per[kind])) {
      if (base[kind][key] !== sig) {
        diffs.push(`${lotId} ${kind}[${key}]\n      이전 ${base[kind][key]}\n      이번 ${sig}`);
      }
    }
  }
}

console.log(`공통모듈 감사 — 원시함수 출력 ${items}건`);
if (!diffs.length) {
  console.log("✓ 공통모듈 출력 변화 없음");
  process.exit(0);
}
console.log(`\n✕ 공통모듈 출력 변화: ${diffs.length}건 — 모든 모듈이 함께 흔들립니다`);
diffs.slice(0, 15).forEach((d) => console.log(`  ${d}`));
if (diffs.length > 15) console.log(`  … 외 ${diffs.length - 15}건`);
console.log("\n의도한 변화라면 판정·간섭 감사까지 통과를 확인한 뒤 --update 하세요.");
process.exit(1);
