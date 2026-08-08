// 결과 행의 "사람용 설명" — 검증하는 사람이 코드명 없이 읽고 무엇을 하면
// 되는지 알 수 있는 한 문장을 만든다. 내보내기의 "처리설명" 열이 된다.
//
// 원칙:
//   - 무엇을 시도했는지(국가 주소검색·네이버) → 어디서 막혔는지 → 사람이
//     다음에 할 일 순서로 쓴다.
//   - 등기 실패는 "[실제 이유]"를 등기부 후보에서 직접 도출한다(요청 동이
//     없는지, 동은 있는데 호가 없는지) — 코드가 아는 사실만 적고 추정은
//     "가능"이라고 표시한다.

import { dongAliasKey, unitKey } from "./unit-match.mjs";

export const HUMAN_EXPLANATION_VERSION = "human-explanation-v1";

function text(value) {
  return String(value ?? "").trim();
}

// 주소를 어떤 검색으로 확정했는지 사람 말로.
function addressMeans(result) {
  const source = text(result?.source);
  const level = text(result?.searchLevel);
  if (source === "naver" || level === "L3" || text(result?.naverJibunAddr)) {
    return "국가 주소검색(JUSO)과 네이버 지역검색을 이용해 주소를 확정했으나";
  }
  if (source.includes("전파") || source.includes("교집합")) {
    return "같은 묶음의 확정 주소를 근거로 주소를 확정했으나";
  }
  if (source === "IROS후보교차검증" || source.includes("PNU")) {
    return "복수 후보를 등기부 교차검증으로 좁혀 주소를 확정했으나";
  }
  return "국가 주소검색(JUSO)으로 주소를 확정했으나";
}

// 세대미일치의 실제 이유를 등기부 후보에서 도출한다.
function unitNotFoundReason(result, reg) {
  const candidates = (reg?.candidates || []).filter((candidate) =>
    String(candidate?.real_cls_cd || candidate?.gubun || "").includes("집합"));
  if (!candidates.length) {
    return "확정한 지번의 등기부에서 집합건물 세대를 찾지 못했습니다";
  }
  const wantDong = dongAliasKey(result?.unit?.dong);
  const wantHo = unitKey(result?.unit?.ho, "ho");
  const dongs = [...new Set(candidates.map((candidate) =>
    dongAliasKey(candidate?.dong)).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, "ko", { numeric: true }));
  if (wantDong && dongs.length && !dongs.includes(wantDong)) {
    const shown = dongs.slice(0, 8).map((dong) => `${dong}동`).join("·");
    const rest = dongs.length > 8 ? ` 외 ${dongs.length - 8}종` : "";
    return `등기부에는 ${shown}${rest}만 있고 요청한 ${wantDong}동이 없습니다`;
  }
  if (wantDong && wantHo) {
    return `${wantDong}동은 등기부에 있지만 ${wantHo}호가 없습니다` +
      "(합병·소멸 또는 호 표기 차이 가능)";
  }
  if (wantHo) {
    return `등기부에서 ${wantHo}호와 정확히 일치하는 세대를 찾지 못했습니다`;
  }
  return "요청한 동·호와 정확히 일치하는 세대가 없습니다";
}

const RETRYABLE_REG = new Set([
  "REG_SERVICE_UNAVAILABLE", "REG_COLLECTION_DEFERRED", "REG_PARTIAL_RESPONSE",
  "REG_PARSE_ERROR", "REG_PARSE_INCOMPLETE", "REG_HTTP_ERROR",
  "REG_SESSION_ERROR", "REG_RATE_LIMIT", "REG_TIMEOUT", "REG_ERROR"
]);

// 성공 행: 어떤 근거로 확정됐는지 짧게. 특수 복구 모듈만 사람 말로 옮긴다.
const SUCCESS_MODULE_NOTES = [
  ["R-IROS-VERIFIED-DONG-MAP", "원문 동 표기가 등기부와 다른 단지라, 이미 확정된 이웃 세대들이 검증한 동 대응으로 확정했습니다."],
  ["R-IROS-DONG-LOT-RELOCATE", "요청한 동이 다른 지번에 등기돼 있어(정부 동목록으로 확인) 그 지번의 등기부에서 확정했습니다."],
  ["R-IROS-DONG-AGNOSTIC-HO", "원문 동 표기가 등기부와 달랐지만, 요청한 호가 이 지번에 단 한 세대뿐이라 그 세대로 확정했습니다."],
  ["R-IROS-DONG-AGNOSTIC@", "원문에 동 표기가 없어 추정 동을 무시하고, 호가 유일한 세대로 확정했습니다."],
  ["R-IROS-FLOOR-DISAMBIG", "같은 동·호가 층별로 여럿이라 원문의 층 표기로 한 세대를 확정했습니다."],
  ["R-IROS-RAW-FLOOR-HO", "원문의 층-호 표기(지N-M)를 등기부의 층·호와 맞춰 확정했습니다."],
  ["R-IROS-MULTILOT", "원문에 적힌 다른 지번들의 등기부를 모두 조회해 한 세대로 수렴해 확정했습니다."],
  ["R-IROS-RAW-UNIT", "원문의 동·호 표기를 재해석해(중복 동 표기 등) 등기부와 일치하는 세대로 확정했습니다."]
];

