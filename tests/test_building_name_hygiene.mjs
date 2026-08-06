import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  isBuildingNameNoise,
  stripRegistryTail
} from "../public/address-quality-rules.mjs";
import { canAcceptDongsoAnchorCorrection } from "../public/address-multilot-rules.mjs";

test("숫자를 지우고 남은 등기부 조각은 건물명이 아니다", () => {
  // "동소제102동제602호" → 숫자 제거 → "제 동제 호" → "동제"가 건물명이 되어
  // R9 동소 치환을 오염시켰다(네이버 질의 "동제제", 실측 24행).
  assert.equal(isBuildingNameNoise("동제"), true);
  assert.equal(isBuildingNameNoise("제제"), true);
  assert.equal(isBuildingNameNoise("층제"), true);
  assert.equal(isBuildingNameNoise("동호"), true);
});

test("택지개발 표기는 건물명이 아니다", () => {
  // 창원 도계동 144블록 5노트 → "블록"으로 검색해 엉뚱한 팔용동을 잡았다.
  assert.equal(isBuildingNameNoise("블록"), true);
  assert.equal(isBuildingNameNoise("블럭"), true);
  assert.equal(isBuildingNameNoise("노트"), true);
  assert.equal(isBuildingNameNoise("지구"), true);
});

test("진짜 건물명은 그대로 둔다", () => {
  for (const name of ["장미마을", "문덕", "동원", "혜창한마음비치", "현진에버빌아파트"]) {
    assert.equal(isBuildingNameNoise(name), false);
  }
});

test("꼬리에 남은 제만 떼되 이름을 잘라먹지 않는다", () => {
  assert.equal(stripRegistryTail("정관신도시현진에버빌아파트제"), "정관신도시현진에버빌아파트");
  assert.equal(stripRegistryTail("현진에버빌제"), "현진에버빌");
  assert.equal(stripRegistryTail("이빌제"), "이빌");
  // "거제"를 "거"로 만들면 안 된다(실측 회귀 2행).
  assert.equal(stripRegistryTail("거제"), "거제");
  assert.equal(stripRegistryTail("제"), "제");
  assert.equal(stripRegistryTail("장미마을"), "장미마을");
});

const anchorAccept = (anchorName, resultBuildingName) => canAcceptDongsoAnchorCorrection({
  validation: { status: "MISMATCH", reason: "법정동 불일치(석정리≠대심리)" },
  anchorName,
  resultBuildingName
});

test("동소 기준행으로 찾은 결과는 기준행 쪽 법정동을 따른다", () => {
  // 기준행 "석정리 대심리78-1외4필지 장미마을 아파트" → 대심리 78-1 장미마을아파트
  // 동소행 "석정리 동소제102동제602호"                → 같은 곳 (실측 10행)
  assert.equal(anchorAccept("장미마을", "장미마을아파트"), true);
  assert.equal(anchorAccept("문덕", "문덕아파트"), false);   // 앵커가 3자 미만
});

test("앵커가 결과 건물명에 없으면 받지 않는다", () => {
  assert.equal(anchorAccept("장미마을", "대동유치원"), false);
  assert.equal(anchorAccept("", "장미마을아파트"), false);
  assert.equal(anchorAccept("장미마을", ""), false);
  // 흔한 이름은 동일성 근거가 못 된다.
  assert.equal(anchorAccept("주공아파트", "주공아파트"), false);
});

test("시도·시군구 불일치와 통과 상태는 대상이 아니다", () => {
  assert.equal(canAcceptDongsoAnchorCorrection({
    validation: { status: "MISMATCH", reason: "시도 불일치(경북≠경기)" },
    anchorName: "장미마을", resultBuildingName: "장미마을아파트"
  }), false);
  assert.equal(canAcceptDongsoAnchorCorrection({
    validation: { status: "MATCH", reason: "" },
    anchorName: "장미마을", resultBuildingName: "장미마을아파트"
  }), false);
  assert.equal(canAcceptDongsoAnchorCorrection({}), false);
});

test("app.js가 세 규칙을 실제로 연결한다", async () => {
  const source = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
  // 건물명 추출 토큰 필터
  assert.equal(source.includes("!isBuildingNameNoise(t))"), true);
  assert.equal(source.includes("return stripRegistryTail(toks.sort"), true);
  // 앵커는 원문에서 읽는다(preprocess는 앞쪽 리와 건물명을 떨어뜨린다)
  assert.equal(source.includes("const name = p.bldName || extractBuildingName(raw);"), true);
  assert.equal(source.includes("const region = extractRegion(modernizeSgg(raw));"), true);
  // 동소 앵커 교정
  assert.equal(source.includes("canAcceptDongsoAnchorCorrection({"), true);
  assert.equal(source.includes('"DONGSO_ANCHOR_REGION_CORRECTION"'), true);
  // 2자 고유명도 복수후보 좁히기에 쓴다(부암동 319 동원)
  assert.equal(source.includes("return shorter.length >= 2 && !GENERIC.test(shorter);"), true);
});
