from pathlib import Path


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected one match, found {count}")
    return text.replace(old, new, 1)


app_path = Path("public/app.js")
app = app_path.read_text(encoding="utf-8")

app = replace_once(
    app,
    '''import {
  buildingAnchorMatches,
  isDistinctiveBuildingName,
  isPositivePropagationReview,
  normalizeAttachedAdminSpacing,
  normalizeOwnerKey,
  parseCompactAlphaUnit
} from "./address-quality-rules.mjs";
''',
    '''import {
  buildingAnchorMatches,
  isDistinctiveBuildingName,
  isPositivePropagationReview,
  normalizeAttachedAdminSpacing,
  normalizeOwnerKey,
  parseCompactAlphaUnit
} from "./address-quality-rules.mjs";
import {
  addressMatchesZipRegions,
  aggregateCandidateKey,
  canAcceptZipBuildingCorrection,
  candidateSupportsDong,
  extractExplicitLotRefs,
  hasOmittedExtraLots,
  isLandMultiProbeEligible,
  isUnitLikeLot,
  ownerSearchKeyword,
  selectAggregateBuildingCandidates
} from "./address-multilot-rules.mjs";
''',
    "multi-lot imports"
)

app = replace_once(
    app,
    '''    buldNo: _rd.buldNo,
    bldName: extractBuildingName(structuralRaw)
''',
    '''    buldNo: _rd.buldNo,
    bldName: extractBuildingName(structuralRaw),
    lotRefs: extractExplicitLotRefs(raw),
    omittedExtraLots: hasOmittedExtraLots(raw)
''',
    "preprocess multi-lot fields"
)

