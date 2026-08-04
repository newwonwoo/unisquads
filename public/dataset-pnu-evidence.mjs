export const DATASET_PNU_EVIDENCE_VERSION = "dataset-pnu-evidence-v2";

const DERIVED_SOURCES = new Set([
  "주소군전파",
  "주소군후보교집합",
  "소유자주소군전파",
  "소유자주소군후보교집합",
  "건물주소군전파",
  "데이터셋PNU교차검증"
]);

function pnuOf(value) {
  const pnu = String(value || "").trim();
  return /^\d{19}$/.test(pnu) ? pnu : "";
}

function candidatePnu(candidate) {
  return pnuOf(candidate?.pnu);
}

function distinctCandidatePnus(row) {
  if (String(row?.result?.status || "") !== "AMBIGUOUS") return [];
  return [...new Set(
    (Array.isArray(row?.result?.candidates) ? row.result.candidates : [])
      .map(candidatePnu)
      .filter(Boolean)
  )];
}

function directConfirmedPnu(row) {
  const result = row?.result;
  const pnu = pnuOf(result?.pnu);
  if (!pnu || !["CONFIRMED", "확정"].includes(String(result?.status || ""))) return "";
  if (DERIVED_SOURCES.has(String(result?.source || ""))) return "";
  if (result?.validation?.status === "MISMATCH") return "";
  if (result?.reviewNeeded && !["bldname_matched", "juso_multi"].includes(result.reviewNeeded)) {
    return "";
  }
  return pnu;
}

export function directDatasetPnuSource(rows, wantedPnu) {
  const wanted = pnuOf(wantedPnu);
  if (!wanted) return null;
  const sources = (Array.isArray(rows) ? rows : []).filter((row) =>
    directConfirmedPnu(row) === wanted
  );
  if (!sources.length) return null;
  return [...sources].sort((left, right) =>
    String(left?.rowId || left?.raw || "").localeCompare(String(right?.rowId || right?.raw || ""), "ko")
  )[0];
}

function intersection(sets) {
  if (!sets.length) return new Set();
  let out = new Set(sets[0]);
  for (const set of sets.slice(1)) {
    out = new Set([...out].filter((value) => set.has(value)));
  }
  return out;
}

// 동일 데이터셋의 직접 확정 PNU 또는 서로 다른 복수후보 집합의 교집합만 쓴다.
// 행 순서, 첫 후보, 점수 최고값은 근거가 아니므로 사용하지 않는다.
export function selectDatasetGroupPnu(rows) {
  const source = Array.isArray(rows) ? rows : [];
  const directPnus = [...new Set(source.map(directConfirmedPnu).filter(Boolean))];
  if (directPnus.length > 1) {
    return { status: "CONFLICT", pnu: "", evidence: "DIRECT_PNU_CONFLICT" };
  }
  if (directPnus.length === 1) {
    return {
      status: "UNIQUE",
      pnu: directPnus[0],
      evidence: "DIRECT_CONFIRMED_PNU"
    };
  }

  const candidateSets = source
    .map(distinctCandidatePnus)
    .filter((values) => values.length >= 2);
  const distinctSetSignatures = new Set(
    candidateSets.map((values) => [...values].sort().join("|"))
  );
  // 같은 API 응답을 복제한 행 둘은 독립 근거가 아니다. 후보 집합 자체가 서로
  // 달라야 하며, 그 교집합이 PNU 하나일 때만 데이터셋 합의로 인정한다.
  if (candidateSets.length < 2 || distinctSetSignatures.size < 2) {
    return { status: "INSUFFICIENT", pnu: "", evidence: "NO_INDEPENDENT_CANDIDATE_SETS" };
  }
  const common = [...intersection(candidateSets.map((values) => new Set(values)))];
  if (common.length !== 1) {
    return {
      status: common.length ? "CONFLICT" : "NO_INTERSECTION",
      pnu: "",
      evidence: "CANDIDATE_SET_INTERSECTION_NOT_UNIQUE"
    };
  }
  return {
    status: "UNIQUE",
    pnu: common[0],
    evidence: "INDEPENDENT_CANDIDATE_SET_INTERSECTION"
  };
}

export function candidateForDatasetPnu(row, pnu) {
  const wanted = pnuOf(pnu);
  if (!wanted) return null;
  const matches = (Array.isArray(row?.result?.candidates) ? row.result.candidates : [])
    .filter((candidate) => candidatePnu(candidate) === wanted);
  if (!matches.length) return null;
  return matches.find((candidate) => candidate?.isJip) || matches[0];
}
