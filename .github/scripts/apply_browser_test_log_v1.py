from pathlib import Path


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected one match, found {count}")
    return text.replace(old, new, 1)


path = Path("public/app.js")
app = path.read_text(encoding="utf-8")

app = replace_once(
    app,
    '''import {
  attachPipelineMetadata,
  cloneResult,
  fingerprintValue,
  isReusableResult
} from "./pipeline-contract.mjs";
''',
    '''import {
  MODULE_VERSIONS,
  PIPELINE_VERSION,
  attachPipelineMetadata,
  cloneResult,
  fingerprintValue,
  isReusableResult
} from "./pipeline-contract.mjs";
''',
    "pipeline version imports"
)

app = replace_once(
    app,
    '''import {
  BATCH_PRIMARY_ACTIONS,
  deriveBatchWorkflowState
} from "./batch-workflow-state.mjs";
''',
    '''import {
  BATCH_PRIMARY_ACTIONS,
  deriveBatchWorkflowState
} from "./batch-workflow-state.mjs";
import {
  TEST_LOG_ACTIVE_KEY,
  TEST_LOG_STORAGE_KEY,
  browserTestLogsToCsv,
  createBrowserTestRun,
  updateBrowserTestRun,
  upsertBrowserTestRun
} from "./browser-test-log.mjs";
''',
    "browser test log imports"
)

panel = r'''
function TestLogPanel({ logs, onClose, onDownloadJson, onDownloadCsv, onClear, busy }) {
  const phaseLabel = {
    uploaded: "업로드",
    address_running: "주소정제 중",
    address_complete: "주소정제 완료",
    address_interrupted: "주소정제 중단",
    iros_running: "IROS 조회 중",
    iros_interrupted: "IROS 조회 중단",
    complete: "전체 완료",
    error: "오류"
  };
  const fmtRate = (value) => `${(Number(value || 0) * 100).toFixed(2)}%`;
  const fmtTime = (value) => {
    if (!value) return "-";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString("ko-KR");
  };
  const recent = (Array.isArray(logs) ? logs : []).slice(0, 30);
  return /* @__PURE__ */ React.createElement("div", { style: {
    margin: "0 0 14px",
    padding: 16,
    borderRadius: 13,
    background: "rgba(15,19,28,0.82)",
    border: `1px solid ${C.cardLine}`,
    boxShadow: "0 14px 40px rgba(0,0,0,0.28)"
  } }, /* @__PURE__ */ React.createElement("div", { style: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    gap: 10, flexWrap: "wrap", marginBottom: 12
  } }, /* @__PURE__ */ React.createElement("div", null,
    /* @__PURE__ */ React.createElement("div", { style: { fontSize: 14, fontWeight: 800, color: C.ink } }, "브라우저 테스트 로그"),
    /* @__PURE__ */ React.createElement("div", { style: { fontSize: 11, color: C.faint, marginTop: 3 } }, "이 브라우저의 IndexedDB에만 저장 · 원본주소와 API 키는 기록하지 않음")
  ), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 7, flexWrap: "wrap" } },
    /* @__PURE__ */ React.createElement("button", { onClick: onDownloadJson, disabled: recent.length === 0, style: { ...btnS, padding: "7px 11px", fontSize: 11.5, opacity: recent.length ? 1 : 0.45 } }, "JSON"),
    /* @__PURE__ */ React.createElement("button", { onClick: onDownloadCsv, disabled: recent.length === 0, style: { ...btnS, padding: "7px 11px", fontSize: 11.5, opacity: recent.length ? 1 : 0.45 } }, "CSV"),
    /* @__PURE__ */ React.createElement("button", { onClick: onClear, disabled: busy || recent.length === 0, style: { ...btnS, padding: "7px 11px", fontSize: 11.5, color: C.err, borderColor: `${C.err}66`, opacity: busy || !recent.length ? 0.45 : 1 } }, "전체 삭제"),
    /* @__PURE__ */ React.createElement("button", { onClick: onClose, style: { ...btnS, padding: "7px 11px", fontSize: 11.5 } }, "닫기")
  )), recent.length === 0 ? /* @__PURE__ */ React.createElement("p", { style: { color: C.dim, fontSize: 12, margin: 0 } }, "저장된 테스트 로그가 없습니다.") : /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gap: 8, maxHeight: 420, overflow: "auto" } }, recent.map((run) => {
    const address = run?.summary?.address || {};
    const iros = run?.summary?.iros || {};
    return /* @__PURE__ */ React.createElement("div", { key: run.id, style: {
      padding: "11px 12px", borderRadius: 10, background: "rgba(11,14,20,0.42)",
      border: "1px solid rgba(255,255,255,0.08)"
    } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" } },
      /* @__PURE__ */ React.createElement("span", { style: { fontSize: 12.5, fontWeight: 700, color: C.ink, wordBreak: "break-all" } }, run?.file?.name || "브라우저 복원 작업"),
      /* @__PURE__ */ React.createElement("span", { style: { fontFamily: mono, fontSize: 10.5, color: run.phase === "complete" ? C.ok : C.warn } }, phaseLabel[run.phase] || run.phase)
    ), /* @__PURE__ */ React.createElement("div", { style: { marginTop: 5, fontFamily: mono, fontSize: 10.5, color: C.faint } }, `${fmtTime(run.started_at)} · ${run?.execution?.pipeline_version || "-"} · ${run?.summary?.total_rows || 0}행`),
    /* @__PURE__ */ React.createElement("div", { style: { marginTop: 7, display: "flex", gap: 12, flexWrap: "wrap", fontFamily: mono, fontSize: 11.5 } },
      /* @__PURE__ */ React.createElement("span", { style: { color: C.cyan } }, `주소 ${address.confirmed || 0}/${run?.summary?.total_rows || 0} (${fmtRate(address.confirmed_rate)})`),
      /* @__PURE__ */ React.createElement("span", { style: { color: C.ok } }, `IROS ${iros.resolved || 0}/${iros.eligible || 0} (${fmtRate(iros.resolved_rate)})`),
      /* @__PURE__ */ React.createElement("span", { style: { color: C.warn } }, `복수 ${iros.multi || 0} · 세대미일치 ${iros.unit_not_found || 0} · 검증실패 ${iros.validation_failed || 0}`)
    ), run.reason ? /* @__PURE__ */ React.createElement("div", { style: { marginTop: 6, fontSize: 10.5, color: C.warn } }, `중단/오류: ${run.reason}`) : null);
  })));
}
'''

