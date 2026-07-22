import assert from "node:assert/strict";
import test from "node:test";

import { narrowCandidatesByExplicitParcel } from "../public/address-parcel-intent.mjs";

const residential = {
  admCd: "4833011900",
  mtYn: "0",
  mnnm: "564",
  slno: "0",
  bdMgtSn: "R",
  bdNm: "태원아파트",
  bdKdcd: "1",
  detBdNmList: "101동,102동,103동,104동,105동,106동,107동",
  jibunAddr: "경상남도 양산시 평산동 564 태원아파트"
};

const commercial = {
  ...residential,
  bdMgtSn: "C",
  bdKdcd: "0",
  detBdNmList: "상가동"
};

function noise(index) {
  return {
    admCd: `483301${String(2000 + index)}`,
    mtYn: "0",
    mnnm: String(600 + index),
    slno: "0",
    bdMgtSn: `N${index}`,
    bdNm: `다른건물${index}`,
    jibunAddr: `경상남도 양산시 평산동 ${600 + index} 다른건물${index}`
  };
}

test("dual old/current legal names plus exact lot narrow to one parcel group", () => {
  const result = narrowCandidatesByExplicitParcel(
    [residential, commercial, ...Array.from({ length: 8 }, (_, i) => noise(i))],
    {
      raw: "경남 양산시 평산동 태원아파트 101-107 평산리 564 102동1204",
      lotRefs: [{ legal: "평산리", lot: "564" }]
    }
  );
  assert.equal(result.applied, true);
  assert.equal(result.candidates.length, 2);
  assert.deepEqual(new Set(result.candidates.map((candidate) => candidate.bdMgtSn)), new Set(["R", "C"]));
  assert.equal(result.evidence.includes("EXPLICIT_PARCEL_UNIQUE"), true);
});

test("exact legal name and lot also narrow to one parcel group", () => {
  const result = narrowCandidatesByExplicitParcel(
    [residential, commercial, noise(1)],
    {
      raw: "경남 양산시 평산동 564 태원아파트 102동1204",
      lotRefs: [{ legal: "평산동", lot: "564" }]
    }
  );
  assert.equal(result.applied, true);
  assert.equal(result.candidates.length, 2);
});

test("same-stem legal suffix is not generalized when both forms are not in the source", () => {
  const result = narrowCandidatesByExplicitParcel(
    [residential, noise(1)],
    {
      raw: "경남 양산시 평산리 564 태원아파트",
      lotRefs: [{ legal: "평산리", lot: "564" }]
    }
  );
  assert.equal(result.applied, false);
  assert.equal(result.candidates.length, 2);
});

test("multiple matched parcels remain unresolved", () => {
  const second = {
    ...residential,
    admCd: "4833011900",
    mnnm: "565",
    bdMgtSn: "R2",
    jibunAddr: "경상남도 양산시 평산동 565 태원아파트"
  };
  const result = narrowCandidatesByExplicitParcel(
    [residential, second],
    {
      raw: "경남 양산시 평산동 564, 565 태원아파트",
      lotRefs: [
        { legal: "평산동", lot: "564" },
        { legal: "평산동", lot: "565" }
      ]
    }
  );
  assert.equal(result.applied, false);
  assert.equal(result.candidates.length, 2);
});
