from pathlib import Path


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected one match, found {count}")
    return text.replace(old, new, 1)


path = Path("public/app.js")
app = path.read_text(encoding="utf-8")
old = '''  useEffect(() => {
    (async () => {
      const stored = await idbGet(TEST_LOG_STORAGE_KEY);
      const logs = Array.isArray(stored) ? stored : [];
      testLogsRef.current = logs;
      setTestLogs(logs);
      const activeId = await idbGet(TEST_LOG_ACTIVE_KEY);
      activeTestRunRef.current = logs.find((item) => item?.id === activeId) || null;
    })();
  }, []);
'''
new = '''  useEffect(() => {
    (async () => {
      const stored = await idbGet(TEST_LOG_STORAGE_KEY);
      let logs = Array.isArray(stored) ? stored : [];
      const activeId = await idbGet(TEST_LOG_ACTIVE_KEY);
      activeTestRunRef.current = logs.find((item) => item?.id === activeId) || null;

      // 로그 기능 도입 전에 브라우저에 저장된 기존 테스트도 한 번만 이력으로 편입한다.
      // 행 원문은 저장하지 않고 결과 지문과 집계만 남기며, 같은 지문은 중복 편입하지 않는다.
      const savedBatch = await idbGet(BATCH_KEY);
      const savedRows = Array.isArray(savedBatch) ? savedBatch : savedBatch?.rows;
      if (Array.isArray(savedRows) && savedRows.some((row) => row?.result || row?.reg)) {
        const firstResult = savedRows.find((row) => row?.result)?.result || {};
        const firstReg = savedRows.find((row) => row?.reg)?.reg || {};
        const progress = irosProgressStats(savedRows);
        const addressDone = savedRows.filter((row) => row?.result).length;
        const phase = progress.final
          ? "complete"
          : progress.done > 0
            ? "iros_interrupted"
            : addressDone === savedRows.length
              ? "address_complete"
              : "address_interrupted";
        const importedBase = createBrowserTestRun({
          file_name: "기존 브라우저 저장 작업",
          source_rows: savedRows.length,
          mode: "restored",
          bridge_mode: "unknown",
          pipeline_version: firstResult.pipelineVersion || "unknown",
          module_versions: firstResult.moduleVersions || {},
          iros_versions: savedBatch?.irosVersions || {
            collector: firstReg.collector_version || "",
            parser: firstReg.parser_version || "",
            matcher: firstReg.matcher_version || "",
            recovery: firstReg.recovery_version || ""
          },
          browser: browserSnapshot(),
          upload: { imported_existing_snapshot: true }
        }, savedRows);
        const imported = updateBrowserTestRun(importedBase, savedRows, {
          phase,
          reason: "",
          progress: {
            address_done: addressDone,
            address_total: savedRows.length,
            iros_done: progress.done,
            iros_total: progress.total
          }
        });
        if (!logs.some((item) => item?.summary?.fingerprint === imported.summary.fingerprint)) {
          logs = upsertBrowserTestRun(logs, imported);
          await idbSet(TEST_LOG_STORAGE_KEY, logs);
        }
      }

      testLogsRef.current = logs;
      setTestLogs(logs);
    })();
  }, [browserSnapshot]);
'''
app = replace_once(app, old, new, "existing browser snapshot backfill")
path.write_text(app, encoding="utf-8")
print("browser test log existing snapshot backfill applied")
