// Explicit building-part evidence from the source address.
// This module never guesses a building part from a generic building name.

export const SUB_BUILDING_VERSION = "address-subbuilding-v1";

const COMMERCIAL = /(?:^|\s)(?:제?상가(?:동)?|근린생활시설|근생|판매시설)(?=\s|$)/;
const MANAGEMENT = /(?:^|\s)(?:관리동|관리사무소|관리실)(?=\s|$)/;

export function extractSubBuildingIntent(value) {
  const raw = String(value || "").replace(/\s+/g, " ").trim();
  if (COMMERCIAL.test(raw)) {
    return { kind: "COMMERCIAL", token: (raw.match(COMMERCIAL) || [""])[0].trim() || "상가" };
  }
  if (MANAGEMENT.test(raw)) {
    return { kind: "MANAGEMENT", token: (raw.match(MANAGEMENT) || [""])[0].trim() || "관리동" };
  }
  return null;
}

function searchableCandidateText(candidate) {
  return [
    candidate?.detBdNmList,
    candidate?.bdNm,
    candidate?.roadAddr,
    candidate?.jibunAddr
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
