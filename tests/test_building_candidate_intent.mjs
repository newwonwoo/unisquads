import assert from "node:assert/strict";
import test from "node:test";

import {
  candidateSupportsExplicitDong,
  narrowCandidatesByBuildingIntent
} from "../public/building-candidate-intent.mjs";

const base = {
  admCd: "4833011900",
  mtYn: "0",
  mnnm: "564",
  slno: "0",
  bdNm: "태원아파트"
};

const residential = {
  ...base,
  bdMgtSn: "R",
  bdKdcd: "1",
  detBdNmList: "101동,102동,103동,104동,105동,106동,107동"
};

const commercial = {
  ...base,
  bdMgtSn: "C",
  bdKdcd: "0",
  detBdNmList: "상가동"
};

test("explicit apartment dong selects the candidate whose detail list contains it", () => {
  const noise = Array.from({ length: 8 }, (_, index) => ({
    ...base,
    admCd: `48330119${String(index + 10).padStart(2, "0")}`,
    mnnm: String(600 + index),
    bdMgtSn: `N${index}`,
    bdKdcd: "0",
    bdNm: `다른건물${index}`,
    detBdNmList: ""
  }));
  const result = narrowCandidatesByBuildingIntent(
    [residential, commercial, ...noise],
    { dong: "102", buildingName: "태원아파트" }
  );
  assert.equal(result.applied, true);
  assert.equal(result.candidates.length, 1);
  assert.equal(result.candidates[0].bdMgtSn, "R");
  assert.equal(result.evidence.includes("EXPLICIT_DONG_IN_DETAIL_LIST"), true);
});

test("explicit commercial intent selects the commercial candidate", () => {
  const result = narrowCandidatesByBuildingIntent(
    [residential, commercial],
    {
      subBuilding: { kind: "COMMERCIAL", token: "상가" },
      buildingName: "태원아파트"
    }
  );
  assert.equal(result.applied, true);
  assert.equal(result.candidates.length, 1);
  assert.equal(result.candidates[0].bdMgtSn, "C");
  assert.equal(result.evidence.includes("EXPLICIT_SUB_BUILDING:COMMERCIAL"), true);
});

test("commercial intent can use unique bdKdcd=0 only inside the same named parcel", () => {
  const noDetailCommercial = { ...commercial, detBdNmList: "" };
  const result = narrowCandidatesByBuildingIntent(
    [residential, noDetailCommercial],
    {
      subBuilding: { kind: "COMMERCIAL", token: "상가" },
      buildingName: "태원아파트"
    }
  );
  assert.equal(result.candidates.length, 1);
  assert.equal(result.candidates[0].bdMgtSn, "C");
  assert.equal(result.evidence.includes("EXPLICIT_COMMERCIAL_BDKDCD_UNIQUE"), true);
});

test("no explicit building-part intent leaves same-parcel candidates unresolved", () => {
  const result = narrowCandidatesByBuildingIntent(
    [residential, commercial],
    { buildingName: "태원아파트" }
  );
  assert.equal(result.applied, false);
  assert.equal(result.candidates.length, 2);
});

test("building-kind fallback never crosses parcels or unrelated building names", () => {
  const other = {
    ...commercial,
    admCd: "4833012000",
    mnnm: "10",
    bdNm: "다른아파트"
  };
  const result = narrowCandidatesByBuildingIntent(
    [residential, other],
    {
      subBuilding: { kind: "COMMERCIAL", token: "상가" },
      buildingName: "태원아파트"
    }
  );
  assert.equal(result.applied, false);
  assert.equal(result.candidates.length, 2);
});

test("detail-list dong comparison is exact, not substring based", () => {
  assert.equal(candidateSupportsExplicitDong(residential, "102"), true);
  assert.equal(candidateSupportsExplicitDong(residential, "10"), false);
});
