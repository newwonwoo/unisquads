import assert from "node:assert/strict";
import test from "node:test";
import {
  DONG_LOT_RELOCATE_VERSION,
  buildDongLotRelocatePlan,
  markDongLotRelocatePending,
  pickDongLotRelocateLot
} from "../public/dong-lot-relocate.mjs";

// 실측(창신타운, 2026-08-07 + 2026-08-07 재확인): JUSO 건물명 검색
// "경상북도 영천시 망정동 창신타운"의 실제 응답. 109·110동은 462-2에만 있다.
const JUSO_HITS = [
  { jibunAddr: "경상북도 영천시 망정동 471 창신타운", bdNm: "창신타운",
    bdKdcd: "0", detBdNmList: "상가동" },
  { jibunAddr: "경상북도 영천시 망정동 462-2 창신타운", bdNm: "창신타운",
    bdKdcd: "1", detBdNmList: "109동,110동" },
  { jibunAddr: "경상북도 영천시 망정동 471 창신타운", bdNm: "창신타운",
    bdKdcd: "1", detBdNmList: "102동,107동,108동,105동,106동,104동,103동,101동" },
  { jibunAddr: "경상북도 영천시 망정동 462-2 창신타운", bdNm: "창신타운",
    bdKdcd: "0", detBdNmList: "상가동" }
];

// 확정 지번 471의 등기부에는 101~108동뿐이다(실측 1,057건 요약).
const cand = (dong, ho) =>
  ({ unique_no: `C-${dong}-${ho}`, dong, ho, real_cls_cd: "집합건물" });
const failedRow = (over = {}) => ({
  result: {
    status: "CONFIRMED",
    jibunAddr: "경상북도 영천시 망정동 471 창신타운",
    bdNm: "창신타운",
    unit: { dong: "109", ho: "101" },
    ...over.result
  },
  reg: {
    status: "REG_UNIT_NOT_FOUND", complete: true,
    candidates: [cand("101", "101"), cand("102", "101"), cand("108", "1401")],
    ...over.reg
  }
});

test("요청 동이 등기부에 없고 JUSO가 다른 한 지번으로 매핑하면 재배치 계획이 선다", () => {
  const plan = buildDongLotRelocatePlan(failedRow());
  assert.ok(plan);
  assert.equal(plan.query, "경상북도 영천시 망정동 창신타운");
  assert.equal(plan.requestedDong, "109");
  assert.equal(plan.currentLotKey, "망정동|471");
  const picked = pickDongLotRelocateLot(JUSO_HITS, plan);
  assert.ok(picked);
  assert.equal(picked.lotAddress, "경상북도 영천시 망정동 462-2");
  const reg = markDongLotRelocatePending(failedRow().reg, plan, picked);
  assert.equal(reg.recovery_pending, true);
  assert.equal(reg.recovery_address, "경상북도 영천시 망정동 462-2");
  assert.equal(reg.dong_lot_relocate.version, DONG_LOT_RELOCATE_VERSION);
  assert.equal(reg.dong_lot_relocate.requested_dong, "109");
});

test("기권 반례 — 성공 행·불완전수집·동 실존·대체지번 선점·멱등", () => {
  // RESOLVED(성공) 행은 절대 대상이 아니다
  assert.equal(buildDongLotRelocatePlan(
    failedRow({ reg: { status: "RESOLVED", unique_no: "X", complete: true } })), null);
  // 완전수집이 아니면 "동이 없다"를 증명할 수 없다
  assert.equal(buildDongLotRelocatePlan(failedRow({ reg: { complete: false } })), null);
  // 요청 동이 이 지번 등기부에 실존하면 재배치가 아니라 호 단위 실패다
  assert.equal(buildDongLotRelocatePlan(failedRow({
    reg: { status: "REG_UNIT_NOT_FOUND", complete: true,
      candidates: [cand("109", "202"), cand("101", "101")] }
  })), null);
  // 명시 대체지번 복구가 이미 걸려 있으면 원문 명시 근거가 우선한다
  assert.equal(buildDongLotRelocatePlan(failedRow({
    reg: { status: "REG_UNIT_NOT_FOUND", complete: true, recovery_pending: true,
      candidates: [cand("101", "101")] }
  })), null);
  // 이미 재배치를 시도한 행은 다시 시도하지 않는다
  assert.equal(buildDongLotRelocatePlan(failedRow({
    reg: { status: "REG_UNIT_NOT_FOUND", complete: true,
      dong_lot_relocate: { version: DONG_LOT_RELOCATE_VERSION },
      candidates: [cand("101", "101")] }
  })), null);
  // 후보가 아예 없으면(수집 자체가 빈 지번) "없음"의 근거가 약해 기권
  assert.equal(buildDongLotRelocatePlan(failedRow({
    reg: { status: "REG_UNIT_NOT_FOUND", complete: true, candidates: [] }
  })), null);
  // 건물명이 없으면 JUSO 재검색의 근거가 없다
  assert.equal(buildDongLotRelocatePlan(failedRow({
    result: { status: "CONFIRMED", jibunAddr: "경상북도 영천시 망정동 471",
      bdNm: "", unit: { dong: "109", ho: "101" } }
  })), null);
});

test("기권 반례 — 지번 비유일·동일 지번·건물명 불일치", () => {
  const plan = buildDongLotRelocatePlan(failedRow());
  // 요청 동이 두 지번에 걸리면 기권
  const twoLots = [
    { jibunAddr: "경상북도 영천시 망정동 462-2 창신타운", bdNm: "창신타운", detBdNmList: "109동" },
    { jibunAddr: "경상북도 영천시 망정동 500 창신타운", bdNm: "창신타운", detBdNmList: "109동" }
  ];
  assert.equal(pickDongLotRelocateLot(twoLots, plan), null);
  // 요청 동이 현재 지번에만 있으면(등기부↔JUSO 불일치) 재조회해도 같은 결과다
  const sameLot = [
    { jibunAddr: "경상북도 영천시 망정동 471 창신타운", bdNm: "창신타운", detBdNmList: "109동" }
  ];
  assert.equal(pickDongLotRelocateLot(sameLot, plan), null);
  // 건물명이 다른 후보의 동 목록은 근거가 아니다
  const otherName = [
    { jibunAddr: "경상북도 영천시 망정동 462-2 다른타운", bdNm: "다른타운", detBdNmList: "109동" }
  ];
  assert.equal(pickDongLotRelocateLot(otherName, plan), null);
  // 아무 지번에도 요청 동이 없으면 기권
  const noDong = [
    { jibunAddr: "경상북도 영천시 망정동 471 창신타운", bdNm: "창신타운", detBdNmList: "101동,102동" }
  ];
  assert.equal(pickDongLotRelocateLot(noDong, plan), null);
});

test("app.js가 재배치 패스를 대체지번 큐에 연결한다", async () => {
  const { readFile } = await import("node:fs/promises");
  const source = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
  assert.equal(source.includes("buildDongLotRelocatePlan(row)"), true);
  assert.equal(source.includes("pickDongLotRelocateLot(hits, plan)"), true);
  assert.equal(source.includes("markDongLotRelocatePending(row.reg, plan, picked)"), true);
  assert.equal(source.includes("R-IROS-DONG-LOT-RELOCATE"), true);
});
