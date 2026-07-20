from pathlib import Path

APP = Path("public/app.js")
CONTRACT = Path("public/iros-run-contract.mjs")
TEST_IROS = Path("tests/test_iros_hardening.mjs")
TEST_INTEGRATION = Path("tests/test_address_recovery_integration.mjs")

app = APP.read_text(encoding="utf-8")
contract = CONTRACT.read_text(encoding="utf-8")
test_iros = TEST_IROS.read_text(encoding="utf-8")
test_integration = TEST_INTEGRATION.read_text(encoding="utf-8")


def replace_once(text, old, new, label):
    if new in text:
        return text
    if old not in text:
        raise AssertionError(f"anchor not found: {label}")
    return text.replace(old, new, 1)


# 1) IROS outcome KPI: terminal judgement and unique-number extraction are separate concepts.
contract_anchor = '''export function isIrosExportFinal(rows, current = IROS_RUN_VERSIONS) {
  return irosProgressStats(rows, current).final;
}
'''
contract_block = '''export function irosOutcomeStats(rows, current = IROS_RUN_VERSIONS) {
  const out = {
    addressConfirmed: 0,
    inputRequired: 0,
    target: 0,
    judged: 0,
    resolved: 0,
    multiple: 0,
    unitNotFound: 0,
    otherFailure: 0,
    stale: 0,
    retryable: 0,
    pendingRecovery: 0,
    retryRequired: 0,
    unstarted: 0,
    pending: 0
  };
  for (const row of rows || []) {
    const result = row?.result;
    if (!result || !["CONFIRMED", "확정"].includes(result.status)) continue;
    out.addressConfirmed += 1;
    if ((result.isJip && !result.unit?.ho) || row?.reg?.status === "UNIT_INPUT_REQUIRED") {
      out.inputRequired += 1;
      continue;
    }
    out.target += 1;
    const reg = row?.reg;
    if (!reg) continue;
    if (!isCurrentIrosResult(reg, current)) {
      out.stale += 1;
      continue;
    }
    if (reg.recovery_pending === true) {
      out.pendingRecovery += 1;
      continue;
    }
    if (isRetryableIrosStatus(reg.status)) {
      out.retryable += 1;
      continue;
    }
    if (!reg.status) continue;
    out.judged += 1;
    if (reg.status === "RESOLVED") out.resolved += 1;
    else if (reg.status === "REG_MULTI" || reg.status === "MULTIPLE") out.multiple += 1;
    else if (reg.status === "REG_UNIT_NOT_FOUND") out.unitNotFound += 1;
    else out.otherFailure += 1;
  }
  out.retryRequired = out.stale + out.retryable + out.pendingRecovery;
  out.pending = Math.max(0, out.target - out.judged);
  out.unstarted = Math.max(0, out.pending - out.retryRequired);
  return out;
}

export function isIrosExportFinal(rows, current = IROS_RUN_VERSIONS) {
  return irosProgressStats(rows, current).final;
}
'''
contract = replace_once(contract, contract_anchor, contract_block, "iros outcome stats")

# 2) Import the KPI helper without changing collector/matcher behavior.
app = replace_once(
    app,
    '''  buildIrosSnapshot,\n  irosProgressStats,\n  isCurrentIrosResult,''',
    '''  buildIrosSnapshot,\n  irosOutcomeStats,\n  irosProgressStats,\n  isCurrentIrosResult,''',
    "irosOutcomeStats import"
)

