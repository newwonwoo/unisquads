// 개선 모듈의 기대효과를 배치 스냅샷에서 결정적으로 계산한다.
//
// 추정이 아니다. IROS 완전후보(`reg.candidates`)는 이미 각 행에 저장돼 있으므로,
// 새 모듈이 그 후보 위에서 무엇을 하는지는 API 호출 없이 그대로 재현된다.
// 재현 불가능한 항목(아직 조회한 적 없는 지번)은 추정하지 않고 `미측정`으로
// 분리해서 보고한다.
//
// 브라우저와 Node 양쪽에서 그대로 돈다. 파일시스템·프로세스 API를 쓰지 않는다.
// 입력 스냅샷에는 원문주소와 소유자 관련 원본열이 함께 들어 있을 수 있으나,
// 이 모듈의 출력은 건수와 사유 코드뿐이다.

import {
  filterUnitPropertyCandidates,
  rawUnitRecoveryVariants,
  selectDongAgnosticHoCandidate,
  selectUniqueRawUnitCandidate,
  unitKey
} from "./unit-match.mjs";
import {
  acceptReversePnu,
  buildConfirmedLotPnuIndex,
  buildPnulessIrosPlan,
  irosSojaeQuery,
  lotIndexJusoCandidate,
  lotScopedAddress
} from "./pnuless-iros.mjs";
import { planVerifiedUnitPropagation } from "./verified-unit-propagation.mjs";

const UNIT_FAILURES = new Set(["REG_MULTI", "MULTIPLE", "REG_UNIT_NOT_FOUND"]);

function text(value) {
  return String(value ?? "").trim();
}

function isConfirmed(result) {
  return ["CONFIRMED", "확정"].includes(text(result?.status));
}

function isFinalResolved(row) {
  return isConfirmed(row?.result) && text(row?.result?.pnu) &&
    text(row?.reg?.status) === "RESOLVED" && text(row?.reg?.unique_no);
}

// 완전수집이 끝난 세대 실패만 후보 위 재현이 가능하다.
function replayableFailure(row) {
  const reg = row?.reg;
  return Boolean(reg) && reg.complete === true &&
    UNIT_FAILURES.has(text(reg.status)) &&
    Array.isArray(reg.candidates) && reg.candidates.length > 0;
}

function bucket(map, key) {
  map.set(key, (map.get(key) || 0) + 1);
}

// 매처가 실제로 쓰는 순서대로 한 행을 재현한다. 먼저 성공하는 모듈이 그 행을
// 가져가므로, 각 행은 정확히 한 모듈에만 귀속된다(중복 집계 방지).
//
// 기존 매처(v10)가 이미 적용하던 원문복구 변형으로도 수렴하는 행은 새 이득이
// 아니다. 중복 동 표기 변형을 뺀 상태와 넣은 상태를 각각 계산해, 넣었을 때만
// 수렴하는 행을 이득으로 센다.
function replayUnitRecovery(row) {
  const unit = row?.result?.unit || {};
  const raw = row?.raw || "";
  const entered = [];
  const allVariants = rawUnitRecoveryVariants(raw, unit);
  const duplicateVariants = allVariants.filter((v) => v.source === "raw_duplicate_dong");
  const pool = filterUnitPropertyCandidates(
    row.reg.candidates, unit.dong || "", unit.ho || "", allVariants
  );

  if (duplicateVariants.length) {
    entered.push("중복 동 표기 복구");
    if (!pool.verified) {
      return { entered, module: null, stage: "중복 동 표기 복구", reason: "PROPERTY_CLASS" };
    }
    const newHit = selectUniqueRawUnitCandidate(pool.candidates, raw, unit);
    if (newHit?.candidate) {
      // 기존 매처(v10)의 변형만으로도 이미 수렴했다면 새 이득이 아니다.
      const baselinePool = filterUnitPropertyCandidates(
        row.reg.candidates, unit.dong || "", unit.ho || "",
        allVariants.filter((v) => v.source !== "raw_duplicate_dong")
      );
      const baselineHit = baselinePool.verified && allVariants.length > duplicateVariants.length
        ? selectUniqueRawUnitCandidate(baselinePool.candidates, raw, { ...unit, __noDuplicate: true })
        : null;
      if (!baselineHit?.candidate) {
        return { entered, module: "중복 동 표기 복구", candidate: newHit.candidate };
      }
      return { entered, module: null, stage: "중복 동 표기 복구", reason: "ALREADY_RECOVERED_BY_V10" };
    }
    return { entered, module: null, stage: "중복 동 표기 복구", reason: "NO_UNIQUE_CONVERGENCE" };
  }

  if (text(row.reg.status) === "REG_UNIT_NOT_FOUND" && unit.dong && unit.ho) {
    entered.push("동 무시 호 수렴");
    if (!pool.verified) {
      return { entered, module: null, stage: "동 무시 호 수렴", reason: "PROPERTY_CLASS" };
    }
    const dongKeys = new Set(
      row.reg.candidates.map((candidate) => unitKey(candidate?.dong, "dong")).filter(Boolean)
    );
    if (dongKeys.has(unitKey(unit.dong, "dong"))) {
      return { entered, module: null, stage: "동 무시 호 수렴", reason: "REQUESTED_DONG_EXISTS" };
    }
    const picked = selectDongAgnosticHoCandidate(pool.candidates, unit.dong, unit.ho);
    if (picked?.candidate) return { entered, module: "동 무시 호 수렴", candidate: picked.candidate };
    return { entered, module: null, stage: "동 무시 호 수렴", reason: "HO_NOT_UNIQUE" };
  }
  return { entered, module: null, reason: "NO_MODULE_APPLIES" };
}

