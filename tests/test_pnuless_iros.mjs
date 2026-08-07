import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  PNULESS_ELIGIBLE_ADDRESS_STATUSES,
  PNULESS_IROS_VERSION,
  acceptReversePnu,
  applyReversePnu,
  buildPnulessIrosPlan,
  irosSojaeQuery,
  isPnulessIrosRow,
  lotScopedAddress,
  markReversePnuRejected,
  planReversePnuRecovery,
  pnulessProbeResult
} from "../public/pnuless-iros.mjs";
import { irosOutcomeStats, rowRequiresIros } from "../public/iros-run-contract.mjs";
import { classifyFailureModule } from "../public/failure-recovery-plan.mjs";

const naverRow = (overrides = {}) => ({
  rowId: "r1",
  raw: "부산 남구 대연동 100 삼성아파트 106동 1002호",
  result: {
    status: "NAVER_CONFIRMED_PNU_FAILED",
    pnu: null,
    jibunAddr: "부산광역시 남구 대연동 100 삼성아파트",
    naverJibunAddr: "부산광역시 남구 대연동 100",
    bdNm: "삼성아파트",
    unit: { dong: "106", ho: "1002" },
    ...overrides
  }
});

test("지번까지만 남기고 건물·동·호 표기는 조회주소에서 제거한다", () => {
  assert.equal(
    lotScopedAddress("부산광역시 남구 대연동 100 삼성아파트 제106동 제1002호"),
    "부산광역시 남구 대연동 100"
  );
  assert.equal(
    lotScopedAddress("경기도 양평군 양평읍 양근리 산 12-3 제1동"),
    "경기도 양평군 양평읍 양근리 산 12-3"
  );
  assert.equal(lotScopedAddress("건물명만 있고 지번이 없음"), "");
  assert.equal(lotScopedAddress(""), "");
});

test("네이버가 확인한 주소는 PNU 없이도 IROS 조회계획을 만든다", () => {
  const plan = buildPnulessIrosPlan(naverRow());
  assert.equal(plan.version, PNULESS_IROS_VERSION);
  assert.equal(plan.address, "부산광역시 남구 대연동 100");
  assert.equal(plan.addressSource, "jibunAddr");
  assert.equal(plan.dong, "106");
  assert.equal(plan.ho, "1002");
  assert.equal(plan.groupKey, "PNULESS:부산광역시 남구 대연동 100");
  assert.equal(plan.strictBuilding, true);
  assert.equal(isPnulessIrosRow(naverRow()), true);
});

test("호가 없거나 PNU가 이미 있거나 상태가 다르면 대상이 아니다", () => {
  assert.equal(buildPnulessIrosPlan(naverRow({ unit: { dong: "106", ho: "" } })), null);
  assert.equal(buildPnulessIrosPlan(naverRow({ pnu: "2629010100101000000" })), null);
  assert.equal(buildPnulessIrosPlan(naverRow({ status: "AMBIGUOUS" })), null);
  assert.equal(buildPnulessIrosPlan(naverRow({ status: "FAILED" })), null);
  assert.equal(buildPnulessIrosPlan(naverRow({ status: "HUMAN_INPUT_ERROR" })), null);
  for (const status of PNULESS_ELIGIBLE_ADDRESS_STATUSES) {
    assert.equal(isPnulessIrosRow(naverRow({ status })), true);
  }
});

test("조회주소가 없으면 네이버 지번주소로 내려간다", () => {
  const plan = buildPnulessIrosPlan(naverRow({ jibunAddr: "" }));
  assert.equal(plan.addressSource, "naverJibunAddr");
  assert.equal(plan.address, "부산광역시 남구 대연동 100");
});

test("임시 조회결과는 PNU를 비운 채 건물명 있을 때만 검토 플래그를 건다", () => {
  const row = naverRow();
  const probe = pnulessProbeResult(row.result, buildPnulessIrosPlan(row));
  assert.equal(probe.status, "CONFIRMED");
  assert.equal(probe.pnu, null);
  assert.equal(probe.isJip, true);
  assert.equal(probe.jibunAddr, "부산광역시 남구 대연동 100");
  assert.equal(probe.reviewNeeded, "pnuless_naver_address");

  const noName = naverRow({ bdNm: "" });
  const bare = pnulessProbeResult(noName.result, buildPnulessIrosPlan(noName));
  assert.equal(bare.reviewNeeded, null);
});

