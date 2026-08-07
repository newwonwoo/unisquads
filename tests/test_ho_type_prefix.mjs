import assert from "node:assert/strict";
import test from "node:test";
import { candidateUnitVariants } from "../public/unit-match.mjs";
import { decideUnitCandidates, decisionSignature } from "../public/unit-decision.mjs";
import { needsHoTypePrefixRematch } from "../public/failure-recovery-plan.mjs";

// 실측(논현유호엔시티 1·2단지, 2026-08-08 프로브): 등기부가 호에 부동산
// 유형을 접두한다 — 동 "101" 호 "아파트201", 동 "104" 호 "오피스텔202".
// 아파트 접두는 101·102·103동에만, 오피스텔 접두는 104·105동에만 있었고
// (동, 접두 벗긴 호)는 전부 유일했다(실측 28행).
const JIP = "집합건물";
const c = (unique_no, dong, ho) => ({ unique_no, dong, ho, real_cls_cd: JIP });

test("후보 호의 유형 접두를 벗긴 변형이 생긴다 — 실측 두 유형어만", () => {
  const apt = candidateUnitVariants({ dong: "101", ho: "아파트201" });
  assert.ok(apt.some((v) => v.dong === "101" && v.ho === "201"));
  const off = candidateUnitVariants({ dong: "104", ho: "오피스텔1103" });
  assert.ok(off.some((v) => v.dong === "104" && v.ho === "1103"));
  // "상가101"은 상가동 의미와 얽히므로 벗기지 않는다
  const shop = candidateUnitVariants({ dong: "101", ho: "상가101" });
  assert.equal(shop.some((v) => v.ho === "101"), false);
  // 유형어 뒤에 숫자가 없으면 변형이 없다
  const bare = candidateUnitVariants({ dong: "101", ho: "아파트" });
  assert.equal(bare.some((v) => v.source === "ho_type_prefix"), false);
});

test("유형 접두 호가 (동,호) 정확 매칭으로 유일 확정된다 (논현 실측 형태)", () => {
  // 같은 호가 세 동에 하나씩 — 동을 쓰면 유일, 동무시로는 3건이라 못 풀던 형태
  const pool = [
    c("N-101-904", "101", "아파트904"),
    c("N-102-904", "102", "아파트904"),
    c("N-103-904", "103", "아파트904")
  ];
  const decision = decideUnitCandidates({
    pool, wantDong: "101", wantHo: "904", raw: "인천 남동구 논현동 66-24 논현유호엔시티 101동 904호"
  });
  assert.equal(decisionSignature(decision).startsWith("RESOLVED:N-101-904"), true);
  assert.ok(decision.appliedModules.some((m) => m.startsWith("IROS-CANDIDATE-NORMALIZE@")));
});

test("기권 반례 — 평문 호와 충돌하면 복수결과로 남긴다(암묵 확정 금지)", () => {
  const pool = [
    c("PLAIN", "201", "101"),
    c("TYPED", "201", "아파트101")
  ];
  const decision = decideUnitCandidates({
    pool, wantDong: "201", wantHo: "101", raw: "x 201동 101호"
  });
  assert.equal(decisionSignature(decision), "MULTI:2");
});

test("재매칭 승격 — 유형 접두 유일 매칭 행만, 성공 행은 제외", () => {
  const row = {
    raw: "인천 남동구 논현동 66-5 논현유호엔시티 201동 704호",
    result: { unit: { dong: "201", ho: "704" } },
    reg: { status: "REG_UNIT_NOT_FOUND", complete: true,
      candidates: [c("T", "201", "아파트704"), c("U", "201", "아파트705")] }
  };
  assert.equal(needsHoTypePrefixRematch(row), true);
  assert.equal(needsHoTypePrefixRematch({
    ...row, reg: { ...row.reg, status: "RESOLVED" }
  }), false);
  // 평문 매칭이 이미 가능한 행은 이 경로가 아니다
  assert.equal(needsHoTypePrefixRematch({
    ...row, reg: { ...row.reg, candidates: [c("P", "201", "704")] }
  }), false);
});