cascade_marker = 'async function cascade(pre, clients) {'
helpers = r'''function lotParts(value) {
  const text = String(value || "").replace(/^산/, "");
  const [main, sub = "0"] = text.split("-");
  return { mountain: String(value || "").startsWith("산"), main, sub };
}
function candidateMatchesLotRef(candidate, ref) {
  const wanted = lotParts(ref?.lot);
  return String(candidate?.mtYn || "0") === (wanted.mountain ? "1" : "0") &&
    Number(candidate?.mnnm) === Number(wanted.main) &&
    Number(candidate?.slno || 0) === Number(wanted.sub || 0);
}
function lotQuery(pre, ref) {
  return [pre.sidoFull, pre.sgg, pre.eup, ref.legal, ref.lot]
    .filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
}
async function probeExplicitLots(pre, clients, tried) {
  const refs = Array.isArray(pre.lotRefs) ? pre.lotRefs : [];
  if (refs.length < 2 || !clients?.juso) return null;
  const probes = [];
  const allCandidates = [];
  for (const ref of refs) {
    const query = lotQuery(pre, ref);
    if (!query) continue;
    if (!tried.includes(query)) tried.push(query);
    const items = await safeCall(clients.juso, query);
    const mapped = items.map(fromJuso);
    const exact = mapped.filter((candidate) => candidateMatchesLotRef(candidate, ref));
    probes.push({ ref, query, mapped, exact });
    allCandidates.push(...mapped);
  }
  if (!allCandidates.length) return null;

  // 동·호/건물명이 있거나 여러 지번이 같은 건물관리번호로 수렴하면 집합건물이다.
  const aggregate = selectAggregateBuildingCandidates(allCandidates, pre.unit);
  if (aggregate.length) {
    const selected = dedupe(aggregate);
    return {
      candidates: selected,
      level: "M1",
      jusoQuery: tried.join(" ▸ "),
      count: allCandidates.length,
      reviewNeeded: "aggregate_multilot_building",
      addressMatchEvidence: ["MULTILOT_BUILDING_CLUSTER"],
      multiLotRecovery: true
    };
  }

  // 순수 토지는 각 명시 지번이 하나의 정확한 PNU로 검증될 때만 행 분리한다.
  if (!isLandMultiProbeEligible({
    raw: pre.raw,
    refs,
    unit: pre.unit,
    buildingName: pre.bldName
  })) return null;
  const parcels = [];
  for (const probe of probes) {
    const exact = dedupe(probe.exact);
    const pnuSet = new Set(exact.map(buildPnu).filter(Boolean));
    if (pnuSet.size !== 1) return null;
    const candidate = exact.find((item) => buildPnu(item)) || exact[0];
    if (!candidate) return null;
    parcels.push({ ref: probe.ref, candidate });
  }
  const distinct = new Set(parcels.map(({ candidate }) => buildPnu(candidate)).filter(Boolean));
  if (distinct.size !== parcels.length) return null;
  return {
    candidates: parcels.map(({ candidate }) => candidate),
    multiParcelCandidates: parcels,
    level: "M1_LAND",
    jusoQuery: tried.join(" ▸ "),
    count: allCandidates.length,
    addressMatchEvidence: ["MULTILOT_LAND_EXACT_PNU"],
    multiLotRecovery: true
  };
}
function ownerOfRow(row) {
  return String(row?.owner || (row?.extra || []).find((value) =>
    value && /[가-힣]/.test(String(value))
  ) || "");
}
function sameInputRegion(pre, address) {
  const input = extractRegion(pre.regionText || pre.cleaned || pre.raw || "");
  const result = extractRegion(address || "");
  if (input.sido && result.sido && input.sido !== result.sido) return false;
  if (input.sgg?.length && result.sgg?.length) {
    const left = input.sgg[0], right = result.sgg[0];
    if (left !== right && !left.includes(right) && !right.includes(left)) return false;
  }
  return Boolean(input.sido || input.sgg?.length);
}
async function recoverOwnerUnitCandidate(pre, clients) {
  const keyword = pre.ownerKeyword || "";
  if (!keyword || !clients?.naverLocal || !(pre.unit?.dong || pre.unit?.ho)) return null;
  const zipRegions = pre.zipcode ? lookupZip(pre.zipcode) : [];
  const zipSggList = zipRegions.map((entry) => String(entry).split("|")[1] || "").filter(Boolean);
  const queries = [...new Set([
    [pre.sgg, pre.eup, pre.emd, keyword].filter(Boolean).join(" "),
    [pre.sgg, pre.emd, keyword].filter(Boolean).join(" "),
    [pre.sgg, keyword].filter(Boolean).join(" "),
    ...zipSggList.map((sgg) => [sgg, keyword].filter(Boolean).join(" "))
  ].filter((query) => query && query !== keyword))];
  const recovered = [];
  const tried = [];
  for (const query of queries) {
    tried.push(`[소유자]${query}`);
    const items = await safeCall(clients.naverLocal, query);
    for (const item of items || []) {
      const shownAddress = item.address || item.roadAddress || "";
      if (!sameInputRegion(pre, shownAddress) && !addressMatchesZipRegions(shownAddress, zipRegions)) continue;
      const naverAddress = item.roadAddress || item.address || "";
      const found = await recoverJusoCandidateForNaver(naverAddress, clients);
      const candidate = found.candidate;
      if (!candidate || !candidate.isJip) continue;
      if (pre.unit?.dong && !candidateSupportsDong(candidate, pre.unit.dong)) continue;
      recovered.push({ candidate, item, found });
    }
  }
  const groups = new Map();
  for (const entry of recovered) {
    const key = aggregateCandidateKey(entry.candidate) || buildPnu(entry.candidate);
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(entry);
  }
  if (groups.size !== 1) return null;
  const entries = [...groups.values()][0];
  const first = entries[0];
  const candidate = { ...first.candidate, source: "owner-unit-recovery" };
  return {
    candidates: [candidate],
    level: "L3_OWNER",
    jusoQuery: tried.join(" ▸ ") + (first.found.query ? ` ▸ [PNU]${first.found.query}` : ""),
    count: entries.length,
    naverAddr: first.item.roadAddress || first.item.address || "",
    naverJibunAddr: first.item.address || "",
    naverRoadAddr: first.item.roadAddress || "",
    naverPnuOk: true,
    zipRegions,
    reviewNeeded: "owner_zip_unit_recovered",
    addressMatchEvidence: ["OWNER_ZIP_UNIT_UNIQUE", ...(first.found.evidence || [])],
    ownerUnitRecovery: true
  };
}

'''
app = replace_once(app, cascade_marker, helpers + cascade_marker, "multi-lot helpers")