test("IROS 소재지에서 뽑은 역조회 질의어는 행정구역·지번뿐이다", () => {
  assert.equal(
    irosSojaeQuery({ sojae: "부산광역시 남구 대연동 100 삼성아파트 제106동 제10층 제1002호" }),
    "부산광역시 남구 대연동 100"
  );
  assert.equal(irosSojaeQuery({ add_item: "서울특별시 종로구 청운동 1-1" }), "서울특별시 종로구 청운동 1-1");
  assert.equal(irosSojaeQuery({ sojae: "" }), "");
});

test("소유자명이 섞인 문자열도 역조회 질의어에는 남지 않는다", () => {
  // 질의어는 `행정구역 + 지번` 정규식이 잘라낸 앞부분만 쓰므로, 뒤에 붙은
  // 어떤 개인정보도 구조적으로 전달되지 않는다.
  const query = irosSojaeQuery({
    sojae: "부산광역시 남구 대연동 100 삼성아파트 제106동 제1002호 소유자 홍길동 (900101-1234567)"
  });
  assert.equal(query, "부산광역시 남구 대연동 100");
  assert.equal(/홍길동|\d{6}-\d{7}|소유자/.test(query), false);
});

const irosCandidate = { unique_no: "1802-1996-123456", sojae: "부산광역시 남구 대연동 100 삼성아파트 제106동 제1002호" };
const jusoCandidate = {
  pnu: "2629010100101000000",
  jibunAddr: "부산광역시 남구 대연동 100",
  roadAddr: "부산광역시 남구 유엔로 100",
  bdNm: "삼성아파트",
  isJip: true
};

test("소재지·JUSO·조회주소 지번이 모두 같을 때만 PNU를 역확정한다", () => {
  const accepted = acceptReversePnu({
    irosCandidate,
    jusoCandidate,
    queryAddress: "부산광역시 남구 대연동 100"
  });
  assert.equal(accepted.ok, true);
  assert.equal(accepted.pnu, "2629010100101000000");
  assert.equal(accepted.reason, "IROS_SOJAE_JUSO_REVERSE_PNU");
});

test("역확정은 지번 불일치·PNU 부재·지번 이동을 각각 거절한다", () => {
  assert.equal(
    acceptReversePnu({ irosCandidate, jusoCandidate: { ...jusoCandidate, pnu: "" } }).reason,
    "JUSO_PNU_NOT_FOUND"
  );
  assert.equal(
    acceptReversePnu({
      irosCandidate,
      jusoCandidate: { ...jusoCandidate, jibunAddr: "부산광역시 남구 대연동 101" }
    }).reason,
    "JUSO_LOT_MISMATCH"
  );
  assert.equal(
    acceptReversePnu({
      irosCandidate,
      jusoCandidate,
      queryAddress: "부산광역시 남구 대연동 200"
    }).reason,
    "IROS_LOT_DRIFTED"
  );
  assert.equal(
    acceptReversePnu({ irosCandidate: { sojae: "지번 없음" }, jusoCandidate }).reason,
    "IROS_SOJAE_UNPARSABLE"
  );
  assert.equal(acceptReversePnu({ irosCandidate, jusoCandidate: null }).ok, false);
});

test("역확정 성공 행만 CONFIRMED로 승격하고 동·호는 보존한다", () => {
  const row = naverRow();
  const accepted = acceptReversePnu({ irosCandidate, jusoCandidate });
  const applied = applyReversePnu(row.result, {
    accepted,
    jusoCandidate,
    uniqueNo: "1802-1996-123456",
    jusoQuery: "부산광역시 남구 대연동 100"
  });
  assert.equal(applied.status, "CONFIRMED");
  assert.equal(applied.pnu, "2629010100101000000");
  assert.deepEqual(applied.unit, { dong: "106", ho: "1002" });
  assert.equal(applied.addressMatchEvidence.includes("IROS_SOJAE_JUSO_REVERSE_PNU"), true);
  assert.equal(applied.pnulessRecovery.unique_no, "1802-1996-123456");
  assert.equal(applied.validation.status, "MATCH");

  assert.equal(applyReversePnu(row.result, { accepted: { ok: false } }), null);
});

