from pathlib import Path
import re


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected one match, found {count}")
    return text.replace(old, new, 1)


def sub_once(text, pattern, replacement, label, flags=0):
    updated, count = re.subn(pattern, replacement, text, count=1, flags=flags)
    if count != 1:
        raise RuntimeError(f"{label}: expected one match, found {count}")
    return updated


app_path = Path("public/app.js")
app = app_path.read_text(encoding="utf-8")

app = replace_once(
    app,
    '''import {
  canAcceptNaverRegionCorrection,
  isBuildingPartToken,
  shouldEscalateJusoMultiToNaver
} from "./address-recovery-rules.mjs";
''',
    '''import {
  canAcceptNaverRegionCorrection,
  isBuildingPartToken,
  shouldEscalateJusoMultiToNaver
} from "./address-recovery-rules.mjs";
import {
  buildingAnchorMatches,
  isDistinctiveBuildingName,
  isPositivePropagationReview,
  normalizeAttachedAdminSpacing,
  normalizeOwnerKey,
  parseCompactAlphaUnit
} from "./address-quality-rules.mjs";
''',
    "quality rule import"
)

app = replace_once(
    app,
    '  let s = String(text).replace(/\\s+/g, " ").trim();',
    '  let s = normalizeAttachedAdminSpacing(String(text).replace(/\\s+/g, " ").trim());',
    "validation token spacing"
)

old_extract_unit = '''function extractUnit(str) {
  let text = str, dong = null, ho = null;
  text = text.replace(RE_FLOOR, " ");
  const pair = text.match(RE_DONG_HO);
  if (pair) {
    dong = pair[1];
    ho = pair[2];
    text = text.replace(RE_DONG_HO, " ");
  } else {
    const alpha = text.match(RE_ALPHA_DONG_HO) || text.match(RE_ALPHA_DONG_BARE_HO);
    if (alpha) {
      dong = normalizeAlphaDong(alpha[1]);
      ho = alpha[2];
      text = text.replace(RE_ALPHA_DONG_HO, " ").replace(RE_ALPHA_DONG_BARE_HO, " ");
    } else {
      const barePair = text.match(RE_DONG_BARE_HO);
      if (barePair) {
        dong = barePair[1];
        ho = barePair[2];
        text = text.replace(RE_DONG_BARE_HO, " ");
      } else {
        const dongOnly = text.match(RE_DONG_ONLY);
        if (dongOnly) {
          dong = dongOnly[1];
          text = text.replace(RE_DONG_ONLY, " ");
        }
      }
      const hoOnly = text.match(RE_HO_ONLY);
      if (!ho && hoOnly) {
        ho = hoOnly[1];
        text = text.replace(RE_HO_ONLY, " ");
      }
    }
  }
  return { text: text.replace(/\\s+/g, " ").trim(), dong, ho };
}
'''
new_extract_unit = '''function extractUnit(str) {
  let text = str, dong = null, ho = null, floor = null, compactAlpha = false;
  // Q1: 비동4-501 같은 등기부 compact 표기를 행정구역·지번보다 먼저 분리한다.
  // 이동·지동처럼 실제 법정동일 수 있는 표기는 helper 단계에서 제외한다.
  const compact = parseCompactAlphaUnit(text);
  if (compact) {
    dong = compact.dong;
    floor = compact.floor;
    ho = compact.ho;
    compactAlpha = true;
    text = text.replace(compact.matched, " ");
  } else {
    text = text.replace(RE_FLOOR, " ");
    const pair = text.match(RE_DONG_HO);
    if (pair) {
      dong = pair[1];
      ho = pair[2];
      text = text.replace(RE_DONG_HO, " ");
    } else {
      const alpha = text.match(RE_ALPHA_DONG_HO) || text.match(RE_ALPHA_DONG_BARE_HO);
      if (alpha) {
        dong = normalizeAlphaDong(alpha[1]);
        ho = alpha[2];
        text = text.replace(RE_ALPHA_DONG_HO, " ").replace(RE_ALPHA_DONG_BARE_HO, " ");
      } else {
        const barePair = text.match(RE_DONG_BARE_HO);
        if (barePair) {
          dong = barePair[1];
          ho = barePair[2];
          text = text.replace(RE_DONG_BARE_HO, " ");
        } else {
          const dongOnly = text.match(RE_DONG_ONLY);
          if (dongOnly) {
            dong = dongOnly[1];
            text = text.replace(RE_DONG_ONLY, " ");
          }
        }
        const hoOnly = text.match(RE_HO_ONLY);
        if (!ho && hoOnly) {
          ho = hoOnly[1];
          text = text.replace(RE_HO_ONLY, " ");
        }
      }
    }
  }
  return { text: text.replace(/\\s+/g, " ").trim(), dong, ho, floor, compactAlpha };
}
'''
app = replace_once(app, old_extract_unit, new_extract_unit, "compact alpha unit parser")

