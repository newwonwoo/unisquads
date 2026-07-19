import assert from "node:assert/strict";
import test from "node:test";

globalThis.window = { storage: {} };
globalThis.React = { createElement() { return {}; } };
globalThis.ReactDOM = { createRoot() { return { render() {} }; } };
globalThis.document = { getElementById() { return {}; } };

const { preprocess, splitUnitsForBatch } = await import("../public/app.js");

// 정제결과_전체 (6).xlsx의 확정행에서 동·호 표기 유형을 층화해 뽑은 25건.
// 각 실데이터에 공백·전각·업무접미 변형을 적용해 총 100개 회귀 시나리오를 만든다.
const BASE = [
  ["경기 가평군 가평읍 대곡리 대곡리 402-1 101동 204호", "101", "204"],
  ["강원 강릉시 입암동 태평양아파트 태평양임대아파트 101-808", "101", "808"],
  ["강원 강릉시 지변동 1동 1116호", "1", "1116"],
  ["경북 경주시 황성동 청우아파트 276-6 청우타운 302동 1305", "302", ""],
  ["경북 경주시 안강읍 산대리 1346-3 한동화성타운301동406호", "301", "406"],
  ["경북 경주시 안강읍 옥산리 1346-9,2368-13 한동그린타운 501-507호", "", "507"],
  ["경남 고성군 거류면 174번지새평지아파트 106동 103호", "106", "103"],
  ["충북 괴산군 괴산읍 수진리 277-5 태광아파트 102동 102동 106호", "102", "106"],
  ["전북 군산시 신풍동 882-5번지 신풍동부향하나로아파트 904호", "", "904"],
  ["전북 군산시 공단대로 54 (조촌동) 103동402호", "103", "402"],
  ["부산 금정구 장전3동 653-3번지 1동 2111호", "1", "2111"],
  ["경남 양산시 주진동 182-1외 4필지 로즈힐아파트 101동 1102호", "101", "1102"],
  ["전북 익산시 목천동 1376-1 한스빌아파트 제 102동 1415호", "102", "1415"],
  ["강원 동해시 이도동 이도동 302-6,302-38 강변아파트 5층 513호", "", "513"],
  ["대전 중구 옥계동 45-3. 솔빛아파트 제103호(대지권없음)", "", "103"],
  ["충북 청원군 내수읍 학평리 마산리 123외 진흥아파트 109동 5층2호", "109", "2"],
  ["경기 파주시 문산읍 문산읍 문산리 17-25 청도훼밀리맨션 지하 1-45", "1", "45"],
  ["부산 해운대구 재반로225번길 36-34, 302호 (반여동) 1동3302호", "1", "3302"],
  ["경기 화성시 동탄공원로 21-11, 941동 105호 (능동,푸른마을모아미래도아파트)", "941", "105"],
  ["충남 서산시 지곡면 화천리 무장리 920 늘푸른오스카빌 106-1006", "106", "1006"],
  ["경북 영천시 금호읍 원제리 18-2외 금호윤성모닝타운101-235", "101", "235"],
  ["광주 서구 내방동 785~900 475-1 솔뫼타운아파트 102-1006", "102", "1006"],
  ["전북 전주시 완산구 효자동1가 799 효자동한신휴플러스아파트 106동 1동 105호", "1", "105"],
  ["전남 순천시 삼산로 92-50, 113동 1802호 (용당동,대주피오레아파트) 113동 1802호", "113", "1802"],
  ["세종 누리로 59, 502동 506호 (한솔동,첫마을아파트)", "502", "506"]
];

const fullwidthNumbers = (text) => text.replace(/[0-9-]/g, (ch) =>
  ch === "-" ? "－" : String.fromCharCode(ch.charCodeAt(0) + 0xfee0)
);
const variants = (raw) => [
  raw,
  `  ${raw.replaceAll(" ", "　")}  `,
  fullwidthNumbers(raw),
  `${raw} 소재`
];

test("100 real-data-derived address variants preserve parsed dong and ho", () => {
  let scenarios = 0;
  for (const [raw, dong, ho] of BASE) {
    for (const variant of variants(raw)) {
      const parsed = preprocess(variant).unit || {};
      assert.equal(String(parsed.dong || ""), dong, variant);
      assert.equal(String(parsed.ho || ""), ho, variant);
      scenarios++;
    }
  }
  assert.equal(scenarios, 100);
});

test("alphabet dong and hyphen room survive parsing and multi-unit splitting", () => {
  assert.deepEqual(
    preprocess("서울특별시 서초구 서초동 967 대원아파트 A동 204-1호").unit,
    { dong: "A", ho: "204-1" }
  );
  assert.deepEqual(
    preprocess("경기 이천시 증포동 213-6 대원아파트 a동 1503").unit,
    { dong: "A", ho: "1503" }
  );
  assert.deepEqual(
    splitUnitsForBatch("서초동 967 A동 204-1호 B동 305-2호"),
    [["A", "204-1"], ["B", "305-2"]]
  );
});