export function measure(rows) {
  const total = rows.length;
  const baselineAddress = rows.filter((row) => isConfirmed(row?.result) && text(row?.result?.pnu)).length;
  const baselineFinal = rows.filter(isFinalResolved).length;

  const duplicateDong = { entered: 0, recovered: 0, rejected: new Map() };
  const dongAgnostic = { entered: 0, recovered: 0, rejected: new Map() };
  const stats = { "중복 동 표기 복구": duplicateDong, "동 무시 호 수렴": dongAgnostic };

  // ── 1단계: 완전후보 위 세대 재매칭 (결정적) ────────────────────────
  const staged = rows.map((row) => {
    if (!replayableFailure(row)) return row;
    const outcome = replayUnitRecovery(row);
    for (const stage of outcome.entered) stats[stage].entered += 1;
    if (outcome.module) {
      stats[outcome.module].recovered += 1;
      return {
        ...row,
        reg: {
          ...row.reg, status: "RESOLVED",
          unique_no: text(outcome.candidate?.unique_no),
          candidates: [outcome.candidate]
        }
      };
    }
    if (outcome.stage) bucket(stats[outcome.stage].rejected, outcome.reason);
    return row;
  });

  // ── 2단계: PNU 없는 IROS 조회 ───────────────────────────────────
  // 다른 행이 같은 지번을 이미 완전수집했으면 그 후보 위에서 결정적으로
  // 재현된다. 수집 이력이 없는 지번은 추정하지 않고 미측정으로 남긴다.
  const poolsByLot = new Map();
  for (const row of staged) {
    if (!Array.isArray(row?.reg?.candidates) || row.reg.complete !== true) continue;
    const key = lotScopedAddress(row?.result?.jibunAddr);
    if (key && !poolsByLot.has(key)) poolsByLot.set(key, row.reg.candidates);
  }

  const pnuless = {
    entered: 0, replayable: 0, recovered: 0, unmeasured: 0,
    strictBuilding: 0, rejected: new Map()
  };
  const pnulessResolved = new Map();
  const afterPnuless = staged.map((row, position) => {
    const plan = buildPnulessIrosPlan(row);
    if (!plan) return row;
    pnuless.entered += 1;
    if (plan.strictBuilding) pnuless.strictBuilding += 1;
    const pool = poolsByLot.get(plan.address);
    if (!pool) {
      pnuless.unmeasured += 1;
      return row;
    }
    pnuless.replayable += 1;
    const typed = filterUnitPropertyCandidates(pool, plan.dong, plan.ho);
    if (!typed.verified) {
      bucket(pnuless.rejected, "PROPERTY_CLASS");
      return row;
    }
    const matched = typed.candidates.filter((candidate) =>
      unitKey(candidate?.ho, "ho") === plan.ho &&
      (!plan.dong || unitKey(candidate?.dong, "dong") === plan.dong)
    );
    const unique = new Set(matched.map((candidate) => text(candidate?.unique_no)).filter(Boolean));
    if (unique.size !== 1) {
      bucket(pnuless.rejected, unique.size === 0 ? "UNIT_NOT_FOUND" : "MULTIPLE");
      return row;
    }
    pnuless.recovered += 1;
    pnulessResolved.set(position, { plan, candidate: matched[0] });
    return {
      ...row,
      reg: {
        status: "RESOLVED", complete: true,
        unique_no: text(matched[0]?.unique_no), candidates: [matched[0]]
      }
    };
  });

  // ── 3단계: 동일 PNU·동·호 검증 고유번호 전파 (결정적) ───────────────
  const propagationPlan = planVerifiedUnitPropagation(afterPnuless);
  const propagation = {
    entered: afterPnuless.filter((row) => replayableFailure(row) && text(row?.result?.pnu)).length,
    recovered: propagationPlan.length,
    rejected: new Map()
  };

  // ── 4단계: IROS 소재지 → PNU 역확정 ────────────────────────────
  // 배치 안에 같은 지번의 확정 PNU가 있으면 JUSO 없이 결정된다. 나머지는
  // JUSO 응답에 달려 있으므로 미측정으로 분리한다.
  const lotIndex = buildConfirmedLotPnuIndex(afterPnuless);
  const reverse = { entered: 0, recovered: 0, needsJuso: 0, rejected: new Map() };
  for (const [position, { plan, candidate }] of pnulessResolved) {
    if (!irosSojaeQuery(candidate)) {
      bucket(reverse.rejected, "IROS_SOJAE_UNPARSABLE");
      continue;
    }
    reverse.entered += 1;
    const hit = lotIndexJusoCandidate(candidate, lotIndex);
    if (!hit) {
      reverse.needsJuso += 1;
      continue;
    }
    const accepted = acceptReversePnu({
      irosCandidate: candidate,
      jusoCandidate: hit.candidate,
      queryAddress: plan.address
    });
    if (accepted.ok) reverse.recovered += 1;
    else bucket(reverse.rejected, accepted.reason);
  }

  const irosGain = duplicateDong.recovered + dongAgnostic.recovered +
    propagation.recovered + pnuless.recovered;
  // 주소확정은 역확정에 성공한 행만 늘어난다. 그 행들은 이미 IROS 이득에
  // 포함돼 있으므로 최종통과에는 다시 더하지 않는다.
  const addressGain = reverse.recovered;

  return {
    total,
    baseline: {
      addressConfirmed: baselineAddress,
      addressRate: total ? baselineAddress / total : 0,
      finalResolved: baselineFinal,
      finalRate: total ? baselineFinal / total : 0
    },
    modules: {
      "중복 동 표기 복구": duplicateDong,
      "동 무시 호 수렴": dongAgnostic,
      "검증 고유번호 전파": propagation,
      "PNU 없는 IROS 조회": pnuless,
      "IROS 소재지 역확정": reverse
    },
    measured: {
      irosGain,
      addressGain,
      finalResolved: baselineFinal + irosGain,
      finalRate: total ? (baselineFinal + irosGain) / total : 0,
      addressConfirmed: baselineAddress + addressGain,
      addressRate: total ? (baselineAddress + addressGain) / total : 0
    },
    unmeasured: {
      pnulessWithoutPool: pnuless.unmeasured,
      reverseNeedingJuso: reverse.needsJuso
    }
  };
}