app = replace_once(
    app,
    '  let { text, dong, ho } = extractUnit(s);',
    '  let { text, dong, ho, floor, compactAlpha } = extractUnit(s);',
    "unit parser destructuring"
)

app = replace_once(
    app,
    '''  const _reg = extractRegion(modernizeSgg(raw));
  const _se = extractSggEmd(raw);
  const _er = extractEupRi(raw);
  const _rd = extractRoadNo(raw);
  const _jc = extractJibunCore(text);
  return {
    cleaned, searchText: text, unit: { dong, ho }, unitCandidate, raw,
    sido: _reg.sido || "",
    sidoFull: sidoFull(raw),
''',
    '''  // compact 알파벳동은 원문에서 제거한 구조문으로 지역·건물명을 해석한다.
  // 일반 주소는 기존 원문을 그대로 사용해 기존 확정행 민감도를 제한한다.
  const structuralRaw = compactAlpha ? text : raw;
  const _reg = extractRegion(modernizeSgg(structuralRaw));
  const _se = extractSggEmd(structuralRaw);
  const _er = extractEupRi(structuralRaw);
  const _rd = extractRoadNo(structuralRaw);
  const _jc = extractJibunCore(text);
  return {
    cleaned: compactAlpha ? text : cleaned,
    searchText: text,
    regionText: structuralRaw,
    unit: { dong, ho, floor: floor || null }, unitCandidate, raw,
    sido: _reg.sido || "",
    sidoFull: sidoFull(structuralRaw),
''',
    "compact structural source"
)
app = replace_once(
    app,
    '    bldName: extractBuildingName(raw)',
    '    bldName: extractBuildingName(structuralRaw)',
    "compact building exclusion"
)

app = app.replace(
    'validateRegion(pre.cleaned, result.jibunAddr, level === "L3", _rel)',
    'validateRegion(pre.regionText || pre.cleaned, result.jibunAddr, level === "L3", _rel)'
)
if app.count('validateRegion(pre.regionText || pre.cleaned, result.jibunAddr, level === "L3", _rel)') != 1:
    raise RuntimeError("validation structural source: expected one replacement")

