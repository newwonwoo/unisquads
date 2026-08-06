import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { measure } from "../public/recovery-impact.mjs";
import {
  buildConfirmedLotPnuIndex,
  lotIndexJusoCandidate
} from "../public/pnuless-iros.mjs";

const snapshot = JSON.parse(
  await readFile(new URL("./fixtures/recovery-impact-snapshot.json", import.meta.url), "utf8")
);

test("측정 하네스는 각 행을 정확히 한 모듈에만 귀속시킨다", () => {
  const result = measure(snapshot.rows);
  const modules = result.modules;

  // 중복 동 표기와 동 무시는 같은 행에 동시에 성립할 수 있다. 매처 순서대로
  // 먼저 성공한 모듈이 그 행을 가져가야 하며, 양쪽에 중복 계상되면 안 된다.
  assert.equal(modules["중복 동 표기 복구"].entered, 2);
  assert.equal(modules["중복 동 표기 복구"].recovered, 1);
  assert.equal(modules["동 무시 호 수렴"].entered, 4);
  assert.equal(modules["동 무시 호 수렴"].recovered, 1);

  // 진입 = 확정 + 거절 사유 합계. 어느 행도 사라지거나 두 번 세어지지 않는다.
  for (const [name, data] of Object.entries(modules)) {
    if (name === "PNU 없는 IROS 조회" || name === "IROS 소재지 역확정") continue;
    if (name === "검증 고유번호 전파") continue;
    const rejected = [...data.rejected.values()].reduce((sum, count) => sum + count, 0);
    assert.equal(data.entered, data.recovered + rejected, name);
  }
});

test("동 무시 경로의 거절 사유가 설계 조건과 일치한다", () => {
  const reasons = measure(snapshot.rows).modules["동 무시 호 수렴"].rejected;
  // 요청 동이 등기부에 실재하면 근거 있는 부재이므로 닫는다.
  assert.equal(reasons.get("REQUESTED_DONG_EXISTS"), 2);
  // 같은 호가 여러 동에 있으면 수렴하지 않는다.
  assert.equal(reasons.get("HO_NOT_UNIQUE"), 1);
});

test("단계 순서가 실제 배치와 같아 후속 단계가 앞 단계 결과를 본다", () => {
  const result = measure(snapshot.rows);
  // PNU 없는 조회로 확정된 행이 소재지 역확정의 입력이 된다.
  assert.equal(result.modules["PNU 없는 IROS 조회"].recovered, 1);
  assert.equal(result.modules["IROS 소재지 역확정"].entered, 1);
  assert.equal(result.modules["IROS 소재지 역확정"].recovered, 1);
  // 역확정 성공분만 주소확정이 늘고, 최종통과에는 다시 더하지 않는다.
  assert.equal(result.measured.addressGain, 1);
  assert.equal(
    result.measured.irosGain,
    result.modules["중복 동 표기 복구"].recovered +
    result.modules["동 무시 호 수렴"].recovered +
    result.modules["검증 고유번호 전파"].recovered +
    result.modules["PNU 없는 IROS 조회"].recovered
  );
});

test("재현 불가능한 항목은 추정하지 않고 미측정으로 분리한다", () => {
  const result = measure(snapshot.rows);
  // 해당 지번의 완전후보가 배치 안에 없는 PNU 없는 행.
  assert.equal(result.unmeasured.pnulessWithoutPool, 1);
  // 미측정분은 기대효과 수치에 들어가지 않는다.
  assert.equal(
    result.measured.finalResolved,
    result.baseline.finalResolved + result.measured.irosGain
  );
});

test("배치 안에 이미 확정된 지번이면 JUSO 없이 PNU를 결정한다", () => {
  const index = buildConfirmedLotPnuIndex(snapshot.rows);
  const hit = lotIndexJusoCandidate(
    { sojae: "세종특별자치시 한솔동 59 첫마을아파트 제502동 제506호" },
    index
  );
  assert.equal(hit.candidate.pnu, "3611010600100590000");
  assert.equal(hit.source, "confirmed_lot_index");
  assert.equal(hit.query, "세종특별자치시 한솔동 59");

  // 같은 지번에 PNU가 두 종류면 색인에서 제외한다.
  const conflicted = buildConfirmedLotPnuIndex([
    { result: { status: "CONFIRMED", pnu: "1".repeat(19), jibunAddr: "서울특별시 종로구 청운동 1" } },
    { result: { status: "CONFIRMED", pnu: "2".repeat(19), jibunAddr: "서울특별시 종로구 청운동 1" } }
  ]);
  assert.equal(conflicted.has("서울특별시 종로구 청운동 1"), false);
});

test("실데이터 유래 원문에서 중복 동 표기가 실제로 잡힌다", async () => {
  const source = await readFile(new URL("./test_address_real_100.mjs", import.meta.url), "utf8");
  // 실측 표본(정제결과_전체(6).xlsx 확정행 층화추출)에 이 표기가 존재한다.
  assert.ok(source.includes("106동 1동 105호"));
  const { rawUnitRecoveryVariants } = await import("../public/unit-match.mjs");
  const variants = rawUnitRecoveryVariants(
    "전북 전주시 완산구 효자동1가 799 효자동한신휴플러스아파트 106동 1동 105호",
    { dong: "1", ho: "105" }
  );
  assert.deepEqual(
    variants.filter((v) => v.source === "raw_duplicate_dong").map((v) => v.dong),
    ["106"]
  );
});
