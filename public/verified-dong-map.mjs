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
//
// 소거법(실측 근거를 준 지적): 주거동이 등기부에 N개뿐이고 요청 동들 중
// N-1개가 이미 등기부 동과 그대로 일치한다면, 남는 요청 동 하나는 남는
// 등기부 동 하나일 수밖에 없다(원조: 등기부 101·102, 요청 101·201, 101이
// 일치 → 201=102). 앵커 없이도 성립하는 구조적 근거라 함께 만든다.
// 두 근거가 상충하면 그 매핑은 통째로 버린다.
export function buildVerifiedDongMap(rows) {
  const source = Array.isArray(rows) ? rows : [];
  const anchors = new Map();          // key -> Map<mappedDong, count>
  const requestedByLot = new Map();   // lot -> Set<요청 동>
  const registryByLot = new Map();    // lot -> Set<주거 등기부 동>
  const requestedHosByLot = new Map(); // lot -> Map<요청 동, Set<호>>
  for (const row of source) {
    const reg = row?.reg;
    const lot = lotKeyOf(row?.result);
    const requested = dongAliasKey(row?.result?.unit?.dong);
    const requestedHo = unitKey(row?.result?.unit?.ho, "ho");
    if (lot && requested && requestedHo) {
      if (!requestedByLot.has(lot)) requestedByLot.set(lot, new Set());
      requestedByLot.get(lot).add(requested);
      if (!requestedHosByLot.has(lot)) requestedHosByLot.set(lot, new Map());
      const byDong = requestedHosByLot.get(lot);
      if (!byDong.has(requested)) byDong.set(requested, new Set());
      byDong.get(requested).add(requestedHo);
    }
    // 완전수집 실패 행이 그 지번의 전체 후보를 들고 있다.
    if (lot && reg?.complete === true && (reg.candidates || []).length > 1) {
      if (!registryByLot.has(lot)) registryByLot.set(lot, new Set());
      const registry = registryByLot.get(lot);
      for (const candidate of reg.candidates) {
        const dong = dongAliasKey(candidate?.dong);
        if (!dong || /^상가/.test(dong)) continue;
        if (!String(candidate?.real_cls_cd || candidate?.gubun || "").includes("집합")) continue;
        registry.add(dong);
      }
    }
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
    map.set(key, { mappedDong, anchors: count, basis: "anchor" });
  }

  // 소거법: 미일치 요청 동 1개 ↔ 미일치 주거 등기부 동 1개.
  for (const [lot, requested] of requestedByLot) {
    const registry = registryByLot.get(lot);
    if (!registry || !registry.size) continue;
    const matched = [...requested].filter((dong) => registry.has(dong));
    const leftoverRequested = [...requested].filter((dong) => !registry.has(dong));
    const leftoverRegistry = [...registry].filter((dong) => !requested.has(dong));
    // 최소 한 동은 그대로 일치해야 "같은 단지의 표기 차이"라는 전제가 선다.
    if (!matched.length) continue;
    if (leftoverRequested.length !== 1 || leftoverRegistry.length !== 1) continue;
    // 호 집합 커버리지 가드(실측 반례에서 도출): 잔여 등기부 동이 잔여 요청
    // 동의 호들을 대부분 갖고 있어야 같은 건물이다. 용당 실측에서 112가 이미
    // 요청돼 잔여가 123(1세대)뿐이 되자 소거가 12→123으로 찍으려 했다 —
    // 123은 요청 호 120종 중 1종만 가져 오확정이었다. 커버리지 80% 미만은 기권.
    const wantedHos = requestedHosByLot.get(lot)?.get(leftoverRequested[0]) || new Set();
    const registryHos = new Set();
    for (const row of source) {
      const reg2 = row?.reg;
      if (lotKeyOf(row?.result) !== lot || reg2?.complete !== true) continue;
      for (const candidate of reg2.candidates || []) {
        if (dongAliasKey(candidate?.dong) === leftoverRegistry[0]) {
          registryHos.add(unitKey(candidate?.ho, "ho"));
        }
      }
    }
    const covered = [...wantedHos].filter((ho) => registryHos.has(ho)).length;
    if (!wantedHos.size || covered / wantedHos.size < 0.8) continue;
    const key = `${lot}#${leftoverRequested[0]}`;
    const byElimination = { mappedDong: leftoverRegistry[0], anchors: 0, basis: "elimination" };
    const existing = map.get(key);
    if (existing && existing.mappedDong !== byElimination.mappedDong) {
      // 앵커와 소거가 상충 — 근거가 갈리므로 매핑을 버린다.
      map.delete(key);
      continue;
    }
    map.set(key, existing
      ? { ...existing, basis: "anchor+elimination" }
      : byElimination);
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
