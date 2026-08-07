#!/usr/bin/env node
// 회귀 방지 감사 — 매칭 규칙을 바꿀 때 기존 판정이 뒤집히는지 전수로 잰다.
//
// 왜 필요한가.
//   배치를 다시 돌려 결과 엑셀을 비교하는 방식으로는 회귀를 잴 수 없다.
//   확정된 행은 isProtectedIrosSuccess/isProtectedAddressSuccess가 잠가서
//   애초에 재평가되지 않기 때문이다. 그 비교의 "회귀 0건"은 "잠금이 작동했다"는
//   뜻이지 "새 규칙이 안전하다"는 뜻이 아니다.
//
// 무엇을 하는가.
//   실측 등기 후보 코퍼스(tests/fixtures/iros-candidate-corpus.json)의 모든
//   지번에서, 그 지번에 실제로 존재하는 모든 (동, 호) 조합을 요청으로 만들어
//   운영 판정 함수(public/unit-decision.mjs의 decideUnitCandidates)를 그대로
//   돌리고, 그 판정을 기준선과 비교한다. 하나라도 달라지면 실패한다.
//
//   잠금과 무관하게 "규칙이 바뀌면 판정이 어떻게 달라지는가"를 직접 본다.
//
// 사용법
//   node scripts/audit-matching-regression.mjs            비교(기본)
//   node scripts/audit-matching-regression.mjs --update    기준선 갱신
//   node scripts/audit-matching-regression.mjs --verbose   달라진 항목 전부 출력
//
// 기준선을 갱신할 때는 무엇이 왜 달라졌는지 커밋 메시지에 남긴다. 갱신은
// "이 판정 변화를 의도했다"는 선언이고, 리뷰에서 그 diff가 근거가 된다.

import { readFile, writeFile } from "node:fs/promises";
import { decisionSignature } from "../public/unit-decision.mjs";
import { allDongsOf, decideOne, loadCorpus, requestsFor } from "./audit-requests.mjs";

const BASELINE = new URL("../tests/fixtures/matching-baseline.json", import.meta.url);

const argv = process.argv.slice(2);
const has = (name) => argv.includes(`--${name}`);

function buildReport(corpus) {
  const allDongs = allDongsOf(corpus);
  const report = {};
  let cases = 0;
  for (const entry of corpus.lots) {
    const perLot = {};
    for (const request of requestsFor(entry, allDongs)) {
      const signature = decisionSignature(decideOne(entry, request));
      perLot[`${request.dong}|${request.ho}|${request.raw}`] = signature;
      cases += 1;
    }
    report[entry.id] = perLot;
  }
  return { report, cases };
}

const corpus = await loadCorpus();
const { report, cases } = buildReport(corpus);

if (has("update")) {
  await writeFile(BASELINE, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(`기준선 갱신 — 지번 ${corpus.lots.length}곳 / 판정 ${cases}건`);
  console.log("무엇이 왜 달라졌는지 커밋 메시지에 남기세요.");
  process.exit(0);
}

let baseline;
try {
  baseline = JSON.parse(await readFile(BASELINE, "utf8"));
} catch {
  console.error("기준선이 없습니다. 먼저 --update로 만드세요.");
  process.exit(2);
}

const changed = [];
const added = [];
const removed = [];
for (const [lotId, perLot] of Object.entries(report)) {
  const base = baseline[lotId];
  if (!base) { added.push(`${lotId} (지번 전체)`); continue; }
  for (const [request, signature] of Object.entries(perLot)) {
    if (!(request in base)) { added.push(`${lotId} ${request}`); continue; }
    if (base[request] !== signature) {
      changed.push({ lotId, request, before: base[request], after: signature });
    }
  }
  for (const request of Object.keys(base)) {
    if (!(request in perLot)) removed.push(`${lotId} ${request}`);
  }
}

console.log(`회귀 감사 — 지번 ${corpus.lots.length}곳 / 판정 ${cases}건`);

// 확정이 뒤집힌 것(RESOLVED였는데 달라짐)이 명백한 회귀다.
// 미확정이 확정으로 바뀐 것은 회수일 수도, 근거 없는 오확정일 수도 있다 —
// 자동으로 "개선"이라 부르지 않는다. 어느 쪽이든 기준선 갱신 없이는 통과하지
// 않으며, 갱신 전에 그 판정이 옳은지 실측으로 확인해야 한다.
const regressions = changed.filter((c) => c.before.startsWith("RESOLVED:"));
const newlyResolved = changed.filter((c) => !c.before.startsWith("RESOLVED:"));

if (!changed.length && !added.length && !removed.length) {
  console.log("✓ 판정 변화 없음 — 기존 확정 회귀 0건");
  process.exit(0);
}

if (regressions.length) {
  console.log(`\n✕ 기존 확정이 달라진 판정: ${regressions.length}건`);
  for (const c of (has("verbose") ? regressions : regressions.slice(0, 20))) {
    console.log(`  ${c.lotId}  요청[${c.request}]`);
    console.log(`      이전 ${c.before}`);
    console.log(`      이번 ${c.after}`);
  }
  if (!has("verbose") && regressions.length > 20) {
    console.log(`  … 외 ${regressions.length - 20}건 (--verbose로 전부 보기)`);
  }
}
if (newlyResolved.length) {
  console.log(
    `\n◉ 미확정 → 확정으로 바뀐 판정: ${newlyResolved.length}건` +
    "\n   (회수일 수도, 근거 없는 오확정일 수도 있습니다 — 표본을 실측으로 확인하세요)"
  );
  for (const c of (has("verbose") ? newlyResolved : newlyResolved.slice(0, 10))) {
    console.log(`  ${c.lotId}  요청[${c.request}]  ${c.before} → ${c.after}`);
  }
}
if (added.length) console.log(`\n＋ 코퍼스에 새로 생긴 판정: ${added.length}건`);
if (removed.length) console.log(`\n－ 코퍼스에서 사라진 판정: ${removed.length}건`);

console.log(
  "\n판정이 바뀌었습니다. 의도한 변화라면 그 근거를 확인한 뒤" +
  "\n  node scripts/audit-matching-regression.mjs --update" +
  "\n로 기준선을 갱신하고, 무엇이 왜 달라졌는지 커밋에 남기세요."
);
process.exit(1);
