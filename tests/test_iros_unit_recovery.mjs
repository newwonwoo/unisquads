import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  MATCHER_VERSION,
  rawUnitRecoveryVariants,
  selectUniqueRawUnitCandidate
} from "../public/unit-match.mjs";
import {
  markStaleIrosRows,
  needsDongAgnosticRematch,
  needsLotFallbackRematch
} from "../public/iros-run-contract.mjs";

const hos = (raw, unit) => rawUnitRecoveryVariants(raw, unit).map((v) => `${v.dong}/${v.ho}`);

test("층이 유실된 호를 층+호 결합으로 복구한다", () => {
  // 101동 3층1호를 호 "1"로만 읽으면 450세대 중 각 층 1호가 모두 걸린다(실측 136행).
  assert.deepEqual(
    hos("충북 청원군 내수읍 마산리 123외 진흥아파트 101동 3층1호", { dong: "101", ho: "1" }),
    ["101/301", "101/3-1", "101/3층1"]
  );
});

test("동이 없어도 층+호를 복구한다", () => {
  // 서울 구로구 가마산로 97, 11층 3호 (실측)
  assert.deepEqual(
    hos("서울 구로구 가마산로 97, 11층 3호 (구로동,현대로얄아파트)", { dong: "", ho: "3" }),
    ["/1103", "/11-3", "/11층3"]
  );
});

test("지하 표기는 등기부의 세 가지 표기를 모두 만든다", () => {
  const variants = hos("인천 남동구 남촌동 391-3 풍림아파트 상가동 1동 지하1-비02호", { dong: "1", ho: "02" });
  assert.equal(variants.includes("1/B102"), true);
  assert.equal(variants.includes("1/지102"), true);
  assert.equal(variants.includes("1/지하102"), true);
});

test("층 표기가 없으면 복구 후보를 만들지 않는다", () => {
  assert.deepEqual(hos("서울 강남구 역삼동 736-25 래미안 101동 608호", { dong: "101", ho: "608" }), []);
  assert.deepEqual(hos("", {}), []);
});

const cand = (unique_no, dong, ho) => ({ unique_no, dong, ho, real_cls_cd: "집합건물" });

test("표준 표기부터 차례로 보아 그 안에서 유일하면 채택한다", () => {
  // 301(표준)은 정확히 한 건인데, 다른 세대가 실제로 "3-1호"라는 이유만으로
  // 통째로 버려지던 것이 진흥아파트 136행의 원인이었다.
  const candidates = [cand("A", "101", "301"), cand("B", "101", "3-1")];
  const picked = selectUniqueRawUnitCandidate(
    candidates, "진흥아파트 101동 3층1호", { dong: "101", ho: "1" }
  );
  assert.equal(picked?.candidate.unique_no, "A");
  assert.equal(picked?.variant.ho, "301");
});

test("어느 변형에서도 유일하지 않으면 확정하지 않는다", () => {
  const candidates = [cand("A", "101", "301"), cand("B", "101", "301")];
  assert.equal(selectUniqueRawUnitCandidate(
    candidates, "진흥아파트 101동 3층1호", { dong: "101", ho: "1" }
  ), null);
});

const reg = (extra) => ({
  complete: true,
  collector_version: "iros-collector-v4",
  parser_version: "iros-parser-v4",
  matcher_version: "iros-matcher-v10",
  recovery_version: "iros-recovery-v5",
  ...extra
});

test("원문에 N동 표기가 없으면 추정 동을 무시하고 재매칭한다", () => {
  // "읍하리 442 서도아파트 102" → 동 101(그룹 전파 추정) 호 102 (실측 94행)
  const row = {
    raw: "강원 횡성군 횡성읍 읍하리 442 서도아파트 102",
    result: { status: "CONFIRMED", unit: { dong: "101", ho: "102" }, bdNm: "서도1차아파트" },
    reg: reg({ status: "REG_UNIT_NOT_FOUND", candidates: [cand("A", "", "102")] })
  };
  assert.equal(needsDongAgnosticRematch(row), true);
});

test("원문에 N동이 적혀 있으면 동을 무시하지 않는다", () => {
  const row = {
    raw: "강원 횡성군 횡성읍 읍하리 442 서도아파트 101동 102호",
    result: { status: "CONFIRMED", unit: { dong: "101", ho: "102" }, bdNm: "서도1차아파트" },
    reg: reg({ status: "REG_UNIT_NOT_FOUND", candidates: [cand("A", "", "102")] })
  };
  assert.equal(needsDongAgnosticRematch(row), false);
});

