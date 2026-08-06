import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  MAX_PLAUSIBLE_FLOOR,
  splitImplausibleFloorHo
} from "../public/address-quality-rules.mjs";

test("있을 수 없는 층이 나오면 절단 위치를 한 자리 되돌린다", () => {
  // 실측: 93층·67층짜리 건물은 없다. 지번 쪽으로 한 자리를 돌려주면 맞는다.
  assert.equal(splitImplausibleFloorHo("경남 창원시 내동 456-19301호"),
    "경남 창원시 내동 456-19 301호");
  assert.equal(splitImplausibleFloorHo("중랑구중화동 274-76701호"),
    "중랑구중화동 274-76 701호");
  assert.equal(splitImplausibleFloorHo("경남 창원시 내동 456-19502호"),
    "경남 창원시 내동 456-19 502호");
});

test("있을 수 있는 층은 건드리지 않는다", () => {
  // 22층·15층은 정상이므로 네 자리 그대로가 호수다.
  assert.equal(splitImplausibleFloorHo("광주 동구 소태동 275-8 101동2201호"),
    "광주 동구 소태동 275-8 101동2201호");
  assert.equal(splitImplausibleFloorHo("서울 강남구 역삼동 736-25 1502호"),
    "서울 강남구 역삼동 736-25 1502호");
  assert.equal(splitImplausibleFloorHo("부산 해운대구 우동 1408호"),
    "부산 해운대구 우동 1408호");
});

test("숫자에 붙어 오지 않으면 손대지 않는다", () => {
  // 상가·오피스텔은 층과 무관한 네 자리 호수를 쓰기도 한다.
  assert.equal(splitImplausibleFloorHo("부산 중구 지하상가 9301호"), "부산 중구 지하상가 9301호");
  assert.equal(splitImplausibleFloorHo("9301호"), "9301호");
  assert.equal(splitImplausibleFloorHo("서울 강남구 역삼동 736-25 제9301호"),
    "서울 강남구 역삼동 736-25 제9301호");
});

test("세 자리 이하 호수는 대상이 아니다", () => {
  assert.equal(splitImplausibleFloorHo("경남 창원시 내동 456-1301호"), "경남 창원시 내동 456-1301호");
  assert.equal(splitImplausibleFloorHo("경남 창원시 내동 456-101호"), "경남 창원시 내동 456-101호");
  assert.equal(splitImplausibleFloorHo(""), "");
  assert.equal(splitImplausibleFloorHo(null), "");
});

test("층 상한은 국내 공동주택 최고층보다 넉넉히 잡는다", () => {
  assert.equal(MAX_PLAUSIBLE_FLOOR >= 50, true);
  assert.equal(MAX_PLAUSIBLE_FLOOR <= 99, true);
});

test("extractUnit이 동·호를 뽑기 전에 절단을 바로잡는다", async () => {
  const source = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
  assert.equal(/splitImplausibleFloorHo\n\} from "\.\/address-quality-rules\.mjs"/.test(source), true);
  assert.equal(source.includes("let text = splitImplausibleFloorHo(str)"), true);
});