app = replace_once(
    app,
    '''  if (deduped.length === 0)
    return { status: "FAILED", reason: "NOT_FOUND", message: "일치하는 주소를 찾지 못했습니다. 오타 확인 또는 신축/미등록 필지 여부를 확인해주세요." };''',
    '''  if (deduped.length === 0)
    return { status: "FAILED", reason: "NOT_FOUND", unit, message: "일치하는 주소를 찾지 못했습니다. 오타 확인 또는 신축/미등록 필지 여부를 확인해주세요." };''',
    "preserve unit on not found"
)
app = replace_once(
    app,
    '''    addressMatchEvidence: addressNarrowing.evidence,
    message: buildMessage(requireLevel, dongName, deduped)''',
    '''    addressMatchEvidence: addressNarrowing.evidence,
    unit,
    message: buildMessage(requireLevel, dongName, deduped)''',
    "preserve unit on ambiguous"
)
app = replace_once(
    app,
    '''      status: "SYSTEM_ERROR",
      reason: "SYSTEM_ERROR",
      message: `조회 시스템 오류 — 재시도 필요 (${e?.message || e})`,''',
    '''      status: "SYSTEM_ERROR",
      reason: "SYSTEM_ERROR",
      unit: pre.unit,
      message: `조회 시스템 오류 — 재시도 필요 (${e?.message || e})`,''',
    "preserve unit on system error"
)
app = replace_once(
    app,
    '''      status: "HUMAN_INPUT_ERROR",
      reason: "HUMAN_INPUT_ERROR",
      message: "네이버 정상 조회했으나 결과 없음 — 입력 주소 확인 필요(오타/존재하지 않는 주소)",''',
    '''      status: "HUMAN_INPUT_ERROR",
      reason: "HUMAN_INPUT_ERROR",
      unit: pre.unit,
      message: "네이버 정상 조회했으나 결과 없음 — 입력 주소 확인 필요(오타/존재하지 않는 주소)",''',
    "preserve unit on no-result"
)

app = replace_once(
    app,
    '''function ownerZipPropagationSource(arr) {
  const sourceRow = propagationSource(arr);
  if (!sourceRow || sourceRow.result.reviewNeeded) return null;
  const validationStatus = sourceRow.result.validation?.status;
''',
    '''function ownerZipPropagationSource(arr) {
  const sourceRow = propagationSource(arr);
  if (!sourceRow) return null;
  if (sourceRow.result.reviewNeeded && !isPositivePropagationReview(sourceRow.result.reviewNeeded)) return null;
  const validationStatus = sourceRow.result.validation?.status;
''',
    "positive review propagation source"
)

app = replace_once(
    app,
    '![' + '"주소군전파", "주소군후보교집합", "소유자주소군전파"' + '].includes(x.row.result.source)',
    '![' + '"주소군전파", "주소군후보교집합", "소유자주소군전파", "건물주소군전파"' + '].includes(x.row.result.source)',
    "exclude building propagation as direct source"
)

