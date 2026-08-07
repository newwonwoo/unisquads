// 주소 실패 재조회 체인 — 정제율 복구 모듈의 실행 순서와 확정 조건.
//
// 원래 app.js 인라인이었다. 여기로 꺼내 두면 정제율 모듈 간섭 감사
// (scripts/audit-address-interference.mjs)가 실측 픽스처(JUSO·네이버 실제
// 응답)로 이 체인을 그대로 돌려 "모듈 순서가 확정 지번을 바꾸는가"를 잰다.
// app.js는 resolve/validateRegion 실구현을 ctx로 주입해 이 체인을 호출한다.
//
// options.disabled 는 간섭 감사 전용(모듈 차단). 운영은 넘기지 않는다.
// 차단 키: ADMIN_DONG_LOT · EXCLUDED_LOT · BUILDING_NAME_LOT · NAVER_LOT_RESCUE

import {
  ADDRESS_FAILED_REQUERY_MODULES,
  buildAdminDongLotRequeryPlan,
  buildBuildingNameRequeryPlan,
  buildExcludedLotRequeryPlan,
  buildNaverLotRescueQuery,
  evaluateBuildingNameRequery,
  needsNaverLotRescue,
  pickAdminDongLotCandidate,
  pickExcludedLotCandidate,
  pickNaverLotCandidate
} from "./address-failed-requery.mjs";
import { buildingNamesMatch, extractLegalLot } from "./unit-match.mjs";

export const ADDRESS_DECISION_MODULE_KEYS = Object.freeze([
  "ADMIN_DONG_LOT", "EXCLUDED_LOT", "BUILDING_NAME_LOT", "NAVER_LOT_RESCUE"
]);

