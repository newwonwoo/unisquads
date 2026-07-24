import {
  buildingKey,
  candidateHasNoDong,
  candidateMatchesUnit,
  candidateUnitVariants,
  dongAliasKey,
  unitKey
} from "./unit-match.mjs";
import {
  candidateSupportsSubBuilding,
  extractBuildingRangeIntent,
  extractCommercialFloorRoomIntent,
  extractSubBuildingIntent,
  floorIntentFromText
} from "./address-subbuilding-rules.mjs";

export const UNIT_PROFILE_VERSION = "iros-unit-profile-v3";

function lastMatch(text, pattern) {
  const matches = [...String(text || "").matchAll(pattern)];
  return matches.at(-1) || null;
}

export function extractUnitIntent(rawAddress, currentUnit = {}) {
  const raw = String(rawAddress || "");
  const dong = dongAliasKey(currentUnit?.dong);
  const ho = unitKey(currentUnit?.ho, "ho");
  const commercialUnit = extractCommercialFloorRoomIntent(raw);
  const intent = {
    dong,
    ho,
    floor: currentUnit?.floor || commercialUnit?.floor || floorIntentFromText(raw) || "",
    room: commercialUnit?.room || "",
    recoveredDong: "",
    subBuilding: extractSubBuildingIntent(raw),
    buildingRange: extractBuildingRangeIntent(raw),
    evidence: []
  };
  if (commercialUnit) intent.evidence.push(commercialUnit.evidence);

  const basementRoom = lastMatch(
    raw,
    /(?:^|\s)(?:지하\s*(\d{1,2})|B\s*(\d{1,2}))\s*층\s*(\d{1,3})\s*호(?=\s|$)/gi
  );
  if (basementRoom && (!ho || unitKey(basementRoom[3], "ho") === ho)) {
    intent.floor = `B${Number(basementRoom[1] || basementRoom[2])}`;
    intent.room = String(Number(basementRoom[3]));
    intent.evidence.push("RAW_BASEMENT_ROOM");
  } else {
    const floorRoom = lastMatch(raw, /(?:^|\s)(\d{1,2})\s*층\s*(\d{1,3})\s*호(?=\s|$)/g);
    if (floorRoom && (!ho || unitKey(floorRoom[2], "ho") === ho ||
        unitKey(`${floorRoom[1]}${String(Number(floorRoom[2])).padStart(2, "0")}`, "ho") === ho)) {
      intent.floor = String(Number(floorRoom[1]));
      intent.room = String(Number(floorRoom[2]));
      intent.evidence.push("RAW_FLOOR_ROOM");
    }
  }

  // 왼쪽 한 자리 N-M호는 층·지하표기와 충돌할 수 있어 동 복원 근거로 쓰지 않는다.
  const dongRoom = lastMatch(raw, /(?:^|\s)(\d{2,4})\s*-\s*(\d{2,5})\s*호(?=\s|$)/g);
  if (!dong && ho && dongRoom && unitKey(dongRoom[2], "ho") === ho) {
    intent.recoveredDong = dongAliasKey(dongRoom[1]);
    intent.evidence.push("RAW_DONG_ROOM");
  }

  if (intent.subBuilding) intent.evidence.push(`RAW_SUB_BUILDING_${intent.subBuilding.kind}`);
  if (intent.buildingRange) intent.evidence.push(intent.buildingRange.evidence);
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
    intent.subBuilding?.kind || "-",
    intent.buildingRange ? `${intent.buildingRange.start}-${intent.buildingRange.end}` : "-",
    intent.evidence.join(",") || "none"
  ].join(":");
}

function normalizedHoText(value) {
  return String(value || "").trim().replace(/\s+/g, "").replace(/호$/, "").toUpperCase();
}

function classifyHo(value) {
  const raw = normalizedHoText(value);
  if (!raw) return "EMPTY";
  if (/^\d+$/.test(raw)) return "NUMERIC";
  if (/^\d+-\d+$/.test(raw)) return "HYPHEN_NUMERIC";
  if (/^\d+층\d+$/.test(raw)) return "FLOOR_TEXT";
  if (/^(?:B\d+|지하\d+)-\d+$/.test(raw)) return "BASEMENT_HYPHEN";
  if (/^(?:B\d+|지하\d+층)\d+$/.test(raw)) return "BASEMENT_COMBINED";
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
  if (!/^\d+$/.test(ho) || !intent.floor || !intent.room || /^B/.test(intent.floor)) return false;
  for (const width of profile.numericWidths) {
    if (ho.length <= width) continue;
    const floor = String(Number(ho.slice(0, -width)));
    const room = String(Number(ho.slice(-width)));
    if (floor === intent.floor && room === intent.room) return true;
  }
  return false;
}

