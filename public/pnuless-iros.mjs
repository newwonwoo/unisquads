// PNU 없는 IROS 조회와 IROS 소재지 역확정.
//
// 배경: IROS 조회 자체는 PNU를 쓰지 않는다. `/resolve?addr=`에 지번주소를
// 넘기고, PNU는 완전후보 캐시의 그룹 키로만 쓰인다. 그런데 배치 진입 게이트가
// `status === "CONFIRMED"`(=PNU 확보)여서, 네이버가 주소를 정상으로 확인했지만
// JUSO에서 PNU를 못 얻은 행(`NAVER_CONFIRMED_PNU_FAILED`)은 조회 자체를 못 했다.
//
// 이 모듈은 두 가지를 분리한다.
//   1) 주소 문자열만으로 IROS 고유번호를 확정하는 경로(PNU 불필요)
//   2) 확정된 IROS 소재지를 JUSO로 되짚어 PNU를 복구하는 경로(주소정제율 회수)
//
// 2)가 실패해도 1)의 고유번호는 유지한다. 반대로 1)이 실패하면 2)는 시도하지
// 않는다. 근거 없는 소재지를 JUSO에 던지면 엉뚱한 PNU가 붙기 때문이다.
//
// 소유자명은 이 경로의 어떤 함수에도 입력으로 들어오지 않고, 질의 문자열은
// 행정구역·지번 정규식이 뽑아낸 토큰만으로 조립한다(구조적으로 유출 불가).

import { extractLegalLot, unitKey } from "./unit-match.mjs";

export const PNULESS_IROS_VERSION = "pnuless-iros-v1";

// PNU는 없지만 주소 자체는 외부 원천이 정상으로 확인해 준 상태만 허용한다.
// AMBIGUOUS(복수 PNU)는 기존 R-ADDR-AMBIGUOUS-PNU-IROS가 담당하고,
// FAILED/HUMAN_INPUT_ERROR는 주소 문자열 자체를 믿을 수 없으므로 제외한다.
export const PNULESS_ELIGIBLE_ADDRESS_STATUSES = Object.freeze([
  "NAVER_CONFIRMED_PNU_FAILED"
]);

const ELIGIBLE = new Set(PNULESS_ELIGIBLE_ADDRESS_STATUSES);

function text(value) {
  return String(value ?? "").trim();
}

function pnuOf(value) {
  const pnu = text(value);
  return /^\d{19}$/.test(pnu) ? pnu : "";
}

// 지번주소에서 `시도 … 법정동 지번`까지만 남긴다. 뒤에 붙은 건물명·동·호·
// 층 표기는 IROS 완전수집의 검색 범위를 좁혀 버리므로 잘라낸다.
export function lotScopedAddress(value) {
  const source = text(value);
  const lot = extractLegalLot(source);
  if (!lot) return "";
  return source.slice(0, lot.lotEnd).replace(/\s+/g, " ").trim();
}

// IROS 조회에 쓸 주소 원천. jibunAddr가 없으면 네이버가 돌려준 지번주소를 쓴다.
function addressSources(result) {
  return [
    { source: "jibunAddr", value: result?.jibunAddr },
    { source: "naverJibunAddr", value: result?.naverJibunAddr },
    { source: "naverAddr", value: result?.naverAddr }
  ];
}

// 이 행을 PNU 없이 IROS로 조회할 수 있는가. 조회주소·동·호가 모두 확정적일
// 때만 계획을 만든다. 호가 없으면 세대를 특정할 수 없으므로 대상이 아니다.
export function buildPnulessIrosPlan(row) {
  const result = row?.result;
  if (!result || !ELIGIBLE.has(text(result.status))) return null;
  if (pnuOf(result.pnu)) return null;
  const ho = unitKey(result.unit?.ho, "ho");
  if (!ho) return null;

  for (const { source, value } of addressSources(result)) {
    const address = lotScopedAddress(value);
    if (!address) continue;
    return {
      version: PNULESS_IROS_VERSION,
      address,
      addressSource: source,
      dong: unitKey(result.unit?.dong, "dong"),
      ho,
      // PNU가 없으면 "이 지번이 맞다"는 독립 근거가 JUSO에 없다. 건물명이
      // 있는 행은 기존 검토 플래그 경로로 건물명 교차검증까지 강제한다.
      strictBuilding: Boolean(text(result.bdNm)),
      groupKey: `PNULESS:${address}`
    };
  }
  return null;
}

