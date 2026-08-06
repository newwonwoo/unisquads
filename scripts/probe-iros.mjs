#!/usr/bin/env node
// 실제 등기 브리지에 직접 붙어 완전후보를 받아 보고, 그 후보로 세대매칭이
// 어떻게 판정되는지 그대로 보여준다. 앱이 하는 것과 같은 호출·같은 판정이다.
//
// 앱은 화면에 "세대미일치"라고만 적고 끝난다. 이 스크립트는 등기부가 실제로
// 어떤 동·호 표기를 쓰는지, 어느 단계에서 후보가 잘리는지를 보여준다.
//
//   node scripts/probe-iros.mjs "강원 동해시 묵호진동 1-83 삼본아파트" --dong 101 --ho 101
//   node scripts/probe-iros.mjs "..." --bdnm 삼본아파트 --bridge http://localhost:8899
//   node scripts/probe-iros.mjs --file cases.txt          한 줄에 하나씩
//   node scripts/probe-iros.mjs "..." --save out.json     받은 후보를 그대로 저장
//   node scripts/probe-iros.mjs "..." --raw               후보 원본을 전부 출력
//
// 브리지 주소는 --bridge, 없으면 IROS_BRIDGE 환경변수, 그래도 없으면
// http://localhost:8899 를 쓴다. 인증키는 --key 또는 IROS_RESOLVER_KEY.

import { readFile, writeFile } from "node:fs/promises";
import {
  candidateHasNoDong,
  candidateMatchesAddressLot,
  candidateMatchesUnit,
  candidateUnitVariants,
  buildingKey,
  filterUnitPropertyCandidates,
  rawUnitRecoveryVariants,
  selectDongAgnosticHoCandidate,
  selectUniqueRawUnitCandidate,
  unitKey
} from "../public/unit-match.mjs";

const argv = process.argv.slice(2);
const flag = (name, fallback = "") => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : fallback;
};
const has = (name) => argv.includes(`--${name}`);

const BRIDGE = (flag("bridge") || process.env.IROS_BRIDGE || "http://localhost:8899")
  .replace(/\/$/, "");
const KEY = flag("key") || process.env.IROS_RESOLVER_KEY || "";
const TIMEOUT_MS = Number(flag("timeout", "120000"));

const positional = argv.filter((a, i) =>
  !a.startsWith("--") && (i === 0 || !argv[i - 1].startsWith("--") || has(a)));
const inlineAddr = argv.find((a) => !a.startsWith("--") &&
  argv.indexOf(a) === 0) || (argv[0]?.startsWith("--") ? "" : argv[0] || "");

async function loadTargets() {
  const file = flag("file");
  if (file) {
    const text = await readFile(file, "utf8");
    return text.split("\n").map((line) => line.trim()).filter(Boolean)
      .filter((line) => !line.startsWith("#"))
      .map(parseLine);
  }
  if (!inlineAddr) {
    console.error("조회할 주소를 주세요.\n");
    console.error('  node scripts/probe-iros.mjs "강원 동해시 묵호진동 1-83 삼본아파트" --dong 101 --ho 101');
    console.error("  node scripts/probe-iros.mjs --file cases.txt");
    process.exit(2);
  }
  return [{ addr: inlineAddr, dong: flag("dong"), ho: flag("ho"), bdnm: flag("bdnm") }];
}

// "주소 | 동 | 호 | 건물명" — 뒤 세 개는 생략 가능
function parseLine(line) {
  const [addr, dong = "", ho = "", bdnm = ""] = line.split("|").map((x) => x.trim());
  return { addr, dong, ho, bdnm };
}

async function resolve({ addr, dong, ho, bdnm }) {
  const params = new URLSearchParams({ addr, strategy: "full" });
  if (dong) params.set("dong", dong);
  if (ho) params.set("ho", ho);
  if (bdnm) params.set("bdnm", bdnm);
  const url = `${BRIDGE}/resolve?${params}`;
  const started = Date.now();
  const response = await fetch(url, {
    headers: KEY ? { "X-Resolver-Key": KEY } : {},
    signal: AbortSignal.timeout(TIMEOUT_MS)
  });
  const data = await response.json();
  return { data, ms: Date.now() - started, url };
}

