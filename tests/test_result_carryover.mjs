import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  RESULT_CARRYOVER_VERSION,
  buildResultCarryoverIndex,
  carryOverResults,
  resultCarryoverKey
} from "../public/result-carryover.mjs";
import {
  attachPipelineMetadata,
  isReusableResult
} from "../public/pipeline-contract.mjs";

const inputRow = (overrides = {}) => ({
  rowId: "row-1",
  raw: "서울 강남구 역삼동 1 101동 101호",
  extra: ["담보", "2026"],
  zip: "06236",
  owner: "홍길동",
  unitOverride: null,
  result: null,
  ...overrides
});

// 실제 배치가 저장하는 것과 같은 형태의 결과를 만든다.
const finished = (row, evidence = {}) => ({
  ...row,
  result: attachPipelineMetadata(row, {
    status: "CONFIRMED",
    pnu: "1168010100100010000",
    isJip: true,
    jibunAddr: "서울특별시 강남구 역삼동 1",
    unit: { dong: "101", ho: "101" }
  }, evidence)
});

test("키는 조회 결과를 좌우하는 입력만으로 만들어진다", () => {
  const base = inputRow();
  assert.equal(resultCarryoverKey(base), resultCarryoverKey({ ...base, rowId: "row-999" }));
  // 입력이 하나라도 다르면 다른 키다.
  for (const change of [
    { raw: "다른 주소" },
    { zip: "00000" },
    { owner: "김철수" },
    { extra: ["다름"] },
    { unitOverride: { dong: "102", ho: "101" } }
  ]) {
    assert.notEqual(resultCarryoverKey(base), resultCarryoverKey({ ...base, ...change }), JSON.stringify(change));
  }
});

// 이게 이 기능의 핵심이다. 넘겨받은 결과가 재사용 판정을 통과하지 못하면
// 배치가 그대로 다시 조회하므로 아무 효과가 없다.
test("넘겨받은 결과가 재사용 판정을 통과해 재조회 대상에서 빠진다", () => {
  const prior = [finished(inputRow())];
  const built = [inputRow({ rowId: "row-new-1" })];

  assert.equal(isReusableResult(built[0]), false, "넘기기 전에는 재조회 대상");

  const carried = carryOverResults(built, prior);
  assert.equal(carried.restored, 1);
  assert.equal(isReusableResult(carried.rows[0]), true, "넘긴 뒤에는 재조회 제외");
  assert.equal(carried.rows[0].result.pnu, "1168010100100010000");
  // 새 파일에서 온 값은 보존한다.
  assert.equal(carried.rows[0].rowId, "row-new-1");
});

test("근거가 달라지면 지문이 막아 그 행만 다시 조회한다", () => {
  // 이전 배치는 주소군 근거 A로 확정했는데, 이번 배치의 근거가 B로 바뀐 경우.
  const prior = [finished(inputRow(), { groupFingerprint: "A" })];
  const carried = carryOverResults([inputRow({ rowId: "row-new-1" })], prior);
  assert.equal(carried.restored, 1);
  assert.equal(isReusableResult(carried.rows[0], { groupFingerprint: "A" }), true);
  assert.equal(isReusableResult(carried.rows[0], { groupFingerprint: "B" }), false);
});

test("등기조회 결과도 함께 넘어간다", () => {
  const source = finished(inputRow());
  source.reg = { status: "RESOLVED", unique_no: "U1", complete: true };
  const carried = carryOverResults([inputRow({ rowId: "row-new-1" })], [source]);
  assert.equal(carried.restoredIros, 1);
  assert.equal(carried.rows[0].reg.unique_no, "U1");
});

test("같은 입력이 여러 건이면 등기까지 확보한 쪽을 쓴다", () => {
  const plain = finished(inputRow({ rowId: "a" }));
  const withReg = { ...finished(inputRow({ rowId: "b" })), reg: { status: "RESOLVED", unique_no: "U2" } };
  const index = buildResultCarryoverIndex([plain, withReg]);
  assert.equal(index.size, 1);
  assert.equal([...index.values()][0].reg.unique_no, "U2");
});

test("다시 조회해야 하는 실패는 넘기지 않는다", () => {
  const systemError = { ...inputRow({ rowId: "a" }), result: { status: "SYSTEM_ERROR" } };
  const transient = { ...inputRow({ rowId: "b", raw: "다른 주소" }), result: { status: "FAILED", failKind: "TRANSIENT" } };
  const permanent = { ...inputRow({ rowId: "c", raw: "또 다른 주소" }), result: { status: "FAILED", failKind: "PERMANENT" } };
  const index = buildResultCarryoverIndex([systemError, transient, permanent]);
  assert.equal(index.size, 1);
  assert.equal([...index.values()][0].result.failKind, "PERMANENT");
});

test("다른 파일을 올리면 아무것도 넘어오지 않는다", () => {
  const prior = [finished(inputRow())];
  const other = carryOverResults([inputRow({ rowId: "x", raw: "부산 해운대구 우동 1" })], prior);
  assert.equal(other.restored, 0);
  assert.equal(other.rows[0].result, null);

  // 이전 배치가 없을 때도 그대로 통과한다.
  for (const empty of [null, undefined, []]) {
    const result = carryOverResults([inputRow()], empty);
    assert.equal(result.restored, 0);
    assert.equal(result.rows.length, 1);
  }
});

test("이미 결과가 있는 행은 덮어쓰지 않는다", () => {
  const prior = [finished(inputRow())];
  const already = finished(inputRow({ rowId: "keep" }));
  already.result.pnu = "9999999999999999999";
  const carried = carryOverResults([already], prior);
  assert.equal(carried.restored, 0);
  assert.equal(carried.rows[0].result.pnu, "9999999999999999999");
});

test("업로드가 결과를 지우지 않고 넘겨받는다", async () => {
  const source = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
  assert.ok(source.includes("carryOverResults(built, priorRows)"));
  // 업로드 경로에서 무조건 삭제하던 호출이 사라져야 한다.
  const upload = source.slice(source.indexOf("const nextFileMeta ="), source.indexOf("setFileErr(\"파일을 읽지"));
  assert.equal(upload.includes("idbDel(BATCH_KEY)"), false);
  // '새로 시작' 버튼의 명시적 삭제는 남아 있어야 한다.
  assert.ok(source.includes("저장된 진행 상황을 완전히 삭제하고"));
  assert.ok(RESULT_CARRYOVER_VERSION);
});
