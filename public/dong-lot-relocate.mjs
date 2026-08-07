// 동↔지번 재배치 — 요청 동이 확정 지번의 등기부에 아예 없는 세대미일치 행을,
// JUSO 건물명 검색의 detBdNmList(동↔지번 매핑)가 그 동을 "다른 지번 하나"로만
// 가리킬 때 그 지번의 IROS 재조회(기존 대체지번 인프라)로 회수한다.
//
// 실측(창신타운, 2026-08-07): 확정 지번 영천시 망정동 471의 등기부에는
// 101~108동뿐이고 109·110동이 없다. JUSO 건물명 검색("영천시 망정동 창신타운")은
// detBdNmList로 109동·110동을 망정동 462-2에만 매핑했고, 462-2 등기부
// 완전수집에서 109동 101호 = 1747-1996-197462 정확 매칭이 확증됐다(42행 유형).
//
// 기권(무회귀):
//   - REG_UNIT_NOT_FOUND + 완전수집만 대상 — 성공 행(RESOLVED)은 애초에 안 본다
//   - 완전수집이 아니면 "그 동이 등기부에 없다"를 증명할 수 없어 기권
//   - 요청 동이 현재 지번 후보에 실존하면 기권(호 단위 실패는 다른 문제다)
//   - 명시 대체지번 복구가 이미 걸려 있으면 기권(원문 명시 근거가 우선)
//   - 건물명 일치 검색에서 요청 동이 실린 지번이 유일하지 않으면 기권
//   - 그 지번이 현재 지번과 같으면 기권(같은 조회의 반복일 뿐이다)
//   - 이미 재배치를 시도한 행은 다시 시도하지 않는다(멱등)

import {
  buildingNamesMatch,
  dongAliasKey,
  extractLegalLot,
  unitKey
} from "./unit-match.mjs";
import { detBdDongTokens, lotScopedText } from "./address-failed-requery.mjs";

export const DONG_LOT_RELOCATE_VERSION = "dong-lot-relocate-v1";

function text(value) {
  return String(value ?? "").trim();
}

function legalLotKey(value) {
  const lot = extractLegalLot(text(value));
  return lot ? `${lot.legal}|${lot.mountain ? "산" : ""}${lot.lot}` : "";
}

// 재배치 계획. 발화 조건을 못 채우면 null — JUSO 호출 전에 판정한다.
export function buildDongLotRelocatePlan(row) {
  const reg = row?.reg;
  const result = row?.result;
  if (text(reg?.status) !== "REG_UNIT_NOT_FOUND" || reg?.complete !== true) return null;
  if (reg?.recovery_pending || reg?.dong_lot_relocate) return null;
  const requestedDong = unitKey(result?.unit?.dong, "dong");
  const requestedHo = unitKey(result?.unit?.ho, "ho");
  if (!requestedDong || !requestedHo) return null;
  const candidates = Array.isArray(reg?.candidates) ? reg.candidates : [];
  if (!candidates.length) return null;
  // 요청 동이 이 지번 등기부에 실존하면 재배치 대상이 아니다.
  const requestedAlias = dongAliasKey(result?.unit?.dong);
  if (candidates.some((candidate) => dongAliasKey(candidate?.dong) === requestedAlias)) {
    return null;
  }
  const buildingName = text(result?.bdNm);
  if (!buildingName) return null;
  const jibunAddr = text(result?.jibunAddr);
  const lot = extractLegalLot(jibunAddr);
  if (!lot) return null;
  const region = jibunAddr.slice(0, jibunAddr.indexOf(lot.legal) + lot.legal.length).trim();
  if (!region) return null;
  return {
    version: DONG_LOT_RELOCATE_VERSION,
    query: `${region} ${buildingName}`,
    buildingName,
    requestedDong,
    currentLotKey: legalLotKey(jibunAddr)
  };
}

// JUSO 재검색 결과에서 재배치 지번을 고른다. 건물명이 일치하는 후보 중
// detBdNmList에 요청 동이 실린 지번이 정확히 하나이고 현재 지번과 다를 때만.
export function pickDongLotRelocateLot(hits, plan) {
  if (!plan) return null;
  const named = (Array.isArray(hits) ? hits : []).filter((hit) =>
    buildingNamesMatch(plan.buildingName, hit?.bdNm));
  const dongHits = named.filter((hit) =>
    detBdDongTokens(hit).includes(plan.requestedDong));
  if (!dongHits.length) return null;
  const lots = new Set(dongHits.map((hit) => legalLotKey(hit?.jibunAddr)));
  lots.delete("");
  if (lots.size !== 1) return null;
  const [lotKey] = lots;
  if (lotKey === plan.currentLotKey) return null;
  const lotAddress = lotScopedText(dongHits[0]?.jibunAddr);
  if (!lotAddress) return null;
  return { lotAddress, hit: dongHits[0] };
}

// 재배치를 대체지번 큐에 걸었다는 표식. 실제 확정은 기존 대체지번 수렴
// 로직이 하고, 이 표식은 멱등 가드와 근거 감사용이다.
export function markDongLotRelocatePending(reg, plan, picked) {
  return {
    ...reg,
    recovery_pending: true,
    recovery_address: picked.lotAddress,
    recovery_addresses: [picked.lotAddress],
    recovery_attempted: false,
    dong_lot_relocate: {
      version: plan.version,
      requested_dong: plan.requestedDong,
      juso_query: plan.query,
      lot_address: picked.lotAddress
    }
  };
}
