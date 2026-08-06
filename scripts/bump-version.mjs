#!/usr/bin/env node
// 버전과 릴리스 시각을 올리고 CHANGELOG에 한 줄 남긴다.
//
//   node scripts/bump-version.mjs patch "무엇을 고쳤는지"
//   node scripts/bump-version.mjs minor "무엇을 더했는지"
//   node scripts/bump-version.mjs major "무엇이 깨지는지"
//
// 시각은 실행 시점으로 자동 기록한다. 손으로 적으면 과거 시각이 그대로
// 남거나 형식이 어긋나므로 직접 쓰지 않는다.

import { readFile, writeFile } from "node:fs/promises";

const VERSION_FILE = new URL("../public/version.mjs", import.meta.url);
const LEVELS = new Set(["major", "minor", "patch"]);

const [, , level, ...rest] = process.argv;
const summary = rest.join(" ").trim();

if (!LEVELS.has(level) || !summary) {
  console.error("사용법: node scripts/bump-version.mjs <major|minor|patch> \"요약\"");
  process.exit(2);
}
if (summary.includes('"')) {
  console.error("요약에 큰따옴표는 쓸 수 없습니다.");
  process.exit(2);
}

const source = await readFile(VERSION_FILE, "utf8");

const currentMatch = /export const APP_VERSION = "([^"]+)";/.exec(source);
if (!currentMatch) {
  console.error("APP_VERSION을 찾지 못했습니다.");
  process.exit(1);
}
const [major, minor, patch] = currentMatch[1].split(".").map(Number);
const next = level === "major" ? `${major + 1}.0.0`
  : level === "minor" ? `${major}.${minor + 1}.0`
  : `${major}.${minor}.${patch + 1}`;

// KST 오프셋을 붙여 저장한다. 표시 시점의 시간대에 따라 값이 바뀌지 않는다.
const now = new Date();
const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
const pad = (value) => String(value).padStart(2, "0");
const releasedAt = `${kst.getUTCFullYear()}-${pad(kst.getUTCMonth() + 1)}-${pad(kst.getUTCDate())}` +
  `T${pad(kst.getUTCHours())}:${pad(kst.getUTCMinutes())}:${pad(kst.getUTCSeconds())}+09:00`;

const entry = `  Object.freeze({
    version: "${next}",
    released_at: "${releasedAt}",
    summary: "${summary}"
  }),
`;

const updated = source
  .replace(/export const APP_VERSION = "[^"]+";/, `export const APP_VERSION = "${next}";`)
  .replace(/export const RELEASED_AT = "[^"]+";/, `export const RELEASED_AT = "${releasedAt}";`)
  .replace("export const CHANGELOG = Object.freeze([\n", `export const CHANGELOG = Object.freeze([\n${entry}`);

await writeFile(VERSION_FILE, updated, "utf8");
console.log(`${currentMatch[1]} → ${next}  (${releasedAt})`);
console.log(`  ${summary}`);
