from pathlib import Path

APP = Path("public/app.js")
MODULE = Path("public/batch-ui-stats.mjs")
TEST = Path("tests/test_batch_ui_stats.mjs")
STALE_WORKFLOW = Path(".github/workflows/apply-upload-source-stats-ui.yml")

source = APP.read_text(encoding="utf-8")

if not MODULE.exists():
    import_anchor = '''import {
  applyWorksheetLayout,
  buildVerifiedWorkbookArray,
  downloadWorkbookArray,
  recordsForMode
} from "./xlsx-integrity.mjs";
'''
    import_replacement = import_anchor + '''import {
  analyzeBatchUpload,
  buildSourceRawValues,
  summarizeRefineStatuses
} from "./batch-ui-stats.mjs";
'''
    assert import_anchor in source, "xlsx import anchor not found"
    source = source.replace(import_anchor, import_replacement, 1)

    stats_anchor = '''setExtraHeaders(extraHeaders2);

      // 실측(3만행 기준: XLSX.read 1,349ms / sheet_to_json 143ms / 이 루프'''
    stats_replacement = '''setExtraHeaders(extraHeaders2);

      // 화면 표시용 원문 통계만 분할 전 데이터에서 계산한다.
      // 실제 정제용 built/statMap은 그대로 유지해 판정·호출 결과에 영향을 주지 않는다.
      const sourceRawValues = buildSourceRawValues(body, addrIdx, detailIdx);

      // 실측(3만행 기준: XLSX.read 1,349ms / sheet_to_json 143ms / 이 루프'''
    assert stats_anchor in source, "source stats insertion anchor not found"
    source = source.replace(stats_anchor, stats_replacement, 1)

    old_max = '''      let maxGrp = 0;
      for (const v of statMap.values()) if (v > maxGrp) maxGrp = v;
'''
    assert old_max in source, "old max group block not found"
    source = source.replace(old_max, "", 1)

    old_set = '''      setUploadStats({
        total: built.length,
        uniq: statMap.size,
        maxGrp,
        empty: body.length - built.length,
        mapping: addrColIdx >= 0
'''
    new_set = '''      setUploadStats({
        ...analyzeBatchUpload(sourceRawValues, built.length, statMap.size, normalizeRawKey),
        mapping: addrColIdx >= 0
'''
    assert old_set in source, "old uploadStats object not found"
    source = source.replace(old_set, new_set, 1)

    old_metric = '''uploadStats && /* @__PURE__ */ React.createElement("p", { style: { fontSize: 12.5, color: C.dim, marginTop: 12, fontFamily: mono } }, `총 ${uploadStats.total.toLocaleString()}행 · 고유주소 ${uploadStats.uniq.toLocaleString()}건 · 최대 중복그룹 ${uploadStats.maxGrp.toLocaleString()}행` + (uploadStats.empty > 0 ? ` · 빈주소 ${uploadStats.empty.toLocaleString()}행 제외` : ""))'''
    new_metric = '''uploadStats && /* @__PURE__ */ React.createElement("div", { style: {
      width: "min(100%, 720px)",
      margin: "16px auto 0",
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
      gap: 8
    } }, [
      ["정제대상 원문", `${uploadStats.addressRows.toLocaleString()}행`, C.ink],
      ["실제 정제 호출", `${uploadStats.refineTargets.toLocaleString()}건`, C.cyan],
      ["중복 결과 재사용", `${uploadStats.duplicateReuse.toLocaleString()}행`, C.ok]
    ].map(([label, value, color]) => /* @__PURE__ */ React.createElement("div", { key: label, style: {
      padding: "10px 12px",
      border: `1px solid ${C.cardLine}`,
      borderRadius: 10,
      background: "rgba(11,14,20,0.34)",
      textAlign: "left"
    } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 10.5, color: C.faint, marginBottom: 4, letterSpacing: "0.04em" } }, label), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 15, color, fontFamily: mono, fontWeight: 700 } }, value)))), uploadStats && (uploadStats.emptyRows > 0 || uploadStats.refineRows !== uploadStats.addressRows) && /* @__PURE__ */ React.createElement("p", { style: { fontSize: 11.5, color: C.faint, margin: "8px 0 0", fontFamily: mono } }, [
      uploadStats.emptyRows > 0 ? `빈주소 ${uploadStats.emptyRows.toLocaleString()}행 제외` : "",
      uploadStats.refineRows !== uploadStats.addressRows ? `복수지번·세대 분리 후 처리행 ${uploadStats.refineRows.toLocaleString()}행` : ""
    ].filter(Boolean).join(" · "))'''
    assert old_metric in source, "old upload metric UI not found"
    source = source.replace(old_metric, new_metric, 1)

    old_progress = '''batchBusy ? `정제중 ${batchGroupTotal ? Math.round(batchGroupDone / batchGroupTotal * 100) : 0}% · 고유주소 ${batchGroupDone}/${batchGroupTotal} · 행 ${batchDone}/${rows.length}` : (batchDone > 0 && batchDone === rows.length ? `정제 완료 (${rows.length}건)` : `일괄 정제 (${rows.length}건)`)'''
    new_progress = '''batchBusy ? `정제중 ${batchGroupTotal ? Math.round(batchGroupDone / batchGroupTotal * 100) : 0}% · 처리단위 ${batchGroupDone}/${batchGroupTotal} · 반영 ${batchDone}/${rows.length}행` : (batchDone > 0 && batchDone === rows.length ? `정제 완료 (${rows.length}행)` : `일괄 정제 (${rows.length}행)`)'''
    assert old_progress in source, "batch progress label not found"
    source = source.replace(old_progress, new_progress, 1)

    for old, new in {
        '"중간결과 다운로드 (PARTIAL)"': '"현재까지 결과 다운로드"',
        '"중복제거 PARTIAL"': '"현재까지 중복제거 결과"',
        '"실패건 PARTIAL"': '"현재까지 실패건 결과"',
    }.items():
        assert old in source, f"download label not found: {old}"
        source = source.replace(old, new, 1)

    stat_anchor = '''  const stat = rows.reduce((acc, r) => {
    if (r.result) acc[r.result.status] = (acc[r.result.status] || 0) + 1;
    return acc;
  }, {});
  // 등기조회 결과 집계'''
    stat_replacement = '''  const stat = rows.reduce((acc, r) => {
    if (r.result) acc[r.result.status] = (acc[r.result.status] || 0) + 1;
    return acc;
  }, {});
  // 화면 합계 전용: 기능 로직용 stat은 그대로 두고 모든 종료상태를 3분류한다.
  const refineSummary = summarizeRefineStatuses(rows);
  // 등기조회 결과 집계'''
    assert stat_anchor in source, "status summary insertion anchor not found"
    source = source.replace(stat_anchor, stat_replacement, 1)

    old_counts = '"\\uD655\\uC815 ", stat.CONFIRMED || 0, " \\xB7 \\uD655\\uC778\\uD544\\uC694 ", stat.AMBIGUOUS || 0, " \\xB7 \\uC2E4\\uD328 ", stat.FAILED || 0'
    new_counts = '"\\uC815\\uC81C\\uB300\\uC0C1 ", refineSummary.total, " \\xB7 \\uD655\\uC815 ", refineSummary.confirmed, " \\xB7 \\uD655\\uC778\\uD544\\uC694 ", refineSummary.review, " \\xB7 \\uC2E4\\uD328 ", refineSummary.failed'
    assert old_counts in source, "display status counts anchor not found"
    source = source.replace(old_counts, new_counts, 1)

    APP.write_text(source, encoding="utf-8")

    MODULE.write_text('''const REVIEW_STATUSES = new Set([
  "NAVER_CONFIRMED_PNU_FAILED",
  "AMBIGUOUS",
  "VALIDATION_FAILED",
  "HUMAN_INPUT_ERROR"
]);

function normalizeRawKeyDefault(value) {
  return String(value ?? "").normalize("NFC").trim().replace(/\\s+/g, " ");
}

export function buildSourceRawValues(body, addrIdx = 0, detailIdx = -1) {
  return (body || []).map((row) => {
    const addr = String(row?.[addrIdx] ?? "").trim();
    const detail = detailIdx >= 0 ? String(row?.[detailIdx] ?? "").trim() : "";
    return detail ? `${addr} ${detail}`.replace(/\\s+/g, " ").trim() : addr;
  });
}

export function analyzeBatchUpload(rawValues, refineRows, refineTargets, normalizeKey = normalizeRawKeyDefault) {
  const values = Array.isArray(rawValues) ? rawValues : [];
  let addressRows = 0;
  for (const value of values) if (normalizeKey(value)) addressRows++;
  const safeRefineRows = Math.max(0, Number(refineRows) || 0);
  const safeRefineTargets = Math.max(0, Number(refineTargets) || 0);
  return {
    sourceRows: values.length,
    addressRows,
    emptyRows: Math.max(0, values.length - addressRows),
    refineRows: safeRefineRows,
    refineTargets: safeRefineTargets,
    duplicateReuse: Math.max(0, safeRefineRows - safeRefineTargets)
  };
}

export function summarizeRefineStatuses(rows) {
  const summary = { total: 0, confirmed: 0, review: 0, failed: 0 };
  for (const row of rows || []) {
    const status = row?.result?.status;
    if (!status) continue;
    summary.total++;
    if (status === "CONFIRMED" || status === "확정") summary.confirmed++;
    else if (REVIEW_STATUSES.has(status)) summary.review++;
    else summary.failed++;
  }
  return summary;
}
''', encoding="utf-8")

    TEST.write_text('''import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  analyzeBatchUpload,
  buildSourceRawValues,
  summarizeRefineStatuses
} from "../public/batch-ui-stats.mjs";

test("upload figures separate source rows, refine rows, and actual calls", () => {
  const source = ["서울 강남구 역삼동 1", " 서울   강남구 역삼동 1 ", "부산 해운대구 우동 2", ""];
  assert.deepEqual(analyzeBatchUpload(source, 3, 2), {
    sourceRows: 4,
    addressRows: 3,
    emptyRows: 1,
    refineRows: 3,
    refineTargets: 2,
    duplicateReuse: 1
  });
});

test("address and detail columns are combined once", () => {
  const values = buildSourceRawValues([
    ["서울 서초구 반포동 1", "101동 101호"],
    ["부산 기장군 기장읍 교리 271-8", ""]
  ], 0, 1);
  assert.deepEqual(values, ["서울 서초구 반포동 1 101동 101호", "부산 기장군 기장읍 교리 271-8"]);
});

test("all result statuses belong to exactly one display bucket", () => {
  const statuses = [
    "CONFIRMED",
    "NAVER_CONFIRMED_PNU_FAILED",
    "AMBIGUOUS",
    "VALIDATION_FAILED",
    "HUMAN_INPUT_ERROR",
    "SYSTEM_ERROR",
    "FAILED",
    "FUTURE_UNKNOWN_STATUS"
  ];
  const summary = summarizeRefineStatuses(statuses.map((status) => ({ result: { status } })));
  assert.deepEqual(summary, { total: 8, confirmed: 1, review: 4, failed: 3 });
  assert.equal(summary.confirmed + summary.review + summary.failed, summary.total);
});

test("functional status counts stay separate from display summary", async () => {
  const source = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
  for (const marker of [
    "const stat = rows.reduce",
    "const refineSummary = summarizeRefineStatuses(rows);",
    "정제대상 원문",
    "실제 정제 호출",
    "중복 결과 재사용",
    "refineSummary.confirmed",
    "현재까지 결과 다운로드"
  ]) assert.ok(source.includes(marker), marker);
  assert.equal(source.includes("최대 중복그룹"), false);
});
''', encoding="utf-8")

    hardening = Path("tests/test_iros_hardening.mjs")
    text = hardening.read_text(encoding="utf-8")
    if '"중간결과 다운로드 (PARTIAL)"' in text:
        hardening.write_text(text.replace('"중간결과 다운로드 (PARTIAL)"', '"현재까지 결과 다운로드"', 1), encoding="utf-8")

if STALE_WORKFLOW.exists():
    STALE_WORKFLOW.unlink()
