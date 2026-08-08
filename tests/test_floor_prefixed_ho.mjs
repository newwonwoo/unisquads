import assert from "node:assert/strict";
import test from "node:test";
import { selectFloorPrefixedHoCandidate } from "../public/unit-match.mjs";
import { decideUnitCandidates, decisionSignature } from "../public/unit-decision.mjs";
import { needsFloorPrefixedHoRematch } from "../public/failure-recovery-plan.mjs";

// 실측(구미 광평동 87-19, 2026-08-08 프로브): 원문은 "101동 2102호"인데
// 등기부는 "202호(층 2)"로 적는다. 원문이 층 + 1층 기준 호수(102)를 붙여
// 적었고, 등기부는 층 + 라인(02)으로 적는다 — 백의 자리 "1"이 원문에만 있다.
// 요청 16종(1102~8103)이 전부 1:1로 대응했고 층까지 일치했다.
const JIP = "집합건물";
const c = (unique_no, ho, floor, dong = "101") =>
  ({ unique_no, dong, ho, floor, buldnm: "", real_cls_cd: JIP });

// 1~8층 × 02·03 라인 (실측 형태를 줄인 것)
const POOL = [];
for (let f = 1; f <= 8; f += 1) {
  POOL.push(c(`GP-${f}02`, `${f}02`, String(f)));
  POOL.push(c(`GP-${f}03`, `${f}03`, String(f)));
}

test("층 + 1층 기준 호수를 등기부 층·라인 표기로 되돌린다 (광평동 실측)", () => {
  const picked = selectFloorPrefixedHoCandidate(POOL, "101", "2102");
  assert.equal(picked.candidate.unique_no, "GP-202");
  assert.equal(picked.matched_ho, "202");
  assert.equal(picked.matched_floor, "2");
  const decision = decideUnitCandidates({
    pool: POOL, wantDong: "101", wantHo: "8103",
    raw: "경북 구미시 광평동 87-19 101동 8103호", unit: { dong: "101", ho: "8103" }
  });
  assert.equal(decisionSignature(decision).startsWith("RESOLVED:GP-803"), true);
  assert.ok(decision.appliedModules.includes("R-IROS-FLOOR-PREFIXED-HO@1"));
});

test("기권 반례 — 중의성·백의자리·층 불일치·복수·동 불일치", () => {
  // 11층이 실재하면 "1102"는 11층 02호일 수 있다 → 기권 (핵심 안전장치)
  const withEleventh = [...POOL, c("GP-1102", "1102", "11")];
  assert.equal(selectFloorPrefixedHoCandidate(withEleventh, "101", "1102"), null);
  // 11층은 있는데 1102호가 없어도 중의적이므로 기권
  const eleventhOnly = [...POOL, c("GP-1101", "1101", "11")];
  assert.equal(selectFloorPrefixedHoCandidate(eleventhOnly, "101", "1102"), null);
  // 백의 자리가 1이 아니면 발화하지 않는다("1408호"류를 건드리지 않는다)
  assert.equal(selectFloorPrefixedHoCandidate(
    [...POOL, c("X", "408", "4")], "101", "1408"), null);
  // 변환 결과의 층이 원문 첫 자리와 다르면 기권
  const wrongFloor = [c("W", "202", "5")];
  assert.equal(selectFloorPrefixedHoCandidate(wrongFloor, "101", "2102"), null);
  // 층이 비어 있으면(층 정합성 검사 불가) 기권
  const noFloor = [c("N", "202", "")];
  assert.equal(selectFloorPrefixedHoCandidate(noFloor, "101", "2102"), null);
  // 변환 결과가 복수면 기권
  const dup = [c("D1", "202", "2"), c("D2", "202", "2", "102")];
  assert.equal(selectFloorPrefixedHoCandidate(dup, "", "2102"), null);
  // 요청 동과 다른 동의 후보는 쓰지 않는다
  assert.equal(selectFloorPrefixedHoCandidate(POOL, "999", "2102"), null);
  // 4자리가 아니면 발화하지 않는다
  assert.equal(selectFloorPrefixedHoCandidate(POOL, "101", "202"), null);
});

test("정확 매칭이 있으면 사다리가 이 모듈까지 내려오지 않는다", () => {
  const pool = [c("EXACT", "2102", "21"), ...POOL];
  const decision = decideUnitCandidates({
    pool, wantDong: "101", wantHo: "2102", raw: "x 101동 2102호",
    unit: { dong: "101", ho: "2102" }
  });
  assert.equal(decisionSignature(decision).startsWith("RESOLVED:EXACT"), true);
  assert.equal(decision.appliedModules.includes("R-IROS-FLOOR-PREFIXED-HO@1"), false);
});

test("재판정 승격 — 층 접두 해석이 유일할 때만, 성공·불완전 행 제외", () => {
  const row = {
    raw: "경북 구미시 광평동 87-19 101동 3103호",
    result: { unit: { dong: "101", ho: "3103" } },
    reg: { status: "REG_UNIT_NOT_FOUND", complete: true, candidates: POOL }
  };
  assert.equal(needsFloorPrefixedHoRematch(row), true);
  assert.equal(needsFloorPrefixedHoRematch({ ...row, reg: { ...row.reg, status: "RESOLVED" } }), false);
  assert.equal(needsFloorPrefixedHoRematch({ ...row, reg: { ...row.reg, complete: false } }), false);
  assert.equal(needsFloorPrefixedHoRematch({
    ...row, reg: { ...row.reg, candidates: [...POOL, c("E11", "1101", "11")] },
    result: { unit: { dong: "101", ho: "1102" } }
  }), false);
});
