import assert from "node:assert/strict";
import test from "node:test";
import {
  MIN_ANCHORS,
  applyVerifiedDongMapRematch,
  buildVerifiedDongMap,
  planVerifiedDongMapRematch
} from "../public/verified-dong-map.mjs";

// 실측(삼척 원조임대아파트): 원문 "201-*" ↔ 등기부 102동.
// 102동에만 있는 호를 가진 24행이 동무시 매칭으로 전원 102동 확정 — 앵커.
const LOT = "강원특별자치도 삼척시 사직동 319-1 원조아파트";
const cand = (unique_no, dong, ho) =>
  ({ unique_no, dong, ho, real_cls_cd: "집합건물" });

const anchorRow = (n, mappedDong = "102") => ({
  result: { jibunAddr: LOT, unit: { dong: "201", ho: String(1400 + n) } },
  reg: {
    status: "RESOLVED", unique_no: `A-${n}`, complete: true,
    dong_agnostic_recovery: { requested_dong: "201", matched_ho: String(1400 + n) },
    candidates: [cand(`A-${n}`, mappedDong, String(1400 + n))]
  }
});
const failedRow = (ho) => ({
  result: { jibunAddr: LOT, unit: { dong: "201", ho } },
  reg: {
    status: "REG_UNIT_NOT_FOUND", complete: true,
    candidates: [
      cand("U-101", "101", ho),   // 같은 호가 101동에도 있어 동무시는 유일성 실패
      cand("U-102", "102", ho)
    ]
  }
});

test("동무시 확정 앵커가 한 동으로 수렴하면 매핑이 생기고 정확 유일만 확정한다", () => {
  const rows = [anchorRow(1), anchorRow(2), failedRow("101")];
  const map = buildVerifiedDongMap(rows);
  assert.equal(map.size, 1);
  const plan = planVerifiedDongMapRematch(rows[2], map);
  assert.equal(plan.mappedDong, "102");
  assert.equal(plan.anchors, 2);
  assert.equal(plan.candidate.unique_no, "U-102");
  const reg = applyVerifiedDongMapRematch(rows[2].reg, plan);
  assert.equal(reg.status, "RESOLVED");
  assert.equal(reg.unique_no, "U-102");
  assert.equal(reg.applied_modules.includes("R-IROS-VERIFIED-DONG-MAP@1"), true);
});

test("기권 반례 — 앵커 부족·앵커 상충·복수 매칭·확정 행", () => {
  // 앵커 1건뿐이면 우연일 수 있어 매핑을 만들지 않는다
  assert.equal(buildVerifiedDongMap([anchorRow(1)]).size, 0);
  assert.ok(MIN_ANCHORS >= 2);
  // 앵커가 두 동으로 갈리면 매핑 전체를 버린다
  assert.equal(buildVerifiedDongMap([anchorRow(1, "102"), anchorRow(2, "101")]).size, 0);
  // 매핑 동의 (동,호)가 복수면 확정하지 않는다
  const map = buildVerifiedDongMap([anchorRow(1), anchorRow(2)]);
  const dupRow = {
    result: { jibunAddr: LOT, unit: { dong: "201", ho: "301" } },
    reg: { status: "REG_UNIT_NOT_FOUND", complete: true,
      candidates: [cand("D1", "102", "301"), cand("D2", "102", "301")] }
  };
  assert.equal(planVerifiedDongMapRematch(dupRow, map), null);
  // 이미 확정된 행은 건드리지 않는다 (RESOLVED는 대상 아님)
  assert.equal(planVerifiedDongMapRematch(anchorRow(3), map), null);
  // 다른 지번의 실패 행에는 매핑이 넘어가지 않는다
  const otherLot = {
    result: { jibunAddr: "강원특별자치도 삼척시 사직동 400-1", unit: { dong: "201", ho: "101" } },
    reg: { status: "REG_UNIT_NOT_FOUND", complete: true, candidates: [cand("X", "102", "101")] }
  };
  assert.equal(planVerifiedDongMapRematch(otherLot, map), null);
  // 다른 요청 동에도 넘어가지 않는다
  const otherDong = {
    result: { jibunAddr: LOT, unit: { dong: "301", ho: "101" } },
    reg: { status: "REG_UNIT_NOT_FOUND", complete: true, candidates: [cand("Y", "102", "101")] }
  };
  assert.equal(planVerifiedDongMapRematch(otherDong, map), null);
});

