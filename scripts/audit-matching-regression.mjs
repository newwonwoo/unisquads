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
import { decideUnitCandidates, decisionSignature } from "../public/unit-decision.mjs";
import { rawUnitRecoveryVariants } from "../public/unit-match.mjs";

const CORPUS = new URL("../tests/fixtures/iros-candidate-corpus.json", import.meta.url);
const BASELINE = new URL("../tests/fixtures/matching-baseline.json", import.meta.url);

const argv = process.argv.slice(2);
const has = (name) => argv.includes(`--${name}`);

// 코퍼스의 한 지번에서 감사할 요청 목록을 만든다.
//
// 실제 존재하는 조합만 넣으면 정확 매칭에서 전부 끝나 폴백 사다리(새 규칙이
// 사는 곳)가 한 번도 열리지 않는다. 그래서 빗나가는 요청도 함께 만든다.
// 후보(등기부 데이터)는 전부 실측이고, 요청만 실패 유형을 재현하도록 만든다.
//
//   1. 실제 (동, 호) 조합            정확 매칭 — 기존 확정이 뒤집히는지
//   2. 동 없이 호만                  단일동·상가동 배제 경로
//   3. 등기부에 없는 동 + 있는 호     동무시 매칭(R-IROS-DONG-AGNOSTIC-HO)
//   4. 원문에 층이 적힌 형태          층 유일화(R-IROS-FLOOR-DISAMBIG)
//   5. 있는 동 + 없는 호              미일치·프로파일 복구 경로
const MISS_DONG_SAMPLE = 3;   // 다른 지번에서 빌려올 "없는 동" 개수
const MISS_CASE_LIMIT = 40;   // 지번당 빗나감 요청 상한(감사 시간 관리)

function requestsFor(entry, otherDongs) {
  const candidates = entry.candidates;
  const dongs = new Set(
    candidates.map((c) => String(c?.dong ?? "").trim()).filter(Boolean)
  );
  const hos = [...new Set(
    candidates.map((c) => String(c?.ho ?? "").trim()).filter(Boolean)
  )];
  const base = entry.raw || entry.id;
  const seen = new Set();
  const out = [];
  const add = (dong, ho, raw) => {
    const key = `${dong}|${ho}|${raw}`;
    if (seen.has(key) || !ho) return;
    seen.add(key);
    out.push({ dong, ho, raw });
  };

  for (const candidate of candidates) {
    add(String(candidate?.dong ?? "").trim(), String(candidate?.ho ?? "").trim(), base);
  }
  for (const ho of hos) add("", ho, base);

  // 3. 이 지번에 없는 동. 다른 지번에 실제로 쓰인 표기를 빌려 쓴다.
  const missDongs = [...otherDongs].filter((d) => !dongs.has(d)).slice(0, MISS_DONG_SAMPLE);
  for (const dong of missDongs) {
    for (const ho of hos.slice(0, MISS_CASE_LIMIT)) {
      add(dong, ho, `${base} ${dong}동 ${ho}호`);
    }
  }

  // 4. 원문에 층이 적힌 형태. 등기부 floor 필드가 있는 후보에서만 만든다.
  for (const candidate of candidates.slice(0, MISS_CASE_LIMIT)) {
    const floor = String(candidate?.floor ?? "").trim();
    const ho = String(candidate?.ho ?? "").trim();
    if (!ho || !/^\d+$/.test(floor)) continue;
    const dong = String(candidate?.dong ?? "").trim();
    add(dong, ho, `${base} ${dong ? `${dong}동 ` : ""}${Number(floor)}층${ho}호`);
  }

  // 5. 있는 동 + 없는 호
  const missHo = String(
    Math.max(0, ...hos.map((h) => Number(h)).filter(Number.isFinite)) + 7777
  );
  for (const dong of [...dongs].slice(0, MISS_DONG_SAMPLE)) add(dong, missHo, base);

  // 6. 있는 동 × 있는 호인데 실제로는 짝이 아닌 조합.
  //    오확정이 생긴다면 바로 여기다 — "그 동에는 그 호가 없다"는 근거 있는
  //    사실을 무시하고 다른 동의 같은 호를 집어오는지 본다.
  const paired = new Set(
    candidates.map((c) => `${String(c?.dong ?? "").trim()}|${String(c?.ho ?? "").trim()}`)
  );
  let crossed = 0;
  for (const dong of dongs) {
    for (const ho of hos) {
      if (crossed >= MISS_CASE_LIMIT) break;
      if (paired.has(`${dong}|${ho}`)) continue;
      add(dong, ho, `${base} ${dong}동 ${ho}호`);
      crossed += 1;
    }
    if (crossed >= MISS_CASE_LIMIT) break;
  }

  return out.sort((a, b) =>
    a.dong.localeCompare(b.dong) || a.ho.localeCompare(b.ho) || a.raw.localeCompare(b.raw));
}

// 판정 한 건. raw는 요청이 지정한 원문을 쓴다 — 원문 표기 복구 규칙
// (층·중복 동 등)이 실제로 열리는 조건을 그대로 재현하기 위해서다.
function decideOne(entry, request) {
  const unit = { dong: request.dong, ho: request.ho };
  const raw = request.raw || entry.raw || "";
  return decideUnitCandidates({
    pool: entry.candidates,
    wantDong: request.dong,
    wantHo: request.ho,
    raw,
    unit,
    bdNm: entry.bdNm || "",
    subBuilding: null,
    rawUnitVariants: rawUnitRecoveryVariants(raw, unit)
  });
}

function buildReport(corpus) {
  // "이 지번에 없는 동"은 다른 지번에 실제로 쓰인 표기에서 빌려온다.
  const allDongs = new Set();
  for (const entry of corpus.lots) {
    for (const candidate of entry.candidates) {
      const dong = String(candidate?.dong ?? "").trim();
      if (dong) allDongs.add(dong);
    }
  }
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

const corpus = JSON.parse(await readFile(CORPUS, "utf8"));
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
