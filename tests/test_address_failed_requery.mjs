import assert from "node:assert/strict";
import test from "node:test";
import {
  ADDRESS_FAILED_REQUERY_MODULES,
  buildAdminDongLotRequeryPlan,
  buildBuildingNameRequeryPlan,
  buildExcludedLotRequeryPlan,
  buildNaverLotRescueQuery,
  evaluateBuildingNameRequery,
  hasRegionalLotAddress,
  lotScopedText,
  needsNaverLotRescue,
  pickAdminDongLotCandidate,
  pickExcludedLotCandidate,
  pickNaverLotCandidate
} from "../public/address-failed-requery.mjs";
import { buildPnulessIrosPlan } from "../public/pnuless-iros.mjs";

// ── 건물명 재검색 (실측: 동별 필지 분리 상가 — 1동=1082, 6동=1086) ──────

const MARKET_HITS = [
  { jibunAddr: "인천광역시 남동구 만수동 1081-12 창대장터상가", bdNm: "창대장터상가", detBdNmList: "7동" },
  { jibunAddr: "인천광역시 남동구 만수동 1086 창대장터상가", bdNm: "창대장터상가", detBdNmList: "6동" },
  { jibunAddr: "인천광역시 남동구 만수동 1082 창대장터상가", bdNm: "창대장터상가", detBdNmList: "1동" },
  { jibunAddr: "인천광역시 남동구 만수동 1082-1 창대장터상가", bdNm: "창대장터상가", detBdNmList: "2동" },
  { jibunAddr: "인천광역시 남동구 만수동 1080 창대장터상가", bdNm: "창대장터상가", detBdNmList: "3동" }
];

test("건물명 재검색 계획은 실패 상태 + 건물명 + 지역이 있어야 만들어진다", () => {
  const pre = { sido: "인천", sgg: "남동구", emd: "만수동", bldName: "창대장터상가",
    unit: { dong: "1", ho: "110" } };
  const plan = buildBuildingNameRequeryPlan(pre, "HUMAN_INPUT_ERROR");
  assert.equal(plan.query, "인천 남동구 만수동 창대장터상가");
  assert.equal(plan.unitDong, "1");
  assert.equal(buildBuildingNameRequeryPlan(pre, "CONFIRMED"), null);
  assert.equal(buildBuildingNameRequeryPlan({ ...pre, bldName: "" }, "FAILED"), null);
  assert.equal(buildBuildingNameRequeryPlan(
    { ...pre, sido: "", sidoFull: "", sgg: "", eup: "", emd: "" }, "FAILED"), null);
});

test("detBdNmList의 동↔지번 매핑으로 원문 동이 실존하는 지번 하나를 고른다", () => {
  const plan = { buildingName: "창대장터상가", unitDong: "1" };
  const judged = evaluateBuildingNameRequery(MARKET_HITS, plan);
  assert.equal(judged.kind, "UNIT_DONG_LOT");
  assert.equal(judged.candidate.jibunAddr, "인천광역시 남동구 만수동 1082 창대장터상가");

  const six = evaluateBuildingNameRequery(MARKET_HITS, { ...plan, unitDong: "6" });
  assert.equal(six.candidate.jibunAddr, "인천광역시 남동구 만수동 1086 창대장터상가");
});

test("동을 못 좁히면 확정하지 않고 복수후보로만 승격한다", () => {
  // 등기부에 없는 9동 — 어느 지번인지 알 수 없다
  const judged = evaluateBuildingNameRequery(MARKET_HITS,
    { buildingName: "창대장터상가", unitDong: "9" });
  assert.equal(judged.kind, "MULTI");
  assert.equal(judged.candidates.length, 5);
  // 동 자체가 없어도 복수 지번이면 MULTI
  assert.equal(evaluateBuildingNameRequery(MARKET_HITS,
    { buildingName: "창대장터상가", unitDong: "" }).kind, "MULTI");
  // 건물명이 다르면 아예 손대지 않는다
  assert.equal(evaluateBuildingNameRequery(MARKET_HITS,
    { buildingName: "행복상가", unitDong: "1" }), null);
});

test("단일 지번 건물은 그 지번으로 확정한다", () => {
  const single = evaluateBuildingNameRequery([MARKET_HITS[1]],
    { buildingName: "창대장터상가", unitDong: "" });
  assert.equal(single.kind, "SINGLE_LOT");
  // 괄호 딸린 동 표기("124동(상가동)")도 동 토큰으로 읽는다
  const withParen = evaluateBuildingNameRequery(
    [{ jibunAddr: "전남광주통합특별시 순천시 용당동 748 용당피오레", bdNm: "용당피오레",
       detBdNmList: "102동, 112동, 124동(상가동)" }],
    { buildingName: "용당피오레", unitDong: "124" });
  assert.equal(withParen.kind, "UNIT_DONG_LOT");
});

