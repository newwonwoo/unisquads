// Explicit building-part evidence from the source address.
// This module never guesses a building part from a generic building name.

export const SUB_BUILDING_VERSION = "address-subbuilding-v1";

const COMMERCIAL = /(?:^|\s)(?:제?상가(?:동)?|근린생활시설|근생|판매시설)(?=\s|$)/;
const MANAGEMENT = /(?:^|\s)(?:관리동|관리사무소|관리실)(?=\s|$)/;
const BUILDING_CONTEXT = /(아파트|맨션|타운|오피스텔|빌라|연립|다세대|주상복합|주공|캐슬|자이|푸르지오|아이파크|래미안|힐스|더샵|빌딩|프라자|플라자|상가동|근린생활시설)/i;

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
