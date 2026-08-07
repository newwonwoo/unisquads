import assert from "node:assert/strict";
import test from "node:test";
import {
  IROS_COLLECTION_REPAIR_VERSION,
  isMalformedCollection,
  isMalformedCollectionResult,
  planMalformedCollectionRecovery
} from "../public/iros-collection-repair.mjs";
import { isReusableIrosResult } from "../public/iros-run-contract.mjs";
import { selectIrosRecoveryAction } from "../public/failure-recovery-plan.mjs";

// 실측(2026-08-07): "전북특별자치도 익산시 모현동1가 648-6 이한APT" 조회가
// 총건수 없이 0건을 세 번 연속 돌려줬다. 재시도로 풀리지 않는 응답이다.
const MALFORMED = {
  complete: false, total_count: null, raw_received_count: 0, received_count: 0
};

test("총건수 없이 0건인 응답만 형식이상으로 본다", () => {
  assert.equal(isMalformedCollection(MALFORMED), true);
  assert.equal(isMalformedCollection({ ...MALFORMED, total_count: undefined }), true);
  // 진짜 부분응답(총건수는 왔고 일부 수신)은 재시도 대상 그대로 둔다
  assert.equal(isMalformedCollection(
    { complete: false, total_count: 208, raw_received_count: 100 }), false);
  // 총건수는 없지만 무언가 받았으면 형식이상이 아니다
  assert.equal(isMalformedCollection(
    { complete: false, total_count: null, raw_received_count: 5 }), false);
  // 완전수집은 대상이 아니다
  assert.equal(isMalformedCollection(
    { complete: true, total_count: 20, raw_received_count: 20 }), false);
  assert.equal(isMalformedCollection(null), false);
});

test("형식이상 행은 재조회 대상에서 빠져 무한 재시도가 끝난다", () => {
  const reg = {
    status: "REG_PARTIAL_RESPONSE", complete: false, collection_malformed: true
  };
  assert.equal(isMalformedCollectionResult(reg), true);
  // 핵심 계약: 재사용 가능 = 이번 실행의 조회 대상이 아니다
  assert.equal(isReusableIrosResult(reg), true);
  // 재시도 계획도 만들지 않는다(계획이 있으면 stale로 승격돼 다시 큐에 들어간다)
  assert.equal(selectIrosRecoveryAction({ reg }), null);

  // 같은 상태라도 형식이상 표식이 없으면 기존대로 재시도 대상이다
  const genuine = { status: "REG_PARTIAL_RESPONSE", complete: false, total_count: 208 };
  assert.equal(isReusableIrosResult(genuine), false);
  assert.equal(selectIrosRecoveryAction({ reg: genuine })?.staleReason, "IROS_INCOMPLETE_RETRY");
});

test("대체지번 복구가 걸린 형식이상 행은 그 경로가 계속 담당한다", () => {
  const pending = {
    status: "REG_PARTIAL_RESPONSE", collection_malformed: true,
    recovery_pending: true, recovery_addresses: ["전북특별자치도 익산시 모현동1가 648-5"]
  };
  // 복구 대기 행은 조회 대상으로 남는다(대체지번을 아직 안 봤다).
  // 이 행은 배치의 대체지번 큐가 가져가므로 무한 재시도가 아니다.
  assert.equal(isReusableIrosResult(pending), false);
  assert.notEqual(selectIrosRecoveryAction({ reg: pending }), null);

  // 대체지번을 이미 다 보고도 형식이상으로 끝난 행은 재시도하지 않는다
  const exhausted = {
    status: "REG_PARTIAL_RESPONSE", collection_malformed: true,
    recovery_pending: false, recovery_attempted: true
  };
  assert.equal(isReusableIrosResult(exhausted), true);
  assert.equal(selectIrosRecoveryAction({ reg: exhausted }), null);
});

test("원문에 명시된 같은 법정동 대체지번으로 넘긴다", () => {
  // 실측 원문: 648-5, 648-8이 명시돼 있고 확정 지번은 648-6이다.
  // 두 지번 모두 B동 302호를 같은 고유번호로 정확 매칭한다(프로브 확인).
  const plan = planMalformedCollectionRecovery(
    { raw: "전북 익산시 모현동1가 530~800 648-5,648-8 비동302호" },
    "전북특별자치도 익산시 모현동1가 648-6 이한APT"
  );
  assert.equal(plan.version, IROS_COLLECTION_REPAIR_VERSION);
  assert.deepEqual(plan.addresses, [
    "전북특별자치도 익산시 모현동1가 648-5 이한APT",
    "전북특별자치도 익산시 모현동1가 648-8 이한APT"
  ]);
  // 명시 지번이 없으면 넘길 곳이 없다 — 종결 실패로 남는다
  assert.equal(planMalformedCollectionRecovery(
    { raw: "전북 익산시 모현동1가 648-6 비동302호" },
    "전북특별자치도 익산시 모현동1가 648-6 이한APT"
  ), null);
});

test("app.js가 형식이상 응답을 표시하고 대체지번 경로에 연결한다", async () => {
  const { readFile } = await import("node:fs/promises");
  const source = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
  assert.equal(source.includes("collection_malformed: malformed"), true);
  // 대체지번 큐 진입 조건에 형식이상이 포함돼야 한다
  assert.equal(
    source.includes('reg.status === "REG_UNIT_NOT_FOUND" || isMalformedCollectionResult(reg)'),
    true
  );
});
