import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("minimal address recovery integration is wired without IROS collection changes", async () => {
  const source = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
  for (const marker of [
    "shouldEscalateJusoMultiToNaver",
    "pendingJusoMulti",
    "isBuildingPartToken(t)",
    "NAVER_EXACT_ADMIN_CORRECTION",
    "확인 필요",
    "주소정제결과",
    "주소 열과 헤더는 자동 인식됩니다.",
    "주소 정제 완료",
    "등기조회 판정 완료",
    "irosOutcomeStats(rows)",
    "naverJibunAddr",
    "네이버도로명주소",
    "mode2 === \"fail\" && !hasIrosResults",
    "makeSheet(detailRecords, \"all\")"
  ]) assert.ok(source.includes(marker), marker);
  assert.equal(source.includes("A열에 주소를 넣어 업로드하세요"), false);
  assert.equal(source.includes('const k = r.failCode || "\uBBF8\uC2E4\uD589"'), false);
  assert.ok(source.includes('`${BRIDGE}/resolve?addr=${encodeURIComponent(addr)}${b}&strategy=full`'));
});
