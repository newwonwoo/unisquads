#!/usr/bin/env node
// 정제율(주소 복구) 모듈 간섭 감사.
//
// 등기 매칭의 audit-module-interference와 같은 원칙을 주소 실패 재조회 체인
// (public/address-failed-decision.mjs: 행정동 교정 → 배제지번 재확인 →
// 건물명 재검색 → 네이버 지번 구조)에 적용한다.
//
// 실측 픽스처(tests/fixtures/address-requery-corpus.json — 이 저장소가 실제로
// 받았던 JUSO·네이버 응답)로 체인을 그대로 돌리고, 발화한 모듈을 하나씩
// 차단해 다시 돌린다. 차단했더니 다른 모듈이 "다른 지번"을 확정하면 충돌 —
// 모듈 순서가 확정 지번을 정하고 있다는 뜻이고, 순서 조정으로는 해소되지
// 않으므로 근거 약한 모듈이 기권하도록 고칠 때까지 실패한다.
//
// 감사 경계: 이 감사는 "어느 모듈이 어느 지번을 확정하는가"를 잰다.
// resolve()의 PNU 조립·후보 정밀화와 지역 검증의 세부는 단위·계약 테스트와
// E2E가 덮는다(여기서는 단일 후보 확정/복수 승격만 재현하는 스텁을 쓴다).
//
//   node scripts/audit-address-interference.mjs             검사
//   node scripts/audit-address-interference.mjs --verbose    상세 출력

import { readFile } from "node:fs/promises";
import {
  ADDRESS_DECISION_MODULE_KEYS,
  runFailedAddressRequery,
  runNaverLotRescue
} from "../public/address-failed-decision.mjs";
import { extractLegalLot } from "../public/unit-match.mjs";

const argv = process.argv.slice(2);
const has = (name) => argv.includes(`--${name}`);

const corpus = JSON.parse(await readFile(
  new URL("../tests/fixtures/address-requery-corpus.json", import.meta.url), "utf8"
));

// 픽스처 클라이언트 — 기록에 없는 검색어는 0건(실측에 없던 조회는 지어내지 않는다)
function clientsOf(scenario) {
  return {
    juso: async (keyword) => scenario.juso[keyword] || [],
    naverLocal: async (query) => scenario.naver[query] || []
  };
}

// 감사 스텁: 단일 후보는 확정으로, 복수 후보는 복수후보 승격으로 재현한다.
const ctx = {
  resolve: (candidates, pre) => {
    if (candidates.length === 1) {
      const c = candidates[0];
      return { status: "CONFIRMED", jibunAddr: c.jibunAddr || "", roadAddr: c.roadAddr || "",
        bdNm: c.bdNm || "", unit: pre?.unit || {} };
    }
    return { status: "AMBIGUOUS", candidates };
  },
  validateRegion: () => ({ status: "MATCH", inputSgg: "", resultSgg: "" })
};

function lotKeyOf(address) {
  const lot = extractLegalLot(String(address || ""));
  return lot ? `${lot.legal} ${lot.mountain ? "산" : ""}${lot.lot}` : "";
}

async function runChain(scenario, options) {
  const { pre, result, status } = scenario;
  const clients = clientsOf(scenario);
  // app.js의 실행 순서 그대로: NAVER_PNU 실패는 행정동 교정 → 네이버 레스큐,
  // 그 외 실패는 통합 체인(행정동 → 배제지번 → 건물명).
  let out = null;
  if (status === "NAVER_CONFIRMED_PNU_FAILED") {
    out = await runFailedAddressRequery(result, pre, clients, ctx, options) ||
          await runNaverLotRescue(result, pre, clients, ctx, options);
  } else {
    out = await runFailedAddressRequery(result, pre, clients, ctx, options);
  }
  if (!out) return { signature: "NONE", module: null };
  const module = out.failedRequery?.module || "?";
  if (out.status === "CONFIRMED") {
    return { signature: `CONFIRMED:${lotKeyOf(out.jibunAddr)}:${module}`, module,
      lot: lotKeyOf(out.jibunAddr) };
  }
  if (out.status === "AMBIGUOUS") {
    return { signature: `AMBIGUOUS:${(out.candidates || []).length}:${module}`, module };
  }
  return { signature: `${out.status}:${module}`, module };
}

const TAG_TO_KEY = {
  "R-ADDR-ADMIN-DONG-LOT": "ADMIN_DONG_LOT",
  "R-ADDR-EXCLUDED-LOT": "EXCLUDED_LOT",
  "R-ADDR-BUILDING-NAME-LOT": "BUILDING_NAME_LOT",
  "R-ADDR-NAVER-LOT-RESCUE": "NAVER_LOT_RESCUE"
};

let fired = 0;
const conflicts = [];
const rows = [];
for (const scenario of corpus.scenarios) {
  const full = await runChain(scenario, {});
  rows.push(`  ${scenario.id}\n      전체 체인 → ${full.signature}`);
  const key = TAG_TO_KEY[full.module];
  if (!key) continue;
  fired += 1;
  const ablated = await runChain(scenario, { disabled: [key] });
  rows.push(`      ${key} 차단 → ${ablated.signature}`);
  if (full.lot && ablated.lot && ablated.lot !== full.lot) {
    conflicts.push({ id: scenario.id, module: key, full: full.signature, ablated: ablated.signature });
  }
}

console.log(`정제율 모듈 간섭 감사 — 실측 시나리오 ${corpus.scenarios.length}건, 모듈 발화 ${fired}건`);
if (has("verbose")) rows.forEach((r) => console.log(r));

if (!conflicts.length) {
  console.log("✓ 모듈 간 충돌 없음 — 어떤 시나리오에서도 모듈 순서가 확정 지번을 바꾸지 않는다");
  process.exit(0);
}
console.log(`\n✕ 모듈 간 충돌: ${conflicts.length}건 — 순서가 확정 지번을 정하고 있다`);
for (const c of conflicts) {
  console.log(`  ${c.id}`);
  console.log(`      ${c.module} 있음 → ${c.full}`);
  console.log(`      ${c.module} 없음 → ${c.ablated}`);
}
console.log("\n순서 조정으로는 해소되지 않습니다. 근거 약한 모듈이 기권하도록 고치세요.");
process.exit(1);
