import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { explainRowForHuman } from "../public/human-explanation.mjs";

// 결과 파일의 "처리설명" 열 — 검증하는 사람이 코드명 없이 읽는 문장.
// 시도한 것 → 막힌 곳 → 사람이 할 일 순서를 지키는지 고정한다.
const JIP = "집합건물";
const cand = (dong, ho) => ({ unique_no: `${dong}-${ho}`, dong, ho, real_cls_cd: JIP });

test("주소 실패 — 무엇을 시도했고 사람이 뭘 하면 되는지 말한다", () => {
  const failed = explainRowForHuman({ result: { status: "FAILED" } });
  assert.match(failed, /국가 주소검색.*네이버.*찾지\s*못했습니다/s);
  assert.match(failed, /원문을 직접 확인해서 정제 실패를 확정해 주세요/);
  // 일시 오류는 사람에게 확인을 요구하지 않는다 — 재실행 안내
  assert.match(
    explainRowForHuman({ result: { status: "FAILED", failKind: "TRANSIENT" } }),
    /재실행하면 자동으로 다시 시도/);
  assert.match(explainRowForHuman({ result: { status: "AMBIGUOUS" } }), /직접 골라 주세요/);
  assert.match(explainRowForHuman({ result: { status: "VALIDATION_FAILED" } }), /보류했습니다/);
});

test("등기 세대미일치 — 실제 이유를 등기부 후보에서 도출해 따옴표로 적는다", () => {
  // 요청 동이 등기부에 없는 경우: 실존 동 목록을 보여준다
  const noDong = explainRowForHuman({
    result: { status: "CONFIRMED", source: "naver", unit: { dong: "109", ho: "101" } },
    reg: { status: "REG_UNIT_NOT_FOUND", complete: true,
      candidates: [cand("101", "101"), cand("102", "101")] }
  });
  assert.match(noDong, /주소를 확정했으나 등기고유번호가 검색되지 않았습니다/);
  assert.match(noDong, /그 이유는 "등기부에는 101동·102동만 있고 요청한 109동이 없습니다"입니다/);
  assert.match(noDong, /네이버/); // 네이버 확정 행은 네이버를 언급한다
  // 동은 있는데 호가 없는 경우
  const noHo = explainRowForHuman({
    result: { status: "CONFIRMED", searchLevel: "L1", unit: { dong: "101", ho: "999" } },
    reg: { status: "REG_UNIT_NOT_FOUND", complete: true, candidates: [cand("101", "101")] }
  });
  assert.match(noHo, /"101동은 등기부에 있지만 999호가 없습니다/);
  assert.match(noHo, /합병·소멸 또는 호 표기 차이 가능/); // 추정은 "가능"으로 표시
  assert.doesNotMatch(noHo, /네이버/); // JUSO만으로 확정한 행은 네이버를 말하지 않는다
  // 후보 자체가 없는 경우
  assert.match(explainRowForHuman({
    result: { status: "CONFIRMED", unit: { dong: "", ho: "101" } },
    reg: { status: "REG_UNIT_NOT_FOUND", complete: true, candidates: [] }
  }), /집합건물 세대를 찾지 못했습니다/);
});

test("성공·기타 상태 — 확정 근거와 다음 행동이 사람 말로 나온다", () => {
  assert.match(explainRowForHuman({
    result: { status: "CONFIRMED" },
    reg: { status: "RESOLVED", unique_no: "X", applied_modules: [] }
  }), /동·호가 원문과 정확히 일치/);
  assert.match(explainRowForHuman({
    result: { status: "CONFIRMED" },
    reg: { status: "RESOLVED", unique_no: "X",
      applied_modules: ["R-IROS-DONG-LOT-RELOCATE@1"] }
  }), /다른 지번에 등기돼 있어/);
  assert.match(explainRowForHuman({
    result: { status: "CONFIRMED", isJip: true, unit: {} },
    reg: { status: "UNIT_INPUT_REQUIRED" }
  }), /호를 입력해 주세요/);
  assert.match(explainRowForHuman({
    result: { status: "CONFIRMED" },
    reg: { status: "REG_TIMEOUT" }
  }), /재실행하면 자동으로 다시 시도/);
  assert.match(explainRowForHuman({
    result: { status: "CONFIRMED" },
    reg: { status: "REG_MULTI", candidates: [cand("101", "101"), cand("102", "101")] }
  }), /2건.*직접 골라 주세요/s);
});

test("내보내기에 처리설명 열이 비고 옆에 붙는다", async () => {
  const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
  assert.equal(app.includes('"비고", "처리설명"'), true);
  assert.equal(app.includes("explainRowForHuman(row)"), true);
});
