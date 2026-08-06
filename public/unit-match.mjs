import { extractExplicitLotRefs } from "./address-multilot-rules.mjs";

export const MATCHER_VERSION = "iros-matcher-v11";

export const IROS_MODULE_VERSIONS = Object.freeze({
  IROS_CANDIDATE_NORMALIZE: "2",
  R_IROS_MULTILOT: "2",
  R_IROS_BUILDING_EVIDENCE: "1",
  R_IROS_HO_BUILDING: "1",
  R_IROS_BUILDING_DISAMBIG: "1",
  R_IROS_RAW_UNIT: "2",
  R_IROS_UNIT_PROFILE: "2",
  R_IROS_UNIT_BEARING_BUILDING: "1",
  R_IROS_DONG_AGNOSTIC: "1",
  R_IROS_LOT_FALLBACK: "1",
  R_IROS_DONG_AGNOSTIC_HO: "1"
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

// `106동 1동 102호` — 숫자 동 두 개가 연속으로 붙고 그 뒤에 호가 오는 표기만
// 잡는다. `101동 상가 102호`처럼 사이에 다른 토큰이 끼면 중복 표기가 아니다.
const RE_DUPLICATE_DONG_HO =
  /(?:^|\s)제?\s*(\d{1,4})\s*동\s*제?\s*(\d{1,4})\s*동\s*제?\s*(\d{1,5}(?:-\d{1,4})?)\s*호(?=\s|$)/g;

function uniqueUnitVariants(variants) {
  // 동이 없는 건물(단일동 아파트·빌라)도 층 복구 대상이다. 호만 있으면 유효하다.
  return variants.filter((variant, index, source) =>
    variant.ho &&
    source.findIndex((other) =>
      other.dong === variant.dong && other.ho === variant.ho && other.source === variant.source
    ) === index
  );
}

// 원문에 명시된 구조만 보조 후보로 만든다. 기존 동·호 매칭이 단일 결과이면
// 이 후보는 사용하지 않으며, 실패 또는 복수결과일 때만 완전 후보 안에서 재매칭한다.
export function rawUnitRecoveryVariants(rawAddress, currentUnit = {}) {
  const raw = String(rawAddress || "");
  const currentDong = dongAliasKey(currentUnit?.dong);
  const currentHo = unitKey(currentUnit?.ho, "ho");
  const variants = [];

  // 501-101호처럼 왼쪽 숫자가 전처리에서 유실된 형식. 한 자리 왼쪽값은
  // 지하층·층표기와 충돌할 수 있어 여기서는 2자리 이상만 허용한다.
  if (!currentDong && currentHo) {
    const matches = [...raw.matchAll(/(?:^|\s)(\d{2,4})\s*-\s*(\d{2,5})\s*호(?=\s|$)/g)];
    const match = matches.at(-1);
    if (match && unitKey(match[2], "ho") === currentHo) {
      variants.push({
        dong: dongAliasKey(match[1]),
        ho: currentHo,
        source: "raw_dong_room"
      });
    }
  }

  // 101동 6층8호처럼 층이 전처리에서 사라진 형식. 등기부 호 표기는
  // 608, 6-8, 6층8 세 가지가 존재할 수 있으므로 모두 조회하되, 전체가
  // 동일한 고유번호 한 건으로 수렴할 때만 자동확정한다.
  //
  // 동이 없어도 같은 문제가 난다. "11층 3호"를 호 "3"으로만 읽으면 그 건물의
  // 모든 층 3호가 걸려 복수결과가 된다(진흥아파트 101동 3층1호 실측 136행).
  // 지하는 등기부가 "지1", "B1", "지하1" 중 하나로 적고 호도 "비01"·"B01"로
  // 적으므로 표기 변형을 함께 만든다.
  if (currentHo || currentDong) {
    const matches = [...raw.matchAll(
      /(?:^|\s)(지하|지|B|b)?\s*(\d{1,2})\s*층\s*(?:제?\s*)?(?:비|B|b)?\s*(\d{1,3})\s*호?(?=\s|$)/g
    )];
    const match = matches.at(-1);
    if (match && (!currentHo || unitKey(match[3], "ho") === currentHo)) {
      const basement = Boolean(match[1]);
      const floor = String(Number(match[2]));
      const room = String(Number(match[3]));
      const padded = room.padStart(2, "0");
      const floors = basement ? [`B${floor}`, `\uC9C0${floor}`, `\uC9C0\uD558${floor}`] : [floor];
      for (const f of floors) {
        for (const ho of [`${f}${padded}`, `${f}-${room}`, `${f}\uCE35${room}`]) {
          variants.push({
            dong: currentDong,
            ho: unitKey(ho, "ho"),
            source: basement ? "raw_basement_floor_room" : "raw_floor_room"
          });
        }
      }
    }
  }

  // 106동 1동 102호처럼 동 표기가 연달아 두 번 나오는 원문. 전처리는 호에 가장
  // 가까운 동만 채택하므로 앞쪽 동 표기가 통째로 유실된다. 어느 쪽이 진짜 동인지
  // 원문만으로는 결정할 수 없으므로 두 해석을 모두 후보로 만들고, 완전 후보에서
  // 하나의 고유번호로 수렴할 때만 자동확정한다(수렴 판정은 호출측 계약).
  if (currentHo) {
    const matches = [...raw.matchAll(RE_DUPLICATE_DONG_HO)];
    const match = matches.at(-1);
    if (match && unitKey(match[3], "ho") === currentHo) {
      for (const token of [match[1], match[2]]) {
        const dong = dongAliasKey(token);
        if (dong && dong !== currentDong) {
          variants.push({ dong, ho: currentHo, source: "raw_duplicate_dong" });
        }
      }
    }
  }

  // 지하1-비02호처럼 층·호가 하이픈으로 붙은 지하 표기.
  if (currentHo || currentDong) {
    const matched = raw.match(/(?:^|\s)(?:\uC9C0\uD558|\uC9C0|B|b)\s*(\d{1,2})\s*-\s*(?:\uBE44|B|b)\s*(\d{1,3})\s*\uD638?(?=\s|$)/);
    if (matched) {
      const floor = String(Number(matched[1]));
      const room = String(Number(matched[2]));
      const padded = room.padStart(2, "0");
      for (const f of [`B${floor}`, `\uC9C0${floor}`, `\uC9C0\uD558${floor}`]) {
        for (const ho of [`${f}${padded}`, `${f}-${room}`, `B${padded}`]) {
          variants.push({ dong: currentDong, ho: unitKey(ho, "ho"), source: "raw_basement_room" });
        }
      }
    }
  }

  return uniqueUnitVariants(variants);
}

export function rawUnitRecoverySignature(rawAddress, currentUnit = {}) {
  const variants = rawUnitRecoveryVariants(rawAddress, currentUnit);
  return variants.length
    ? variants.map((variant) => `${variant.source}:${variant.dong}:${variant.ho}`).join("|")
    : "none";
}

function candidateIdentity(candidate) {
  return String(candidate?.unique_no || "") || [
    candidate?.dong || "", candidate?.ho || "", candidate?.buldnm || "",
    candidate?.add_item || "", candidate?.sojae || ""
  ].join("|");
}

export function selectUniqueRawUnitCandidate(candidates, rawAddress, currentUnit = {}) {
  const variants = rawUnitRecoveryVariants(rawAddress, currentUnit);
  if (!variants.length) return null;
  // 변형은 표준 표기(608)가 앞이고 드문 표기(6-8, 6층8)가 뒤다. 전부 합쳐서
  // 유일성을 보면, 대단지에서 실제로 "3-1호"인 다른 세대가 있다는 이유만으로
  // 표준 표기의 정확한 한 건까지 버려진다(진흥아파트 450세대 실측 136행).
  // 등기부의 호 표기는 건물마다 하나로 통일돼 있으므로, 앞선 변형부터 차례로
  // 보고 그 변형 안에서 후보가 정확히 한 건일 때 채택한다.
  for (const variant of variants) {
    const unique = new Map();
    for (const candidate of candidates || []) {
      if (!candidateMatchesUnit(candidate, variant.dong, variant.ho)) continue;
      const key = candidateIdentity(candidate);
      if (key && !unique.has(key)) unique.set(key, candidate);
    }
    if (unique.size !== 1) continue;
    return {
      candidate: [...unique.values()][0],
      variant,
      variantsTried: variants,
      matchedCandidateCount: 1
    };
  }
  return null;
}

// R-IROS-DONG-AGNOSTIC-HO: 원문 동 표기가 등기부 동 체계와 아예 다른 건물이
// 있다(원문 `101동`, 등기부 `A동`·`가동`·공란). 요청한 동이 완전 후보 어디에도
// 존재하지 않고, 요청한 호를 가진 세대가 지번 전체에서 정확히 한 건일 때만
// 동을 무시하고 그 한 건을 채택한다.
//
// 요청 동이 후보에 실제로 존재하면 이 경로는 닫는다. 그 경우 "그 동에는 해당
// 호가 없다"는 것이 근거 있는 사실이므로, 다른 동의 같은 호로 대체하면 오확정이다.
export function selectDongAgnosticHoCandidate(candidates, wantedDong, wantedHo) {
  const dong = dongAliasKey(wantedDong);
  const ho = unitKey(wantedHo, "ho");
  if (!dong || !ho) return null;
  const source = Array.isArray(candidates) ? candidates : [];
  const dongExists = source.some((candidate) =>
    candidateUnitVariants(candidate).some((variant) => variant.dong === dong)
  );
  if (dongExists) return null;
  const matched = source.filter((candidate) => candidateMatchesUnit(candidate, "", ho));
  const unique = new Map();
  for (const candidate of matched) {
    const key = candidateIdentity(candidate);
    if (key && !unique.has(key)) unique.set(key, candidate);
  }
  if (unique.size !== 1) return null;
  return {
    candidate: [...unique.values()][0],
    requested_dong: dong,
    matched_ho: ho,
    matched_candidate_count: matched.length,
    candidate_dongs: [...new Set(
      source.flatMap((candidate) =>
        candidateUnitVariants(candidate).map((variant) => variant.dong).filter(Boolean))
    )].sort()
  };
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

// 원문에 명시된 모든 같은 법정동 대체지번을 만든다. 생략된 "외 N필지"는
// 생성하지 않으며, 정제 대표지번과 같은 지번도 제외한다.
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

// 하위호환: 기존 단일 대체지번 호출자는 첫 번째 명시 대체지번만 사용한다.
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

// IROS 실측상 전유부가 real_cls_cd="건물"로 오면서 호가 buld_no_inner에
// 명시되는 경우가 있다. 원본 구분을 집합건물로 바꾸지 않고, 완전수집된 동일
// 지번 안에서 전용 필드의 호가 입력 동·호와 정확히 맞는 후보만 보조 허용한다.
// 토지·구분미상·상세문구 추출값은 이 경로에서 절대 허용하지 않는다.
export function filterUnitPropertyCandidates(
  candidates,
  wantedDong = "",
  wantedHo = "",
  recoveryUnits = []
) {
  const source = Array.isArray(candidates) ? candidates : [];
  const strict = filterExpectedPropertyClass(source, "집합건물");
  const ho = unitKey(wantedHo, "ho");
  const explicitUnits = [
    ...(ho ? [{ dong: wantedDong, ho: wantedHo }] : []),
    ...(Array.isArray(recoveryUnits) ? recoveryUnits : [])
  ].filter((unit) => unitKey(unit?.ho, "ho"));
  if (!explicitUnits.length) {
    return { ...strict, evidence: strict.verified ? "REGISTRY_CLASS" : "" };
  }
  const explicitSources = new Set(["buld_no_room", "buld_no_inner"]);
  const explicit = source.filter((candidate) =>
    propertyClassKey(candidate) === "건물" &&
    explicitSources.has(String(candidate?.unit_source?.ho || "")) &&
    explicitUnits.some((unit) => candidateMatchesUnit(candidate, unit.dong, unit.ho))
  );
  const seen = new Set();
  const matched = [...strict.candidates, ...explicit].filter((candidate) => {
    const key = String(candidate?.unique_no || JSON.stringify(candidate));
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return {
    candidates: matched,
    verified: matched.length > 0,
    evidence: explicit.length ? "EXPLICIT_UNIT_BUILDING" :
      (strict.verified ? "REGISTRY_CLASS" : "")
  };
}

export function targetPropertyClass(result) {
  if (result?.isJip || unitKey(result?.unit?.ho, "ho")) return "집합건물";
  return "";
}

export function summarizeCandidatePropertyClasses(candidates) {
  const found = new Set(
    (Array.isArray(candidates) ? candidates : [])
      .map(propertyClassKey)
      .filter(Boolean)
  );
  return ["집합건물", "건물", "토지"].filter((value) => found.has(value)).join("|");
}