app = replace_once(
    app,
    'function AddrRefineTestGui() {',
    panel + '\nfunction AddrRefineTestGui() {',
    "test log panel component"
)

app = replace_once(
    app,
    '''  const [uploadStats, setUploadStats] = useState(null);
  const [extraHeaders, setExtraHeaders] = useState([]);
''',
    '''  const [uploadStats, setUploadStats] = useState(null);
  const [sourceFileMeta, setSourceFileMeta] = useState(null);
  const [extraHeaders, setExtraHeaders] = useState([]);
''',
    "source file state"
)

app = replace_once(
    app,
    '''  const [savedProgress, setSavedProgress] = useState(null);
  const [irosHealth, setIrosHealth] = useState({ bad: 0, total: 0, lastCode: "" });
''',
    '''  const [savedProgress, setSavedProgress] = useState(null);
  const [testLogs, setTestLogs] = useState([]);
  const [testLogOpen, setTestLogOpen] = useState(false);
  const testLogsRef = useRef([]);
  const activeTestRunRef = useRef(null);
  const [irosHealth, setIrosHealth] = useState({ bad: 0, total: 0, lastCode: "" });
''',
    "test log states"
)

helpers = r'''
  const browserSnapshot = useCallback(() => ({
    user_agent: typeof navigator !== "undefined" ? navigator.userAgent : "",
    language: typeof navigator !== "undefined" ? navigator.language : "",
    platform: typeof navigator !== "undefined" ? navigator.platform : "",
    timezone: typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "",
    viewport: typeof window !== "undefined" ? `${window.innerWidth}x${window.innerHeight}` : "",
    screen: typeof window !== "undefined" && window.screen ? `${window.screen.width}x${window.screen.height}` : "",
    url: typeof location !== "undefined" ? location.href : ""
  }), []);
  const persistTestRun = useCallback(async (run) => {
    const nextLogs = upsertBrowserTestRun(testLogsRef.current, run);
    testLogsRef.current = nextLogs;
    setTestLogs(nextLogs);
    await idbSet(TEST_LOG_STORAGE_KEY, nextLogs);
  }, []);
  const createTestRunForRows = useCallback((sourceRows, fileMeta = sourceFileMeta, uploadMeta = uploadStats) => createBrowserTestRun({
    file_name: fileMeta?.name || "브라우저 복원 작업",
    file_size: fileMeta?.size || 0,
    file_last_modified: fileMeta?.lastModified || 0,
    file_type: fileMeta?.type || "",
    source_rows: uploadMeta?.sourceRows || sourceRows.length,
    mode,
    bridge_mode: BRIDGE === "/api" ? "serverless" : "custom",
    pipeline_version: PIPELINE_VERSION,
    module_versions: MODULE_VERSIONS,
    iros_versions: {
      collector: IROS_RUN_VERSIONS.collector,
      parser: IROS_RUN_VERSIONS.parser,
      matcher: MATCHER_VERSION,
      recovery: IROS_RUN_VERSIONS.recovery
    },
    browser: browserSnapshot(),
    upload: uploadMeta || {}
  }, sourceRows), [sourceFileMeta, uploadStats, mode, BRIDGE, browserSnapshot]);
  const recordTestRun = useCallback(async (phase, sourceRows, patch = {}) => {
    let run = activeTestRunRef.current;
    if (!run) {
      run = createTestRunForRows(sourceRows);
      activeTestRunRef.current = run;
      await idbSet(TEST_LOG_ACTIVE_KEY, run.id);
    }
    const updated = updateBrowserTestRun(run, sourceRows, { phase, ...patch });
    activeTestRunRef.current = updated;
    await persistTestRun(updated);
    if (phase === "complete") await idbDel(TEST_LOG_ACTIVE_KEY);
    else await idbSet(TEST_LOG_ACTIVE_KEY, updated.id);
    return updated;
  }, [createTestRunForRows, persistTestRun]);
  useEffect(() => {
    (async () => {
      const stored = await idbGet(TEST_LOG_STORAGE_KEY);
      const logs = Array.isArray(stored) ? stored : [];
      testLogsRef.current = logs;
      setTestLogs(logs);
      const activeId = await idbGet(TEST_LOG_ACTIVE_KEY);
      activeTestRunRef.current = logs.find((item) => item?.id === activeId) || null;
    })();
  }, []);
  const downloadTestLogs = useCallback((format) => {
    if (!testLogsRef.current.length) return;
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const json = JSON.stringify(testLogsRef.current, null, 2);
    const content = format === "csv" ? browserTestLogsToCsv(testLogsRef.current) : json;
    const blob = new Blob([content], { type: format === "csv" ? "text/csv;charset=utf-8" : "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `addr-refine_test-log_${date}.${format}`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }, []);
  const clearTestLogs = useCallback(async () => {
    if (batchBusy || batchRegBusy) return;
    if (!window.confirm("이 브라우저에 저장된 테스트 로그를 모두 삭제할까요?")) return;
    testLogsRef.current = [];
    activeTestRunRef.current = null;
    setTestLogs([]);
    await idbDel(TEST_LOG_STORAGE_KEY);
    await idbDel(TEST_LOG_ACTIVE_KEY);
  }, [batchBusy, batchRegBusy]);
'''