// 한 행의 사람용 설명. row = { raw, result, reg }
export function explainRowForHuman(row) {
  const result = row?.result;
  const reg = row?.reg;
  const status = text(result?.status);

  // ── 주소 단계에서 끝난 행 ──
  if (!status || status === "미실행") return "아직 처리되지 않은 행입니다.";
  if (status !== "CONFIRMED" && status !== "확정") {
    if (status === "FAILED" && text(result?.failKind) === "TRANSIENT") {
      return "일시적인 통신 오류로 검색이 완료되지 않았습니다. 재실행하면 자동으로 다시 시도합니다.";
    }
    if (status === "FAILED") {
      return "국가 주소검색(JUSO)도 해보고 네이버 지역검색도 해봤는데 이 주소를 찾지 " +
        "못했습니다. 원문을 직접 확인해서 정제 실패를 확정해 주세요.";
    }
    if (status === "HUMAN_INPUT_ERROR") {
      return "원문 주소가 검색 가능한 형태가 아닙니다(지역·지번·건물명이 부족). " +
        "원문을 직접 확인해서 보완하거나 실패를 확정해 주세요.";
    }
    if (status === "AMBIGUOUS") {
      return "주소 검색 결과가 여러 곳으로 갈려 하나로 확정하면 오확정 위험이 있어 " +
        "멈췄습니다. 후보 중 맞는 곳을 직접 골라 주세요.";
    }
    if (status === "VALIDATION_FAILED") {
      return "주소는 검색됐지만 지역 또는 건물명이 원문과 달라 잘못된 확정일 위험이 " +
        "있어 보류했습니다. 원문과 검색 결과를 비교해서 확정해 주세요.";
    }
    if (status === "NAVER_CONFIRMED_PNU_FAILED") {
      return "네이버 지역검색은 이 장소를 확인했지만 공식 지번 주소로 연결하지 " +
        "못했습니다. 지번을 직접 확인해 주세요.";
    }
    if (status === "SYSTEM_ERROR") {
      return "시스템 오류로 처리가 중단됐습니다. 재실행하면 자동으로 다시 시도합니다.";
    }
    return "주소를 확정하지 못했습니다. 원문을 직접 확인해 주세요.";
  }

  // ── 주소 확정 + 등기 단계 ──
  const regStatus = text(reg?.status);
  if (!reg) {
    return "주소는 확정됐고, 등기 조회는 아직 실행되지 않았습니다.";
  }
  if (regStatus === "RESOLVED" && text(reg?.unique_no)) {
    const modules = (reg?.applied_modules || []).join(",");
    for (const [tag, note] of SUCCESS_MODULE_NOTES) {
      if (modules.includes(tag)) return `주소와 등기고유번호를 확정했습니다. ${note}`;
    }
    return "주소와 등기고유번호를 확정했습니다. 등기부의 동·호가 원문과 정확히 일치합니다.";
  }
  if (regStatus === "UNIT_INPUT_REQUIRED") {
    return "주소는 확정했지만 집합건물이라 호 정보가 있어야 세대를 조회할 수 있습니다. " +
      "호를 입력해 주세요.";
  }
  if (RETRYABLE_REG.has(regStatus)) {
    return `${addressMeans(result)} 등기소 응답 오류로 수집이 완료되지 않았습니다. ` +
      "재실행하면 자동으로 다시 시도합니다.";
  }
  if (regStatus === "REG_MULTI") {
    const count = (reg?.candidates || []).length;
    return `${addressMeans(result)} 같은 표기의 세대가 ${count}건이라 하나로 확정하면 ` +
      "오확정 위험이 있어 멈췄습니다. 후보 중에서 직접 골라 주세요.";
  }
  if (regStatus === "REG_VALIDATION_FAILED") {
    return `${addressMeans(result)} 등기부의 건물명이 원문과 달라 잘못된 확정일 위험이 ` +
      "있어 보류했습니다. 등기부 표기를 확인해 주세요.";
  }
  if (regStatus === "REG_UNIT_NOT_FOUND") {
    return `${addressMeans(result)} 등기고유번호가 검색되지 않았습니다. 그 이유는 ` +
      `"${unitNotFoundReason(result, reg)}"입니다. 등기부 원본 표기를 확인해서 실패를 ` +
      "확정해 주세요.";
  }
  if (regStatus) {
    return `${addressMeans(result)} 등기고유번호가 검색되지 않았습니다` +
      `(${text(reg?.message) || regStatus}).`;
  }
  return "주소는 확정됐고, 등기 조회는 아직 실행되지 않았습니다.";
}
