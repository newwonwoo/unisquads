import { extractBuildingRangeIntent } from "./address-subbuilding-rules.mjs";
import { UNIT_PROFILE_VERSION } from "./iros-unit-profile.mjs";
import {
  buildingKey,
  candidateMatchesUnit,
  filterUnitPropertyCandidates,
  rawUnitRecoveryVariants,
  selectUniqueRawUnitCandidate
} from "./unit-match.mjs";
import {
  AMBIGUOUS_PNU_RECOVERY_VERSION,
  buildAmbiguousPnuProbePlan,
} from "./ambiguous-pnu-recovery.mjs";
import {
  ADDRESS_REQUERY_EVIDENCE_VERSION,
  ADDRESS_REQUERY_ROUTES,
} from "./address-requery-evidence.mjs";

export const FAILURE_RECOVERY_MODULES = Object.freeze({
  A_NAVER_PNU_EXACT: Object.freeze({
    id: "R-ADDR-NAVER-PNU-EXACT",
    phase: "ADDRESS",
    version: "1",
    automatic: true,
    disposition: "AUTO_RETRY"
  }),
  A_TRANSIENT: Object.freeze({
    id: "R-ADDR-RETRY-TRANSIENT",
    phase: "ADDRESS",
    version: "1",
    automatic: true,
    disposition: "AUTO_RETRY"
  }),
  A_UNIT_RAW: Object.freeze({
    id: "R-ADDR-UNIT-RAW",
    phase: "ADDRESS",
    version: "1",
    automatic: true,
    disposition: "AUTO_RETRY"
  }),
  A_AMBIGUOUS_PNU_IROS: Object.freeze({
    id: "R-ADDR-AMBIGUOUS-PNU-IROS",
    phase: "IROS",
    version: AMBIGUOUS_PNU_RECOVERY_VERSION,
    automatic: true,
    disposition: "AUTO_RETRY"
  }),
  A_EXACT_LOT_REQUERY: Object.freeze({
    id: "R-ADDR-EXACT-LOT",
    phase: "ADDRESS",
    version: ADDRESS_REQUERY_EVIDENCE_VERSION,
    automatic: true,
    disposition: "AUTO_RETRY"
  }),
  A_EXACT_ROAD_REQUERY: Object.freeze({
    id: "R-ADDR-EXACT-ROAD",
    phase: "ADDRESS",
    version: ADDRESS_REQUERY_EVIDENCE_VERSION,
    automatic: true,
    disposition: "AUTO_RETRY"
  }),
  A_BUILDING_REQUERY: Object.freeze({
    id: "R-ADDR-BUILDING",
    phase: "ADDRESS",
    version: ADDRESS_REQUERY_EVIDENCE_VERSION,
    automatic: true,
    disposition: "AUTO_RETRY"
  }),
  A_UNIT_GROUP_REQUERY: Object.freeze({
    id: "R-ADDR-UNIT-GROUP",
    phase: "ADDRESS",
    version: ADDRESS_REQUERY_EVIDENCE_VERSION,
    automatic: true,
    disposition: "AUTO_RETRY"
  }),
  I_RETRY_INCOMPLETE: Object.freeze({
    id: "R-IROS-RETRY-INCOMPLETE",
    phase: "IROS",
    version: "1",
    automatic: true,
    disposition: "AUTO_RETRY"
  }),
  I_CONFIRMED_UNIT_INPUT: Object.freeze({
    id: "R-IROS-CONFIRMED-UNIT-INPUT",
    phase: "IROS",
    version: "1",
    automatic: true,
    disposition: "AUTO_RETRY"
  }),
  I_COMMERCIAL_RANGE: Object.freeze({
    id: "R-IROS-COMMERCIAL-RANGE",
    phase: "IROS",
    version: "1",
    automatic: true,
    disposition: "AUTO_RETRY"
  }),
  I_RAW_UNIT: Object.freeze({
    id: "R-IROS-RAW-UNIT",
    phase: "IROS",
    version: "1",
    automatic: true,
    disposition: "AUTO_RETRY"
  }),
  I_UNIT_BEARING_BUILDING: Object.freeze({
    id: "R-IROS-UNIT-BEARING-BUILDING",
    phase: "IROS",
    version: "1",
    automatic: true,
    disposition: "AUTO_RETRY"
  }),
  I_UNIT_PROFILE: Object.freeze({
    id: "R-IROS-UNIT-PROFILE",
    phase: "IROS",
    version: "2",
    automatic: true,
    disposition: "AUTO_RETRY"
  }),
  I_ALTERNATE_LOT: Object.freeze({
    id: "R-IROS-EXPLICIT-ALTERNATE-LOT",
    phase: "IROS",
    version: "2",
    automatic: true,
    disposition: "AUTO_RETRY"
  }),
  I_DONG_AGNOSTIC: Object.freeze({
    id: "R-IROS-DONG-AGNOSTIC",
    phase: "IROS",
    version: "1",
    automatic: true,
    disposition: "AUTO_RETRY"
  }),
  I_LOT_FALLBACK: Object.freeze({
    id: "R-IROS-LOT-FALLBACK",
    phase: "IROS",
    version: "1",
    automatic: true,
    disposition: "AUTO_RETRY"
  }),
  I_BUILDING_VALIDATION: Object.freeze({
    id: "R-IROS-BUILDING-VALIDATION",
    phase: "IROS",
    version: "1",
    automatic: false,
    disposition: "FAIL_AMBIGUOUS"
  }),
  FAIL_ADDRESS_AMBIGUOUS: Object.freeze({
    id: "FAIL-ADDRESS-AMBIGUOUS",
    phase: "REJECTED",
    version: "1",
    automatic: false,
    disposition: "FAIL_AMBIGUOUS"
  }),
  FAIL_SOURCE_UNIDENTIFIABLE: Object.freeze({
    id: "FAIL-SOURCE-UNIDENTIFIABLE",
    phase: "REJECTED",
    version: "1",
    automatic: false,
    disposition: "FAIL_UNIDENTIFIABLE"
  }),
  MANUAL_UNIT: Object.freeze({
    id: "MANUAL-UNIT-INPUT",
    phase: "MANUAL",
    version: "1",
    automatic: false,
    disposition: "INPUT_REQUIRED"
  }),
  FAIL_IROS_NO_UNIQUE: Object.freeze({
    id: "FAIL-IROS-NO-UNIQUE-EVIDENCE",
    phase: "REJECTED",
    version: "1",
    automatic: false,
    disposition: "FAIL_AMBIGUOUS"
  }),
  NOT_PROCESSED: Object.freeze({
    id: "PENDING-NOT-PROCESSED",
    phase: "PENDING",
    version: "1",
    automatic: false,
    disposition: "NOT_PROCESSED"
  })
});