# 3) Preserve Naver's original jibun/road values in the result object for export diagnostics.
app = replace_once(
    app,
    '''            naverAddr,                                 // 진단: 네이버가 준 주소\n            naverPnuOk: !!cand.pnuOk,''',
    '''            naverAddr,                                 // 진단: 네이버가 준 주소\n            naverJibunAddr: top.address || "",\n            naverRoadAddr: top.roadAddress || "",\n            naverPnuOk: !!cand.pnuOk,''',
    "cascade Naver fields"
)
app = replace_once(
    app,
    '''  const { candidates, level, jusoQuery, count, humanInputError, naverAddr, naverPnuOk } = cascadeResult;''',
    '''  const { candidates, level, jusoQuery, count, humanInputError, naverAddr, naverJibunAddr, naverRoadAddr, naverPnuOk } = cascadeResult;''',
    "cascade destructure"
)
app = replace_once(
    app,
    '''        naverAddr,\n        message: `''',
    '''        naverAddr,\n        naverJibunAddr: naverJibunAddr || "",\n        naverRoadAddr: naverRoadAddr || "",\n        message: `''',
    "Naver PNU-failed export fields"
)
app = replace_once(
    app,
    '''  result.addressMatchEvidence = [...new Set([\n    ...(result.addressMatchEvidence || []),\n    ...(cascadeResult.addressMatchEvidence || [])\n  ])];\n  if (result.status === "CONFIRMED") {''',
    '''  result.addressMatchEvidence = [...new Set([\n    ...(result.addressMatchEvidence || []),\n    ...(cascadeResult.addressMatchEvidence || [])\n  ])];\n  result.naverAddr = naverAddr || "";\n  result.naverJibunAddr = naverJibunAddr || "";\n  result.naverRoadAddr = naverRoadAddr || "";\n  if (result.status === "CONFIRMED") {''',
    "confirmed Naver export fields"
)

# 4) Add export-only diagnostic columns. Existing PNU/IROS column indexes remain unchanged.
app = replace_once(
    app,
    '''        road: r.roadAddr || "",\n        dong: r.unit?.dong || "",''',
    '''        road: r.roadAddr || "",\n        naverJibun: r.naverJibunAddr || "",\n        naverRoad: r.naverRoadAddr || "",\n        irosInput: okStatus ? (r.jibunAddr || r.irosQuery || "") : "",\n        dong: r.unit?.dong || "",''',
    "record Naver/IROS fields"
)
app = replace_once(
    app,
    '''"주소매칭근거", "IROS전략"''',
    '''"주소매칭근거", "네이버지번주소", "네이버도로명주소", "최종IROS입력주소", "IROS전략"''',
    "diagnostic headers"
)
app = replace_once(
    app,
    '''    rec.addressMatchEvidence,\n    rec.irosStrategy,''',
    '''    rec.addressMatchEvidence,\n    rec.naverJibun,\n    rec.naverRoad,\n    rec.irosInput,\n    rec.irosStrategy,''',
    "diagnostic row fields"
)

# 5) Excel summary: address refinement and IROS outcomes are separate sections.
app = replace_once(
    app,
    '''    const uniq = new Set(ok.map((r) => r.pk).filter(Boolean)).size;''',
    '''    const iros = irosOutcomeStats(rows);\n    const uniq = new Set(ok.map((r) => r.pk).filter(Boolean)).size;''',
    "summary IROS stats"
)
app = replace_once(
    app,
    '''      ["\\uC911\\uBCF5 \\uC81C\\uAC70\\uB41C \\uAC74\\uC218", ok.length - uniq],\n      []\n    ];''',
    '''      ["\\uC911\\uBCF5 \\uC81C\\uAC70\\uB41C \\uAC74\\uC218", ok.length - uniq],\n      [],\n      ["[등기조회 집계]"],\n      ["주소확정", iros.addressConfirmed],\n      ["조회 가능", iros.target],\n      ["동·호 입력보완", iros.inputRequired],\n      ["조회 판정 완료", iros.judged],\n      ["고유번호 추출 성공", iros.resolved],\n      ["복수결과", iros.multiple],\n      ["세대미일치", iros.unitNotFound],\n      ["기타 실패", iros.otherFailure],\n      ["재시도 필요", iros.retryRequired],\n      ["미조회", iros.unstarted],\n      []\n    ];''',
    "IROS Excel summary"
)
app = app.replace("부동산 등기고유번호 정제·중복제거 결과", "주소정제·등기조회 결과", 1)
app = app.replace('mode2 === "fail" ? "실패·미확정"', 'mode2 === "fail" ? "확인필요·실패"', 1)