test("소거법 — 주거동 N개 중 N-1개가 일치하면 남는 하나끼리 매핑한다", () => {
  // 원조 실측: 등기부 101·102(주거) + 상가, 요청 101(성공)·201(실패).
  // 101이 그대로 일치 → 남는 요청 201 = 남는 등기부 102. 앵커 없이 성립.
  const okRow = {
    result: { jibunAddr: LOT, unit: { dong: "101", ho: "101" } },
    reg: { status: "RESOLVED", unique_no: "OK", complete: true,
      candidates: [cand("OK", "101", "101")] }
  };
  const failed = {
    result: { jibunAddr: LOT, unit: { dong: "201", ho: "105" } },
    reg: { status: "REG_UNIT_NOT_FOUND", complete: true,
      candidates: [
        cand("E-101", "101", "105"), cand("E-102", "102", "105"),
        { unique_no: "S-1", dong: "상가", ho: "105", real_cls_cd: "집합건물" },
        { unique_no: "B-1", dong: "103", ho: "105", real_cls_cd: "건물" }
      ] }
  };
  const map = buildVerifiedDongMap([okRow, failed]);
  const plan = planVerifiedDongMapRematch(failed, map);
  assert.equal(plan.mappedDong, "102");
  assert.equal(plan.candidate.unique_no, "E-102");
  // 상가·일반건물 동은 소거 계산에 들어가지 않는다(103은 건물이라 제외됨)

  // 미일치 등기부 동이 둘이면(102·103 둘 다 집합건물) 기권
  const twoLeft = {
    ...failed,
    reg: { ...failed.reg, candidates: [
      cand("E-101", "101", "105"), cand("E-102", "102", "105"), cand("E-103", "103", "105")
    ] }
  };
  assert.equal(buildVerifiedDongMap([okRow, twoLeft]).size, 0);
  // 그대로 일치하는 동이 하나도 없으면(전혀 다른 체계) 기권
  const noMatch = {
    result: { jibunAddr: LOT, unit: { dong: "201", ho: "105" } },
    reg: { status: "REG_UNIT_NOT_FOUND", complete: true,
      candidates: [cand("E-102", "102", "105")] }
  };
  assert.equal(buildVerifiedDongMap([noMatch]).size, 0);
  // 앵커와 소거가 상충하면 매핑을 통째로 버린다
  const clash = buildVerifiedDongMap([
    okRow, failed, anchorRow(1, "101"), anchorRow(2, "101")
  ]);
  assert.equal(clash.has(`사직동|319-1#201`), false);
});

test("소거 커버리지 가드 — 잔여 동이 요청 호를 못 덮으면 기권 (용당 실측 반례)", () => {
  // 용당: 잔여 요청 12동(호 101·102·103…) ↔ 잔여 등기부 123동(1세대, 호 101).
  // 123은 요청 호의 극히 일부만 가진다 — 매핑하면 101호가 오확정된다.
  const okRow = {
    result: { jibunAddr: LOT, unit: { dong: "101", ho: "101" } },
    reg: { status: "RESOLVED", unique_no: "OK", complete: true,
      candidates: [cand("OK", "101", "101")] }
  };
  const failedRows = ["101", "102", "103"].map((ho) => ({
    result: { jibunAddr: LOT, unit: { dong: "12", ho } },
    reg: { status: "REG_UNIT_NOT_FOUND", complete: true,
      candidates: [cand("OK", "101", "101"), cand("T-123", "123", "101")] }
  }));
  const map = buildVerifiedDongMap([okRow, ...failedRows]);
  // 123은 요청 호 3종 중 1종만 커버(33%) → 매핑 자체가 생기지 않는다
  assert.equal(map.size, 0);
  // 반대로 잔여 동이 요청 호를 전부 가지면(원조 형태) 매핑이 성립한다
  const richFailed = ["101", "102", "103"].map((ho) => ({
    result: { jibunAddr: LOT, unit: { dong: "201", ho } },
    reg: { status: "REG_UNIT_NOT_FOUND", complete: true,
      candidates: [cand("OK", "101", "101"),
        cand(`R-${ho}`, "102", ho)] }
  }));
  const rich = buildVerifiedDongMap([okRow, ...richFailed]);
  assert.equal(rich.size, 1);
  assert.equal([...rich.values()][0].mappedDong, "102");
});