insert_marker = '''function propagateAddressGroup(rows, groupHints, evidenceFor = null) {
'''
building_functions = '''function collectBuildingAnchorGroups(rows) {
  const groups = new Map();
  for (const row of rows) {
    const raw = String(row?.raw || "");
    if (!raw) continue;
    const p = preprocess(raw);
    if (!p.bldName || !isDistinctiveBuildingName(p.bldName)) continue;
    const owner = normalizeOwnerKey((row.extra || []).find((x) => x && /[가-힣]/.test(String(x))) || "");
    if (!owner) continue;
    const region = extractRegion(p.regionText || p.cleaned || raw);
    const zip = String(row.zip || "").replace(/\.\d+$/, "").replace(/[^0-9]/g, "");
    const scope = zip ? `ZIP:${zip}` : (region.sido ? `SIDO:${region.sido}` : "");
    if (!scope) continue;
    const key = `${scope}|${owner}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({ row, p });
  }
  return groups;
}

function buildingAnchorPropagationSource(arr) {
  const confirmed = arr.filter((x) => {
    const r = x.row.result;
    if (!r || r.status !== "CONFIRMED" || !r.pnu) return false;
    if (["주소군전파", "주소군후보교집합", "소유자주소군전파", "건물주소군전파"].includes(r.source)) return false;
    if (r.validation?.status !== "MATCH") return false;
    if (!isDistinctiveBuildingName(r.bdNm || x.p.bldName)) return false;
    if (!r.reviewNeeded || isPositivePropagationReview(r.reviewNeeded)) return true;
    return r.reviewNeeded === "naver_unverified" && (r.addressMatchEvidence || []).includes("EXACT_ROAD");
  });
  const pnus = new Set(confirmed.map((x) => x.row.result.pnu));
  if (!confirmed.length || pnus.size !== 1) return null;
  confirmed.sort((a, b) => propagationRowKey(a.row).localeCompare(propagationRowKey(b.row)));
  return confirmed[0].row;
}

function propagateBuildingAnchorGroups(rows, evidenceFor = null) {
  const FAIL = new Set(["AMBIGUOUS", "HUMAN_INPUT_ERROR", "VALIDATION_FAILED", "FAILED", "NAVER_CONFIRMED_PNU_FAILED"]);
  let filled = 0;
  for (const [groupKey, arr] of collectBuildingAnchorGroups(rows)) {
    const sourceRow = buildingAnchorPropagationSource(arr);
    if (!sourceRow) continue;
    const src = sourceRow.result;
    const sourceName = src.bdNm || preprocess(sourceRow.raw || "").bldName;
    const groupEvidence = propagationEvidence(`BUILDING|${groupKey}`, arr, sourceRow);
    for (const x of arr) {
      const r = x.row.result;
      const wasPropagated = r?.source === "건물주소군전파";
      if (!r || (!FAIL.has(r.status) && !wasPropagated)) continue;
      if (!buildingAnchorMatches(sourceName, x.p.bldName)) continue;
      const proposal = {
        ...cloneResult(r),
        status: "CONFIRMED",
        jibunAddr: src.jibunAddr,
        roadAddr: src.roadAddr,
        pnu: src.pnu,
        bdMgtSn: src.bdMgtSn,
        bdNm: src.bdNm || x.p.bldName,
        isJip: src.isJip,
        unit: x.p.unit,
        source: "건물주소군전파",
        reviewNeeded: "building_anchor_propagated",
        validation: { status: "MATCH", reason: "동일 소유자·지역·건물명에서 직접 확정 PNU 1종" },
        addressMatchEvidence: [...new Set([...(r.addressMatchEvidence || []), "BUILDING_ANCHOR_UNIQUE_PNU"])],
        ...groupEvidence,
        propagationRuleVersion: "GROUP_PROPAGATION:5"
      };
      const upstreamEvidence = { ...(evidenceFor ? evidenceFor(x.row) : {}), ...groupEvidence };
      x.row.result = attachPipelineMetadata(x.row, proposal, upstreamEvidence);
      filled++;
    }
  }
  return filled;
}

'''
app = replace_once(app, insert_marker, building_functions + insert_marker, "building anchor propagation functions")

app = replace_once(
    app,
    '''  for (const [groupKey, arr] of collectOwnerZipPropagationGroups(rows, groupHints)) {
    const sourceRow = ownerZipPropagationSource(arr);
    if (!sourceRow) continue;
    const evidence = propagationEvidence(groupKey, arr, sourceRow);
    for (const { row } of arr) {
      if (row.result?.source === "소유자주소군전파") {
        evidenceByRow.set(propagationRowKey(row), evidence);
      }
    }
  }
  return evidenceByRow;
''',
    '''  for (const [groupKey, arr] of collectOwnerZipPropagationGroups(rows, groupHints)) {
    const sourceRow = ownerZipPropagationSource(arr);
    if (!sourceRow) continue;
    const evidence = propagationEvidence(groupKey, arr, sourceRow);
    for (const { row } of arr) {
      if (row.result?.source === "소유자주소군전파") {
        evidenceByRow.set(propagationRowKey(row), evidence);
      }
    }
  }
  for (const [groupKey, arr] of collectBuildingAnchorGroups(rows)) {
    const sourceRow = buildingAnchorPropagationSource(arr);
    if (!sourceRow) continue;
    const evidence = propagationEvidence(`BUILDING|${groupKey}`, arr, sourceRow);
    for (const { row } of arr) {
      if (row.result?.source === "건물주소군전파") {
        evidenceByRow.set(propagationRowKey(row), evidence);
      }
    }
  }
  return evidenceByRow;
''',
    "building propagation reuse evidence"
)

