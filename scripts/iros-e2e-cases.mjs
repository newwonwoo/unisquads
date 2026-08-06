// IROS 세대매칭 E2E 케이스.
//
// 각 케이스는 20,023행 실행에서 실제로 실패했던 유형 하나다. 등기 후보는 그
// 실행의 총건수·동호 표기를 그대로 본떠 만들었고, 기대 고유번호는 원문이
// 가리키는 세대 하나다. 후보 안에 정답이 분명히 있는데도 매칭이 못 찾던 것이
// 이 파일이 지키는 계약이다.
//
// 새 유형을 발견하면 여기에 케이스를 추가한다. 스크립트는 건드리지 않는다.

const JIP = "집합건물";

// 등기 후보 하나. sojae는 소재지, buldnm은 건물명, unique_no는 고유번호다.
const c = (unique_no, dong, ho, sojae, buldnm) =>
  ({ unique_no, dong, ho, sojae, buldnm, real_cls_cd: JIP });

// 층×호로 후보를 펼친다. 등기부는 층과 호를 결합해 "301"처럼 적는다.
function floors(prefix, sojae, buldnm, dong, floorList, roomList) {
  const out = [];
  for (const floor of floorList) {
    for (const room of roomList) {
      const ho = `${floor}${String(room).padStart(2, "0")}`;
      out.push(c(`${prefix}-${dong}-${ho}`, dong, ho, sojae, buldnm));
    }
  }
  return out;
}

