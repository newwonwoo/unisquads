// 완전수집된 IROS 후보에서 세대 하나를 고르는 판정 사다리.
//
// 이 사다리는 원래 app.js 안에 인라인으로 있었다. 그래서 판정을 바꾸는 규칙을
// 넣을 때마다 "기존 확정이 뒤집히는가"를 실제 코드로 확인할 방법이 없었고,
// 배치 결과 비교는 성공값 잠금(isProtectedIrosSuccess) 때문에 언제나 "회귀
// 없음"으로 보였다 — 잠금이 작동했다는 뜻이지 규칙이 안전하다는 뜻이 아니다.
//
// 여기로 꺼내 두면 실측 후보 코퍼스에 이 함수를 그대로 돌려 판정 전수를
// 기준선과 비교할 수 있다(scripts/audit-matching-regression.mjs).
// app.js는 이 함수를 호출하므로 감사 대상이 곧 운영 코드다.
//
// 사다리 순서는 근거가 강한 것부터다. 앞 단계가 한 건으로 끝나면 뒤 단계는
// 열리지 않는다. 순서를 바꾸면 감사 기준선이 어긋나 테스트가 실패한다.

import {
  buildingKey,
  candidateHasNoDong,
  candidateMatchesUnit,
  dongAliasKey,
  excludeShopDongForDonglessRequest,
  matchedCandidateUnitVariant,
  selectDongAgnosticHoCandidate,
  selectFloorDisambiguatedCandidate,
  selectFloorPrefixedHoCandidate,
  selectRawFloorHoCandidate,
  selectUniqueRawUnitCandidate,
  IROS_MODULE_VERSIONS
} from "./unit-match.mjs";
import { matchUnitByBuildingProfile } from "./iros-unit-profile.mjs";

export const UNIT_DECISION_VERSION = "unit-decision-v1";

// pool          완전수집·지번·부동산구분까지 통과한 후보
// wantDong/Ho   요청 동·호(정규화 전 원값)
// raw           원문주소
// unit          정제된 동·호 {dong, ho}
// bdNm          정제된 건물명
// subBuilding   하위건물 의도
// 사다리를 이루는 판정 모듈. 모듈 간 간섭 감사(audit-module-interference)가
// 이 키로 모듈 하나씩을 차단해 "이 모듈이 없었으면 사다리가 무엇을 골랐는가"를
// 재고, 두 경로가 서로 다른 고유번호를 내면 충돌로 실패시킨다.
export const DECISION_MODULE_KEYS = Object.freeze([
  "SHOP_DONG_EXCLUSION",
  "SINGLE_DONG",
  "DONG_AGNOSTIC",
  "HO_BUILDING",
  "RAW_UNIT",
  "UNIT_PROFILE",
  "FLOOR_DISAMBIG",
  "DONG_AGNOSTIC_HO",
  "RAW_FLOOR_HO",
  "FLOOR_PREFIXED_HO"
]);

