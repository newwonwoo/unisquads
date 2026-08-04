const BUILDING_PART_TOKENS = new Set([
  "상가",
  "상가동",
  "제상가동"
]);

export const NAVER_PNU_RECOVERY_VERSION = "1";

function normalizedQuery(value) {
  return String(value || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

// 네이버 주소에 붙은 건물명 때문에 JUSO가 0건 또는 복수후보를 주는 경우를 위해
// 지번/도로명 식별부까지만 잘라 재조회한다. 숫자를 새로 만들거나 지번 범위를
// 대표지번으로 축약하지 않으며, 최종 승격은 JUSO 단일 PNU일 때만 가능하다.
export function exactAddressCore(value) {
  const address = normalizedQuery(value).replace(/\([^)]*\)/g, " ").replace(/\s+/g, " ").trim();
  if (!address) return "";
  const lot = address.match(
    /^(.+?(?:동\d*가|동|가|리)\s+(?:산\s*)?\d{1,4}(?:-\d{1,4})?)(?=\s|$)/
  );
  if (lot) return normalizedQuery(lot[1]);
  const road = address.match(
    /^(.+?(?:대로|로|길)(?:\s*\d+번길)?\s+\d{1,5}(?:-\d{1,5})?)(?=\s|$)/
  );
  return road ? normalizedQuery(road[1]) : "";
}

export function naverPnuRecoveryQueries(...addresses) {
  const out = [];
  for (const value of addresses.flat()) {
    const original = normalizedQuery(value);
    const core = exactAddressCore(original);
    for (const query of [original, core]) {
      if (query && !out.includes(query)) out.push(query);
    }
  }
  return out;
}

function normalizeBuildingName(value) {
  return String(value || "")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, "")
    .toLowerCase()
    .replace(/(?:제?상가동|상가)$/, "");
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
  return Boolean(input && result && input === result);
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
