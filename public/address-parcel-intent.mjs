export const PARCEL_INTENT_VERSION = "address-parcel-intent-v1";

function normalizeLot(value) {
  const raw = String(value || "").replace(/\s+/g, "");
  const mountain = raw.startsWith("산");
  const body = raw.replace(/^산/, "");
  const match = body.match(/^(\d+)(?:-(\d+))?$/);
  if (!match) return "";
  const main = String(Number(match[1]));
  const sub = match[2] && Number(match[2]) > 0 ? String(Number(match[2])) : "";
  return `${mountain ? "산" : ""}${main}${sub ? `-${sub}` : ""}`;
}

function candidateLot(candidate) {
  const main = String(candidate?.mnnm ?? "").replace(/\D/g, "");
  if (!main) return "";
  const sub = String(candidate?.slno ?? "").replace(/\D/g, "");
  return `${String(candidate?.mtYn || "0") === "1" ? "산" : ""}${Number(main)}${Number(sub) > 0 ? `-${Number(sub)}` : ""}`;
}

function parcelKey(candidate) {
  const adm = String(candidate?.admCd || "");
  const lot = candidateLot(candidate);
  return adm && lot ? `${adm}|${lot}` : "";
}

function legalTokens(value) {
  const source = String(value || "");
  return [...source.matchAll(/([가-힣]{1,10}(?:동\d*가|동|리|가))(?=\s|\d|$)/g)]
    .map((match) => match[1])
    .filter((token) => !/^(?:상가동|제상가동)$/.test(token));
}

function legalStem(value) {
  return String(value || "").replace(/(?:동\d*가|동|리|가)$/, "");
}

function candidateLegal(candidate) {
  const address = String(candidate?.jibunAddr || candidate?.roadAddr || "");
  const lot = candidateLot(candidate);
  const matches = [...address.matchAll(/([가-힣]{1,10}(?:동\d*가|동|리|가))\s*(산?\d+(?:-\d+)?)/g)];
  const exact = matches.find((match) => normalizeLot(match[2]) === lot);
  return (exact || matches.at(-1))?.[1] || "";
}

function legalCompatible(refLegal, resultLegal, sourceTokens) {
  if (!refLegal || !resultLegal) return false;
  if (refLegal === resultLegal) return true;
  // 옛 리와 현재 동이 원문에 함께 적힌 경우처럼, 동일 어간의 두 법정동 표기가
  // 원문 자체에 모두 존재할 때만 교차표기를 허용한다. 한쪽 표기만 있는 주소를
  // 일반적인 리↔동 규칙으로 확대하지 않는다.
  return legalStem(refLegal) === legalStem(resultLegal) &&
    sourceTokens.includes(refLegal) && sourceTokens.includes(resultLegal);
}

export function narrowCandidatesByExplicitParcel(candidates, intent = {}) {
  const source = Array.isArray(candidates) ? candidates : [];
  const refs = Array.isArray(intent?.lotRefs) ? intent.lotRefs : [];
  const sourceTokens = [...new Set(legalTokens(intent?.raw))];
  const diagnostics = {
    version: PARCEL_INTENT_VERSION,
    input_count: source.length,
    refs: refs.map((ref) => `${ref?.legal || ""}|${normalizeLot(ref?.lot)}`).filter(Boolean),
    source_legal_tokens: sourceTokens,
    matched_candidate_count: 0,
    matched_parcel_count: 0,
    output_count: source.length
  };
  if (!source.length || !refs.length) {
    return { candidates: source, applied: false, evidence: [], diagnostics };
  }

  const matched = source.filter((candidate) => {
    const lot = candidateLot(candidate);
    const legal = candidateLegal(candidate);
    if (!lot || !legal) return false;
    return refs.some((ref) =>
      normalizeLot(ref?.lot) === lot && legalCompatible(ref?.legal, legal, sourceTokens)
    );
  });
  diagnostics.matched_candidate_count = matched.length;
  const keys = [...new Set(matched.map(parcelKey).filter(Boolean))];
  diagnostics.matched_parcel_count = keys.length;
  if (keys.length !== 1) {
    return { candidates: source, applied: false, evidence: [], diagnostics };
  }

  const selectedKey = keys[0];
  const narrowed = source.filter((candidate) => parcelKey(candidate) === selectedKey);
  if (!narrowed.length || narrowed.length >= source.length) {
    return { candidates: source, applied: false, evidence: [], diagnostics };
  }
  diagnostics.output_count = narrowed.length;
  return {
    candidates: narrowed,
    applied: true,
    evidence: ["EXPLICIT_PARCEL_UNIQUE"],
    diagnostics
  };
}
