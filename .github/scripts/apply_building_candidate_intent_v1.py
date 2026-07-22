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
  extractSubBuildingIntent,
  floorIntentFromText,
  narrowByExplicitSubBuilding
} from "./address-subbuilding-rules.mjs";
''',
    '''import {
  extractSubBuildingIntent,
  floorIntentFromText
} from "./address-subbuilding-rules.mjs";
import {
  narrowCandidatesByBuildingIntent
} from "./building-candidate-intent.mjs";
''',
    "building intent import"
)

app = replace_once(
    app,
    '''    bdMgtSn: item.bdMgtSn ?? null,
    bdNm: item.bdNm ?? "",
    detBdNmList: item.detBdNmList ?? "",   // 동 목록(부개동류 동호 검증용)
    relJibun: item.relJibun ?? "",         // 관련지번(어달동류 옛/현 지번 연결)
    pnuOk: true,   // juso에서 왔으므로 PNU 확보 가능
    // juso bdKdcd: "1"=공동주택(아파트·연립·다세대), "0"=일반건물
    isJip: item.bdKdcd === "1" || /아파트|빌라|연립|다세대|오피스텔|맨션|타운|팰리스|캐슬|자이|힐스|푸르지오/.test(item.bdNm ?? ""),
    source: "juso"
''',
    '''    bdMgtSn: item.bdMgtSn ?? null,
    bdNm: item.bdNm ?? "",
    bdKdcd: item.bdKdcd ?? "",
    detBdNmList: item.detBdNmList ?? "",   // 동·상가·관리동 등 상세건물 목록
    relJibun: item.relJibun ?? "",         // 관련지번(어달동류 옛/현 지번 연결)
    pnuOk: true,   // juso에서 왔으므로 PNU 확보 가능
    // bdKdcd가 명시되면 그 값을 우선한다. 상가 후보의 건물명에 '아파트'가
    // 포함돼도 bdKdcd=0이면 공동주택 본동으로 오인하지 않는다.
    isJip: item.bdKdcd === "1" ? true : item.bdKdcd === "0" ? false :
      /아파트|빌라|연립|다세대|오피스텔|맨션|타운|팰리스|캐슬|자이|힐스|푸르지오/.test(item.bdNm ?? ""),
    source: "juso"
''',
    "preserve building kind"
)

app = replace_once(
    app,
    '''  const addressNarrowing = exactAddressCandidates(deduped, pre);
  deduped = addressNarrowing.candidates;
  const addressEvidence = [...addressNarrowing.evidence];
  const subBuildingNarrowing = narrowByExplicitSubBuilding(deduped, pre?.subBuilding);
  if (subBuildingNarrowing.applied) {
    deduped = subBuildingNarrowing.candidates;
    addressEvidence.push(subBuildingNarrowing.evidence);
  }
''',
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
    "building candidate narrowing"
)

app_path.write_text(app, encoding="utf-8")

pipeline_path = Path("public/pipeline-contract.mjs")
pipeline = pipeline_path.read_text(encoding="utf-8")
pipeline = replace_once(pipeline, 'export const PIPELINE_VERSION = "addr-pipeline-v4";',
                        'export const PIPELINE_VERSION = "addr-pipeline-v5";', "pipeline version")
pipeline = replace_once(pipeline, '  JUSO_LOOKUP: "6",', '  JUSO_LOOKUP: "7",', "JUSO version")
pipeline = replace_once(pipeline, '  SUB_BUILDING: "1"',
                        '  SUB_BUILDING: "2",\n  BUILDING_CANDIDATE_INTENT: "1"', "building intent module")
pipeline_path.write_text(pipeline, encoding="utf-8")

contracts = {
    "tests/test_subbuilding_app_contract.mjs": (
        'narrowByExplicitSubBuilding(deduped, pre?.subBuilding)',
        'narrowCandidatesByBuildingIntent(deduped, {'
    ),
    "tests/test_iros_hardening.mjs": (
        '"narrowByExplicitSubBuilding",',
        '"narrowCandidatesByBuildingIntent",'
    )
}
for filename, (old, new) in contracts.items():
    path = Path(filename)
    text = path.read_text(encoding="utf-8")
    text = replace_once(text, old, new, filename)
    path.write_text(text, encoding="utf-8")

print("building candidate intent v1 patch applied")
