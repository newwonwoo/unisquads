import {
  buildingKey,
  candidateHasNoDong,
  candidateMatchesUnit,
  candidateUnitVariants,
  dongAliasKey,
  unitKey
} from "./unit-match.mjs";

export const UNIT_PROFILE_VERSION = "iros-unit-profile-v1";

function lastMatch(text, pattern) {
  const matches = [...String(text || "").matchAll(pattern)];
  return matches.at(-1) || null;
}

export function extractUnitIntent(rawAddress, currentUnit = {}) {
  const raw = String(rawAddress || "");
  const dong = dongAliasKey(currentUnit?.dong);
  const ho = unitKey(currentUnit?.ho, "ho");
  const intent = {
    dong,
    ho,
    floor: "",
    room: "",
    recoveredDong: "",
    evidence: []
  };

  const floorRoom = lastMatch(raw, /(?:^|\s)(\d{1,2})\s*층\s*(\d{1,3})\s*호(?=\s|$)/g);
  if (floorRoom && (!ho || unitKey(floorRoom[2], "ho") === ho)) {
    intent.floor = String(Number(floorRoom[1]));
    intent.room = String(Number(floorRoom[2]));
    intent.evidence.push("RAW_FLOOR_ROOM");
  }

  // 왼쪽 한 자리 N-M호는 층·지하표기와 충돌할 수 있어 동 복원 근거로 쓰지 않는다.
  const dongRoom = lastMatch(raw, /(?:^|\s)(\d{2,4})\s*-\s*(\d{2,5})\s*호(?=\s|$)/g);
  if (!dong && ho && dongRoom && unitKey(dongRoom[2], "ho") === ho) {
    intent.recoveredDong = dongAliasKey(dongRoom[1]);
    intent.evidence.push("RAW_DONG_ROOM");
  }

  return intent;
}

export function unitIntentSignature(rawAddress, currentUnit = {}) {
  const intent = extractUnitIntent(rawAddress, currentUnit);
  return [
    UNIT_PROFILE_VERSION,
    intent.dong || "-",
    intent.ho || "-",
    intent.floor || "-",
    intent.room || "-",
    intent.recoveredDong || "-",
    intent.evidence.join(",") || "none"
  ].join(":");
}

function classifyHo(value) {
  const raw = String(value || "").trim().replace(/\s+/g, "").replace(/호$/, "");
  if (!raw) return "EMPTY";
  if (/^\d+$/.test(raw)) return "NUMERIC";
  if (/^\d+-\d+$/.test(raw)) return "HYPHEN_NUMERIC";
  if (/^\d+층\d+$/.test(raw)) return "FLOOR_TEXT";
  if (/^[A-Za-z가-힣]+-\d+(?:-\d+)?$/.test(raw)) return "PREFIXED_ROOM";
  return "OTHER";
}

function profileKey(candidate) {
  const name = buildingKey(candidate?.buldnm);
  return name ? `NAME:${name}` : "UNNAMED";
}

function numericConventionWidths(candidates) {
  const widths = new Set();
  const numeric = (candidates || [])
    .map((candidate) => unitKey(candidate?.ho, "ho"))
    .filter((value) => /^\d{3,6}$/.test(value));

  for (let width = 1; width <= 3; width++) {
    const floors = new Set();
    const rooms = new Set();
    let count = 0;
    for (const value of numeric) {
      if (value.length <= width) continue;
      const floor = Number(value.slice(0, -width));
      const room = Number(value.slice(-width));
      if (!Number.isInteger(floor) || floor < 1 || floor > 99) continue;
      if (!Number.isInteger(room) || room < 0) continue;
      floors.add(String(floor));
      rooms.add(String(room));
      count++;
    }
    // 한 건의 우연한 숫자를 규칙으로 채택하지 않는다. 같은 건물 후보에서
    // 최소 3건이 존재하고 층 또는 방 번호가 반복구조를 보여야 한다.
    if (count >= 3 && (floors.size >= 2 || rooms.size >= 2)) widths.add(width);
  }
  return widths;
}

export function buildBuildingUnitProfiles(candidates) {
  const groups = new Map();
  for (const candidate of candidates || []) {
    const key = profileKey(candidate);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(candidate);
  }

  return [...groups.entries()].map(([key, rows]) => {
    const formats = new Set(rows.map((candidate) => classifyHo(candidate?.ho)));
    const named = key.startsWith("NAME:") ? key.slice(5) : "";
    const allNoDong = rows.every((candidate) => candidateHasNoDong(candidate));
    const anyNoDong = rows.some((candidate) => candidateHasNoDong(candidate));
    return {
      key,
      buildingKey: named,
      candidates: rows,
      candidateCount: rows.length,
      allNoDong,
      dongMode: allNoDong ? "NO_DONG" : (anyNoDong ? "MIXED" : "DIRECT"),
      hoFormats: formats,
      numericWidths: numericConventionWidths(rows)
    };
  });
}

