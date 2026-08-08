// 감사 공용 — 실측 코퍼스에서 판정 요청을 만든다.
//
// 회귀 감사(audit-matching-regression)와 모듈 간섭 감사
// (audit-module-interference)가 같은 요청 집합을 써야 두 결과를 겹쳐 읽을 수
// 있다. 요청 생성 규칙을 바꾸면 두 감사의 기준선을 함께 다시 만든다.
//
// 실제 존재하는 조합만 넣으면 정확 매칭에서 전부 끝나 폴백 사다리(새 규칙이
// 사는 곳)가 한 번도 열리지 않는다. 그래서 빗나가는 요청도 함께 만든다.
// 후보(등기부 데이터)는 전부 실측이고, 요청만 실패 유형을 재현한다.
//
//   1. 실제 (동, 호) 조합            정확 매칭 — 기존 확정이 뒤집히는지
//   2. 동 없이 호만                  단일동·상가동 배제 경로
//   3. 등기부에 없는 동 + 있는 호     동무시 매칭(R-IROS-DONG-AGNOSTIC-HO)
//   4. 원문에 층이 적힌 형태          층 유일화(R-IROS-FLOOR-DISAMBIG)
//   5. 있는 동 + 없는 호              미일치·프로파일 복구 경로
//   6. 있는 동 × 있는 호(짝 아님)     오확정이 생기는 자리
//   7. 중복 동 표기("106동 1동")      원문 표기 복구(R-IROS-RAW-UNIT)
//   8. 원문 지X-N 층-호               층-호 재해석(R-IROS-RAW-FLOOR-HO)
//
// 사다리의 모든 모듈이 기준선에서 최소 1회 발화해야 한다 — 계약 테스트
// (test_regression_audit_contract)가 이를 강제하므로, 새 모듈을 추가하면
// 그 모듈이 열리는 요청 클래스(또는 코퍼스 지번)도 함께 넣어야 통과한다.

import { readFile } from "node:fs/promises";
import { decideUnitCandidates } from "../public/unit-decision.mjs";
import {
  filterUnitPropertyCandidates,
  rawUnitRecoveryVariants
} from "../public/unit-match.mjs";

export const CORPUS_URL = new URL("../tests/fixtures/iros-candidate-corpus.json", import.meta.url);

const MISS_DONG_SAMPLE = 3;   // 다른 지번에서 빌려올 "없는 동" 개수
const MISS_CASE_LIMIT = 40;   // 지번당 빗나감 요청 상한(감사 시간 관리)

export async function loadCorpus() {
  return JSON.parse(await readFile(CORPUS_URL, "utf8"));
}

