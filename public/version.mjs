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

export const APP_VERSION = "1.0.0";

// ISO 8601. 표시할 때만 KST로 바꾼다.
export const RELEASED_AT = "2026-08-06T01:05:00+09:00";

export const CHANGELOG = Object.freeze([
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
