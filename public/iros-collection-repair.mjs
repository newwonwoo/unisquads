// 무한 재시도에 빠지는 IROS 부분응답 처리.
//
// 실측(2026-08-07): "전북특별자치도 익산시 모현동1가 648-6 이한APT"로 조회하면
// IROS가 총건수 없이 0건을 돌려준다(complete=N, total_count=null). 세 번 연속
// 같은 응답이었다 — 일시 오류가 아니라 그 조회 문구에 대한 결정적 응답이다.
// 그런데 REG_PARTIAL_RESPONSE는 재시도 대상이라 배치가 이 행을 영원히 다시
// 집어넣는다("남은 1건 · 재시도 1건"이 끝나지 않는다).
//
// 두 가지를 구분한다.
//   1. 진짜 부분응답 — 총건수는 왔는데 일부만 수신. 다시 부르면 채워질 수 있다.
//   2. 형식이상 응답 — 총건수 자체가 없고 0건. 다시 불러도 같은 답이다.
//
// 2번은 재시도로 풀리지 않으므로, 원문에 명시된 다른 지번이 있으면 그 지번으로
// 넘기고(기존 명시 대체지번 복구가 정확 매칭으로 판정한다), 없으면 재시도
// 대상에서 빼 무한 루프를 끝낸다.
//
// 실측 확인: 위 행의 원문은 "648-5,648-8"을 명시하고 있고, 두 지번 모두
// B동 302호를 같은 고유번호(2149-1996-056846)로 정확 매칭한다. 확정 지번
// 648-6의 등기부에는 A동뿐이라 그 지번에서는 애초에 답이 나올 수 없었다.

import { alternateRawLotAddresses } from "./unit-match.mjs";

export const IROS_COLLECTION_REPAIR_VERSION = "iros-collection-repair-v1";

function text(value) {
  return String(value ?? "").trim();
}

// 총건수가 아예 없고 수신도 0건인 응답. 같은 문구로 다시 불러도 같은 답이다.
export function isMalformedCollection(collection) {
  if (!collection || typeof collection !== "object") return false;
  if (collection.complete === true) return false;
  if (collection.total_count !== null && collection.total_count !== undefined) return false;
  const received = Number(
    collection.raw_received_count ?? collection.received_count ?? 0
  );
  return !(received > 0);
}

export function isMalformedCollectionResult(reg) {
  return Boolean(reg) && reg.collection_malformed === true;
}

// 형식이상 응답을 받은 행이 넘어갈 곳. 원문에 명시된 같은 법정동의 다른
// 지번만 쓴다(생략된 "외 N필지"는 만들지 않는다 — 기존 계약 그대로).
export function planMalformedCollectionRecovery(row, normalizedAddress) {
  const addresses = alternateRawLotAddresses(
    text(row?.raw),
    text(normalizedAddress)
  );
  if (!addresses.length) return null;
  return {
    version: IROS_COLLECTION_REPAIR_VERSION,
    addresses
  };
}
