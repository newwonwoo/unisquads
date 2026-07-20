from pathlib import Path

APP = Path("public/app.js")
TEST = Path("tests/test_address_recovery_integration.mjs")
source = APP.read_text(encoding="utf-8")


def replace_once(old, new, label):
    global source
    if old not in source:
        raise AssertionError(f"anchor not found: {label}")
    source = source.replace(old, new, 1)


# Pure decision rules: no changes to IROS or existing PNU collection logic.
import_anchor = '''import {
  analyzeBatchUpload,
  buildSourceRawValues,
  summarizeRefineStatuses
} from "./batch-ui-stats.mjs";
'''
replace_once(import_anchor, import_anchor + '''import {
  canAcceptNaverRegionCorrection,
  isBuildingPartToken,
  shouldEscalateJusoMultiToNaver
} from "./address-recovery-rules.mjs";
''', "address recovery import")

replace_once(
'''  for (const t of s.split(" ")) {
    if (RE_SGG.test(t) && out.sgg.length < 2 && !out.bjd) { out.sgg.push(t); continue; }
''',
'''  for (const t of s.split(" ")) {
    if (isBuildingPartToken(t)) continue;
    if (RE_SGG.test(t) && out.sgg.length < 2 && !out.bjd) { out.sgg.push(t); continue; }
''',
"extractRegion building part exclusion")

replace_once(
'''  const list = [...new Set(cands.map(norm))];
  return { eup, emd: list[0] || "", emdCands: list };
''',
'''  const list = [...new Set(cands.map(norm))].filter((x) => !isBuildingPartToken(x));
  return { eup, emd: list[0] || "", emdCands: list };
''',
"extractEupRi building part exclusion")

replace_once(
'''  if (!emd) { const p = s.match(/[（(]([가-힣]+(?:동|리|읍|면))[,，)）]/); if (p) emd = p[1]; }
  return { sgg, emd };
''',
'''  if (!emd) { const p = s.match(/[（(]([가-힣]+(?:동|리|읍|면))[,，)）]/); if (p) emd = p[1]; }
  if (isBuildingPartToken(emd)) emd = "";
  return { sgg, emd };
''',
"extractSggEmd building part exclusion")

replace_once(
'''  let items = [];
  if (!skipJuso) {
''',
'''  let items = [];
  let pendingJusoMulti = null;
  const deferJusoMulti = (mapped, level) => {
    if (!shouldEscalateJusoMultiToNaver(mapped.length, bldNameForGate)) return false;
    pendingJusoMulti = {
      candidates: mapped,
      level,
      jusoQuery: tried.join(" ▸ "),
      count: mapped.length
    };
    return true;
  };
  if (!skipJuso) {
''',
"deferred JUSO multi state")

replace_once(
'''      items = await safeCall(clients.juso, roadQuery);
      if (items.length > 0)
        return { candidates: items.map(fromJuso), level: "R1", jusoQuery: tried.join(" ▸ "), count: items.length };
''',
'''      items = await safeCall(clients.juso, roadQuery);
      if (items.length > 0) {
        const mapped = items.map(fromJuso);
        if (!deferJusoMulti(mapped, "R1"))
          return { candidates: mapped, level: "R1", jusoQuery: tried.join(" ▸ "), count: mapped.length };
      }
''',
"road JUSO multi escalation")

replace_once(
'''        if (!_multiRi)
          return { candidates: items.map(fromJuso), level: "J1", jusoQuery: tried.join(" ▸ "), count: items.length };
        _collected.push(...items);
''',
'''        if (!_multiRi) {
          const mapped = items.map(fromJuso);
          if (deferJusoMulti(mapped, "J1")) break;
          return { candidates: mapped, level: "J1", jusoQuery: tried.join(" ▸ "), count: mapped.length };
        }
        _collected.push(...items);
''',
"lot JUSO multi escalation")

replace_once(
'''        return { candidates: uniq.map(fromJuso), level: "J1", jusoQuery: tried.join(" ▸ "), count: uniq.length };
''',
'''        const mapped = uniq.map(fromJuso);
        if (!deferJusoMulti(mapped, "J1"))
          return { candidates: mapped, level: "J1", jusoQuery: tried.join(" ▸ "), count: mapped.length };
''',
"multi-ri JUSO escalation")

