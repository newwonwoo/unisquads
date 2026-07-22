from pathlib import Path
import subprocess


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected one match, found {count}")
    return text.replace(old, new, 1)


# Restore the complete unit matcher from main, then bump only the changed matcher contract.
unit = subprocess.check_output(
    ["git", "show", "origin/main:public/unit-match.mjs"], text=True
)
unit = replace_once(unit, 'export const MATCHER_VERSION = "iros-matcher-v7";',
                    'export const MATCHER_VERSION = "iros-matcher-v8";', "matcher version")
unit = replace_once(unit, '  R_IROS_UNIT_PROFILE: "1"',
                    '  R_IROS_UNIT_PROFILE: "2"', "profile module version")
Path("public/unit-match.mjs").write_text(unit, encoding="utf-8")

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
  extractSubBuildingIntent,
  floorIntentFromText,
  narrowByExplicitSubBuilding
} from "./address-subbuilding-rules.mjs";
''',
    "sub-building imports"
)

app = replace_once(
    app,
    'const RE_DONG_BARE_HO = /(?:^|\\s)제?\\s*(\\d{1,4})\\s*동\\s+(\\d{2,5}(?:-\\d{1,4})?)(?=\\s|$)/;',
    'const RE_DONG_BARE_HO = /(?:^|\\s)제?\\s*(\\d{1,4})\\s*동\\s*(\\d{2,5}(?:-\\d{1,4})?)(?=\\s|$)/;',
    "attached numeric dong room"
)

app = replace_once(
    app,
    '''  } else {
    text = text.replace(RE_FLOOR, " ");
    const pair = text.match(RE_DONG_HO);''',
    '''  } else {
    floor = floorIntentFromText(text) || null;
    text = text.replace(RE_FLOOR, " ");
    const pair = text.match(RE_DONG_HO);''',
    "preserve explicit floor"
)

app = replace_once(
    app,
    '''    bldName: extractBuildingName(structuralRaw),
    lotRefs: extractExplicitLotRefs(raw),''',
    '''    bldName: extractBuildingName(structuralRaw),
    subBuilding: extractSubBuildingIntent(raw),
    lotRefs: extractExplicitLotRefs(raw),''',
    "preprocess sub-building"
)

app = replace_once(
    app,
    '''  const addressNarrowing = exactAddressCandidates(deduped, pre);
  deduped = addressNarrowing.candidates;
  if (deduped.length === 1) {''',
    '''  const addressNarrowing = exactAddressCandidates(deduped, pre);
  deduped = addressNarrowing.candidates;
  const addressEvidence = [...addressNarrowing.evidence];
  const subBuildingNarrowing = narrowByExplicitSubBuilding(deduped, pre?.subBuilding);
  if (subBuildingNarrowing.applied) {
    deduped = subBuildingNarrowing.candidates;
    addressEvidence.push(subBuildingNarrowing.evidence);
  }
  if (deduped.length === 1) {''',
    "explicit sub-building narrowing"
)

# Restrict replacements to the resolve section by replacing the four remaining references.
resolve_start = app.index("function resolve(candidates, pre)")
resolve_end = app.index("// R9(2026-07-17) 동소", resolve_start)
resolve = app[resolve_start:resolve_end]
count = resolve.count("addressNarrowing.evidence")
if count != 4:
    raise RuntimeError(f"resolve evidence references: expected 4, found {count}")
resolve = resolve.replace("addressNarrowing.evidence", "addressEvidence")
app = app[:resolve_start] + resolve + app[resolve_end:]

app = replace_once(
    app,
    '''      unit,
      irosQuery: buildIrosQuery(c, unit),
      source: c.source,''',
    '''      unit,
      subBuilding: pre?.subBuilding || null,
      irosQuery: buildIrosQuery(c, unit),
      source: c.source,''',
    "direct confirmed sub-building"
)

app = replace_once(
    app,
    '''        unit, irosQuery: buildIrosQuery(cand, unit), source: cand.source,
        isJip: !!cand.isJip, reviewNeeded: "bldname_matched",''',
    '''        unit, subBuilding: pre?.subBuilding || null,
        irosQuery: buildIrosQuery(cand, unit), source: cand.source,
        isJip: !!cand.isJip, reviewNeeded: "bldname_matched",''',
    "building matched sub-building"
)

app = replace_once(
    app,
    '''      unit,
      irosQuery: buildIrosQuery(rep, unit),
      source: rep.source,''',
    '''      unit,
      subBuilding: pre?.subBuilding || null,
      irosQuery: buildIrosQuery(rep, unit),
      source: rep.source,''',
    "same PNU sub-building"
)

app = replace_once(
    app,
    '''    addressMatchEvidence: addressEvidence,
    unit,
    message: buildMessage(requireLevel, dongName, deduped)''',
    '''    addressMatchEvidence: addressEvidence,
    unit,
    subBuilding: pre?.subBuilding || null,
    message: buildMessage(requireLevel, dongName, deduped)''',
    "ambiguous sub-building"
)

app = replace_once(
    app,
    '''          row.result.unit || {},
          row.result.bdNm || ""
        );''',
    '''          row.result.unit || {},
          row.result.bdNm || "",
          row.result.subBuilding || null
        );''',
    "IROS sub-building profile input"
)

app_path.write_text(app, encoding="utf-8")

run_path = Path("public/iros-run-contract.mjs")
run = run_path.read_text(encoding="utf-8")
run = replace_once(run, '  matcher: "iros-matcher-v7",', '  matcher: "iros-matcher-v8",', "run matcher")
run = replace_once(run, '  recovery: "iros-recovery-v4"', '  recovery: "iros-recovery-v5"', "run recovery")
run_path.write_text(run, encoding="utf-8")

pipeline_path = Path("public/pipeline-contract.mjs")
pipeline = pipeline_path.read_text(encoding="utf-8")
pipeline = replace_once(pipeline, 'export const PIPELINE_VERSION = "addr-pipeline-v3";',
                        'export const PIPELINE_VERSION = "addr-pipeline-v4";', "pipeline version")
pipeline = replace_once(pipeline, '  UNIT_PARSE: "7",', '  UNIT_PARSE: "8",', "unit parser version")
pipeline = replace_once(pipeline, '  JUSO_LOOKUP: "5",', '  JUSO_LOOKUP: "6",', "JUSO narrowing version")
pipeline = replace_once(pipeline, '  OWNER_UNIT_RECOVERY: "1"',
                        '  OWNER_UNIT_RECOVERY: "1",\n  SUB_BUILDING: "1"', "sub-building module")
pipeline_path.write_text(pipeline, encoding="utf-8")

hardening_path = Path("tests/test_iros_hardening.mjs")
hardening = hardening_path.read_text(encoding="utf-8")
hardening = replace_once(
    hardening,
    '''    "R-IROS-UNIT-PROFILE",
    "unit_profile_recovery",''',
    '''    "R-IROS-UNIT-PROFILE",
    "unit_profile_recovery",
    "subBuilding: pre?.subBuilding || null",
    "narrowByExplicitSubBuilding",''',
    "hardening markers"
)
hardening_path.write_text(hardening, encoding="utf-8")

print("commercial sub-building v4 patch applied")