const RETRYABLE_IROS = new Set([
  "REG_SERVICE_UNAVAILABLE",
  "REG_COLLECTION_DEFERRED",
  "REG_PARTIAL_RESPONSE",
  "REG_PARSE_ERROR",
  "REG_PARSE_INCOMPLETE",
  "REG_HTTP_ERROR",
  "REG_SESSION_ERROR",
  "REG_RATE_LIMIT",
  "REG_TIMEOUT",
  "REG_ERROR"
]);

const UNIT_FAILURES = new Set(["REG_MULTI", "MULTIPLE", "REG_UNIT_NOT_FOUND"]);

function moduleDecision(module, reason, extra = {}) {
  return {
    module,
    moduleId: module.id,
    moduleVersion: module.version,
    staleReason: reason,
    ...extra
  };
}

function unitProfileVersionFromSignature(value) {
  const match = /^(iros-unit-profile-v\d+)(?::|$)/.exec(String(value || ""));
  return match?.[1] || "";
}

function addressRequeryModule(result) {
  const evidence = result?.addressRecoveryEvidence;
  if (evidence?.version !== ADDRESS_REQUERY_EVIDENCE_VERSION) return null;
  if (evidence.route === ADDRESS_REQUERY_ROUTES.LOT_EXACT) {
    return FAILURE_RECOVERY_MODULES.A_EXACT_LOT_REQUERY;
  }
  if (evidence.route === ADDRESS_REQUERY_ROUTES.ROAD_EXACT) {
    return FAILURE_RECOVERY_MODULES.A_EXACT_ROAD_REQUERY;
  }
  if (evidence.route === ADDRESS_REQUERY_ROUTES.BUILDING) {
    return FAILURE_RECOVERY_MODULES.A_BUILDING_REQUERY;
  }
  if (evidence.route === ADDRESS_REQUERY_ROUTES.UNIT_GROUP) {
    return FAILURE_RECOVERY_MODULES.A_UNIT_GROUP_REQUERY;
  }
  return null;
}

