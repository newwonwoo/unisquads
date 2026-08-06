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

// 원문에 "반촌리420-6반촌명지아파트103-412"처럼 법정동이 지번·건물명과 통째로
// 붙어 오는 경우가 있다. normalizeAttachedAdminSpacing은 뒤가 숫자로 끝날 때만
// 띄우므로 이런 토큰은 지역 검증에서 통째로 버려지고, 원문에 분명히 있는
// 법정동이 "불일치"로 차단된다. 검증 후보를 뽑을 때만 앞머리를 인정한다.
// 검색어·동호 파싱은 건드리지 않는다.
const RE_GLUED_ADMIN = /^([가-힣]{1,4}(?:동|읍|면|리|가))\d/;
// 에이동101호 같은 알파벳 동 표기는 법정동이 아니다.
const ALPHA_DONG = /^(?:에이|비이|씨|디|에프|에이치|[A-Za-z])동$/;

export function gluedAdminToken(token) {
  const value = String(token || "").trim();
  // 상동5길·중앙로2 같은 도로명은 앞머리가 법정동처럼 보여도 도로다.
  if (/(길|로)$/.test(value)) return "";
  const matched = value.match(RE_GLUED_ADMIN);
  if (!matched) return "";
  const head = matched[1];
  if (ALPHA_DONG.test(head) || isBuildingPartToken(head)) return "";
  return head;
}

// 읍면은 리(법정동 말단)의 상위 계층이다. 같은 시군구 안에서 리 이름은 사실상
// 유일하므로, 리가 일치하면 읍면 표기 차이는 원문 쪽 오류로 본다.
//   충남 당진군 송산면 진관리642-2  →  충남 당진시 고대면 진관리 642-6 (실측)
// 반대로 리가 불일치하면 읍면 일치 여부와 무관하게 그대로 차단된다.
export function blockingRegionLevel(levels) {
  const list = levels || [];
  const leafMatched = list.some((level) => level.name === "법정동" && level.compared?.match);
  for (const level of list) {
    if (level.compared?.match) continue;
    if (level.name === "읍면" && leafMatched) continue;
    return level;
  }
  return null;
}
