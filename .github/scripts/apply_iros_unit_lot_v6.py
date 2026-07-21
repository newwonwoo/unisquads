from pathlib import Path


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected one match, found {count}")
    return text.replace(old, new, 1)


path = Path("public/app.js")
app = path.read_text(encoding="utf-8")

app = replace_once(
    app,
    '''  MATCHER_VERSION,
  alternateRawLotAddress,
  buildingEvidenceKind,
  buildingKey,
  candidateHasNoDong,
  candidateMatchesAddressLot,
  candidateMatchesUnit,
  filterExpectedPropertyClass,
  matchedCandidateUnitVariant,
  unitKey
''',
    '''  MATCHER_VERSION,
  alternateRawLotAddresses,
  buildingEvidenceKind,
  buildingKey,
  candidateHasNoDong,
  candidateMatchesAddressLot,
  candidateMatchesUnit,
  filterExpectedPropertyClass,
  matchedCandidateUnitVariant,
  rawUnitRecoverySignature,
  selectUniqueRawUnitCandidate,
  unitKey
''',
    "unit-match imports"
)

app = replace_once(
    app,
    '''      if (isReusableIrosResult(row.reg)) continue;
      if (isCurrentIrosResult(row.reg) && row.reg?.recovery_pending && row.reg?.recovery_address) {
        addPendingAlternate(row.reg.recovery_address, { idx, row });
        continue;
      }
      targets.push({ idx, row });
''',
    '''      if (isReusableIrosResult(row.reg)) continue;
      if (isCurrentIrosResult(row.reg) && row.reg?.recovery_pending) {
        const pendingAddresses = Array.isArray(row.reg.recovery_addresses)
          ? row.reg.recovery_addresses.filter(Boolean)
          : [row.reg.recovery_address].filter(Boolean);
        if (pendingAddresses.length) {
          for (const address of pendingAddresses) addPendingAlternate(address, { idx, row });
          continue;
        }
      }
      targets.push({ idx, row });
''',
    "resume all alternate addresses"
)

app = replace_once(
    app,
    '''      stageCounts.property_class = cands.length;
      if (wantDong || wantHo) {
        let matched = cands.filter((c) => {
          const variant = matchedCandidateUnitVariant(c, wantDong, wantHo);
          if (variant?.source === "composite_dong_room_prefix") {
            applyModule("IROS-CANDIDATE-NORMALIZE", IROS_MODULE_VERSIONS.IROS_CANDIDATE_NORMALIZE);
          }
          return Boolean(variant);
        });
        // 단일 동 건물: 후보 전체에 동이 없고 호는 있을 때 호로만 재매칭.
        if (!matched.length && wantDong && wantHo) {
          const anyDong = cands.some((c) => !candidateHasNoDong(c));
          const anyHo = cands.some((c) => unitKey(c.ho, "ho"));
          if (!anyDong && anyHo)
            matched = cands.filter((c) => candidateMatchesUnit(c, "", wantHo));
        }
        // R-IROS-HO-BUILDING: 해당 후보의 동만 비어 있고 호·건물명이 정확히
        // 맞는 한 건을 안전하게 선택한다.
        if (!matched.length && wantDong && wantHo && row.result.bdNm) {
          const wantedBuilding = buildingKey(row.result.bdNm);
          const hoBuilding = cands.filter((c) =>
            candidateHasNoDong(c) &&
            candidateMatchesUnit(c, "", wantHo) &&
            buildingKey(c.buldnm) === wantedBuilding
          );
          if (hoBuilding.length === 1) {
            matched = hoBuilding;
            applyModule("R-IROS-HO-BUILDING", IROS_MODULE_VERSIONS.R_IROS_HO_BUILDING);
          }
        }
        cands = matched;
      }
      stageCounts.unit = cands.length;
''',
    '''      stageCounts.property_class = cands.length;
      const unitCandidatePool = cands;
      let rawUnitRecovery = null;
      if (wantDong || wantHo) {
        let matched = cands.filter((c) => {
          const variant = matchedCandidateUnitVariant(c, wantDong, wantHo);
          if (variant?.source === "composite_dong_room_prefix") {
            applyModule("IROS-CANDIDATE-NORMALIZE", IROS_MODULE_VERSIONS.IROS_CANDIDATE_NORMALIZE);
          }
          return Boolean(variant);
        });
        // 단일 동 건물: 후보 전체에 동이 없고 호는 있을 때 호로만 재매칭.
        if (!matched.length && wantDong && wantHo) {
          const anyDong = cands.some((c) => !candidateHasNoDong(c));
          const anyHo = cands.some((c) => unitKey(c.ho, "ho"));
          if (!anyDong && anyHo)
            matched = cands.filter((c) => candidateMatchesUnit(c, "", wantHo));
        }
        // R-IROS-HO-BUILDING: 해당 후보의 동만 비어 있고 호·건물명이 정확히
        // 맞는 한 건을 안전하게 선택한다.
        if (!matched.length && wantDong && wantHo && row.result.bdNm) {
          const wantedBuilding = buildingKey(row.result.bdNm);
          const hoBuilding = cands.filter((c) =>
            candidateHasNoDong(c) &&
            candidateMatchesUnit(c, "", wantHo) &&
            buildingKey(c.buldnm) === wantedBuilding
          );
          if (hoBuilding.length === 1) {
            matched = hoBuilding;
            applyModule("R-IROS-HO-BUILDING", IROS_MODULE_VERSIONS.R_IROS_HO_BUILDING);
          }
        }
        cands = matched;
      }
      stageCounts.unit = cands.length;

      // R-IROS-RAW-UNIT: 기존 동·호 결과가 단일 한 건이 아닐 때만 원문의
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
''',
    "raw unit fallback"
)

