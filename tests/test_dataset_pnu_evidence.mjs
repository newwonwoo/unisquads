import assert from "node:assert/strict";
import test from "node:test";

import {
  candidateForDatasetPnu,
  directDatasetPnuSource,
  selectDatasetGroupPnu
} from "../public/dataset-pnu-evidence.mjs";

const PNU_A = "4375025022104690001";
const PNU_B = "4375025022104690002";
const PNU_C = "4375025022104690003";

function ambiguous(...pnus) {
  return {
    result: {
      status: "AMBIGUOUS",
      candidates: pnus.map((pnu) => ({ pnu, jibunAddr: pnu }))
    }
  };
}

test("a direct confirmed PNU can select only an intersecting ambiguous candidate", () => {
  const confirmed = {
    result: {
      status: "CONFIRMED",
      pnu: PNU_A,
      source: "juso",
      validation: { status: "MATCH" }
    }
  };
  const target = ambiguous(PNU_A, PNU_B);
  const selected = selectDatasetGroupPnu([confirmed, target]);
  assert.deepEqual(selected, {
    status: "UNIQUE",
    pnu: PNU_A,
    evidence: "DIRECT_CONFIRMED_PNU"
  });
  assert.equal(candidateForDatasetPnu(target, selected.pnu)?.pnu, PNU_A);
});

test("conflicting direct PNU anchors close the automatic path", () => {
  const rows = [PNU_A, PNU_B].map((pnu) => ({
    result: {
      status: "CONFIRMED",
      pnu,
      source: "juso",
      validation: { status: "MATCH" }
    }
  }));
  assert.equal(selectDatasetGroupPnu(rows).status, "CONFLICT");
});

test("independent candidate sets may resolve only through a one-PNU intersection", () => {
  const selected = selectDatasetGroupPnu([
    ambiguous(PNU_A, PNU_B),
    ambiguous(PNU_A, PNU_C)
  ]);
  assert.equal(selected.status, "UNIQUE");
  assert.equal(selected.pnu, PNU_A);
  assert.equal(selected.evidence, "INDEPENDENT_CANDIDATE_SET_INTERSECTION");
});

test("copied candidate sets are not independent evidence", () => {
  const selected = selectDatasetGroupPnu([
    ambiguous(PNU_A, PNU_B),
    ambiguous(PNU_A, PNU_B)
  ]);
  assert.equal(selected.status, "INSUFFICIENT");
});

test("a direct dataset source excludes derived and mismatched confirmations", () => {
  const good = {
    rowId: "good",
    result: {
      status: "CONFIRMED",
      pnu: PNU_A,
      source: "juso",
      validation: { status: "MATCH" }
    }
  };
  const derived = {
    rowId: "derived",
    result: {
      status: "CONFIRMED",
      pnu: PNU_A,
      source: "데이터셋PNU교차검증",
      validation: { status: "MATCH" }
    }
  };
  assert.equal(directDatasetPnuSource([derived, good], PNU_A), good);
  assert.equal(directDatasetPnuSource([derived], PNU_A), null);
});
