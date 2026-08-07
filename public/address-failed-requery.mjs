// 주소 실패 행 재조회 규칙 — 실패 상태에서만 발화하는 세 가지 복구 경로.
//
// 2026-08-07 실측(20,023행 실행의 미회수 군집)에서 도출했다. 세 경로 모두
// 이미 실패로 판정난 행에서만 동작하므로 기존 CONFIRMED 행을 뒤집을 수 없다.
//
// 1. R-ADDR-BUILDING-NAME-LOT: 지번식 검색이 0건인데 원문에 건물명이 있으면
//    지역+건물명으로 JUSO를 재검색한다. 같은 건물이 여러 지번에 걸쳐 있으면
//    (동별 필지 분리 상가 실측: 1동=1082, 6동=1086처럼 detBdNmList가 동↔지번
//    매핑을 제공) 원문 동이 실존하는 지번 하나로만 확정하고, 못 좁히면
//    복수후보(AMBIGUOUS)로 남겨 기존 복수PNU-IROS 판별로 넘긴다.
// 2. R-ADDR-EXCLUDED-LOT: 용도 불일치로 배제한 후보(유치원·학교 등)의 지번을
//    JUSO 지번 검색으로 재확인한다. 같은 지번에 원문 건물명과 일치하는 다른
//    건물이 있으면 그 후보로 확정한다(동일 단지 부속시설이 대표로 잡힌 실측).
// 3. R-ADDR-NAVER-LOT-RESCUE: 네이버가 주소를 확인해 줬지만 지번 없는
//    주소만 돌려준 행. 읍면동+건물명으로 지역검색을 다시 해 주거 카테고리
//    항목의 지번을 얻고, 그 지번을 JUSO로 교차확인해서만 채택한다.

import { buildingNamesMatch, extractLegalLot, unitKey } from "./unit-match.mjs";

export const ADDRESS_FAILED_REQUERY_VERSION = "address-failed-requery-v1";

export const ADDRESS_FAILED_REQUERY_MODULES = Object.freeze({
  R_ADDR_BUILDING_NAME_LOT: "1",
  R_ADDR_EXCLUDED_LOT: "1",
  R_ADDR_NAVER_LOT_RESCUE: "1"
});

function text(value) {
  return String(value ?? "").trim();
}

function stripTags(value) {
  return text(value).replace(/<[^>]+>/g, "");
}

// 시도로 시작하는 지번 주소인지. IROS·JUSO 재조회는 시도 없는 주소로는
// 범위가 흐려지므로, 원문 유래 주소는 시도 접두를 요구한다.
const RE_SIDO_PREFIX =
  /^(서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충청|충북|충남|전라|전북|전남|경상|경북|경남|제주)/;

export function hasRegionalLotAddress(value) {
  const source = text(value);
  if (!RE_SIDO_PREFIX.test(source)) return false;
  const lot = extractLegalLot(source);
  if (!lot) return false;
  // 법정동 앞에 시도+시군구 두 단계 이상이 있어야 한다. 시도만 있으면
  // 같은 도의 동명 리·동이 소재지 조회에서 뒤섞인다.
  return source.slice(0, source.indexOf(lot.legal)).trim().split(/\s+/).filter(Boolean).length >= 2;
}

// 지번주소에서 `… 법정동 지번`까지만 남긴다(건물명·동·호 제거).
export function lotScopedText(value) {
  const source = text(value).replace(/\s+/g, " ");
  const lot = extractLegalLot(source);
  if (!lot) return "";
  return source.slice(0, lot.lotEnd).trim();
}

function legalLotKey(value) {
  const lot = extractLegalLot(value);
  if (!lot) return "";
  return `${lot.legal}|${lot.mountain ? "산" : ""}${lot.lot}`;
}

// ── 1. 지역+건물명 재검색 ──────────────────────────────────────────────

// FAILED(검색 0건)·HUMAN_INPUT_ERROR 행에서만 계획을 만든다.
export function buildBuildingNameRequeryPlan(pre, status) {
  const eligible = new Set(["FAILED", "HUMAN_INPUT_ERROR"]);
  if (!eligible.has(text(status))) return null;
  const buildingName = text(pre?.bldName);
  if (!buildingName) return null;
  const region = [pre?.sidoFull || pre?.sido, pre?.sgg, pre?.eup, pre?.emd]
    .map(text).filter(Boolean);
  if (!region.length) return null;
  return {
    version: ADDRESS_FAILED_REQUERY_VERSION,
    query: [...region, buildingName].join(" "),
    buildingName,
    unitDong: unitKey(pre?.unit?.dong, "dong")
  };
}