app = replace_once(
    app,
    '''  let items = [];
  let pendingJusoMulti = null;
''',
    '''  let items = [];
  let pendingJusoMulti = null;
  const multiLotProbe = await probeExplicitLots(pre, clients, tried);
  if (multiLotProbe) return multiLotProbe;
''',
    "run multi-lot probe"
)

app = replace_once(
    app,
    '''      let zipSggList = [];
      let zipRegions = [];   // ["시도|시군구", ...] 후보검증 지역대조용
      if (!sgg && pre?.zipcode) {
        zipRegions = lookupZip(pre.zipcode);   // ["경기도|의정부시", ...]
        zipSggList = zipRegions.map((zr) => (zr.split("|")[1] || "")).filter(Boolean);
      }
''',
    '''      let zipSggList = [];
      const zipRegions = pre?.zipcode ? lookupZip(pre.zipcode) : [];   // 교정·인접지역 검증에도 사용
      if (!sgg && zipRegions.length) {
        zipSggList = zipRegions.map((zr) => (zr.split("|")[1] || "")).filter(Boolean);
      }
''',
    "always load zip regions"
)

app = replace_once(
    app,
    '''            reviewNeeded: _reviewNeeded,
          };
''',
    '''            reviewNeeded: _reviewNeeded,
            zipRegions,
          };
''',
    "return zip regions"
)

app = replace_once(
    app,
    '''  // 집단 판정(2026-07-17): 지번 뒤 N-M을 배치 전체 분포로 확정한다.
''',
    '''  pre.ownerKeyword = ownerSearchKeyword(owner);
  // 집단 판정(2026-07-17): 지번 뒤 N-M을 배치 전체 분포로 확정한다.
''',
    "owner keyword preprocessing"
)

app = replace_once(
    app,
    '''  const { candidates, level, jusoQuery, count, humanInputError, naverAddr, naverJibunAddr, naverRoadAddr, naverPnuOk } = cascadeResult;
''',
    '''  const firstHadNoCandidates = !(cascadeResult?.candidates || []).length;
  if (firstHadNoCandidates) {
    const unitLike = isUnitLikeLot(pre.jibun);
    const unitAfterMiss = groupHints?.get(groupKeyOf(pre, zipcode, owner) + "|UNIT_AFTER_LOT_MISS") === "UNIT";
    if (unitLike && unitAfterMiss && !pre.unit?.dong && !pre.unit?.ho) {
      pre.unit = unitLike;
      pre.jibun = "";
    }
    if ((pre.unit?.dong || pre.unit?.ho) && !pre.bldName) {
      const recovered = await recoverOwnerUnitCandidate(pre, clients);
      if (recovered) cascadeResult = recovered;
    }
  }
  const {
    candidates, level, jusoQuery, count, humanInputError,
    naverAddr, naverJibunAddr, naverRoadAddr, naverPnuOk,
    multiParcelCandidates, zipRegions = []
  } = cascadeResult;

  if (Array.isArray(multiParcelCandidates) && multiParcelCandidates.length >= 2) {
    const parcelResults = [];
    for (const { ref, candidate } of multiParcelCandidates) {
      const parcelPre = {
        ...pre,
        unit: { dong: null, ho: null },
        jibun: ref.lot,
        emd: ref.legal,
        emdCands: [ref.legal]
      };
      const parcel = resolve([candidate], parcelPre);
      const validation = validateRegion(pre.regionText || pre.cleaned, parcel.jibunAddr, false, candidate.relJibun || "");
      if (parcel.status !== "CONFIRMED" || validation.status === "MISMATCH") {
        return {
          status: "AMBIGUOUS",
          unit: pre.unit,
          candidates: multiParcelCandidates.map(({ candidate: item }) => item),
          searchLevel: level,
          jusoQuery,
          candCount: count,
          message: "복수지번 개별 검증 결과가 일치하지 않아 행 분리를 보류했습니다.",
          validation: { status: "NOT_AVAILABLE", reason: "복수지번 분리 보류", inputSgg: "", resultSgg: "" }
        };
      }
      parcel.validation = validation;
      parcel.source = "juso-land-multilot";
      parcel.reviewNeeded = null;
      parcel.addressMatchEvidence = ["MULTILOT_LAND_EXACT_PNU"];
      parcel.multiLotRecovery = true;
      parcel.parcelRaw = lotQuery(pre, ref);
      parcelResults.push(parcel);
    }
    return {
      status: "CONFIRMED",
      multiParcelResults: parcelResults,
      multiLotRecovery: true,
      source: "juso-land-multilot",
      unit: { dong: null, ho: null },
      searchLevel: level,
      jusoQuery,
      candCount: count,
      validation: { status: "MATCH", reason: "명시된 복수지번을 각각 정확 PNU로 검증", inputSgg: "", resultSgg: "" },
      addressMatchEvidence: ["MULTILOT_LAND_EXACT_PNU"]
    };
  }
''',
    "owner and multi-parcel post cascade"
)

