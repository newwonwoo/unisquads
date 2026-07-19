from __future__ import annotations

import re
from pathlib import Path

APP = Path("public/app.js")


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected 1 occurrence, found {count}")
    return text.replace(old, new, 1)


def regex_once(text: str, pattern: str, replacement: str, label: str, flags: int = 0) -> str:
    updated, count = re.subn(pattern, replacement, text, count=1, flags=flags)
    if count != 1:
        raise RuntimeError(f"{label}: expected 1 regex match, found {count}")
    return updated


def patch_lookup_block(block: str) -> str:
    block = replace_once(
        block,
        """    const next = rows.map((row) => ({
      ...row,
      result: row.result ? cloneResult(row.result) : null,
      reg: row.reg ? cloneResult(row.reg) : row.reg
    }));""",
        """    const next = markStaleIrosRows(rows).map((row) => ({
      ...row,
      result: row.result ? cloneResult(row.result) : null,
      reg: row.reg ? cloneResult(row.reg) : row.reg
    }));""",
        "lookup: stale marking",
    )

    block = regex_once(
        block,
        r"    const targets = \[\];\n    const nowText = \(\) => new Date\(\)\.toISOString\(\)\.slice\(0, 19\)\.replace\(\"T\", \" \"\);\n\n    // 집합건물인데 호가 없으면 IROS 실패로 보내지 않고 입력보완 대상으로 분리\.\n    for \(let idx = 0; idx < next\.length; idx\+\+\) \{.*?      targets\.push\(\{ idx, row \}\);\n    \}\n    if \(targets\.length === 0\) \{",
        """    const targets = [];
    const pendingAlternateGroups = new Map();
    const nowText = () => new Date().toISOString().slice(0, 19).replace("T", " ");
    const addPendingAlternate = (address, member) => {
      if (!address) return;
      if (!pendingAlternateGroups.has(address)) pendingAlternateGroups.set(address, []);
      const members = pendingAlternateGroups.get(address);
      if (!members.some((item) => item.idx === member.idx)) members.push(member);
    };

    // 집합건물인데 호가 없으면 IROS 실패로 보내지 않고 입력보완 대상으로 분리.
    // 현재 실행계약으로 완료된 결과는 즉시 건너뛰고, 구버전·부분응답·서비스오류만 재처리한다.
    for (let idx = 0; idx < next.length; idx++) {
      const row = next[idx];
      if (row.result?.status !== "CONFIRMED") continue;
      if (row.result.isJip && !row.result.unit?.ho) {
        next[idx] = {
          ...row,
          reg: withIrosVersions({
            status: "UNIT_INPUT_REQUIRED",
            message: "집합건물 등기 조회에는 호 입력이 필요합니다.",
            at: nowText()
          })
        };
        continue;
      }
      if (isReusableIrosResult(row.reg)) continue;
      if (isCurrentIrosResult(row.reg) && row.reg?.recovery_pending && row.reg?.recovery_address) {
        addPendingAlternate(row.reg.recovery_address, { idx, row });
        continue;
      }
      targets.push({ idx, row });
    }
    const initialIrosProgress = irosProgressStats(next);
    setBatchUnitTotal(initialIrosProgress.total);
    setBatchUnitDone(initialIrosProgress.done);
    setBatchTotal(initialIrosProgress.total);
    setBatchRegDone(initialIrosProgress.done);
    if (targets.length === 0 && pendingAlternateGroups.size === 0) {""",
        "lookup: target selection",
        flags=re.S,
    )

    block = replace_once(
        block,
        """      setRows([...next]);
      await idbSet(BATCH_KEY, { v: 2, rows: next, extraHeaders });
      return;""",
        """      setRows([...next]);
      await idbSet(BATCH_KEY, buildIrosSnapshot(next, extraHeaders, {
        phase: "complete",
        baseDone: 0,
        baseTotal: 0,
        alternateDone: 0,
        alternateTotal: 0,
        unitDone: initialIrosProgress.done,
        unitTotal: initialIrosProgress.total,
        interrupted: false
      }));
      return;""",
        "lookup: no-work snapshot",
    )

    block = replace_once(
        block,
        """    setBatchRegBusy(true);
    setBatchRegDone(0);
    setBatchStop(false);
    batchStopRef.current = false;

    // 배치는 세대가 아니라 PNU 단위. PNU가 없을 때만 정규화 지번주소를 임시 키로 쓴다.""",
        """    setBatchRegBusy(true);
    setBatchStop(false);
    batchStopRef.current = false;
    setBatchBaseDone(0);
    setBatchBaseTotal(0);
    setBatchAltDone(0);
    setBatchAltTotal(0);
    setIrosRunMessage("");
    const runState = {
      phase: "prepare",
      baseDone: 0,
      baseTotal: 0,
      alternateDone: 0,
      alternateTotal: 0,
      unitDone: initialIrosProgress.done,
      unitTotal: initialIrosProgress.total,
      interrupted: false,
      reason: ""
    };
    const checkpoint = async (patch = {}) => {
      Object.assign(runState, patch);
      const progress = irosProgressStats(next);
      runState.unitDone = progress.done;
      runState.unitTotal = progress.total;
      setBatchUnitDone(progress.done);
      setBatchUnitTotal(progress.total);
      setBatchRegDone(progress.done);
      setBatchTotal(progress.total);
      setRows([...next]);
      await idbSet(BATCH_KEY, buildIrosSnapshot(next, extraHeaders, runState));
    };

    try {
    // 배치는 세대가 아니라 PNU 단위. PNU가 없을 때만 정규화 지번주소를 임시 키로 쓴다.""",
        "lookup: try checkpoint",
    )

    block = replace_once(
        block,
        """    const pnuKeys = [...groups.keys()];
    setBatchTotal(pnuKeys.length);""",
        """    const pnuKeys = [...groups.keys()];
    setBatchBaseTotal(pnuKeys.length);
    runState.baseTotal = pnuKeys.length;""",
        "lookup: base total",
    )

    block = replace_once(
        block,
        """    const collectorVersion = "iros-collector-v4";
    const parserVersion = "iros-parser-v4";""",
        """    const collectorVersion = IROS_RUN_VERSIONS.collector;
    const parserVersion = IROS_RUN_VERSIONS.parser;""",
        "lookup: version constants",
    )

    block = replace_once(
        block,
        """      matcher_version: MATCHER_VERSION,
      fetched_at: collection.fetched_at || """"",
        """      matcher_version: MATCHER_VERSION,
      recovery_version: IROS_RUN_VERSIONS.recovery,
      fetched_at: collection.fetched_at || """"",
        "lookup: audit recovery version",
    )

    block = replace_once(
        block,
        """      if (!cacheUsable || !fresh || collection.parser_version !== parserVersion ||
          collection.collector_version !== collectorVersion) {""",
        """      const cacheHit = Boolean(cacheUsable && fresh &&
        collection.parser_version === parserVersion &&
        collection.collector_version === collectorVersion);
      if (!cacheHit) {""",
        "lookup: cache hit",
    )

    block = replace_once(
        block,
        """      return collection;
    };""",
        """      return { collection, cacheHit };
    };""",
        "lookup: collection return",
    )

    block = replace_once(
        block,
        """      return { ...matchedResult, ...collectionAudit(collection) };
    };""",
        """      return withIrosVersions({ ...matchedResult, ...collectionAudit(collection) });
    };""",
        "lookup: matched versioning",
    )

    block = regex_once(
        block,
        r"    const alternateGroups = /\* @__PURE__ \*/ new Map\(\);\n    for \(let g = 0; g < pnuKeys\.length; g\+\+\) \{.*?\n    \}\n\n    const alternateEntries = \[\.\.\.alternateGroups\.entries\(\)\];",
        """    const alternateGroups = /* @__PURE__ */ new Map();
    const addAlternateMember = (address, member) => {
      if (!address) return;
      if (!alternateGroups.has(address)) alternateGroups.set(address, []);
      const members = alternateGroups.get(address);
      if (!members.some((item) => item.idx === member.idx)) members.push(member);
    };
    for (const [address, members] of pendingAlternateGroups.entries()) {
      for (const member of members) addAlternateMember(address, member);
    }

    for (let g = 0; g < pnuKeys.length; g++) {
      if (batchStopRef.current) break;
      const pnuKey = pnuKeys[g];
      const members = groups.get(pnuKey);
      const { collection, cacheHit } = await loadCollection(pnuKey, members[0].row);

      for (const member of members) {
        let reg = await matchMember(member, collection);
        if (reg.status === "REG_UNIT_NOT_FOUND") {
          const normalizedAddress = member.row.result.jibunAddr || member.row.result.irosQuery || "";
          const alternateAddress = alternateRawLotAddress(member.row.raw, normalizedAddress);
          if (alternateAddress) {
            reg = withIrosVersions({
              ...reg,
              recovery_pending: true,
              recovery_address: alternateAddress,
              recovery_attempted: false
            });
            addAlternateMember(alternateAddress, member);
          }
        }
        next[member.idx] = { ...next[member.idx], reg };
      }
      recordRegHealth(collection.status || (collection.complete ? "RESOLVED" : "REG_PARTIAL_RESPONSE"));
      setBatchBaseDone(g + 1);
      await checkpoint({ phase: "base", baseDone: g + 1, baseTotal: pnuKeys.length });
      if (!cacheHit && g < pnuKeys.length - 1 && !batchStopRef.current)
        await new Promise((res) => setTimeout(res, 1e3));
    }

    const alternateEntries = [...alternateGroups.entries()];""",
        "lookup: base phase",
        flags=re.S,
    )

    block = regex_once(
        block,
        r"    setBatchTotal\(pnuKeys\.length \+ alternateEntries\.length\);\n    for \(let a = 0; a < alternateEntries\.length; a\+\+\) \{.*?\n    \}\n\n    setRows\(\[\.\.\.next\]\);\n    await idbSet\(BATCH_KEY, \{ v: 2, rows: next, extraHeaders \}\);\n    setBatchRegBusy\(false\);",
        """    setBatchAltTotal(alternateEntries.length);
    runState.alternateTotal = alternateEntries.length;
    for (let a = 0; a < alternateEntries.length; a++) {
      if (batchStopRef.current) break;
      const [alternateAddress, members] = alternateEntries[a];
      const identity = `ALTLOT:${alternateAddress}`;
      const { collection, cacheHit } = await loadCollection(identity, members[0].row, alternateAddress);
      for (const member of members) {
        const prior = next[member.idx].reg || member.row.reg || {};
        const recovered = await matchMember(member, collection, alternateAddress);
        if (recovered.status === "RESOLVED" || recovered.status === "REG_MULTI") {
          const moduleTag = `R-IROS-MULTILOT@${IROS_MODULE_VERSIONS.R_IROS_MULTILOT}`;
          const appliedModules = [...(recovered.applied_modules || [])];
          if (!appliedModules.includes(moduleTag)) appliedModules.push(moduleTag);
          next[member.idx] = {
            ...next[member.idx],
            reg: withIrosVersions({
              ...recovered,
              applied_modules: appliedModules,
              recovery_module: moduleTag,
              recovery_address: alternateAddress,
              recovery_pending: false,
              recovery_attempted: true,
              message: recovered.status === "RESOLVED"
                ? "원문 대체지번 완전후보에서 동·호 일치"
                : recovered.message
            })
          };
        } else if (isRetryableIrosStatus(recovered.status)) {
          next[member.idx] = {
            ...next[member.idx],
            reg: withIrosVersions({
              ...prior,
              recovery_pending: true,
              recovery_address: alternateAddress,
              recovery_attempted: true,
              recovery_error_status: recovered.status,
              recovery_error_message: recovered.message || ""
            })
          };
        } else {
          next[member.idx] = {
            ...next[member.idx],
            reg: withIrosVersions({
              ...prior,
              recovery_pending: false,
              recovery_address: alternateAddress,
              recovery_attempted: true,
              recovery_result_status: recovered.status,
              recovery_result_message: recovered.message || ""
            })
          };
        }
      }
      recordRegHealth(collection.status || (collection.complete ? "RESOLVED" : "REG_PARTIAL_RESPONSE"));
      setBatchAltDone(a + 1);
      await checkpoint({
        phase: "alternate",
        baseDone: pnuKeys.length,
        baseTotal: pnuKeys.length,
        alternateDone: a + 1,
        alternateTotal: alternateEntries.length
      });
      if (!cacheHit && a < alternateEntries.length - 1 && !batchStopRef.current)
        await new Promise((res) => setTimeout(res, 1e3));
    }

    const finalProgress = irosProgressStats(next);
    const interrupted = batchStopRef.current || !finalProgress.final;
    await checkpoint({
      phase: interrupted ? "interrupted" : "complete",
      baseDone: Math.min(pnuKeys.length, runState.baseDone || pnuKeys.length),
      baseTotal: pnuKeys.length,
      alternateDone: Math.min(alternateEntries.length, runState.alternateDone || alternateEntries.length),
      alternateTotal: alternateEntries.length,
      interrupted,
      reason: batchStopRef.current ? "USER_STOP" : (finalProgress.final ? "" : "RETRY_REQUIRED")
    });
    setIrosRunMessage(interrupted
      ? `재개 가능 · 남은 세대 ${finalProgress.remaining}건`
      : `현재 버전 검증 완료 · ${finalProgress.done}/${finalProgress.total}건`);
    } catch (error) {
      const reason = error?.message || String(error);
      setIrosRunMessage(`중단 사유: ${reason}`);
      try {
        await checkpoint({ phase: "interrupted", interrupted: true, reason });
      } catch {
        // 체크포인트 저장 실패는 원래 오류를 가리지 않는다.
      }
    } finally {
      setBatchRegBusy(false);
    }""",
        "lookup: alternate phase and finally",
        flags=re.S,
    )

    return block