export const CASES = [
  {
    name: "진흥아파트 · 층 유실",
    why: "101동 3층1호를 호 \"1\"로만 읽어 각 층 1호가 전부 걸리던 유형(실측 136행)",
    juso: {
      match: /마산리\s*123/,
      item: {
        admCd: "4311325329", rnMgtSn: "431132123456",
        jibunAddr: "충청북도 청주시 청원구 내수읍 마산리 123 진흥아파트",
        roadAddr: "충청북도 청주시 청원구 내수읍 내수로 1",
        roadAddrPart1: "충청북도 청주시 청원구 내수읍 내수로 1",
        bdNm: "진흥아파트", bdKdcd: "1",
        lnbrMnnm: "123", lnbrSlno: "0", mtYn: "0", buldMnnm: "1", buldSlno: "0",
        siNm: "충청북도", sggNm: "청주시 청원구", emdNm: "마산리",
        bdMgtSn: "4311325329101230000000001"
      }
    },
    iros: {
      match: /마산리\s*123/,
      candidates: floors("JH", "충청북도 청주시 청원구 내수읍 마산리 123", "진흥아파트",
        "101", [1, 2, 3, 4, 5], [1, 2, 3])
    },
    rows: [
      { raw: "충북 청원군 내수읍 마산리 123 진흥아파트 101동 3층1호", uniqueNo: "JH-101-301" },
      { raw: "충북 청원군 내수읍 마산리 123 진흥아파트 101동 5층1호", uniqueNo: "JH-101-501" },
      { raw: "충북 청원군 내수읍 마산리 123 진흥아파트 101동 4층2호", uniqueNo: "JH-101-402" }
    ]
  },

  {
    name: "서도1차 · 추정 동 무시",
    why: "\"서도아파트 102\"의 102는 호인데 그룹 전파로 동 101이 붙던 유형(실측 94행)",
    juso: {
      match: /읍하리\s*442/,
      item: {
        admCd: "5173025021", rnMgtSn: "517302123456",
        jibunAddr: "강원특별자치도 횡성군 횡성읍 읍하리 442 서도1차아파트",
        roadAddr: "강원특별자치도 횡성군 횡성읍 횡성로 1",
        roadAddrPart1: "강원특별자치도 횡성군 횡성읍 횡성로 1",
        bdNm: "서도1차아파트", bdKdcd: "1",
        lnbrMnnm: "442", lnbrSlno: "0", mtYn: "0", buldMnnm: "1", buldSlno: "0",
        siNm: "강원특별자치도", sggNm: "횡성군", emdNm: "읍하리",
        bdMgtSn: "5173025021104420000000001"
      }
    },
    iros: {
      match: /읍하리\s*442/,
      // 등기부에 동 표기가 없는 단일동 건물
      candidates: [101, 102, 103, 104, 105].map((ho) =>
        c(`SD-${ho}`, "", String(ho), "강원특별자치도 횡성군 횡성읍 읍하리 442", "서도1차아파트"))
    },
    rows: [
      { raw: "강원 횡성군 횡성읍 읍하리 442 서도아파트 102", uniqueNo: "SD-102" },
      { raw: "강원 횡성군 횡성읍 읍하리 442 서도아파트 103", uniqueNo: "SD-103" }
    ]
  },

  {
    name: "삼본아파트 · 복수지번 소재지",
    why: "확정 지번으로 후보를 거르면 전멸해 208건을 모아 놓고 검증실패로 끝나던 유형(실측 194행)",
    juso: {
      match: /묵호진동\s*1-83/,
      item: {
        admCd: "5177010700", rnMgtSn: "517701123456",
        jibunAddr: "강원특별자치도 동해시 묵호진동 1-83 삼본아파트",
        roadAddr: "강원특별자치도 동해시 일출로 1",
        roadAddrPart1: "강원특별자치도 동해시 일출로 1",
        bdNm: "삼본아파트", bdKdcd: "1",
        lnbrMnnm: "1", lnbrSlno: "83", mtYn: "0", buldMnnm: "1", buldSlno: "0",
        siNm: "강원특별자치도", sggNm: "동해시", emdNm: "묵호진동",
        bdMgtSn: "5177010700100010083000001"
      }
    },
    iros: {
      match: /묵호진동\s*1-83|어달동/,
      // 등기 소재지는 어달동 12-1 — 확정 지번(묵호진동 1-83)과 다르다
      candidates: [101, 102, 103].map((ho) =>
        c(`SB-${ho}`, "101", String(ho), "강원특별자치도 동해시 어달동 12-1", "삼본아파트"))
    },
    rows: [
      { raw: "강원 동해시 어달동 12-1,2,5 묵호진동1-83 101동 101호", uniqueNo: "SB-101" },
      { raw: "강원 동해시 어달동 12-1,2,5 묵호진동1-83 101동 102호", uniqueNo: "SB-102" }
    ]
  },

  {
    name: "한신휴플러스 · 중복 동 표기",
    why: "\"106동 1동 102호\"에서 뒤의 1동만 채택해 진짜 동인 106동이 유실되던 유형(실측 40행)",
    juso: {
      match: /효자동1가\s*799/,
      item: {
        admCd: "5211112400", rnMgtSn: "521111123456",
        jibunAddr: "전북특별자치도 전주시 완산구 효자동1가 799 효자동 한신휴플러스",
        roadAddr: "전북특별자치도 전주시 완산구 따박골4길 10",
        roadAddrPart1: "전북특별자치도 전주시 완산구 따박골4길 10",
        bdNm: "효자동 한신휴플러스", bdKdcd: "1",
        lnbrMnnm: "799", lnbrSlno: "0", mtYn: "0", buldMnnm: "10", buldSlno: "0",
        siNm: "전북특별자치도", sggNm: "전주시 완산구", emdNm: "효자동1가",
        bdMgtSn: "5211112400107990000000001"
      }
    },
    iros: {
      match: /효자동1가\s*799/,
      candidates: [
        ...floors("HS", "전북특별자치도 전주시 완산구 효자동1가 799", "효자동 한신휴플러스",
          "106", [1, 2], [1, 2]),
        ...floors("HS", "전북특별자치도 전주시 완산구 효자동1가 799", "효자동 한신휴플러스",
          "107", [1, 2], [1, 2])
      ]
    },
    rows: [
      { raw: "전북 전주시 완산구 효자동1가 799 효자동한신휴플러스아파트 106동 1동 102호",
        uniqueNo: "HS-106-102" }
    ]
  },

  {
    name: "청우아파트 · 등기부 동 체계 불일치",
    why: "원문 302동인데 등기부는 가동·나동으로 적혀 요청 동이 아예 없던 유형(실측 45행)",
    juso: {
      match: /황성동\s*241-4/,
      item: {
        admCd: "4713012400", rnMgtSn: "471301123456",
        jibunAddr: "경상북도 경주시 황성동 241-4 청우아파트",
        roadAddr: "경상북도 경주시 황성로69번길 10",
        roadAddrPart1: "경상북도 경주시 황성로69번길 10",
        bdNm: "청우아파트", bdKdcd: "1",
        lnbrMnnm: "241", lnbrSlno: "4", mtYn: "0", buldMnnm: "10", buldSlno: "0",
        siNm: "경상북도", sggNm: "경주시", emdNm: "황성동",
        bdMgtSn: "4713012400102410004000001"
      }
    },
    iros: {
      match: /황성동\s*241-4/,
      candidates: [
        c("CW-가-102", "가", "102", "경상북도 경주시 황성동 241-4", "청우아파트"),
        c("CW-가-104", "가", "104", "경상북도 경주시 황성동 241-4", "청우아파트"),
        c("CW-나-201", "나", "201", "경상북도 경주시 황성동 241-4", "청우아파트")
      ]
    },
    rows: [
      { raw: "경북 경주시 황성동 241-4 청우아파트 302동 102호", uniqueNo: "CW-가-102" }
    ]
  },

  {
    name: "정상 매칭 · 회귀 감시",
    why: "완화 규칙들이 멀쩡한 동·호 매칭을 흔들지 않는지 본다",
    juso: {
      match: /역삼동\s*736-25/,
      item: {
        admCd: "1168010100", rnMgtSn: "116801123456",
        jibunAddr: "서울특별시 강남구 역삼동 736-25 멀티캠퍼스",
        roadAddr: "서울특별시 강남구 테헤란로 212",
        roadAddrPart1: "서울특별시 강남구 테헤란로 212",
        bdNm: "멀티캠퍼스", bdKdcd: "1",
        lnbrMnnm: "736", lnbrSlno: "25", mtYn: "0", buldMnnm: "212", buldSlno: "0",
        siNm: "서울특별시", sggNm: "강남구", emdNm: "역삼동",
        bdMgtSn: "1168010100107360025000001"
      }
    },
    iros: {
      match: /역삼동\s*736-25/,
      candidates: [
        ...floors("MC", "서울특별시 강남구 역삼동 736-25", "멀티캠퍼스", "101", [6, 7], [1, 2]),
        ...floors("MC", "서울특별시 강남구 역삼동 736-25", "멀티캠퍼스", "102", [6, 7], [1, 2])
      ]
    },
    rows: [
      { raw: "서울 강남구 역삼동 736-25 멀티캠퍼스 101동 601호", uniqueNo: "MC-101-601" },
      { raw: "서울 강남구 역삼동 736-25 멀티캠퍼스 102동 702호", uniqueNo: "MC-102-702" }
    ]
  }
];

export function expectationOf(row) {
  return { uniqueNo: row.uniqueNo || "" };
}

// 원문에 쉼표가 들어간다("어달동 12-1,2,5"). CSV 필드로 잘리지 않게 감싼다.
const csvField = (value) => /[",\n]/.test(String(value))
  ? `"${String(value).replace(/"/g, '""')}"`
  : String(value);

export function buildCsv(cases) {
  const lines = ["주소"];
  for (const c of cases) for (const row of c.rows) lines.push(csvField(row.raw));
  return "﻿" + lines.join("\n") + "\n";
}