// rawUnitVariants 원문 표기 복구 변형(있으면 R-IROS-RAW-UNIT이 열린다)
// options.disabled  간섭 감사 전용 — 지정한 사다리 모듈을 차단한다.
//                   운영 경로는 절대 넘기지 않는다(기본 [] = 동작 불변).
export function decideUnitCandidates({
  pool,
  wantDong = "",
  wantHo = "",
  raw = "",
  unit = {},
  bdNm = "",
  subBuilding = null,
  rawUnitVariants = []
} = {}, options = {}) {
  const source = Array.isArray(pool) ? pool : [];
  const disabled = new Set(options.disabled || []);
  const enabled = (key) => !disabled.has(key);
  const applied = [];
  const applyModule = (name, version) => {
    const tag = `${name}@${version}`;
    if (!applied.includes(tag)) applied.push(tag);
  };

  let cands = source;
  let exactUnitMatched = false;
  let rawUnitRecovery = null;
  let unitProfileRecovery = null;
  let floorDisambigRecovery = null;
  let dongAgnosticRecovery = null;
  const stageCounts = {};

  if (wantDong || wantHo) {
    let matched = cands.filter((c) => {
      const variant = matchedCandidateUnitVariant(c, wantDong, wantHo);
      if (variant?.source === "composite_dong_room_prefix" ||
          variant?.source === "self_dong_ho_prefix" ||
          variant?.source === "ho_type_prefix") {
        applyModule("IROS-CANDIDATE-NORMALIZE", IROS_MODULE_VERSIONS.IROS_CANDIDATE_NORMALIZE);
      }
      return Boolean(variant);
    });
    // 검토 게이트의 무기재 건물명 예외는 1차 정확 매칭에서 잡힌 후보에만 열린다.
    exactUnitMatched = matched.length > 0;

    // R-IROS-SHOP-DONG-EXCLUSION: 동 없는 요청에서 같은 호가 무동 세대와
    // 상가동에만 갈리면 상가동을 배제한다. 숫자·알파벳 동이 섞이면 배제하지 않는다.
    if (enabled("SHOP_DONG_EXCLUSION") && matched.length > 1 && !wantDong && wantHo) {
      const trimmed = excludeShopDongForDonglessRequest(matched);
      if (trimmed.length < matched.length) {
        matched = trimmed;
        applyModule("R-IROS-SHOP-DONG-EXCLUSION", IROS_MODULE_VERSIONS.R_IROS_SHOP_DONG_EXCLUSION);
      }
    }
    // 단일 동 건물: 후보 전체에 동이 없고 호는 있을 때 호로만 재매칭.
    if (enabled("SINGLE_DONG") && !matched.length && wantDong && wantHo) {
      const anyDong = cands.some((c) => !candidateHasNoDong(c));
      const anyHo = cands.some((c) => String(c?.ho || "").trim());
      if (!anyDong && anyHo) {
        matched = cands.filter((c) => candidateMatchesUnit(c, "", wantHo));
        if (matched.length) {
          applyModule("R-IROS-SINGLE-DONG-HO", IROS_MODULE_VERSIONS.R_IROS_SINGLE_DONG_HO);
        }
      }
    }
    // R-IROS-DONG-AGNOSTIC: 원문에 "N동" 표기가 없으면 동은 그룹 전파로 붙은
    // 추정값이다. 추정 동 때문에 정확한 호를 버리지 않는다.
    if (enabled("DONG_AGNOSTIC") && !matched.length && wantDong && wantHo &&
        !/\d+\s*동/.test(String(raw || ""))) {
      const hoOnly = cands.filter((c) => candidateMatchesUnit(c, "", wantHo));
      if (hoOnly.length === 1) {
        matched = hoOnly;
        applyModule("R-IROS-DONG-AGNOSTIC", IROS_MODULE_VERSIONS.R_IROS_DONG_AGNOSTIC);
      }
    }
    // R-IROS-HO-BUILDING: 동만 비어 있고 호·건물명이 정확히 맞는 한 건.
    if (enabled("HO_BUILDING") && !matched.length && wantDong && wantHo && bdNm) {
      const wantedBuilding = buildingKey(bdNm);
      const hoBuilding = cands.filter((c) =>
        candidateHasNoDong(c) &&
        candidateMatchesUnit(c, "", wantHo) &&
        buildingKey(c.buldnm) === wantedBuilding
      );
      if (hoBuilding.length === 1) {
        matched = hoBuilding;
        applyModule("R-IROS-HO-BUILDING", IROS_MODULE_VERSIONS.R_IROS_HO_BUILDING);
      }
    }
    cands = matched;

    // R-IROS-RAW-UNIT: 단일 한 건으로 끝나지 않을 때만 원문 표기 변형으로 재매칭.
    //
    // 무회귀 기권(간섭 감사 실측): 평문 해석과 일치하는 후보가 이미 있으면,
    // 재해석 변형은 그 집합 안의 한 건으로 좁힐 때만 쓴다. 평문 일치가 있는데
    // 변형이 집합 밖의 다른 세대를 고르면 기권한다 — "1층101호"를 1101호
    // (11층)로 합성해 엉뚱한 세대를 확정하던 충돌이 실제로 있었다. 평문
    // 일치가 0건일 때(층 유실·중복 동처럼 표기 자체가 어긋난 경우)만 자유롭게
    // 재해석한다.
    if (enabled("RAW_UNIT") && cands.length !== 1 && (rawUnitVariants || []).length) {
      const recovered = selectUniqueRawUnitCandidate(source, raw, unit || {});
      const withinPlainMatches = !cands.length || cands.some((candidate) =>
        candidate === recovered?.candidate ||
        (candidate?.unique_no && candidate.unique_no === recovered?.candidate?.unique_no));
      if (recovered?.candidate && withinPlainMatches) {
        cands = [recovered.candidate];
        rawUnitRecovery = {
          selected_variant: recovered.variant,
          variants_tried: recovered.variantsTried,
          matched_candidate_count: recovered.matchedCandidateCount
        };
        applyModule("R-IROS-RAW-UNIT", IROS_MODULE_VERSIONS.R_IROS_RAW_UNIT);
      }
    }
  }
  stageCounts.unit = cands.length;
  stageCounts.raw_unit_recovery = rawUnitRecovery ? 1 : 0;

  // R-IROS-UNIT-PROFILE: 건물별 동·호 표기방식을 학습해 재매칭한다.
  //
  // 무회귀 기권(간섭 감사 실측): RAW-UNIT과 같은 원칙. 평문 해석과 일치하는
  // 후보가 이미 있으면 학습된 재해석은 그 집합 안에서만 고른다. 평문 일치가
  // 있는데 집합 밖의 다른 세대를 고르면 기권한다("1층101호"를 1101호로
  // 학습 합성하던 충돌 실측).
  if (enabled("UNIT_PROFILE") && (wantDong || wantHo) && cands.length !== 1) {
    const profiled = matchUnitByBuildingProfile(source, raw, unit || {}, bdNm || "", subBuilding || null);
    unitProfileRecovery = profiled.audit;
    stageCounts.unit_profile_matches = profiled.audit?.matched_candidate_count || 0;
    const withinPlainMatches = !cands.length || cands.some((candidate) =>
      candidate === profiled.candidate ||
      (candidate?.unique_no && candidate.unique_no === profiled.candidate?.unique_no));
    if (profiled.status === "UNIQUE" && profiled.candidate && withinPlainMatches) {
      cands = [profiled.candidate];
      unitProfileRecovery = {
        ...profiled.audit,
        selected_strategy: profiled.strategy,
        selected_profile: profiled.profile
      };
      stageCounts.unit_profile_recovery = 1;
      applyModule("R-IROS-UNIT-PROFILE", IROS_MODULE_VERSIONS.R_IROS_UNIT_PROFILE);
    } else {
      stageCounts.unit_profile_recovery = 0;
    }
  }

  // R-IROS-FLOOR-DISAMBIG: 동·호 동일 복수후보를 원문 층으로 유일화.
  if (enabled("FLOOR_DISAMBIG") && cands.length > 1 && (wantDong || wantHo)) {
    const floored = selectFloorDisambiguatedCandidate(cands, raw, unit || {});
    if (floored?.candidate) {
      cands = [floored.candidate];
      floorDisambigRecovery = floored;
      applyModule("R-IROS-FLOOR-DISAMBIG", IROS_MODULE_VERSIONS.R_IROS_FLOOR_DISAMBIG);
    }
  }
  stageCounts.floor_disambiguation = floorDisambigRecovery ? 1 : 0;

  // R-IROS-DONG-AGNOSTIC-HO: 마지막 수단. 요청 동이 등기부에 아예 없고
  // 요청한 호가 지번 전체에서 한 건일 때만 동을 무시한다.
  //
  // 무회귀 기권(간섭 감사 실측): 원문 표기 변형(중복 동 "101동 1동 101호")이
  // 등기부에 실존하는 다른 동을 가리키면, 요청 동은 오파싱일 수 있고 그 동의
  // 세대가 진짜 답이다 — 동무시가 다른 세대를 고르면 충돌이므로 기권한다.
  if (enabled("DONG_AGNOSTIC_HO") && !cands.length && wantDong && wantHo) {
    const wantDongKey = dongAliasKey(wantDong);
    const variantDongExists = (rawUnitVariants || []).some((variant) => {
      const dong = dongAliasKey(variant?.dong);
      return dong && dong !== wantDongKey &&
        source.some((candidate) => dongAliasKey(candidate?.dong) === dong);
    });
    const relaxed = variantDongExists
      ? null
      : selectDongAgnosticHoCandidate(source, wantDong, wantHo);
    if (relaxed?.candidate) {
      cands = [relaxed.candidate];
      dongAgnosticRecovery = relaxed;
      applyModule("R-IROS-DONG-AGNOSTIC-HO", IROS_MODULE_VERSIONS.R_IROS_DONG_AGNOSTIC_HO);
    }
  }
  stageCounts.dong_agnostic_ho = dongAgnosticRecovery ? 1 : 0;

  // R-IROS-RAW-FLOOR-HO: 원문 "지X-N"이 동X·호N으로 오파싱된 행의 층-호
  // 재해석. 한 건으로 못 좁혔을 때만, 원문 건물명 일치 + 층·호 정확 유일 +
  // 지하 해석 비중의 조건에서 발화한다(갈산 하나상가 실측 — 무동 상가는
  // 단일동 호 매칭이 층만 다른 복수결과를 남기므로 층으로 좁힌다).
  // 무회귀 기권: 앞 단계가 남긴 평문 일치 집합이 있으면 그 안에서만 고른다.
  let rawFloorHoRecovery = null;
  if (enabled("RAW_FLOOR_HO") && cands.length !== 1 && wantDong && wantHo) {
    const floored = selectRawFloorHoCandidate(source, raw, wantDong, wantHo);
    const withinPlainMatches = !cands.length || cands.some((candidate) =>
      candidate === floored?.candidate ||
      (candidate?.unique_no && candidate.unique_no === floored?.candidate?.unique_no));
    if (floored?.candidate && withinPlainMatches) {
      cands = [floored.candidate];
      rawFloorHoRecovery = floored;
      applyModule("R-IROS-RAW-FLOOR-HO", IROS_MODULE_VERSIONS.R_IROS_RAW_FLOOR_HO);
    }
  }
  stageCounts.raw_floor_ho = rawFloorHoRecovery ? 1 : 0;

  // R-IROS-FLOOR-PREFIXED-HO: 원문이 "층 + 1층 기준 호수"로 적힌 행
  // ("2102" = 2층 102호 ↔ 등기부 "202"). 아무것도 못 골랐을 때만,
  // 층 정합성과 중의성 기권 조건을 모두 통과할 때 발화한다(광평동 실측).
  let floorPrefixedRecovery = null;
  if (enabled("FLOOR_PREFIXED_HO") && !cands.length && wantHo) {
    const prefixed = selectFloorPrefixedHoCandidate(source, wantDong, wantHo);
    if (prefixed?.candidate) {
      cands = [prefixed.candidate];
      floorPrefixedRecovery = prefixed;
      applyModule("R-IROS-FLOOR-PREFIXED-HO", IROS_MODULE_VERSIONS.R_IROS_FLOOR_PREFIXED_HO);
    }
  }
  stageCounts.floor_prefixed_ho = floorPrefixedRecovery ? 1 : 0;

  return {
    candidates: cands,
    appliedModules: applied,
    exactUnitMatched,
    rawUnitRecovery,
    unitProfileRecovery,
    floorDisambigRecovery,
    dongAgnosticRecovery,
    rawFloorHoRecovery,
    floorPrefixedRecovery,
    stageCounts
  };
}

// 감사·회귀 비교에 쓰는 한 줄 요약. 고유번호까지 같아야 같은 판정이다.
export function decisionSignature(decision) {
  const list = decision?.candidates || [];
  if (list.length === 1) {
    return `RESOLVED:${list[0]?.unique_no || ""}:${(decision.appliedModules || []).join(",")}`;
  }
  if (list.length > 1) return `MULTI:${list.length}`;
  return "NONE";
}