app = replace_once(
    app,
    '''    if (!batchStopRef.current) propagateAddressGroup(next, groupHints, evidenceFor);''',
    '''    if (!batchStopRef.current) {
      propagateBuildingAnchorGroups(next, evidenceFor);
      propagateAddressGroup(next, groupHints, evidenceFor);
    }''',
    "building propagation execution"
)

app = replace_once(
    app,
    '''        : r.source === "소유자주소군전파" ? "소유자주소군전파"
        : r.source === "naver" ? "네이버L3"''',
    '''        : r.source === "소유자주소군전파" ? "소유자주소군전파"
        : r.source === "건물주소군전파" ? "건물주소군전파"
        : r.source === "naver" ? "네이버L3"''',
    "building propagation export source"
)

app = replace_once(
    app,
    '''      const r = row.result || {};
      const reg = row.reg;
      const jibun = r.jibunAddr || "";
      const sggM = jibun.match(/(?:특별시|광역시|특별자치시|특별자치도|도)\s+([가-힣]+(?:시|군|구)(?:\s+[가-힣]+구)?)/);''',
    '''      const r = row.result || {};
      const reg = row.reg;
      const validationRejected = r.status === "VALIDATION_FAILED";
      const candidateJibun = r.jibunAddr || "";
      const candidateRoad = r.roadAddr || "";
      const candidatePnu = r.pnu || "";
      const jibun = validationRejected ? "" : candidateJibun;
      const sggM = jibun.match(/(?:특별시|광역시|특별자치시|특별자치도|도)\s+([가-힣]+(?:시|군|구)(?:\s+[가-힣]+구)?)/);''',
    "validation candidate separation"
)
app = replace_once(app, '      const pnu = r.pnu || "";', '      const pnu = validationRejected ? "" : candidatePnu;', "validation PNU separation")
app = replace_once(app, '        road: r.roadAddr || "",', '        road: validationRejected ? "" : candidateRoad,', "validation road separation")
app = replace_once(
    app,
    '''        naverJibun: r.naverJibunAddr || "",
        naverRoad: r.naverRoadAddr || "",
        irosInput: okStatus ? (r.jibunAddr || r.irosQuery || "") : "",''',
    '''        naverJibun: r.naverJibunAddr || "",
        naverRoad: r.naverRoadAddr || "",
        rejectedJibun: validationRejected ? candidateJibun : "",
        rejectedRoad: validationRejected ? candidateRoad : "",
        rejectedPnu: validationRejected ? candidatePnu : "",
        irosInput: okStatus ? (r.jibunAddr || r.irosQuery || "") : "",''',
    "validation diagnostics"
)
app = replace_once(
    app,
    '"주소매칭근거", "네이버지번주소", "네이버도로명주소", "최종IROS입력주소"',
    '"주소매칭근거", "네이버지번주소", "네이버도로명주소", "검증배제후보지번주소", "검증배제후보도로명주소", "검증배제후보PNU", "최종IROS입력주소"',
    "validation diagnostic headers"
)
app = replace_once(
    app,
    '''    rec.naverJibun,
    rec.naverRoad,
    rec.irosInput,''',
    '''    rec.naverJibun,
    rec.naverRoad,
    rec.rejectedJibun,
    rec.rejectedRoad,
    rec.rejectedPnu,
    rec.irosInput,''',
    "validation diagnostic rows"
)

app_path.write_text(app, encoding="utf-8")