def main() -> None:
    text = APP.read_text(encoding="utf-8")

    text = replace_once(
        text,
        """import {
  findAdminSuccessor,
  findOldAdminTokens,
  modernizeKnownAdminTokens
} from "./admin-successor.mjs";""",
        """import {
  findAdminSuccessor,
  findOldAdminTokens,
  modernizeKnownAdminTokens
} from "./admin-successor.mjs";
import {
  IROS_RUN_VERSIONS,
  buildIrosSnapshot,
  irosProgressStats,
  isCurrentIrosResult,
  isIrosExportFinal,
  isRetryableIrosStatus,
  isReusableIrosResult,
  markStaleIrosRows,
  withIrosVersions
} from "./iros-run-contract.mjs";
import {
  applyWorksheetLayout,
  buildVerifiedWorkbookArray,
  downloadWorkbookArray,
  recordsForMode
} from "./xlsx-integrity.mjs";""",
        "imports",
    )

    text = replace_once(
        text,
        """  const [batchRegDone, setBatchRegDone] = useState(0);
  const [batchTotal, setBatchTotal] = useState(0);
  const [savedProgress, setSavedProgress] = useState(null);""",
        """  const [batchRegDone, setBatchRegDone] = useState(0);
  const [batchTotal, setBatchTotal] = useState(0);
  const [batchBaseDone, setBatchBaseDone] = useState(0);
  const [batchBaseTotal, setBatchBaseTotal] = useState(0);
  const [batchAltDone, setBatchAltDone] = useState(0);
  const [batchAltTotal, setBatchAltTotal] = useState(0);
  const [batchUnitDone, setBatchUnitDone] = useState(0);
  const [batchUnitTotal, setBatchUnitTotal] = useState(0);
  const [irosRunMessage, setIrosRunMessage] = useState("");
  const [savedProgress, setSavedProgress] = useState(null);""",
        "state",
    )

    start = text.index("  const lookupBatchUniqueNo = useCallback(async () => {")
    end = text.index("  const stopBatch = useCallback(() => {", start)
    patched_lookup = patch_lookup_block(text[start:end])
    text = text[:start] + patched_lookup + text[end:]

    text = replace_once(
        text,
        """          setSavedProgress({ count: savedRows.length, refined, looked });""",
        """          const iros = irosProgressStats(markStaleIrosRows(savedRows));
          setSavedProgress({
            count: savedRows.length,
            refined,
            looked,
            stale: iros.stale,
            retryable: iros.retryable,
            pendingRecovery: iros.pendingRecovery,
            irosVersions: saved?.irosVersions || null
          });""",
        "saved progress metadata",
    )

    text = regex_once(
        text,
        r"    if \(savedRows\) \{\n      setRows\(savedRows\);.*?      setBatchDone\(savedRows\.filter\(\(r\) => r\.result\)\.length\);\n      setTab\(\"batch\"\);\n    \}",
        """    if (savedRows) {
      const resumedRows = markStaleIrosRows(savedRows);
      setRows(resumedRows);
      // extraHeaders(부동산번호 등 원본 컬럼명)도 함께 복원.
      if (!Array.isArray(saved) && Array.isArray(saved.extraHeaders)) {
        setExtraHeaders(saved.extraHeaders);
      }
      setBatchDone(resumedRows.filter((r) => r.result).length);
      const progress = irosProgressStats(resumedRows);
      setBatchRegDone(progress.done);
      setBatchTotal(progress.total);
      setBatchUnitDone(progress.done);
      setBatchUnitTotal(progress.total);
      if (!Array.isArray(saved) && saved.rosRun) {
        setBatchBaseDone(saved.irosRun.baseDone || 0);
        setBatchBaseTotal(saved.irosRun.baseTotal || 0);
        setBatchAltDone(saved.irosRun.alternateDone || 0);
        setBatchAltTotal(saved.irosRun.alternateTotal || 0);
      }
      if (progress.stale > 0) {
        setFileErr(`구버전 IROS 결과 ${progress.stale}건 — 현재 매처로 재검증해야 최종 다운로드가 가능합니다.`);
      }
      setTab("batch");
    }""".replace("saved.rosRun", "saved.irosRun"),
        "resume stale handling",
        flags=re.S,
    )

    text = regex_once(
        text,
        r"    ws\[\"!cols\"\] = \[\n      \.\.\.extraHeaders\.map\(\(\) => 14\),.*?    ws\[\"!freeze\"\] = \{ xSplit: 0, ySplit: 1 \};",
        """    applyWorksheetLayout(XLSX, ws, head);""",
        "worksheet all-column layout",
        flags=re.S,
    )

    text = regex_once(
        text,
        r"  const downloadXlsx = useCallback\(\(mode2\) => \{.*?  \}, \[rows, extraHeaders\]\);\n  const stat =",
        """  const downloadXlsx = useCallback(async (mode2) => {
    if (batchBusy || batchRegBusy) {
      alert("처리 중에는 일반 다운로드를 할 수 없습니다. 작업을 중단하거나 완료한 뒤 내려받아주세요.");
      return;
    }
    const recs = buildRecords();
    // 무결성 검증(다중집합 비교): 출력 순서와 무관하게 원본주소+원본열이 1:1인지 확인.
    {
      const sig = (raw, extra) => raw + "\\u0001" + JSON.stringify(extra || []);
      const cnt = new Map();
      for (const row of rows) {
        const s = sig(row.raw, row.extra);
        cnt.set(s, (cnt.get(s) || 0) + 1);
      }
      let broken = recs.length !== rows.length;
      if (!broken) for (const rec of recs) {
        const s = sig(rec.raw, rec.extra);
        const c = cnt.get(s);
        if (!c) { broken = true; break; }
        cnt.set(s, c - 1);
      }
      if (!broken) for (const value of cnt.values()) if (value !== 0) { broken = true; break; }
      if (broken) {
        alert(`무결성 오류: 업로드 원본과 결과가 1:1로 대응하지 않습니다 (업로드 ${rows.length}행 / 결과 ${recs.length}행). 다운로드를 중단합니다.`);
        return;
      }
    }

    const finalReady = batchDone === rows.length && isIrosExportFinal(rows);
    const partialSuffix = finalReady ? "" : "_PARTIAL";
    const detailRecords = recordsForMode(recs, mode2);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, makeSummary(recs), "요약");
    const sheetName = mode2 === "unique" ? "중복제거본" : mode2 === "fail" ? "실패·미확정" : "전체(중복표시)";
    XLSX.utils.book_append_sheet(wb, makeSheet(recs, mode2), sheetName);
    const baseName = mode2 === "unique" ? "정제결과_중복제거" : mode2 === "fail" ? "정제결과_실패건" : "정제결과_전체";
    const fileName = `${baseName}${partialSuffix}.xlsx`;

    try {
      const bytes = buildVerifiedWorkbookArray(XLSX, wb, {
        summarySheet: "요약",
        detailSheet: sheetName,
        expectedHeaders: extraHeaders.length + HEADERS.length,
        expectedRows: detailRecords.length,
        expectedSummaryTotal: recs.length
      });
      downloadWorkbookArray(bytes, fileName);
    } catch (error) {
      alert(`엑셀 무결성 검증 실패: ${error?.message || error}\\n다운로드를 중단했습니다.`);
    }
  }, [rows, extraHeaders, batchBusy, batchRegBusy, batchDone, buildRecords]);
  const stat =""",
        "verified XLSX download",
        flags=re.S,
    )

    text = replace_once(
        text,
        """  const btnP = {""",
        """  const irosProgress = irosProgressStats(rows);
  const exportFinalReady = batchDone === rows.length && isIrosExportFinal(rows);
  const btnP = {""",
        "progress derivation",
    )

    text = regex_once(
        text,
        r"React\.createElement\(\"span\", \{ style: \{ fontFamily: mono, fontSize: 13, color: C\.cyan \} \}, `등기조회 \$\{batchTotal \? Math\.round\(batchRegDone / batchTotal \* 100\) : 0\}% \(\$\{batchRegDone\}/\$\{batchTotal\}\) · 중복제거 후 · 건당 1초`\)",
        """React.createElement("span", { style: { fontFamily: mono, fontSize: 12.5, color: C.cyan } }, `기본 PNU ${batchBaseDone}/${batchBaseTotal} · 대체지번 ${batchAltDone}/${batchAltTotal} · 세대 결과 ${batchUnitDone}/${batchUnitTotal}`)""",
        "split IROS progress UI",
    )

    text = replace_once(text, '"전체 다운로드"', 'exportFinalReady ? "전체 다운로드" : "중간결과 다운로드 (PARTIAL)"', "all download label")
    text = replace_once(text, '"중복제거 다운로드"', 'exportFinalReady ? "중복제거 다운로드" : "중복제거 PARTIAL"', "unique download label")
    text = replace_once(text, '"실패건 다운로드"', 'exportFinalReady ? "실패건 다운로드" : "실패건 PARTIAL"', "fail download label")

    text = text.replace(
        "disabled: batchDone === 0,\n       style: { ...btnS, opacity: batchDone === 0 ? 0.5 : 1 }",
        "disabled: batchDone === 0 || batchBusy || batchRegBusy,\n       style: { ...btnS, opacity: (batchDone === 0 || batchBusy || batchRegBusy) ? 0.5 : 1 }",
        1,
    )
    text = text.replace(
        "disabled: batchDone === 0,\n       style: {\n         ...btnS,\n         opacity: batchDone === 0 ? 0.5 : 1,",
        "disabled: batchDone === 0 || batchBusy || batchRegBusy,\n       style: {\n         ...btnS,\n         opacity: (batchDone === 0 || batchBusy || batchRegBusy) ? 0.5 : 1,",
        2,
    )

    text = replace_once(
        text,
        """  ), (regStat.done > 0) &&""",
        """  ), irosRunMessage && !batchRegBusy && React.createElement("span", { style: { width: "100%", textAlign: "center", fontSize: 12, color: irosProgress.final ? C.ok : C.warn } }, irosRunMessage), (regStat.done > 0) &&""",
        "IROS run message UI",
    )

    required = [
        'compression: true',
        'recovery_version: IROS_RUN_VERSIONS.recovery',
        'buildIrosSnapshot(next, extraHeaders',
        '기본 PNU ${batchBaseDone}/${batchBaseTotal}',
        '중간결과 다운로드 (PARTIAL)',
        'markStaleIrosRows(rows)',
        'finally {\n      setBatchRegBusy(false);',
    ]
    for marker in required:
        if marker not in text:
            raise RuntimeError(f"required marker missing after patch: {marker}")

    APP.write_text(text, encoding="utf-8")
    print("patched", APP, "lines=", text.count("\n") + 1)


if __name__ == "__main__":
    main()