// ── 용도불일치 배제 지번 재확인 (실측: 유치원이 대표로 잡힌 단지) ────────

const LOT_HITS = [
  { jibunAddr: "강원특별자치도 동해시 동회동 442 대동아파트, 동회동 현대아파트",
    bdNm: "대동아파트, 동회동 현대아파트" },
  { jibunAddr: "강원특별자치도 동해시 동회동 442 대동유치원", bdNm: "대동유치원" },
  { jibunAddr: "강원특별자치도 동해시 동회동 442 북삼코아루아파트", bdNm: "북삼코아루아파트" }
];

test("배제 지번 재확인은 같은 지번 + 원문 건물명 일치 한 건만 채택한다", () => {
  const plan = buildExcludedLotRequeryPlan({
    rejectedAddress: "강원특별자치도 동해시 동회동 442",
    buildingName: "대동아파트"
  });
  assert.equal(plan.query, "강원특별자치도 동해시 동회동 442");
  const picked = pickExcludedLotCandidate(LOT_HITS, plan, "대동유치원");
  assert.equal(picked.bdNm, "대동아파트, 동회동 현대아파트");
});

test("배제 지번 재확인이 거부하는 경우들", () => {
  const plan = buildExcludedLotRequeryPlan({
    rejectedAddress: "강원특별자치도 동해시 동회동 442",
    buildingName: "대동아파트"
  });
  // 배제됐던 건물명 그대로면 다시 고르지 않는다
  assert.equal(pickExcludedLotCandidate(
    [LOT_HITS[1]], { ...plan, buildingName: "대동유치원" }, "대동유치원"), null);
  // 다른 지번 후보는 세지 않는다
  assert.equal(pickExcludedLotCandidate(
    [{ jibunAddr: "강원특별자치도 동해시 동회동 443 대동아파트", bdNm: "대동아파트" }],
    plan, ""), null);
  // 일치 후보가 둘이면 확정하지 않는다
  assert.equal(pickExcludedLotCandidate(
    [LOT_HITS[0], { jibunAddr: "강원특별자치도 동해시 동회동 442 대동아파트2차", bdNm: "대동아파트2차" }],
    plan, ""), null);
  // 건물명 없는 계획은 만들어지지 않는다
  assert.equal(buildExcludedLotRequeryPlan(
    { rejectedAddress: "강원특별자치도 동해시 동회동 442", buildingName: "" }), null);
});

// ── 네이버 지번 구조 (실측: 지번 없는 신행정구역 주소만 온 단지) ─────────

const NAVER_ITEMS = [
  { title: "<b>용당동</b>대주<b>피오레</b>아파트", category: "주택>아파트",
    address: "전남광주통합특별시 순천시 용당동 748" },
  { title: "CU 순천뉴용당피오레점", category: "생활,편의>편의점",
    address: "전남광주통합특별시 순천시 용당동 442-9 1층 101호" },
  { title: "<b>용당피오레</b>입주자대표회의", category: "아파트>관리사무소",
    address: "전남광주통합특별시 순천시 용당동 748" },
  { title: "전남순천 용당피오레아파트 9 전기차충전소", category: "교통,운수서비스>전기차충전소",
    address: "전남광주통합특별시 순천시 용당동 748" }
];

test("네이버 지번 구조는 주거 카테고리 + 건물명 일치 + 지번 수렴일 때만 지번을 준다", () => {
  const picked = pickNaverLotCandidate(NAVER_ITEMS, "용당피오레");
  assert.equal(picked.lotAddress, "전남광주통합특별시 순천시 용당동 748");
  // 편의점(비주거)만 일치하면 채택하지 않는다
  assert.equal(pickNaverLotCandidate([NAVER_ITEMS[1]], "용당피오레"), null);
  // 일치 항목의 지번이 갈리면 채택하지 않는다
  assert.equal(pickNaverLotCandidate([
    NAVER_ITEMS[2],
    { title: "용당피오레아파트", category: "주택>아파트",
      address: "전남광주통합특별시 순천시 용당동 750" }
  ], "용당피오레"), null);
});

test("네이버 지번 구조 발화 조건 — 확인 주소 어디에도 지번이 없을 때만", () => {
  assert.equal(needsNaverLotRescue({
    status: "NAVER_CONFIRMED_PNU_FAILED",
    naverJibunAddr: "전남광주통합특별시 순천시 용당동"
  }), true);
  assert.equal(needsNaverLotRescue({
    status: "NAVER_CONFIRMED_PNU_FAILED",
    naverJibunAddr: "전남광주통합특별시 순천시 용당동 431"
  }), false);
  assert.equal(needsNaverLotRescue({ status: "FAILED" }), false);
  assert.equal(buildNaverLotRescueQuery(
    { sgg: "순천시", emd: "용당동", bldName: "용당피오레" }), "순천시 용당동 용당피오레");
  assert.equal(buildNaverLotRescueQuery({ emd: "용당동", bldName: "" }), "");
});

