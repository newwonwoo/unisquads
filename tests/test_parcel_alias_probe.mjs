import assert from "node:assert/strict";
import test from "node:test";

import { buildExplicitParcelProbeSpecs } from "../public/address-parcel-intent.mjs";

test("dual current and old legal names generate both exact lot queries", () => {
  const specs = buildExplicitParcelProbeSpecs({
    raw: "경남 양산시 평산동 태원아파트 101-107 평산리 564 102동1204",
    sidoFull: "경상남도",
    sgg: "양산시",
    eup: "",
    lotRefs: [{ legal: "평산리", lot: "564" }]
  });
  assert.deepEqual(
    specs.map((spec) => spec.query).sort(),
    [
      "경상남도 양산시 평산동 564",
      "경상남도 양산시 평산리 564"
    ]
  );
});

test("a single legal name does not invent an alias", () => {
  const specs = buildExplicitParcelProbeSpecs({
    raw: "경남 양산시 평산리 564 태원아파트",
    sidoFull: "경상남도",
    sgg: "양산시",
    lotRefs: [{ legal: "평산리", lot: "564" }]
  });
  assert.deepEqual(specs.map((spec) => spec.query), ["경상남도 양산시 평산리 564"]);
});

test("unrelated legal tokens are never paired with the lot", () => {
  const specs = buildExplicitParcelProbeSpecs({
    raw: "경남 양산시 평산동 다른리 태원아파트 평산리 564",
    sidoFull: "경상남도",
    sgg: "양산시",
    lotRefs: [{ legal: "평산리", lot: "564" }]
  });
  assert.equal(specs.some((spec) => spec.query.includes("다른리 564")), false);
  assert.equal(specs.some((spec) => spec.query.includes("평산동 564")), true);
});

test("multiple explicit lots remain separate and are not synthesized", () => {
  const specs = buildExplicitParcelProbeSpecs({
    raw: "경남 양산시 평산동 564, 565",
    sidoFull: "경상남도",
    sgg: "양산시",
    lotRefs: [
      { legal: "평산동", lot: "564" },
      { legal: "평산동", lot: "565" }
    ]
  });
  assert.deepEqual(
    specs.map((spec) => spec.query).sort(),
    ["경상남도 양산시 평산동 564", "경상남도 양산시 평산동 565"]
  );
});
