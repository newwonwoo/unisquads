import assert from "node:assert/strict";
import test from "node:test";
import { selectRawFloorHoCandidate } from "../public/unit-match.mjs";
import { decideUnitCandidates, decisionSignature } from "../public/unit-decision.mjs";
import { needsRawFloorHoRematch } from "../public/failure-recovery-plan.mjs";

// 실측(부평 갈산동 362 하나상가, 2026-08-08 프로브): 원문 "지1-1"을 전처리가
// 동1·호1로 읽는다. 등기부 하나상가는 동 없이 층(1~4·지하)×호이고, 요청
// 지3{1,2,3,4}=3층 정확일치·지4{1,2,3}=4층 정확일치로 "지X = X층" 대응이
// 확인됐다. 단 지하층에도 호 1~12가 있어 지1-N은 1층/지하 중의 — 기권 대상.
const JIP = "집합건물";
const c = (unique_no, ho, floor, buldnm = "하나상가") =>
  ({ unique_no, dong: "", ho, floor, buldnm, real_cls_cd: JIP });
const POOL = [
  c("H-1F-1", "1", "1"), c("H-1F-2", "2", "1"), c("H-1F-3", "3", "1"),
  c("H-2F-1", "1", "2"), c("H-2F-2", "2", "2"),
  c("H-3F-1", "1", "3"), c("H-3F-2", "2", "3"),
  c("H-4F-1", "1", "4"),
  c("H-B-1", "1", "지하"), c("H-B-2", "2", "지하"), c("H-B-12", "12", "지하")
];
const RAW = (unit) => `인천 부평구 갈산동 362 하나상가 ${unit}`;

test("지X-N을 X층 N호로 재해석해 유일 확정한다 (갈산 실측 형태)", () => {
  const picked = selectRawFloorHoCandidate(POOL, RAW("지3-2"), "3", "2");
  assert.equal(picked.candidate.unique_no, "H-3F-2");
  assert.equal(picked.matched_floor, "3");
  const decision = decideUnitCandidates({
    pool: POOL, wantDong: "3", wantHo: "2", raw: RAW("지3-2"),
    unit: { dong: "3", ho: "2" }
  });
  assert.equal(decisionSignature(decision).startsWith("RESOLVED:H-3F-2"), true);
  assert.ok(decision.appliedModules.includes("R-IROS-RAW-FLOOR-HO@1"));
});

test("기권 반례 — 지하 중의·건물명 불일치·패턴 부재·복수·출처 불일치", () => {
  // 지1-N: 지하층에 같은 호가 있으면 1층/지하1층 중의 — 기권 (실측 9행의 정답)
  assert.equal(selectRawFloorHoCandidate(POOL, RAW("지1-2"), "1", "2"), null);
  // 원문에 후보 건물명이 없으면 근거가 없다
  assert.equal(selectRawFloorHoCandidate(
    POOL, "인천 부평구 갈산동 362 다른건물 지3-2", "3", "2"), null);
  // 원문에 지X-N 패턴이 없으면 발화하지 않는다
  assert.equal(selectRawFloorHoCandidate(POOL, RAW("3동 2호"), "3", "2"), null);
  // 요청 (동,호)가 패턴의 출처가 아니면(다른 해석에서 온 값) 발화하지 않는다
  assert.equal(selectRawFloorHoCandidate(POOL, RAW("지3-2"), "101", "302"), null);
  // 같은 층·호 후보가 둘이면 기권
  const dup = [...POOL, c("H-3F-2b", "2", "3")];
  assert.equal(selectRawFloorHoCandidate(dup, RAW("지3-2"), "3", "2"), null);
  // 지하2층이 실존하는 건물의 지2-N은 중의 — 기권
  const withB2 = [...POOL, c("H-B2-1", "1", "지하2층")];
  assert.equal(selectRawFloorHoCandidate(withB2, RAW("지2-1"), "2", "1"), null);
});

test("정확 매칭이 있으면 사다리가 이 모듈까지 내려오지 않는다", () => {
  // 동3·호2가 평문으로 실존하는 다른 건물 — 정확 매칭이 먼저 닫힌다
  const pool = [
    { unique_no: "EXACT", dong: "3", ho: "2", floor: "1", buldnm: "하나상가", real_cls_cd: JIP },
    ...POOL
  ];
  const decision = decideUnitCandidates({
    pool, wantDong: "3", wantHo: "2", raw: RAW("지3-2"), unit: { dong: "3", ho: "2" }
  });
  assert.equal(decisionSignature(decision).startsWith("RESOLVED:EXACT"), true);
  assert.equal(decision.appliedModules.includes("R-IROS-RAW-FLOOR-HO@1"), false);
});

test("재매칭 승격 — 층-호 재해석 유일 행만, 성공·불완전 행 제외", () => {
  const row = {
    raw: RAW("지3-2"),
    result: { unit: { dong: "3", ho: "2" } },
    reg: { status: "REG_UNIT_NOT_FOUND", complete: true, candidates: POOL }
  };
  assert.equal(needsRawFloorHoRematch(row), true);
  assert.equal(needsRawFloorHoRematch({ ...row, reg: { ...row.reg, status: "RESOLVED" } }), false);
  assert.equal(needsRawFloorHoRematch({ ...row, reg: { ...row.reg, complete: false } }), false);
  const ambiguous = { ...row, raw: RAW("지1-2"),
    result: { unit: { dong: "1", ho: "2" } } };
  assert.equal(needsRawFloorHoRematch(ambiguous), false);
});