test("충돌 가드 — 매핑 대상 동이 직접 요청되면 기권 (중앙 실측 반례)", () => {
  // 중앙아파트 실측: 등기부가 물리 101~105동(JUSO 동목록)을 102·103 두 동으로
  // 합본 기재했다. 원문 102동 요청이 등기 102동을 이미 차지한 상태에서 동무시
  // 앵커 101→102가 생기는데, 매핑하면 서로 다른 두 세대가 같은 고유번호를
  // 나눠 갖는다(고유번호 중복 확정 32건 실측). 대상 동이 요청되고 있으면 기권.
  const ok102 = {
    result: { jibunAddr: LOT, unit: { dong: "102", ho: "301" } },
    reg: { status: "RESOLVED", unique_no: "OK-102", complete: true,
      candidates: [cand("OK-102", "102", "301")] }
  };
  const anchors101 = [1, 2].map((n) => ({
    result: { jibunAddr: LOT, unit: { dong: "101", ho: String(1500 + n) } },
    reg: { status: "RESOLVED", unique_no: `A101-${n}`, complete: true,
      dong_agnostic_recovery: { requested_dong: "101", matched_ho: String(1500 + n) },
      candidates: [cand(`A101-${n}`, "102", String(1500 + n))] }
  }));
  assert.equal(buildVerifiedDongMap([ok102, ...anchors101]).size, 0);
  // 대상 동이 요청되지 않았으면(원조 형태) 그대로 성립한다
  assert.equal(buildVerifiedDongMap(anchors101).size, 1);
});

test("충돌 가드 — 두 요청 동이 같은 등기부 동으로 수렴하면 전부 버린다", () => {
  // 중앙 실측: 104→102, 105→102 앵커가 동시에 생겼다. 서로 다른 물리 동이
  // 한 등기부 동일 수는 없으므로 수렴이 겹치면 그 지번 매핑 전체를 버린다.
  const anchorsOf = (reqDong, hoBase) => [1, 2].map((n) => ({
    result: { jibunAddr: LOT, unit: { dong: reqDong, ho: String(hoBase + n) } },
    reg: { status: "RESOLVED", unique_no: `${reqDong}-${n}`, complete: true,
      dong_agnostic_recovery: { requested_dong: reqDong, matched_ho: String(hoBase + n) },
      candidates: [cand(`${reqDong}-${n}`, "102", String(hoBase + n))] }
  }));
  const map = buildVerifiedDongMap([...anchorsOf("104", 1600), ...anchorsOf("105", 1700)]);
  assert.equal(map.size, 0);
  // 수렴이 겹치지 않으면 각각 성립한다
  const split = buildVerifiedDongMap([...anchorsOf("104", 1600).map((row) => ({
    ...row,
    reg: { ...row.reg, candidates: [cand(row.reg.unique_no, "112", row.result.unit.ho)] }
  })), ...anchorsOf("105", 1700)]);
  assert.equal(split.size, 2);
});

test("app.js가 검증 동 매핑 패스를 배치 후처리에 연결한다", async () => {
  const { readFile } = await import("node:fs/promises");
  const source = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
  assert.equal(source.includes("buildVerifiedDongMap(next)"), true);
  assert.equal(source.includes("applyVerifiedDongMapRematch"), true);
});
