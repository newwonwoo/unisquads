export const CONFIRMED_UNIT_RECOVERY_VERSION = "1";

const BUILDING_MARKER = /(?:아파트|apt|@|맨션|빌라|빌리지|오피스텔|타운|상가|빌딩|폴리스|시티|휴튼|슈퍼빌|센시빌|하이원|그린빌|드림밸리|에버빌|하이츠|마을|코아)/i;
const NON_UNIT_SUFFIX = /(?:세대|호실|필지|지분|㎡|m2|m²|평|년|년도|개물건|건)$/i;
const KOREAN_ALPHA = Object.freeze({
  에이: "A", 비이: "B", 비: "B", 씨: "C", 디: "D", 에프: "F", 에이치: "H"
});

function normalize(value) {
  return String(value || "")
    .normalize("NFKC")
    .replace(/[()[\]{}]/g, " ")
    .replace(/[,·]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function trimAggregateSuffix(value) {
  return normalize(value)
    .replace(/\s+외\s*\d+\s*세대\s*$/i, "")
    .replace(/\s+총\s*\d+\s*세대\s*$/i, "")
    .trim();
}

function alphaDong(value) {
  const token = String(value || "").replace(/^제/, "");
  return KOREAN_ALPHA[token] || (/^[A-Za-z]$/.test(token) ? token.toUpperCase() : token);
}

function alphaRoom(value) {
  const token = String(value || "").replace(/^제/, "");
  const match = /^(비이|비|에이치|에이|씨|디|에프)(\d+(?:-\d+)*)$/.exec(token);
  return match ? `${alphaDong(match[1])}${match[2]}` : token.toUpperCase();
}

function hasBuildingEvidence(prefix, result) {
  if (BUILDING_MARKER.test(prefix)) return true;
  const resultName = String(result?.bdNm || "").replace(/\s+/g, "").toLowerCase();
  const rawPrefix = String(prefix || "").replace(/\s+/g, "").toLowerCase();
  return Boolean(resultName.length >= 4 && rawPrefix.includes(resultName));
}

function recovered(kind, unit, matched) {
  return {
    kind,
    version: CONFIRMED_UNIT_RECOVERY_VERSION,
    unit,
    evidence: "CONFIRMED_PNU_AND_EXPLICIT_TRAILING_UNIT",
    matched: String(matched || "").trim()
  };
}

// 주소를 먼저 확정한 뒤에만 적용한다. 지번과 동·호가 모두 N-M 형태인 원문을
// 전처리 단계에서 추측하지 않고, PNU가 확보된 결과의 말미 구조만 해석한다.
export function recoverConfirmedUnit(rawAddress, result = {}) {
  if (!["CONFIRMED", "확정"].includes(String(result?.status || "")) ||
      !String(result?.pnu || "").trim() || String(result?.unit?.ho || "").trim()) {
    return null;
  }
  const source = trimAggregateSuffix(rawAddress);
  if (!source || NON_UNIT_SUFFIX.test(source)) return null;

  // 현대코아아파트 지1-146-1: 지하층과 호를 동으로 오인하지 않는다.
  const basement = /(?:지하|지|B)\s*(\d{1,2})\s*-\s*(\d{1,4}(?:-\d+)*)\s*(?:호)?$/i.exec(source);
  const basementPrefix = basement ? source.slice(0, basement.index).trim() : "";
  if (basement && hasBuildingEvidence(basementPrefix, result)) {
    return recovered("confirmed_pnu_basement_room", {
      dong: result?.unit?.dong || null,
      floor: `B${Number(basement[1])}`,
      ho: basement[2]
    }, basement[0]);
  }

  // 명정아파트2동 707, 조흥아파트 106동 비01처럼 동은 명시됐지만 호 글자가 생략된 표기.
  const explicitDong = /제?\s*(\d{1,4}|[가나다라마바사아자차카타파하])\s*동\s*-?\s*제?\s*([A-Za-z]?\d{1,5}(?:-\d+)*|(?:비이|비|에이치|에이|씨|디|에프)\d+(?:-\d+)*)\s*(?:호)?$/i.exec(source);
  const explicitDongPrefix = explicitDong ? source.slice(0, explicitDong.index).trim() : "";
  if (explicitDong && hasBuildingEvidence(explicitDongPrefix, result)) {
    return recovered("confirmed_pnu_explicit_dong_bare_room", {
      dong: alphaDong(explicitDong[1]),
      ho: alphaRoom(explicitDong[2])
    }, explicitDong[0]);
  }

  // 남양반월타운101-3-305: 가운데 층과 완성형 호수의 앞자리가 맞을 때만 채택한다.
  const threePart = /제?\s*(\d{1,4})\s*-\s*(\d{1,2})\s*-\s*(\d{2,5})\s*(?:호)?$/i.exec(source);
  const threePartPrefix = threePart ? source.slice(0, threePart.index).trim() : "";
  if (threePart && hasBuildingEvidence(threePartPrefix, result) &&
      threePart[3].startsWith(String(Number(threePart[2])))) {
    return recovered("confirmed_pnu_dong_floor_room", {
      dong: String(Number(threePart[1])),
      floor: String(Number(threePart[2])),
      ho: String(Number(threePart[3]))
    }, threePart[0]);
  }
  // 3단 표기가 보이지만 층-호가 일치하지 않으면 마지막 두 숫자를 별도
  // 동·호로 재해석하지 않는다. 원문 충돌은 자동확정보다 실패가 안전하다.
  if (threePart) return null;

  // 아파트 101-1002, @201-605, A-4303, 제에이-201, 101/101.
  const pair = /제?\s*(에이치|에이|비이|비|씨|디|에프|[A-Za-z]|\d{1,4})\s*[-/]\s*제?\s*(\d{2,5}(?:-\d+)*)\s*(?:호)?$/i.exec(source);
  const pairPrefix = pair ? source.slice(0, pair.index).trim() : "";
  if (pair && hasBuildingEvidence(pairPrefix, result)) {
    return recovered("confirmed_pnu_trailing_dong_room", {
      dong: alphaDong(pair[1]),
      ho: String(pair[2]).replace(/^0+(?=\d)/, "")
    }, pair[0]);
  }
  return null;
}

export function needsConfirmedUnitRecovery(row, result = row?.result) {
  return Boolean(recoverConfirmedUnit(row?.raw || "", result));
}
