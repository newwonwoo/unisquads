#!/usr/bin/env node
// 브라우저 콘솔에 붙여넣기만 하면 되는 단일 스크립트를 만든다.
//
// 손으로 옮겨 적으면 실제 모듈과 어긋난다. 여기서는 실제 모듈 소스를 읽어
// import/export만 벗기고 순서대로 이어붙이므로, 모듈이 바뀌면 스니펫도 같이
// 바뀐다(어긋나면 test_measure_snippet.mjs가 실패한다).
//
//   node scripts/build-measure-snippet.mjs         생성
//   node scripts/build-measure-snippet.mjs --check  최신인지 확인만

import { readFile, writeFile } from "node:fs/promises";

// 의존 순서대로. 뒤 모듈이 앞 모듈의 함수를 쓴다.
const MODULES = [
  "address-multilot-rules.mjs",
  "unit-match.mjs",
  "pnuless-iros.mjs",
  "verified-unit-propagation.mjs",
  "recovery-impact.mjs"
];

const OUTPUT = new URL("../measure-snippet.js", import.meta.url);

function stripModuleSyntax(source) {
  return source
    // import { a, b } from "./x.mjs";  /  import x from "...";
    .replace(/^import\s+[\s\S]*?from\s+["'][^"']+["'];?\s*$/gm, "")
    .replace(/^export\s+\{[\s\S]*?\}\s*from\s+["'][^"']+["'];?\s*$/gm, "")
    // export function / export const  →  function / const
    .replace(/^export\s+(?=(?:async\s+)?function|const|class|let)/gm, "")
    // export { a, b };
    .replace(/^export\s+\{[^}]*\};?\s*$/gm, "")
    .trim();
}

const RUNNER = `
// ── 실행부 ─────────────────────────────────────────────────────────
(async () => {
  const BATCH_KEY = "rows-progress";
  let snapshot = null;
  try {
    const db = await new Promise((res, rej) => {
      const q = indexedDB.open("addr-refine", 1);
      q.onsuccess = () => res(q.result);
      q.onerror = () => rej(q.error);
    });
    snapshot = await new Promise((res, rej) => {
      const q = db.transaction("batch").objectStore("batch").get(BATCH_KEY);
      q.onsuccess = () => res(q.result?.value ?? null);
      q.onerror = () => rej(q.error);
    });
  } catch (error) {
    console.error("저장된 배치를 읽지 못했습니다:", error);
    return;
  }
  const rows = Array.isArray(snapshot) ? snapshot : snapshot?.rows;
  if (!Array.isArray(rows) || !rows.length) {
    console.warn("저장된 배치가 없습니다. 앱에서 '이어서 하기'가 보이는 상태여야 합니다.");
    return;
  }
  const result = measure(rows);
  console.log(report(result));
  window.__RECOVERY_IMPACT__ = result;
  console.log("%c위 표를 그대로 복사해서 붙여넣으면 됩니다. 주소·소유자 정보는 들어 있지 않습니다.",
    "color:#22D3EE;font-weight:700");
})();
`.trim();

async function build() {
  const parts = [];
  for (const name of MODULES) {
    const source = await readFile(new URL(`../public/${name}`, import.meta.url), "utf8");
    parts.push(`// ── public/${name} ──\n${stripModuleSyntax(source)}`);
  }
  return [
    "// addr-refine 개선 기대효과 측정 — 브라우저 콘솔 전용",
    "//",
    "// 자동 생성 파일이다. 직접 고치지 말고 아래를 실행한다.",
    "//   node scripts/build-measure-snippet.mjs",
    "//",
    "// 사용법: 앱을 연 탭에서 F12 → Console → 이 파일 전체를 붙여넣고 Enter.",
    "// 조회도 저장도 하지 않는다. 이미 저장된 결과만 읽어서 건수를 센다.",
    "",
    "(() => {",
    ...parts,
    "",
    RUNNER,
    "})();",
    ""
  ].join("\n");
}

const built = await build();
if (process.argv.includes("--check")) {
  const current = await readFile(OUTPUT, "utf8").catch(() => "");
  if (current !== built) {
    console.error("measure-snippet.js가 최신이 아닙니다. node scripts/build-measure-snippet.mjs 를 실행하세요.");
    process.exit(1);
  }
  console.log("measure-snippet.js 최신 상태입니다.");
} else {
  await writeFile(OUTPUT, built, "utf8");
  console.log(`measure-snippet.js 생성 (${built.length.toLocaleString()}자)`);
}

export { build };