admin_path = Path("public/admin-successor.mjs")
admin = admin_path.read_text(encoding="utf-8")
admin = replace_once(admin, 'export const ADMIN_SUCCESSOR_MAP_VERSION = "admin-successor-v2";', 'export const ADMIN_SUCCESSOR_MAP_VERSION = "admin-successor-v3";', "admin map version")
admin = replace_once(
    admin,
    '''  { id: "SGG_INCHEON_SEOGU_GEOMDAN", kind: "SGG", sido: "인천", from: "서구", to: "검단구" },''',
    '''  { id: "SGG_INCHEON_SEOGU_GEOMDAN", kind: "SGG", sido: "인천", from: "서구", to: "검단구" },
  { id: "SGG_INCHEON_SEOGU_SEOHAE", kind: "SGG", sido: "인천", from: "서구", to: "서해구" },
  { id: "SGG_INCHEON_JUNGGU_JEMULPO", kind: "SGG", sido: "인천", from: "중구", to: "제물포구" },
  { id: "SGG_INCHEON_JUNGGU_YEONGJONG", kind: "SGG", sido: "인천", from: "중구", to: "영종구" },
  { id: "SGG_INCHEON_NAMGU_MICHUHOL", kind: "SGG", sido: "인천", from: "남구", to: "미추홀구" },''',
    "explicit Incheon successor rules"
)
admin_path.write_text(admin, encoding="utf-8")

contract_path = Path("public/pipeline-contract.mjs")
contract = contract_path.read_text(encoding="utf-8")
contract = replace_once(contract, 'export const PIPELINE_VERSION = "addr-pipeline-v1";', 'export const PIPELINE_VERSION = "addr-pipeline-v2";', "pipeline version")
contract = replace_once(contract, '  UNIT_PARSE: "6",', '  UNIT_PARSE: "7",', "unit parser module version")
contract = replace_once(contract, '  REGION_VALIDATE: "4",', '  REGION_VALIDATE: "5",', "region validate module version")
contract = replace_once(contract, '  GROUP_PROPAGATION: "4",', '  GROUP_PROPAGATION: "5",', "group propagation module version")
contract = replace_once(contract, '  OLD_ADDRESS: "3"', '  OLD_ADDRESS: "4"', "old address module version")
contract_path.write_text(contract, encoding="utf-8")

integration_path = Path("tests/test_address_recovery_integration.mjs")
integration = integration_path.read_text(encoding="utf-8")
integration = replace_once(
    integration,
    '''    "shouldEscalateJusoMultiToNaver",
    "pendingJusoMulti",''',
    '''    "shouldEscalateJusoMultiToNaver",
    "parseCompactAlphaUnit",
    "normalizeAttachedAdminSpacing",
    "propagateBuildingAnchorGroups",
    "BUILDING_ANCHOR_UNIQUE_PNU",
    "검증배제후보지번주소",
    "pendingJusoMulti",''',
    "integration quality markers"
)
integration_path.write_text(integration, encoding="utf-8")

admin_test_path = Path("tests/test_admin_successor.mjs")
admin_test_path.write_text('''import assert from "node:assert/strict";\nimport test from "node:test";\n\nimport { findAdminSuccessor } from "../public/admin-successor.mjs";\n\ntest("explicit Incheon 2026 successor districts are recognized", () => {\n  assert.equal(findAdminSuccessor("서구", "서해구", "SGG", { sido: "인천" })?.ruleId, "SGG_INCHEON_SEOGU_SEOHAE");\n  assert.equal(findAdminSuccessor("중구", "제물포구", "SGG", { sido: "인천" })?.ruleId, "SGG_INCHEON_JUNGGU_JEMULPO");\n  assert.equal(findAdminSuccessor("중구", "영종구", "SGG", { sido: "인천" })?.ruleId, "SGG_INCHEON_JUNGGU_YEONGJONG");\n  assert.equal(findAdminSuccessor("남구", "미추홀구", "SGG", { sido: "인천" })?.ruleId, "SGG_INCHEON_NAMGU_MICHUHOL");\n  assert.equal(findAdminSuccessor("서구", "서해구", "SGG", { sido: "부산" }), null);\n});\n''', encoding="utf-8")

print("address quality P1 patch applied")