function matchBasementRoom(candidate, intent) {
  if (!/^B\d+$/.test(intent.floor || "") || !intent.room) return false;
  const level = intent.floor.slice(1);
  const room = String(Number(intent.room));
  const room2 = room.padStart(2, "0");
  const raw = normalizedHoText(candidate?.ho);
  return new Set([
    `B${level}-${room}`,
    `지하${level}-${room}`,
    `B${level}층${room}`,
    `지하${level}층${room}`,
    `B${level}${room2}`,
    `지하${level}${room2}`
  ]).has(raw);
}

function candidateSearchText(candidate) {
  return [
    candidate?.floor,
    candidate?.floor_no,
    candidate?.floorNo,
    candidate?.dong,
    candidate?.ho,
    candidate?.buldnm,
    candidate?.add_item,
    candidate?.sojae
  ].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
}

// 일부 상가 전유부는 bridge가 호만 분리하고 층은 소재지 문자열에 남긴다.
// 후보 원문에 층·호가 함께 명시된 경우 이를 독립적인 구조근거로 사용한다.
function candidateExplicitFloorRoom(candidate) {
  const text = candidateSearchText(candidate);
  if (!text) return null;

  const basement = lastMatch(
    text,
    /(?:^|\s)제?\s*(?:(?:지하\s*(\d{1,2})|B\s*(\d{1,2}))\s*층|지층)\s*제?\s*(\d{1,4})\s*호(?=\s|$)/gi
  );
  if (basement) {
    return {
      floor: `B${Number(basement[1] || basement[2] || 1)}`,
      room: String(Number(basement[3])),
      evidence: "CANDIDATE_TEXT_BASEMENT_ROOM"
    };
  }

  const above = lastMatch(
    text,
    /(?:^|\s)제?\s*(\d{1,2})\s*층\s*제?\s*(\d{1,4})\s*호(?=\s|$)/g
  );
  if (!above) return null;
  return {
    floor: String(Number(above[1])),
    room: String(Number(above[2])),
    evidence: "CANDIDATE_TEXT_FLOOR_ROOM"
  };
}

function profileMatches(profile, intent) {
  const matches = [];
  const push = (candidate, strategy) => matches.push({ candidate, strategy, profile });

  const hasStructuralRecovery = Boolean(
    intent.recoveredDong || (intent.floor && intent.room)
  );
  for (const candidate of profile.candidates) {
    // 원문에 더 구체적인 동·층 구조가 있으면 불완전한 호-only 직접일치를
    // 함께 섞지 않는다. 구조정보가 없을 때만 기존 직접표현을 프로파일로 본다.
    if (!hasStructuralRecovery && (intent.dong || intent.ho) &&
        candidateMatchesUnit(candidate, intent.dong, intent.ho)) {
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
      const explicit = candidateExplicitFloorRoom(candidate);
      if (explicit && explicit.floor === intent.floor && explicit.room === intent.room) {
        push(candidate, explicit.evidence === "CANDIDATE_TEXT_BASEMENT_ROOM"
          ? "PROFILE_CANDIDATE_TEXT_BASEMENT_ROOM"
          : "PROFILE_CANDIDATE_TEXT_FLOOR_ROOM");
      }

      const ho = unitKey(candidate?.ho, "ho");
      if (/^B/.test(intent.floor)) {
        if (matchBasementRoom(candidate, intent)) push(candidate, "PROFILE_BASEMENT_ROOM");
      } else {
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
  }

  return matches;
}

export function matchUnitByBuildingProfile(
  candidates,
  rawAddress,
  currentUnit = {},
  expectedBuildingName = "",
  expectedSubBuilding = null
) {
  const intent = extractUnitIntent(rawAddress, currentUnit);
  if (expectedSubBuilding?.kind) intent.subBuilding = expectedSubBuilding;
  const profiles = buildBuildingUnitProfiles(candidates);
  const allMatches = profiles.flatMap((profile) => profileMatches(profile, intent));
  const expected = buildingKey(expectedBuildingName);
  let matches = allMatches;
  let exactBuildingFilterApplied = false;
  let subBuildingFilterApplied = false;

  if (intent.subBuilding?.kind) {
    matches = matches.filter((match) => candidateSupportsSubBuilding(match.candidate, intent.subBuilding));
    subBuildingFilterApplied = true;
  }

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
    exact_building_filter_applied: exactBuildingFilterApplied,
    sub_building_filter_applied: subBuildingFilterApplied
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