app = replace_once(
    app,
    '''          stage_counts: stageCounts,
          applied_modules: appliedModules,
          message: (wantDong || wantHo) ? "완전 후보에서 일치 세대 없음" : "완전 후보 없음",
''',
    '''          stage_counts: stageCounts,
          applied_modules: appliedModules,
          raw_unit_recovery: rawUnitRecovery,
          message: (wantDong || wantHo) ? "완전 후보에서 일치 세대 없음" : "완전 후보 없음",
''',
    "not-found raw unit audit"
)

app = replace_once(
    app,
    '''          stage_counts: stageCounts,
          applied_modules: appliedModules,
          message: "PNU 완전후보에서 동·호 일치",
''',
    '''          stage_counts: stageCounts,
          applied_modules: appliedModules,
          raw_unit_recovery: rawUnitRecovery,
          message: rawUnitRecovery ? "원문 세대구조로 완전후보 한 건 수렴" : "PNU 완전후보에서 동·호 일치",
''',
    "resolved raw unit audit"
)

app = replace_once(
    app,
    '''          failure_stage: "UNIQUENESS", stage_counts: stageCounts,
          applied_modules: appliedModules,
          message: `${cands.length}건`, at: nowText()
''',
    '''          failure_stage: "UNIQUENESS", stage_counts: stageCounts,
          applied_modules: appliedModules,
          raw_unit_recovery: rawUnitRecovery,
          message: `${cands.length}건`, at: nowText()
''',
    "multi raw unit audit"
)

app = replace_once(
    app,
    '''      const lotEvidence = encodeURIComponent(
        String(queryAddress || member.row.result.jibunAddr || member.row.result.irosQuery || "")
      );
      const matchCacheKey = collection.content_hash
        ? `regmatch:${collection.content_hash}:${MATCHER_VERSION}:${lotEvidence}:${wantDong}:${wantHo}:${encodeURIComponent(strictEvidence)}`
        : "";
''',
    '''      const lotEvidence = encodeURIComponent(
        String(queryAddress || member.row.result.jibunAddr || member.row.result.irosQuery || "")
      );
      const rawUnitEvidence = rawUnitRecoverySignature(
        member.row.raw,
        member.row.result.unit || {}
      );
      const matchCacheKey = collection.content_hash
        ? `regmatch:${collection.content_hash}:${MATCHER_VERSION}:${lotEvidence}:${wantDong}:${wantHo}:${encodeURIComponent(rawUnitEvidence)}:${encodeURIComponent(strictEvidence)}`
        : "";
''',
    "raw unit cache key"
)

app = replace_once(
    app,
    '''            dong_key: wantDong,
            ho_key: wantHo,
            lot_key: lotEvidence,
            strict: strictEvidence
''',
    '''            dong_key: wantDong,
            ho_key: wantHo,
            lot_key: lotEvidence,
            raw_unit_signature: rawUnitEvidence,
            strict: strictEvidence
''',
    "raw unit match evidence"
)

