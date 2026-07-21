const RANGE_RE = /\d+\s*[~∼〜～]\s*\d+/g;
const OMITTED_EXTRA_RE = /외\s*\d+\s*필지/;
const GENERIC_BUILDING = /^(?:주공|현대|삼성|대우|롯데|한신|경남|우성|쌍용|금호|신동아|시영)?(?:아파트|맨션|빌라|연립|타운|오피스텔)$/;

function uniqueBy(items, keyOf) {
  const seen = new Set();
  return items.filter((item) => {
    const key = keyOf(item);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildingKey(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/<[^>]+>/g, "")
    .replace(/(?:제?상가동|상가)$/g, "")
    .replace(/[^0-9a-z가-힣]/g, "");
}

function normalizeDong(value) {
  const raw = String(value || "")
    .trim()
    .replace(/^제/, "")
    .replace(/동$/, "")
    .replace(/\s+/g, "");
  const aliases = { 에이: "A", 비: "B", 비이: "B", 씨: "C", 디: "D" };
  return aliases[raw] || (/^[A-Za-z]$/.test(raw) ? raw.toUpperCase() : raw.replace(/^0+/, ""));
}

export function hasOmittedExtraLots(value) {
  return OMITTED_EXTRA_RE.test(String(value || ""));
}

// 원문에 실제로 적힌 지번만 추출한다. "외 7필지"의 생략된 지번은 만들지 않는다.
// 12-1,2,5는 12-1·12-2·12-5로 확장하고, 101동·501호 숫자는 제외한다.
export function extractExplicitLotRefs(value) {
  const source = String(value || "").replace(RANGE_RE, " ");
  const number = String.raw`산?\s*\d+(?:-\d+)?(?![\d-])(?!(?:\s*)[동호층])`;
  const pattern = new RegExp(
    String.raw`([가-힣]{1,10}(?:동\d*가|동|리|가))\s*((${number})(?:(?:\s*[,，]\s*|\s+)(${number}))*)`,
    "g"
  );
  const refs = [];
  let match;
  while ((match = pattern.exec(source))) {
    const legal = match[1];
    if (["상가동", "제상가동"].includes(legal)) continue;
    const sequence = match[2];
    const commaSeparated = /[,，]/.test(sequence);
    const tokens = sequence.match(new RegExp(number, "g")) || [];
    if (!tokens.length) continue;
    const first = tokens[0].replace(/\s+/g, "");
    const mountain = first.startsWith("산");
    const firstMain = first.replace(/^산/, "").split("-")[0];
    for (let i = 0; i < tokens.length; i++) {
      let lot = tokens[i].replace(/\s+/g, "");
      if (i > 0 && commaSeparated && !lot.includes("-") && first.includes("-") && lot.length <= 3) {
        lot = `${mountain ? "산" : ""}${firstMain}-${lot}`;
      }
      refs.push({ legal, lot });
    }
  }
  return uniqueBy(refs, (ref) => `${ref.legal}|${ref.lot}`);
}

export function isUnitLikeLot(value) {
  const match = String(value || "").replace(/^산/, "").match(/^(\d{1,4})-(\d{3,5})$/);
  return match ? { dong: match[1], ho: match[2] } : null;
}

export function isLandMultiProbeEligible({ raw, refs, unit, buildingName }) {
  if (!Array.isArray(refs) || refs.length < 2) return false;
  if (hasOmittedExtraLots(raw)) return false;
  if (unit?.dong || unit?.ho || buildingName) return false;
  return refs.every(({ lot }) => {
    const parts = String(lot || "").replace(/^산/, "").split("-");
    return /^\d{1,4}$/.test(parts[0]) &&
      (parts.length === 1 || /^\d{1,2}$/.test(parts[1]));
  });
}

export function candidateSupportsDong(candidate, wantedDong) {
  const wanted = normalizeDong(wantedDong);
  if (!wanted) return true;
  const detail = String(candidate?.detBdNmList || candidate?.detbdnm || "");
  if (!detail) return false;
  return detail
    .split(/[,/·\s]+/)
    .map(normalizeDong)
    .filter(Boolean)
    .includes(wanted);
}

export function aggregateCandidateKey(candidate) {
  const management = String(candidate?.bdMgtSn || "").trim();
  if (management) return `M:${management}`;
  const road = String(candidate?.roadAddr || "").replace(/\s+/g, "").trim();
  const building = buildingKey(candidate?.bdNm);
  if (road && building) return `R:${road}|${building}`;
  return "";
}

// 여러 지번을 조회했어도 같은 건물관리번호/도로명·건물명으로 모이면 한 건물이다.
// 동 정보가 있으면 detBdNmList가 실제로 그 동을 포함하는 군을 우선한다.
export function selectAggregateBuildingCandidates(candidates, unit = {}) {
  const source = uniqueBy(
    (Array.isArray(candidates) ? candidates : []).filter((candidate) =>
      candidate?.isJip || candidate?.bdMgtSn || candidate?.bdNm
    ),
    (candidate) => `${aggregateCandidateKey(candidate)}|${candidate?.admCd || ""}|${candidate?.mnnm || ""}|${candidate?.slno || ""}`
  );
  if (!source.length) return [];
  const groups = new Map();
  for (const candidate of source) {
    const key = aggregateCandidateKey(candidate);
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(candidate);
  }
  if (!groups.size) return [];
  let entries = [...groups.entries()];
  if (unit?.dong) {
    const dongMatched = entries.filter(([, group]) =>
      group.some((candidate) => candidateSupportsDong(candidate, unit.dong))
    );
    if (dongMatched.length === 1) entries = dongMatched;
    else if (dongMatched.length > 1) return [];
  }
  if (entries.length !== 1) return [];
  const [, selected] = entries[0];
  selected.sort((a, b) => Number(Boolean(b.isJip)) - Number(Boolean(a.isJip)));
  return selected;
}

export function ownerSearchKeyword(value) {
  let text = String(value || "")
    .replace(/주식회사|㈜|\(주\)|（주）/g, "")
    .replace(/[^0-9A-Za-z가-힣]/g, "")
    .replace(/(?:종합)?(?:건설산업|건설|주택|개발|산업|토건)$/g, "")
    .trim();
  if (/^(대한|한국|국제|성우|대원)$/.test(text)) return "";
  return text.length >= 2 ? text : "";
}

function canonSidoToken(value) {
  const text = String(value || "");
  const pairs = [
    ["서울", /서울/], ["부산", /부산/], ["대구", /대구/], ["인천", /인천/],
    ["광주", /광주/], ["대전", /대전/], ["울산", /울산/], ["세종", /세종/],
    ["경기", /경기/], ["강원", /강원/], ["충북", /충청북|충북/], ["충남", /충청남|충남/],
    ["전북", /전북|전라북/], ["전남", /전남|전라남/], ["경북", /경북|경상북/],
    ["경남", /경남|경상남/], ["제주", /제주/]
  ];
  return pairs.find(([, pattern]) => pattern.test(text))?.[0] || "";
}

export function addressMatchesZipRegions(address, zipRegions) {
  const result = String(address || "");
  const resultSido = canonSidoToken(result);
  if (!resultSido || !Array.isArray(zipRegions)) return false;
  return zipRegions.some((entry) => {
    const [zipSidoRaw, zipSggRaw] = String(entry || "").split("|");
    const zipSido = canonSidoToken(zipSidoRaw);
    if (!zipSido || zipSido !== resultSido) return false;
    const zipSgg = String(zipSggRaw || "").replace(/\s+/g, "");
    if (!zipSgg) return true;
    const compactResult = result.replace(/\s+/g, "");
    return compactResult.includes(zipSgg);
  });
}

export function canAcceptZipBuildingCorrection({
  validation,
  naverPnuOk,
  addressMatchEvidence,
  inputBuildingName,
  resultBuildingName,
  resultAddress,
  zipRegions
}) {
  if (validation?.status !== "MISMATCH") return false;
  if (!/^(시도|시군구) 불일치/.test(String(validation?.reason || ""))) return false;
  if (!naverPnuOk) return false;
  if (!(addressMatchEvidence || []).includes("EXACT_ROAD")) return false;
  const input = buildingKey(inputBuildingName);
  const result = buildingKey(resultBuildingName);
  if (!input || !result || GENERIC_BUILDING.test(input) || GENERIC_BUILDING.test(result)) return false;
  if (!(input === result || (Math.min(input.length, result.length) >= 4 && (input.includes(result) || result.includes(input))))) return false;
  return addressMatchesZipRegions(resultAddress, zipRegions);
}
