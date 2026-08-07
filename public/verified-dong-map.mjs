// 검증 동 매핑 전파 — 원문 동 표기 체계가 등기부와 다른 단지의 회수.
//
// 실측(삼척 원조임대아파트, 2026-08-07): 원문은 "101-*"(1동)과 "201-*"(2동)
// 체계인데 등기부는 101동·102동으로 적는다. 요청 201동은 등기부에 없어
// 116행이 세대미일치로 남았지만, 102동에만 존재하는 호(1408~1410 등)를 가진
// 24행은 동무시 유일 매칭이 102동으로 확정했다 — 24건 전원이 같은 동이다.
// 이 확정들이 "요청 201 = 등기부 102"라는 매핑의 등기부 내 실측 근거다.
//
// 규칙: 같은 지번에서 같은 요청 동이 동무시 매칭으로 확정된 앵커들이
//   - 전부 하나의 등기부 동 X로 수렴하고
//   - 앵커가 MIN_ANCHORS건 이상이며
//   - 실패 행의 (X, 호)가 저장된 완전후보에서 정확 매칭 유일이면
// 그 행을 확정한다. 재조회 없음 — 저장된 후보에서 재매칭만 한다.
//
// 기권(무회귀):
//   - 앵커가 두 동 이상으로 갈리면 그 지번·요청 동 매핑 전체를 버린다
//   - 앵커가 MIN_ANCHORS 미만이면 우연일 수 있어 쓰지 않는다
//   - 요청 동이 등기부에 실존하면 애초에 동무시가 닫히므로 앵커가 생기지 않는다

import {
  candidateMatchesUnit,
  dongAliasKey,
  extractLegalLot,
  filterUnitPropertyCandidates,
  unitKey
} from "./unit-match.mjs";

export const VERIFIED_DONG_MAP_VERSION = "verified-dong-map-v1";
export const MIN_ANCHORS = 2;

function text(value) {
  return String(value ?? "").trim();
}

function lotKeyOf(result) {
  const lot = extractLegalLot(text(result?.jibunAddr));
  return lot ? `${lot.legal}|${lot.mountain ? "산" : ""}${lot.lot}` : "";
}

function mapKey(result, requestedDong) {
  const lot = lotKeyOf(result);
  const dong = dongAliasKey(requestedDong);
  return lot && dong ? `${lot}#${dong}` : "";
}

// 확정 행에서 앵커를 모은다: 동무시 매칭(RESOLVED + dong_agnostic_recovery)이
// "요청 동 D를 등기부 동 X로" 확정한 행들.
export function buildVerifiedDongMap(rows) {
  const anchors = new Map(); // key -> Map<mappedDong, count>
  for (const row of Array.isArray(rows) ? rows : []) {
    const reg = row?.reg;
    const recovery = reg?.dong_agnostic_recovery;
    if (text(reg?.status) !== "RESOLVED" || !recovery) continue;
    const candidate = (reg.candidates || [])[0];
    const mapped = dongAliasKey(candidate?.dong);
    if (!mapped) continue;
    const key = mapKey(row?.result, recovery.requested_dong);
    if (!key) continue;
    if (!anchors.has(key)) anchors.set(key, new Map());
    const byDong = anchors.get(key);
    byDong.set(mapped, (byDong.get(mapped) || 0) + 1);
  }
  const map = new Map();
  for (const [key, byDong] of anchors) {
    // 앵커가 두 동으로 갈리면 매핑 전체를 버린다 — 근거가 상충한다.
    if (byDong.size !== 1) continue;
    const [mappedDong, count] = [...byDong.entries()][0];
    if (count < MIN_ANCHORS) continue;
    map.set(key, { mappedDong, anchors: count });
  }
  return map;
}

// 실패 행 하나를 매핑으로 재판정한다. 확정 조건을 못 채우면 null.
export function planVerifiedDongMapRematch(row, map) {
  const reg = row?.reg;
  if (text(reg?.status) !== "REG_UNIT_NOT_FOUND" || reg?.complete !== true) return null;
  if (row?.result?.verifiedDongMap?.version === VERIFIED_DONG_MAP_VERSION) return null;
  const unit = row?.result?.unit || {};
  const requestedDong = dongAliasKey(unit.dong);
  const ho = unitKey(unit.ho, "ho");
  if (!requestedDong || !ho) return null;
  const key = mapKey(row.result, requestedDong);
  const entry = key ? map.get(key) : null;
  if (!entry) return null;
  const typed = filterUnitPropertyCandidates(reg.candidates || [], entry.mappedDong, unit.ho);
  if (!typed.verified) return null;
  const matched = typed.candidates.filter((candidate) =>
    candidateMatchesUnit(candidate, entry.mappedDong, unit.ho));
  const unique = new Map();
  for (const candidate of matched) {
    const id = text(candidate?.unique_no);
    if (id && !unique.has(id)) unique.set(id, candidate);
  }
  if (unique.size !== 1) return null;
  return {
    version: VERIFIED_DONG_MAP_VERSION,
    requestedDong,
    mappedDong: entry.mappedDong,
    anchors: entry.anchors,
    candidate: [...unique.values()][0]
  };
}

export function applyVerifiedDongMapRematch(reg, plan) {
  return {
    ...reg,
    status: "RESOLVED",
    unique_no: plan.candidate.unique_no,
    candidates: [plan.candidate],
    verified_dong_map: {
      version: plan.version,
      requested_dong: plan.requestedDong,
      mapped_dong: plan.mappedDong,
      anchors: plan.anchors
    },
    applied_modules: [
      ...(reg.applied_modules || []),
      `R-IROS-VERIFIED-DONG-MAP@1`
    ],
    message: `검증 동 매핑: 요청 ${plan.requestedDong} = 등기부 ${plan.mappedDong}` +
      ` (동무시 확정 앵커 ${plan.anchors}건) — 정확 매칭 유일`
  };
}
