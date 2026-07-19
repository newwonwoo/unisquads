import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  filterExpectedPropertyClass,
  propertyClassKey,
  unitKey
} from "../public/unit-match.mjs";

const vectors = JSON.parse(
  await readFile(new URL("./fixtures/unit-match-vectors.json", import.meta.url), "utf8")
);

test("JavaScript matcher follows the shared unit vectors", () => {
  for (const vector of vectors) {
    assert.equal(
      unitKey(vector.a, vector.kind) === unitKey(vector.b, vector.kind),
      vector.equal,
      JSON.stringify(vector)
    );
  }
});

test("property class filtering is conservative", () => {
  assert.equal(propertyClassKey({ real_cls_cd: "집합건물" }), "집합건물");
  const result = filterExpectedPropertyClass(
    [{ gubun: "토지" }, { gubun: "집합건물" }, { gubun: "건물" }],
    "집합건물"
  );
  assert.equal(result.verified, true);
  assert.equal(result.candidates.length, 1);

  const unknown = filterExpectedPropertyClass([{ gubun: "" }], "집합건물");
  assert.equal(unknown.verified, false);
  assert.deepEqual(unknown.candidates, []);
});