export function requestsFor(entry, otherDongs) {
  const candidates = entry.candidates;
  const dongs = new Set(
    candidates.map((c) => String(c?.dong ?? "").trim()).filter(Boolean)
  );
  const hos = [...new Set(
    candidates.map((c) => String(c?.ho ?? "").trim()).filter(Boolean)
  )];
  const base = entry.raw || entry.id;
  const seen = new Set();
  const out = [];
  const add = (dong, ho, raw) => {
    const key = `${dong}|${ho}|${raw}`;
    if (seen.has(key) || !ho) return;
    seen.add(key);
    out.push({ dong, ho, raw });
  };

  for (const candidate of candidates) {
    add(String(candidate?.dong ?? "").trim(), String(candidate?.ho ?? "").trim(), base);
  }
  for (const ho of hos) add("", ho, base);

  const missDongs = [...otherDongs].filter((d) => !dongs.has(d)).slice(0, MISS_DONG_SAMPLE);
  for (const dong of missDongs) {
    for (const ho of hos.slice(0, MISS_CASE_LIMIT)) {
      add(dong, ho, `${base} ${dong}동 ${ho}호`);
    }
  }

  for (const candidate of candidates.slice(0, MISS_CASE_LIMIT)) {
    const floor = String(candidate?.floor ?? "").trim();
    const ho = String(candidate?.ho ?? "").trim();
    if (!ho || !/^\d+$/.test(floor)) continue;
    const dong = String(candidate?.dong ?? "").trim();
    add(dong, ho, `${base} ${dong ? `${dong}동 ` : ""}${Number(floor)}층${ho}호`);
  }

  const missHo = String(
    Math.max(0, ...hos.map((h) => Number(h)).filter(Number.isFinite)) + 7777
  );
  for (const dong of [...dongs].slice(0, MISS_DONG_SAMPLE)) add(dong, missHo, base);

  const paired = new Set(
    candidates.map((c) => `${String(c?.dong ?? "").trim()}|${String(c?.ho ?? "").trim()}`)
  );
  let crossed = 0;
  for (const dong of dongs) {
    for (const ho of hos) {
      if (crossed >= MISS_CASE_LIMIT) break;
      if (paired.has(`${dong}|${ho}`)) continue;
      add(dong, ho, `${base} ${dong}동 ${ho}호`);
      crossed += 1;
    }
    if (crossed >= MISS_CASE_LIMIT) break;
  }

  // 7. 중복 동 표기: "106동 1동 102호"를 전처리가 동1·호102로 읽던 실측
  // (효자동 한신휴플러스)을 재현한다. 지번에 동 1이 실존하면 정확 매칭이
  // 열려 복구 경로가 안 보이므로, 없는 지번에서만 만든다.
  if (!dongs.has("1")) {
    let dup = 0;
    for (const candidate of candidates) {
      if (dup >= MISS_CASE_LIMIT / 4) break;
      const dong = String(candidate?.dong ?? "").trim();
      const ho = String(candidate?.ho ?? "").trim();
      if (!dong || !ho || !/^\d+$/.test(ho)) continue;
      add("1", ho, `${base} ${dong}동 1동 ${ho}호`);
      dup += 1;
    }
  }

  // 8. 원문 지X-N 층-호: "지3-2"를 전처리가 동3·호2로 읽던 실측(갈산
  // 하나상가)을 재현한다. 층이 숫자이고 호가 짧은 후보에서만 — 지하 중의
  // 기권까지 함께 기준선에 남는다.
  let flho = 0;
  for (const candidate of candidates) {
    if (flho >= MISS_CASE_LIMIT / 4) break;
    const floor = String(candidate?.floor ?? "").trim();
    const ho = String(candidate?.ho ?? "").trim();
    const buldnm = String(candidate?.buldnm ?? "").trim();
    if (!buldnm || !/^\d{1,2}$/.test(floor) || !/^\d{1,3}$/.test(ho)) continue;
    add(String(Number(floor)), ho, `${base} ${buldnm} 지${Number(floor)}-${ho}`);
    flho += 1;
  }

  return out.sort((a, b) =>
    a.dong.localeCompare(b.dong) || a.ho.localeCompare(b.ho) || a.raw.localeCompare(b.raw));
}

export function allDongsOf(corpus) {
  const allDongs = new Set();
  for (const entry of corpus.lots) {
    for (const candidate of entry.candidates) {
      const dong = String(candidate?.dong ?? "").trim();
      if (dong) allDongs.add(dong);
    }
  }
  return allDongs;
}

// 판정 한 건. raw는 요청이 지정한 원문을 쓴다 — 원문 표기 복구 규칙
// (층·중복 동 등)이 실제로 열리는 조건을 그대로 재현하기 위해서다.
//
// pool은 운영(app.js)과 같은 전처리를 거친다: 폐쇄 제외 → 부동산구분(집합건물
// + 명시 전유부) 필터. 이걸 건너뛰면 감사가 운영에서는 진입 불가능한 후보
// (토지·일반건물)로 가짜 충돌을 만든다 — 실제로 있었다(구분 "건물" 후보가
// 사다리에 들어와 충돌로 보고됨).
export function decideOne(entry, request, options = {}) {
  const unit = { dong: request.dong, ho: request.ho };
  const raw = request.raw || entry.raw || "";
  const rawUnitVariants = rawUnitRecoveryVariants(raw, unit);
  const open = (entry.candidates || []).filter(
    (candidate) => !String(candidate?.state || "").includes("폐쇄")
  );
  const typed = filterUnitPropertyCandidates(
    open, request.dong, request.ho, rawUnitVariants
  );
  return decideUnitCandidates({
    pool: typed.candidates,
    wantDong: request.dong,
    wantHo: request.ho,
    raw,
    unit,
    bdNm: entry.bdNm || "",
    subBuilding: null,
    rawUnitVariants
  }, options);
}
