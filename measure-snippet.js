// addr-refine 개선 기대효과 측정 — 브라우저 콘솔 전용
//
// 자동 생성 파일이다. 직접 고치지 말고 아래를 실행한다.
//   node scripts/build-measure-snippet.mjs
//
// 사용법: 앱을 연 탭에서 F12 → Console → 이 파일 전체를 붙여넣고 Enter.
// 조회도 저장도 하지 않는다. 이미 저장된 결과만 읽어서 건수를 센다.

(() => {
// ── public/address-multilot-rules.mjs ──
const RANGE_RE = /\d+\s*[~∼〜～]\s*\d+/g;
const OMITTED_EXTRA_RE = /외\s*\d+\s*필지/;
const GENERIC_BUILDING = /^(?:주공|현대|삼성|대우|롯데|한신|경남|우성|쌍용|금호|신동아|시영)?(?:아파트|맨션|빌라|연립|타운|오피스텔)$/;
const NON_LEGAL_BUILDING_LEAF = /(상가|아파트|맨션|빌라|빌리지|타운|오피스텔|프라자|플라자|빌딩|센터)$/i;

function uniqueBy(items, keyOf) {
  const seen = new Set();
  return items.filter((item) => {
    const key = keyOf(item);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildingKey(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/<[^>]+>/g, "")
    .replace(/(?:제?상가동|상가)$/g, "")
    .replace(/[^0-9a-z가-힣]/g, "");
}

function normalizeDong(value) {
  const raw = String(value || "")
    .trim()
    .replace(/^제/, "")
    .replace(/동$/, "")
    .replace(/\s+/g, "");
  const aliases = { 에이: "A", 비: "B", 비이: "B", 씨: "C", 디: "D" };
  return aliases[raw] || (/^[A-Za-z]$/.test(raw) ? raw.toUpperCase() : raw.replace(/^0+/, ""));
}

function hasOmittedExtraLots(value) {
  return OMITTED_EXTRA_RE.test(String(value || ""));
}

// 원문에 실제로 적힌 지번만 추출한다. "외 7필지"의 생략된 지번은 만들지 않는다.
// 12-1,2,5는 12-1·12-2·12-5로 확장하고, 101동·501호 숫자는 제외한다.
function extractExplicitLotRefs(value) {
  const source = String(value || "").replace(RANGE_RE, " ");
  const number = String.raw`산?\s*\d+(?:-\d+)?(?![\d-])(?!(?:\s*)[동호층])`;
  const pattern = new RegExp(
    String.raw`([가-힣]{1,10}(?:동\d*가|동|리|가))\s*((${number})(?:(?:\s*[,，]\s*|\s+)(${number}))*)`,
    "g"
  );
  const refs = [];
  let match;
  while ((match = pattern.exec(source))) {
    const legal = match[1];
    // `창대장터상가 1-110`의 상가를 법정동 `...가`로 오인하지 않는다.
    // 건물명 뒤 숫자는 세대 표기일 수 있으므로 법정동+지번 증거로 쓰면 안 된다.
    if (["상가동", "제상가동"].includes(legal) || NON_LEGAL_BUILDING_LEAF.test(legal)) continue;
    const sequence = match[2];
    const commaSeparated = /[,，]/.test(sequence);
    const tokens = sequence.match(new RegExp(number, "g")) || [];
    if (!tokens.length) continue;
    const first = tokens[0].replace(/\s+/g, "");
    const mountain = first.startsWith("산");
    const firstMain = first.replace(/^산/, "").split("-")[0];
    for (let i = 0; i < tokens.length; i++) {
      let lot = tokens[i].replace(/\s+/g, "");
      if (i > 0 && commaSeparated && !lot.includes("-") && first.includes("-") && lot.length <= 3) {
        lot = `${mountain ? "산" : ""}${firstMain}-${lot}`;
      }
      // 쉼표 없이 정확 지번 뒤에 붙은 101-1002류는 두 번째 필지가 아니라
      // 동·호 표기일 가능성이 높다. 부번 3자리 이상인 후행 N-M만 제외하고,
      // `869-1 869-4` 같은 실제 복수지번은 그대로 보존한다.
      if (i > 0 && !commaSeparated && isUnitLikeLot(lot)) continue;
      refs.push({ legal, lot });
    }
  }
  return uniqueBy(refs, (ref) => `${ref.legal}|${ref.lot}`);
}

function isUnitLikeLot(value) {
  const match = String(value || "").replace(/^산/, "").match(/^(\d{1,4})-(\d{3,5})$/);
  return match ? { dong: match[1], ho: match[2] } : null;
}

function isLandMultiProbeEligible({ raw, refs, unit, buildingName }) {
  if (!Array.isArray(refs) || refs.length < 2) return false;
  if (hasOmittedExtraLots(raw)) return false;
  if (unit?.dong || unit?.ho || buildingName) return false;
  return refs.every(({ lot }) => {
    const parts = String(lot || "").replace(/^산/, "").split("-");
    return /^\d{1,4}$/.test(parts[0]) &&
      (parts.length === 1 || /^\d{1,2}$/.test(parts[1]));
  });
}

function candidateSupportsDong(candidate, wantedDong) {
  const wanted = normalizeDong(wantedDong);
  if (!wanted) return true;
  const detail = String(candidate?.detBdNmList || candidate?.detbdnm || "");
  if (!detail) return false;
  return detail
    .split(/[,/·\s]+/)
    .map(normalizeDong)
    .filter(Boolean)
    .includes(wanted);
}

function aggregateCandidateKey(candidate) {
  const management = String(candidate?.bdMgtSn || "").trim();
  if (management) return `M:${management}`;
  const road = String(candidate?.roadAddr || "").replace(/\s+/g, "").trim();
  const building = buildingKey(candidate?.bdNm);
  if (road && building) return `R:${road}|${building}`;
  return "";
}

// 여러 지번을 조회했어도 같은 건물관리번호/도로명·건물명으로 모이면 한 건물이다.
// 동 정보가 있으면 detBdNmList가 실제로 그 동을 포함하는 군을 우선한다.
function selectAggregateBuildingCandidates(candidates, unit = {}) {
  const source = uniqueBy(
    (Array.isArray(candidates) ? candidates : []).filter((candidate) =>
      candidate?.isJip || candidate?.bdMgtSn || candidate?.bdNm
    ),
    (candidate) => `${aggregateCandidateKey(candidate)}|${candidate?.admCd || ""}|${candidate?.mnnm || ""}|${candidate?.slno || ""}`
  );
  if (!source.length) return [];
  const groups = new Map();
  for (const candidate of source) {
    const key = aggregateCandidateKey(candidate);
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(candidate);
  }
  if (!groups.size) return [];
  let entries = [...groups.entries()];
  if (unit?.dong) {
    const dongMatched = entries.filter(([, group]) =>
      group.some((candidate) => candidateSupportsDong(candidate, unit.dong))
    );
    if (dongMatched.length === 1) entries = dongMatched;
    else if (dongMatched.length > 1) return [];
  }
  if (entries.length !== 1) return [];
  const [, selected] = entries[0];
  selected.sort((a, b) => Number(Boolean(b.isJip)) - Number(Boolean(a.isJip)));
  return selected;
}

function ownerSearchKeyword(value) {
  let text = String(value || "")
    .replace(/주식회사|㈜|\(주\)|（주）/g, "")
    .replace(/[^0-9A-Za-z가-힣]/g, "")
    .replace(/(?:종합)?(?:건설산업|건설|주택|개발|산업|토건)$/g, "")
    .trim();
  if (/^(대한|한국|국제|성우|대원)$/.test(text)) return "";
  return text.length >= 2 ? text : "";
}

function canonSidoToken(value) {
  const text = String(value || "");
  const pairs = [
    ["서울", /서울/], ["부산", /부산/], ["대구", /대구/], ["인천", /인천/],
    ["광주", /광주/], ["대전", /대전/], ["울산", /울산/], ["세종", /세종/],
    ["경기", /경기/], ["강원", /강원/], ["충북", /충청북|충북/], ["충남", /충청남|충남/],
    ["전북", /전북|전라북/], ["전남", /전남|전라남/], ["경북", /경북|경상북/],
    ["경남", /경남|경상남/], ["제주", /제주/]
  ];
  return pairs.find(([, pattern]) => pattern.test(text))?.[0] || "";
}

function addressMatchesZipRegions(address, zipRegions) {
  const result = String(address || "");
  const resultSido = canonSidoToken(result);
  if (!resultSido || !Array.isArray(zipRegions)) return false;
  return zipRegions.some((entry) => {
    const [zipSidoRaw, zipSggRaw] = String(entry || "").split("|");
    const zipSido = canonSidoToken(zipSidoRaw);
    if (!zipSido || zipSido !== resultSido) return false;
    const zipSgg = String(zipSggRaw || "").replace(/\s+/g, "");
    if (!zipSgg || canonSidoToken(zipSgg) === resultSido) return true;
    const compactResult = result.replace(/\s+/g, "");
    return compactResult.includes(zipSgg);
  });
}

function canAcceptZipBuildingCorrection({
  validation,
  naverPnuOk,
  addressMatchEvidence,
  inputBuildingName,
  resultBuildingName,
  resultAddress,
  zipRegions
}) {
  if (validation?.status !== "MISMATCH") return false;
  if (!/^(시도|시군구) 불일치/.test(String(validation?.reason || ""))) return false;
  if (!naverPnuOk) return false;
  if (!(addressMatchEvidence || []).includes("EXACT_ROAD")) return false;
  const input = buildingKey(inputBuildingName);
  const result = buildingKey(resultBuildingName);
  if (!input || !result || GENERIC_BUILDING.test(input) || GENERIC_BUILDING.test(result)) return false;
  if (!(input === result || (Math.min(input.length, result.length) >= 4 && (input.includes(result) || result.includes(input))))) return false;
  return addressMatchesZipRegions(resultAddress, zipRegions);
}

// 결과 지번주소에서 지번 하나를 뽑는다. "… 서부리 277-5 태광아파트" → "277-5"
// 산번지는 "산 12-3"처럼 띄어 오므로 붙여서 돌려준다(원문 대조도 공백을 지우고 한다).
const RESULT_LOT = /(?:동|리|가)\s+(산\s?)?(\d{1,5}(?:-\d{1,4})?)(?=\s|$)/;

function resultLotOf(address) {
  const matched = String(address || "").match(RESULT_LOT);
  return matched ? (matched[1] ? "산" : "") + matched[2] : "";
}

// 법정동만 다르고 지번과 건물명이 모두 원문과 같으면, 틀린 쪽은 원문의 법정동이다.
// 지번은 법정동 안에서 부여되므로 "수진리 277-5"와 "서부리 277-5"는 다른 땅이고,
// 그 위에 같은 이름의 건물이 둘 다 있을 일은 없다. 결과는 원천이 실제로 찾아준
// 실존 주소이므로, 원문 세 요소(법정동·지번·건물명) 중 둘이 맞으면 나머지 하나가
// 오기다.
//   충북 괴산군 괴산읍 수진리 277-5 태광아파트  →  괴산읍 서부리 277-5 태광아파트
//   경남 고성군 거류면 화당리 174 새평지아파트  →  거류면 당동리 174 새평지아파트
//   울산 남구 부곡동 679-8 선암시장형 상가      →  남구 선암동 679-8 선암시장형종합상가
// 시도·시군구 불일치는 대상이 아니다(그건 진짜 오확정이다).
function canAcceptLotBuildingCorrection({
  validation,
  rawText,
  resultAddress,
  inputBuildingName,
  resultBuildingName
}) {
  if (validation?.status !== "MISMATCH") return false;
  if (!/^(법정동|읍면) 불일치/.test(String(validation?.reason || ""))) return false;
  const lot = resultLotOf(resultAddress);
  if (!lot) return false;
  // 원문에 결과 지번이 그대로 있어야 한다(붙어 있어도 되므로 공백을 지우고 본다).
  if (!String(rawText || "").replace(/\s+/g, "").includes(lot)) return false;
  const result = buildingKey(resultBuildingName);
  if (!result || result.length < 3 || GENERIC_BUILDING.test(result)) return false;
  // 원문 어디에든 결과 건물명이 그대로 있으면 충분하다.
  if (buildingKey(rawText).includes(result)) return true;
  // "선암시장형 상가"처럼 원문이 결과의 줄임말인 경우도 같은 건물로 본다.
  const input = buildingKey(inputBuildingName);
  return Boolean(input) && input.length >= 4 && !GENERIC_BUILDING.test(input) && result.includes(input);
}

// 동소(同所)는 등기부에서 "위와 같은 장소"라는 뜻이다. 앞 행의 건물명으로 치환해
// 찾은 결과라면 원문 법정동이 아니라 앵커 쪽 법정동이 맞다. 앵커 행 자신도 원문에
// 같은 오기를 달고 있기 때문이다.
//   기준행 "석정리 대심리78-1외4필지 장미마을 아파트" → 대심리 78-1 장미마을아파트
//   동소행 "석정리 동소제102동제602호"                → 같은 곳인데 석정리≠대심리로 차단
// 앵커 이름이 결과 건물명에 실제로 들어 있을 때만 받는다.
function canAcceptDongsoAnchorCorrection({ validation, anchorName, resultBuildingName }) {
  if (validation?.status !== "MISMATCH") return false;
  if (!/^(법정동|읍면) 불일치/.test(String(validation?.reason || ""))) return false;
  const anchor = buildingKey(anchorName);
  if (!anchor || anchor.length < 3 || GENERIC_BUILDING.test(anchor)) return false;
  const result = buildingKey(resultBuildingName);
  return Boolean(result) && result.includes(anchor);
}
// ── public/unit-match.mjs ──
const MATCHER_VERSION = "iros-matcher-v11";

const IROS_MODULE_VERSIONS = Object.freeze({
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

function unitKey(value, kind = "unit") {
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

function dongAliasKey(value) {
  const key = unitKey(value, "dong");
  return DONG_ALIASES[key] || key;
}

function candidateUnitVariants(candidate) {
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

function candidateMatchesUnit(candidate, dong, ho) {
  return Boolean(matchedCandidateUnitVariant(candidate, dong, ho));
}

function matchedCandidateUnitVariant(candidate, dong, ho) {
  const wantDong = dongAliasKey(dong);
  const wantHo = unitKey(ho, "ho");
  return candidateUnitVariants(candidate).find((variant) =>
    (!wantDong || variant.dong === wantDong) &&
    (!wantHo || variant.ho === wantHo)
  ) || null;
}

function candidateHasNoDong(candidate) {
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
function rawUnitRecoveryVariants(rawAddress, currentUnit = {}) {
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

function rawUnitRecoverySignature(rawAddress, currentUnit = {}) {
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

function selectUniqueRawUnitCandidate(candidates, rawAddress, currentUnit = {}) {
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
function selectDongAgnosticHoCandidate(candidates, wantedDong, wantedHo) {
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

function buildingKey(value) {
  return String(value || "").replace(/[^0-9A-Za-z가-힣]/g, "").toLowerCase();
}

function buildingNamesMatch(left, right) {
  const a = buildingKey(left);
  const b = buildingKey(right);
  return Boolean(a && b && (a.includes(b) || b.includes(a)));
}

function buildingEvidenceKind(candidateName, normalizedName, rawInput) {
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
function alternateRawLotAddresses(rawAddress, normalizedAddress) {
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
function alternateRawLotAddress(rawAddress, normalizedAddress) {
  return alternateRawLotAddresses(rawAddress, normalizedAddress)[0] || "";
}

function candidateMatchesAddressLot(candidate, address) {
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

function propertyClassKey(candidate) {
  const raw = String(candidate?.real_cls_cd || candidate?.gubun || "").trim();
  if (raw.includes("집합")) return "집합건물";
  if (raw.includes("토지")) return "토지";
  if (raw.includes("건물")) return "건물";
  return "";
}

function filterExpectedPropertyClass(candidates, expected) {
  const source = Array.isArray(candidates) ? candidates : [];
  if (!expected) return { candidates: [...source], verified: true };
  const matched = source.filter((candidate) => propertyClassKey(candidate) === expected);
  return { candidates: matched, verified: matched.length > 0 };
}

// IROS 실측상 전유부가 real_cls_cd="건물"로 오면서 호가 buld_no_inner에
// 명시되는 경우가 있다. 원본 구분을 집합건물로 바꾸지 않고, 완전수집된 동일
// 지번 안에서 전용 필드의 호가 입력 동·호와 정확히 맞는 후보만 보조 허용한다.
// 토지·구분미상·상세문구 추출값은 이 경로에서 절대 허용하지 않는다.
function filterUnitPropertyCandidates(
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

function targetPropertyClass(result) {
  if (result?.isJip || unitKey(result?.unit?.ho, "ho")) return "집합건물";
  return "";
}

function summarizeCandidatePropertyClasses(candidates) {
  const found = new Set(
    (Array.isArray(candidates) ? candidates : [])
      .map(propertyClassKey)
      .filter(Boolean)
  );
  return ["집합건물", "건물", "토지"].filter((value) => found.has(value)).join("|");
}
// ── public/pnuless-iros.mjs ──
// PNU 없는 IROS 조회와 IROS 소재지 역확정.
//
// 배경: IROS 조회 자체는 PNU를 쓰지 않는다. `/resolve?addr=`에 지번주소를
// 넘기고, PNU는 완전후보 캐시의 그룹 키로만 쓰인다. 그런데 배치 진입 게이트가
// `status === "CONFIRMED"`(=PNU 확보)여서, 네이버가 주소를 정상으로 확인했지만
// JUSO에서 PNU를 못 얻은 행(`NAVER_CONFIRMED_PNU_FAILED`)은 조회 자체를 못 했다.
//
// 이 모듈은 두 가지를 분리한다.
//   1) 주소 문자열만으로 IROS 고유번호를 확정하는 경로(PNU 불필요)
//   2) 확정된 IROS 소재지를 JUSO로 되짚어 PNU를 복구하는 경로(주소정제율 회수)
//
// 2)가 실패해도 1)의 고유번호는 유지한다. 반대로 1)이 실패하면 2)는 시도하지
// 않는다. 근거 없는 소재지를 JUSO에 던지면 엉뚱한 PNU가 붙기 때문이다.
//
// 소유자명은 이 경로의 어떤 함수에도 입력으로 들어오지 않고, 질의 문자열은
// 행정구역·지번 정규식이 뽑아낸 토큰만으로 조립한다(구조적으로 유출 불가).


const PNULESS_IROS_VERSION = "pnuless-iros-v1";

// PNU는 없지만 주소 자체는 외부 원천이 정상으로 확인해 준 상태만 허용한다.
// AMBIGUOUS(복수 PNU)는 기존 R-ADDR-AMBIGUOUS-PNU-IROS가 담당하고,
// FAILED/HUMAN_INPUT_ERROR는 주소 문자열 자체를 믿을 수 없으므로 제외한다.
const PNULESS_ELIGIBLE_ADDRESS_STATUSES = Object.freeze([
  "NAVER_CONFIRMED_PNU_FAILED"
]);

const ELIGIBLE = new Set(PNULESS_ELIGIBLE_ADDRESS_STATUSES);

function text(value) {
  return String(value ?? "").trim();
}

function pnuOf(value) {
  const pnu = text(value);
  return /^\d{19}$/.test(pnu) ? pnu : "";
}

// 지번주소에서 `시도 … 법정동 지번`까지만 남긴다. 뒤에 붙은 건물명·동·호·
// 층 표기는 IROS 완전수집의 검색 범위를 좁혀 버리므로 잘라낸다.
function lotScopedAddress(value) {
  const source = text(value);
  const lot = extractLegalLot(source);
  if (!lot) return "";
  return source.slice(0, lot.lotEnd).replace(/\s+/g, " ").trim();
}

// IROS 조회에 쓸 주소 원천. jibunAddr가 없으면 네이버가 돌려준 지번주소를 쓴다.
function addressSources(result) {
  return [
    { source: "jibunAddr", value: result?.jibunAddr },
    { source: "naverJibunAddr", value: result?.naverJibunAddr },
    { source: "naverAddr", value: result?.naverAddr }
  ];
}

// 이 행을 PNU 없이 IROS로 조회할 수 있는가. 조회주소·동·호가 모두 확정적일
// 때만 계획을 만든다. 호가 없으면 세대를 특정할 수 없으므로 대상이 아니다.
function buildPnulessIrosPlan(row) {
  const result = row?.result;
  if (!result || !ELIGIBLE.has(text(result.status))) return null;
  if (pnuOf(result.pnu)) return null;
  const ho = unitKey(result.unit?.ho, "ho");
  if (!ho) return null;

  for (const { source, value } of addressSources(result)) {
    const address = lotScopedAddress(value);
    if (!address) continue;
    return {
      version: PNULESS_IROS_VERSION,
      address,
      addressSource: source,
      dong: unitKey(result.unit?.dong, "dong"),
      ho,
      // PNU가 없으면 "이 지번이 맞다"는 독립 근거가 JUSO에 없다. 건물명이
      // 있는 행은 기존 검토 플래그 경로로 건물명 교차검증까지 강제한다.
      strictBuilding: Boolean(text(result.bdNm)),
      groupKey: `PNULESS:${address}`
    };
  }
  return null;
}

function isPnulessIrosRow(row) {
  return Boolean(buildPnulessIrosPlan(row));
}

// 배치가 실제로 조회할 때 쓰는 임시 결과. 원본 result를 덮지 않고, 매칭
// 계약이 요구하는 필드만 채운 사본을 만든다. PNU는 끝까지 비워 둔다.
function pnulessProbeResult(result, plan) {
  return {
    ...result,
    status: "CONFIRMED",
    pnu: null,
    jibunAddr: plan.address,
    irosQuery: plan.address,
    isJip: true,
    reviewNeeded: plan.strictBuilding
      ? (result?.reviewNeeded || "pnuless_naver_address")
      : null,
    validation: {
      status: "NOT_AVAILABLE",
      reason: "PNU 미확보 주소의 IROS 세대검증용 임시후보",
      inputSgg: "",
      resultSgg: ""
    }
  };
}

// IROS가 확정한 세대의 소재지를 JUSO 질의어로 되돌린다. 등기부 소재지는
// `부산광역시 남구 대연동 100 삼성아파트 제106동 제1002호` 형태이므로
// 지번까지만 남기면 건물·동·호 표기가 전부 떨어져 나간다.
function irosSojaeQuery(candidate) {
  for (const value of [candidate?.sojae, candidate?.add_item]) {
    const query = lotScopedAddress(value);
    if (query) return query;
  }
  return "";
}

function sameLot(left, right) {
  const a = extractLegalLot(left);
  const b = extractLegalLot(right);
  if (!a || !b) return false;
  return a.legal === b.legal && a.mountain === b.mountain && a.lot === b.lot;
}

// JUSO 역조회 결과를 받아들일지 판정한다. 자동확정 조건은 세 가지 모두다.
//   - JUSO가 19자리 PNU를 돌려줬다
//   - JUSO 지번주소의 법정동·산여부·지번이 IROS 소재지와 정확히 같다
//   - 그 지번이 실제로 조회에 썼던 주소와도 같다(다른 지번으로 옮겨가지 않음)
function acceptReversePnu({ irosCandidate, jusoCandidate, queryAddress }) {
  const sojae = irosSojaeQuery(irosCandidate);
  if (!sojae) {
    return { ok: false, reason: "IROS_SOJAE_UNPARSABLE", pnu: "" };
  }
  const pnu = pnuOf(jusoCandidate?.pnu);
  if (!pnu) {
    return { ok: false, reason: "JUSO_PNU_NOT_FOUND", pnu: "", sojae };
  }
  const jibun = text(jusoCandidate?.jibunAddr);
  if (!sameLot(jibun, sojae)) {
    return { ok: false, reason: "JUSO_LOT_MISMATCH", pnu: "", sojae, jibun };
  }
  if (queryAddress && !sameLot(sojae, queryAddress)) {
    return { ok: false, reason: "IROS_LOT_DRIFTED", pnu: "", sojae, jibun };
  }
  return { ok: true, reason: "IROS_SOJAE_JUSO_REVERSE_PNU", pnu, sojae, jibun };
}

// 역확정에 성공한 행의 주소 결과를 CONFIRMED로 승격한다. 동·호와 원문은
// 그대로 두고 주소·PNU·근거만 채운다.
function applyReversePnu(result, {
  accepted,
  jusoCandidate,
  uniqueNo,
  jusoQuery = ""
}) {
  if (!accepted?.ok) return null;
  const evidence = [...new Set([
    ...(Array.isArray(result?.addressMatchEvidence) ? result.addressMatchEvidence : []),
    "IROS_SOJAE_JUSO_REVERSE_PNU"
  ])];
  return {
    ...result,
    status: "CONFIRMED",
    pnu: accepted.pnu,
    jibunAddr: text(jusoCandidate?.jibunAddr) || accepted.jibun,
    roadAddr: text(jusoCandidate?.roadAddr) || result?.roadAddr || "",
    bdNm: text(jusoCandidate?.bdNm) || result?.bdNm || "",
    bdMgtSn: text(jusoCandidate?.bdMgtSn) || null,
    isJip: jusoCandidate?.isJip ?? true,
    source: "iros-sojae-juso-reverse",
    addressMatchEvidence: evidence,
    validation: {
      status: "MATCH",
      reason: "IROS 확정 세대의 소재지를 JUSO에서 동일 지번으로 역확정",
      inputSgg: "",
      resultSgg: ""
    },
    pnulessRecovery: {
      version: PNULESS_IROS_VERSION,
      unique_no: text(uniqueNo),
      iros_sojae: accepted.sojae,
      juso_query: jusoQuery,
      juso_jibun: accepted.jibun,
      recovered_pnu: accepted.pnu
    }
  };
}

// 역확정을 시도하지 않았거나 거절된 행에도 사유를 남긴다. 고유번호는 이미
// 확보했으므로 주소 상태는 바꾸지 않는다.
function markReversePnuRejected(result, reason, detail = {}) {
  return {
    ...result,
    pnulessRecovery: {
      version: PNULESS_IROS_VERSION,
      recovered_pnu: "",
      rejected_reason: text(reason) || "NOT_ATTEMPTED",
      ...detail
    }
  };
}

// 같은 배치 안에 이미 그 지번을 PNU까지 확정한 행이 있으면 JUSO를 다시 부를
// 이유가 없다. 지번 문자열이 곧 키이고, 한 지번에 PNU가 두 종류로 잡혀 있으면
// 그 지번은 색인에서 제외한다(어느 쪽이 맞는지 판단할 근거가 없다).
function buildConfirmedLotPnuIndex(rows) {
  const collected = new Map();
  for (const row of Array.isArray(rows) ? rows : []) {
    const result = row?.result;
    if (!["CONFIRMED", "확정"].includes(text(result?.status))) continue;
    const pnu = pnuOf(result?.pnu);
    const key = lotScopedAddress(result?.jibunAddr);
    if (!pnu || !key) continue;
    if (!collected.has(key)) {
      collected.set(key, { pnu, candidate: result, conflict: false, rows: 0 });
    }
    const entry = collected.get(key);
    if (entry.pnu !== pnu) entry.conflict = true;
    entry.rows += 1;
  }
  const index = new Map();
  for (const [key, entry] of collected) {
    if (entry.conflict) continue;
    index.set(key, {
      pnu: entry.pnu,
      jibunAddr: text(entry.candidate?.jibunAddr),
      roadAddr: text(entry.candidate?.roadAddr),
      bdNm: text(entry.candidate?.bdNm),
      bdMgtSn: text(entry.candidate?.bdMgtSn) || null,
      isJip: entry.candidate?.isJip ?? true,
      source_row_count: entry.rows
    });
  }
  return index;
}

// 색인에서 찾은 PNU는 JUSO 응답과 같은 형태로 돌려준다. 이후 검증(지번 일치)은
// 네트워크 경로와 완전히 동일한 acceptReversePnu를 그대로 통과해야 한다.
function lotIndexJusoCandidate(irosCandidate, index) {
  const query = irosSojaeQuery(irosCandidate);
  if (!query || !index) return null;
  const hit = index.get(query);
  if (!hit) return null;
  return { candidate: hit, query, source: "confirmed_lot_index" };
}

// 배치가 끝난 뒤 역확정을 시도할 행 목록. IROS가 한 건으로 확정된 PNU 없는
// 행만 대상이며, 이미 판정이 끝난 행은 다시 부르지 않는다.
function planReversePnuRecovery(rows) {
  const out = [];
  const source = Array.isArray(rows) ? rows : [];
  for (let index = 0; index < source.length; index++) {
    const row = source[index];
    const plan = buildPnulessIrosPlan(row);
    if (!plan) continue;
    if (row?.result?.pnulessRecovery?.version === PNULESS_IROS_VERSION) continue;
    const reg = row?.reg;
    if (text(reg?.status) !== "RESOLVED" || !text(reg?.unique_no)) continue;
    const candidate = Array.isArray(reg.candidates) ? reg.candidates[0] : null;
    if (!candidate) continue;
    const query = irosSojaeQuery(candidate);
    if (!query) continue;
    out.push({
      index,
      rowId: text(row?.rowId),
      plan,
      query,
      irosCandidate: candidate,
      uniqueNo: text(reg.unique_no)
    });
  }
  return out;
}
// ── public/verified-unit-propagation.mjs ──
// 같은 PNU·동·호로 이미 검증된 고유번호를 같은 세대의 실패행에 전파한다.
//
// PNU가 같으면 지번이 같고, 지번이 같으면 IROS 완전후보 캐시도 같다. 거기서
// 동·호까지 같다면 물리적으로 동일한 전유부이므로 고유번호도 하나여야 한다.
// 그런데 실제로는 같은 세대가 한 행은 RESOLVED, 다른 행은 REG_MULTI나
// REG_UNIT_NOT_FOUND로 갈리는 경우가 있다. 원문 건물명 표기가 달라 검토
// 플래그가 붙었거나, 원문 동·호 표기가 달라 매칭 단계가 갈렸기 때문이다.
//
// 이 모듈은 그런 행만 회수한다. 자동확정 조건은 아래를 전부 만족할 때다.
//   - 기준행이 RESOLVED이고 고유번호가 비어 있지 않다
//   - 같은 키의 RESOLVED 고유번호가 정확히 한 종류다(두 종류면 전파 자체를 닫는다)
//   - 대상행이 완전수집된 상태에서 실패했다(부분응답·서비스오류는 재조회 대상)
//   - 대상행이 이미 본 후보 목록 안에 그 고유번호가 실제로 존재한다


const VERIFIED_UNIT_PROPAGATION_VERSION = "verified-unit-propagation-v1";

// 완전수집이 끝난 뒤의 세대 실패만 전파 대상이다. 재시도 상태는 다시 조회해야
// 하며, 여기서 값을 채우면 조회되지 않은 행이 완료로 굳는다.
const PROPAGATABLE_FAILURES = new Set([
  "REG_MULTI",
  "MULTIPLE",
  "REG_UNIT_NOT_FOUND"
]);

function text(value) {
  return String(value ?? "").trim();
}

function verifiedUnitKey(result) {
  const pnu = text(result?.pnu);
  const ho = unitKey(result?.unit?.ho, "ho");
  if (!/^\d{19}$/.test(pnu) || !ho) return "";
  return `${pnu}|${dongAliasKey(result?.unit?.dong)}|${ho}`;
}

function isVerifiedSource(row) {
  const reg = row?.reg;
  return text(reg?.status) === "RESOLVED" &&
    Boolean(text(reg?.unique_no)) &&
    reg?.stale !== true;
}

// 키별로 검증된 고유번호를 모은다. 한 키에서 서로 다른 고유번호가 나오면
// 그 키는 통째로 버린다. 어느 쪽이 맞는지 판단할 근거가 없기 때문이다.
function buildVerifiedUnitIndex(rows) {
  const collected = new Map();
  for (const row of Array.isArray(rows) ? rows : []) {
    if (!isVerifiedSource(row)) continue;
    const key = verifiedUnitKey(row?.result);
    if (!key) continue;
    const uniqueNo = text(row.reg.unique_no);
    if (!collected.has(key)) {
      collected.set(key, { key, unique_no: uniqueNo, sources: [], conflict: false });
    }
    const entry = collected.get(key);
    if (entry.unique_no !== uniqueNo) entry.conflict = true;
    entry.sources.push(text(row?.rowId));
  }
  const index = new Map();
  for (const [key, entry] of collected) {
    if (entry.conflict) continue;
    index.set(key, {
      key,
      unique_no: entry.unique_no,
      source_row_ids: entry.sources.filter(Boolean).sort(),
      source_count: entry.sources.length
    });
  }
  return index;
}

function candidateUniqueNos(reg) {
  return new Set(
    (Array.isArray(reg?.candidates) ? reg.candidates : [])
      .map((candidate) => text(candidate?.unique_no))
      .filter(Boolean)
  );
}

function selectedCandidate(reg, uniqueNo) {
  return (Array.isArray(reg?.candidates) ? reg.candidates : [])
    .find((candidate) => text(candidate?.unique_no) === uniqueNo) || null;
}

function planVerifiedUnitPropagation(rows, index = buildVerifiedUnitIndex(rows)) {
  const out = [];
  const source = Array.isArray(rows) ? rows : [];
  for (let position = 0; position < source.length; position++) {
    const row = source[position];
    const reg = row?.reg;
    if (!reg || reg.complete !== true || reg.stale === true) continue;
    if (!PROPAGATABLE_FAILURES.has(text(reg.status))) continue;
    const key = verifiedUnitKey(row?.result);
    if (!key) continue;
    const verified = index.get(key);
    if (!verified) continue;

    // 대상행이 본 후보 안에 그 고유번호가 없으면 같은 완전후보를 본 것이
    // 아니다. 이 경우는 전파하지 않고 실패를 그대로 둔다.
    const seen = candidateUniqueNos(reg);
    if (seen.size && !seen.has(verified.unique_no)) continue;

    out.push({
      index: position,
      rowId: text(row?.rowId),
      key,
      unique_no: verified.unique_no,
      from_status: text(reg.status),
      candidate: selectedCandidate(reg, verified.unique_no),
      evidence: {
        version: VERIFIED_UNIT_PROPAGATION_VERSION,
        key,
        source_row_ids: verified.source_row_ids,
        source_count: verified.source_count,
        candidate_pool_checked: seen.size
      }
    });
  }
  return out;
}

// 전파 결과를 reg에 적용한다. 원래 실패 상태와 후보 수를 감사용으로 남긴다.
function applyVerifiedUnitPropagation(reg, propagation) {
  const candidate = propagation?.candidate;
  return {
    ...(reg || {}),
    status: "RESOLVED",
    unique_no: propagation.unique_no,
    candidates: candidate ? [candidate] : (reg?.candidates || []),
    strategy: "VERIFIED_UNIT_PROPAGATION",
    applied_modules: [...new Set([
      ...(Array.isArray(reg?.applied_modules) ? reg.applied_modules : []),
      `R-IROS-VERIFIED-UNIT-PROPAGATION@${VERIFIED_UNIT_PROPAGATION_VERSION}`
    ])],
    unit_propagation: {
      ...propagation.evidence,
      from_status: propagation.from_status,
      from_candidate_count: Array.isArray(reg?.candidates) ? reg.candidates.length : 0
    },
    message: `동일 PNU·동·호의 검증된 고유번호 전파 (${propagation.from_status})`
  };
}
// ── public/recovery-impact.mjs ──
// 개선 모듈의 기대효과를 배치 스냅샷에서 결정적으로 계산한다.
//
// 추정이 아니다. IROS 완전후보(`reg.candidates`)는 이미 각 행에 저장돼 있으므로,
// 새 모듈이 그 후보 위에서 무엇을 하는지는 API 호출 없이 그대로 재현된다.
// 재현 불가능한 항목(아직 조회한 적 없는 지번)은 추정하지 않고 `미측정`으로
// 분리해서 보고한다.
//
// 브라우저와 Node 양쪽에서 그대로 돈다. 파일시스템·프로세스 API를 쓰지 않는다.
// 입력 스냅샷에는 원문주소와 소유자 관련 원본열이 함께 들어 있을 수 있으나,
// 이 모듈의 출력은 건수와 사유 코드뿐이다.




const UNIT_FAILURES = new Set(["REG_MULTI", "MULTIPLE", "REG_UNIT_NOT_FOUND"]);

function text(value) {
  return String(value ?? "").trim();
}

function isConfirmed(result) {
  return ["CONFIRMED", "확정"].includes(text(result?.status));
}

function isFinalResolved(row) {
  return isConfirmed(row?.result) && text(row?.result?.pnu) &&
    text(row?.reg?.status) === "RESOLVED" && text(row?.reg?.unique_no);
}

// 완전수집이 끝난 세대 실패만 후보 위 재현이 가능하다.
function replayableFailure(row) {
  const reg = row?.reg;
  return Boolean(reg) && reg.complete === true &&
    UNIT_FAILURES.has(text(reg.status)) &&
    Array.isArray(reg.candidates) && reg.candidates.length > 0;
}

function bucket(map, key) {
  map.set(key, (map.get(key) || 0) + 1);
}

// 매처가 실제로 쓰는 순서대로 한 행을 재현한다. 먼저 성공하는 모듈이 그 행을
// 가져가므로, 각 행은 정확히 한 모듈에만 귀속된다(중복 집계 방지).
//
// 기존 매처(v10)가 이미 적용하던 원문복구 변형으로도 수렴하는 행은 새 이득이
// 아니다. 중복 동 표기 변형을 뺀 상태와 넣은 상태를 각각 계산해, 넣었을 때만
// 수렴하는 행을 이득으로 센다.
function replayUnitRecovery(row) {
  const unit = row?.result?.unit || {};
  const raw = row?.raw || "";
  const entered = [];
  const allVariants = rawUnitRecoveryVariants(raw, unit);
  const duplicateVariants = allVariants.filter((v) => v.source === "raw_duplicate_dong");
  const pool = filterUnitPropertyCandidates(
    row.reg.candidates, unit.dong || "", unit.ho || "", allVariants
  );

  if (duplicateVariants.length) {
    entered.push("중복 동 표기 복구");
    if (!pool.verified) {
      return { entered, module: null, stage: "중복 동 표기 복구", reason: "PROPERTY_CLASS" };
    }
    const newHit = selectUniqueRawUnitCandidate(pool.candidates, raw, unit);
    if (newHit?.candidate) {
      // 기존 매처(v10)의 변형만으로도 이미 수렴했다면 새 이득이 아니다.
      const baselinePool = filterUnitPropertyCandidates(
        row.reg.candidates, unit.dong || "", unit.ho || "",
        allVariants.filter((v) => v.source !== "raw_duplicate_dong")
      );
      const baselineHit = baselinePool.verified && allVariants.length > duplicateVariants.length
        ? selectUniqueRawUnitCandidate(baselinePool.candidates, raw, { ...unit, __noDuplicate: true })
        : null;
      if (!baselineHit?.candidate) {
        return { entered, module: "중복 동 표기 복구", candidate: newHit.candidate };
      }
      return { entered, module: null, stage: "중복 동 표기 복구", reason: "ALREADY_RECOVERED_BY_V10" };
    }
    return { entered, module: null, stage: "중복 동 표기 복구", reason: "NO_UNIQUE_CONVERGENCE" };
  }

  if (text(row.reg.status) === "REG_UNIT_NOT_FOUND" && unit.dong && unit.ho) {
    entered.push("동 무시 호 수렴");
    if (!pool.verified) {
      return { entered, module: null, stage: "동 무시 호 수렴", reason: "PROPERTY_CLASS" };
    }
    const dongKeys = new Set(
      row.reg.candidates.map((candidate) => unitKey(candidate?.dong, "dong")).filter(Boolean)
    );
    if (dongKeys.has(unitKey(unit.dong, "dong"))) {
      return { entered, module: null, stage: "동 무시 호 수렴", reason: "REQUESTED_DONG_EXISTS" };
    }
    const picked = selectDongAgnosticHoCandidate(pool.candidates, unit.dong, unit.ho);
    if (picked?.candidate) return { entered, module: "동 무시 호 수렴", candidate: picked.candidate };
    return { entered, module: null, stage: "동 무시 호 수렴", reason: "HO_NOT_UNIQUE" };
  }
  return { entered, module: null, reason: "NO_MODULE_APPLIES" };
}

function measure(rows) {
  const total = rows.length;
  const baselineAddress = rows.filter((row) => isConfirmed(row?.result) && text(row?.result?.pnu)).length;
  const baselineFinal = rows.filter(isFinalResolved).length;

  const duplicateDong = { entered: 0, recovered: 0, rejected: new Map() };
  const dongAgnostic = { entered: 0, recovered: 0, rejected: new Map() };
  const stats = { "중복 동 표기 복구": duplicateDong, "동 무시 호 수렴": dongAgnostic };

  // ── 1단계: 완전후보 위 세대 재매칭 (결정적) ────────────────────────
  const staged = rows.map((row) => {
    if (!replayableFailure(row)) return row;
    const outcome = replayUnitRecovery(row);
    for (const stage of outcome.entered) stats[stage].entered += 1;
    if (outcome.module) {
      stats[outcome.module].recovered += 1;
      return {
        ...row,
        reg: {
          ...row.reg, status: "RESOLVED",
          unique_no: text(outcome.candidate?.unique_no),
          candidates: [outcome.candidate]
        }
      };
    }
    if (outcome.stage) bucket(stats[outcome.stage].rejected, outcome.reason);
    return row;
  });

  // ── 2단계: PNU 없는 IROS 조회 ───────────────────────────────────
  // 다른 행이 같은 지번을 이미 완전수집했으면 그 후보 위에서 결정적으로
  // 재현된다. 수집 이력이 없는 지번은 추정하지 않고 미측정으로 남긴다.
  const poolsByLot = new Map();
  for (const row of staged) {
    if (!Array.isArray(row?.reg?.candidates) || row.reg.complete !== true) continue;
    const key = lotScopedAddress(row?.result?.jibunAddr);
    if (key && !poolsByLot.has(key)) poolsByLot.set(key, row.reg.candidates);
  }

  const pnuless = {
    entered: 0, replayable: 0, recovered: 0, unmeasured: 0,
    strictBuilding: 0, rejected: new Map()
  };
  const pnulessResolved = new Map();
  const afterPnuless = staged.map((row, position) => {
    const plan = buildPnulessIrosPlan(row);
    if (!plan) return row;
    pnuless.entered += 1;
    if (plan.strictBuilding) pnuless.strictBuilding += 1;
    const pool = poolsByLot.get(plan.address);
    if (!pool) {
      pnuless.unmeasured += 1;
      return row;
    }
    pnuless.replayable += 1;
    const typed = filterUnitPropertyCandidates(pool, plan.dong, plan.ho);
    if (!typed.verified) {
      bucket(pnuless.rejected, "PROPERTY_CLASS");
      return row;
    }
    const matched = typed.candidates.filter((candidate) =>
      unitKey(candidate?.ho, "ho") === plan.ho &&
      (!plan.dong || unitKey(candidate?.dong, "dong") === plan.dong)
    );
    const unique = new Set(matched.map((candidate) => text(candidate?.unique_no)).filter(Boolean));
    if (unique.size !== 1) {
      bucket(pnuless.rejected, unique.size === 0 ? "UNIT_NOT_FOUND" : "MULTIPLE");
      return row;
    }
    pnuless.recovered += 1;
    pnulessResolved.set(position, { plan, candidate: matched[0] });
    return {
      ...row,
      reg: {
        status: "RESOLVED", complete: true,
        unique_no: text(matched[0]?.unique_no), candidates: [matched[0]]
      }
    };
  });

  // ── 3단계: 동일 PNU·동·호 검증 고유번호 전파 (결정적) ───────────────
  const propagationPlan = planVerifiedUnitPropagation(afterPnuless);
  const propagation = {
    entered: afterPnuless.filter((row) => replayableFailure(row) && text(row?.result?.pnu)).length,
    recovered: propagationPlan.length,
    rejected: new Map()
  };

  // ── 4단계: IROS 소재지 → PNU 역확정 ────────────────────────────
  // 배치 안에 같은 지번의 확정 PNU가 있으면 JUSO 없이 결정된다. 나머지는
  // JUSO 응답에 달려 있으므로 미측정으로 분리한다.
  const lotIndex = buildConfirmedLotPnuIndex(afterPnuless);
  const reverse = { entered: 0, recovered: 0, needsJuso: 0, rejected: new Map() };
  for (const [position, { plan, candidate }] of pnulessResolved) {
    if (!irosSojaeQuery(candidate)) {
      bucket(reverse.rejected, "IROS_SOJAE_UNPARSABLE");
      continue;
    }
    reverse.entered += 1;
    const hit = lotIndexJusoCandidate(candidate, lotIndex);
    if (!hit) {
      reverse.needsJuso += 1;
      continue;
    }
    const accepted = acceptReversePnu({
      irosCandidate: candidate,
      jusoCandidate: hit.candidate,
      queryAddress: plan.address
    });
    if (accepted.ok) reverse.recovered += 1;
    else bucket(reverse.rejected, accepted.reason);
  }

  const irosGain = duplicateDong.recovered + dongAgnostic.recovered +
    propagation.recovered + pnuless.recovered;
  // 주소확정은 역확정에 성공한 행만 늘어난다. 그 행들은 이미 IROS 이득에
  // 포함돼 있으므로 최종통과에는 다시 더하지 않는다.
  const addressGain = reverse.recovered;

  return {
    total,
    baseline: {
      addressConfirmed: baselineAddress,
      addressRate: total ? baselineAddress / total : 0,
      finalResolved: baselineFinal,
      finalRate: total ? baselineFinal / total : 0
    },
    modules: {
      "중복 동 표기 복구": duplicateDong,
      "동 무시 호 수렴": dongAgnostic,
      "검증 고유번호 전파": propagation,
      "PNU 없는 IROS 조회": pnuless,
      "IROS 소재지 역확정": reverse
    },
    measured: {
      irosGain,
      addressGain,
      finalResolved: baselineFinal + irosGain,
      finalRate: total ? (baselineFinal + irosGain) / total : 0,
      addressConfirmed: baselineAddress + addressGain,
      addressRate: total ? (baselineAddress + addressGain) / total : 0
    },
    unmeasured: {
      pnulessWithoutPool: pnuless.unmeasured,
      reverseNeedingJuso: reverse.needsJuso
    }
  };
}

function pct(value) {
  return `${(value * 100).toFixed(2)}%`;
}

function reasons(map) {
  if (!map.size) return "-";
  return [...map.entries()].sort((a, b) => b[1] - a[1])
    .map(([key, count]) => `${key} ${count}`).join(", ");
}

function report(result) {
  const lines = [];
  lines.push(`전체 처리행: ${result.total}건`);
  lines.push("");
  lines.push("── 현재 실측 (스냅샷 그대로) ──");
  lines.push(`주소확정   ${result.baseline.addressConfirmed}건  ${pct(result.baseline.addressRate)}`);
  lines.push(`최종통과   ${result.baseline.finalResolved}건  ${pct(result.baseline.finalRate)}`);
  lines.push("");
  lines.push("── 모듈별 결정적 재현 ──");
  lines.push("모듈                        진입    확정   거절 사유");
  for (const [name, data] of Object.entries(result.modules)) {
    const entered = String(data.entered ?? 0).padStart(5);
    const recovered = String(data.recovered ?? 0).padStart(5);
    lines.push(`${name.padEnd(24)}${entered}${recovered}   ${reasons(data.rejected)}`);
  }
  lines.push("");
  lines.push("── 측정된 기대효과 ──");
  lines.push(`IROS 최종통과  ${result.baseline.finalResolved} → ${result.measured.finalResolved}건  ` +
    `${pct(result.baseline.finalRate)} → ${pct(result.measured.finalRate)}  (+${result.measured.irosGain})`);
  lines.push(`주소확정       ${result.baseline.addressConfirmed} → ${result.measured.addressConfirmed}건  ` +
    `${pct(result.baseline.addressRate)} → ${pct(result.measured.addressRate)}  (+${result.measured.addressGain})`);
  lines.push("");
  lines.push("── 미측정 (이 스냅샷으로는 재현 불가) ──");
  lines.push(`PNU 없는 행 중 해당 지번 수집 이력 없음: ${result.unmeasured.pnulessWithoutPool}건 (IROS 조회 필요)`);
  lines.push(`역확정 중 배치 내 PNU 색인 미적중:       ${result.unmeasured.reverseNeedingJuso}건 (JUSO 조회 필요)`);
  lines.push("");
  lines.push("위 두 줄은 추정하지 않는다. 실제 조회 후 같은 스크립트를 다시 돌리면 확정된다.");
  return lines.join("\n");
}

// ── 실행부 ─────────────────────────────────────────────────────────
(async () => {
  const BATCH_KEY = "rows-progress";
  let snapshot = null;
  try {
    const db = await new Promise((res, rej) => {
      const q = indexedDB.open("addr-refine", 1);
      q.onsuccess = () => res(q.result);
      q.onerror = () => rej(q.error);
    });
    snapshot = await new Promise((res, rej) => {
      const q = db.transaction("batch").objectStore("batch").get(BATCH_KEY);
      q.onsuccess = () => res(q.result?.value ?? null);
      q.onerror = () => rej(q.error);
    });
  } catch (error) {
    console.error("저장된 배치를 읽지 못했습니다:", error);
    return;
  }
  const rows = Array.isArray(snapshot) ? snapshot : snapshot?.rows;
  if (!Array.isArray(rows) || !rows.length) {
    console.warn("저장된 배치가 없습니다. 앱에서 '이어서 하기'가 보이는 상태여야 합니다.");
    return;
  }
  const result = measure(rows);
  console.log(report(result));
  window.__RECOVERY_IMPACT__ = result;
  console.log("%c위 표를 그대로 복사해서 붙여넣으면 됩니다. 주소·소유자 정보는 들어 있지 않습니다.",
    "color:#22D3EE;font-weight:700");
})();
})();
