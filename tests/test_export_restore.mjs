import assert from "node:assert/strict";
import test from "node:test";
import {
  EXPORT_RESTORE_VERSION,
  countRestored,
  detectExportLayout,
  restoreRowsFromExport
} from "../public/export-restore.mjs";
import { isReusableResult } from "../public/pipeline-contract.mjs";
import { isReusableIrosResult, rowRequiresIros } from "../public/iros-run-contract.mjs";

// 실제 결과지 헤더 배치: 원본 부가열(부동산번호 등)이 앞, 생성 열이 뒤.
const HEADER = [
  "부동산번호", "소재지우편번호", "소유자명",
  "원본주소", "정제상태", "시군구", "부동산구분", "주택유형",
  "지번주소", "도로명주소", "동", "호", "PNU", "건물관리번호",
  "등기고유번호", "중복여부", "등기상태", "검토유형"
];
const col = Object.fromEntries(HEADER.map((h, i) => [h, i]));
const record = (values) => {
  const row = HEADER.map(() => "");
  for (const [key, value] of Object.entries(values)) row[col[key]] = value;
  return row;
};

test("결과지 헤더만 복원 대상으로 판별한다", () => {
  const layout = detectExportLayout(HEADER);
  assert.equal(layout.version, EXPORT_RESTORE_VERSION);
  assert.deepEqual(layout.extraHeaders, ["부동산번호", "소재지우편번호", "소유자명"]);
  // 일반 원본 파일(주소 열 하나)은 결과지가 아니다
  assert.equal(detectExportLayout(["부동산번호", "주소", "소유자명"]), null);
  assert.equal(detectExportLayout([]), null);
});

test("확정 행은 지문 없는 보호 결과로 복원되어 재조회 없이 재사용된다", () => {
  const body = [record({
    부동산번호: "R-1", 소재지우편번호: "25755", 소유자명: "홍길동",
    원본주소: "강원 동해시 어달동 12-1,2,5 묵호진동1-83 101동 101호",
    정제상태: "CONFIRMED", 부동산구분: "집합건물",
    지번주소: "강원특별자치도 동해시 묵호진동 1-83 삼본아파트",
    도로명주소: "강원특별자치도 동해시 일출로 1",
    동: "101", 호: "101", PNU: "5177010700100010083",
    건물관리번호: "5177010700100010083000001",
    등기고유번호: "1447-1996-041518", 등기상태: "조회완료"
  })];
  const rows = restoreRowsFromExport(body, detectExportLayout(HEADER));
  assert.equal(rows.length, 1);
  const row = rows[0];
  assert.equal(row.result.status, "CONFIRMED");
  assert.equal(row.result.pnu, "5177010700100010083");
  assert.equal(row.result.bdNm, "삼본아파트");
  assert.equal(row.result.isJip, true);
  assert.deepEqual(row.unitOverride, { dong: "101", ho: "101" });
  assert.deepEqual(row.extra, ["R-1", "25755", "홍길동"]);
  // 핵심 계약: 주소는 재조회 없이 재사용, 등기는 보호되어 재조회 대상 아님
  assert.equal(isReusableResult(row), true);
  assert.equal(isReusableIrosResult(row.reg), true);
  assert.equal(row.reg.unique_no, "1447-1996-041518");
});

test("실패 행은 결과 없이 복원되어 현재 규칙으로 다시 정제된다", () => {
  const body = [
    record({ 원본주소: "충북 보은군 내북면 동산리 148-3 101동 101호",
      정제상태: "FAILED", 동: "101", 호: "101" }),
    record({ 원본주소: "인천 남동구 만수동 창대장터상가 1-110",
      정제상태: "HUMAN_INPUT_ERROR", 동: "1", 호: "110" })
  ];
  const rows = restoreRowsFromExport(body, detectExportLayout(HEADER));
  assert.equal(rows.length, 2);
  for (const row of rows) {
    assert.equal(row.result, null);
    assert.equal(row.reg, undefined);
    assert.equal(isReusableResult(row), false);
  }
});

test("주소 근거 없는 고유번호·미완료 등기·불량 PNU는 복원하지 않는다", () => {
  const layout = detectExportLayout(HEADER);
  // 정제 실패인데 고유번호만 있는 행 — 등기 복원 금지
  const orphanReg = restoreRowsFromExport([record({
    원본주소: "어딘가", 정제상태: "FAILED", 등기고유번호: "1234-5678-901234", 등기상태: "조회완료"
  })], layout)[0];
  assert.equal(orphanReg.result, null);
  assert.equal(orphanReg.reg, undefined);
  // 세대미일치 행의 고유번호 없는 등기상태 — 복원 안 함(재조회 대상)
  const failedReg = restoreRowsFromExport([record({
    원본주소: "어딘가", 정제상태: "CONFIRMED", PNU: "1234567890123456789",
    지번주소: "서울특별시 강남구 역삼동 736-25", 등기상태: "세대미일치", 호: "101"
  })], layout)[0];
  assert.equal(failedReg.result.status, "CONFIRMED");
  assert.equal(failedReg.reg, undefined);
  assert.equal(rowRequiresIros(failedReg), true);
  // PNU 형식 불량 — 주소 복원 자체를 하지 않는다
  const badPnu = restoreRowsFromExport([record({
    원본주소: "어딘가", 정제상태: "CONFIRMED", PNU: "12345", 등기상태: "조회완료"
  })], layout)[0];
  assert.equal(badPnu.result, null);
});

test("app.js가 결과지 시트를 자동 선택하고 복원 경로에 연결한다", async () => {
  const { readFile } = await import("node:fs/promises");
  const source = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
  // 결과지 통합문서는 요약 시트가 첫 장 — 시트를 훑어 결과지 헤더를 찾아야 한다
  assert.equal(source.includes("detectExportLayout(head)"), true);
  assert.equal(source.includes("restoreRowsFromExport(body, exportLayout)"), true);
  // 업로드 안내가 결과지 모드를 구분해 표시한다
  assert.equal(source.includes('mode: "export"'), true);
});

test("복원 통계", () => {
  const rows = [
    { result: {}, reg: {} }, { result: {} }, { result: null }
  ];
  assert.deepEqual(countRestored(rows), { address: 2, iros: 1 });
});