app = replace_once(
    app,
    '''    if (canAcceptNaverRegionCorrection({
      level,
      validation: v,
      naverPnuOk,
      reviewNeeded: result.reviewNeeded,
      addressMatchEvidence: result.addressMatchEvidence,
      inputBuildingName: pre.bldName,
      resultBuildingName: result.bdNm
    })) {
      v.status = "MATCH";
      v.reason = "네이버 단일후보·정확도로·PNU·건물명 일치로 원문 행정동 오류 교정";
      result.addressMatchEvidence = [...new Set([
        ...(result.addressMatchEvidence || []),
        "NAVER_EXACT_ADMIN_CORRECTION"
      ])];
    }
''',
    '''    if (canAcceptNaverRegionCorrection({
      level,
      validation: v,
      naverPnuOk,
      reviewNeeded: result.reviewNeeded,
      addressMatchEvidence: result.addressMatchEvidence,
      inputBuildingName: pre.bldName,
      resultBuildingName: result.bdNm
    })) {
      v.status = "MATCH";
      v.reason = "네이버 단일후보·정확도로·PNU·건물명 일치로 원문 행정동 오류 교정";
      result.addressMatchEvidence = [...new Set([
        ...(result.addressMatchEvidence || []),
        "NAVER_EXACT_ADMIN_CORRECTION"
      ])];
    } else if (canAcceptZipBuildingCorrection({
      validation: v,
      naverPnuOk,
      addressMatchEvidence: result.addressMatchEvidence,
      inputBuildingName: pre.bldName,
      resultBuildingName: result.bdNm,
      resultAddress: result.jibunAddr || result.roadAddr,
      zipRegions
    })) {
      v.status = "MATCH";
      v.reason = "정확 건물명·도로·PNU와 우편번호 지역근거로 인접지역 교정";
      result.reviewNeeded = result.reviewNeeded || "zip_building_region_correction";
      result.addressMatchEvidence = [...new Set([
        ...(result.addressMatchEvidence || []),
        "ZIP_BUILDING_REGION_CORRECTION"
      ])];
    }
''',
    "zip building region correction"
)

# owner field should be used consistently instead of guessing the first Korean extra column.
app = app.replace(
    'String((row.extra || []).find((x) => x && /[가-힣]/.test(String(x))) || "")',
    'ownerOfRow(row)'
)
app = app.replace(
    'normalizeOwnerKey((row.extra || []).find((x) => x && /[가-힣]/.test(String(x))) || "")',
    'normalizeOwnerKey(ownerOfRow(row))'
)