app = replace_once(
    app,
    '''  const recordRegHealth = useCallback((status) => {
    const SYSTEM_BAD = [
      "REG_PARSE_ERROR", "REG_PARSE_INCOMPLETE", "REG_HTTP_ERROR",
      "REG_SESSION_ERROR", "REG_RATE_LIMIT"
    ];
    setIrosHealth((h) => {
      const total = h.total + 1;
      const bad = SYSTEM_BAD.includes(status) ? h.bad + 1 : 0;
      return { bad, total, lastCode: status };
    });
  }, []);
''',
    '''  const recordRegHealth = useCallback((status) => {
    const SYSTEM_BAD = [
      "REG_PARSE_ERROR", "REG_PARSE_INCOMPLETE", "REG_HTTP_ERROR",
      "REG_SESSION_ERROR", "REG_RATE_LIMIT"
    ];
    setIrosHealth((h) => {
      const total = h.total + 1;
      const bad = SYSTEM_BAD.includes(status) ? h.bad + 1 : 0;
      return { bad, total, lastCode: status };
    });
  }, []);
''' + helpers,
    "test log helpers"
)

old_upload = '''      setUploadStats({
        ...analyzeBatchUpload(sourceRawValues, built.length, statMap.size, normalizeRawKey),
        mapping: addrColIdx >= 0
          ? {
              mode: "header",
              addr: `${header0[addrIdx].trim()}(${colLetter(addrIdx)})`,
              detail: detailIdx >= 0 ? `${header0[detailIdx].trim()}(${colLetter(detailIdx)})` : null
            }
          : { mode: "fallback" },
        sample: (built[0]?.raw || "").slice(0, 40)
      });
      setRows(built);
'''
new_upload = '''      const nextUploadStats = {
        ...analyzeBatchUpload(sourceRawValues, built.length, statMap.size, normalizeRawKey),
        sourceRows: sourceRawValues.length,
        mapping: addrColIdx >= 0
          ? {
              mode: "header",
              addr: `${header0[addrIdx].trim()}(${colLetter(addrIdx)})`,
              detail: detailIdx >= 0 ? `${header0[detailIdx].trim()}(${colLetter(detailIdx)})` : null
            }
          : { mode: "fallback" },
        sample: (built[0]?.raw || "").slice(0, 40)
      };
      const nextFileMeta = { name: file.name, size: file.size, lastModified: file.lastModified, type: file.type };
      setUploadStats(nextUploadStats);
      setSourceFileMeta(nextFileMeta);
      const testRun = createTestRunForRows(built, nextFileMeta, nextUploadStats);
      activeTestRunRef.current = testRun;
      await idbSet(TEST_LOG_ACTIVE_KEY, testRun.id);
      await persistTestRun(testRun);
      setRows(built);
'''
app = replace_once(app, old_upload, new_upload, "upload test run start")

