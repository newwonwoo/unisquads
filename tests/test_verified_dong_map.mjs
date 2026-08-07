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

test("app.js가 검증 동 매핑 패스를 배치 후처리에 연결한다", async () => {
  const { readFile } = await import("node:fs/promises");
  const source = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
  assert.equal(source.includes("buildVerifiedDongMap(next)"), true);
  assert.equal(source.includes("applyVerifiedDongMapRematch"), true);
});