app = replace_once(
    app,
    '''  for (const [key, list] of byEmd) {
    if (list.length < 3) continue;
    const parts = list.map((x) => x.split("-"));
    const normal = parts.filter((x) => x.length === 1 || Number(x[1]) < 100);
    const unitLike = parts.filter((x) => x.length === 2 && Number(x[1]) >= 100);
    // 정상 지번이 있고, 동호 형태가 여럿이며 값이 흩어질 때만
    if (!normal.length || unitLike.length < 2) continue;
    const dongs = new Set(unitLike.map((x) => x[0]));
    if (dongs.size < 2 && unitLike.length < 3) continue;
    out.set(key + "|JIBUN_AS_UNIT", "UNIT");
  }
  return out;
''',
    '''  for (const [key, list] of byEmd) {
    if (list.length < 3) continue;
    const parts = list.map((x) => x.split("-"));
    const normal = parts.filter((x) => x.length === 1 || Number(x[1]) < 100);
    const unitLike = parts.filter((x) => x.length === 2 && Number(x[1]) >= 100);
    // 정상 지번이 있고, 동호 형태가 여럿이며 값이 흩어질 때만
    if (!normal.length || unitLike.length < 2) continue;
    const dongs = new Set(unitLike.map((x) => x[0]));
    if (dongs.size < 2 && unitLike.length < 3) continue;
    out.set(key + "|JIBUN_AS_UNIT", "UNIT");
  }
  // 정상 지번 기준행이 없어도, 같은 소유자·우편번호 그룹의 N-M이 여러 세대로
  // 흩어지면 '지번으로 먼저 조회하고 0건일 때만' 동·호로 재해석한다.
  const afterMiss = new Map();
  for (const row of rows) {
    const p = preprocess(String(row?.raw || ""));
    const unit = isUnitLikeLot(p.jibun);
    if (!unit || p.unit?.dong || p.unit?.ho || p.bldName) continue;
    const key = groupKeyOf(p, row.zip, ownerOfRow(row));
    if (!afterMiss.has(key)) afterMiss.set(key, []);
    afterMiss.get(key).push(unit);
  }
  for (const [key, units] of afterMiss) {
    if (units.length < 3) continue;
    const dongs = new Set(units.map((unit) => unit.dong));
    const hos = new Set(units.map((unit) => unit.ho));
    if (dongs.size < 2 && hos.size < 3) continue;
    out.set(key + "|UNIT_AFTER_LOT_MISS", "UNIT");
  }
  return out;
''',
    "unit fallback after lot miss"
)

expand_marker = 'const MOCK_JUSO_DB = ['
expand_helper = r'''function expandResolvedMultiParcelRows(rows, evidenceFor = null) {
  const expanded = [];
  for (const row of rows) {
    const parcels = row.result?.multiParcelResults;
    if (!Array.isArray(parcels) || parcels.length < 2) {
      expanded.push(row);
      continue;
    }
    for (let index = 0; index < parcels.length; index++) {
      const parcel = { ...cloneResult(parcels[index]) };
      delete parcel.multiParcelResults;
      const child = {
        ...row,
        rowId: `${row.rowId || "row"}-parcel-${index + 1}`,
        raw: parcel.parcelRaw || row.raw,
        sourceRaw: row.raw,
        result: null
      };
      delete parcel.parcelRaw;
      child.result = attachPipelineMetadata(
        child,
        parcel,
        evidenceFor ? evidenceFor(child) : {}
      );
      expanded.push(child);
    }
  }
  return expanded;
}

'''
app = replace_once(app, expand_marker, expand_helper + expand_marker, "multi-parcel row expansion")

app = replace_once(
    app,
    '''      const zipColIdx = findColIdx(header0, [/우편\s*번호|우편|zip/i]);
''',
    '''      const zipColIdx = findColIdx(header0, [/우편\s*번호|우편|zip/i]);
      const ownerColIdx = findColIdx(header0, [/소유자\s*명|소유자|소유인|채무자\s*명/]);
''',
    "owner column detection"
)

app = replace_once(
    app,
    '''          const zip = zipColIdx >= 0 ? String(r[zipColIdx] ?? "").trim() : "";
          // W9: 순수 토지 복수지번은 지번마다 행 분리. extra(업로드 원본열)는 각 행에 복제.
''',
    '''          const zip = zipColIdx >= 0 ? String(r[zipColIdx] ?? "").trim() : "";
          const owner = ownerColIdx >= 0
            ? String(r[ownerColIdx] ?? "").trim()
            : String(extra.find((value) => value && /[가-힣]/.test(String(value))) || "");
          // W9: 순수 토지 복수지번은 API로 각 지번을 검증한 뒤에만 행 분리한다.
''',
    "owner field construction"
)