replace_once(
'''          return {
            candidates: [cand], level: "L3",
            jusoQuery: tried.join(" ▸ ") + " ▸ [네이버]" + bldName +
              (naverJusoQuery ? ` ▸ [PNU]${naverJusoQuery}` : ""),
            count: 1,
            naverAddr,                                 // 진단: 네이버가 준 주소
            naverPnuOk: !!cand.pnuOk,                  // PNU 확보 여부
            addressMatchEvidence: naverAddressMatchEvidence,
            reviewNeeded: _reviewNeeded,
          };
''',
'''          if (pendingJusoMulti) {
            const recoveredPnu = buildPnu(cand);
            const pendingPnus = new Set(pendingJusoMulti.candidates.map(buildPnu).filter(Boolean));
            if (_reviewNeeded || !recoveredPnu || !pendingPnus.has(recoveredPnu)) return pendingJusoMulti;
          }
          return {
            candidates: [cand], level: "L3",
            jusoQuery: tried.join(" ▸ ") + " ▸ [네이버]" + bldName +
              (naverJusoQuery ? ` ▸ [PNU]${naverJusoQuery}` : ""),
            count: 1,
            naverAddr,                                 // 진단: 네이버가 준 주소
            naverPnuOk: !!cand.pnuOk,                  // PNU 확보 여부
            addressMatchEvidence: naverAddressMatchEvidence,
            reviewNeeded: _reviewNeeded,
          };
''',
"Naver cross-check must belong to JUSO candidates")

replace_once(
'''      } else {
        // 3단계 모두 정상 호출 + 0건 → 인적 입력오류(보완사항 1: 시스템오류와 구분됨)
        return {
''',
'''      } else {
        if (pendingJusoMulti) return pendingJusoMulti;
        // 3단계 모두 정상 호출 + 0건 → 인적 입력오류(보완사항 1: 시스템오류와 구분됨)
        return {
''',
"Naver no-result fallback")

replace_once(
'''  return { candidates: [], level: null, jusoQuery: tried.join(" ▸ "), count: 0 };
}
function pad4(n) {
''',
'''  return pendingJusoMulti || { candidates: [], level: null, jusoQuery: tried.join(" ▸ "), count: 0 };
}
function pad4(n) {
''',
"final JUSO fallback")

replace_once(
'''    const v = validateRegion(pre.cleaned, result.jibunAddr, level === "L3", _rel);
    result.validation = v;
''',
'''    const v = validateRegion(pre.cleaned, result.jibunAddr, level === "L3", _rel);
    if (canAcceptNaverRegionCorrection({
      level,
      validation: v,
      naverPnuOk,
      reviewNeeded: result.reviewNeeded,
      addressMatchEvidence: result.addressMatchEvidence,
      inputBuildingName: pre.bldName,
      resultBuildingName: result.bdNm
    })) {
      v.status = "MATCH";
      v.reason = "네이버 단일후보·정확도로·PNU·건물명 일치로 원문 행정동 오류 교정";
      result.addressMatchEvidence = [...new Set([
        ...(result.addressMatchEvidence || []),
        "NAVER_EXACT_ADMIN_CORRECTION"
      ])];
    }
    result.validation = v;
''',
"narrow Naver administrative correction")

# Summary: confirmation-needed is not address failure, and confirmed rows without IROS are not 'not run' failures.
replace_once(
'''    const ok = recs.filter((r) => r.status === "확정" || r.status === "CONFIRMED");
    const uniq = new Set(ok.map((r) => r.pk).filter(Boolean)).size;
''',
'''    const ok = recs.filter((r) => r.status === "확정" || r.status === "CONFIRMED");
    const reviewStatuses = new Set(["AMBIGUOUS", "VALIDATION_FAILED", "NAVER_CONFIRMED_PNU_FAILED", "HUMAN_INPUT_ERROR"]);
    const review = recs.filter((r) => reviewStatuses.has(r.status));
    const failed = recs.filter((r) => !ok.includes(r) && !reviewStatuses.has(r.status));
    const uniq = new Set(ok.map((r) => r.pk).filter(Boolean)).size;
''',
"summary status buckets")

replace_once(
'''      ["정제 성공(확정)", ok.length],
      ["정제 실패", recs.length - ok.length],
      ["주소 정제율", refineRate],
''',
'''      ["정제 성공(확정)", ok.length],
      ["확인 필요", review.length],
      ["정제 실패", failed.length],
      ["주소 정제율", refineRate],
''',
"summary rows")

replace_once(
'''    for (const r of recs) {
      if ((r.status === "확정" || r.status === "CONFIRMED") && r.regNo) continue;
      const k = r.failCode || "미실행";
''',
'''    for (const r of recs) {
      if (r.status === "확정" || r.status === "CONFIRMED") continue;
      const k = r.failCode || "미분류";
''',
"failure reason summary")

replace_once(
'''    for (const rowIndex of [5, 6]) {
''',
'''    for (const rowIndex of [6, 7]) {
''',
"summary percentage rows")

