from pathlib import Path


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected one match, found {count}")
    return text.replace(old, new, 1)


path = Path("public/app.js")
source = path.read_text(encoding="utf-8")

source = replace_once(
    source,
    '''import {
  analyzeBatchUpload,
  buildSourceRawValues,
  summarizeRefineStatuses
} from "./batch-ui-stats.mjs";
''',
    '''import {
  analyzeBatchUpload,
  buildSourceRawValues,
  summarizeRefineStatuses
} from "./batch-ui-stats.mjs";
import {
  BATCH_PRIMARY_ACTIONS,
  deriveBatchWorkflowState
} from "./batch-workflow-state.mjs";
''',
    "workflow import"
)

source = replace_once(
    source,
    '''  const irosStarted = rows.some((row) => Boolean(row.reg));
  const irosFinalReady = irosStarted && isIrosExportFinal(rows);
  const exportFinalReady = addressFinalReady && (!irosStarted || irosFinalReady);
  const btnP = {''',
    '''  const irosStarted = rows.some((row) => Boolean(row.reg));
  const irosFinalReady = irosStarted && isIrosExportFinal(rows);
  const exportFinalReady = addressFinalReady && (!irosStarted || irosFinalReady);
  const batchWorkflow = deriveBatchWorkflowState({
    rowCount: rows.length,
    batchDone,
    batchBusy,
    batchRegBusy,
    bridgeUp,
    irosStarted,
    irosFinalReady,
    irosProgress,
    irosOutcome
  });
  const btnP = {''',
    "workflow derivation"
)

old_primary = '''bridgeUp && irosOutcome.target > 0 && !batchRegBusy && /* @__PURE__ */ React.createElement(
    "button",
    {
      onClick: lookupBatchUniqueNo,
      disabled: batchDone === 0,
      style: {
        ...btnP,
        background: `linear-gradient(135deg, ${C.ok}, ${C.cyan})`,
        opacity: batchDone === 0 ? 0.5 : 1
      }
    },
    "\\uB4F1\\uAE30\\uACE0\\uC720\\uBC88\\uD638 \\uC77C\\uAD04\\uC870\\uD68C (",
    irosOutcome.target,
    "건)"
  )'''
new_primary = '''batchWorkflow.primaryAction !== BATCH_PRIMARY_ACTIONS.NONE && !batchRegBusy && /* @__PURE__ */ React.createElement(
    "button",
    {
      onClick: batchWorkflow.primaryAction === BATCH_PRIMARY_ACTIONS.LOOKUP_IROS ||
        batchWorkflow.primaryAction === BATCH_PRIMARY_ACTIONS.RESUME_IROS
        ? lookupBatchUniqueNo
        : () => downloadXlsx("all"),
      style: {
        ...btnP,
        background: `linear-gradient(135deg, ${C.ok}, ${C.cyan})`
      }
    },
    batchWorkflow.primaryLabel
  )'''
source = replace_once(source, old_primary, new_primary, "primary batch action")

old_status = '''irosStarted && !batchRegBusy && /* @__PURE__ */ React.createElement("p", { style: { width: "100%", textAlign: "center", fontSize: 13, color: irosFinalReady ? C.ok : C.warn, fontWeight: 600, margin: "2px 0 0" } }, irosFinalReady ? `✅ 등기조회 판정 완료 · ${irosOutcome.judged}/${irosOutcome.target}건 · 고유번호 ${irosOutcome.resolved}건` : `등기조회 판정 · ${irosOutcome.judged}/${irosOutcome.target}건 · 재시도 ${irosOutcome.retryRequired} · 미조회 ${irosOutcome.unstarted}`)'''
new_status = '''irosStarted && !batchRegBusy && /* @__PURE__ */ React.createElement("p", { style: {
    width: "100%",
    textAlign: "center",
    fontSize: 13,
    color: batchWorkflow.tone === "success" ? C.ok : C.warn,
    fontWeight: 600,
    margin: "2px 0 0"
  } }, batchWorkflow.statusLabel)'''
source = replace_once(source, old_status, new_status, "workflow status")

old_download = '''batchStop && !batchRegBusy && /* @__PURE__ */ React.createElement("span", { style: { fontSize: 12, color: C.dim } }, "\\uC911\\uB2E8\\uB428 \\xB7 \\uB2E4\\uC2DC \\uC870\\uD68C\\uD558\\uBA74 \\uC774\\uC5B4\\uC11C \\uC9C4\\uD589"), /* @__PURE__ */ React.createElement(
    "button",'''
new_download = '''batchStop && !batchRegBusy && /* @__PURE__ */ React.createElement("span", { style: { fontSize: 12, color: C.dim } }, "\\uC911\\uB2E8\\uB428 \\xB7 \\uB2E4\\uC2DC \\uC870\\uD68C\\uD558\\uBA74 \\uC774\\uC5B4\\uC11C \\uC9C4\\uD589"),
  ![BATCH_PRIMARY_ACTIONS.DOWNLOAD_ALL, BATCH_PRIMARY_ACTIONS.DOWNLOAD_ADDRESS].includes(batchWorkflow.primaryAction) && /* @__PURE__ */ React.createElement(
    "button",'''
source = replace_once(source, old_download, new_download, "avoid duplicate primary download")

path.write_text(source, encoding="utf-8")
print("batch workflow state v1 patch applied")
