// 앱 버전 단일 소스.
//
// 여기 값은 사람이 정한다. 커밋·머지할 때마다 scripts/bump-version.mjs로
// 올리고, 무엇이 바뀌었는지 CHANGELOG 맨 앞에 한 줄 남긴다.
//
// 자동으로 찍히는 값과 역할이 다르다. 둘 다 화면에 보여야 한다.
//   APP_VERSION / RELEASED_AT  — 내가 이 변경을 만든 시점 (이 파일, 커밋에 포함)
//   build-info.js의 deployed_at / git_commit_sha
//                              — Vercel이 실제로 빌드·배포한 시점 (배포 때 생성)
// "고쳤다"와 "배포됐다"는 다른 사실이므로 한쪽만 보고 판단하지 않는다.

export const APP_VERSION = "1.15.0";

// ISO 8601. 표시할 때만 KST로 바꾼다.
export const RELEASED_AT = "2026-08-08T00:44:31+09:00";

export const CHANGELOG = Object.freeze([
  Object.freeze({
    version: "1.15.0",
    released_at: "2026-08-08T00:44:31+09:00",
    summary: "전처리 파싱 기준선(원본주소 19,819건) — 회귀 감사 4층위 전부 커버"
  }),
  Object.freeze({
    version: "1.14.0",
    released_at: "2026-08-08T00:35:31+09:00",
    summary: "회귀 감사 4층위 완성 — 정제율 체인 추출·간섭 감사, 공통모듈 원시함수 기준선, npm test 필수화"
  }),
  Object.freeze({
    version: "1.13.0",
    released_at: "2026-08-08T00:16:13+09:00",
    summary: "모듈 간섭 감사 필수화 + 무회귀 기권 3종 — RAW-UNIT·UNIT-PROFILE 평문집합 기권, 상가배제 집합건물 한정"
  }),
  Object.freeze({
    version: "1.12.0",
    released_at: "2026-08-07T23:44:21+09:00",
    summary: "회귀 방지 감사 필수화 — 판정 사다리 모듈 분리 + 실측 코퍼스 11,808건 기준선"
  }),
  Object.freeze({
    version: "1.11.3",
    released_at: "2026-08-07T17:07:56+09:00",
    summary: "형식이상 IROS 응답의 무한 재시도 종료 + 명시 대체지번으로 인계 (실측 1건)"
  }),
  Object.freeze({
    version: "1.11.2",
    released_at: "2026-08-07T14:37:34+09:00",
    summary: "숫자 행정동 표기 지번의 법정동 교정 재검색 (대치4동 889-56 → 대치동, 실측)"
  }),
  Object.freeze({
    version: "1.11.1",
    released_at: "2026-08-07T14:23:18+09:00",
    summary: "결과지 업로드 시 요약 시트가 아니라 전체 시트를 자동 선택 + 이어가기 인식 표시"
  }),
  Object.freeze({
    version: "1.11.0",
    released_at: "2026-08-07T14:18:06+09:00",
    summary: "결과지 xlsx 재업로드로 이어가기 — 확정·고유번호 행 복원, 실패 행만 재조회 (export-restore)"
  }),
  Object.freeze({
    version: "1.10.0",
    released_at: "2026-08-07T13:49:42+09:00",
    summary: "무기재 건물명 검토 게이트 예외(R-IROS-NAMELESS-REGISTRY-EXACT) — 정확 매칭 유일 + 건물명 빈값일 때만 통과 (실측 457행)"
  }),
  Object.freeze({
    version: "1.9.0",
    released_at: "2026-08-07T13:10:33+09:00",
    summary: "주소 실패 재조회 3경로 + FAILED 행 소재지 직조회 — 건물명 동↔지번 매핑·배제지번 재확인·네이버 지번 구조 (실측 근거)"
  }),
  Object.freeze({
    version: "1.8.0",
    released_at: "2026-08-07T11:43:54+09:00",
    summary: "IROS 재매칭 4종 — 동 접두 호 분해·층 필드 유일화·상가동 배제·동무시 유일화 확장 (실측 근거)"
  }),
  Object.freeze({
    version: "1.7.3",
    released_at: "2026-08-07T08:45:33+09:00",
    summary: "세션 인수인계 문서 추가 — 측정된 사실과 남은 과제, 다음 단계 절차"
  }),
  Object.freeze({
    version: "1.7.2",
    released_at: "2026-08-07T08:17:06+09:00",
    summary: "실제 등기 브리지에 붙어 완전후보와 매칭 판정을 보는 프로브 추가 (npm run probe:iros)"
  }),
  Object.freeze({
    version: "1.7.1",
    released_at: "2026-08-07T01:53:25+09:00",
    summary: "건물명이 동으로 시작할 때 앞 지번을 잃던 문제 수정 — 복수지번 342행 회수"
  }),
  Object.freeze({
    version: "1.7.0",
    released_at: "2026-08-06T23:10:02+09:00",
    summary: "PNU 없는 IROS 조회 + 소재지 역확정 PNU 복구 + 검증 세대 전파"
  }),
  Object.freeze({
    version: "1.6.2",
    released_at: "2026-08-06T16:50:21+09:00",
    summary: "IROS 세대매칭 E2E 회귀 테스트 추가 (npm run test:iros)"
  }),
  Object.freeze({
    version: "1.6.1",
    released_at: "2026-08-06T16:22:58+09:00",
    summary: "IROS 중복 동 표기 복구 + 등기부 동 체계가 다른 건물의 동 무시 매칭"
  }),
  Object.freeze({
    version: "1.6.0",
    released_at: "2026-08-06T16:15:56+09:00",
    summary: "IROS 세대매칭 4종 복구 — 층 유실·지하 표기·추정 동 무시·복수지번 소재지 폴백"
  }),
  Object.freeze({
    version: "1.5.0",
    released_at: "2026-08-06T14:01:16+09:00",
    summary: "건물명 위생(등기부 조각·택지표기·꼬리 제) + 동소 기준행 복제 + 2자 고유명 후보 좁히기"
  }),
  Object.freeze({
    version: "1.4.0",
    released_at: "2026-08-06T13:35:25+09:00",
    summary: "지번·건물명 일치 시 법정동 오기 교정(84행) + 있을 수 없는 층이 나오는 호수 절단 교정(7행)"
  }),
  Object.freeze({
    version: "1.3.0",
    released_at: "2026-08-06T13:17:08+09:00",
    summary: "원문에 붙어 있는 법정동 인식 + 리 일치 시 읍면 차이 허용 — 검증불일치 650건 중 272건 회수(오통과 0)"
  }),
  Object.freeze({
    version: "1.2.4",
    released_at: "2026-08-06T12:36:06+09:00",
    summary: "실행 중 동시 실행 한도를 콘솔에서 확인할 수 있게 한다 (진단만, 한도 변경 없음)"
  }),
  Object.freeze({
    version: "1.2.3",
    released_at: "2026-08-06T12:10:21+09:00",
    summary: "네이버 경로가 ReferenceError로 죽던 문제 수정 — 해당 행이 전부 시스템오류로 떨어졌다"
  }),
  Object.freeze({
    version: "1.2.2",
    released_at: "2026-08-06T11:32:53+09:00",
    summary: "네이버 공식 초당 10회 제한을 지키도록 호출 지점에서 원천별로 제한한다"
  }),
  Object.freeze({
    version: "1.2.1",
    released_at: "2026-08-06T11:22:27+09:00",
    summary: "JUSO와 네이버의 동시 실행 한도를 분리해 한 원천의 한도초과가 다른 원천을 끌어내리지 않게 한다"
  }),
  Object.freeze({
    version: "1.2.0",
    released_at: "2026-08-06T10:27:35+09:00",
    summary: "주소 배치를 적응형 동시 호출로 처리하고 API 장애 시 감속·자동중단이 실제로 동작한다"
  }),
  Object.freeze({
    version: "1.1.0",
    released_at: "2026-08-06T10:09:47+09:00",
    summary: "같은 원문 재업로드 시 이전 정제·등기 결과를 넘겨받아 재조회하지 않는다"
  }),
  Object.freeze({
    version: "1.0.0",
    released_at: "2026-08-06T01:05:00+09:00",
    summary: "버전 표기 도입 — 화면에서 실행 중인 빌드와 배포 시각을 확인할 수 있다"
  }),
  Object.freeze({
    version: "0.9.1",
    released_at: "2026-08-06T09:40:00+09:00",
    summary: "저장된 배치를 열 때 앱이 마운트 중 죽는 문제 수정 (#26)"
  }),
  Object.freeze({
    version: "0.9.0",
    released_at: "2026-08-05T13:58:00+09:00",
    summary: "백그라운드 복귀 화면 보호 · 체크포인트 분리 · 렌더 복구 화면 (#25)"
  }),
  Object.freeze({
    version: "0.8.0",
    released_at: "2026-08-05T01:33:00+09:00",
    summary: "주소 실패 복구 파이프라인 확장 (#24)"
  })
]);

