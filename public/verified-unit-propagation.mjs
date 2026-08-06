// 같은 PNU·동·호로 이미 검증된 고유번호를 같은 세대의 실패행에 전파한다.
//
// PNU가 같으면 지번이 같고, 지번이 같으면 IROS 완전후보 캐시도 같다. 거기서
// 동·호까지 같다면 물리적으로 동일한 전유부이므로 고유번호도 하나여야 한다.
// 그런데 실제로는 같은 세대가 한 행은 RESOLVED, 다른 행은 REG_MULTI나
// REG_UNIT_NOT_FOUND로 갈리는 경우가 있다. 원문 건물명 표기가 달라 검토
// 플래그가 붙었거나, 원문 동·호 표기가 달라 매칭 단계가 갈렸기 때문이다.
//
// 이 모듈은 그런 행만 회수한다. 자동확정 조건은 아래를 전부 만족할 때다.
//   - 기준행이 RESOLVED이고 고유번호가 비어 있지 않다
//   - 같은 키의 RESOLVED 고유번호가 정확히 한 종류다(두 종류면 전파 자체를 닫는다)
//   - 대상행이 완전수집된 상태에서 실패했다(부분응답·서비스오류는 재조회 대상)
//   - 대상행이 이미 본 후보 목록 안에 그 고유번호가 실제로 존재한다

import { dongAliasKey, unitKey } from "./unit-match.mjs";

export const VERIFIED_UNIT_PROPAGATION_VERSION = "verified-unit-propagation-v1";

// 완전수집이 끝난 뒤의 세대 실패만 전파 대상이다. 재시도 상태는 다시 조회해야
// 하며, 여기서 값을 채우면 조회되지 않은 행이 완료로 굳는다.
const PROPAGATABLE_FAILURES = new Set([
  "REG_MULTI",
  "MULTIPLE",
  "REG_UNIT_NOT_FOUND"
]);

function text(value) {
  return String(value ?? "").trim();
}

export function verifiedUnitKey(result) {
  const pnu = text(result?.pnu);
  const ho = unitKey(result?.unit?.ho, "ho");
  if (!/^\d{19}$/.test(pnu) || !ho) return "";
  return `${pnu}|${dongAliasKey(result?.unit?.dong)}|${ho}`;
}

function isVerifiedSource(row) {
  const reg = row?.reg;
  return text(reg?.status) === "RESOLVED" &&
    Boolean(text(reg?.unique_no)) &&
    reg?.stale !== true;
}

// 키별로 검증된 고유번호를 모은다. 한 키에서 서로 다른 고유번호가 나오면
// 그 키는 통째로 버린다. 어느 쪽이 맞는지 판단할 근거가 없기 때문이다.
export function buildVerifiedUnitIndex(rows) {
  const collected = new Map();
  for (const row of Array.isArray(rows) ? rows : []) {
    if (!isVerifiedSource(row)) continue;
    const key = verifiedUnitKey(row?.result);
    if (!key) continue;
    const uniqueNo = text(row.reg.unique_no);
    if (!collected.has(key)) {
      collected.set(key, { key, unique_no: uniqueNo, sources: [], conflict: false });
    }
    const entry = collected.get(key);
    if (entry.unique_no !== uniqueNo) entry.conflict = true;
    entry.sources.push(text(row?.rowId));
  }
  const index = new Map();
  for (const [key, entry] of collected) {
    if (entry.conflict) continue;
    index.set(key, {
      key,
      unique_no: entry.unique_no,
      source_row_ids: entry.sources.filter(Boolean).sort(),
      source_count: entry.sources.length
    });
  }
  return index;
}

function candidateUniqueNos(reg) {
  return new Set(
    (Array.isArray(reg?.candidates) ? reg.candidates : [])
      .map((candidate) => text(candidate?.unique_no))
      .filter(Boolean)
  );
}

function selectedCandidate(reg, uniqueNo) {
  return (Array.isArray(reg?.candidates) ? reg.candidates : [])
    .find((candidate) => text(candidate?.unique_no) === uniqueNo) || null;
}

export function planVerifiedUnitPropagation(rows, index = buildVerifiedUnitIndex(rows)) {
  const out = [];
  const source = Array.isArray(rows) ? rows : [];
  for (let position = 0; position < source.length; position++) {
    const row = source[position];
    const reg = row?.reg;
    if (!reg || reg.complete !== true || reg.stale === true) continue;
    if (!PROPAGATABLE_FAILURES.has(text(reg.status))) continue;
    const key = verifiedUnitKey(row?.result);
    if (!key) continue;
    const verified = index.get(key);
    if (!verified) continue;

    // 대상행이 본 후보 안에 그 고유번호가 없으면 같은 완전후보를 본 것이
    // 아니다. 이 경우는 전파하지 않고 실패를 그대로 둔다.
    const seen = candidateUniqueNos(reg);
    if (seen.size && !seen.has(verified.unique_no)) continue;

    out.push({
      index: position,
      rowId: text(row?.rowId),
      key,
      unique_no: verified.unique_no,
      from_status: text(reg.status),
      candidate: selectedCandidate(reg, verified.unique_no),
      evidence: {
        version: VERIFIED_UNIT_PROPAGATION_VERSION,
        key,
        source_row_ids: verified.source_row_ids,
        source_count: verified.source_count,
        candidate_pool_checked: seen.size
      }
    });
  }
  return out;
}

// 전파 결과를 reg에 적용한다. 원래 실패 상태와 후보 수를 감사용으로 남긴다.
export function applyVerifiedUnitPropagation(reg, propagation) {
  const candidate = propagation?.candidate;
  return {
    ...(reg || {}),
    status: "RESOLVED",
    unique_no: propagation.unique_no,
    candidates: candidate ? [candidate] : (reg?.candidates || []),
    strategy: "VERIFIED_UNIT_PROPAGATION",
    applied_modules: [...new Set([
      ...(Array.isArray(reg?.applied_modules) ? reg.applied_modules : []),
      `R-IROS-VERIFIED-UNIT-PROPAGATION@${VERIFIED_UNIT_PROPAGATION_VERSION}`
    ])],
    unit_propagation: {
      ...propagation.evidence,
      from_status: propagation.from_status,
      from_candidate_count: Array.isArray(reg?.candidates) ? reg.candidates.length : 0
    },
    message: `동일 PNU·동·호의 검증된 고유번호 전파 (${propagation.from_status})`
  };
}