export function needsNaverPnuExactRecovery(row) {
  const result = row?.result;
  return String(result?.status || "") === "NAVER_CONFIRMED_PNU_FAILED" &&
    result?.naverPnuRecoveryVersion !== FAILURE_RECOVERY_MODULES.A_NAVER_PNU_EXACT.version;
}

export function needsCommercialRangeUnitRematch(reg, rawAddress = "") {
  if (!UNIT_FAILURES.has(String(reg?.status || ""))) return false;
  const signature = String(reg?.match_evidence?.unit_intent_signature || "");
  if (signature && !signature.startsWith("iros-unit-profile-v2:")) return false;
  return Boolean(extractBuildingRangeIntent(rawAddress));
}

export function needsUnitProfileVersionRematch(
  reg,
  currentProfileVersion = UNIT_PROFILE_VERSION
) {
  if (!UNIT_FAILURES.has(String(reg?.status || ""))) return false;
  const recordedVersion = unitProfileVersionFromSignature(
    reg?.match_evidence?.unit_intent_signature
  );
  const currentVersion = String(currentProfileVersion || "");
  return Boolean(recordedVersion && currentVersion && recordedVersion !== currentVersion);
}

export function needsUnitBearingBuildingRematch(row) {
  const reg = row?.reg;
  const status = String(reg?.status || "");
  const failureStage = String(reg?.failure_stage || "");
  const eligibleFailure =
    (status === "REG_VALIDATION_FAILED" && failureStage === "PROPERTY_CLASS") ||
    (status === "REG_UNIT_NOT_FOUND" && failureStage === "UNIT");
  if (!eligibleFailure) return false;
  const dong = row?.result?.unit?.dong || "";
  const ho = row?.result?.unit?.ho || "";
  if (!ho) return false;
  return filterUnitPropertyCandidates(reg?.candidates || [], dong, ho).evidence ===
    "EXPLICIT_UNIT_BUILDING";
}

export function rawUnitRematchEvidence(row) {
  const reg = row?.reg;
  if (!UNIT_FAILURES.has(String(reg?.status || "")) || reg?.complete !== true) return null;
  const unit = row?.result?.unit || {};
  const variants = rawUnitRecoveryVariants(row?.raw || "", unit);
  if (!variants.length) return null;
  const typed = filterUnitPropertyCandidates(
    reg?.candidates || [],
    unit.dong || "",
    unit.ho || "",
    variants
  );
  if (!typed.verified) return null;
  return selectUniqueRawUnitCandidate(typed.candidates, row?.raw || "", unit);
}

