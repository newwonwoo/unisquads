import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  blockingRegionLevel,
  gluedAdminToken
} from "../public/address-recovery-rules.mjs";

// 실측(20,023행 전량): 아래 두 규칙으로 검증불일치 650건 중 272건이 회수되고
// 원문에 없는 지역이 통과한 경우 0건, 기존 통과가 차단으로 뒤집힌 경우 0건.

test("붙어 온 법정동을 검증 후보로 인정한다", () => {
  assert.equal(gluedAdminToken("반촌리420-6반촌명지아파트103-412"), "반촌리");
  assert.equal(gluedAdminToken("진관리642-2산내들아파트101-102"), "진관리");
  assert.equal(gluedAdminToken("사주리460-1대방빌리지101-608"), "사주리");
  assert.equal(gluedAdminToken("대심리78-1외4필지"), "대심리");
});

test("법정동이 아닌 것은 후보로 만들지 않는다", () => {
  // 도로명: 상동5길·중앙로2는 앞머리가 법정동처럼 보여도 도로다.
  assert.equal(gluedAdminToken("상동5길"), "");
  assert.equal(gluedAdminToken("중앙로2"), "");
  // 알파벳 동 표기와 건물 부속동은 지역이 아니다.
  assert.equal(gluedAdminToken("에이동101호"), "");
  assert.equal(gluedAdminToken("A동101호"), "");
  assert.equal(gluedAdminToken("상가동044호"), "");
  // 이미 떨어져 있는 정상 토큰은 기존 경로가 처리한다.
  assert.equal(gluedAdminToken("영천리"), "");
  assert.equal(gluedAdminToken("송악면"), "");
  assert.equal(gluedAdminToken(""), "");
  assert.equal(gluedAdminToken(null), "");
});

const level = (name, match, input = "", result = "") =>
  ({ name, compared: { match, input, result } });

test("리가 일치하면 읍면 차이는 차단하지 않는다", () => {
  // 충남 당진군 송산면 진관리642-2 → 충남 당진시 고대면 진관리 642-6 (실측)
  assert.equal(blockingRegionLevel([
    level("읍면", false, "송산면", "고대면"),
    level("법정동", true, "진관리", "진관리")
  ]), null);
});

test("리가 불일치하면 읍면이 맞아도 차단한다", () => {
  const blocked = blockingRegionLevel([
    level("읍면", true, "송악읍", "송악읍"),
    level("법정동", false, "영천리", "반촌리")
  ]);
  assert.equal(blocked?.name, "법정동");
});

test("둘 다 불일치하면 기존과 같이 첫 실패 계층을 사유로 보고한다", () => {
  // 충북 청원군 부용면 행산리 → 청주시 흥덕구 옥산면 오산리 (진짜 오확정)
  const blocked = blockingRegionLevel([
    level("읍면", false, "부용면", "옥산면"),
    level("법정동", false, "행산리", "오산리")
  ]);
  assert.equal(blocked?.name, "읍면");
});

test("읍면 계층만 있을 때는 완화하지 않는다", () => {
  const blocked = blockingRegionLevel([level("읍면", false, "부용면", "옥산면")]);
  assert.equal(blocked?.name, "읍면");
});

test("빈 입력은 차단 사유가 없다", () => {
  assert.equal(blockingRegionLevel([]), null);
  assert.equal(blockingRegionLevel(null), null);
});

test("app.js가 두 규칙을 지역 검증에 실제로 연결한다", async () => {
  const source = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
  assert.equal(source.includes("blockingRegionLevel,"), true);
  assert.equal(source.includes("gluedAdminToken,"), true);
  // 후보 수집에서만 쓰고 대표값(out.bjd)은 건드리지 않는다.
  assert.equal(source.includes('const glued = RE_BJD.test(t) ? "" : gluedAdminToken(t);'), true);
  assert.equal(source.includes("if (!bucket.includes(glued)) bucket.push(glued);"), true);
  // validateRegion의 세 갈래 모두 완화 규칙을 통과한다.
  assert.equal(source.split("blockingRegionLevel(").length - 1, 3);
});
