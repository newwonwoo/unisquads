import { extractExplicitLotRefs } from "./address-multilot-rules.mjs";

export const MATCHER_VERSION = "iros-matcher-v8";

export const IROS_MODULE_VERSIONS = Object.freeze({
  IROS_CANDIDATE_NORMALIZE: "2",
  R_IROS_MULTILOT: "2",
  R_IROS_BUILDING_EVIDENCE: "1",
  R_IROS_HO_BUILDING: "1",
  R_IROS_BUILDING_DISAMBIG: "1",
  R_IROS_RAW_UNIT: "1",
  R_IROS_UNIT_PROFILE: "2"
});

const DONG_ALIASES = Object.freeze({
  A: "A", "에이": "A",
  B: "B", "비": "B"
});

export function unitKey(value, kind = "unit") {
  let v = String(value || "")
    .trim()
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, "")
    .replace(/^제/, "")
    .replace(/(동|호)$/, "");
  if (!v) return "";
  if (kind === "dong" && /^0+$/.test(v)) return "";
  if (kind === "dong" && /^[A-Za-z]$/.test(v)) return v.toUpperCase();
  if (kind === "dong" && /^[가-힣]$/.test(v)) return v;
  if (/^\d+$/.test(v)) return String(Number(v));
  if (kind === "ho" && /^\d+(?:-\d+)+$/.test(v)) {
    return v.split("-").map((x) => String(Number(x))).join("-");
  }
  if (kind === "ho" && /^[A-Za-z]\d+(?:-\d+)?$/.test(v)) return v.toUpperCase();
  return v.toUpperCase();
}

export function dongAliasKey(value) {
  const key = unitKey(value, "dong");
  return DONG_ALIASES[key] || key;
}

export function candidateUnitVariants(candidate) {
  const rawDong = String(candidate?.dong || "").trim();
  const rawHo = String(candidate?.ho || "").trim();
  const base = {
    dong: dongAliasKey(rawDong),
    ho: unitKey(rawHo, "ho"),
    source: "direct"
  };
  const variants = [base];

  // IROS 실측: 동="에이,비,상가", 호="비-101"처럼 실제 동이 호의
  // 접두어로 들어가는 등기부가 있다. 접두어가 복합 동 목록에 실제 존재할
  // 때만 분해하여 일반적인 204-1호의 하이픈 의미를 훼손하지 않는다.
  const room = rawHo.match(/^([A-Za-z가-힣]+)-(\d+(?:-\d+)*)$/);
  const dongTokens = rawDong
    .split(/[,/·]+/)
    .map((token) => dongAliasKey(token))
    .filter(Boolean);
  if (room) {
    const prefixedDong = dongAliasKey(room[1]);
    if (prefixedDong && dongTokens.includes(prefixedDong)) {
      variants.unshift({
        dong: prefixedDong,
        ho: unitKey(room[2], "ho"),
        source: "composite_dong_room_prefix"
      });
    }
  }
  return variants.filter((variant, index, source) =>
    source.findIndex((other) => other.dong === variant.dong && other.ho === variant.ho) === index
  );
}

export function candidateMatchesUnit(candidate, dong, ho) {
  return Boolean(matchedCandidateUnitVariant(candidate, dong, ho));
}

export function matchedCandidateUnitVariant(candidate, dong, ho) {
  const wantDong = dongAliasKey(dong);
  const wantHo = unitKey(ho, "ho");
  return candidateUnitVariants(candidate).find((variant) =>
    (!wantDong || variant.dong === wantDong) &&
    (!wantHo || variant.ho === wantHo)
  ) || null;
}

export function candidateHasNoDong(candidate) {
  return candidateUnitVariants(candidate).every((variant) => !variant.dong);
}

export function buildingKey(value) {
  return String(value || "").replace(/[^0-9A-Za-z가-힣]/g, "").toLowerCase();
}

export function buildingNamesMatch(left, right) {
  const a = buildingKey(left);
  const b = buildingKey(right);
  return Boolean(a && b && (a.includes(b) || b.includes(a)));
}

export function buildingEvidenceKind(candidateName, normalizedName, rawInput) {
  if (buildingNamesMatch(normalizedName, candidateName)) return "normalized_name";
  const candidate = buildingKey(candidateName);
  const raw = buildingKey(rawInput);
  if (candidate.length >= 4 && raw.includes(candidate)) return "raw_exact_name";
  return "";
}

function extractLegalLot(value) {
  const text = String(value || "");
  const match = /([0-9A-Za-z가-힣]+(?:동\d*가|동|가|리))\s*(산\s*)?(\d+(?:-\d+)?)/.exec(text);
  if (!match) return null;
  const full = match[0];
  const lotOffset = full.lastIndexOf(match[3]);
  return {
    legal: match[1],
    mountain: Boolean(match[2]),
    lot: match[3],
    lotStart: match.index + lotOffset,
    lotEnd: match.index + lotOffset + match[3].length
  };
}

export function alternateRawLotAddresses(rawAddress, normalizedAddress) {
  const normalized = extractLegalLot(normalizedAddress);
  if (!normalized) return [];
  const refs = extractExplicitLotRefs(rawAddress);
  const base = String(normalizedAddress || "");
  const out = [];
  for (const ref of refs) {
    const mountain = String(ref?.lot || "").startsWith("산");
    const lot = String(ref?.lot || "").replace(/^산\s*/, "");
    if (ref?.legal !== normalized.legal || mountain !== normalized.mountain) continue;
    if (!lot || lot === normalized.lot) continue;
    const address = `${base.slice(0, normalized.lotStart)}${lot}${base.slice(normalized.lotEnd)}`.trim();
    if (address && !out.includes(address)) out.push(address);
  }
  return out;
}

export function alternateRawLotAddress(rawAddress, normalizedAddress) {
  return alternateRawLotAddresses(rawAddress, normalizedAddress)[0] || "";
}

export function candidateMatchesAddressLot(candidate, address) {
  const wanted = extractLegalLot(address);
  if (!wanted) return true;
  for (const value of [candidate?.add_item, candidate?.sojae]) {
    const got = extractLegalLot(value);
    if (!got) continue;
    return got.legal === wanted.legal &&
      got.mountain === wanted.mountain && got.lot === wanted.lot;
  }
  const lot = String(candidate?.lot_no || "").trim();
  return !lot || lot === wanted.lot;
}

export function propertyClassKey(candidate) {
  const raw = String(candidate?.real_cls_cd || candidate?.gubun || "").trim();
  if (raw.includes("집합")) return "집합건물";
  if (raw.includes("토지")) return "토지";
  if (raw.includes("건물")) return "건물";
  return "";
}

export function filterExpectedPropertyClass(candidates, expected) {
  const source = Array.isArray(candidates) ? candidates : [];
  if (!expected) return { candidates: [...source], verified: true };
  const matched = source.filter((candidate) => propertyClassKey(candidate) === expected);
  return { candidates: matched, verified: matched.length > 0 };
}
