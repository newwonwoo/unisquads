import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  canAcceptLotBuildingCorrection,
  resultLotOf
} from "../public/address-multilot-rules.mjs";

const mismatch = (reason) => ({ status: "MISMATCH", reason });
const accept = (args) => canAcceptLotBuildingCorrection({
  validation: mismatch("법정동 불일치(수진리≠서부리)"),
  ...args
});

test("결과 주소에서 지번을 뽑는다", () => {
  assert.equal(resultLotOf("충청북도 괴산군 괴산읍 서부리 277-5 태광아파트"), "277-5");
  assert.equal(resultLotOf("경상남도 고성군 거류면 당동리 174 새평지아파트"), "174");
  assert.equal(resultLotOf("충청북도 청주시 상당구 산성동 산 12-3"), "산12-3");
  assert.equal(resultLotOf("서울특별시 강남구 테헤란로 212"), "");
  assert.equal(resultLotOf(""), "");
});

test("지번과 건물명이 모두 원문과 같으면 법정동 오기로 본다", () => {
  // 실측 83행
  assert.equal(accept({
    rawText: "충북 괴산군 괴산읍 수진리 277-5 태광아파트 102동 101호",
    resultAddress: "충청북도 괴산군 괴산읍 서부리 277-5 태광아파트",
    inputBuildingName: "태광아파트",
    resultBuildingName: "태광아파트"
  }), true);
  // 실측 1행
  assert.equal(accept({
    rawText: "경남 고성군 거류면 화당리 174번지 새평지아파트 102동 101호",
    resultAddress: "경상남도 고성군 거류면 당동리 174 새평지아파트",
    inputBuildingName: "새평지아파트",
    resultBuildingName: "새평지아파트"
  }), true);
});

test("원문 건물명이 결과의 줄임말이어도 같은 건물로 본다", () => {
  assert.equal(accept({
    rawText: "울산 남구 부곡동 679-8 선암시장형 상가 a동 101호",
    resultAddress: "울산광역시 남구 선암동 679-8 선암시장형종합상가",
    inputBuildingName: "선암시장형 상가",
    resultBuildingName: "선암시장형종합상가"
  }), true);
});

test("지번이 다르면 받지 않는다 — 진짜 오확정", () => {
  // 충북 청원군 부용면 행산리 → 청주시 흥덕구 옥산면 오산리 (실측)
  assert.equal(accept({
    rawText: "충북 청원군 부용면 행산리 부강리 498-7외 대신아파트 102동203호",
    resultAddress: "충청북도 청주시 흥덕구 옥산면 오산리 384-17 대신아파트",
    inputBuildingName: "대신아파트",
    resultBuildingName: "대신아파트"
  }), false);
});

test("건물명이 다르면 받지 않는다", () => {
  assert.equal(accept({
    rawText: "강원 동해시 동회동 대동아파트 30동 1102호",
    resultAddress: "강원특별자치도 동해시 동회동 442 대동유치원",
    inputBuildingName: "대동아파트",
    resultBuildingName: "대동유치원"
  }), false);
});

test("흔한 건물명만으로는 열지 않는다", () => {
  // "아파트"·"주공아파트"처럼 어디에나 있는 이름은 동일성 근거가 못 된다.
  assert.equal(accept({
    rawText: "서울 강남구 역삼동 736-25 아파트 101호",
    resultAddress: "서울특별시 강남구 논현동 736-25 아파트",
    inputBuildingName: "아파트",
    resultBuildingName: "아파트"
  }), false);
  // 2글자 건물명도 우연 일치 위험이 크다.
  assert.equal(accept({
    rawText: "부산 부산진구 부암동 319 동원 1동 107호",
    resultAddress: "부산광역시 부산진구 가야동 319 동원",
    inputBuildingName: "동원",
    resultBuildingName: "동원"
  }), false);
});

test("시도·시군구 불일치는 대상이 아니다", () => {
  for (const reason of ["시도 불일치(충북≠경기)", "시군구 불일치(의창구≠성산구)", "용도 불일치(대동유치원)"]) {
    assert.equal(canAcceptLotBuildingCorrection({
      validation: mismatch(reason),
      rawText: "충북 괴산군 괴산읍 수진리 277-5 태광아파트",
      resultAddress: "충청북도 괴산군 괴산읍 서부리 277-5 태광아파트",
      inputBuildingName: "태광아파트",
      resultBuildingName: "태광아파트"
    }), false);
  }
});

test("검증이 통과 상태면 아무것도 하지 않는다", () => {
  assert.equal(canAcceptLotBuildingCorrection({
    validation: { status: "MATCH", reason: "" },
    rawText: "충북 괴산군 괴산읍 수진리 277-5 태광아파트",
    resultAddress: "충청북도 괴산군 괴산읍 서부리 277-5 태광아파트",
    inputBuildingName: "태광아파트",
    resultBuildingName: "태광아파트"
  }), false);
  assert.equal(canAcceptLotBuildingCorrection({}), false);
});

test("app.js가 기존 교정 규칙 뒤에 이 규칙을 연결한다", async () => {
  const source = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
  const zip = source.indexOf("canAcceptZipBuildingCorrection({");
  const lot = source.indexOf("canAcceptLotBuildingCorrection({");
  assert.notEqual(zip, -1);
  assert.notEqual(lot, -1);
  // 우편번호 근거가 있는 교정이 먼저다. 이 규칙은 그 뒤의 마지막 관문이다.
  assert.equal(zip < lot, true);
  assert.equal(source.includes('"LOT_BUILDING_REGION_CORRECTION"'), true);
  assert.equal(source.includes('"lot_building_region_correction"'), true);
});
