import assert from "node:assert/strict";
import test from "node:test";

test("deployed browser module links without executing the UI", async () => {
  globalThis.window = { storage: {} };
  globalThis.React = { createElement() { return {}; } };
  globalThis.ReactDOM = {
    createRoot() {
      return { render() {} };
    }
  };
  globalThis.document = { getElementById() { return {}; } };

  const app = await import("../public/app.js");

  assert.equal(
    app.validateRegion(
      "충청남도 아산시 배방면 100",
      "충청남도 아산시 배방읍 100"
    ).oldAddressMap?.ruleId,
    "BJD_BAEBANG_PROMOTION"
  );
  assert.equal(
    app.validateRegion(
      "충청남도 가상시 가상면 100",
      "충청남도 가상시 가상읍 100"
    ).status,
    "MISMATCH"
  );
  assert.equal(
    app.validateRegion(
      "서울특별시 강남구 역삼동 1",
      "서울특별시 송파구 역삼동 1"
    ).status,
    "MISMATCH"
  );
  assert.equal(
    app.validateRegion(
      "충청남도 당진군 송악면 1",
      "충청남도 당진시 송악면 1"
    ).oldAddressMap?.ruleId,
    "SGG_DANGJIN_PROMOTION"
  );
  assert.equal(
    app.validateRegion(
      "경상남도 거제시 신현읍 문동리 238",
      "경상남도 거제시 문동동 238"
    ).oldAddressMap?.ruleId,
    "BJD_MUNDONG_REFORM"
  );
  assert.equal(
    app.validateRegion(
      "광주광역시 서구 농성동 100",
      "전남광주통합특별시 서구 농성동 100"
    ).status,
    "MATCH"
  );
  assert.equal(
    app.validateRegion(
      "충청남도 논산시 강경읍 황산리 대흥리 35",
      "충청남도 논산시 강경읍 대흥리 35"
    ).status,
    "MATCH"
  );
  assert.equal(
    app.validateRegion(
      "경상남도 창녕군 도천면 169-2",
      "경상남도 창녕군 도천면 송진리 169-2"
    ).status,
    "MATCH"
  );
  assert.equal(
    app.validateRegion(
      "전북특별자치도 임실군 임실읍 1",
      "경기도 양주시 백석읍 1"
    ).status,
    "MISMATCH"
  );

  const input = "충청남도 논산시 강경읍 황산리 대흥리 35";
  const result = "충청남도 논산시 강경읍 대흥리 35";
  assert.deepEqual(
    app.validateRegion(input, result),
    app.validateRegion(input, result)
  );
  assert.deepEqual(
    app.preprocess("서울 서초구 서초동 967 대원아파트 101-1-101"),
    app.preprocess("서울 서초구 서초동 967 대원아파트 101-1-101")
  );
  assert.deepEqual(
    app.preprocess("부산 부산진구 범일로 154번길 33, 101동 404호").road,
    "범일로154번길"
  );
  assert.equal(
    app.preprocess("부산 부산진구 범일로 154번길 33, 101동 404호").buldNo,
    "33"
  );
  const market = app.preprocess("인천 남동구 만수동 창대장터상가 1-110");
  assert.equal(market.emd, "만수동");
  assert.deepEqual(market.unit, { dong: "1", ho: "110" });
  const exactLotUnit = app.preprocess("서울 광진구 자양동 767-1 101-101");
  assert.equal(exactLotUnit.jibun, "767-1");
  assert.deepEqual(exactLotUnit.unitCandidate, { dong: "101", ho: "101" });
  assert.deepEqual(
    app.preprocess("전북 임실군 임실읍 정월리 이도리241-1 신우apt 101-101(대지권없음)").unit,
    { dong: "101", ho: "101" }
  );
  assert.deepEqual(
    app.preprocess("충북 진천군 진천읍 469외2필지 우미대A102-101").unit,
    { dong: "102", ho: "101" }
  );
  const incomplete = app.preprocess("경남 고성군 하이면 101-105");
  assert.equal(incomplete.jibun, "101-105");
  assert.deepEqual(incomplete.unit, { dong: null, ho: null });

  const calls = [];
  const recovered = await app.recoverJusoCandidateForNaver(
    "전라남도 순천시 용당동 431 용당피오레아파트",
    {
      juso: async (query) => {
        calls.push(query);
        return query === "전라남도 순천시 용당동 431" ? [{
          admCd: "4615012700",
          mtYn: "0",
          lnbrMnnm: "431",
          lnbrSlno: "0",
          jibunAddr: "전라남도 순천시 용당동 431",
          roadAddr: "전라남도 순천시 삼산로 92-50",
          bdMgtSn: "4615012700104310000000001",
          bdNm: "용당피오레아파트",
          bdKdcd: "1"
        }] : [];
      }
    }
  );
  assert.ok(calls.includes("전라남도 순천시 용당동 431"));
  assert.equal(recovered.candidate?.admCd, "4615012700");
  assert.equal(recovered.recoveryVersion, "1");
});
