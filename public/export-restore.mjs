// 결과지(내보낸 xlsx)에서 이어가기.
//
// 지금까지 이어가기는 이 브라우저의 IndexedDB에 저장된 배치에만 의존했다.
// 브라우저가 다르거나 저장소가 비워졌으면 확정 1.8만 행을 처음부터 다시
// 조회하는 수밖에 없었다(실측: 전량 재실행 보고). 결과지에는 확정 지번주소·
// PNU·등기고유번호가 전부 들어 있으므로, 그 파일을 다시 올리면 성공 행을
// 복원하고 실패 행만 다시 조회한다.
//
// 복원된 결과는 지문(fingerprint) 없이 만든다. pipeline-contract의
// isProtectedAddressSuccess가 "지문 없는 CONFIRMED+PNU 성공건은 보존"을,
// iros-run-contract의 isProtectedIrosSuccess가 "RESOLVED+고유번호 보호"를
// 이미 계약으로 보장하므로, 복원 행은 재조회 없이 그대로 재사용되고
// 실패 행(result 없음)만 현재 규칙으로 재정제된다.
//
// 복원 행은 결과지의 동·호를 unitOverride로 고정한다. 결과지 기준으로
// "이어가는" 경로이기 때문이다. 원문 파싱 규칙 개선까지 다시 적용하려면
// 원본 파일로 새로 실행하면 된다.

import { extractLegalLot } from "./unit-match.mjs";

export const EXPORT_RESTORE_VERSION = "export-restore-v1";

// 결과지 판별·복원에 필요한 열. 하나라도 없으면 결과지가 아니다.
const REQUIRED_COLUMNS = [
  "원본주소", "정제상태", "지번주소", "도로명주소", "동", "호",
  "PNU", "건물관리번호", "부동산구분", "등기상태", "등기고유번호"
];

function text(value) {
  return String(value ?? "").trim();
}

// 결과지 헤더인지 판별하고 열 인덱스를 만든다. 일반 원본 파일(주소 열 하나)은
// 필수 열이 없어 null이 되고, 기존 업로드 경로가 그대로 처리한다.
export function detectExportLayout(headerRow) {
  const header = (Array.isArray(headerRow) ? headerRow : []).map(text);
  const columns = {};
  for (const name of REQUIRED_COLUMNS) {
    const index = header.indexOf(name);
    if (index < 0) return null;
    columns[name] = index;
  }
  // 선택 열(있으면 함께 복원)
  for (const name of ["검토유형", "소재지우편번호", "소유자명", "세대상태"]) {
    const index = header.indexOf(name);
    if (index >= 0) columns[name] = index;
  }
  const addrIdx = columns["원본주소"];
  return {
    version: EXPORT_RESTORE_VERSION,
    addrIdx,
    columns,
    // 원본주소 앞의 열들이 원본 파일에서 온 부가열이다(부동산번호 등).
    extraColIdxs: header.slice(0, addrIdx).map((_, i) => i),
    extraHeaders: header.slice(0, addrIdx).map((h, i) => h || `열${i + 1}`)
  };
}

// 지번주소에서 지번 뒤에 붙은 건물명을 되살린다.
// "강원특별자치도 동해시 묵호진동 1-83 삼본아파트" → "삼본아파트"
function buildingNameOf(jibunAddr) {
  const source = text(jibunAddr);
  const lot = extractLegalLot(source);
  if (!lot) return "";
  return source.slice(lot.lotEnd).trim();
}

function restoreResult(cell) {
  if (cell("정제상태") !== "CONFIRMED") return null;
  const pnu = cell("PNU");
  if (!/^\d{19}$/.test(pnu)) return null;
  const jibunAddr = cell("지번주소");
  const dong = cell("동");
  const ho = cell("호");
  const gubun = cell("부동산구분");
  return {
    status: "CONFIRMED",
    pnu,
    bdMgtSn: cell("건물관리번호") || null,
    jibunAddr: jibunAddr || null,
    roadAddr: cell("도로명주소") || null,
    bdNm: buildingNameOf(jibunAddr) || null,
    unit: { dong: dong || null, ho: ho || null },
    isJip: gubun.includes("집합") || Boolean(ho),
    reviewNeeded: cell("검토유형") || null,
    exportRestore: EXPORT_RESTORE_VERSION,
    validation: { status: "NOT_AVAILABLE", reason: "결과지 복원", inputSgg: "", resultSgg: "" }
  };
}

function restoreReg(cell) {
  const uniqueNo = cell("등기고유번호");
  if (!uniqueNo) return null;
  const state = cell("등기상태");
  if (state !== "조회완료" && state !== "RESOLVED") return null;
  return {
    status: "RESOLVED",
    unique_no: uniqueNo,
    complete: true,
    exportRestore: EXPORT_RESTORE_VERSION,
    message: "결과지에서 복원"
  };
}

// 결과지 본문을 배치 행으로 복원한다. 결과지는 이미 행 분리가 끝난 파일이므로
// 다시 쪼개지 않고 1:1로 만든다.
export function restoreRowsFromExport(body, layout) {
  const rows = [];
  const source = Array.isArray(body) ? body : [];
  for (let index = 0; index < source.length; index++) {
    const record = source[index] || [];
    const cell = (name) =>
      layout.columns[name] === undefined ? "" : text(record[layout.columns[name]]);
    const raw = cell("원본주소");
    if (!raw) continue;
    const dong = cell("동");
    const ho = cell("호");
    const result = restoreResult(cell);
    // 등기 복원은 주소 복원이 성립한 행에서만 한다. 주소 근거 없는 고유번호는
    // 재사용하지 않는다.
    const reg = result ? restoreReg(cell) : null;
    const row = {
      rowId: `row-${index + 1}`,
      raw,
      extra: layout.extraColIdxs.map((i) => record[i] ?? ""),
      zip: cell("소재지우편번호"),
      owner: cell("소유자명"),
      result
    };
    if (dong || ho) row.unitOverride = { dong: dong || null, ho: ho || null };
    if (reg) row.reg = reg;
    rows.push(row);
  }
  return rows;
}

export function countRestored(rows) {
  const source = Array.isArray(rows) ? rows : [];
  return {
    address: source.filter((row) => row.result).length,
    iros: source.filter((row) => row.reg).length
  };
}
