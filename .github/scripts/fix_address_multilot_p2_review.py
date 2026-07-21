from pathlib import Path
import re


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected one match, found {count}")
    return text.replace(old, new, 1)


def sub_once(text, pattern, replacement, label):
    updated, count = re.subn(pattern, replacement, text, count=1, flags=re.S)
    if count != 1:
        raise RuntimeError(f"{label}: expected one match, found {count}")
    return updated


app_path = Path("public/app.js")
app = app_path.read_text(encoding="utf-8")

app = replace_once(
    app,
    '''  const aggregate = selectAggregateBuildingCandidates(allCandidates, pre.unit);
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
''',
    '''  const aggregate = selectAggregateBuildingCandidates(allCandidates, pre.unit);
  const hasBuildingStructure = Boolean(pre.unit?.dong || pre.unit?.ho || pre.bldName);
  const aggregateKey = aggregate.length ? aggregateCandidateKey(aggregate[0]) : "";
  const contributingProbes = aggregateKey
    ? probes.filter((probe) => probe.mapped.some((candidate) => aggregateCandidateKey(candidate) === aggregateKey)).length
    : 0;
  // 동·호/건물명이 있으면 한 지번에서만 건물이 확인돼도 집합건물 경로가 타당하다.
  // 그런 단서가 없으면 최소 두 개의 명시 지번이 같은 건물로 수렴해야 토지 오인을 막는다.
  if (aggregate.length && (hasBuildingStructure || contributingProbes >= 2)) {
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
''',
    "aggregate building sensitivity"
)

owner_function = r'''const ownerRecoveryCache = new Map();
async function recoverOwnerUnitCandidate(pre, clients) {
  const keyword = pre.ownerKeyword || "";
  if (!keyword || !clients?.naverLocal || !(pre.unit?.dong || pre.unit?.ho)) return null;
  const zipRegions = pre.zipcode ? lookupZip(pre.zipcode) : [];
  const zipSggList = zipRegions.map((entry) => String(entry).split("|")[1] || "").filter(Boolean);
  const cacheKey = [pre.sgg, pre.eup, pre.emd, keyword, pre.zipcode || ""].join("|");
  let recovered = ownerRecoveryCache.get(cacheKey);
  if (!recovered) {
    const queries = [...new Set([
      [pre.sgg, pre.eup, pre.emd, keyword].filter(Boolean).join(" "),
      [pre.sgg, pre.emd, keyword].filter(Boolean).join(" "),
      [pre.sgg, keyword].filter(Boolean).join(" "),
      ...zipSggList.map((sgg) => [sgg, keyword].filter(Boolean).join(" "))
    ].filter((query) => query && query !== keyword))];
    recovered = [];
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
        recovered.push({ candidate, item, found, tried: [...tried] });
      }
    }
    ownerRecoveryCache.set(cacheKey, recovered);
  }
  const unitMatched = recovered.filter((entry) =>
    !pre.unit?.dong || candidateSupportsDong(entry.candidate, pre.unit.dong)
  );
  const groups = new Map();
  for (const entry of unitMatched) {
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
    jusoQuery: (first.tried || []).join(" ▸ ") + (first.found.query ? ` ▸ [PNU]${first.found.query}` : ""),
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

async function cascade'''
app = sub_once(
    app,
    r'async function recoverOwnerUnitCandidate\(pre, clients\) \{.*?\n\}\n\nasync function cascade',
    owner_function,
    "cached owner recovery"
)

app = replace_once(
    app,
    '''function groupKeyOf(pre, zip, owner) {
  const z = String(zip || "").replace(/\.\d+$/, "").replace(/[^0-9]/g, "");
  const o = String(owner || "");
  return (z && o) ? (z + "|" + o) : [pre.sgg, pre.emd].join("|");
}
''',
    '''function groupKeyOf(pre, zip, owner) {
  const z = String(zip || "").replace(/\.\d+$/, "").replace(/[^0-9]/g, "");
  const o = normalizeOwnerKey(owner);
  return (z && o) ? (z + "|" + o) : [pre.sgg, pre.emd].join("|");
}
''',
    "normalized owner group key"
)

app = replace_once(
    app,
    '''function pipelineEvidenceForRow(row, groupHints, dongsoAnchors) {
  const p = preprocess(String(row?.raw || ""));
  const owner = String((row?.extra || []).find((x) => x && /[가-힣]/.test(String(x))) || "");
  const directHint = groupHints?.get([p.sgg, p.emd, p.jibun].join("|")) || "";
  const unitHint = groupHints?.get(groupKeyOf(p, row?.zip, owner) + "|JIBUN_AS_UNIT") || "";
''',
    '''function pipelineEvidenceForRow(row, groupHints, dongsoAnchors) {
  const p = preprocess(String(row?.raw || ""));
  const owner = ownerOfRow(row);
  const directHint = groupHints?.get([p.sgg, p.emd, p.jibun].join("|")) || "";
  const unitHint = groupHints?.get(groupKeyOf(p, row?.zip, owner) + "|JIBUN_AS_UNIT") || "";
  const unitAfterMissHint = groupHints?.get(groupKeyOf(p, row?.zip, owner) + "|UNIT_AFTER_LOT_MISS") || "";
''',
    "pipeline owner evidence"
)
app = replace_once(
    app,
    '''    groupHints: [directHint, unitHint].filter(Boolean).join("|"),
''',
    '''    groupHints: [directHint, unitHint, unitAfterMissHint].filter(Boolean).join("|"),
''',
    "pipeline unit miss evidence"
)

app = replace_once(
    app,
    '''  result.naverAddr = naverAddr || "";
  result.naverJibunAddr = naverJibunAddr || "";
  result.naverRoadAddr = naverRoadAddr || "";
''',
    '''  result.naverAddr = naverAddr || "";
  result.naverJibunAddr = naverJibunAddr || "";
  result.naverRoadAddr = naverRoadAddr || "";
  result.multiLotRecovery = cascadeResult.multiLotRecovery === true;
  result.ownerUnitRecovery = cascadeResult.ownerUnitRecovery === true;
''',
    "recovery result metadata"
)

app = sub_once(
    app,
    r'function splitRowsForBatch\(raw\) \{.*?\n\}\nfunction preprocess\(raw\)',
    '''function splitRowsForBatch(raw) {
  // 복수지번은 업로드 단계 정규식만으로 나누지 않는다.
  // JUSO로 각 지번을 검증한 뒤 서로 다른 정확 PNU가 확인된 경우에만 행 분리한다.
  return [raw];
}
function preprocess(raw)''',
    "disable pre-validation lot splitting"
)

app_path.write_text(app, encoding="utf-8")

integration_path = Path("tests/test_address_recovery_integration.mjs")
integration = integration_path.read_text(encoding="utf-8")
integration = replace_once(
    integration,
    '''    "probeExplicitLots",
    "recoverOwnerUnitCandidate",
''',
    '''    "probeExplicitLots",
    "recoverOwnerUnitCandidate",
    "ownerRecoveryCache",
    "복수지번은 업로드 단계 정규식만으로 나누지 않는다.",
    "contributingProbes >= 2",
''',
    "review hardening markers"
)
integration_path.write_text(integration, encoding="utf-8")

print("P2 review hardening applied")