function pct(value) {
  return `${(value * 100).toFixed(2)}%`;
}

function reasons(map) {
  if (!map.size) return "-";
  return [...map.entries()].sort((a, b) => b[1] - a[1])
    .map(([key, count]) => `${key} ${count}`).join(", ");
}

export function report(result) {
  const lines = [];
  lines.push(`전체 처리행: ${result.total}건`);
  lines.push("");
  lines.push("── 현재 실측 (스냅샷 그대로) ──");
  lines.push(`주소확정   ${result.baseline.addressConfirmed}건  ${pct(result.baseline.addressRate)}`);
  lines.push(`최종통과   ${result.baseline.finalResolved}건  ${pct(result.baseline.finalRate)}`);
  lines.push("");
  lines.push("── 모듈별 결정적 재현 ──");
  lines.push("모듈                        진입    확정   거절 사유");
  for (const [name, data] of Object.entries(result.modules)) {
    const entered = String(data.entered ?? 0).padStart(5);
    const recovered = String(data.recovered ?? 0).padStart(5);
    lines.push(`${name.padEnd(24)}${entered}${recovered}   ${reasons(data.rejected)}`);
  }
  lines.push("");
  lines.push("── 측정된 기대효과 ──");
  lines.push(`IROS 최종통과  ${result.baseline.finalResolved} → ${result.measured.finalResolved}건  ` +
    `${pct(result.baseline.finalRate)} → ${pct(result.measured.finalRate)}  (+${result.measured.irosGain})`);
  lines.push(`주소확정       ${result.baseline.addressConfirmed} → ${result.measured.addressConfirmed}건  ` +
    `${pct(result.baseline.addressRate)} → ${pct(result.measured.addressRate)}  (+${result.measured.addressGain})`);
  lines.push("");
  lines.push("── 미측정 (이 스냅샷으로는 재현 불가) ──");
  lines.push(`PNU 없는 행 중 해당 지번 수집 이력 없음: ${result.unmeasured.pnulessWithoutPool}건 (IROS 조회 필요)`);
  lines.push(`역확정 중 배치 내 PNU 색인 미적중:       ${result.unmeasured.reverseNeedingJuso}건 (JUSO 조회 필요)`);
  lines.push("");
  lines.push("위 두 줄은 추정하지 않는다. 실제 조회 후 같은 스크립트를 다시 돌리면 확정된다.");
  return lines.join("\n");
}