test("역확정 실패는 사유만 남기고 주소 상태를 바꾸지 않는다", () => {
  const row = naverRow();
  const marked = markReversePnuRejected(row.result, "JUSO_LOT_MISMATCH");
  assert.equal(marked.status, "NAVER_CONFIRMED_PNU_FAILED");
  assert.equal(marked.pnu, null);
  assert.equal(marked.pnulessRecovery.recovered_pnu, "");
  assert.equal(marked.pnulessRecovery.rejected_reason, "JUSO_LOT_MISMATCH");
});

test("역확정 대상은 고유번호가 확정된 미처리 행만이다", () => {
  const base = naverRow();
  const resolved = {
    ...base,
    reg: { status: "RESOLVED", unique_no: "1802-1996-123456", candidates: [irosCandidate] }
  };
  assert.equal(planReversePnuRecovery([resolved]).length, 1);
  assert.equal(planReversePnuRecovery([{ ...base, reg: { status: "REG_MULTI" } }]).length, 0);
  assert.equal(planReversePnuRecovery([{ ...base, reg: { status: "RESOLVED", unique_no: "" } }]).length, 0);

  const alreadyTried = {
    ...resolved,
    result: { ...base.result, pnulessRecovery: { version: PNULESS_IROS_VERSION, rejected_reason: "JUSO_PNU_NOT_FOUND" } }
  };
  assert.equal(planReversePnuRecovery([alreadyTried]).length, 0);
});

test("실행계약과 집계가 PNU 없는 행을 별도 축으로 인식한다", () => {
  const row = naverRow();
  assert.equal(rowRequiresIros(row), true);
  assert.equal(rowRequiresIros(naverRow({ unit: { dong: "106", ho: "" } })), false);

  const stats = irosOutcomeStats([
    { ...row, reg: { status: "RESOLVED", unique_no: "A", candidates: [irosCandidate] } },
    { ...row, rowId: "r2", reg: { status: "REG_UNIT_NOT_FOUND" } },
    {
      rowId: "r3",
      result: {
        status: "CONFIRMED",
        pnu: "2629010100101000000",
        unit: { ho: "1002" },
        pnulessRecovery: { version: PNULESS_IROS_VERSION, recovered_pnu: "2629010100101000000" }
      },
      reg: { status: "RESOLVED", unique_no: "B" }
    }
  ]);
  assert.equal(stats.pnulessTarget, 2);
  assert.equal(stats.pnulessResolved, 1);
  assert.equal(stats.pnuReverseRecovered, 1);
  // 주소확정 기준 집계는 흔들리지 않는다.
  assert.equal(stats.addressConfirmed, 1);
  assert.equal(stats.resolved, 1);
});

test("실패 분류가 PNU 없는 조회와 소재지 역확정을 구분한다", () => {
  // 직접 PNU 재조회(R-ADDR-NAVER-PNU-EXACT)가 먼저다. 그 경로가 이미 끝난
  // 행에서만 PNU 없는 IROS 조회가 다음 조치로 올라온다.
  const pending = naverRow();
  assert.equal(classifyFailureModule(pending).id, "R-ADDR-NAVER-PNU-EXACT");

  const row = naverRow({ naverPnuRecoveryVersion: "1" });
  assert.equal(classifyFailureModule(row).id, "R-IROS-PNULESS-ADDRESS");
  assert.equal(
    classifyFailureModule({
      ...row,
      reg: { status: "RESOLVED", unique_no: "1802-1996-123456", candidates: [irosCandidate] }
    }).id,
    "R-ADDR-IROS-SOJAE-REVERSE-PNU"
  );
});