test("호로만 봐도 여러 건이면 재매칭 대상이 아니다", () => {
  const row = {
    raw: "강원 횡성군 횡성읍 읍하리 442 서도아파트 102",
    result: { status: "CONFIRMED", unit: { dong: "101", ho: "102" }, bdNm: "서도1차아파트" },
    reg: reg({ status: "REG_UNIT_NOT_FOUND", candidates: [cand("A", "", "102"), cand("B", "", "102")] })
  };
  assert.equal(needsDongAgnosticRematch(row), false);
});

test("확정 지번으로 후보가 전멸해도 같은 건물명이 남으면 재매칭한다", () => {
  // "어달동 12-1,2,5 묵호진동1-83" → 확정 묵호진동 1-83, 등기 소재지번은 다름 (실측 194행)
  const row = {
    raw: "강원 동해시 어달동 12-1,2,5 묵호진동1-83 101동 101호",
    result: { status: "CONFIRMED", unit: { dong: "101", ho: "101" }, bdNm: "삼본아파트" },
    reg: reg({
      status: "REG_VALIDATION_FAILED",
      failure_stage: "PROPERTY_CLASS",
      candidates: [{ unique_no: "B", dong: "101", ho: "101", buldnm: "삼본아파트", real_cls_cd: "집합건물" }]
    })
  };
  assert.equal(needsLotFallbackRematch(row), true);
});

test("건물명이 다른 후보뿐이면 재매칭하지 않는다", () => {
  const row = {
    raw: "강원 동해시 묵호진동 1-83 101동 101호",
    result: { status: "CONFIRMED", unit: { dong: "101", ho: "101" }, bdNm: "삼본아파트" },
    reg: reg({
      status: "REG_VALIDATION_FAILED",
      failure_stage: "PROPERTY_CLASS",
      candidates: [{ unique_no: "B", dong: "101", ho: "101", buldnm: "대동유치원", real_cls_cd: "집합건물" }]
    })
  };
  assert.equal(needsLotFallbackRematch(row), false);
});

test("이미 고유번호를 얻은 행은 재조회하지 않는다", () => {
  const rows = [
    { raw: "강원 횡성군 횡성읍 읍하리 442 서도아파트 102",
      result: { status: "CONFIRMED", unit: { dong: "101", ho: "102" }, bdNm: "서도1차아파트" },
      reg: reg({ status: "RESOLVED", unique_no: "1234" }) },
    { raw: "강원 횡성군 횡성읍 읍하리 442 서도아파트 103",
      result: { status: "CONFIRMED", unit: { dong: "101", ho: "103" }, bdNm: "서도1차아파트" },
      reg: reg({ status: "REG_UNIT_NOT_FOUND", candidates: [cand("A", "", "103")] }) }
  ];
  const marked = markStaleIrosRows(rows);
  assert.equal(marked[0].reg.stale, undefined);
  assert.equal(marked[1].reg.stale, true);
  assert.equal(marked[1].reg.stale_reason, "IROS_DONG_AGNOSTIC_REMATCH");
});

test("매처 버전을 올려 새 매칭 규칙이 실행 계약에 반영된다", async () => {
  assert.equal(MATCHER_VERSION, "iros-matcher-v11");
  const contract = await readFile(new URL("../public/iros-run-contract.mjs", import.meta.url), "utf8");
  assert.equal(contract.includes('matcher: "iros-matcher-v11"'), true);
});

test("app.js가 두 폴백을 매칭 경로에 연결한다", async () => {
  const source = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
  assert.equal(source.includes('applyModule("R-IROS-DONG-AGNOSTIC"'), true);
  assert.equal(source.includes('applyModule("R-IROS-LOT-FALLBACK"'), true);
  // 지번 폴백은 exact_lot 필터 직후, 부동산구분 판정 전이어야 한다.
  const fallback = source.indexOf('applyModule("R-IROS-LOT-FALLBACK"');
  const propertyClass = source.indexOf("filterUnitPropertyCandidates(cands");
  assert.equal(fallback < propertyClass, true);
});
