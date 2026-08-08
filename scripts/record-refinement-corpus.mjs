#!/usr/bin/env node
// 정제 판정 감사용 실측 JUSO 응답 녹음기.
//
// 정제 확정 단계는 JUSO 응답이 있어야 돌아가므로, 응답(문제지)을 얼려야
// 등기 쪽과 같은 오프라인 답안지 비교가 가능하다. 이 스크립트는 표본
// 원본주소들이 실제로 쓰는 질의를 실 JUSO API로 호출해 응답을 그대로
// 저장한다. 합성값은 넣지 않는다.
//
//   node scripts/record-refinement-corpus.mjs <표본.json> --api <프록시주소>
//
// 표본 형식: [{ raw, stratum?, queries?: [..] }]
//   - queries가 있으면(실행 결과의 juso검색어 사슬) 그 질의들을 그대로 녹음
//   - 없으면 운영의 1차 질의인 preprocess(raw).searchText를 녹음
// 출력: tests/fixtures/refinement-corpus.json (기존에 없는 raw만 추가)

globalThis.window = { storage: {} };
globalThis.React = { createElement() { return {}; }, Fragment: {} };
globalThis.ReactDOM = { createRoot() { return { render() {} }; } };
globalThis.document = { getElementById() { return {}; } };
globalThis.localStorage = { getItem() { return null; }, setItem() {} };

import { readFile, writeFile } from "node:fs/promises";
const { preprocess } = await import("../public/app.js");

const OUT = new URL("../tests/fixtures/refinement-corpus.json", import.meta.url);
const argv = process.argv.slice(2);
const sampleFile = argv.find((a) => !a.startsWith("--"));
const apiIndex = argv.indexOf("--api");
const api = (apiIndex >= 0 && argv[apiIndex + 1]
  ? argv[apiIndex + 1]
  : "https://unisquads.vercel.app/api").replace(/\/$/, "");
if (!sampleFile) {
  console.error("사용법: node scripts/record-refinement-corpus.mjs <표본.json> [--api <주소>]");
  process.exit(2);
}

// resolve/검증이 실제로 읽는 필드만 남긴다(응답 크기 관리).
const KEEP = [
  "admCd", "rnMgtSn", "bdMgtSn", "jibunAddr", "roadAddr", "roadAddrPart1",
  "bdNm", "bdKdcd", "detBdNmList", "lnbrMnnm", "lnbrSlno", "mtYn",
  "buldMnnm", "buldSlno", "siNm", "sggNm", "emdNm", "liNm", "relJibun"
];
const slim = (item) => {
  const out = {};
  for (const key of KEEP) if (item?.[key] !== undefined) out[key] = item[key];
  return out;
};

async function jusoSearch(keyword) {
  const res = await fetch(`${api}/juso?keyword=${encodeURIComponent(keyword)}`);
  if (!res.ok) throw new Error(`JUSO HTTP ${res.status}`);
  const data = await res.json();
  return (data?.juso || []).map(slim);
}

const sample = JSON.parse(await readFile(sampleFile, "utf8"));
let corpus;
try { corpus = JSON.parse(await readFile(OUT, "utf8")); }
catch { corpus = { note: "실측 JUSO 응답 — record-refinement-corpus.mjs로 녹음", rows: [] }; }
const existing = new Set(corpus.rows.map((row) => row.raw));

let added = 0;
let calls = 0;
for (const entry of sample) {
  const raw = String(entry.raw || "").trim();
  if (!raw || existing.has(raw)) continue;
  const queries = (entry.queries?.length
    ? entry.queries
    : [preprocess(raw)?.searchText].filter(Boolean));
  if (!queries.length) continue;
  const recorded = [];
  for (const q of queries) {
    try {
      recorded.push({ q, hits: await jusoSearch(q) });
      calls += 1;
    } catch (error) {
      console.error(`  녹음 실패(건너뜀): ${q} — ${error.message}`);
    }
    await new Promise((done) => setTimeout(done, 150));
  }
  if (!recorded.length) continue;
  corpus.rows.push({ raw, stratum: entry.stratum || "", queries: recorded });
  existing.add(raw);
  added += 1;
  if (added % 20 === 0) console.log(`  …${added}행 녹음`);
}

corpus.rows.sort((a, b) => a.raw.localeCompare(b.raw));
await writeFile(OUT, `${JSON.stringify(corpus)}\n`, "utf8");
console.log(`정제 코퍼스 갱신 — 행 ${corpus.rows.length}곳 (새로 추가 ${added}행, JUSO 호출 ${calls}회)`);