# 6) Screen KPI: judgement completion is not the same as unique-number extraction success.
old_reg_block = '''  // 등기조회 결과 집계(2026-07-15): 화면에 성공/다건/실패가 안 보여 추가.\n  const regStat = rows.reduce((acc, r) => {\n    const s = r.reg?.status;\n    if (!s) return acc;\n    if (s === "RESOLVED") acc.ok++;\n    else if (s === "REG_MULTI" || s === "MULTIPLE") acc.multi++;\n    else if (s === "REG_UNIT_NOT_FOUND") acc.unitNo++;\n    else acc.fail++;   // NOT_FOUND, SESSION_ERROR, RATE_LIMIT 등 전부\n    acc.done++;\n    return acc;\n  }, { ok: 0, multi: 0, unitNo: 0, fail: 0, done: 0 });\n  const irosProgress = irosProgressStats(rows);\n  const addressFinalReady = batchDone === rows.length;\n  const irosStarted = regStat.done > 0;'''
new_reg_block = '''  // 표시·요약 전용 IROS 집계. 수집·매칭·재개 판정에는 사용하지 않는다.\n  const irosOutcome = irosOutcomeStats(rows);\n  const regStat = {\n    ok: irosOutcome.resolved,\n    multi: irosOutcome.multiple,\n    unitNo: irosOutcome.unitNotFound,\n    fail: irosOutcome.otherFailure,\n    done: irosOutcome.judged\n  };\n  const irosProgress = irosProgressStats(rows);\n  const addressFinalReady = batchDone === rows.length;\n  const irosStarted = rows.some((row) => Boolean(row.reg));'''
app = replace_once(app, old_reg_block, new_reg_block, "screen IROS KPI")

app = replace_once(
    app,
    '''    stat.CONFIRMED || 0,\n    "건)"''',
    '''    irosOutcome.target,\n    "건)"''',
    "IROS lookup target count"
)

old_progress = '''irosFinalReady ? `✅ 등기고유번호 추출 완료 · ${irosProgress.done}/${irosProgress.total}건` : `등기고유번호 추출 · ${irosProgress.done}/${irosProgress.total}건 · 남은 ${irosProgress.remaining}건`'''
new_progress = '''irosFinalReady ? `✅ 등기조회 판정 완료 · ${irosOutcome.judged}/${irosOutcome.target}건 · 고유번호 ${irosOutcome.resolved}건` : `등기조회 판정 · ${irosOutcome.judged}/${irosOutcome.target}건 · 재시도 ${irosOutcome.retryRequired} · 미조회 ${irosOutcome.unstarted}`'''
app = replace_once(app, old_progress, new_progress, "IROS progress wording")

app = app.replace('(regStat.done > 0) &&', 'irosStarted &&', 1)
app = app.replace('`\\u2713 \\uC131\\uACF5 ${regStat.ok}`', '`\\u2713 고유번호 ${regStat.ok}`', 1)
app = app.replace('`\\u25C9 \\uB2E4\\uAC74 ${regStat.multi}`', '`\\u25C9 복수 ${regStat.multi}`', 1)
app = app.replace('`\\u2715 \\uC2E4\\uD328 ${regStat.fail}`', '`\\u2715 기타실패 ${regStat.fail}`', 1)

