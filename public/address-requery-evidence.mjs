export const ADDRESS_REQUERY_EVIDENCE_VERSION = "address-requery-evidence-v1";

export const ADDRESS_REQUERY_ROUTES = Object.freeze({
  LOT_EXACT: "LOT_EXACT_REQUERY",
  ROAD_EXACT: "ROAD_EXACT_REQUERY",
  BUILDING: "BUILDING_REQUERY",
  UNIT_GROUP: "UNIT_GROUP_REQUERY",
  UNIDENTIFIABLE: "UNIDENTIFIABLE",
});

function clean(value) {
  return String(value ?? "").trim();
}

// 주소 조회 결과의 성공/실패 상태와 별개로, 원문에서 다음 자동 처리 경로를
// 만들 수 있는지를 기록한다. 이 증거는 첫 후보 선택이나 점수화에 쓰지 않고,
// 정확 주소 재조회 또는 집단 교차검증의 입력으로만 사용한다.
export function buildAddressRequeryEvidence(parsed, result = null) {
  if (!parsed || ["CONFIRMED", "확정"].includes(clean(result?.status))) return null;

  const region = [parsed.sidoFull || parsed.sido, parsed.sgg, parsed.eup, parsed.emd]
    .map(clean).filter(Boolean);
  const unit = {
    dong: clean(parsed.unit?.dong),
    floor: clean(parsed.unit?.floor),
    ho: clean(parsed.unit?.ho),
  };
  let route = ADDRESS_REQUERY_ROUTES.UNIDENTIFIABLE;
  let query = "";
  let evidence = "SOURCE_LACKS_ADDRESS_IDENTIFIER";

  if (clean(parsed.road) && clean(parsed.buldNo)) {
    route = ADDRESS_REQUERY_ROUTES.ROAD_EXACT;
    query = [...region.slice(0, 2), parsed.road, parsed.buldNo].filter(Boolean).join(" ");
    evidence = "EXPLICIT_ROAD_AND_BUILDING_NUMBER";
  } else if (clean(parsed.emd) && clean(parsed.jibun)) {
    route = ADDRESS_REQUERY_ROUTES.LOT_EXACT;
    query = [...region, parsed.jibun].filter(Boolean).join(" ");
    evidence = "EXPLICIT_LEGAL_DONG_AND_LOT";
  } else if (clean(parsed.bldName) && region.length) {
    route = ADDRESS_REQUERY_ROUTES.BUILDING;
    query = [...region, parsed.bldName].filter(Boolean).join(" ");
    evidence = "REGION_AND_BUILDING_NAME";
  } else if ((unit.dong || unit.ho) && region.length) {
    route = ADDRESS_REQUERY_ROUTES.UNIT_GROUP;
    query = region.join(" ");
    evidence = "REGION_AND_EXPLICIT_UNIT_FOR_GROUP_CROSSCHECK";
  }

  return {
    version: ADDRESS_REQUERY_EVIDENCE_VERSION,
    route,
    evidence,
    query,
    unit,
  };
}