app = replace_once(
    app,
    '''        if (reg.status === "REG_UNIT_NOT_FOUND") {
          const normalizedAddress = member.row.result.jibunAddr || member.row.result.irosQuery || "";
          const alternateAddress = alternateRawLotAddress(member.row.raw, normalizedAddress);
          if (alternateAddress) {
            reg = withIrosVersions({
              ...reg,
              recovery_pending: true,
              recovery_address: alternateAddress,
              recovery_attempted: false
            });
            addAlternateMember(alternateAddress, member);
          }
        }
''',
    '''        if (reg.status === "REG_UNIT_NOT_FOUND") {
          const normalizedAddress = member.row.result.jibunAddr || member.row.result.irosQuery || "";
          const alternateAddresses = alternateRawLotAddresses(member.row.raw, normalizedAddress);
          if (alternateAddresses.length) {
            reg = withIrosVersions({
              ...reg,
              recovery_pending: true,
              recovery_address: alternateAddresses[0],
              recovery_addresses: alternateAddresses,
              recovery_attempted: false
            });
            for (const alternateAddress of alternateAddresses) {
              addAlternateMember(alternateAddress, member);
            }
          }
        }
''',
    "queue all explicit alternate lots"
)

old_alternate = '''    const alternateEntries = [...alternateGroups.entries()];
    setBatchAltTotal(alternateEntries.length);
    runState.alternateTotal = alternateEntries.length;
    for (let a = 0; a < alternateEntries.length; a++) {
      if (batchStopRef.current) break;
      const [alternateAddress, members] = alternateEntries[a];
      const identity = `ALTLOT:${alternateAddress}`;
      const { collection, cacheHit } = await loadCollection(identity, members[0].row, alternateAddress);
      for (const member of members) {
        const prior = next[member.idx].reg || member.row.reg || {};
        const recovered = await matchMember(member, collection, alternateAddress);
        if (recovered.status === "RESOLVED" || recovered.status === "REG_MULTI") {
          const moduleTag = `R-IROS-MULTILOT@${IROS_MODULE_VERSIONS.R_IROS_MULTILOT}`;
          const appliedModules = [...(recovered.applied_modules || [])];
          if (!appliedModules.includes(moduleTag)) appliedModules.push(moduleTag);
          next[member.idx] = {
            ...next[member.idx],
            reg: withIrosVersions({
              ...recovered,
              applied_modules: appliedModules,
              recovery_module: moduleTag,
              recovery_address: alternateAddress,
              recovery_pending: false,
              recovery_attempted: true,
              message: recovered.status === "RESOLVED"
                ? "원문 대체지번 완전후보에서 동·호 일치"
                : recovered.message
            })
          };
        } else if (isRetryableIrosStatus(recovered.status)) {
          next[member.idx] = {
            ...next[member.idx],
            reg: withIrosVersions({
              ...prior,
              recovery_pending: true,
              recovery_address: alternateAddress,
              recovery_attempted: true,
              recovery_error_status: recovered.status,
              recovery_error_message: recovered.message || ""
            })
          };
        } else {
          next[member.idx] = {
            ...next[member.idx],
            reg: withIrosVersions({
              ...prior,
              recovery_pending: false,
              recovery_address: alternateAddress,
              recovery_attempted: true,
              recovery_result_status: recovered.status,
              recovery_result_message: recovered.message || ""
            })
          };
        }
      }
      recordRegHealth(collection.status || (collection.complete ? "RESOLVED" : "REG_PARTIAL_RESPONSE"));
      setBatchAltDone(a + 1);
      await checkpoint({
        phase: "alternate",
        baseDone: pnuKeys.length,
        baseTotal: pnuKeys.length,
        alternateDone: a + 1,
        alternateTotal: alternateEntries.length
      });
      if (!cacheHit && a < alternateEntries.length - 1 && !batchStopRef.current)
        await new Promise((res) => setTimeout(res, 1e3));
    }
'''
new_alternate = '''    const alternateEntries = [...alternateGroups.entries()];
    const alternateAttempts = new Map();
    const addAlternateAttempt = (member, address, recovered) => {
      if (!alternateAttempts.has(member.idx)) alternateAttempts.set(member.idx, []);
      alternateAttempts.get(member.idx).push({ address, recovered });
    };
    setBatchAltTotal(alternateEntries.length);
    runState.alternateTotal = alternateEntries.length;
    for (let a = 0; a < alternateEntries.length; a++) {
      if (batchStopRef.current) break;
      const [alternateAddress, members] = alternateEntries[a];
      const identity = `ALTLOT:${alternateAddress}`;
      const { collection, cacheHit } = await loadCollection(identity, members[0].row, alternateAddress);
      for (const member of members) {
        const recovered = await matchMember(member, collection, alternateAddress);
        addAlternateAttempt(member, alternateAddress, recovered);
      }
      recordRegHealth(collection.status || (collection.complete ? "RESOLVED" : "REG_PARTIAL_RESPONSE"));
      setBatchAltDone(a + 1);
      await checkpoint({
        phase: "alternate",
        baseDone: pnuKeys.length,
        baseTotal: pnuKeys.length,
        alternateDone: a + 1,
        alternateTotal: alternateEntries.length
      });
      if (!cacheHit && a < alternateEntries.length - 1 && !batchStopRef.current)
        await new Promise((res) => setTimeout(res, 1e3));
    }

    // 여러 명시 대체지번은 첫 성공을 채택하지 않는다. 모든 조회가 끝난 뒤
    // 한 고유번호로만 수렴했을 때 확정하고, 복수결과 또는 서로 다른 고유번호가
    // 하나라도 남으면 REG_MULTI로 보존한다.
    if (!batchStopRef.current) {
      for (const [idx, attempts] of alternateAttempts.entries()) {
        const prior = next[idx].reg || {};
        const addresses = [...new Set(attempts.map((attempt) => attempt.address))];
        const retryable = attempts.filter((attempt) => isRetryableIrosStatus(attempt.recovered.status));
        if (retryable.length) {
          const first = retryable[0].recovered;
          next[idx] = {
            ...next[idx],
            reg: withIrosVersions({
              ...prior,
              recovery_pending: true,
              recovery_address: addresses[0] || "",
              recovery_addresses: addresses,
              recovery_attempted: true,
              recovery_error_status: first.status,
              recovery_error_message: first.message || ""
            })
          };
          continue;
        }

        const resolved = attempts.filter((attempt) => attempt.recovered.status === "RESOLVED");
        const multiple = attempts.filter((attempt) => attempt.recovered.status === "REG_MULTI");
        const resolvedNos = new Set(resolved.map((attempt) => attempt.recovered.unique_no).filter(Boolean));
        const moduleTag = `R-IROS-MULTILOT@${IROS_MODULE_VERSIONS.R_IROS_MULTILOT}`;

        if (resolvedNos.size === 1 && multiple.length === 0) {
          const chosen = resolved[0].recovered;
          const appliedModules = [...(chosen.applied_modules || [])];
          if (!appliedModules.includes(moduleTag)) appliedModules.push(moduleTag);
          next[idx] = {
            ...next[idx],
            reg: withIrosVersions({
              ...chosen,
              applied_modules: appliedModules,
              recovery_module: moduleTag,
              recovery_address: addresses[0] || "",
              recovery_addresses: addresses,
              recovery_pending: false,
              recovery_attempted: true,
              message: "명시 대체지번 전체 조회가 한 고유번호로 수렴"
            })
          };
          continue;
        }

        if (resolvedNos.size > 1 || multiple.length > 0) {
          const candidateMap = new Map();
          for (const attempt of [...resolved, ...multiple]) {
            for (const candidate of attempt.recovered.candidates || []) {
              const key = candidate.unique_no || JSON.stringify(candidate);
              if (!candidateMap.has(key)) candidateMap.set(key, candidate);
            }
          }
          const appliedModules = [...(prior.applied_modules || [])];
          if (!appliedModules.includes(moduleTag)) appliedModules.push(moduleTag);
          next[idx] = {
            ...next[idx],
            reg: withIrosVersions({
              ...prior,
              status: "REG_MULTI",
              candidates: [...candidateMap.values()],
              complete: true,
              failure_stage: "ALTERNATE_LOT_UNIQUENESS",
              applied_modules: appliedModules,
              recovery_module: moduleTag,
              recovery_address: addresses[0] || "",
              recovery_addresses: addresses,
              recovery_pending: false,
              recovery_attempted: true,
              recovery_result_status: "REG_MULTI",
              message: "명시 대체지번 조회 결과가 하나의 고유번호로 수렴하지 않음"
            })
          };
          continue;
        }

        const terminal = attempts[0]?.recovered || {};
        next[idx] = {
          ...next[idx],
          reg: withIrosVersions({
            ...prior,
            recovery_pending: false,
            recovery_address: addresses[0] || "",
            recovery_addresses: addresses,
            recovery_attempted: true,
            recovery_result_status: terminal.status || "REG_NOT_FOUND",
            recovery_result_message: terminal.message || "명시 대체지번에서도 일치 세대 없음"
          })
        };
      }
    }
'''
app = replace_once(app, old_alternate, new_alternate, "aggregate alternate lot results")

path.write_text(app, encoding="utf-8")
print("IROS unit/lot v6 patch applied")