// ── FAILED 행 소재지 직조회 (실측: JUSO 0건 지번이 등기부엔 82세대) ──────

test("주소미발견 행은 원문에 완전한 지번주소와 동·호가 있을 때만 직조회 대상", () => {
  const row = {
    raw: "충북 보은군 내북면 동산리 148-3 101동 101호",
    result: { status: "FAILED", reason: "NOT_FOUND", unit: { dong: "101", ho: "101" } }
  };
  const plan = buildPnulessIrosPlan(row);
  assert.equal(plan.address, "충북 보은군 내북면 동산리 148-3");
  assert.equal(plan.addressSource, "rawLot");
  assert.equal(plan.dong, "101");
  assert.equal(plan.ho, "101");

  // 동이 없으면 세대를 특정할 수 없어 대상이 아니다
  assert.equal(buildPnulessIrosPlan({
    ...row, result: { ...row.result, unit: { dong: "", ho: "101" } }
  }), null);
  // 시군구 없는 원문은 같은 도의 동명 리와 섞여 대상이 아니다
  assert.equal(buildPnulessIrosPlan({
    ...row, raw: "충북 동산리 148-3 101동 101호"
  }), null);
  // 외부 원천이 "그 주소는 없다"고 답한 행(HUMAN_INPUT_ERROR)은 제외
  assert.equal(buildPnulessIrosPlan({
    ...row, result: { ...row.result, status: "HUMAN_INPUT_ERROR" }
  }), null);
  // 검색 자체가 안 된 행(EMPTY_INPUT 등)은 제외
  assert.equal(buildPnulessIrosPlan({
    ...row, result: { ...row.result, reason: "EMPTY_INPUT" }
  }), null);
});

test("지역 지번주소 판정과 지번 스코프 절단", () => {
  assert.equal(hasRegionalLotAddress("충북 보은군 내북면 동산리 148-3 101동 101호"), true);
  assert.equal(hasRegionalLotAddress("동산리 148-3"), false);
  assert.equal(hasRegionalLotAddress("서울 광진구 자양동 767-1 101-101"), true);
  assert.equal(lotScopedText("충북 보은군 내북면 동산리 148-3 101동 101호"),
    "충북 보은군 내북면 동산리 148-3");
});

// ── 행정동 표기 지번의 법정동 교정 (실측: 대치4동 889-56 ↔ 대치동 889-56) ─

test("숫자 행정동 지번은 실패 상태에서만 법정동으로 교정 재검색한다", () => {
  const pre = { sido: "서울", sgg: "강남구", emd: "대치4동", jibun: "889-56" };
  const plan = buildAdminDongLotRequeryPlan(pre, "NAVER_CONFIRMED_PNU_FAILED");
  assert.equal(plan.query, "서울 강남구 대치동 889-56");
  assert.equal(plan.legalDong, "대치동");
  // 성공 상태에서는 절대 발화하지 않는다
  assert.equal(buildAdminDongLotRequeryPlan(pre, "CONFIRMED"), null);
  // 숫자 없는 법정동·"N가"류 법정동 표기는 건드리지 않는다
  assert.equal(buildAdminDongLotRequeryPlan({ ...pre, emd: "대치동" }, "FAILED"), null);
  assert.equal(buildAdminDongLotRequeryPlan({ ...pre, emd: "효자동2가" }, "FAILED"), null);
  // 지번 없는 행은 대상이 아니다
  assert.equal(buildAdminDongLotRequeryPlan({ ...pre, jibun: "" }, "FAILED"), null);
});

test("교정 법정동+원문 지번이 정확히 한 건일 때만 채택한다", () => {
  const plan = buildAdminDongLotRequeryPlan(
    { sido: "서울", sgg: "강남구", emd: "대치4동", jibun: "889-56" }, "FAILED");
  const hit = { jibunAddr: "서울특별시 강남구 대치동 889-56 더 나인 오피스텔", bdNm: "더 나인 오피스텔" };
  assert.equal(pickAdminDongLotCandidate([hit], plan), hit);
  // 지번이 다른 후보는 세지 않는다
  assert.equal(pickAdminDongLotCandidate(
    [{ jibunAddr: "서울특별시 강남구 대치동 889-5" }], plan), null);
  // 정확 일치가 복수면 확정하지 않는다
  assert.equal(pickAdminDongLotCandidate([hit, { ...hit }], plan), null);
});

test("모듈 버전이 고정돼 감사 추적이 가능하다", () => {
  assert.deepEqual(Object.keys(ADDRESS_FAILED_REQUERY_MODULES).sort(), [
    "R_ADDR_ADMIN_DONG_LOT", "R_ADDR_BUILDING_NAME_LOT",
    "R_ADDR_EXCLUDED_LOT", "R_ADDR_NAVER_LOT_RESCUE"
  ]);
});
