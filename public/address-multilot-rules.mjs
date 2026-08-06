const RANGE_RE = /\d+\s*[~∼〜～]\s*\d+/g;
const OMITTED_EXTRA_RE = /외\s*\d+\s*필지/;
const GENERIC_BUILDING = /^(?:주공|현대|삼성|대우|롯데|한신|경남|우성|쌍용|금호|신동아|시영)?(?:아파트|맨션|빌라|연립|타운|오피스텔)$/;
const NON_LEGAL_BUILDING_LEAF = /(상가|아파트|맨션|빌라|빌리지|타운|오피스텔|프라자|플라자|빌딩|센터)$/i;

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
    // `창대장터상가 1-110`의 상가를 법정동 `...가`로 오인하지 않는다.
    // 건물명 뒤 숫자는 세대 표기일 수 있으므로 법정동+지번 증거로 쓰면 안 된다.
    if (["상가동", "제상가동"].includes(legal) || NON_LEGAL_BUILDING_LEAF.test(legal)) continue;
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
      // 쉼표 없이 정확 지번 뒤에 붙은 101-1002류는 두 번째 필지가 아니라
      // 동·호 표기일 가능성이 높다. 부번 3자리 이상인 후행 N-M만 제외하고,
      // `869-1 869-4` 같은 실제 복수지번은 그대로 보존한다.
      if (i > 0 && !commaSeparated && isUnitLikeLot(lot)) continue;
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
    if (!zipSgg || canonSidoToken(zipSgg) === resultSido) return true;
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

// 결과 지번주소에서 지번 하나를 뽑는다. "… 서부리 277-5 태광아파트" → "277-5"
// 산번지는 "산 12-3"처럼 띄어 오므로 붙여서 돌려준다(원문 대조도 공백을 지우고 한다).
const RESULT_LOT = /(?:동|리|가)\s+(산\s?)?(\d{1,5}(?:-\d{1,4})?)(?=\s|$)/;

export function resultLotOf(address) {
  const matched = String(address || "").match(RESULT_LOT);
  return matched ? (matched[1] ? "산" : "") + matched[2] : "";
}

// 법정동만 다르고 지번과 건물명이 모두 원문과 같으면, 틀린 쪽은 원문의 법정동이다.
// 지번은 법정동 안에서 부여되므로 "수진리 277-5"와 "서부리 277-5"는 다른 땅이고,
// 그 위에 같은 이름의 건물이 둘 다 있을 일은 없다. 결과는 원천이 실제로 찾아준
// 실존 주소이므로, 원문 세 요소(법정동·지번·건물명) 중 둘이 맞으면 나머지 하나가
// 오기다.
//   충북 괴산군 괴산읍 수진리 277-5 태광아파트  →  괴산읍 서부리 277-5 태광아파트
//   경남 고성군 거류면 화당리 174 새평지아파트  →  거류면 당동리 174 새평지아파트
//   울산 남구 부곡동 679-8 선암시장형 상가      →  남구 선암동 679-8 선암시장형종합상가
// 시도·시군구 불일치는 대상이 아니다(그건 진짜 오확정이다).
export function canAcceptLotBuildingCorrection({
  validation,
  rawText,
  resultAddress,
  inputBuildingName,
  resultBuildingName
}) {
  if (validation?.status !== "MISMATCH") return false;
  if (!/^(법정동|읍면) 불일치/.test(String(validation?.reason || ""))) return false;
  const lot = resultLotOf(resultAddress);
  if (!lot) return false;
  // 원문에 결과 지번이 그대로 있어야 한다(붙어 있어도 되므로 공백을 지우고 본다).
  if (!String(rawText || "").replace(/\s+/g, "").includes(lot)) return false;
  const result = buildingKey(resultBuildingName);
  if (!result || result.length < 3 || GENERIC_BUILDING.test(result)) return false;
  // 원문 어디에든 결과 건물명이 그대로 있으면 충분하다.
  if (buildingKey(rawText).includes(result)) return true;
  // "선암시장형 상가"처럼 원문이 결과의 줄임말인 경우도 같은 건물로 본다.
  const input = buildingKey(inputBuildingName);
  return Boolean(input) && input.length >= 4 && !GENERIC_BUILDING.test(input) && result.includes(input);
}