app = replace_once(
    app,
    '''  }, []);
  const runBatch = useCallback(async () => {
''',
    '''  }, [createTestRunForRows, persistTestRun]);
  const runBatch = useCallback(async () => {
''',
    "onFile dependencies"
)

app = replace_once(
    app,
    '''    let next = rows.map((row) => ({
      ...row,
      result: row.result ? cloneResult(row.result) : null,
      reg: row.reg ? cloneResult(row.reg) : row.reg
    }));
    const groupHints = buildGroupHints(next);
''',
    '''    let next = rows.map((row) => ({
      ...row,
      result: row.result ? cloneResult(row.result) : null,
      reg: row.reg ? cloneResult(row.reg) : row.reg
    }));
    await recordTestRun("address_running", next, {
      progress: { address_done: next.filter((row) => row.result).length, address_total: next.length }
    });
    const groupHints = buildGroupHints(next);
''',
    "address log start"
)

app = replace_once(
    app,
    '''    setBatchBusy(false);
  }, [rows, clients, extraHeaders]);
''',
    '''    await recordTestRun(batchStopRef.current ? "address_interrupted" : "address_complete", next, {
      reason: batchStopRef.current ? (consecTransient >= 20 ? "TRANSIENT_LIMIT" : "USER_STOP") : "",
      progress: { address_done: next.filter((row) => row.result).length, address_total: next.length }
    });
    setBatchBusy(false);
  }, [rows, clients, extraHeaders, recordTestRun]);
''',
    "address log finish"
)

app = replace_once(
    app,
    '''  const lookupBatchUniqueNo = useCallback(async () => {
    const next = markStaleIrosRows(rows).map((row) => ({
      ...row,
      result: row.result ? cloneResult(row.result) : null,
      reg: row.reg ? cloneResult(row.reg) : row.reg
    }));
    const targets = [];
''',
    '''  const lookupBatchUniqueNo = useCallback(async () => {
    const next = markStaleIrosRows(rows).map((row) => ({
      ...row,
      result: row.result ? cloneResult(row.result) : null,
      reg: row.reg ? cloneResult(row.reg) : row.reg
    }));
    await recordTestRun("iros_running", next, {
      progress: { iros_done: irosProgressStats(next).done, iros_total: irosProgressStats(next).total }
    });
    const targets = [];
''',
    "IROS log start"
)

