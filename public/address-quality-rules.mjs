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

export function parseCompactAlphaUnit(value) {
  const source = String(value || "");
  const match = source.match(RE_COMPACT_ALPHA_UNIT);
  if (!match) return null;
  const token = match[1];
  const dong = KOREAN_ALPHA_DONG[token] || token.toUpperCase();
  return {
    dong,
    floor: String(Number(match[2])),
    ho: match[3],
    matched: match[0],
    index: match.index ?? 0
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