// 원문에 "N동" 표기가 아예 없는데 추정 동 때문에 세대를 못 찾은 행.
// 저장된 완전후보 안에서 호로만 다시 보면 한 건으로 좁혀진다(실측 94행).
export function needsDongAgnosticRematch(row) {
  const reg = row?.reg;
  if (!UNIT_FAILURES.has(String(reg?.status || "")) || reg?.complete !== true) return false;
  const unit = row?.result?.unit || {};
  if (!unit.dong || !unit.ho) return false;
  if (/\d+\s*\uB3D9/.test(String(row?.raw || ""))) return false;
  const typed = filterUnitPropertyCandidates(reg?.candidates || [], unit.dong, unit.ho);
  const hoOnly = (typed.candidates || []).filter((candidate) =>
    candidateMatchesUnit(candidate, "", unit.ho));
  return hoOnly.length === 1;
}

// 확정 지번으로 후보를 거르면 전멸하지만, 같은 건물명 후보는 남아 있는 행.
// 복수지번 건물의 등기 소재지번이 확정 지번과 다를 때 생긴다(실측 194행).
export function needsLotFallbackRematch(row) {
  const reg = row?.reg;
  if (String(reg?.status || "") !== "REG_VALIDATION_FAILED") return false;
  if (String(reg?.failure_stage || "") !== "PROPERTY_CLASS") return false;
  const wanted = buildingKey(row?.result?.bdNm || "");
  if (!wanted) return false;
  return (reg?.candidates || []).some((candidate) => buildingKey(candidate?.buldnm) === wanted);
}

export function selectIrosRecoveryAction(row) {
  const reg = row?.reg;
  if (!reg || (reg.status === "RESOLVED" && String(reg.unique_no || "").trim())) return null;

  if (RETRYABLE_IROS.has(String(reg.status || ""))) {
    return moduleDecision(
      FAILURE_RECOVERY_MODULES.I_RETRY_INCOMPLETE,
      "IROS_INCOMPLETE_RETRY"
    );
  }
  if (String(reg.status || "") === "UNIT_INPUT_REQUIRED" &&
      String(row?.result?.unit?.ho || "").trim() && row?.result?.unitRecovery?.version) {
    return moduleDecision(
      FAILURE_RECOVERY_MODULES.I_CONFIRMED_UNIT_INPUT,
      "CONFIRMED_UNIT_INPUT_REMATCH"
    );
  }
  if (reg.recovery_pending === true || reg.recovery_attempted === false) {
    return moduleDecision(
      FAILURE_RECOVERY_MODULES.I_ALTERNATE_LOT,
      "EXPLICIT_ALTERNATE_LOT_REMATCH"
    );
  }
  if (needsCommercialRangeUnitRematch(reg, row?.raw || "")) {
    return moduleDecision(
      FAILURE_RECOVERY_MODULES.I_COMMERCIAL_RANGE,
      "COMMERCIAL_RANGE_UNIT_REMATCH"
    );
  }
  const rawUnit = rawUnitRematchEvidence(row);
  if (rawUnit) {
    return moduleDecision(
      FAILURE_RECOVERY_MODULES.I_RAW_UNIT,
      "RAW_UNIT_REMATCH",
      { evidence: rawUnit }
    );
  }
  if (needsUnitBearingBuildingRematch(row)) {
    return moduleDecision(
      FAILURE_RECOVERY_MODULES.I_UNIT_BEARING_BUILDING,
      "UNIT_BEARING_BUILDING_REMATCH"
    );
  }
  if (needsLotFallbackRematch(row)) {
    return moduleDecision(
      FAILURE_RECOVERY_MODULES.I_LOT_FALLBACK,
      "IROS_LOT_FALLBACK_REMATCH"
    );
  }
  if (needsDongAgnosticRematch(row)) {
    return moduleDecision(
      FAILURE_RECOVERY_MODULES.I_DONG_AGNOSTIC,
      "IROS_DONG_AGNOSTIC_REMATCH"
    );
  }
  if (needsUnitProfileVersionRematch(reg)) {
    return moduleDecision(
      FAILURE_RECOVERY_MODULES.I_UNIT_PROFILE,
      "UNIT_PROFILE_VERSION_REMATCH",
      {
        fromProfileVersion: unitProfileVersionFromSignature(
          reg?.match_evidence?.unit_intent_signature
        ),
        toProfileVersion: UNIT_PROFILE_VERSION
      }
    );
  }
  return null;
}

