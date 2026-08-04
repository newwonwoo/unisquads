import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  buildFailureRecoveryPlan,
  classifyFailureModule,
  needsNaverPnuExactRecovery,
  selectIrosRecoveryAction
} from "../public/failure-recovery-plan.mjs";

const confirmed = (reg, raw = "서울 서초구 반포동 1 101동 101호") => ({
  raw,
  result: {
    status: "CONFIRMED",
    pnu: "1165010700100010000",
    isJip: true,
    unit: { dong: "101", ho: "101" }
  },
  reg
});

test("the recovery registry reports actual outcomes without forcing a target", () => {
  const rows = [
    confirmed({ status: "RESOLVED", unique_no: "1" }),
    {
      raw: "전남 순천시 용당동 431 용당피오레",
      result: { status: "NAVER_CONFIRMED_PNU_FAILED" }
    },
    confirmed({
      status: "REG_UNIT_NOT_FOUND",
      failure_stage: "UNIT",
      complete: true,
      candidates: [
        { unique_no: "RAW", real_cls_cd: "집합건물", dong: "501", ho: "101" }
      ]
    }, "경북 경주시 한동그린타운 501-101호"),
    { raw: "주소 근거 없음", result: { status: "FAILED" } }
  ];
  rows[2].result.unit = { dong: "", ho: "101" };

  const plan = buildFailureRecoveryPlan(rows);
  assert.equal(plan.total, 4);
  assert.equal(plan.addressConfirmed, 2);
  assert.equal(plan.finalResolved, 1);
  assert.equal(plan.unresolved, 3);
  assert.deepEqual(plan.dispositions, {
    AUTO_RETRY: 2,
    FAIL_UNIDENTIFIABLE: 1
  });
  assert.deepEqual(
    plan.modules.map(({ id, rows: count }) => [id, count]).sort(),
    [
      ["FAIL-SOURCE-UNIDENTIFIABLE", 1],
      ["R-ADDR-NAVER-PNU-EXACT", 1],
      ["R-IROS-RAW-UNIT", 1]
    ]
  );
});

test("an exhausted current matcher is a failed ambiguity, not an automatic recovery", () => {
  const row = confirmed({
    status: "REG_UNIT_NOT_FOUND",
    failure_stage: "UNIT",
    complete: true,
    candidates: []
  });
  assert.equal(classifyFailureModule(row).id, "FAIL-IROS-NO-UNIQUE-EVIDENCE");
  assert.equal(classifyFailureModule(row).automatic, false);
});

test("only evidence-backed failures enter automatic modules", () => {
  const naver = { result: { status: "NAVER_CONFIRMED_PNU_FAILED" } };
  assert.equal(needsNaverPnuExactRecovery(naver), true);
  assert.equal(needsNaverPnuExactRecovery({
    result: {
      status: "NAVER_CONFIRMED_PNU_FAILED",
      naverPnuRecoveryVersion: "1"
    }
  }), false);

  const row = confirmed({
    status: "REG_UNIT_NOT_FOUND",
    failure_stage: "UNIT",
    complete: true,
    candidates: [
      {
        unique_no: "RAW",
        real_cls_cd: "건물",
        dong: "501",
        ho: "101",
        unit_source: { ho: "buld_no_inner" }
      }
    ]
  }, "경북 경주시 한동그린타운 501-101호");
  row.result.unit = { dong: "", ho: "101" };
  assert.equal(selectIrosRecoveryAction(row)?.moduleId, "R-IROS-RAW-UNIT");

  row.reg.candidates[0].unit_source.ho = "detail_text";
  assert.equal(selectIrosRecoveryAction(row), null);
});

test("queryable address failures are routed instead of labeled unidentifiable", () => {
  const base = {
    status: "FAILED",
    addressRecoveryEvidence: {
      version: "address-requery-evidence-v1",
      evidence: "EXPLICIT_LEGAL_DONG_AND_LOT",
      query: "울산광역시 남구 삼산동 1498-3"
    }
  };
  assert.equal(classifyFailureModule({
    result: { ...base, addressRecoveryEvidence: { ...base.addressRecoveryEvidence, route: "LOT_EXACT_REQUERY" } }
  }).id, "R-ADDR-EXACT-LOT");
  assert.equal(classifyFailureModule({
    result: { ...base, addressRecoveryEvidence: { ...base.addressRecoveryEvidence, route: "ROAD_EXACT_REQUERY" } }
  }).id, "R-ADDR-EXACT-ROAD");
  assert.equal(classifyFailureModule({
    result: { ...base, addressRecoveryEvidence: { ...base.addressRecoveryEvidence, route: "BUILDING_REQUERY" } }
  }).id, "R-ADDR-BUILDING");
  assert.equal(classifyFailureModule({
    result: { ...base, addressRecoveryEvidence: { ...base.addressRecoveryEvidence, route: "UNIT_GROUP_REQUERY" } }
  }).id, "R-ADDR-UNIT-GROUP");
});

test("a locally recovered confirmed unit rematches only its previous input failure", () => {
  const row = confirmed({ status: "UNIT_INPUT_REQUIRED" });
  row.result.unit = { dong: "101", ho: "1002" };
  row.result.unitRecovery = {
    version: "1",
    evidence: "CONFIRMED_PNU_AND_EXPLICIT_TRAILING_UNIT"
  };

  assert.equal(
    selectIrosRecoveryAction(row)?.moduleId,
    "R-IROS-CONFIRMED-UNIT-INPUT"
  );
  assert.equal(classifyFailureModule(row).disposition, "AUTO_RETRY");

  delete row.result.unitRecovery;
  assert.equal(selectIrosRecoveryAction(row), null);
});

test("an ambiguous address with explicit room and bounded PNU candidates enters IROS probing", () => {
  const row = {
    raw: "서울 광진구 자양동 767-1 101동 1002호",
    result: {
      status: "AMBIGUOUS",
      unit: { dong: "101", ho: "1002" },
      candidates: [
        { pnu: "1121510500107670001", jibunAddr: "서울 광진구 자양동 767-1" },
        { pnu: "1121510500107670002", jibunAddr: "서울 광진구 자양동 767-2" }
      ]
    }
  };
  assert.equal(classifyFailureModule(row).id, "R-ADDR-AMBIGUOUS-PNU-IROS");
  row.result.pnuIrosEvidence = {
    version: "ambiguous-pnu-iros-v1",
    outcome: "AMBIGUOUS"
  };
  assert.equal(classifyFailureModule(row).id, "FAIL-ADDRESS-AMBIGUOUS");
});

test("the deployed app has no Kakao client, key, or endpoint call", async () => {
  const source = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
  for (const forbidden of [
    "/api/kakao",
    "KAKAO_REST_KEY",
    "kakaoKeyword",
    "kakaoCoord2Region",
    "config.kakaoKey"
  ]) {
    assert.equal(source.includes(forbidden), false, forbidden);
  }
});
