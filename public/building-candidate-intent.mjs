import { buildingKey, dongAliasKey } from "./unit-match.mjs";
import { candidateSupportsSubBuilding } from "./address-subbuilding-rules.mjs";

export const BUILDING_CANDIDATE_INTENT_VERSION = "building-candidate-intent-v1";

function candidateParcelKey(candidate) {
  const adm = String(candidate?.admCd || "");
  const main = String(candidate?.mnnm ?? "").replace(/^0+(?=\d)/, "");
  if (!adm || !main) return "";
  const sub = Number(candidate?.slno || 0) > 0 ? String(Number(candidate.slno)) : "0";
  return `${adm}|${String(candidate?.mtYn || "0")}|${main}|${sub}`;
}

function detailedBuildingTokens(candidate) {
  return String(candidate?.detBdNmList || "")
    .split(/[,/·;|]+/)
    .map((token) => token.trim())
    .filter(Boolean);
}

function normalizedDongToken(value) {
  return dongAliasKey(String(value || "").replace(/동$/, ""));
}

export function candidateSupportsExplicitDong(candidate, dong) {
  const wanted = normalizedDongToken(dong);
  if (!wanted) return false;
  return detailedBuildingTokens(candidate).some((token) => {
    const stripped = token.replace(/^제/, "").replace(/동$/, "").trim();
    return normalizedDongToken(stripped) === wanted;
  });
}

function sameNamedParcel(candidates, expectedBuildingName = "") {
  if (!candidates.length) return false;
  const parcels = new Set(candidates.map(candidateParcelKey).filter(Boolean));
  if (parcels.size !== 1) return false;
  const expected = buildingKey(expectedBuildingName);
  const names = new Set(candidates.map((candidate) => buildingKey(candidate?.bdNm)).filter(Boolean));
  if (expected) return [...names].every((name) => name === expected || name.includes(expected) || expected.includes(name));
  return names.size <= 1;
}

function uniqueCommercialByBuildingKind(candidates, expectedBuildingName) {
  if (!sameNamedParcel(candidates, expectedBuildingName)) return [];
  const general = candidates.filter((candidate) => String(candidate?.bdKdcd || "") === "0");
  const residential = candidates.filter((candidate) => String(candidate?.bdKdcd || "") === "1");
  return general.length === 1 && residential.length >= 1 ? general : [];
}

export function narrowCandidatesByBuildingIntent(candidates, intent = {}) {
  const source = Array.isArray(candidates) ? candidates : [];
  let current = [...source];
  const evidence = [];
  const diagnostics = {
    version: BUILDING_CANDIDATE_INTENT_VERSION,
    input_count: source.length,
    explicit_dong: normalizedDongToken(intent?.dong),
    sub_building: intent?.subBuilding?.kind || "",
    building_name: intent?.buildingName || "",
    dong_hits: 0,
    sub_building_hits: 0,
    building_kind_hits: 0
  };

  if (intent?.subBuilding?.kind && current.length > 1) {
    let hits = current.filter((candidate) => candidateSupportsSubBuilding(candidate, intent.subBuilding));
    diagnostics.sub_building_hits = hits.length;
    if (!hits.length && intent.subBuilding.kind === "COMMERCIAL") {
      hits = uniqueCommercialByBuildingKind(current, intent.buildingName);
      diagnostics.building_kind_hits = hits.length;
      if (hits.length) evidence.push("EXPLICIT_COMMERCIAL_BDKDCD_UNIQUE");
    }
    if (hits.length) {
      current = hits;
      evidence.push(`EXPLICIT_SUB_BUILDING:${intent.subBuilding.kind}`);
    }
  }

  if (intent?.dong && current.length > 1) {
    const hits = current.filter((candidate) => candidateSupportsExplicitDong(candidate, intent.dong));
    diagnostics.dong_hits = hits.length;
    if (hits.length) {
      current = hits;
      evidence.push("EXPLICIT_DONG_IN_DETAIL_LIST");
    }
  }

  diagnostics.output_count = current.length;
  return {
    candidates: current,
    applied: current.length < source.length,
    evidence: [...new Set(evidence)],
    diagnostics
  };
}
