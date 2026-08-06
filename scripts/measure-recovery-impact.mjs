#!/usr/bin/env node
// 배치 스냅샷 파일로 개선 기대효과를 계산하는 CLI.
// 측정 로직 자체는 public/recovery-impact.mjs에 있고 브라우저에서도 동일하게 돈다.
//
//   node scripts/measure-recovery-impact.mjs <snapshot.json> [--json]

import { readFile } from "node:fs/promises";
import { measure, report } from "../public/recovery-impact.mjs";

const [, , path, ...flags] = process.argv;
if (!path) {
  console.error("사용법: node scripts/measure-recovery-impact.mjs <snapshot.json> [--json]");
  process.exit(2);
}
const raw = JSON.parse(await readFile(path, "utf8"));
const rows = Array.isArray(raw) ? raw : (raw.rows || raw.value?.rows || []);
if (!rows.length) {
  console.error("스냅샷에서 rows를 찾지 못했습니다.");
  process.exit(2);
}
const result = measure(rows);
console.log(flags.includes("--json")
  ? JSON.stringify(result, (key, value) => value instanceof Map ? Object.fromEntries(value) : value, 2)
  : report(result));