app = app.replace(
    'raw, extra, zip, result: null,\n              unitOverride:',
    'raw, extra, zip, owner, result: null,\n              unitOverride:'
)
app = app.replace(
    'raw: sraw, extra, zip, result: null',
    'raw: sraw, extra, zip, owner, result: null'
)

app = replace_once(
    app,
    '''    const next = rows.map((row) => ({
''',
    '''    let next = rows.map((row) => ({
''',
    "mutable batch rows"
)

app = app.replace(
    '(next[idxs[0]].extra || []).find((x) => x && /[가-힣]/.test(String(x))) || ""',
    'ownerOfRow(next[idxs[0]])'
)

app = replace_once(
    app,
    '''    if (!batchStopRef.current) {
      propagateBuildingAnchorGroups(next, evidenceFor);
      propagateAddressGroup(next, groupHints, evidenceFor);
    }
''',
    '''    if (!batchStopRef.current) {
      next = expandResolvedMultiParcelRows(next, evidenceFor);
      propagateBuildingAnchorGroups(next, evidenceFor);
      propagateAddressGroup(next, groupHints, evidenceFor);
    }
''',
    "expand land rows before propagation"
)

app_path.write_text(app, encoding="utf-8")

contract_path = Path("public/pipeline-contract.mjs")
contract = contract_path.read_text(encoding="utf-8")
contract = replace_once(contract, 'export const PIPELINE_VERSION = "addr-pipeline-v2";', 'export const PIPELINE_VERSION = "addr-pipeline-v3";', "pipeline version")
contract = replace_once(contract, '  JUSO_LOOKUP: "4",', '  JUSO_LOOKUP: "5",', "juso module version")
contract = replace_once(contract, '  NAVER_RECOVERY: "4",', '  NAVER_RECOVERY: "5",', "naver module version")
contract = replace_once(contract, '  REGION_VALIDATE: "5",', '  REGION_VALIDATE: "6",', "region module version")
contract = replace_once(contract, '  GROUP_HINT: "2",', '  GROUP_HINT: "3",', "group hint version")
contract = replace_once(contract, '  OLD_ADDRESS: "4"', '  OLD_ADDRESS: "4",\n  MULTILOT_RECOVERY: "1",\n  OWNER_UNIT_RECOVERY: "1"', "new module versions")
contract = replace_once(
    contract,
    '''  if (upstreamEvidence.oldAddressMap || result?.validation?.oldAddressMap) modules.push("OLD_ADDRESS");
  return [...new Set(modules)].sort();
''',
    '''  if (upstreamEvidence.oldAddressMap || result?.validation?.oldAddressMap) modules.push("OLD_ADDRESS");
  if (result?.multiLotRecovery || result?.source === "juso-land-multilot") modules.push("MULTILOT_RECOVERY");
  if (result?.ownerUnitRecovery || result?.source === "owner-unit-recovery") modules.push("OWNER_UNIT_RECOVERY");
  return [...new Set(modules)].sort();
''',
    "applied recovery modules"
)
contract_path.write_text(contract, encoding="utf-8")

integration_path = Path("tests/test_address_recovery_integration.mjs")
integration = integration_path.read_text(encoding="utf-8")
integration = replace_once(
    integration,
    '''    "parseCompactAlphaUnit",
    "normalizeAttachedAdminSpacing",
''',
    '''    "parseCompactAlphaUnit",
    "normalizeAttachedAdminSpacing",
    "probeExplicitLots",
    "recoverOwnerUnitCandidate",
    "UNIT_AFTER_LOT_MISS",
    "MULTILOT_LAND_EXACT_PNU",
    "ZIP_BUILDING_REGION_CORRECTION",
''',
    "P2 integration markers"
)
integration_path.write_text(integration, encoding="utf-8")

print("address multi-lot P2 patch applied")
