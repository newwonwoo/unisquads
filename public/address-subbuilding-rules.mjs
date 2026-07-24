// Explicit building-part evidence from the source address.
// This module never guesses a building part from a generic building name.

export const SUB_BUILDING_VERSION = "address-subbuilding-v2";

const COMMERCIAL = /(?:^|\s)(?:제?상가(?:동)?|근린생활시설|근생|판매시설)(?=\s|$)/;
const MANAGEMENT = /(?:^|\s)(?:관리동|관리사무소|관리실)(?=\s|$)/;
const BUILDING_CONTEXT = /(아파트|맨션|타운|오피스텔|빌라|연립|다세대|주상복합|주공|캐슬|자이|푸르지오|아이파크|래미안|힐스|더샵|빌딩|프라자|플라자|상가동|근린생활시설)/i;
const BUILDING_RANGE = /(?:아파트|맨션|타운|오피스텔|빌라|연립|다세대|주상복합|주공)\s+(\d{3,4})\s*[-~∼〜～]\s*(\d{3,4})(?=\s|$)/i;

export function extractSubBuildingIntent(value) {
  const raw = String(value || "").replace(/\s+/g, " ").trim();
  const commercial = raw.match(COMMERCIAL);
  if (commercial) {
    const before = raw.slice(0, commercial.index ?? 0);
    if (BUILDING_CONTEXT.test(before)) {
      return { kind: "COMMERCIAL", token: commercial[0].trim() || "상가" };
    }
  }
  const management = raw.match(MANAGEMENT);
  if (management) {
    const before = raw.slice(0, management.index ?? 0);
    if (BUILDING_CONTEXT.test(before)) {
      return { kind: "MANAGEMENT", token: management[0].trim() || "관리동" };
    }
  }
  return null;
}

// 상가 뒤에 명시된 층·호를 하나의 구조 의도로 보존한다.
// 지상층은 1층6호 => floor=1, room=6이며 106호로 합치지 않는다.
export function extractCommercialFloorRoomIntent(value) {
  const raw = String(value || "").replace(/\s+/g, " ").trim();
  const commercial = raw.match(COMMERCIAL);
  if (!commercial) return null;
  const tail = raw.slice((commercial.index ?? 0) + commercial[0].length);

  const basement = tail.match(/(?:^|\s)(?:제?\s*)?(?:지하\s*(\d{1,2})|B\s*(\d{1,2}))\s*층\s*제?\s*(\d{1,4})\s*호(?=\s|$)/i);
  if (basement) {
    return {
      floor: `B${Number(basement[1] || basement[2])}`,
      room: String(Number(basement[3])),
      evidence: "RAW_COMMERCIAL_BASEMENT_ROOM"
    };
  }

  const above = tail.match(/(?:^|\s)(?:제?\s*)?(\d{1,2})\s*층\s*제?\s*(\d{1,4})\s*호(?=\s|$)/);
  if (!above) return null;
  return {
    floor: String(Number(above[1])),
    room: String(Number(above[2])),
    evidence: "RAW_COMMERCIAL_FLOOR_ROOM"
  };
}

// 아파트명 뒤의 101-107처럼 여러 동의 범위를 적고, 뒤에 상가 층·호를 별도로
// 명시한 형식만 다룬다. 일반적인 103-803 동·호 표기는 건드리지 않는다.
export function extractBuildingRangeIntent(value) {
  const raw = String(value || "").replace(/\s+/g, " ").trim();
  const match = raw.match(BUILDING_RANGE);
  if (!match) return null;
  const tail = raw.slice((match.index ?? 0) + match[0].length);
  if (!COMMERCIAL.test(tail)) return null;
  const commercialUnit = extractCommercialFloorRoomIntent(raw);
  if (!commercialUnit) return null;

  const start = Number(match[1]);
  const end = Number(match[2]);
  if (!Number.isInteger(start) || !Number.isInteger(end) || start >= end) return null;
  // 동 범위는 같은 백 단위 안에서 연속되는 표기를 대상으로 한다.
  // 지번·동호 오염을 넓게 흡수하지 않도록 최대 30개 동까지만 허용한다.
  if (Math.floor(start / 100) !== Math.floor(end / 100) || end - start > 30) return null;

  return {
    kind: "DONG_RANGE",
    start: String(start),
    end: String(end),
    count: end - start + 1,
    token: `${match[1]}-${match[2]}`,
    commercialUnit,
    evidence: "RAW_BUILDING_RANGE_BEFORE_COMMERCIAL_UNIT"
  };
}

function searchableCandidateText(candidate) {
  return [
    candidate?.detBdNmList,
    candidate?.bdNm,
    candidate?.buldnm,
    candidate?.dong,
    candidate?.roadAddr,
    candidate?.jibunAddr,
    candidate?.sojae,
    candidate?.add_item
  ].filter(Boolean).join(" ").replace(/\s+/g, " ");
}

export function candidateSupportsSubBuilding(candidate, intent) {
  if (!intent?.kind) return false;
  const text = searchableCandidateText(candidate);
  if (!text) return false;
  if (intent.kind === "COMMERCIAL") {
    return /상가(?:동)?|근린생활시설|근생|판매시설/.test(text);
  }
  if (intent.kind === "MANAGEMENT") {
    return /관리동|관리사무소|관리실/.test(text);
  }
  return false;
}

export function narrowByExplicitSubBuilding(candidates, intent) {
  const source = Array.isArray(candidates) ? candidates : [];
  if (!intent?.kind || !source.length) {
    return { candidates: source, applied: false, evidence: "" };
  }
  const hits = source.filter((candidate) => candidateSupportsSubBuilding(candidate, intent));
  if (!hits.length) {
    return { candidates: source, applied: false, evidence: "" };
  }
  return {
    candidates: hits,
    applied: true,
    evidence: `EXPLICIT_SUB_BUILDING:${intent.kind}`
  };
}

export function floorIntentFromText(value) {
  const raw = String(value || "");
  const basement = raw.match(/(?:지하\s*(\d{1,2})|B\s*(\d{1,2}))\s*층/i);
  if (basement) return `B${Number(basement[1] || basement[2])}`;
  if (/반지하/.test(raw)) return "B";
  const above = raw.match(/(?:^|\s)(\d{1,2})\s*층/);
  return above ? String(Number(above[1])) : "";
}