// 실패 상태에서만 발화하는 주소 재조회 3경로(address-failed-requery.mjs).
// 어느 경로든 확정 조건(지역 검증 통과 + 단일 후보)을 못 채우면 null을
// 돌려주고 원래 실패 결과가 그대로 유지된다 — 기존 CONFIRMED 회귀 불가.
function lotPreOf(pre, candidate) {
  const lotInfo = extractLegalLot(candidate?.jibunAddr || "");
  return {
    ...pre,
    jibun: lotInfo ? `${lotInfo.mountain ? "산" : ""}${lotInfo.lot}` : pre.jibun,
    emd: lotInfo?.legal || pre.emd,
    emdCands: lotInfo?.legal ? [lotInfo.legal] : pre.emdCands
  };
}
// R-ADDR-ADMIN-DONG-LOT: 숫자 행정동 표기 지번(대치4동 889-56)의 법정동
// 교정 재검색. 교정 법정동+원문 지번이 정확히 한 건일 때만 확정한다.
export async function runAdminDongLotRequery(result, pre, clients, ctx, options = {}) {
  const { resolve, validateRegion } = ctx;
  const enabled = (key) => !(options.disabled || []).includes(key);
  if (!enabled("ADMIN_DONG_LOT")) return null;
  try {
    const plan = buildAdminDongLotRequeryPlan(pre, result?.status);
    if (!plan) return null;
    const hits = await clients.juso(plan.query);
    const picked = pickAdminDongLotCandidate(hits, plan);
    if (!picked) return null;
    const recovered = resolve([picked], lotPreOf(pre, picked));
    // 지역 검증은 행정동을 법정동으로 바꾼 입력 기준으로 본다(같은 명명 규칙).
    const inputText = String(pre.regionText || pre.cleaned || "")
      .replace(plan.adminDong, plan.legalDong);
    const rv = validateRegion(inputText, recovered.jibunAddr, false, "");
    if (recovered.status !== "CONFIRMED" || rv.status === "MISMATCH") return null;
    recovered.searchLevel = result.searchLevel || null;
    recovered.jusoQuery = `${result.jusoQuery || pre.cleaned} ▸ [법정동교정]${plan.query}`;
    recovered.candCount = 1;
    recovered.reviewNeeded = recovered.reviewNeeded || "admin_dong_lot_requery";
    recovered.validation = {
      status: "MATCH",
      reason: `행정동 표기(${plan.adminDong})를 법정동(${plan.legalDong})으로 교정해 정확 지번 일치`,
      inputSgg: rv.inputSgg, resultSgg: rv.resultSgg
    };
    recovered.addressMatchEvidence = [...new Set([
      ...(recovered.addressMatchEvidence || []), "ADMIN_DONG_LOT_REQUERY"
    ])];
    recovered.failedRequery = {
      module: "R-ADDR-ADMIN-DONG-LOT",
      version: ADDRESS_FAILED_REQUERY_MODULES.R_ADDR_ADMIN_DONG_LOT
    };
    return recovered;
  } catch {
    return null;
  }
}
export async function runFailedAddressRequery(result, pre, clients, ctx, options = {}) {
  const { resolve, validateRegion } = ctx;
  const enabled = (key) => !(options.disabled || []).includes(key);
  try {
    const status = String(result?.status || "");
    // 행정동 숫자 표기 교정이 가장 결정적(정확 지번 일치)이라 먼저 본다.
    const adminDong = await runAdminDongLotRequery(result, pre, clients, ctx, options);
    if (adminDong) return adminDong;

    // R-ADDR-EXCLUDED-LOT: 용도 불일치로 배제한 후보의 지번을 재확인.
    // 같은 지번에 원문 건물명과 일치하는 다른 건물이 정확히 하나면 채택.
    if (enabled("EXCLUDED_LOT") && status === "VALIDATION_FAILED" &&
        /^용도 불일치/.test(String(result?.validation?.reason || ""))) {
      const plan = buildExcludedLotRequeryPlan({
        rejectedAddress: result.jibunAddr || result.roadAddr || "",
        buildingName: pre?.bldName || ""
      });
      if (!plan) return null;
      const hits = await clients.juso(plan.query);
      const picked = pickExcludedLotCandidate(hits, plan, result.bdNm || "");
      if (!picked) return null;
      const recovered = resolve([picked], lotPreOf(pre, picked));
      const rv = validateRegion(pre.regionText || pre.cleaned, recovered.jibunAddr, false, "");
      if (recovered.status !== "CONFIRMED" || rv.status === "MISMATCH") return null;
      recovered.searchLevel = result.searchLevel || null;
      recovered.jusoQuery = `${result.jusoQuery || pre.cleaned} ▸ [배제지번]${plan.query}`;
      recovered.candCount = 1;
      recovered.reviewNeeded = recovered.reviewNeeded || "excluded_lot_requery";
      recovered.validation = {
        status: "MATCH",
        reason: "용도 불일치로 배제한 후보의 지번에서 원문 건물명 일치 건물로 재확정",
        inputSgg: rv.inputSgg, resultSgg: rv.resultSgg
      };
      recovered.addressMatchEvidence = [...new Set([
        ...(recovered.addressMatchEvidence || []), "EXCLUDED_LOT_REQUERY"
      ])];
      recovered.failedRequery = {
        module: "R-ADDR-EXCLUDED-LOT",
        version: ADDRESS_FAILED_REQUERY_MODULES.R_ADDR_EXCLUDED_LOT
      };
      return recovered;
    }

    // R-ADDR-BUILDING-NAME-LOT: 지번식 검색 0건 행의 지역+건물명 재검색.
    if (status === "FAILED" && String(result?.reason || "") !== "NOT_FOUND") return null;
    if (!enabled("BUILDING_NAME_LOT")) return null;
    const plan = buildBuildingNameRequeryPlan(pre, status);
    if (!plan) return null;
    const hits = await clients.juso(plan.query);
    const judged = evaluateBuildingNameRequery(hits, plan);
    if (!judged) return null;
    if (judged.kind === "MULTI") {
      // 지번을 하나로 못 좁히면 복수후보로만 승격한다. 확정이 아니라
      // 기존 복수PNU-IROS 판별(R-ADDR-AMBIGUOUS-PNU-IROS)의 입력이 된다.
      const multi = resolve(judged.candidates, { ...pre, jibun: "" });
      if (multi.status !== "AMBIGUOUS") return null;
      multi.searchLevel = result.searchLevel || null;
      multi.jusoQuery = `${result.jusoQuery || pre.cleaned} ▸ [건물명]${plan.query}`;
      multi.candCount = judged.candidates.length;
      multi.validation = { status: "NOT_AVAILABLE",
        reason: "건물명 재검색 — 복수 지번", inputSgg: "", resultSgg: "" };
      multi.addressMatchEvidence = [...new Set([
        ...(multi.addressMatchEvidence || []), "BUILDING_NAME_REQUERY_MULTI"
      ])];
      multi.failedRequery = {
        module: "R-ADDR-BUILDING-NAME-LOT",
        version: ADDRESS_FAILED_REQUERY_MODULES.R_ADDR_BUILDING_NAME_LOT,
        kind: "MULTI"
      };
      return multi;
    }
    const single = resolve([judged.candidate], lotPreOf(pre, judged.candidate));
    const rv = validateRegion(pre.regionText || pre.cleaned, single.jibunAddr, false, "");
    if (single.status !== "CONFIRMED" || rv.status === "MISMATCH") return null;
    single.searchLevel = result.searchLevel || null;
    single.jusoQuery = `${result.jusoQuery || pre.cleaned} ▸ [건물명]${plan.query}`;
    single.candCount = judged.candidates.length;
    single.reviewNeeded = single.reviewNeeded || "building_name_requery";
    single.validation = {
      status: "MATCH",
      reason: judged.kind === "UNIT_DONG_LOT"
        ? "건물명 재검색 — 원문 동이 실존하는 지번으로 확정"
        : "건물명 재검색 — 단일 지번 확정",
      inputSgg: rv.inputSgg, resultSgg: rv.resultSgg
    };
    single.addressMatchEvidence = [...new Set([
      ...(single.addressMatchEvidence || []),
      judged.kind === "UNIT_DONG_LOT" ? "BUILDING_NAME_UNIT_DONG_LOT" : "BUILDING_NAME_SINGLE_LOT"
    ])];
    single.failedRequery = {
      module: "R-ADDR-BUILDING-NAME-LOT",
      version: ADDRESS_FAILED_REQUERY_MODULES.R_ADDR_BUILDING_NAME_LOT,
      kind: judged.kind
    };
    return single;
  } catch {
    return null; // 일시 오류는 재조회만 포기하고 원래 실패를 유지한다
  }
}
// R-ADDR-NAVER-LOT-RESCUE: 네이버가 지번 없는 주소만 준 행의 지번 구조.
export async function runNaverLotRescue(pnuFailed, pre, clients, ctx, options = {}) {
  const { resolve, validateRegion } = ctx;
  const enabled = (key) => !(options.disabled || []).includes(key);
  if (!enabled("NAVER_LOT_RESCUE")) return null;
  try {
    if (!needsNaverLotRescue(pnuFailed)) return null;
    const rescueQuery = buildNaverLotRescueQuery(pre);
    if (!rescueQuery) return null;
    const items = await clients.naverLocal(rescueQuery);
    const picked = pickNaverLotCandidate(items, pre.bldName);
    if (!picked?.lotAddress) return null;
    const lotHits = await clients.juso(picked.lotAddress);
    const named = (lotHits || []).filter((hit) => buildingNamesMatch(pre.bldName, hit?.bdNm));
    if (named.length !== 1) return null;
    const rescued = resolve([named[0]], lotPreOf(pre, named[0]));
    const rv = validateRegion(pre.regionText || pre.cleaned, rescued.jibunAddr, true, "");
    if (rescued.status !== "CONFIRMED" || rv.status === "MISMATCH") return null;
    rescued.searchLevel = "L3";
    rescued.jusoQuery = `${pnuFailed.jusoQuery || pre.cleaned} ▸ [레스큐]${rescueQuery} ▸ ${picked.lotAddress}`;
    rescued.candCount = 1;
    rescued.naverAddr = pnuFailed.naverAddr || "";
    rescued.naverJibunAddr = picked.lotAddress;
    rescued.naverRoadAddr = pnuFailed.naverRoadAddr || "";
    rescued.reviewNeeded = rescued.reviewNeeded || "naver_lot_rescue";
    rescued.validation = {
      status: "MATCH",
      reason: "네이버 지역검색 지번 구조 + JUSO 교차확인",
      inputSgg: rv.inputSgg, resultSgg: rv.resultSgg
    };
    rescued.addressMatchEvidence = [...new Set([
      ...(rescued.addressMatchEvidence || []), "NAVER_LOT_RESCUE"
    ])];
    rescued.failedRequery = {
      module: "R-ADDR-NAVER-LOT-RESCUE",
      version: ADDRESS_FAILED_REQUERY_MODULES.R_ADDR_NAVER_LOT_RESCUE
    };
    return rescued;
  } catch {
    return null;
  }
}