# Address-only completion is final; PARTIAL is reserved for unfinished address work or started-but-incomplete IROS.
replace_once(
'''    const finalReady = batchDone === rows.length && isIrosExportFinal(rows);
    const partialSuffix = finalReady ? "" : "_PARTIAL";
''',
'''    const hasIrosResults = rows.some((row) => Boolean(row.reg));
    const finalReady = batchDone === rows.length && (!hasIrosResults || isIrosExportFinal(rows));
    const partialSuffix = finalReady ? "" : "_PARTIAL";
''',
"download final state")

replace_once(
'''    const baseName = mode2 === "unique" ? "정제결과_중복제거" : mode2 === "fail" ? "정제결과_실패건" : "정제결과_전체";
''',
'''    const prefix = hasIrosResults ? "정제결과" : "주소정제결과";
    const baseName = mode2 === "unique" ? `${prefix}_중복제거` : mode2 === "fail" ? `${prefix}_확인필요·실패건` : `${prefix}_전체`;
''',
"download filename")

replace_once(
'''  const irosProgress = irosProgressStats(rows);
  const exportFinalReady = batchDone === rows.length && isIrosExportFinal(rows);
''',
'''  const irosProgress = irosProgressStats(rows);
  const addressFinalReady = batchDone === rows.length;
  const irosStarted = regStat.done > 0;
  const irosFinalReady = irosStarted && isIrosExportFinal(rows);
  const exportFinalReady = addressFinalReady && (!irosStarted || irosFinalReady);
''',
"screen completion states")

replace_once(
'''/* @__PURE__ */ React.createElement("p", { style: { margin: "0 0 14px", fontSize: 13, color: C.dim } }, "xlsx / csv 파일의 ", /* @__PURE__ */ React.createElement("strong", { style: { color: C.ink } }, "A열"), "에 주소를 넣어 업로드하세요. 헤더 행은 자동 인식됩니다.")''',
'''/* @__PURE__ */ React.createElement("p", { style: { margin: "0 0 14px", fontSize: 13, color: C.dim } }, "xlsx / csv 파일을 업로드하세요. 주소 열과 헤더는 자동 인식됩니다.")''',
"upload instruction")

status_start = source.index('(!batchBusy && rows.length > 0 && batchDone === rows.length &&')
status_end = source.index(', batchRegBusy &&', status_start)
new_status = '''(!batchBusy && rows.length > 0 && addressFinalReady) && /* @__PURE__ */ React.createElement("p", { style: { width: "100%", textAlign: "center", fontSize: 13.5, color: C.ok, fontWeight: 600, margin: "4px 0 0" } }, `✅ 주소 정제 완료 · ${batchDone}/${rows.length}행 · 확정 ${refineSummary.confirmed} · 확인필요 ${refineSummary.review} · 실패 ${refineSummary.failed}`), irosStarted && !batchRegBusy && /* @__PURE__ */ React.createElement("p", { style: { width: "100%", textAlign: "center", fontSize: 13, color: irosFinalReady ? C.ok : C.warn, fontWeight: 600, margin: "2px 0 0" } }, irosFinalReady ? `✅ 등기고유번호 추출 완료 · ${irosProgress.done}/${irosProgress.total}건` : `등기고유번호 추출 · ${irosProgress.done}/${irosProgress.total}건 · 남은 ${irosProgress.remaining}건`)'''
source = source[:status_start] + new_status + source[status_end:]

replace_once(
'''    exportFinalReady ? "전체 다운로드" : "현재까지 결과 다운로드"
''',
'''    exportFinalReady ? (irosStarted ? "전체 결과 다운로드" : "주소정제 결과 다운로드") : "현재까지 결과 다운로드"
''',
"main download label")

replace_once(
'''    exportFinalReady ? "중복제거 다운로드" : "현재까지 중복제거 결과"
''',
'''    exportFinalReady ? "중복제거 결과 다운로드" : "현재까지 중복제거 결과"
''',
"dedupe download label")

replace_once(
'''    exportFinalReady ? "실패건 다운로드" : "현재까지 실패건 결과"
''',
'''    exportFinalReady ? "확인필요·실패건 다운로드" : "현재까지 확인필요·실패건"
''',
"failure download label")

APP.write_text(source, encoding="utf-8")

TEST.write_text('''import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("minimal address recovery integration is wired without IROS changes", async () => {
  const source = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
  for (const marker of [
    "shouldEscalateJusoMultiToNaver",
    "pendingJusoMulti",
    "isBuildingPartToken(t)",
    "NAVER_EXACT_ADMIN_CORRECTION",
    "확인 필요",
    "주소정제결과",
    "주소 열과 헤더는 자동 인식됩니다.",
    "주소 정제 완료",
    "등기고유번호 추출"
  ]) assert.ok(source.includes(marker), marker);
  assert.equal(source.includes("A열에 주소를 넣어 업로드하세요"), false);
  assert.equal(source.includes('const k = r.failCode || "미실행"'), false);
});
''', encoding="utf-8")
