export const AMBIGUOUS_PNU_RECOVERY_VERSION = "ambiguous-pnu-iros-v1";

const RETRYABLE = new Set([
  "REG_SERVICE_UNAVAILABLE",
  "REG_COLLECTION_DEFERRED",
  "REG_PARTIAL_RESPONSE",
  "REG_PARSE_ERROR",
  "REG_PARSE_INCOMPLETE",
  "REG_HTTP_ERROR",
  "REG_SESSION_ERROR",
  "REG_RATE_LIMIT",
  "REG_TIMEOUT",
  "REG_ERROR"
]);

function pnuOf(value) {
  const pnu = String(value || "").trim();
  return /^\d{19}$/.test(pnu) ? pnu : "";
}

function candidateAddress(candidate) {
  return String(candidate?.jibunAddr || candidate?.roadAddr || "").trim();
}

function representative(candidates) {
  return candidates.find((candidate) => candidate?.isJip) || candidates[0] || null;
}

// 주소 후보가 복수 PNU여도 원문에 호가 있으면 각 PNU의 완전 IROS 후보를
// 같은 동·호로 검증할 수 있다. 첫 후보·점수순은 쓰지 않고 모든 PNU를 조회한다.
export function buildAmbiguousPnuProbePlan(row, { maxPnus = 10 } = {}) {
  const result = row?.result;
  if (String(result?.status || "") !== "AMBIGUOUS") return null;
  if (result?.pnuIrosEvidence?.version === AMBIGUOUS_PNU_RECOVERY_VERSION &&
      ["AMBIGUOUS", "NO_MATCH"].includes(String(result.pnuIrosEvidence.outcome || ""))) {
    return null;
  }
  if (!String(result?.unit?.ho || "").trim()) return null;
  const grouped = new Map();
  for (const candidate of Array.isArray(result?.candidates) ? result.candidates : []) {
    const pnu = pnuOf(candidate?.pnu);
    if (!pnu || !candidateAddress(candidate)) continue;
    if (!grouped.has(pnu)) grouped.set(pnu, []);
    grouped.get(pnu).push(candidate);
  }
  if (grouped.size < 2 || grouped.size > maxPnus) return null;
  const probes = [...grouped.entries()]
    .map(([pnu, candidates]) => {
      const candidate = representative(candidates);
      return {
        pnu,
        address: candidateAddress(candidate),
        candidate,
        candidateCount: candidates.length
      };
    })
    .sort((left, right) => left.pnu.localeCompare(right.pnu));
  return {
    version: AMBIGUOUS_PNU_RECOVERY_VERSION,
    dong: String(result.unit?.dong || "").trim(),
    ho: String(result.unit?.ho || "").trim(),
    probes
  };
}

export function selectUniqueIrosPnuAttempt(plan, attempts) {
  const probes = Array.isArray(plan?.probes) ? plan.probes : [];
  const source = Array.isArray(attempts) ? attempts : [];
  const byPnu = new Map(source.map((attempt) => [pnuOf(attempt?.probe?.pnu), attempt]));
  const missing = probes.filter((probe) => !byPnu.has(probe.pnu));
  const audit = {
    version: AMBIGUOUS_PNU_RECOVERY_VERSION,
    attemptedPnus: probes.map((probe) => probe.pnu),
    attempts: probes.map((probe) => {
      const attempt = byPnu.get(probe.pnu);
      return {
        pnu: probe.pnu,
        status: String(attempt?.reg?.status || "NOT_ATTEMPTED"),
        uniqueNo: String(attempt?.reg?.unique_no || "")
      };
    })
  };
  if (missing.length) return { status: "RETRY_REQUIRED", audit };
  if (source.some((attempt) => RETRYABLE.has(String(attempt?.reg?.status || "")))) {
    return { status: "RETRY_REQUIRED", audit };
  }
  if (source.some((attempt) => String(attempt?.reg?.status || "") === "REG_MULTI")) {
    return { status: "AMBIGUOUS", audit };
  }
  const resolved = source.filter((attempt) =>
    String(attempt?.reg?.status || "") === "RESOLVED" && attempt?.reg?.unique_no
  );
  const resolvedPnus = new Set(resolved.map((attempt) => pnuOf(attempt.probe?.pnu)).filter(Boolean));
  const uniqueNos = new Set(resolved.map((attempt) => String(attempt.reg.unique_no)).filter(Boolean));
  if (resolvedPnus.size !== 1 || uniqueNos.size !== 1) {
    return { status: resolvedPnus.size > 1 ? "AMBIGUOUS" : "NO_MATCH", audit };
  }
  const chosen = resolved[0];
  return {
    status: "UNIQUE",
    pnu: chosen.probe.pnu,
    uniqueNo: chosen.reg.unique_no,
    candidate: chosen.probe.candidate,
    reg: chosen.reg,
    audit: {
      ...audit,
      selectedPnu: chosen.probe.pnu,
      selectedUniqueNo: chosen.reg.unique_no,
      evidence: "ALL_PNU_PROBED_SINGLE_RESOLVED_PNU"
    }
  };
}