function pad(value) {
  return String(value).padStart(2, "0");
}

// KST 고정. 사용자 로컬 시간대에 따라 값이 흔들리면 "언제 배포됐나"를
// 서로 다른 화면에서 대조할 수 없다.
export function formatKst(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const kst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  return `${kst.getUTCFullYear()}-${pad(kst.getUTCMonth() + 1)}-${pad(kst.getUTCDate())} ` +
    `${pad(kst.getUTCHours())}:${pad(kst.getUTCMinutes())} KST`;
}

// 화면 한 줄에 넣을 값들. 배포 정보가 없으면(로컬·미배포) 그 사실을 숨기지 않는다.
export function buildStamp(buildInfo = globalThis.__APP_BUILD_INFO__) {
  const sha = String(buildInfo?.git_commit_sha || "").slice(0, 7);
  const deployedAt = formatKst(buildInfo?.deployed_at);
  return {
    version: APP_VERSION,
    releasedAt: formatKst(RELEASED_AT),
    deployedAt,
    commit: sha,
    // 배포본인지 로컬인지 한눈에 구분한다.
    label: `v${APP_VERSION}`,
    detail: deployedAt
      ? `${deployedAt} 배포${sha ? ` · ${sha}` : ""}`
      : `${formatKst(RELEASED_AT)} 릴리스 · 배포정보 없음`
  };
}