export function isPnulessIrosRow(row) {
  return Boolean(buildPnulessIrosPlan(row));
}

// 배치가 실제로 조회할 때 쓰는 임시 결과. 원본 result를 덮지 않고, 매칭
// 계약이 요구하는 필드만 채운 사본을 만든다. PNU는 끝까지 비워 둔다.
export function pnulessProbeResult(result, plan) {
  return {
    ...result,
    status: "CONFIRMED",
    pnu: null,
    jibunAddr: plan.address,
    irosQuery: plan.address,
    isJip: true,
    reviewNeeded: plan.strictBuilding
      ? (result?.reviewNeeded || "pnuless_naver_address")
      : null,
    validation: {
      status: "NOT_AVAILABLE",
      reason: "PNU 미확보 주소의 IROS 세대검증용 임시후보",
      inputSgg: "",
      resultSgg: ""
    }
  };
}

// IROS가 확정한 세대의 소재지를 JUSO 질의어로 되돌린다. 등기부 소재지는
// `부산광역시 남구 대연동 100 삼성아파트 제106동 제1002호` 형태이므로
// 지번까지만 남기면 건물·동·호 표기가 전부 떨어져 나간다.
export function irosSojaeQuery(candidate) {
  for (const value of [candidate?.sojae, candidate?.add_item]) {
    const query = lotScopedAddress(value);
    if (query) return query;
  }
  return "";
}

function sameLot(left, right) {
  const a = extractLegalLot(left);
  const b = extractLegalLot(right);
  if (!a || !b) return false;
  return a.legal === b.legal && a.mountain === b.mountain && a.lot === b.lot;
}

// JUSO 역조회 결과를 받아들일지 판정한다. 자동확정 조건은 세 가지 모두다.
//   - JUSO가 19자리 PNU를 돌려줬다
//   - JUSO 지번주소의 법정동·산여부·지번이 IROS 소재지와 정확히 같다
//   - 그 지번이 실제로 조회에 썼던 주소와도 같다(다른 지번으로 옮겨가지 않음)
export function acceptReversePnu({ irosCandidate, jusoCandidate, queryAddress }) {
  const sojae = irosSojaeQuery(irosCandidate);
  if (!sojae) {
    return { ok: false, reason: "IROS_SOJAE_UNPARSABLE", pnu: "" };
  }
  const pnu = pnuOf(jusoCandidate?.pnu);
  if (!pnu) {
    return { ok: false, reason: "JUSO_PNU_NOT_FOUND", pnu: "", sojae };
  }
  const jibun = text(jusoCandidate?.jibunAddr);
  if (!sameLot(jibun, sojae)) {
    return { ok: false, reason: "JUSO_LOT_MISMATCH", pnu: "", sojae, jibun };
  }
  if (queryAddress && !sameLot(sojae, queryAddress)) {
    return { ok: false, reason: "IROS_LOT_DRIFTED", pnu: "", sojae, jibun };
  }
  return { ok: true, reason: "IROS_SOJAE_JUSO_REVERSE_PNU", pnu, sojae, jibun };
}

// 역확정에 성공한 행의 주소 결과를 CONFIRMED로 승격한다. 동·호와 원문은
// 그대로 두고 주소·PNU·근거만 채운다.
export function applyReversePnu(result, {
  accepted,
  jusoCandidate,
  uniqueNo,
  jusoQuery = ""
}) {
  if (!accepted?.ok) return null;
  const evidence = [...new Set([
    ...(Array.isArray(result?.addressMatchEvidence) ? result.addressMatchEvidence : []),
    "IROS_SOJAE_JUSO_REVERSE_PNU"
  ])];
  return {
    ...result,
    status: "CONFIRMED",
    pnu: accepted.pnu,
    jibunAddr: text(jusoCandidate?.jibunAddr) || accepted.jibun,
    roadAddr: text(jusoCandidate?.roadAddr) || result?.roadAddr || "",
    bdNm: text(jusoCandidate?.bdNm) || result?.bdNm || "",
    bdMgtSn: text(jusoCandidate?.bdMgtSn) || null,
    isJip: jusoCandidate?.isJip ?? true,
    source: "iros-sojae-juso-reverse",
    addressMatchEvidence: evidence,
    validation: {
      status: "MATCH",
      reason: "IROS 확정 세대의 소재지를 JUSO에서 동일 지번으로 역확정",
      inputSgg: "",
      resultSgg: ""
    },
    pnulessRecovery: {
      version: PNULESS_IROS_VERSION,
      unique_no: text(uniqueNo),
      iros_sojae: accepted.sojae,
      juso_query: jusoQuery,
      juso_jibun: accepted.jibun,
      recovered_pnu: accepted.pnu
    }
  };
}