unit_span = '''regStat.unitNo > 0 && /* @__PURE__ */ React.createElement("span", { style: { color: C.warn } }, `\\u25C9 \\uC138\\uB300\\uBBF8\\uC77C\\uCE58 ${regStat.unitNo}`), /* @__PURE__ */ React.createElement("span", { style: { color: C.err } }, `\\u2715 기타실패 ${regStat.fail}`)'''
unit_span_new = '''regStat.unitNo > 0 && /* @__PURE__ */ React.createElement("span", { style: { color: C.warn } }, `\\u25C9 \\uC138\\uB300\\uBBF8\\uC77C\\uCE58 ${regStat.unitNo}`), irosOutcome.inputRequired > 0 && /* @__PURE__ */ React.createElement("span", { style: { color: C.warn } }, `\\u25C9 입력보완 ${irosOutcome.inputRequired}`), irosOutcome.retryRequired > 0 && /* @__PURE__ */ React.createElement("span", { style: { color: C.warn } }, `\\u25C9 재시도 ${irosOutcome.retryRequired}`), /* @__PURE__ */ React.createElement("span", { style: { color: C.err } }, `\\u2715 기타실패 ${regStat.fail}`)'''
app = replace_once(app, unit_span, unit_span_new, "IROS status details")

# 7) Tests: pure KPI invariant plus integration markers.
test_iros = replace_once(
    test_iros,
    '''  buildIrosSnapshot,\n  irosProgressStats,''',
    '''  buildIrosSnapshot,\n  irosOutcomeStats,\n  irosProgressStats,''',
    "test import"
)

test_anchor = '''test("snapshot persists all four IROS module versions and phase checkpoint", () => {'''
test_block = '''test("IROS judgement and unique-number extraction remain separate KPIs", () => {\n  const rows = [\n    confirmedRow(withIrosVersions({ status: "RESOLVED", unique_no: "1" })),\n    confirmedRow(withIrosVersions({ status: "REG_MULTI" })),\n    confirmedRow(withIrosVersions({ status: "REG_UNIT_NOT_FOUND" })),\n    confirmedRow(withIrosVersions({ status: "REG_NOT_FOUND" })),\n    confirmedRow(withIrosVersions({ status: "REG_PARTIAL_RESPONSE" })),\n    confirmedRow(null),\n    { result: { status: "CONFIRMED", isJip: true, unit: { dong: "101", ho: "" } }, reg: null }\n  ];\n  const outcome = irosOutcomeStats(rows);\n  assert.deepEqual({\n    addressConfirmed: outcome.addressConfirmed,\n    inputRequired: outcome.inputRequired,\n    target: outcome.target,\n    judged: outcome.judged,\n    resolved: outcome.resolved,\n    multiple: outcome.multiple,\n    unitNotFound: outcome.unitNotFound,\n    otherFailure: outcome.otherFailure,\n    retryRequired: outcome.retryRequired,\n    unstarted: outcome.unstarted\n  }, {\n    addressConfirmed: 7,\n    inputRequired: 1,\n    target: 6,\n    judged: 4,\n    resolved: 1,\n    multiple: 1,\n    unitNotFound: 1,\n    otherFailure: 1,\n    retryRequired: 1,\n    unstarted: 1\n  });\n  assert.equal(outcome.resolved + outcome.multiple + outcome.unitNotFound + outcome.otherFailure, outcome.judged);\n  assert.equal(outcome.judged + outcome.retryRequired + outcome.unstarted, outcome.target);\n});\n\ntest("snapshot persists all four IROS module versions and phase checkpoint", () => {'''
test_iros = replace_once(test_iros, test_anchor, test_block, "IROS KPI test")

test_iros = test_iros.replace('"기본 PNU ${batchBaseDone}/${batchBaseTotal}",', '"기본 PNU ${batchBaseDone}/${batchBaseTotal}",\n    "등기조회 판정 완료",\n    "네이버지번주소",', 1)

test_integration = test_integration.replace('    "등기고유번호 추출",', '    "등기고유번호 추출",\n    "등기조회 판정 완료",\n    "irosOutcomeStats(rows)",\n    "naverJibunAddr",\n    "네이버도로명주소",', 1)

APP.write_text(app, encoding="utf-8")
CONTRACT.write_text(contract, encoding="utf-8")
TEST_IROS.write_text(test_iros, encoding="utf-8")
TEST_INTEGRATION.write_text(test_integration, encoding="utf-8")
