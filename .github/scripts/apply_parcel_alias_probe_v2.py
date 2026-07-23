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
  narrowCandidatesByExplicitParcel
} from "./address-parcel-intent.mjs";
''',
    '''import {
  buildExplicitParcelProbeSpecs,
  narrowCandidatesByExplicitParcel
} from "./address-parcel-intent.mjs";
''',
    "parcel intent import"
)

app = replace_once(
    app,
    '''function lotQuery(pre, ref) {
  return [pre.sidoFull, pre.sgg, pre.eup, ref.legal, ref.lot]
    .filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
}
async function probeExplicitLots(pre, clients, tried) {
''',
    '''function lotQuery(pre, ref) {
  return [pre.sidoFull, pre.sgg, pre.eup, ref.legal, ref.lot]
    .filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
}

// 단일 명시지번이라도 원문에 같은 어간의 현/구 법정동 표기가 함께 있으면
// 각 표기로 정확지번을 직접 조회한다. 후보축소는 이미 받은 후보 안에서만 작동하므로,
// 평산리 조회가 평산동 564 후보를 반환하지 않는 경우를 조회 단계에서 보완한다.
// 원문에 없는 법정동·지번은 만들지 않고, 조회 결과가 한 PNU로 수렴할 때만 사용한다.
async function probeExplicitParcelAliases(pre, clients, tried) {
  const refs = Array.isArray(pre?.lotRefs) ? pre.lotRefs : [];
  if (!refs.length || !clients?.juso) return null;
  const specs = buildExplicitParcelProbeSpecs(pre);
  // 지번별 기본 조회 수보다 명세가 늘어난 경우만 현/구 법정동 별칭 조회 대상이다.
  if (specs.length <= refs.length) return null;

  const allCandidates = [];
  for (const spec of specs) {
    if (!tried.includes(spec.query)) tried.push(spec.query);
    const items = await safeCall(clients.juso, spec.query);
    allCandidates.push(...items.map(fromJuso));
  }
  const source = dedupe(allCandidates).filter((candidate) => candidate?.admCd);
  if (!source.length) return null;

  const narrowed = narrowCandidatesByExplicitParcel(source, {
    raw: pre.raw || "",
    lotRefs: refs
  });
  const fullyMatchedSingleParcel =
    narrowed.diagnostics?.matched_parcel_count === 1 &&
    narrowed.diagnostics?.matched_candidate_count === source.length;
  if (!narrowed.applied && !fullyMatchedSingleParcel) return null;

  const selected = narrowed.candidates;
  const pnus = new Set(selected.map(buildPnu).filter(Boolean));
  if (pnus.size !== 1) return null;
  return {
    candidates: selected,
    level: "M0_PARCEL_ALIAS",
    jusoQuery: tried.join(" ▸ "),
    count: allCandidates.length,
    reviewNeeded: "explicit_parcel_alias_unique",
    addressMatchEvidence: [
      "EXPLICIT_PARCEL_ALIAS_QUERY",
      ...(narrowed.evidence || [])
    ],
    parcelAliasRecovery: true,
    parcelAliasDiagnostics: narrowed.diagnostics
  };
}

async function probeExplicitLots(pre, clients, tried) {
''',
    "alias probe function"
)

app = replace_once(
    app,
    '''  const multiLotProbe = await probeExplicitLots(pre, clients, tried);
  if (multiLotProbe) return multiLotProbe;
''',
    '''  const parcelAliasProbe = await probeExplicitParcelAliases(pre, clients, tried);
  if (parcelAliasProbe) return parcelAliasProbe;
  const multiLotProbe = await probeExplicitLots(pre, clients, tried);
  if (multiLotProbe) return multiLotProbe;
''',
    "alias probe call"
)

app_path.write_text(app, encoding="utf-8")

pipeline_path = Path("public/pipeline-contract.mjs")
pipeline = pipeline_path.read_text(encoding="utf-8")
pipeline = replace_once(
    pipeline,
    'export const PIPELINE_VERSION = "addr-pipeline-v6";',
    'export const PIPELINE_VERSION = "addr-pipeline-v7";',
    "pipeline version"
)
pipeline = replace_once(pipeline, '  JUSO_LOOKUP: "8",', '  JUSO_LOOKUP: "9",', "JUSO version")
pipeline = replace_once(
    pipeline,
    '  EXPLICIT_PARCEL_INTENT: "1"',
    '  EXPLICIT_PARCEL_INTENT: "2"',
    "parcel module version"
)
pipeline_path.write_text(pipeline, encoding="utf-8")

print("parcel alias probe v2 patch applied")
