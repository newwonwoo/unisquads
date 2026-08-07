#!/usr/bin/env node
// 회귀 감사용 실측 후보 코퍼스를 만든다.
//
// probe:iros가 --save로 저장한 실제 등기 응답(JSON)을 받아, 감사에 필요한
// 필드만 남겨 tests/fixtures/iros-candidate-corpus.json으로 합친다.
// 합성값은 넣지 않는다 — 감사의 값어치는 실제 등기부 표기에서 나온다.
//
//   node scripts/build-candidate-corpus.mjs probe1.json probe2.json …
//
// 이미 있는 코퍼스에 새 지번만 더한다(같은 지번은 새 응답으로 교체).
// 새 실패 유형을 프로브할 때마다 여기에 넣어 두면 감사 범위가 넓어진다.

import { readFile, writeFile } from "node:fs/promises";

const OUT = new URL("../tests/fixtures/iros-candidate-corpus.json", import.meta.url);

// 감사에 쓰는 필드만 남긴다. 소유자·개인정보는 애초에 응답에 없다.
const KEEP = [
  "unique_no", "dong", "ho", "floor", "buldnm", "sojae",
  "lot_no", "add_item", "gubun", "real_cls_cd", "state", "unit_source"
];

function slim(candidate) {
  const out = {};
  for (const key of KEEP) {
    const value = candidate?.[key];
    if (value !== undefined && value !== null && value !== "") out[key] = value;
  }
  return out;
}

const files = process.argv.slice(2);
if (!files.length) {
  console.error("프로브 저장본(JSON)을 인자로 주세요.");
  console.error("  npm run probe:iros -- --file cases.txt --save real.json");
  console.error("  node scripts/build-candidate-corpus.mjs real.json");
  process.exit(2);
}

let corpus = { version: 1, lots: [] };
try {
  corpus = JSON.parse(await readFile(OUT, "utf8"));
} catch {
  // 처음 만드는 경우
}
const byId = new Map(corpus.lots.map((lot) => [lot.id, lot]));

let addedLots = 0;
let addedCandidates = 0;
for (const file of files) {
  const entries = JSON.parse(await readFile(file, "utf8"));
  for (const entry of entries) {
    const candidates = (entry.data?.all_candidates || entry.data?.candidates || [])
      .map(slim)
      .filter((candidate) => candidate.unique_no);
    if (!candidates.length) continue;
    const id = String(entry.target?.addr || "").trim();
    if (!id) continue;
    const lot = {
      id,
      raw: String(entry.target?.raw || entry.target?.addr || ""),
      bdNm: String(entry.target?.bdnm || ""),
      candidates
    };
    if (!byId.has(id)) addedLots += 1;
    byId.set(id, lot);
    addedCandidates += candidates.length;
  }
}

corpus.lots = [...byId.values()].sort((a, b) => a.id.localeCompare(b.id));
await writeFile(OUT, `${JSON.stringify(corpus, null, 2)}\n`, "utf8");
console.log(
  `코퍼스 갱신 — 지번 ${corpus.lots.length}곳` +
  ` (새로 추가 ${addedLots}곳, 후보 ${addedCandidates}건 반영)`
);
