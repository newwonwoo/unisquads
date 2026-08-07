#!/usr/bin/env node
// 모듈 간 간섭 감사 — 사다리의 두 모듈이 같은 요청에 서로 다른 고유번호를
// 낼 수 있는지 전수로 잰다.
//
// 회귀 감사(audit-matching-regression)는 "규칙을 바꾸면 판정이 달라지는가"를
// 본다. 이 감사는 다른 질문을 본다: "지금 사다리에서, 어떤 모듈이 먼저냐가
// 답을 정하고 있지는 않은가."
//
// 방법: 실측 코퍼스의 모든 요청에 대해 전체 사다리로 판정한 뒤, 그 판정에
// 실제로 발화한 사다리 모듈을 하나씩 차단하고 다시 판정한다.
//   - 차단해도 같은 고유번호        → 중복 근거(안전)
//   - 차단하면 미확정(NONE/MULTI)   → 그 모듈이 단독 소유(안전 — 추가만 한다)
//   - 차단하면 "다른" 고유번호      → 충돌. 모듈 순서가 답을 정하고 있다.
//
// 충돌은 배열(순서) 조정으로 해소되지 않는다 — 순서를 바꾸면 반대쪽 답이
// 이길 뿐이다. 두 모듈 중 하나가 그 조건에서 기권하도록(무회귀 모듈로)
// 고쳐야 하며, 그때까지 이 감사는 실패한다. 기준선이 없는 불변식 검사다.
//
// 사용법
//   node scripts/audit-module-interference.mjs             검사(기본)
//   node scripts/audit-module-interference.mjs --verbose    충돌 전부 출력
//   node scripts/audit-module-interference.mjs --matrix     모듈 소유 통계까지 출력

import { DECISION_MODULE_KEYS, decisionSignature } from "../public/unit-decision.mjs";
import { allDongsOf, decideOne, loadCorpus, requestsFor } from "./audit-requests.mjs";

const argv = process.argv.slice(2);
const has = (name) => argv.includes(`--${name}`);

// 사다리 모듈 키 ↔ 적용 태그. 발화하지 않은 모듈은 차단해 봐야 판정이 같으므로
// 발화한 모듈만 차단해 본다(감사 시간 관리).
const TAG_BY_KEY = {
  SHOP_DONG_EXCLUSION: "R-IROS-SHOP-DONG-EXCLUSION@",
  SINGLE_DONG: "R-IROS-SINGLE-DONG-HO@",
  DONG_AGNOSTIC: "R-IROS-DONG-AGNOSTIC@",
  HO_BUILDING: "R-IROS-HO-BUILDING@",
  RAW_UNIT: "R-IROS-RAW-UNIT@",
  UNIT_PROFILE: "R-IROS-UNIT-PROFILE@",
  FLOOR_DISAMBIG: "R-IROS-FLOOR-DISAMBIG@",
  DONG_AGNOSTIC_HO: "R-IROS-DONG-AGNOSTIC-HO@"
};

function firedKeys(decision) {
  const tags = decision.appliedModules || [];
  return DECISION_MODULE_KEYS.filter((key) =>
    tags.some((tag) => tag.startsWith(TAG_BY_KEY[key])));
}

function uniqueOf(signature) {
  return signature.startsWith("RESOLVED:") ? signature.split(":")[1] : "";
}

const corpus = await loadCorpus();
const allDongs = allDongsOf(corpus);

let cases = 0;
let laddered = 0;
const conflicts = [];
const ownership = new Map(); // key -> {sole, redundant}
const bump = (key, field) => {
  if (!ownership.has(key)) ownership.set(key, { sole: 0, redundant: 0 });
  ownership.get(key)[field] += 1;
};

for (const entry of corpus.lots) {
  for (const request of requestsFor(entry, allDongs)) {
    cases += 1;
    const full = decideOne(entry, request);
    const fired = firedKeys(full);
    if (!fired.length) continue;
    laddered += 1;
    const fullSig = decisionSignature(full);
    const fullUnique = uniqueOf(fullSig);
    for (const key of fired) {
      const altSig = decisionSignature(decideOne(entry, request, { disabled: [key] }));
      const altUnique = uniqueOf(altSig);
      if (fullUnique && altUnique && altUnique !== fullUnique) {
        conflicts.push({
          lotId: entry.id,
          request: `${request.dong}|${request.ho}|${request.raw}`,
          module: key,
          withModule: fullSig,
          withoutModule: altSig
        });
      } else if (fullUnique && altUnique === fullUnique) {
        bump(key, "redundant");
      } else {
        bump(key, "sole");
      }
    }
  }
}

console.log(
  `모듈 간섭 감사 — 판정 ${cases}건 중 사다리 모듈 발화 ${laddered}건`
);

if (has("matrix")) {
  console.log("\n[모듈 소유 통계 — 차단 시 결과]");
  for (const key of DECISION_MODULE_KEYS) {
    const stat = ownership.get(key);
    if (!stat) continue;
    console.log(
      `  ${key.padEnd(20)} 단독 소유 ${String(stat.sole).padStart(5)}` +
      ` · 중복 근거 ${String(stat.redundant).padStart(4)}`
    );
  }
}

if (!conflicts.length) {
  console.log("✓ 모듈 간 충돌 없음 — 어떤 요청에서도 모듈 순서가 고유번호를 바꾸지 않는다");
  process.exit(0);
}

console.log(`\n✕ 모듈 간 충돌: ${conflicts.length}건 — 순서가 답을 정하고 있다`);
for (const c of (has("verbose") ? conflicts : conflicts.slice(0, 20))) {
  console.log(`  ${c.lotId}  요청[${c.request}]`);
  console.log(`      ${c.module} 있음 → ${c.withModule}`);
  console.log(`      ${c.module} 없음 → ${c.withoutModule}`);
}
if (!has("verbose") && conflicts.length > 20) {
  console.log(`  … 외 ${conflicts.length - 20}건 (--verbose)`);
}
console.log(
  "\n충돌은 배열 조정으로 해소되지 않습니다(순서를 바꾸면 반대쪽 답이 이길 뿐)." +
  "\n두 모듈 중 근거가 약한 쪽이 이 조건에서 기권하도록 고치세요."
);
process.exit(1);
