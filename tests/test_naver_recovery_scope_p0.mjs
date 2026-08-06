import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../public/app.js", import.meta.url), "utf8");

// #24에서 들어온 회귀: recovered가 if(naverAddr) 블록 안에서 선언되는데
// 바깥 블록의 return이 recovered.recoveryVersion을 읽어 ReferenceError가 났다.
// 네이버 경로를 타는 모든 행이 SYSTEM_ERROR로 떨어졌다.
test("네이버 PNU 복구값을 블록 밖에서 읽지 않는다", () => {
  assert.equal(source.includes("naverPnuRecoveryVersion: recovered.recoveryVersion"), false);
  assert.ok(source.includes("let naverPnuRecoveryVersion = \"\";"));
  assert.ok(source.includes("naverPnuRecoveryVersion = recovered.recoveryVersion;"));
});

test("recovered는 선언된 블록 안에서만 쓰인다", () => {
  const start = source.indexOf("const recovered = await recoverJusoCandidateForNaver(");
  assert.notEqual(start, -1);
  // 선언 지점부터 그 블록이 닫히는 곳까지만 참조가 허용된다.
  let depth = 0;
  let end = -1;
  for (let i = start; i < source.length; i++) {
    if (source[i] === "{") depth += 1;
    else if (source[i] === "}") {
      depth -= 1;
      if (depth < 0) { end = i; break; }
    }
  }
  assert.notEqual(end, -1);
  const after = source.slice(end);
  const nextDecl = after.indexOf("const recovered");
  const stray = after.slice(0, nextDecl === -1 ? after.length : nextDecl)
    .match(/\brecovered\s*[.?]/g) || [];
  assert.deepEqual(stray, [], `블록 밖 recovered 참조: ${stray.join(", ")}`);
});
