export const BATCH_WORKFLOW_PHASES = Object.freeze({
  EMPTY: "EMPTY",
  ADDRESS_RUNNING: "ADDRESS_RUNNING",
  ADDRESS_PENDING: "ADDRESS_PENDING",
  ADDRESS_COMPLETE: "ADDRESS_COMPLETE",
  IROS_READY: "IROS_READY",
  IROS_RUNNING: "IROS_RUNNING",
  IROS_INCOMPLETE: "IROS_INCOMPLETE",
  IROS_COMPLETE: "IROS_COMPLETE"
});

export const BATCH_PRIMARY_ACTIONS = Object.freeze({
  NONE: "NONE",
  LOOKUP_IROS: "LOOKUP_IROS",
  RESUME_IROS: "RESUME_IROS",
  DOWNLOAD_ADDRESS: "DOWNLOAD_ADDRESS",
  DOWNLOAD_ALL: "DOWNLOAD_ALL"
});

function count(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

function formatCount(value) {
  return count(value).toLocaleString("ko-KR");
}

export function deriveBatchWorkflowState({
  rowCount = 0,
  batchDone = 0,
  batchBusy = false,
  batchRegBusy = false,
  bridgeUp = false,
  irosStarted = false,
  irosFinalReady = false,
  irosProgress = {},
  irosOutcome = {}
} = {}) {
  const rows = count(rowCount);
  const addressDone = Math.min(count(batchDone), rows);
  const addressComplete = rows > 0 && addressDone === rows;
  const target = count(irosOutcome.target ?? irosProgress.total);
  const judged = count(irosOutcome.judged ?? irosProgress.done);
  const progressDone = count(irosProgress.done);
  const progressTotal = count(irosProgress.total ?? target);
  const remaining = count(irosProgress.remaining ?? Math.max(0, target - judged));
  const retryRequired = count(irosOutcome.retryRequired);
  const resolved = count(irosOutcome.resolved);

  const base = {
    addressComplete,
    target,
    judged,
    remaining,
    retryRequired,
    resolved,
    primaryAction: BATCH_PRIMARY_ACTIONS.NONE,
    primaryLabel: "",
    statusLabel: "",
    tone: "neutral"
  };

  if (!rows) return { ...base, phase: BATCH_WORKFLOW_PHASES.EMPTY };

  if (batchBusy) {
    return {
      ...base,
      phase: BATCH_WORKFLOW_PHASES.ADDRESS_RUNNING,
      statusLabel: `주소 정제 진행 중 · ${formatCount(addressDone)}/${formatCount(rows)}행`
    };
  }

  if (!addressComplete) {
    return {
      ...base,
      phase: BATCH_WORKFLOW_PHASES.ADDRESS_PENDING,
      statusLabel: `주소 정제 미완료 · ${formatCount(addressDone)}/${formatCount(rows)}행`
    };
  }

  if (batchRegBusy) {
    return {
      ...base,
      phase: BATCH_WORKFLOW_PHASES.IROS_RUNNING,
      statusLabel: `등기조회 진행 중 · ${formatCount(progressDone)}/${formatCount(progressTotal)}건`,
      tone: "info"
    };
  }

  if (irosStarted && irosFinalReady) {
    return {
      ...base,
      phase: BATCH_WORKFLOW_PHASES.IROS_COMPLETE,
      primaryAction: BATCH_PRIMARY_ACTIONS.DOWNLOAD_ALL,
      primaryLabel: "전체 결과 다운로드",
      statusLabel: `✅ 등기조회 완료 · ${formatCount(judged)}/${formatCount(target)}건 · 고유번호 ${formatCount(resolved)}건`,
      tone: "success"
    };
  }

  if (irosStarted) {
    const suffix = retryRequired > 0
      ? ` · 재시도 ${formatCount(retryRequired)}건`
      : "";
    return {
      ...base,
      phase: BATCH_WORKFLOW_PHASES.IROS_INCOMPLETE,
      primaryAction: bridgeUp ? BATCH_PRIMARY_ACTIONS.RESUME_IROS : BATCH_PRIMARY_ACTIONS.NONE,
      primaryLabel: bridgeUp ? `등기조회 이어서 (${formatCount(remaining)}건)` : "",
      statusLabel: `등기조회 미완료 · ${formatCount(judged)}/${formatCount(target)}건 · 남은 ${formatCount(remaining)}건${suffix}`,
      tone: "warning"
    };
  }

  if (bridgeUp && target > 0) {
    return {
      ...base,
      phase: BATCH_WORKFLOW_PHASES.IROS_READY,
      primaryAction: BATCH_PRIMARY_ACTIONS.LOOKUP_IROS,
      primaryLabel: `등기고유번호 일괄조회 (${formatCount(target)}건)`,
      statusLabel: `주소 정제 완료 · 등기조회 대기 ${formatCount(target)}건`,
      tone: "info"
    };
  }

  return {
    ...base,
    phase: BATCH_WORKFLOW_PHASES.ADDRESS_COMPLETE,
    primaryAction: BATCH_PRIMARY_ACTIONS.DOWNLOAD_ADDRESS,
    primaryLabel: "주소정제 결과 다운로드",
    statusLabel: bridgeUp ? "주소 정제 완료 · 등기조회 대상 없음" : "주소 정제 완료 · 등기 브리지 연결 대기",
    tone: "success"
  };
}