function detBdDongTokens(candidate) {
  return text(candidate?.detBdNmList)
    .split(",")
    .map((token) => token.replace(/\(.*?\)\s*$/, "").trim())
    .map((token) => {
      const m = /^(.+?)동$/.exec(token);
      return m ? unitKey(m[1], "dong") : "";
    })
    .filter(Boolean);
}

// 재검색 결과 판정. 건물명이 일치하는 후보만 보고,
//   - 원문 동이 detBdNmList에 실존하는 지번이 정확히 하나 → 그 지번으로 확정
//   - 후보가 한 지번뿐 → 그 지번으로 확정
//   - 그 외 → 복수후보로 반환(기존 복수PNU-IROS 판별에 넘긴다)
export function evaluateBuildingNameRequery(hits, plan) {
  const source = Array.isArray(hits) ? hits : [];
  const named = source.filter((candidate) =>
    buildingNamesMatch(plan?.buildingName, candidate?.bdNm));
  if (!named.length) return null;

  if (plan?.unitDong) {
    const dongHits = named.filter((candidate) =>
      detBdDongTokens(candidate).includes(plan.unitDong));
    if (dongHits.length === 1) {
      return { kind: "UNIT_DONG_LOT", candidate: dongHits[0], candidates: dongHits };
    }
  }

  const lots = new Set(named.map((candidate) =>
    legalLotKey(candidate?.jibunAddr || candidate?.roadAddr)));
  if (named.length === 1 || lots.size === 1) {
    return { kind: "SINGLE_LOT", candidate: named[0], candidates: [named[0]] };
  }
  return { kind: "MULTI", candidates: named };
}

// ── 2. 용도불일치 배제 후보의 지번 재확인 ─────────────────────────────

// 배제된 후보(비주거)의 지번으로 재검색할 계획. 원문에 건물명이 있어야
// 같은 지번의 다른 건물을 근거 있게 고를 수 있다.
export function buildExcludedLotRequeryPlan({ rejectedAddress, buildingName }) {
  const query = lotScopedText(rejectedAddress);
  if (!query || !text(buildingName)) return null;
  return {
    version: ADDRESS_FAILED_REQUERY_VERSION,
    query,
    rejectedLotKey: legalLotKey(rejectedAddress),
    buildingName: text(buildingName)
  };
}

// 같은 지번 + 원문 건물명 일치 후보가 정확히 하나일 때만 채택한다.
// 배제됐던 건물명(유치원 등)과 같은 이름은 다시 고르지 않는다.
export function pickExcludedLotCandidate(hits, plan, rejectedBuildingName = "") {
  if (!plan?.rejectedLotKey) return null;
  const source = Array.isArray(hits) ? hits : [];
  const matched = source.filter((candidate) => {
    const lotKey = legalLotKey(candidate?.jibunAddr || candidate?.roadAddr);
    if (!lotKey || lotKey !== plan.rejectedLotKey) return false;
    const name = text(candidate?.bdNm);
    if (!name || !buildingNamesMatch(plan.buildingName, name)) return false;
    if (text(rejectedBuildingName) && name === text(rejectedBuildingName)) return false;
    return true;
  });
  return matched.length === 1 ? matched[0] : null;
}

// ── 3. 네이버 지번 구조(레스큐) ───────────────────────────────────────

// 네이버 확정 주소에 지번이 없을 때만 발화한다.
export function needsNaverLotRescue(result) {
  if (text(result?.status) !== "NAVER_CONFIRMED_PNU_FAILED") return false;
  for (const value of [result?.naverJibunAddr, result?.naverAddr, result?.jibunAddr]) {
    if (extractLegalLot(value)) return false;
  }
  return true;
}

export function buildNaverLotRescueQuery(pre) {
  const buildingName = text(pre?.bldName);
  if (!buildingName) return "";
  const region = [pre?.sgg, pre?.eup, pre?.emd].map(text).filter(Boolean);
  if (!region.length) return "";
  return [...region, buildingName].join(" ");
}

// 주거 카테고리(주택>…, 아파트>…)이면서 건물명이 일치하고 주소에 지번이
// 있는 항목만 본다. 지번이 하나로 수렴할 때만 그 지번을 돌려준다.
export function pickNaverLotCandidate(items, buildingName) {
  const wanted = text(buildingName);
  if (!wanted) return null;
  const matched = (Array.isArray(items) ? items : []).filter((item) => {
    const category = text(item?.category);
    if (!/^주택|아파트/.test(category)) return false;
    if (!buildingNamesMatch(wanted, stripTags(item?.title))) return false;
    return Boolean(extractLegalLot(item?.address));
  });
  if (!matched.length) return null;
  const lots = new Set(matched.map((item) => legalLotKey(item.address)));
  if (lots.size !== 1) return null;
  return {
    lotAddress: lotScopedText(matched[0].address),
    item: matched[0]
  };
}
