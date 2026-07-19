import assert from "node:assert/strict";
import test from "node:test";

globalThis.window = { storage: {} };
globalThis.React = { createElement() { return {}; } };
globalThis.ReactDOM = { createRoot() { return { render() {} }; } };
globalThis.document = { getElementById() { return {}; } };

const { recoverJusoCandidateForNaver, resolve } = await import("../public/app.js");

const candidate = (overrides = {}) => ({
  admCd: "4420034025",
  mtYn: "0",
  mnnm: "497",
  slno: "0",
  jibunAddr: "충청남도 아산시 탕정면 호산리 497",
  roadAddr: "충청남도 아산시 탕정면 탕정면로 10",
  bdNm: "홍익임대아파트",
  bdMgtSn: "4420034025104970000000001",
  source: "juso",
  isJip: true,
  ...overrides
});

const pre = (overrides = {}) => ({
  cleaned: "충남 아산시 탕정면 호산리 497 홍익임대아파트",
  searchText: "충남 아산시 탕정면 호산리 497",
  unit: { dong: "101", ho: "1001" },
  jibun: "497",
  emd: "호산리",
  emdCands: ["호산리"],
  road: "",
  buldNo: "",
  bldName: "홍익임대아파트",
  ...overrides
});

test("exact lot narrows a multi-candidate JUSO response before ambiguity", () => {
  const result = resolve([
    candidate(),
    candidate({ admCd: "4420034026", mnnm: "498", jibunAddr: "충청남도 아산시 탕정면 호산리 498", bdMgtSn: "4420034026104980000000001" })
  ], pre());
  assert.equal(result.status, "CONFIRMED");
  assert.deepEqual(result.addressMatchEvidence, ["LEGAL_DONG", "EXACT_LOT"]);
  assert.match(result.jibunAddr, /497$/);
});

test("legal-dong evidence disambiguates equal lot numbers", () => {
  const result = resolve([
    candidate(),
    candidate({ admCd: "4420034026", jibunAddr: "충청남도 아산시 탕정면 갈산리 497", bdMgtSn: "4420034026104970000000001" })
  ], pre());
  assert.equal(result.status, "CONFIRMED");
  assert.match(result.jibunAddr, /호산리 497$/);
});

test("an equal lot number in the wrong legal dong is not accepted as exact evidence", () => {
  const result = resolve([
    candidate({ admCd: "4420034026", jibunAddr: "충청남도 아산시 탕정면 갈산리 497", bdMgtSn: "4420034026104970000000001" }),
    candidate({ admCd: "4420034027", mnnm: "498", jibunAddr: "충청남도 아산시 탕정면 호산리 498", bdMgtSn: "4420034027104980000000001" })
  ], pre({ bldName: "" }));
  assert.equal(result.status, "AMBIGUOUS");
  assert.deepEqual(result.addressMatchEvidence, []);
});

test("absence of exact evidence remains ambiguous", () => {
  const result = resolve([
    candidate(),
    candidate({ admCd: "4420034026", mnnm: "498", jibunAddr: "충청남도 아산시 탕정면 호산리 498", bdMgtSn: "4420034026104980000000001" })
  ], pre({ jibun: "999", bldName: "" }));
  assert.equal(result.status, "AMBIGUOUS");
  assert.equal(result.candidates.length, 2);
});

test("exact road name and building number narrow road candidates", () => {
  const result = resolve([
    candidate(),
    candidate({ admCd: "4420034026", roadAddr: "충청남도 아산시 탕정면 탕정면로 11", bdMgtSn: "4420034026104970000000001" })
  ], pre({ jibun: "", road: "탕정면로", buldNo: "10", bldName: "" }));
  assert.equal(result.status, "CONFIRMED");
  assert.deepEqual(result.addressMatchEvidence, ["EXACT_ROAD"]);
});

test("Naver PNU recovery queries the verified original address before modernization", async () => {
  const called = [];
  const clients = {
    juso: async (query) => {
      called.push(query);
      if (query !== "전라남도 순천시 용당동 431") return [];
      return [{
        admCd: "4615012300",
        mtYn: "0",
        lnbrMnnm: "431",
        lnbrSlno: "0",
        jibunAddr: "전라남도 순천시 용당동 431",
        roadAddr: "전라남도 순천시 삼산로 92-50",
        bdMgtSn: "4615012300104310000000001",
        bdNm: "용당피오레아파트",
        bdKdcd: "1"
      }];
    }
  };
  const recovered = await recoverJusoCandidateForNaver("전라남도 순천시 용당동 431", clients);
  assert.equal(called[0], "전라남도 순천시 용당동 431");
  assert.equal(recovered.query, "전라남도 순천시 용당동 431");
  assert.equal(recovered.candidate?.mnnm, "431");
  assert.deepEqual(recovered.evidence, ["LEGAL_DONG", "EXACT_LOT"]);
});

test("Naver PNU recovery never chooses the first of multiple different PNU candidates", async () => {
  const clients = {
    juso: async () => [
      {
        admCd: "4615012300", mtYn: "0", lnbrMnnm: "431", lnbrSlno: "0",
        jibunAddr: "전라남도 순천시 용당동 431", bdMgtSn: "A", bdNm: "첫후보"
      },
      {
        admCd: "4615012400", mtYn: "0", lnbrMnnm: "431", lnbrSlno: "0",
        jibunAddr: "전라남도 순천시 조례동 431", bdMgtSn: "B", bdNm: "둘째후보"
      }
    ]
  };
  const recovered = await recoverJusoCandidateForNaver("전라남도 순천시 431", clients);
  assert.equal(recovered.candidate, null);
});