app = replace_once(
    app,
    '''      await idbSet(BATCH_KEY, buildIrosSnapshot(next, extraHeaders, {
        phase: "complete",
        baseDone: 0,
        baseTotal: 0,
        alternateDone: 0,
        alternateTotal: 0,
        unitDone: initialIrosProgress.done,
        unitTotal: initialIrosProgress.total,
        interrupted: false
      }));
      return;
''',
    '''      await idbSet(BATCH_KEY, buildIrosSnapshot(next, extraHeaders, {
        phase: "complete",
        baseDone: 0,
        baseTotal: 0,
        alternateDone: 0,
        alternateTotal: 0,
        unitDone: initialIrosProgress.done,
        unitTotal: initialIrosProgress.total,
        interrupted: false
      }));
      await recordTestRun("complete", next, {
        progress: { iros_done: initialIrosProgress.done, iros_total: initialIrosProgress.total }
      });
      return;
''',
    "IROS already complete log"
)

app = replace_once(
    app,
    '''    setIrosRunMessage(interrupted
      ? `재개 가능 · 남은 세대 ${finalProgress.remaining}건`
      : `현재 버전 검증 완료 · ${finalProgress.done}/${finalProgress.total}건`);
    } catch (error) {
''',
    '''    await recordTestRun(interrupted ? "iros_interrupted" : "complete", next, {
      reason: batchStopRef.current ? "USER_STOP" : (finalProgress.final ? "" : "RETRY_REQUIRED"),
      progress: { iros_done: finalProgress.done, iros_total: finalProgress.total }
    });
    setIrosRunMessage(interrupted
      ? `재개 가능 · 남은 세대 ${finalProgress.remaining}건`
      : `현재 버전 검증 완료 · ${finalProgress.done}/${finalProgress.total}건`);
    } catch (error) {
''',
    "IROS final log"
)

app = replace_once(
    app,
    '''      try {
        await checkpoint({ phase: "interrupted", interrupted: true, reason });
      } catch {
        // 체크포인트 저장 실패는 원래 오류를 가리지 않는다.
      }
    } finally {
''',
    '''      try {
        await checkpoint({ phase: "interrupted", interrupted: true, reason });
      } catch {
        // 체크포인트 저장 실패는 원래 오류를 가리지 않는다.
      }
      await recordTestRun("iros_interrupted", next, { reason });
    } finally {
''',
    "IROS error log"
)

app = replace_once(
    app,
    '''  }, [rows, BRIDGE, config.resolverKey, extraHeaders, recordRegHealth]);
''',
    '''  }, [rows, BRIDGE, config.resolverKey, extraHeaders, recordRegHealth, recordTestRun]);
''',
    "IROS dependencies"
)

app = replace_once(
    app,
    '''tab === "batch" && /* @__PURE__ */ React.createElement("section", null, savedProgress &&''',
    '''tab === "batch" && /* @__PURE__ */ React.createElement("section", null,
  /* @__PURE__ */ React.createElement("div", { style: { display: "flex", justifyContent: "flex-end", marginBottom: 8 } },
    /* @__PURE__ */ React.createElement("button", { onClick: () => setTestLogOpen((value) => !value), style: { ...btnS, padding: "7px 12px", fontSize: 11.5, color: C.cyan, borderColor: `${C.cyan}55` } }, `테스트 로그 (${testLogs.length})`)
  ), testLogOpen && /* @__PURE__ */ React.createElement(TestLogPanel, {
    logs: testLogs,
    onClose: () => setTestLogOpen(false),
    onDownloadJson: () => downloadTestLogs("json"),
    onDownloadCsv: () => downloadTestLogs("csv"),
    onClear: clearTestLogs,
    busy: batchBusy || batchRegBusy
  }), savedProgress &&''',
    "batch test log UI"
)

path.write_text(app, encoding="utf-8")
print("browser test log v1 patch applied")
