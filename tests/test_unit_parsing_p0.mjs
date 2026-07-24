import assert from "node:assert/strict";
import test from "node:test";
import { parseCompactAlphaUnit } from "../public/address-quality-rules.mjs";
import { attachPipelineMetadata } from "../public/pipeline-contract.mjs";

test("층과 호를 실제 호수로 조합한다", () => {
  assert.deepEqual(parseCompactAlphaUnit("서울 강남구 역삼동 1 101동 3층1호"), {
    dong: "101", floor: "3", ho: "301", matched: " 101동 3층1호", index: 12, evidence: "dong_floor_ho_composed"
  });
  assert.equal(parseCompactAlphaUnit("101동 5층12호").ho, "512");
  assert.equal(parseCompactAlphaUnit("101동 11층3호").ho, "1103");
});

test("이미 완성된 호수는 다시 조합하지 않는다", () => {
  assert.equal(parseCompactAlphaUnit("101동 11층1103호").ho, "1103");
  assert.equal(parseCompactAlphaUnit("3층301호").ho, "301");
});

test("건물명 뒤 단독 숫자는 전처리 단계에서 확정하지 않는다", () => {
  assert.equal(parseCompactAlphaUnit("부산 금정구 남산동 9 우남이채롬 108"), null);
  assert.equal(parseCompactAlphaUnit("서울 노원구 공릉동 123-4 서일이츠뷰 302"), null);
});

test("PNU 확정 뒤에만 건물명 말미 3~4자리 숫자를 호로 승격한다", () => {
  const confirmed = attachPipelineMetadata(
    { raw: "부산 금정구 남산동 9 우남이채롬 108" },
    { status: "CONFIRMED", pnu: "2641010900100090000", unit: { dong: null, ho: null } }
  );
  assert.equal(confirmed.unit.ho, "108");
  assert.equal(confirmed.unitRecovery.kind, "confirmed_pnu_building_trailing_ho");

  const notConfirmed = attachPipelineMetadata(
    { raw: "부산 금정구 남산동 9 우남이채롬 108" },
    { status: "AMBIGUOUS", pnu: "", unit: { dong: null, ho: null } }
  );
  assert.equal(notConfirmed.unit.ho, null);
  assert.equal(notConfirmed.unitRecovery, undefined);
});

test("세대수·면적·연도 표현은 PNU가 있어도 호로 보지 않는다", () => {
  for (const raw of [
    "서울 노원구 공릉동 123-4 서일이츠뷰 총 302세대",
    "서울 노원구 공릉동 123-4 서일이츠뷰 전용 302",
    "서울 노원구 공릉동 123-4 서일이츠뷰 2026년"
  ]) {
    const result = attachPipelineMetadata(
      { raw },
      { status: "CONFIRMED", pnu: "1135010300101230004", unit: { dong: null, ho: null } }
    );
    assert.equal(result.unit.ho, null);
    assert.equal(result.unitRecovery, undefined);
  }
});