const tally = (values) => {
  const counts = new Map();
  for (const value of values) counts.set(value, (counts.get(value) || 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
};
const show = (value) => value === "" ? '""(비어 있음)' : String(value);
const brief = (pairs, limit = 6) => pairs.slice(0, limit)
  .map(([value, n]) => `${show(value)}×${n}`).join("  ") +
  (pairs.length > limit ? `  … 외 ${pairs.length - limit}종` : "");

function describe(candidates) {
  console.log("\n[등기부가 실제로 쓰는 표기]");
  console.log(`  소재지   ${brief(tally(candidates.map((c) => c.sojae || "")), 3)}`);
  console.log(`  건물명   ${brief(tally(candidates.map((c) => c.buldnm || "")), 4)}`);
  console.log(`  구분     ${brief(tally(candidates.map((c) => c.real_cls_cd || c.gubun || "")))}`);
  console.log(`  동       ${brief(tally(candidates.map((c) => c.dong || "")))}`);
  const hos = candidates.map((c) => c.ho || "").filter(Boolean);
  console.log(`  호 예시  ${hos.slice(0, 12).join(", ")}${hos.length > 12 ? " …" : ""}`);
  const states = tally(candidates.map((c) => c.state || ""));
  if (states.length > 1) console.log(`  상태     ${brief(states)}`);
}

// 앱의 매칭 단계를 같은 순서로 재현해, 어디서 후보가 잘리는지 보여준다.
function diagnose(candidates, target) {
  const wantDong = unitKey(target.dong, "dong");
  const wantHo = unitKey(target.ho, "ho");
  if (!wantDong && !wantHo) {
    console.log("\n[매칭 판정] 동·호를 주지 않아 건너뜁니다. --dong/--ho를 주면 판정까지 봅니다.");
    return;
  }
  console.log(`\n[매칭 판정] 동 ${show(wantDong)} 호 ${show(wantHo)} 요청`);

  let cands = candidates.filter((c) => !String(c.state || "").includes("폐쇄"));
  console.log(`  1. 폐쇄 제외              ${cands.length}건`);

  const beforeLot = cands;
  cands = cands.filter((c) => candidateMatchesAddressLot(c, target.addr));
  console.log(`  2. 확정 지번 일치         ${cands.length}건` +
    (cands.length === 0 && beforeLot.length ? "   ← 여기서 전멸" : ""));
  if (!cands.length && beforeLot.length && target.bdnm) {
    const wanted = buildingKey(target.bdnm);
    const same = beforeLot.filter((c) => buildingKey(c.buldnm) === wanted);
    if (same.length) {
      cands = same;
      console.log(`     R-IROS-LOT-FALLBACK 으로 건물명 일치 후보 복구 → ${cands.length}건`);
    }
  }

  const variants = rawUnitRecoveryVariants(target.raw || target.addr, { dong: wantDong, ho: wantHo });
  const typed = filterUnitPropertyCandidates(cands, wantDong, wantHo, variants);
  console.log(`  3. 부동산구분(집합건물)   ${typed.candidates.length}건` +
    (typed.verified ? "" : "   ← 여기서 REG_VALIDATION_FAILED"));
  if (!typed.verified) return;
  const pool = typed.candidates;

  const exact = pool.filter((c) => candidateMatchesUnit(c, wantDong, wantHo));
  console.log(`  4. 동·호 정확 매칭        ${exact.length}건`);
  if (exact.length === 1) return pick("정확 매칭", exact[0]);
  if (exact.length > 1) {
    console.log(`     → REG_MULTI (복수결과)`);
    exact.slice(0, 5).forEach((c) => console.log(`        ${c.unique_no}  ${c.dong || "-"}동 ${c.ho}호`));
    return;
  }

  if (pool.every((c) => candidateHasNoDong(c)) && pool.some((c) => unitKey(c.ho, "ho"))) {
    const hoOnly = pool.filter((c) => candidateMatchesUnit(c, "", wantHo));
    console.log(`  5. 단일동 건물 호 매칭    ${hoOnly.length}건`);
    if (hoOnly.length === 1) return pick("단일동 호 매칭", hoOnly[0]);
  }

  if (variants.length) {
    console.log(`  6. 원문 표기 복구 변형    ${variants.map((v) => `${v.dong || "-"}/${v.ho}`).join(", ")}`);
    const recovered = selectUniqueRawUnitCandidate(pool, target.raw || target.addr,
      { dong: wantDong, ho: wantHo });
    if (recovered?.candidate) {
      return pick(`R-IROS-RAW-UNIT (${recovered.variant.ho})`, recovered.candidate);
    }
    console.log("     → 어느 변형도 한 건으로 좁혀지지 않음");
  }

  const relaxed = selectDongAgnosticHoCandidate(pool, wantDong, wantHo);
  if (relaxed?.candidate) {
    console.log(`  7. 등기부에 ${wantDong}동 없음 (있는 동: ${relaxed.candidate_dongs.map(show).join(", ")})`);
    return pick("R-IROS-DONG-AGNOSTIC-HO", relaxed.candidate);
  }

  console.log("  → REG_UNIT_NOT_FOUND (완전 후보에서 일치 세대 없음)");
  const sameHo = pool.filter((c) => unitKey(c.ho, "ho") === wantHo);
  if (sameHo.length) {
    console.log(`     참고: 호 ${wantHo}인 세대는 ${sameHo.length}건 있다 —`);
    sameHo.slice(0, 5).forEach((c) =>
      console.log(`        ${c.unique_no}  동 ${show(c.dong || "")} 호 ${c.ho}  ${c.buldnm || ""}`));
  }
}

function pick(how, candidate) {
  console.log(`  ✓ 확정  ${candidate.unique_no}   (${how})`);
  console.log(`          동 ${show(candidate.dong || "")} 호 ${candidate.ho}  ${candidate.buldnm || ""}`);
  console.log(`          ${candidate.sojae || ""}`);
  return candidate;
}

// ── 실행 ────────────────────────────────────────────────────────────────
const targets = await loadTargets();
console.log(`브리지 ${BRIDGE}${KEY ? " (인증키 사용)" : ""}`);
const saved = [];

for (const target of targets) {
  console.log(`\n${"─".repeat(72)}`);
  console.log(`▸ ${target.addr}` +
    (target.dong || target.ho ? `   동 ${target.dong || "-"} 호 ${target.ho || "-"}` : "") +
    (target.bdnm ? `   건물 ${target.bdnm}` : ""));

  let result;
  try {
    result = await resolve(target);
  } catch (error) {
    console.log(`  ✕ 브리지 응답 없음 — ${error.message}`);
    console.log(`     브리지가 떠 있는지, --bridge 주소가 맞는지 확인하세요.`);
    continue;
  }

  const { data, ms } = result;
  const candidates = data.all_candidates || data.candidates || [];
  console.log(`  응답 ${ms}ms · status ${data.status || "?"} · 총 ${data.total_count ?? "?"}` +
    ` / 파싱 ${data.parsed_count ?? "?"} / 고유 ${data.unique_candidate_count ?? candidates.length}` +
    ` / 완전 ${data.complete === true ? "Y" : "N"}`);
  if (data.parse_error_count) console.log(`  ⚠ 파싱 실패 ${data.parse_error_count}건`);
  if (!candidates.length) {
    console.log("  후보 0건 — 등기 소재지가 이 주소와 다르거나, 조회 문구가 맞지 않습니다.");
    if (data.message) console.log(`  메시지: ${data.message}`);
    saved.push({ target, data });
    continue;
  }

  describe(candidates);
  diagnose(candidates, target);
  if (has("raw")) {
    console.log("\n[후보 원본]");
    candidates.forEach((c) => console.log("  " + JSON.stringify(c)));
  }
  saved.push({ target, data });
}

const savePath = flag("save");
if (savePath) {
  await writeFile(savePath, JSON.stringify(saved, null, 2));
  console.log(`\n받은 응답을 ${savePath} 에 저장했습니다.`);
  console.log("이 파일의 후보를 scripts/iros-e2e-cases.mjs 케이스에 넣으면 E2E가 실측값으로 돕니다.");
}