test("배치가 PNU 없는 계획과 두 후처리를 실제로 연결한다", async () => {
  const source = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
  for (const marker of [
    "buildPnulessIrosPlan(row)",
    "pnulessProbeResult(t.row.result, t.pnulessPlan)",
    "groups.set(t.pnulessPlan.groupKey, [])",
    "loadCollection(pnuKey, members[0].row, groupAddress)",
    "matchMember(member, collection, groupAddress)",
    "planVerifiedUnitPropagation(next)",
    "planReversePnuRecovery(next)",
    "recoverJusoCandidateForNaver(target.query, clients)"
  ]) {
    assert.ok(source.includes(marker), marker);
  }
  // 역확정 경로에 소유자 인자가 끼어들지 않는다.
  assert.equal(/recoverJusoCandidateForNaver\([^)]*owner/i.test(source), false);
});

test("동 무시 재매칭은 프로파일 복구가 실패한 뒤 마지막에만 시도한다", async () => {
  // 사다리 순서는 unit-decision.mjs가, 그 결과를 쓰는 곳은 app.js가 갖는다.
  const decision = await readFile(new URL("../public/unit-decision.mjs", import.meta.url), "utf8");
  const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
  const profile = decision.indexOf("matchUnitByBuildingProfile(");
  const agnostic = decision.indexOf("selectDongAgnosticHoCandidate(source");
  assert.notEqual(agnostic, -1);
  assert.equal(profile < agnostic, true);
  // 판정이 끝난 뒤에만 미일치 응답을 만든다.
  const call = app.indexOf("decideUnitCandidates({");
  const notFound = app.indexOf('status: (wantDong || wantHo) ? "REG_UNIT_NOT_FOUND"');
  assert.equal(call < notFound, true);
  assert.ok(app.includes("dong_agnostic_recovery: dongAgnosticRecovery"));
});

test("배치 내 확정 지번 색인이 JUSO 호출을 대체한다", async () => {
  const { buildConfirmedLotPnuIndex, lotIndexJusoCandidate } =
    await import("../public/pnuless-iros.mjs");
  const index = buildConfirmedLotPnuIndex([
    { result: { status: "CONFIRMED", pnu: "2629010100101000000", jibunAddr: "부산광역시 남구 대연동 100 삼성아파트", roadAddr: "부산광역시 남구 유엔로 100", bdNm: "삼성아파트" } },
    { result: { status: "확정", pnu: "2629010100101000000", jibunAddr: "부산광역시 남구 대연동 100" } }
  ]);
  const hit = lotIndexJusoCandidate(irosCandidate, index);
  assert.equal(hit.candidate.pnu, "2629010100101000000");
  assert.equal(hit.candidate.source_row_count, 2);
  assert.equal(hit.source, "confirmed_lot_index");

  // 색인 적중분도 네트워크 경로와 똑같은 검증을 통과해야 한다.
  const accepted = acceptReversePnu({
    irosCandidate,
    jusoCandidate: hit.candidate,
    queryAddress: "부산광역시 남구 대연동 100"
  });
  assert.equal(accepted.ok, true);

  // 미확정 행·PNU 없는 행은 색인에 들어가지 않는다.
  assert.equal(buildConfirmedLotPnuIndex([
    { result: { status: "NAVER_CONFIRMED_PNU_FAILED", pnu: null, jibunAddr: "부산광역시 남구 대연동 100" } }
  ]).size, 0);
  assert.equal(lotIndexJusoCandidate(irosCandidate, new Map()), null);
});

test("배치가 색인을 JUSO보다 먼저 시도한다", async () => {
  const source = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
  const indexHit = source.indexOf("lotIndexJusoCandidate(target.irosCandidate, confirmedLotIndex)");
  const juso = source.indexOf("recoverJusoCandidateForNaver(target.query, clients)");
  assert.notEqual(indexHit, -1);
  assert.equal(indexHit < juso, true);
  assert.ok(source.includes('recovered.source !== "confirmed_lot_index"'));
});
