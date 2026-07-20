const BUILDING_PART_TOKENS = new Set([
  "상가",
  "상가동",
  "제상가동"
]);

function normalizeBuildingName(value) {
  return String(value || "")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, "")
    .toLowerCase();
}

export function isBuildingPartToken(value) {
  return BUILDING_PART_TOKENS.has(String(value || "").replace(/\s+/g, "").trim());
}

export function shouldEscalateJusoMultiToNaver(candidateCount, buildingName) {
  return Number(candidateCount || 0) > 1 && normalizeBuildingName(buildingName).length >= 2;
}

export function sameBuildingIdentity(inputName, resultName) {
  const input = normalizeBuildingName(inputName);
  const result = normalizeBuildingName(resultName);
  if (!input || !result) return false;
  if (input === result) return true;
  const shorter = input.length <= result.length ? input : result;
  const longer = input.length <= result.length ? result : input;
  return shorter.length >= 4 && longer.includes(shorter);
}

export function canAcceptNaverRegionCorrection({
  level,
  validation,
  naverPnuOk,
  reviewNeeded,
  addressMatchEvidence,
  inputBuildingName,
  resultBuildingName
}) {
  if (level !== "L3" || validation?.status !== "MISMATCH") return false;
  if (!/^(법정동|읍면) 불일치/.test(String(validation?.reason || ""))) return false;
  if (naverPnuOk !== true || reviewNeeded) return false;
  if (!(addressMatchEvidence || []).includes("EXACT_ROAD")) return false;
  return sameBuildingIdentity(inputBuildingName, resultBuildingName);
}
