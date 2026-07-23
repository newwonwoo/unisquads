import assert from "node:assert/strict";
import test from "node:test";
import { parseCompactAlphaUnit } from "../public/address-quality-rules.mjs";

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

test("확정 지번 뒤 건물명 말미 3~4자리 숫자를 호로 구조화한다", () => {
  const a = parseCompactAlphaUnit("부산 금정구 남산동 9 우남이채롬 108");
  assert.equal(a.ho, "108");
  assert.equal("부산 금정구 남산동 108 우남이채롬 108".replace(a.matched, " ").includes("남산동 108 우남이채롬"), true);
  assert.equal(a.evidence, "explicit_lot_building_trailing_ho");
  const b = parseCompactAlphaUnit("서울 노원구 공릉동 123-4 서일이츠뷰 302");
  assert.equal(b.ho, "302");
});

test("지번 미확정·세대수·면적·연도 표현은 호로 보지 않는다", () => {
  assert.equal(parseCompactAlphaUnit("서울 노원구 공릉동 서일이츠뷰 302"), null);
  assert.equal(parseCompactAlphaUnit("서울 노원구 공릉동 123-4 서일이츠뷰 총 302세대"), null);
  assert.equal(parseCompactAlphaUnit("서울 노원구 공릉동 123-4 서일이츠뷰 전용 302"), null);
});
