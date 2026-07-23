const KOREAN_ALPHA_DONG = Object.freeze({
  에이: "A",
  비: "B",
  비이: "B",
  씨: "C",
  디: "D",
  에프: "F",
  에이치: "H"
});

// 건물명이 없는 등기부 원문에서 확인된 compact 표기만 다룬다.
// 이동·지동·가동처럼 실제 법정동일 수 있는 한글 1음절 표기는 의도적으로 제외한다.
const RE_COMPACT_ALPHA_UNIT = /(?:^|\s)제?(에이치|에이|비이|에프|비|씨|디|[A-Za-z])동\s*(\d{1,2})\s*-\s*(\d{2,5})(?=\s|$)/;
const RE_DONG_FLOOR_HO = /(?:^|\s)제?(\d{1,4})\s*동\s*제?(\d{1,2})\s*층\s*제?(\d{1,4})\s*호(?=\s|$)/;
const RE_FLOOR_HO = /(?:^|\s)제?(\d{1,2})\s*층\s*제?(\d{1,4})\s*호(?=\s|$)/;
const RE_EXPLICIT_LOT = /[가-힣]{1,12}(?:동|리|읍|면|가)\s+(?:산\s*)?\d{1,4}(?:-\d{1,4})?(?=\s|$)/;
const RE_TRAILING_BUILDING_HO = /^(.+?\S)\s+(\d{3,4})\s*$/;
const NON_BUILDING_TAIL = /(?:외\s*\d+\s*(?:세대|호실|필지)|총\s*\d+\s*(?:세대|호실)|\d+\s*(?:세대|호실|㎡|m2|m²|평|년|년도)|(?:면적|전용|공급|대지|준공|사용승인)\s*\d*)$/i;

function composeFloorHo(floorValue, hoValue) {
  const floor = String(Number(floorValue));
  const ho = String(Number(hoValue));
  if (!floor || floor === "0" || !ho || ho === "0") return String(hoValue);
  // 이미 301·1103처럼 완성된 호수면 다시 층을 붙이지 않는다.
  if (String(hoValue).length >= 3) return String(hoValue);
  return `${floor}${ho.padStart(2, "0")}`;
}

function parseFloorHo(source) {
  const withDong = source.match(RE_DONG_FLOOR_HO);
  if (withDong) {
    return {
      dong: withDong[1],
      floor: String(Number(withDong[2])),
      ho: composeFloorHo(withDong[2], withDong[3]),
      matched: withDong[0],
      index: withDong.index ?? 0,
      evidence: "dong_floor_ho_composed"
    };
  }
  const withoutDong = source.match(RE_FLOOR_HO);
  if (!withoutDong) return null;
  return {
    dong: null,
    floor: String(Number(withoutDong[1])),
    ho: composeFloorHo(withoutDong[1], withoutDong[2]),
    matched: withoutDong[0],
    index: withoutDong.index ?? 0,
    evidence: "floor_ho_composed"
  };
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parseTrailingBuildingHo(source) {
  const lot = source.match(RE_EXPLICIT_LOT);
  if (!lot) return null;
  const tailStart = (lot.index ?? 0) + lot[0].length;
  const tail = source.slice(tailStart).trim();
  const match = tail.match(RE_TRAILING_BUILDING_HO);
  if (!match) return null;
  const buildingName = match[1].trim();
  const ho = match[2];
  if (buildingName.length < 2 || !/[가-힣A-Za-z]/.test(buildingName)) return null;
  if (NON_BUILDING_TAIL.test(tail)) return null;
  if (/(?:외|총|약|대지|면적|전용|공급|준공|사용승인)\s*$/i.test(buildingName)) return null;
  const matchedStart = tailStart + (tail.indexOf(match[0]));
  const numberOffset = match[0].lastIndexOf(ho);
  return {
    dong: null,
    floor: null,
    ho,
    // 건물명은 주소 검색에 필요하므로 말미 호수 숫자만 제거한다.
    // RegExp를 반환하면 호출부의 String.replace가 동일 숫자의 앞 지번을 건드리지 않는다.
    matched: new RegExp(`${escapeRegex(ho)}\\s*$`),
    index: matchedStart + numberOffset,
    evidence: "explicit_lot_building_trailing_ho"
  };
}

export function parseCompactAlphaUnit(value) {
  const source = String(value || "");
  const floorHo = parseFloorHo(source);
  if (floorHo) return floorHo;
  const trailingBuildingHo = parseTrailingBuildingHo(source);
  if (trailingBuildingHo) return trailingBuildingHo;
  const match = source.match(RE_COMPACT_ALPHA_UNIT);
  if (!match) return null;
  const token = match[1];
  const dong = KOREAN_ALPHA_DONG[token] || token.toUpperCase();
  return {
    dong,
    floor: String(Number(match[2])),
    ho: match[3],
    matched: match[0],
    index: match.index ?? 0,
    evidence: "compact_alpha_unit"
  };
}

// 검증 전용 토큰화 보강. 원문 자체나 JUSO 검색어는 바꾸지 않는다.
// 영천리420-6처럼 행정구역과 지번이 붙은 경우에만 경계를 넣는다.
export function normalizeAttachedAdminSpacing(value) {
  return String(value || "")
    .replace(/([가-힣]{1,8}(?:읍|면|동|리|가))(?=\d{1,4}(?:-\d+)?(?:\s|$))/g, "$1 ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeOwnerKey(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/주식회사|㈜|\(주\)|（주）/g, "")
    .replace(/[^0-9a-z가-힣]/g, "");
}

function buildingKey(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, "")
    .replace(/(?:제?상가동|상가)$/g, "")
    .replace(/[^0-9a-z가-힣]/g, "");
}

const GENERIC_BUILDING = /^(?:주공|현대|삼성|대우|롯데|한신|경남|우성|쌍용|금호|신동아|시영)?(?:아파트|맨션|빌라|연립|타운|오피스텔)$/;

export function buildingAnchorMatches(sourceName, targetName) {
  const source = buildingKey(sourceName);
  const target = buildingKey(targetName);
  if (!source || !target) return false;
  if (source === target) return true;
  if (!(source.includes(target) || target.includes(source))) return false;
  const shorter = source.length <= target.length ? source : target;
  return shorter.length >= 4 && !GENERIC_BUILDING.test(shorter);
}

export function isDistinctiveBuildingName(value) {
  const key = buildingKey(value);
  return key.length >= 4 && !GENERIC_BUILDING.test(key);
}

export function isPositivePropagationReview(value) {
  return new Set(["bldname_matched", "juso_multi"]).has(String(value || ""));
}