function candidateIdentity(candidate) {
  return String(candidate?.unique_no || "") || [
    candidate?.dong || "",
    candidate?.ho || "",
    candidate?.buldnm || "",
    candidate?.add_item || "",
    candidate?.sojae || ""
  ].join("|");
}

function dongCompatible(candidate, profile, wantedDong) {
  if (!wantedDong) return true;
  const variants = candidateUnitVariants(candidate);
  if (variants.some((variant) => variant.dong === wantedDong)) return true;
  return profile.allNoDong && variants.every((variant) => !variant.dong);
}

function matchNumericFloorRoom(candidate, profile, intent) {
  const ho = unitKey(candidate?.ho, "ho");
  if (!/^\d+$/.test(ho) || !intent.floor || !intent.room) return false;
  for (const width of profile.numericWidths) {
    if (ho.length <= width) continue;
    const floor = String(Number(ho.slice(0, -width)));
    const room = String(Number(ho.slice(-width)));
    if (floor === intent.floor && room === intent.room) return true;
  }
  return false;
}

function profileMatches(profile, intent) {
  const matches = [];
  const push = (candidate, strategy) => matches.push({ candidate, strategy, profile });

  for (const candidate of profile.candidates) {
    // 현재 정규화 동·호의 직접 일치도 건물 프로파일의 한 표현방식이다.
    if ((intent.dong || intent.ho) && candidateMatchesUnit(candidate, intent.dong, intent.ho)) {
      push(candidate, "PROFILE_DIRECT");
    }

    if (intent.recoveredDong && intent.ho) {
      if (candidateMatchesUnit(candidate, intent.recoveredDong, intent.ho)) {
        push(candidate, "PROFILE_RAW_DONG_ROOM_DIRECT");
      }
      const embedded = `${intent.recoveredDong}-${intent.ho}`;
      if (candidateHasNoDong(candidate) && unitKey(candidate?.ho, "ho") === embedded) {
        push(candidate, "PROFILE_DONG_EMBEDDED_HYPHEN");
      }
    }

    if (intent.floor && intent.room && dongCompatible(candidate, profile, intent.dong)) {
      const ho = unitKey(candidate?.ho, "ho");
      if (profile.hoFormats.has("HYPHEN_NUMERIC") && ho === `${intent.floor}-${intent.room}`) {
        push(candidate, "PROFILE_FLOOR_ROOM_HYPHEN");
      }
      if (profile.hoFormats.has("FLOOR_TEXT") && ho === `${intent.floor}층${intent.room}`) {
        push(candidate, "PROFILE_FLOOR_ROOM_TEXT");
      }
      if (profile.hoFormats.has("NUMERIC") && matchNumericFloorRoom(candidate, profile, intent)) {
        push(candidate, "PROFILE_FLOOR_ROOM_NUMERIC");
      }
    }
  }

  return matches;
}

export function matchUnitByBuildingProfile(
  candidates,
  rawAddress,
  currentUnit = {},
  expectedBuildingName = ""
) {
  const intent = extractUnitIntent(rawAddress, currentUnit);
  const profiles = buildBuildingUnitProfiles(candidates);
  const allMatches = profiles.flatMap((profile) => profileMatches(profile, intent));
  const expected = buildingKey(expectedBuildingName);
  let matches = allMatches;
  let exactBuildingFilterApplied = false;

  if (expected) {
    const exact = matches.filter((match) => match.profile.buildingKey === expected);
    if (exact.length) {
      matches = exact;
      exactBuildingFilterApplied = true;
    }
  }

  const unique = new Map();
  for (const match of matches) {
    const key = candidateIdentity(match.candidate);
    if (!key) continue;
    if (!unique.has(key)) unique.set(key, match);
  }

  const audit = {
    profile_version: UNIT_PROFILE_VERSION,
    intent,
    profiles_considered: profiles.map((profile) => ({
      key: profile.key,
      candidate_count: profile.candidateCount,
      dong_mode: profile.dongMode,
      ho_formats: [...profile.hoFormats],
      numeric_widths: [...profile.numericWidths]
    })),
    matched_candidate_count: unique.size,
    strategies: [...new Set(matches.map((match) => match.strategy))],
    exact_building_filter_applied: exactBuildingFilterApplied
  };

  if (unique.size !== 1) {
    return {
      status: unique.size > 1 ? "AMBIGUOUS" : "NO_MATCH",
      candidate: null,
      audit
    };
  }

  const selected = [...unique.values()][0];
  return {
    status: "UNIQUE",
    candidate: selected.candidate,
    strategy: selected.strategy,
    profile: {
      key: selected.profile.key,
      dong_mode: selected.profile.dongMode,
      ho_formats: [...selected.profile.hoFormats],
      numeric_widths: [...selected.profile.numericWidths]
    },
    audit
  };
}
