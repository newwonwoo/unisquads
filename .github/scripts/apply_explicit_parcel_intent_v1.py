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
  narrowCandidatesByBuildingIntent
} from "./building-candidate-intent.mjs";
''',
    '''import {
  narrowCandidatesByBuildingIntent
} from "./building-candidate-intent.mjs";
import {
  narrowCandidatesByExplicitParcel
} from "./address-parcel-intent.mjs";
''',
    "parcel intent import"
)

app = replace_once(
    app,
    '''  const addressNarrowing = exactAddressCandidates(deduped, pre);
  deduped = addressNarrowing.candidates;
  const addressEvidence = [...addressNarrowing.evidence];
  // 동일 지번의 본동·상가동·관리동 후보는 주소 문자열만으로 구분하지 않는다.
  // 원문의 명시적 동/하위건물 의도와 JUSO bdKdcd·detBdNmList를 공통 모듈에서
  // 대조해 단일 후보로 줄어들 때만 확정한다. 의도가 없으면 복수후보를 유지한다.
  const buildingIntentNarrowing = narrowCandidatesByBuildingIntent(deduped, {
    dong: unit?.dong || "",
    subBuilding: pre?.subBuilding || null,
    buildingName: pre?.bldName || ""
  });
  if (buildingIntentNarrowing.applied) {
    deduped = buildingIntentNarrowing.candidates;
    addressEvidence.push(...buildingIntentNarrowing.evidence);
  }
''',
    '''  const addressNarrowing = exactAddressCandidates(deduped, pre);
  deduped = addressNarrowing.candidates;
  const addressEvidence = [...addressNarrowing.evidence];

  // 원문에 명시된 법정동+지번을 독립적인 필지 의도로 사용한다. 옛 리와 현재 동이
  // 원문에 함께 적힌 경우처럼 동일 어간의 두 표기가 동시에 존재할 때만 교차표기를
  // 허용하며, 정확히 한 필지군으로 수렴하지 않으면 후보를 줄이지 않는다.
  const explicitParcelNarrowing = narrowCandidatesByExplicitParcel(deduped, {
    raw: pre?.raw || "",
    lotRefs: pre?.lotRefs || []
  });
  if (explicitParcelNarrowing.applied) {
    deduped = explicitParcelNarrowing.candidates;
    addressEvidence.push(...explicitParcelNarrowing.evidence);
  }

  // 동일 지번의 본동·상가동·관리동 후보는 주소 문자열만으로 구분하지 않는다.
  // 원문의 명시적 동/하위건물 의도와 JUSO bdKdcd·detBdNmList를 공통 모듈에서
  // 대조해 단일 후보로 줄어들 때만 확정한다. 의도가 없으면 복수후보를 유지한다.
  const buildingIntentNarrowing = narrowCandidatesByBuildingIntent(deduped, {
    dong: unit?.dong || "",
    subBuilding: pre?.subBuilding || null,
    buildingName: pre?.bldName || ""
  });
  if (buildingIntentNarrowing.applied) {
    deduped = buildingIntentNarrowing.candidates;
    addressEvidence.push(...buildingIntentNarrowing.evidence);
  }
  const candidateIntentDiagnostics = {
    parcel: explicitParcelNarrowing.diagnostics,
    building: buildingIntentNarrowing.diagnostics
  };
''',
    "parcel before building intent"
)

app = replace_once(
    app,
    '''      isJip: !!c.isJip,
      addressMatchEvidence: addressEvidence
''',
    '''      isJip: !!c.isJip,
      addressMatchEvidence: addressEvidence,
      candidateIntentDiagnostics
''',
    "single candidate diagnostics"
)

app = replace_once(
    app,
    '''        isJip: !!cand.isJip, reviewNeeded: "bldname_matched",
        addressMatchEvidence: addressEvidence
''',
    '''        isJip: !!cand.isJip, reviewNeeded: "bldname_matched",
        addressMatchEvidence: addressEvidence,
        candidateIntentDiagnostics
''',
    "building match diagnostics"
)

app = replace_once(
    app,
    '''      reviewNeeded: "juso_multi",
      addressMatchEvidence: addressEvidence
''',
    '''      reviewNeeded: "juso_multi",
      addressMatchEvidence: addressEvidence,
      candidateIntentDiagnostics
''',
    "same PNU diagnostics"
)

app = replace_once(
    app,
    '''    addressMatchEvidence: addressEvidence,
    unit,
    subBuilding: pre?.subBuilding || null,
''',
    '''    addressMatchEvidence: addressEvidence,
    candidateIntentDiagnostics,
    unit,
    subBuilding: pre?.subBuilding || null,
''',
    "ambiguous diagnostics"
)

app_path.write_text(app, encoding="utf-8")

pipeline_path = Path("public/pipeline-contract.mjs")
pipeline = pipeline_path.read_text(encoding="utf-8")
pipeline = replace_once(
    pipeline,
    'export const PIPELINE_VERSION = "addr-pipeline-v5";',
    'export const PIPELINE_VERSION = "addr-pipeline-v6";',
    "pipeline version"
)
pipeline = replace_once(pipeline, '  JUSO_LOOKUP: "7",', '  JUSO_LOOKUP: "8",', "JUSO version")
pipeline = replace_once(
    pipeline,
    '  BUILDING_CANDIDATE_INTENT: "1"',
    '  BUILDING_CANDIDATE_INTENT: "1",\n  EXPLICIT_PARCEL_INTENT: "1"',
    "parcel module version"
)
pipeline_path.write_text(pipeline, encoding="utf-8")

print("explicit parcel intent v1 patch applied")
