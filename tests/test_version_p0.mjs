import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  APP_VERSION,
  CHANGELOG,
  RELEASED_AT,
  buildStamp,
  formatKst
} from "../public/version.mjs";

test("버전은 semver 형식이고 CHANGELOG 맨 앞과 일치한다", () => {
  assert.match(APP_VERSION, /^\d+\.\d+\.\d+$/);
  assert.equal(CHANGELOG[0].version, APP_VERSION);
  assert.equal(CHANGELOG[0].released_at, RELEASED_AT);
  assert.ok(CHANGELOG[0].summary.trim().length > 0);
});

test("릴리스 시각은 파싱 가능하고 시간대가 명시돼 있다", () => {
  assert.equal(Number.isNaN(new Date(RELEASED_AT).getTime()), false);
  // 오프셋이 없으면 보는 사람 시간대에 따라 값이 달라진다.
  assert.match(RELEASED_AT, /(?:Z|[+-]\d{2}:\d{2})$/);
  for (const entry of CHANGELOG) {
    assert.match(entry.version, /^\d+\.\d+\.\d+$/, entry.version);
    assert.equal(Number.isNaN(new Date(entry.released_at).getTime()), false, entry.version);
  }
});

test("CHANGELOG는 최신이 앞이고 버전이 중복되지 않는다", () => {
  const versions = CHANGELOG.map((entry) => entry.version);
  assert.equal(new Set(versions).size, versions.length);
  const rank = (value) => value.split(".").map(Number).reduce((sum, part) => sum * 1000 + part, 0);
  for (let i = 1; i < CHANGELOG.length; i++) {
    assert.equal(
      rank(CHANGELOG[i - 1].version) > rank(CHANGELOG[i].version),
      true,
      `${CHANGELOG[i - 1].version} > ${CHANGELOG[i].version}`
    );
  }
});

test("시각 표기는 보는 사람 시간대와 무관하게 KST로 고정된다", () => {
  assert.equal(formatKst("2026-08-06T00:00:00Z"), "2026-08-06 09:00 KST");
  assert.equal(formatKst("2026-08-06T01:05:00+09:00"), "2026-08-06 01:05 KST");
  assert.equal(formatKst(""), "");
  assert.equal(formatKst("쓰레기값"), "");
});

test("배포 정보가 없으면 있는 척하지 않는다", () => {
  const deployed = buildStamp({
    git_commit_sha: "278ec588b0b3f1285b7b2005522d686c2dd230eb",
    deployed_at: "2026-08-06T00:40:00Z"
  });
  assert.equal(deployed.label, `v${APP_VERSION}`);
  assert.equal(deployed.commit, "278ec58");
  assert.ok(deployed.detail.includes("2026-08-06 09:40 KST 배포"));
  assert.ok(deployed.detail.includes("278ec58"));

  const local = buildStamp({});
  assert.ok(local.detail.includes("배포정보 없음"));
  assert.equal(local.commit, "");
  assert.equal(buildStamp(null).detail.includes("배포정보 없음"), true);
});

test("화면 헤더가 하드코딩이 아니라 버전 모듈을 쓴다", async () => {
  const source = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
  assert.ok(source.includes('from "./version.mjs"'));
  assert.ok(source.includes("buildStamp().label"));
  assert.ok(source.includes("buildStamp().detail"));
  // 예전 하드코딩 표기가 남아 있으면 갱신되지 않는 값이 다시 화면에 뜬다.
  assert.equal(source.includes("v0.1"), false);
});