export function classifyFailureModule(row) {
  const result = row?.result;
  if (!result) return FAILURE_RECOVERY_MODULES.NOT_PROCESSED;
  if (!result || !["CONFIRMED", "확정"].includes(result.status)) {
    if (needsNaverPnuExactRecovery(row)) return FAILURE_RECOVERY_MODULES.A_NAVER_PNU_EXACT;
    if (buildAmbiguousPnuProbePlan(row)) return FAILURE_RECOVERY_MODULES.A_AMBIGUOUS_PNU_IROS;
    if (result?.status === "SYSTEM_ERROR" ||
        (result?.status === "FAILED" && result?.failKind === "TRANSIENT")) {
      return FAILURE_RECOVERY_MODULES.A_TRANSIENT;
    }
    const requeryModule = addressRequeryModule(result);
    if (requeryModule) return requeryModule;
    if (["AMBIGUOUS", "VALIDATION_FAILED"].includes(String(result?.status || ""))) {
      return FAILURE_RECOVERY_MODULES.FAIL_ADDRESS_AMBIGUOUS;
    }
    return FAILURE_RECOVERY_MODULES.FAIL_SOURCE_UNIDENTIFIABLE;
  }
  if ((result.isJip && !result.unit?.ho) ||
      (row?.reg?.status === "UNIT_INPUT_REQUIRED" && !result.unit?.ho)) {
    return FAILURE_RECOVERY_MODULES.MANUAL_UNIT;
  }
  const action = selectIrosRecoveryAction(row);
  if (action) return action.module;
  if (row?.reg?.status === "REG_VALIDATION_FAILED") {
    return FAILURE_RECOVERY_MODULES.I_BUILDING_VALIDATION;
  }
  if (UNIT_FAILURES.has(String(row?.reg?.status || ""))) {
    return FAILURE_RECOVERY_MODULES.FAIL_IROS_NO_UNIQUE;
  }
  if (!row?.reg) return FAILURE_RECOVERY_MODULES.NOT_PROCESSED;
  return FAILURE_RECOVERY_MODULES.FAIL_IROS_NO_UNIQUE;
}

export function buildFailureRecoveryPlan(rows) {
  const source = Array.isArray(rows) ? rows : [];
  const total = source.length;
  let addressConfirmed = 0;
  let finalResolved = 0;
  const modules = new Map();
  const dispositions = new Map();

  for (const row of source) {
    const confirmed = ["CONFIRMED", "확정"].includes(row?.result?.status) &&
      Boolean(String(row?.result?.pnu || "").trim());
    if (confirmed) addressConfirmed += 1;
    const resolved = confirmed && row?.reg?.status === "RESOLVED" &&
      Boolean(String(row?.reg?.unique_no || "").trim());
    if (resolved) {
      finalResolved += 1;
      continue;
    }
    const module = classifyFailureModule(row);
    const current = modules.get(module.id) || {
      id: module.id,
      phase: module.phase,
      version: module.version,
      automatic: module.automatic,
      disposition: module.disposition,
      rows: 0
    };
    current.rows += 1;
    modules.set(module.id, current);
    dispositions.set(module.disposition, (dispositions.get(module.disposition) || 0) + 1);
  }

  return {
    total,
    addressConfirmed,
    addressRate: total ? addressConfirmed / total : 0,
    finalResolved,
    finalRate: total ? finalResolved / total : 0,
    unresolved: Math.max(0, total - finalResolved),
    dispositions: Object.fromEntries(dispositions),
    modules: [...modules.values()].sort((a, b) => b.rows - a.rows || a.id.localeCompare(b.id))
  };
}