// 역확정을 시도하지 않았거나 거절된 행에도 사유를 남긴다. 고유번호는 이미
// 확보했으므로 주소 상태는 바꾸지 않는다.
export function markReversePnuRejected(result, reason, detail = {}) {
  return {
    ...result,
    pnulessRecovery: {
      version: PNULESS_IROS_VERSION,
      recovered_pnu: "",
      rejected_reason: text(reason) || "NOT_ATTEMPTED",
      ...detail
    }
  };
}

// 같은 배치 안에 이미 그 지번을 PNU까지 확정한 행이 있으면 JUSO를 다시 부를
// 이유가 없다. 지번 문자열이 곧 키이고, 한 지번에 PNU가 두 종류로 잡혀 있으면
// 그 지번은 색인에서 제외한다(어느 쪽이 맞는지 판단할 근거가 없다).
export function buildConfirmedLotPnuIndex(rows) {
  const collected = new Map();
  for (const row of Array.isArray(rows) ? rows : []) {
    const result = row?.result;
    if (!["CONFIRMED", "확정"].includes(text(result?.status))) continue;
    const pnu = pnuOf(result?.pnu);
    const key = lotScopedAddress(result?.jibunAddr);
    if (!pnu || !key) continue;
    if (!collected.has(key)) {
      collected.set(key, { pnu, candidate: result, conflict: false, rows: 0 });
    }
    const entry = collected.get(key);
    if (entry.pnu !== pnu) entry.conflict = true;
    entry.rows += 1;
  }
  const index = new Map();
  for (const [key, entry] of collected) {
    if (entry.conflict) continue;
    index.set(key, {
      pnu: entry.pnu,
      jibunAddr: text(entry.candidate?.jibunAddr),
      roadAddr: text(entry.candidate?.roadAddr),
      bdNm: text(entry.candidate?.bdNm),
      bdMgtSn: text(entry.candidate?.bdMgtSn) || null,
      isJip: entry.candidate?.isJip ?? true,
      source_row_count: entry.rows
    });
  }
  return index;
}

// 색인에서 찾은 PNU는 JUSO 응답과 같은 형태로 돌려준다. 이후 검증(지번 일치)은
// 네트워크 경로와 완전히 동일한 acceptReversePnu를 그대로 통과해야 한다.
export function lotIndexJusoCandidate(irosCandidate, index) {
  const query = irosSojaeQuery(irosCandidate);
  if (!query || !index) return null;
  const hit = index.get(query);
  if (!hit) return null;
  return { candidate: hit, query, source: "confirmed_lot_index" };
}

// 배치가 끝난 뒤 역확정을 시도할 행 목록. IROS가 한 건으로 확정된 PNU 없는
// 행만 대상이며, 이미 판정이 끝난 행은 다시 부르지 않는다.
export function planReversePnuRecovery(rows) {
  const out = [];
  const source = Array.isArray(rows) ? rows : [];
  for (let index = 0; index < source.length; index++) {
    const row = source[index];
    const plan = buildPnulessIrosPlan(row);
    if (!plan) continue;
    if (row?.result?.pnulessRecovery?.version === PNULESS_IROS_VERSION) continue;
    const reg = row?.reg;
    if (text(reg?.status) !== "RESOLVED" || !text(reg?.unique_no)) continue;
    const candidate = Array.isArray(reg.candidates) ? reg.candidates[0] : null;
    if (!candidate) continue;
    const query = irosSojaeQuery(candidate);
    if (!query) continue;
    out.push({
      index,
      rowId: text(row?.rowId),
      plan,
      query,
      irosCandidate: candidate,
      uniqueNo: text(reg.unique_no)
    });
  }
  return out;
}
