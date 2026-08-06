// 같은 원문을 다시 업로드했을 때 이전 결과를 넘겨받는다.
//
// 지금은 업로드 순간 저장된 배치를 통째로 지운다(app.js의 idbDel(BATCH_KEY)).
// 그래서 같은 엑셀을 다시 올리면 2만 행을 처음부터 다시 조회한다.
//
// 여기서는 결과를 "재사용해도 되는지" 판정하지 않는다. 그 판정은 이미
// pipeline-contract.mjs의 isReusableResult가 지문(dependencyFingerprint,
// resultFingerprint)으로 엄격하게 하고 있고, runBatch가 그 결과로 그룹에서
// 제외한다. 이 모듈은 판정 대상이 될 후보를 새 행에 얹어주기만 한다.
// 지문이 어긋나면 기존 계약이 그대로 걸러내므로 오확정 경로가 늘지 않는다.
//
// 키는 dependencyFingerprint가 쓰는 입력 묶음과 같다({raw, zip, unitOverride,
// extra}). owner는 지문에 없지만 조회 인자로 쓰이므로 키에만 더해 더 좁게 잡는다.
// 키가 좁으면 재사용을 놓칠 뿐이고, 넓어도 지문이 막는다.

export const RESULT_CARRYOVER_VERSION = "result-carryover-v1";

// 이 상태들은 어차피 isReusableResult가 거부한다. 넘겨봐야 저장만 늘어난다.
const NEVER_REUSABLE = new Set(["SYSTEM_ERROR"]);

function isCarryable(result) {
  const status = String(result?.status || "");
  if (!status || NEVER_REUSABLE.has(status)) return false;
  if (status === "FAILED" && result?.failKind === "TRANSIENT") return false;
  return true;
}

export function resultCarryoverKey(row) {
  const unit = row?.unitOverride;
  return JSON.stringify([
    String(row?.raw || ""),
    String(row?.zip || ""),
    unit ? [String(unit.dong || ""), String(unit.ho || "")] : null,
    Array.isArray(row?.extra) ? row.extra.map((value) => String(value ?? "")) : [],
    String(row?.owner || "")
  ]);
}

export function buildResultCarryoverIndex(priorRows) {
  const index = new Map();
  for (const row of Array.isArray(priorRows) ? priorRows : []) {
    if (!isCarryable(row?.result)) continue;
    const key = resultCarryoverKey(row);
    // 같은 입력이 여러 번 나오면 등기까지 확보한 쪽을 우선한다.
    const existing = index.get(key);
    if (!existing || (!existing.reg && row.reg)) {
      index.set(key, { result: row.result, reg: row.reg });
    }
  }
  return index;
}

// 새로 만든 행에 이전 결과를 얹는다. 이미 결과가 있는 행은 건드리지 않고,
// rowId·원문·부가열 등 새 파일에서 온 값은 그대로 둔다.
export function carryOverResults(builtRows, priorRows) {
  const rows = Array.isArray(builtRows) ? builtRows : [];
  const index = buildResultCarryoverIndex(priorRows);
  if (!index.size) {
    return { rows, restored: 0, restoredIros: 0, priorCandidates: 0 };
  }
  let restored = 0;
  let restoredIros = 0;
  const next = rows.map((row) => {
    if (row?.result) return row;
    const hit = index.get(resultCarryoverKey(row));
    if (!hit) return row;
    restored += 1;
    if (hit.reg) restoredIros += 1;
    return { ...row, result: hit.result, ...(hit.reg ? { reg: hit.reg } : {}) };
  });
  return { rows: next, restored, restoredIros, priorCandidates: index.size };
}
