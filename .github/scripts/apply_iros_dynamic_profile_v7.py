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
    '''  matchedCandidateUnitVariant,
  rawUnitRecoverySignature,
  selectUniqueRawUnitCandidate,
  unitKey
} from "./unit-match.mjs";
''',
    '''  matchedCandidateUnitVariant,
  unitKey
} from "./unit-match.mjs";
import {
  matchUnitByBuildingProfile,
  unitIntentSignature
} from "./iros-unit-profile.mjs";
''',
    "dynamic profile imports"
)

app = replace_once(
    app,
    '''      const unitCandidatePool = cands;
      let rawUnitRecovery = null;
''',
    '''      const unitCandidatePool = cands;
      let unitProfileRecovery = null;
''',
    "profile audit declaration"
)

old_fallback = '''      // R-IROS-RAW-UNIT: 기존 동·호 결과가 단일 한 건이 아닐 때만 원문의
      // N-M호 또는 N층M호 구조를 보조증거로 사용한다. 여러 표기가 서로 다른
      // 고유번호를 가리키면 확정하지 않는다.
      if ((wantDong || wantHo) && cands.length !== 1) {
        const recovered = selectUniqueRawUnitCandidate(
          unitCandidatePool,
          row.raw,
          row.result.unit || {}
        );
        if (recovered) {
          cands = [recovered.candidate];
          rawUnitRecovery = {
            source: recovered.variant.source,
            dong: recovered.variant.dong,
            ho: recovered.variant.ho,
            signature: rawUnitRecoverySignature(row.raw, row.result.unit || {})
          };
          stageCounts.raw_unit_recovery = 1;
          applyModule("R-IROS-RAW-UNIT", IROS_MODULE_VERSIONS.R_IROS_RAW_UNIT);
        } else {
          stageCounts.raw_unit_recovery = 0;
        }
      }
'''
new_fallback = '''      // R-IROS-UNIT-PROFILE: 주소의 동·층·호를 의도값으로 보존하고,
      // 현재 지번의 완전 후보를 건물별로 묶어 실제 동·호 표기방식을 학습한다.
      // 기존 결과가 단일 한 건이 아닐 때만 적용하며, 모든 해석이 한 고유번호로
      // 수렴해야 확정한다.
      if ((wantDong || wantHo) && cands.length !== 1) {
        const profiled = matchUnitByBuildingProfile(
          unitCandidatePool,
          row.raw,
          row.result.unit || {},
          row.result.bdNm || ""
        );
        unitProfileRecovery = profiled.audit;
        stageCounts.unit_profile_matches = profiled.audit?.matched_candidate_count || 0;
        if (profiled.status === "UNIQUE" && profiled.candidate) {
          cands = [profiled.candidate];
          unitProfileRecovery = {
            ...profiled.audit,
            selected_strategy: profiled.strategy,
            selected_profile: profiled.profile
          };
          stageCounts.unit_profile_recovery = 1;
          applyModule("R-IROS-UNIT-PROFILE", IROS_MODULE_VERSIONS.R_IROS_UNIT_PROFILE);
        } else {
          stageCounts.unit_profile_recovery = 0;
        }
      }
'''
app = replace_once(app, old_fallback, new_fallback, "dynamic unit profile fallback")

app = app.replace("raw_unit_recovery: rawUnitRecovery", "unit_profile_recovery: unitProfileRecovery")
if app.count("unit_profile_recovery: unitProfileRecovery") != 3:
    raise RuntimeError("profile audit result fields: expected three replacements")
app = replace_once(
    app,
    'message: rawUnitRecovery ? "원문 세대구조로 완전후보 한 건 수렴" : "PNU 완전후보에서 동·호 일치",',
    'message: unitProfileRecovery?.selected_strategy ? "건물별 IROS 동·호 프로파일로 완전후보 한 건 수렴" : "PNU 완전후보에서 동·호 일치",',
    "profile resolved message"
)

app = replace_once(
    app,
    '''      const rawUnitEvidence = rawUnitRecoverySignature(
        member.row.raw,
        member.row.result.unit || {}
      );
      const matchCacheKey = collection.content_hash
        ? `regmatch:${collection.content_hash}:${MATCHER_VERSION}:${lotEvidence}:${wantDong}:${wantHo}:${encodeURIComponent(rawUnitEvidence)}:${encodeURIComponent(strictEvidence)}`
''',
    '''      const unitIntentEvidence = unitIntentSignature(
        member.row.raw,
        member.row.result.unit || {}
      );
      const matchCacheKey = collection.content_hash
        ? `regmatch:${collection.content_hash}:${MATCHER_VERSION}:${lotEvidence}:${wantDong}:${wantHo}:${encodeURIComponent(unitIntentEvidence)}:${encodeURIComponent(strictEvidence)}`
''',
    "profile cache key"
)
app = replace_once(
    app,
    'raw_unit_signature: rawUnitEvidence,',
    'unit_intent_signature: unitIntentEvidence,',
    "profile match evidence"
)
app_path.write_text(app, encoding="utf-8")

unit_path = Path("public/unit-match.mjs")
unit = unit_path.read_text(encoding="utf-8")
unit = replace_once(unit, 'export const MATCHER_VERSION = "iros-matcher-v6";', 'export const MATCHER_VERSION = "iros-matcher-v7";', "matcher version")
unit = replace_once(
    unit,
    '  R_IROS_RAW_UNIT: "1"\n});',
    '  R_IROS_RAW_UNIT: "1",\n  R_IROS_UNIT_PROFILE: "1"\n});',
    "profile module version"
)
unit_path.write_text(unit, encoding="utf-8")

run_path = Path("public/iros-run-contract.mjs")
run = run_path.read_text(encoding="utf-8")
run = replace_once(run, '  matcher: "iros-matcher-v6",', '  matcher: "iros-matcher-v7",', "run matcher version")
run = replace_once(run, '  recovery: "iros-recovery-v3"', '  recovery: "iros-recovery-v4"', "run recovery version")
run_path.write_text(run, encoding="utf-8")

profile_path = Path("public/iros-unit-profile.mjs")
profile = profile_path.read_text(encoding="utf-8")
profile = replace_once(
    profile,
    '''  for (const candidate of profile.candidates) {
    // 현재 정규화 동·호의 직접 일치도 건물 프로파일의 한 표현방식이다.
    if ((intent.dong || intent.ho) && candidateMatchesUnit(candidate, intent.dong, intent.ho)) {
      push(candidate, "PROFILE_DIRECT");
    }

    if (intent.recoveredDong && intent.ho) {
''',
    '''  const hasStructuralRecovery = Boolean(
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
''',
    "specific structural profile precedence"
)
profile_path.write_text(profile, encoding="utf-8")

hardening_path = Path("tests/test_iros_hardening.mjs")
hardening = hardening_path.read_text(encoding="utf-8")
hardening = replace_once(
    hardening,
    '''    "recovery_version: IROS_RUN_VERSIONS.recovery",
    "기본 PNU ${batchBaseDone}/${batchBaseTotal}",''',
    '''    "recovery_version: IROS_RUN_VERSIONS.recovery",
    "R-IROS-UNIT-PROFILE",
    "unit_profile_recovery",
    "기본 PNU ${batchBaseDone}/${batchBaseTotal}",''',
    "hardening profile markers"
)
hardening_path.write_text(hardening, encoding="utf-8")

print("dynamic IROS unit profile v7 patch applied")
