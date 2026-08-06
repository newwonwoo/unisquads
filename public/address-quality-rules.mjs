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

function parseFloorHo(source) {
  const withDong = source.match(RE_DONG_FLOOR_HO);
  if (withDong) {
    return {
      dong: withDong[1],
      floor: String(Number(withDong[2])),
      ho: String(Number(withDong[3])),
      matched: withDong[0],
      index: withDong.index ?? 0
    };
  }
  const withoutDong = source.match(RE_FLOOR_HO);
  if (!withoutDong) return null;
  return {
    dong: null,
    floor: String(Number(withoutDong[1])),
    ho: String(Number(withoutDong[2])),
    matched: withoutDong[0],
    index: withoutDong.index ?? 0
  };
}

export function parseCompactAlphaUnit(value) {
  const source = String(value || "");
  const floorHo = parseFloorHo(source);
  if (floorHo) return floorHo;
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

// 네 자리 호수는 앞 두 자리가 층이다. 지번에 바로 붙어 온 숫자를 통째로 호로 읽으면
// 있을 수 없는 층이 나오는데, 그건 호수가 큰 게 아니라 절단 위치가 틀렸다는 뜻이다.
//   중랑구 중화동 274-76701호  →  274-7 + 6701호(67층) ✗   274-76 + 701호(7층) ✓
//   경남 창원시 내동 456-19301호 → 456-1 + 9301호(93층) ✗  456-19 + 301호(3층) ✓
// 앞자리를 하나 지번 쪽으로 돌려주면 지번 파싱도 함께 맞는다. 숫자에 붙어 온
// 경우에만 적용한다 — 상가·오피스텔은 층과 무관한 네 자리 호수를 쓰기도 한다.
export const MAX_PLAUSIBLE_FLOOR = 60;

export function splitImplausibleFloorHo(value) {
  return String(value || "").replace(/(\d)(\d{4})(\s*호)/g, (matched, prev, ho, suffix) =>
    Number(ho.slice(0, 2)) > MAX_PLAUSIBLE_FLOOR
      ? `${prev}${ho[0]} ${ho.slice(1)}${suffix}`
      : matched);
}

// 숫자를 지우고 남은 등기부 조각과 택지개발 표기는 건물명이 아니다.
//   ...동소제102동제602호   → 잔재 "동제"가 건물명이 되어 R9 동소 치환을 오염시킨다
//                            (예천 석정리 24행: 네이버 질의가 "동제제"가 되어 0건)
//   ...현진에버빌아파트제105동7층702호 → 꼬리 "제"가 붙어 네이버 0건 (3행)
//   창원 도계동 144블록 5노트 → "블록"으로 검색해 엉뚱한 건물을 잡는다 (2행)
const REGISTRY_FRAGMENT = /^[제동호층]+$/;
const LAND_PLAN_TOKEN = /^(블록|블럭|로트|롯트|노트|지구|구역)$/;

export function isBuildingNameNoise(token) {
  const value = String(token || "").trim();
  if (!value) return true;
  return REGISTRY_FRAGMENT.test(value) || LAND_PLAN_TOKEN.test(value);
}

// 꼬리에 남은 "제"만 떼어낸다. 동·호·층은 건물명 일부일 수 있어 건드리지 않는다.
// 떼고 나서 두 글자가 안 남으면 그 "제"는 이름의 일부다("거제" → "거"가 되면 안 된다).
export function stripRegistryTail(name) {
  const value = String(name || "").trim();
  const stripped = value.replace(/제+$/, "");
  return stripped.length >= 2 ? stripped : value;
}
