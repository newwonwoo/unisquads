import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { decideUnitCandidates, decisionSignature } from "../public/unit-decision.mjs";

// 감사 자체가 무력화되는 것을 막는 계약. 감사가 "통과"만 하고 실제로는
// 아무것도 재지 않는 상태(코퍼스 비었음·기준선 비었음·npm test에서 빠짐)를
// 여기서 잡는다.

const corpus = JSON.parse(
  await readFile(new URL("./fixtures/iros-candidate-corpus.json", import.meta.url), "utf8")
);
const baseline = JSON.parse(
  await readFile(new URL("./fixtures/matching-baseline.json", import.meta.url), "utf8")
);

test("감사 코퍼스는 실측 후보를 충분히 담고 있다", () => {
  assert.ok(corpus.lots.length >= 20, `지번 ${corpus.lots.length}곳 — 너무 적다`);
  const total = corpus.lots.reduce((sum, lot) => sum + lot.candidates.length, 0);
  assert.ok(total >= 5000, `후보 ${total}건 — 너무 적다`);
  // 모든 후보에 고유번호가 있어야 판정 비교가 의미를 가진다
  for (const lot of corpus.lots) {
    assert.ok(lot.candidates.every((c) => c.unique_no), `${lot.id}: 고유번호 없는 후보`);
  }
});

test("기준선은 코퍼스 전체를 덮고 폴백 경로까지 포함한다", () => {
  const lots = Object.keys(baseline);
  assert.equal(lots.length, corpus.lots.length);
  const cases = lots.reduce((sum, id) => sum + Object.keys(baseline[id]).length, 0);
  assert.ok(cases >= 10000, `판정 ${cases}건 — 너무 적다`);

  // 정확 매칭만 있으면 새 규칙(폴백 사다리)이 한 번도 안 열린다.
  // 기준선에 폴백 판정이 실제로 들어 있는지 확인한다.
  const signatures = lots.flatMap((id) => Object.values(baseline[id]));
  const fallbackModules = [
    "R-IROS-DONG-AGNOSTIC-HO", "R-IROS-FLOOR-DISAMBIG", "R-IROS-UNIT-PROFILE"
  ];
  for (const moduleId of fallbackModules) {
    assert.ok(
      signatures.some((s) => s.includes(moduleId)),
      `기준선에 ${moduleId} 판정이 없다 — 감사가 그 규칙을 못 본다`
    );
  }
  // 미일치(NONE)도 있어야 "확정으로 바뀌는 변화"를 감지할 수 있다
  assert.ok(signatures.some((s) => s === "NONE"), "기준선에 미일치 판정이 없다");
});

test("npm test가 회귀 감사를 먼저 돌린다", async () => {
  const pkg = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
  assert.ok(
    pkg.scripts.test.includes("audit-matching-regression"),
    "npm test에서 회귀 감사가 빠졌다"
  );
  assert.ok(pkg.scripts["audit:regression"], "audit:regression 스크립트가 없다");
  assert.ok(pkg.scripts["audit:update"], "audit:update 스크립트가 없다");
});

test("app.js가 감사 대상 판정 함수를 그대로 쓴다", async () => {
  // 감사가 운영과 다른 코드를 재면 아무 의미가 없다.
  const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
  assert.ok(app.includes('from "./unit-decision.mjs"'), "app.js가 판정 모듈을 안 쓴다");
  assert.ok(app.includes("decideUnitCandidates({"), "app.js가 판정 함수를 호출하지 않는다");
});

test("판정 서명은 고유번호와 적용 모듈을 함께 담는다", () => {
  // 서명이 헐거우면 "다른 세대를 골랐는데 통과"가 생긴다.
  const a = decisionSignature({ candidates: [{ unique_no: "A" }], appliedModules: [] });
  const b = decisionSignature({ candidates: [{ unique_no: "B" }], appliedModules: [] });
  assert.notEqual(a, b);
  const withModule = decisionSignature({
    candidates: [{ unique_no: "A" }], appliedModules: ["R-IROS-DONG-AGNOSTIC-HO@2"]
  });
  assert.notEqual(a, withModule);
  assert.equal(decisionSignature({ candidates: [] }), "NONE");
  assert.equal(decisionSignature({ candidates: [{}, {}] }), "MULTI:2");
});

test("판정 함수는 후보를 변형하지 않는다", () => {
  const pool = [
    { unique_no: "A", dong: "101", ho: "101", real_cls_cd: "집합건물" },
    { unique_no: "B", dong: "101", ho: "102", real_cls_cd: "집합건물" }
  ];
  const snapshot = JSON.stringify(pool);
  decideUnitCandidates({ pool, wantDong: "101", wantHo: "101", raw: "x 101동 101호" });
  assert.equal(JSON.stringify(pool), snapshot, "판정이 입력 후보를 건드렸다");
});
