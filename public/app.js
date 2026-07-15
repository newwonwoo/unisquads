if (typeof window !== 'undefined' && !window.storage) { window.storage = { get: async (k) => { const v = localStorage.getItem(k); return v == null ? null : { key: k, value: v }; }, set: async (k, v) => { localStorage.setItem(k, v); return { key: k, value: v }; }, delete: async (k) => { localStorage.removeItem(k); return { key: k, deleted: true }; }, list: async (p='') => { const keys=[]; for(let i=0;i<localStorage.length;i++){const kk=localStorage.key(i); if(kk&&kk.startsWith(p))keys.push(kk);} return { keys }; }, }; }
const { useState, useEffect, useCallback, useRef } = React;
function toHalfWidth(str) {
  return str.replace(/[\uFF01-\uFF5E]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 65248)).replace(/\u3000/g, " ");
}
const HANJA_MAP = {
  "\u7279\u5225\u5E02": "\uD2B9\uBCC4\uC2DC",
  "\u5EE3\u57DF\u5E02": "\uAD11\uC5ED\uC2DC",
  "\u7279\u5225\u81EA\u6CBB\u5E02": "\uD2B9\uBCC4\uC790\uCE58\uC2DC",
  "\u7279\u5225\u81EA\u6CBB\u9053": "\uD2B9\uBCC4\uC790\uCE58\uB3C4",
  "\u9053": "\uB3C4",
  "\u5E02": "\uC2DC",
  "\u90E1": "\uAD70",
  "\u5340": "\uAD6C",
  "\u9091": "\uC74D",
  "\u9762": "\uBA74",
  "\u91CC": "\uB9AC",
  "\u6D1E": "\uB3D9",
  "\u8857": "\uAC00",
  "\u8DEF": "\uB85C",
  "\u756A\u5730": "\uBC88\uC9C0",
  "\u5C71": "\uC0B0",
  "\uC11C\uC6B8": "\uC11C\uC6B8",
  "\u4EAC\u757F": "\uACBD\uAE30",
  "\u6C5F\u539F": "\uAC15\uC6D0",
  "\u5FE0\u5317": "\uCDA9\uBD81",
  "\u5FE0\u5357": "\uCDA9\uB0A8",
  "\u5168\u5317": "\uC804\uBD81",
  "\u5168\u5357": "\uC804\uB0A8",
  "\u6176\u5317": "\uACBD\uBD81",
  "\u6176\u5357": "\uACBD\uB0A8",
  "\u6FDF\u5DDE": "\uC81C\uC8FC",
  "\u91DC\u5C71": "\uBD80\uC0B0",
  "\u5927\u90B1": "\uB300\uAD6C",
  "\u4EC1\u5DDD": "\uC778\uCC9C",
  "\u5149\u5DDE": "\uAD11\uC8FC",
  "\u5927\u7530": "\uB300\uC804",
  "\u851A\u5C71": "\uC6B8\uC0B0",
  "\u4E16\u5B97": "\uC138\uC885",
  "\u6C5F\u5357": "\uAC15\uB0A8",
  "\u6C5F\u6771": "\uAC15\uB3D9",
  "\u6C5F\u897F": "\uAC15\uC11C",
  "\u677E\u5761": "\uC1A1\uD30C",
  "\u745E\u8349": "\uC11C\uCD08",
  "\u937E\u8DEF": "\uC885\uB85C",
  "\u4E2D": "\uC911",
  "\u6771": "\uB3D9",
  "\u897F": "\uC11C",
  "\u5357": "\uB0A8",
  "\u5317": "\uBD81"
};
function hanjaToHangul(str) {
  let s = str;
  for (const [h, k] of Object.entries(HANJA_MAP).sort((a, b) => b[0].length - a[0].length)) {
    s = s.split(h).join(k);
  }
  return s;
}
function stripSuffixes(str) {
  return str.replace(/(\d)\s*번지/g, "$1 ").replace(/일원|일대|부근|인근|근처/g, " ").replace(/외\s*\d+\s*필지/g, " ").replace(/소재(지)?/g, " ").trim();
}
const SIDO_TOKENS = [
  "\uC11C\uC6B8\uD2B9\uBCC4\uC2DC",
  "\uC11C\uC6B8\uC2DC",
  "\uC11C\uC6B8",
  "\uBD80\uC0B0\uAD11\uC5ED\uC2DC",
  "\uBD80\uC0B0\uC2DC",
  "\uBD80\uC0B0",
  "\uB300\uAD6C\uAD11\uC5ED\uC2DC",
  "\uB300\uAD6C\uC2DC",
  "\uB300\uAD6C",
  "\uC778\uCC9C\uAD11\uC5ED\uC2DC",
  "\uC778\uCC9C\uC2DC",
  "\uC778\uCC9C",
  "\uAD11\uC8FC\uAD11\uC5ED\uC2DC",
  "\uAD11\uC8FC\uC2DC",
  "\uAD11\uC8FC",
  "\uB300\uC804\uAD11\uC5ED\uC2DC",
  "\uB300\uC804\uC2DC",
  "\uB300\uC804",
  "\uC6B8\uC0B0\uAD11\uC5ED\uC2DC",
  "\uC6B8\uC0B0\uC2DC",
  "\uC6B8\uC0B0",
  "\uC138\uC885\uD2B9\uBCC4\uC790\uCE58\uC2DC",
  "\uC138\uC885\uC2DC",
  "\uC138\uC885",
  "\uACBD\uAE30\uB3C4",
  "\uACBD\uAE30",
  "\uAC15\uC6D0\uD2B9\uBCC4\uC790\uCE58\uB3C4",
  "\uAC15\uC6D0\uB3C4",
  "\uAC15\uC6D0",
  "\uCDA9\uCCAD\uBD81\uB3C4",
  "\uCDA9\uBD81",
  "\uCDA9\uCCAD\uB0A8\uB3C4",
  "\uCDA9\uB0A8",
  "\uC804\uBD81\uD2B9\uBCC4\uC790\uCE58\uB3C4",
  "\uC804\uB77C\uBD81\uB3C4",
  "\uC804\uBD81",
  "\uC804\uB77C\uB0A8\uB3C4",
  "\uC804\uB0A8",
  "\uACBD\uC0C1\uBD81\uB3C4",
  "\uACBD\uBD81",
  "\uACBD\uC0C1\uB0A8\uB3C4",
  "\uACBD\uB0A8",
  "\uC81C\uC8FC\uD2B9\uBCC4\uC790\uCE58\uB3C4",
  "\uC81C\uC8FC\uB3C4",
  "\uC81C\uC8FC"
];
function splitAdminPrefix(str) {
  let s = str;
  // 2026-07-13 수정: 예전엔 긴 시도명이 '이미 띄어쓰기 정상'이면 분리하지 않고
  // 루프를 계속 돌았고, 그 결과 더 짧은 접두("서울")가 다시 매칭돼
  // "서울특별시 강남구" → "서울 특별시 강남구" 로 정식 표기를 깨뜨렸다.
  // 이제 가장 긴 시도명이 매칭되면 (분리 여부와 무관하게) 즉시 종료한다.
  let sidoFound = false;
  for (const sido of [...SIDO_TOKENS].sort((a, b) => b.length - a.length)) {
    if (!s.startsWith(sido)) continue;
    sidoFound = true;
    if (s.length > sido.length && s[sido.length] !== " ") {
      s = sido + " " + s.slice(sido.length);   // 붙어있을 때만 분리
    }
    break;                                      // 매칭됐으면 더 짧은 접두는 보지 않음
  }
  // 2026-07-13 수정: 예전엔 /([가-힣]{1,3}(?:시|구|군))(?=[가-힣])/g 를 문자열
  // '전역'에 치환해서, 건물명 한가운데의 '…시'까지 시(市)로 오인했다.
  //   "서울 송파구 헬리오시티" → "…헬리오시 티"  ← 건물명 파손 → 검색 실패
  // 이제 (1) 시도가 확인된 주소에서만, (2) 문자열 '앞부분'에서만, (3) 최대 2단계
  // (시 → 구)까지만 분리한다. 건물명은 앞부분에 오지 않으므로 안전하다.
  if (sidoFound) {
    const head = /^([가-힣]{1,3}(?:시|구|군))(?=[가-힣])/;
    const sp = s.indexOf(" ");
    let prefix = sp < 0 ? "" : s.slice(0, sp + 1);
    let rest = sp < 0 ? s : s.slice(sp + 1);
    for (let i = 0; i < 2; i++) {
      const m = rest.match(head);
      if (!m) break;                            // 이미 띄어져 있으면 즉시 중단
      rest = m[1] + " " + rest.slice(m[1].length);
      const nx = rest.indexOf(" ");
      prefix += rest.slice(0, nx + 1);
      rest = rest.slice(nx + 1);
    }
    s = prefix + rest;
  }
  return s.replace(/\s+/g, " ").trim();
}
// ─────────────────────────────────────────────────────────────
// 시군구 교차검증 (2026-07-13 신설)
// 카카오 폴백(L3)은 '건물명'으로 검색하므로 동명(同名) 건물이 있는 다른
// 지역을 물어올 수 있다(영등포푸르지오 vs 당산푸르지오). 결과를 그대로
// CONFIRMED 처리하면 '틀린 등기고유번호'가 확정된다 — 미확정보다 훨씬 나쁘다.
// 규칙: 입력과 결과 양쪽에서 지역을 '명확히' 뽑았고 서로 어긋날 때만 강등한다.
// 한쪽이라도 못 뽑으면 NOT_AVAILABLE(판단보류) — 검증 못 하는 걸 실패로 만들지 않는다.
const SIDO_CANON = {
  "\uC11C\uC6B8": "\uC11C\uC6B8", "\uBD80\uC0B0": "\uBD80\uC0B0", "\uB300\uAD6C": "\uB300\uAD6C",
  "\uC778\uCC9C": "\uC778\uCC9C", "\uAD11\uC8FC": "\uAD11\uC8FC", "\uB300\uC804": "\uB300\uC804",
  "\uC6B8\uC0B0": "\uC6B8\uC0B0", "\uC138\uC885": "\uC138\uC885", "\uACBD\uAE30": "\uACBD\uAE30",
  "\uAC15\uC6D0": "\uAC15\uC6D0", "\uCDA9\uBD81": "\uCDA9\uBD81", "\uCDA9\uCCAD\uBD81": "\uCDA9\uBD81",
  "\uCDA9\uB0A8": "\uCDA9\uB0A8", "\uCDA9\uCCAD\uB0A8": "\uCDA9\uB0A8",
  "\uC804\uBD81": "\uC804\uBD81", "\uC804\uB77C\uBD81": "\uC804\uBD81",
  "\uC804\uB0A8": "\uC804\uB0A8", "\uC804\uB77C\uB0A8": "\uC804\uB0A8",
  "\uACBD\uBD81": "\uACBD\uBD81", "\uACBD\uC0C1\uBD81": "\uACBD\uBD81",
  "\uACBD\uB0A8": "\uACBD\uB0A8", "\uACBD\uC0C1\uB0A8": "\uACBD\uB0A8",
  "\uC81C\uC8FC": "\uC81C\uC8FC"
};
function canonSido(tok) {
  if (!tok) return "";
  // 특별시/광역시/특별자치시/특별자치도/도/시 접미를 벗겨 표준 축약형으로
  let b = String(tok).replace(/(\uD2B9\uBCC4\uC790\uCE58\uC2DC|\uD2B9\uBCC4\uC790\uCE58\uB3C4|\uD2B9\uBCC4\uC2DC|\uAD11\uC5ED\uC2DC|\uC790\uCE58\uC2DC|\uC790\uCE58\uB3C4|\uB3C4|\uC2DC)$/, "");
  return SIDO_CANON[b] || b;
}
const RE_SGG = /^[\uAC00-\uD7A3]{1,6}(\uC2DC|\uAD70|\uAD6C)$/;
// 법정동 토큰: 앞부분을 4글자로 제한한다. "래미안원베일리"처럼 '리'로 끝나는
// 건물명이 법정동으로 오인되던 문제 방지(길이 초과 → 추출 안 함 → 판단보류).
const RE_BJD = /^[\uAC00-\uD7A3]{1,4}\d*(\uB3D9|\uC74D|\uBA74|\uB9AC|\uAC00)$/;
// 비교 키: 숫자·말미 '가' 제거 → 역삼1동=역삼동, 명동=명동1가, 종로1가=종로
const bjdKey = (t) => String(t || "").replace(/\d+/g, "").replace(/\uAC00$/, "");
function extractRegion(text) {
  const out = { sido: "", sgg: [], bjd: "" };
  if (!text) return out;
  let s = String(text).replace(/\s+/g, " ").trim();
  for (const sido of [...SIDO_TOKENS].sort((a, b) => b.length - a.length)) {
    if (s.startsWith(sido)) { out.sido = canonSido(sido); s = s.slice(sido.length).trim(); break; }
  }
  for (const t of s.split(" ")) {
    if (RE_SGG.test(t) && out.sgg.length < 2 && !out.bjd) { out.sgg.push(t); continue; }
    if (!out.bjd && RE_BJD.test(t)) { out.bjdRaw = t; out.bjd = bjdKey(t); }
  }
  return out;
}
function validateRegion(inputText, resultJibun) {
  const a = extractRegion(inputText);
  const b = extractRegion(resultJibun);
  const label = (r) => [r.sido, ...r.sgg, r.bjd].filter(Boolean).join(" ");
  const mk = (status, reason) => ({ status, reason, inputSgg: label(a), resultSgg: label(b) });
  if (a.sido && b.sido && a.sido !== b.sido) return mk("MISMATCH", `\uC2DC\uB3C4 \uBD88\uC77C\uCE58(${a.sido}\u2260${b.sido})`);
  if (a.sgg.length && b.sgg.length) {
    // 입력이 덜 구체적인 건 정상(성남시 ⊂ 성남시 분당구) — 어긋날 때만 불일치
    const n = Math.min(a.sgg.length, b.sgg.length);
    for (let i = 0; i < n; i++)
      if (a.sgg[i] !== b.sgg[i]) return mk("MISMATCH", `\uC2DC\uAD70\uAD6C \uBD88\uC77C\uCE58(${a.sgg[i]}\u2260${b.sgg[i]})`);
    // 시군구가 같아도 법정동이 어긋나면 오확정(같은 구의 동명 건물) — 계속 검사
    if (a.bjd && b.bjd && a.bjd !== b.bjd)
      return mk("MISMATCH", `\uBC95\uC815\uB3D9 \uBD88\uC77C\uCE58(${a.bjdRaw || a.bjd}\u2260${b.bjdRaw || b.bjd})`);
    return mk("MATCH", a.bjd && b.bjd ? "\uC2DC\uAD70\uAD6C\xB7\uBC95\uC815\uB3D9 \uC77C\uCE58" : "\uC2DC\uAD70\uAD6C \uC77C\uCE58");
  }
  if (a.bjd && b.bjd) {
    if (a.bjd !== b.bjd) return mk("MISMATCH", `\uBC95\uC815\uB3D9 \uBD88\uC77C\uCE58(${a.bjdRaw || a.bjd}\u2260${b.bjdRaw || b.bjd})`);
    return mk("MATCH", "\uBC95\uC815\uB3D9 \uC77C\uCE58");
  }
  return mk("NOT_AVAILABLE", a.sido || a.sgg.length || a.bjd ? "\uACB0\uACFC\uC5D0\uC11C \uC9C0\uC5ED \uCD94\uCD9C \uBD88\uAC00" : "\uC785\uB825\uC5D0\uC11C \uC9C0\uC5ED \uCD94\uCD9C \uBD88\uAC00");
}
const JIP_KEYWORDS = /(아파트|apt|빌라|빌리지|연립|다세대|오피스텔|맨션|타운|팰리스|캐슬|자이|힐스|푸르지오|아이파크|e편한|이편한|더샵|롯데캐슬|래미안|센트|리버|파크|하이츠|스카이|타워|주상복합|헤리티지|포레|아이유쉘|쉐르빌|베르디움|엘크루|리슈빌|스위첸|데시앙|꿈에그린|우방|한신|현대|삼성|엘지|지에스)/i;
const JIBUN_CONTEXT = /(동|읍|면|리|로|길|가)\s*$/;
const RE_DONG_HO = /제?\s*(\d{1,4})\s*동\s*제?\s*(\d{1,4})\s*호/;
const RE_DONG_ONLY = /제?\s*(\d{1,4})\s*동(?!\s*\d*\s*호)/;
const RE_HO_ONLY = /제?\s*(\d{1,4})\s*호/;
const RE_FLOOR = /(지하\s*\d{1,3}|B\s*\d{1,2}|반지하|[지제]?\s*\d{1,3})\s*층/gi;
const RE_ALPHA_DONG_HO = /(?:^|\s)([A-Za-z]|[가-힣])동\s*제?\s*(\d{1,4})\s*호/;
function extractUnit(str) {
  let text = str, dong = null, ho = null;
  text = text.replace(RE_FLOOR, " ");
  const pair = text.match(RE_DONG_HO);
  if (pair) {
    dong = pair[1];
    ho = pair[2];
    text = text.replace(RE_DONG_HO, " ");
  } else {
    const alpha = text.match(RE_ALPHA_DONG_HO);
    if (alpha) {
      dong = alpha[1];
      ho = alpha[2];
      text = text.replace(RE_ALPHA_DONG_HO, " ");
    } else {
      const dongOnly = text.match(RE_DONG_ONLY);
      if (dongOnly) {
        dong = dongOnly[1];
        text = text.replace(RE_DONG_ONLY, " ");
      }
      const hoOnly = text.match(RE_HO_ONLY);
      if (hoOnly) {
        ho = hoOnly[1];
        text = text.replace(RE_HO_ONLY, " ");
      }
    }
  }
  return { text: text.replace(/\s+/g, " ").trim(), dong, ho };
}
function inferUnitFromNumbers(searchText, existing) {
  if (existing.dong || existing.ho) return existing;
  const m = searchText.match(/^(.*?)\s+(\d{1,4})\s*[-/]\s*(\d{1,4})\s*$/);
  if (!m) return existing;
  const head = m[1].trim();
  if (JIBUN_CONTEXT.test(head)) return existing;
  if (JIP_KEYWORDS.test(head)) {
    return { dong: m[2], ho: m[3], text: head };
  }
  return existing;
}
function normalizeUnitInput(v) {
  if (!v) return null;
  const m = String(v).match(/\d{1,4}/);
  return m ? m[0] : null;
}

// ─────────────────────────────────────────────────────────────
// 지번 코어 추출 (2026-07-13, 실데이터 2만 실패건 분석 기반)
// juso가 "지번 + 건물명 + 동 + 호"를 통째로 받으면 못 찾는다. 실패건의 81%가
// 이 형태였다. 지번까지만 남기고 뒤를 버리되, 동·호를 지번으로 오인하면
// 오확정이 나므로 규칙을 엄격히 둔다:
//   R1. 행정구역(동/리/읍/면/가) 토큰 '직후'의 숫자만 지번으로 채택
//   R2. 건물명(아파트·맨션 등) 토큰을 만나면 이후 숫자는 동·호로 간주(지번 아님)
//   R3. 단, 건물명 뒤라도 다시 '동/리 + 숫자'가 나오면 그 숫자를 지번으로 되살림
//       (예: "태원아파트 101-107 평산리 564" → 564가 진짜 지번, 101-107은 동호)
//   R4. 법정동/리가 중복되면(문산리 문산리) 하나만
// 지번을 못 찾으면 원문을 그대로 두어(=juso가 알아서 처리하게) 오확정을 피한다.
const BUILDING_TOKEN = /(아파트|맨션|타운|오피스텔|빌라|빌리지|타워|하이츠|팰리스|캐슬|자이|푸르지오|리버|주공|연립|훼미리|하우스|시티|더샵|이편한|e편한|래미안|힐스|아이파크|드림빌|스타힐스|파크빌|파크|빌딩|프라자|플라자|파밀리에|스타힐스|해링턴|센트럴|센트레빌|엘크루|데시앙|꿈에그린|한신|현대|삼성|대우|롯데|쌍용|우성|경남|한도|금호|신동아|청도)/;
const ADMIN_DONG_RI = /^(.+?)(동|리)$/;   // 동/리로 끝나는 행정구역 토큰
const ADMIN_ANY = /(동|리|읍|면|가|구|시|군)$/;

function extractJibunCore(str) {
  // 노이즈 선제거(B): 쉼표 복수지번, 물결 범위, 말미 점
  let s = str
    .replace(/(\d+-\d+)\s*,\s*\d+-\d+/g, "$1")   // 233-67,233-82 → 233-67
    .replace(/~\s*\d+/g, " ")                       // 200~638 → 200
    .replace(/(\d)\s*\.(?=\s|$)/g, "$1 ");         // 302-6. → 302-6
  // 숫자+건물명 완전붙음 분리: 와리251-7금호 → 와리 251-7 금호
  // 단 "장충동2가"의 2가(법정동)는 깨지 않도록, 숫자 뒤가 '가'면 제외
  s = s.replace(/([가-힣])(\d)/g, "$1 $2").replace(/(\d)([가-힣])/g, (m, d, k) => k === "\uAC00" ? m : `${d} ${k}`);
  s = s.replace(/\uC0B0\s+(\d)/g, "\uC0B0$1");   // '산 12-3' → '산12-3' (산 접두 재결합)
  s = s.replace(/\s+/g, " ").trim();

  const toks = s.split(" ");
  const out = [];
  const seenDongRi = new Set();
  let prevAdmin = false;      // 직전 토큰이 지번을 받을 수 있는 행정구역(동/리/읍/면)인가
  let hitBuilding = false;    // 건물명을 지났는가
  let lastAdminWasDongRi = false;
  let jibun = null;

  const SIDO_TAIL = /(특별시|광역시|특별자치시|특별자치도|^[가-힣]+도$)/;
  const SIDO_SHORT = /^(서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충북|충남|전북|전남|경북|경남|제주)$/;

  for (let i = 0; i < toks.length; i++) {
    const t = toks[i];
    if (t === "") continue;

    // 시도 토큰(경기도·서울특별시·서울 등)은 무조건 보존, 지번 앵커 아님
    if (SIDO_TAIL.test(t) || SIDO_SHORT.test(t) || (/(시|도)$/.test(t) && i === 0)) {
      out.push(t); prevAdmin = false; lastAdminWasDongRi = false; continue;
    }

    // 건물명 토큰 — '시티'처럼 시(市)로 끝나는 건물명을 시군구보다 먼저 판정
    if (BUILDING_TOKEN.test(t) && !/^\d/.test(t)) {
      hitBuilding = true; prevAdmin = false; lastAdminWasDongRi = false;
      continue;   // R2: 건물명 자체는 검색어에서 제외
    }

    // 'N가'(종로1가·장충동2가류)는 법정동의 일부 — 지번 아님, 보존
    if (/가$/.test(t)) {
      if (!hitBuilding) out.push(t);
      prevAdmin = true; lastAdminWasDongRi = false; continue;
    }

    // 행정구역 토큰(숫자 없는)
    if (ADMIN_ANY.test(t) && !/\d/.test(t)) {
      const dr = ADMIN_DONG_RI.test(t);
      if (dr) {
        if (seenDongRi.has(t)) { prevAdmin = true; lastAdminWasDongRi = true; continue; } // R4 중복
        seenDongRi.add(t);
      }
      if (!hitBuilding) out.push(t);
      prevAdmin = /(동|리|읍|면)$/.test(t);
      lastAdminWasDongRi = dr;
      continue;
    }

    // 숫자 토큰(지번 후보) — '산12-3'의 산 접두 포함
    const m = t.match(/^(산?\d+(?:-\d+)?)$/);
    if (m) {
      const val = m[1];
      if ((!hitBuilding && prevAdmin) || (hitBuilding && prevAdmin && lastAdminWasDongRi)) {
        if (hitBuilding) {
          const prevTok = out[out.length - 1];
          if (i >= 1 && ADMIN_DONG_RI.test(toks[i - 1]) && prevTok !== toks[i - 1]) out.push(toks[i - 1]);
        }
        out.push(val); jibun = val;
        break;
      }
      prevAdmin = false; continue;
    }
    prevAdmin = false;
  }

  return { core: out.join(" "), jibun };
}

function preprocess(raw) {
  if (typeof raw !== "string" || raw.trim() === "")
    return { cleaned: "", searchText: "", unit: { dong: null, ho: null } };
  let s = toHalfWidth(raw);
  s = hanjaToHangul(s);
  s = s.replace(/[,·.]/g, " ");
  s = s.replace(/(\d)\s*의\s*(\d)/g, "$1-$2");
  s = s.replace(/[()[\]{}]/g, " ");
  s = s.replace(/[^\uAC00-\uD7A3a-zA-Z0-9\s\-/]/g, " ");
  s = stripSuffixes(s);
  s = splitAdminPrefix(s);
  s = s.replace(/산\s*(\d)/g, "\uC0B0 $1");
  s = s.replace(/([가-힣])(\d+(?:-\d+)?)(?=\s|$|\/)/g, "$1 $2");
  s = s.replace(/\s+/g, " ").trim();
  const cleaned = s;
  let { text, dong, ho } = extractUnit(s);
  const inferred = inferUnitFromNumbers(text, { dong, ho });
  if (inferred.dong || inferred.ho) {
    dong = inferred.dong;
    ho = inferred.ho;
    text = inferred.text ?? text;
  }
  text = text.replace(/\//g, " ").replace(/\s+/g, " ").trim();

  // 지번 코어 적용(2026-07-13): "지번 뒤 건물명·동호" 잔존이 juso 실패의 최대
  // 원인(실측 81%)이므로, 지번형 주소는 지번까지만 남긴다. 단 (1)도로명주소는
  // 건드리지 않고(로/길 포함 시 skip) (2)지번을 못 찾으면 기존 검색어를 유지해
  // 오확정을 피한다. 동·호는 위에서 이미 뽑았으므로 코어에서 빠져도 무방.
  const isRoad = /(\d+번?길|[가-힣]+로\s*\d|[가-힣]+길\s*\d)/.test(text);
  if (!isRoad) {
    const { core, jibun } = extractJibunCore(text);
    // 지번을 실제로 찾았을 때만 코어로 교체(건물명·동호 절단). 지번을 못 찾으면
    // 원본 검색어를 그대로 둔다 — 건물명만 있는 주소("헬리오시티")는 그 건물명이
    // 있어야 카카오 폴백이 동작하고, 지번 없는 주소를 억지로 자르면 오히려 실패한다.
    if (jibun && /(동|리|읍|면|가)/.test(core)) {
      text = core;
    }
  }
  return { cleaned, searchText: text, unit: { dong, ho } };
}
function fromJuso(item) {
  return {
    admCd: item.admCd ?? null,
    mtYn: item.mtYn ?? "0",
    mnnm: item.lnbrMnnm ?? null,
    slno: item.lnbrSlno ?? "0",
    roadAddr: item.roadAddr ?? null,
    jibunAddr: item.jibunAddr ?? null,
    bdMgtSn: item.bdMgtSn ?? null,
    bdNm: item.bdNm ?? "",
    // juso bdKdcd: "1"=공동주택(아파트·연립·다세대), "0"=일반건물
    isJip: item.bdKdcd === "1" || /아파트|빌라|연립|다세대|오피스텔|맨션|타운|팰리스|캐슬|자이|힐스|푸르지오/.test(item.bdNm ?? ""),
    source: "juso"
  };
}
function fromKakao(doc, regionCode = null) {
  const jibun = doc.address ?? null;
  let mtYn = "0", mnnm = null, slno = "0", admCd = regionCode;
  if (jibun) {
    mtYn = jibun.mountain_yn === "Y" ? "1" : "0";
    mnnm = jibun.main_address_no || null;
    slno = jibun.sub_address_no || "0";
    admCd = jibun.b_code || regionCode;
  }
  return {
    admCd,
    mtYn,
    mnnm,
    slno,
    roadAddr: doc.road_address?.address_name ?? null,
    // 2026-07-15 수정: 예전엔 `jibun?.address_name ?? doc.address_name`이라,
    // 카카오가 지번 없이 도로명만 준 경우 doc.address_name(장소 표시명=도로명)이
    // jibunAddr에 들어갔다. 이게 IROS로 넘어가 "경인로 302"처럼 도로명이 지번
    // 검색어로 쓰여 매칭이 전부 틀어졌다(실사례: 구로구 개봉동 센트레빌).
    // → 진짜 지번(jibun.address_name)이 있을 때만 jibunAddr을 채운다.
    jibunAddr: jibun?.address_name ?? null,
    bdMgtSn: null,
    bdNm: doc.place_name ?? "",
    source: "kakao"
  };
}
async function safeCall(fn, ...args) {
  if (typeof fn !== "function") return [];
  try {
    const r = await fn(...args);
    return Array.isArray(r) ? r : [];
  } catch (e) {
    if (e && e.transient) throw e;   // 분류된 일시 오류(한도/HTTP/네트워크)는 전파 — runBatch가 TRANSIENT로 기록
    return [];                       // 그 외 알 수 없는 오류는 기존대로 0건 취급(동작 보존)
  }
}
async function cascade(pre, clients) {
  const { cleaned, searchText } = pre;
  // jusoQuery: juso에 '실제로' 전달된 문자열(진단용). 전처리가 주소를 깨뜨렸는지
  // 원문과 나란히 봐야 판별 가능하므로 결과지에 그대로 남긴다.
  const tried = [cleaned];
  let items = await safeCall(clients.juso, cleaned);
  if (items.length > 0)
    return { candidates: items.map(fromJuso), level: "L1", jusoQuery: tried.join(" \u25B8 "), count: items.length };
  if (searchText && searchText !== cleaned) {
    tried.push(searchText);
    items = await safeCall(clients.juso, searchText);
    if (items.length > 0)
      return { candidates: items.map(fromJuso), level: "L2", jusoQuery: tried.join(" \u25B8 "), count: items.length };
  }
  if (clients.kakaoKeyword) {
    const docs = await safeCall(clients.kakaoKeyword, searchText || cleaned);
    if (docs.length > 0) {
      const out = [];
      for (const doc of docs) {
        let regionCode = null;
        if (!doc.address?.b_code && doc.x && doc.y && clients.kakaoCoord2Region) {
          const regions = await safeCall(clients.kakaoCoord2Region, doc.x, doc.y);
          const legal = regions.find((r) => r.region_type === "B");
          regionCode = legal?.code ?? null;
        }
        out.push(fromKakao(doc, regionCode));
      }
      return { candidates: out, level: "L3", jusoQuery: tried.join(" \u25B8 "), count: out.length };
    }
  }
  return { candidates: [], level: null, jusoQuery: tried.join(" \u25B8 "), count: 0 };
}
function pad4(n) {
  const v = String(n ?? "").replace(/\D/g, "");
  return v === "" ? "0000" : v.padStart(4, "0").slice(-4);
}
function buildPnu(c) {
  if (!c.admCd || String(c.admCd).length !== 10 || c.mnnm == null) return null;
  return `${c.admCd}${c.mtYn === "1" ? "2" : "1"}${pad4(c.mnnm)}${pad4(c.slno)}`;
}
function dedupe(candidates) {
  const seen = /* @__PURE__ */ new Set(), out = [];
  for (const c of candidates) {
    const key = c.bdMgtSn || buildPnu(c) || c.jibunAddr || JSON.stringify(c);
    if (!seen.has(key)) {
      seen.add(key);
      out.push(c);
    }
  }
  return out;
}
function commonPrefixLen(codes) {
  if (codes.length <= 1) return 10;
  const s = [...codes].sort(), a = s[0], b = s[s.length - 1];
  let i = 0;
  while (i < a.length && a[i] === b[i]) i++;
  return i;
}
function divergenceLevel(len) {
  if (len < 2) return "sido";
  if (len < 5) return "sigungu";
  return "parcel";
}
function regionLabel(c, level) {
  const tokens = (c.jibunAddr || c.roadAddr || "").split(" ");
  if (level === "sido") return tokens[0] || "?";
  const idx = tokens.findIndex((t) => /(동|읍|면|리|가)$/.test(t));
  return (idx > 0 ? tokens.slice(0, idx) : tokens.slice(0, 2)).join(" ") || "?";
}
function buildMessage(requireLevel, dongName, candidates) {
  const labels = [...new Set(candidates.map((c) => regionLabel(c, requireLevel)))];
  const shown = labels.slice(0, 3).join(" \xB7 ");
  const more = labels.length > 3 ? ` \uC678 ${labels.length - 3}\uACF3` : "";
  const target = dongName ? `'${dongName}'` : "\uC785\uB825\uD558\uC2E0 \uC8FC\uC18C";
  if (requireLevel === "sido") return `${target}\uC740(\uB294) ${shown}${more}\uC5D0 \uC788\uC2B5\uB2C8\uB2E4. \uC5B4\uB290 \uC9C0\uC5ED(\uC2DC/\uB3C4)\uC778\uC9C0 \uC54C\uB824\uC8FC\uC138\uC694.`;
  if (requireLevel === "sigungu") return `${target}\uC740(\uB294) ${shown}${more}\uC5D0 \uC788\uC2B5\uB2C8\uB2E4. \uC5B4\uB290 \uC2DC/\uAD70/\uAD6C\uC778\uC9C0 \uC54C\uB824\uC8FC\uC138\uC694.`;
  return `\uAC19\uC740 \uC9C0\uC5ED\uC5D0 \uD6C4\uBCF4\uAC00 ${candidates.length}\uAC74 \uC788\uC2B5\uB2C8\uB2E4. \uBC88\uC9C0 \uB610\uB294 \uAC74\uBB3C\uC744 \uC120\uD0DD\uD574\uC8FC\uC138\uC694.`;
}
function normalizeRawKey(s) {
  // 원문주소 그룹화 키: NFC 통일 + 앞뒤공백 제거 + 연속공백 1칸.
  // 키'만' 정규화하며 행의 raw 원본은 절대 변경하지 않는다.
  return String(s).normalize("NFC").trim().replace(/\s+/g, " ");
}
function buildIrosQuery(c, unit) {
  const parts = [c.jibunAddr || c.roadAddr || ""];
  if (unit?.dong) parts.push(`${unit.dong}\uB3D9`);
  if (unit?.ho) parts.push(`${unit.ho}\uD638`);
  return parts.filter(Boolean).join(" ").trim();
}
function guessDongName(searchText) {
  const m = (searchText || "").match(/([가-힣0-9]+(?:동|읍|면|리|가))(?:\s|$)/);
  return m ? m[1] : null;
}
function resolve(candidates, pre) {
  const unit = pre?.unit ?? { dong: null, ho: null };
  if (!pre || pre.cleaned === "")
    return { status: "FAILED", reason: "EMPTY_INPUT", message: "\uC8FC\uC18C\uB97C \uC785\uB825\uD574\uC8FC\uC138\uC694." };
  const deduped = dedupe(candidates).filter((c) => c.admCd);
  if (deduped.length === 0)
    return { status: "FAILED", reason: "NOT_FOUND", message: "\uC77C\uCE58\uD558\uB294 \uC8FC\uC18C\uB97C \uCC3E\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4. \uC624\uD0C0 \uD655\uC778 \uB610\uB294 \uC2E0\uCD95/\uBBF8\uB4F1\uB85D \uD544\uC9C0 \uC5EC\uBD80\uB97C \uD655\uC778\uD574\uC8FC\uC138\uC694." };
  if (deduped.length === 1) {
    const c = deduped[0];
    return {
      status: "CONFIRMED",
      jibunAddr: c.jibunAddr,
      roadAddr: c.roadAddr,
      bdNm: c.bdNm || null,
      pnu: buildPnu(c),
      bdMgtSn: c.bdMgtSn || null,
      unit,
      irosQuery: buildIrosQuery(c, unit),
      source: c.source,
      isJip: !!c.isJip
    };
  }
  const prefixLen = commonPrefixLen(deduped.map((c) => c.admCd));
  const requireLevel = divergenceLevel(prefixLen);
  const dongName = guessDongName(pre.searchText);
  return {
    status: "AMBIGUOUS",
    requireLevel,
    matchedDong: dongName,
    candidates: deduped.map((c) => ({
      sidoSigungu: regionLabel(c, "sigungu"),
      jibunAddr: c.jibunAddr,
      roadAddr: c.roadAddr,
      bdNm: c.bdNm || null,
      pnu: buildPnu(c),
      bdMgtSn: c.bdMgtSn || null,
      isJip: !!c.isJip
    })),
    message: buildMessage(requireLevel, dongName, deduped)
  };
}
async function refineAddress(raw, clients) {
  const pre = preprocess(raw);
  if (pre.cleaned === "") return resolve([], pre);
  const { candidates, level, jusoQuery, count } = await cascade(pre, clients);
  const result = resolve(candidates, pre);
  result.searchLevel = level;
  result.jusoQuery = jusoQuery;        // 진단: juso에 실제로 간 검색어
  result.candCount = count;            // 진단: 원천이 돌려준 후보 수
  if (result.status === "CONFIRMED") {
    const v = validateRegion(pre.cleaned, result.jibunAddr);
    result.validation = v;
    if (v.status === "MISMATCH") {
      // 명백한 지역 불일치 → 자동확정 취소. IROS 진입 필터가 CONFIRMED만
      // 통과시키므로, 이 건은 등기조회로 넘어가지 않고 검토 대상이 된다.
      result.status = "VALIDATION_FAILED";
      result.message = `\uC785\uB825 \uC9C0\uC5ED\uACFC \uAC80\uC0C9\uACB0\uACFC \uC9C0\uC5ED\uC774 \uB2E4\uB985\uB2C8\uB2E4 \u2014 ${v.reason}. \uC785\uB825: ${v.inputSgg || "?"} / \uACB0\uACFC: ${v.resultSgg || "?"} (${result.jibunAddr})`;
    }
  } else {
    result.validation = { status: "NOT_AVAILABLE", reason: "", inputSgg: "", resultSgg: "" };
  }
  return result;
}
const MOCK_JUSO_DB = [
  { keys: ["\uC5ED\uC0BC", "\uD14C\uD5E4\uB780\uB85C 212"], item: { admCd: "1168010100", mtYn: "0", lnbrMnnm: "736", lnbrSlno: "25", roadAddr: "\uC11C\uC6B8\uD2B9\uBCC4\uC2DC \uAC15\uB0A8\uAD6C \uD14C\uD5E4\uB780\uB85C 212", jibunAddr: "\uC11C\uC6B8\uD2B9\uBCC4\uC2DC \uAC15\uB0A8\uAD6C \uC5ED\uC0BC\uB3D9 736-25", bdMgtSn: "1168010100107360025000001", bdNm: "\uBA40\uD2F0\uCEA0\uD37C\uC2A4" } },
  { keys: ["\uC2E0\uC815\uB3D9"], item: { admCd: "1147010300", mtYn: "0", lnbrMnnm: "100", lnbrSlno: "1", roadAddr: "\uC11C\uC6B8\uD2B9\uBCC4\uC2DC \uC591\uCC9C\uAD6C \uC911\uC559\uB85C 100", jibunAddr: "\uC11C\uC6B8\uD2B9\uBCC4\uC2DC \uC591\uCC9C\uAD6C \uC2E0\uC815\uB3D9 100-1", bdMgtSn: null, bdNm: "" } },
  { keys: ["\uC2E0\uC815\uB3D9"], item: { admCd: "2726010600", mtYn: "0", lnbrMnnm: "100", lnbrSlno: "2", roadAddr: "\uB300\uAD6C\uAD11\uC5ED\uC2DC \uC11C\uAD6C \uAD6D\uCC44\uBCF4\uC0C1\uB85C 45", jibunAddr: "\uB300\uAD6C\uAD11\uC5ED\uC2DC \uC11C\uAD6C \uC2E0\uC815\uB3D9 100-2", bdMgtSn: null, bdNm: "" } },
  { keys: ["\uC911\uC559\uB3D9"], item: { admCd: "1111015100", mtYn: "0", lnbrMnnm: "50", lnbrSlno: "0", roadAddr: "\uC11C\uC6B8\uD2B9\uBCC4\uC2DC \uC885\uB85C\uAD6C \uC138\uC885\uB300\uB85C 175", jibunAddr: "\uC11C\uC6B8\uD2B9\uBCC4\uC2DC \uC885\uB85C\uAD6C \uC911\uC559\uB3D9 50", bdMgtSn: null, bdNm: "" } },
  { keys: ["\uC911\uC559\uB3D9"], item: { admCd: "2611010100", mtYn: "0", lnbrMnnm: "50", lnbrSlno: "0", roadAddr: "\uBD80\uC0B0\uAD11\uC5ED\uC2DC \uC911\uAD6C \uC911\uC559\uB300\uB85C 50", jibunAddr: "\uBD80\uC0B0\uAD11\uC5ED\uC2DC \uC911\uAD6C \uC911\uC559\uB3D94\uAC00 50", bdMgtSn: null, bdNm: "" } },
  { keys: ["\uC0B0\uC131\uB3D9 \uC0B0"], item: { admCd: "4311125346", mtYn: "1", lnbrMnnm: "12", lnbrSlno: "3", roadAddr: null, jibunAddr: "\uCDA9\uCCAD\uBD81\uB3C4 \uCCAD\uC8FC\uC2DC \uC0C1\uB2F9\uAD6C \uC0B0\uC131\uB3D9 \uC0B0 12-3", bdMgtSn: null, bdNm: "" } }
];
const MOCK_KAKAO_DB = [
  { keys: ["\uB798\uBBF8\uC548\uC6D0\uBCA0\uC77C\uB9AC", "\uC6D0\uBCA0\uC77C\uB9AC"], doc: { place_name: "\uB798\uBBF8\uC548\uC6D0\uBCA0\uC77C\uB9AC", address_name: "\uC11C\uC6B8 \uC11C\uCD08\uAD6C \uBC18\uD3EC\uB3D9 1-1", x: "127.0016", y: "37.5125", address: { address_name: "\uC11C\uC6B8 \uC11C\uCD08\uAD6C \uBC18\uD3EC\uB3D9 1-1", b_code: "1165010700", mountain_yn: "N", main_address_no: "1", sub_address_no: "1" }, road_address: { address_name: "\uC11C\uC6B8 \uC11C\uCD08\uAD6C \uC2E0\uBC18\uD3EC\uB85C 2" } } },
  { keys: ["\uD5EC\uB9AC\uC624\uC2DC\uD2F0"], doc: { place_name: "\uD5EC\uB9AC\uC624\uC2DC\uD2F0", address_name: "\uC11C\uC6B8 \uC1A1\uD30C\uAD6C \uAC00\uB77D\uB3D9 913", x: "127.106", y: "37.497", address: { address_name: "\uC11C\uC6B8 \uC1A1\uD30C\uAD6C \uAC00\uB77D\uB3D9 913", b_code: "1171010900", mountain_yn: "N", main_address_no: "913", sub_address_no: "" }, road_address: { address_name: "\uC11C\uC6B8 \uC1A1\uD30C\uAD6C \uC1A1\uD30C\uB300\uB85C 345" } } }
];
const mockClients = {
  juso: async (kw) => {
    const hits = MOCK_JUSO_DB.filter((e) => e.keys.some((k) => kw.includes(k)));
    const narrowed = hits.filter((e) => {
      const tokens = (e.item.jibunAddr || "").split(" ");
      const upper = tokens.slice(0, 2);
      return upper.some((t) => kw.includes(t.replace(/(특별시|광역시|특별자치시|도)$/, "")) || kw.includes(t));
    });
    return (narrowed.length > 0 ? narrowed : hits).map((e) => e.item);
  },
  kakaoKeyword: async (kw) => MOCK_KAKAO_DB.filter((e) => e.keys.some((k) => kw.includes(k))).map((e) => e.doc),
  kakaoCoord2Region: async () => []
};
function transientErr(msg) {
  // '일시 오류'(네트워크/HTTP/한도/서버) 표식 — 진짜 "검색결과 0건"과 구분해
  // 재정제 시 선별 재시도가 가능하게 한다(PM-01/02).
  const e = new Error(msg);
  e.transient = true;
  return e;
}
function makeRealClients(jusoKey, kakaoKey) {
  return {
    juso: async (kw) => {
      let res;
      try {
        res = await fetch(`/api/juso?keyword=${encodeURIComponent(kw)}`);
      } catch (e) {
        throw transientErr("네트워크 오류");
      }
      if (!res.ok) throw transientErr(`HTTP ${res.status}`);
      let data;
      try {
        data = await res.json();
      } catch {
        throw transientErr("응답 파싱 실패");
      }
      if (data?.error) throw transientErr(String(data.error));
      const ec = data?.common?.errorCode;
      if (ec && ec !== "0") throw transientErr(`JUSO ${ec} ${data?.common?.errorMessage || ""}`.trim());
      return data?.juso ?? [];   // errorCode 0 + 빈 배열 = 진짜 0건(영구 실패로 분류됨)
    },
    kakaoKeyword: async (kw) => {
      let res;
      try {
        res = await fetch(`/api/kakao?type=keyword&query=${encodeURIComponent(kw)}`);
      } catch {
        throw transientErr("네트워크 오류(kakao)");
      }
      if (!res.ok) throw transientErr(`HTTP ${res.status} (kakao)`);
      const data = await res.json().catch(() => null);
      if (data == null) throw transientErr("응답 파싱 실패(kakao)");
      return data?.documents ?? [];
    },
    kakaoCoord2Region: async (x, y) => {
      try {
        const res = await fetch(`/api/kakao?type=coord2region&x=${x}&y=${y}`);
        const data = await res.json();
        return data?.documents ?? [];
      } catch {
        return [];
      }
    }
  };
}
const C = {
  bg: "#0B0E14",
  ink: "#E7EAF2",
  dim: "#8B93A7",
  faint: "#5A6172",
  card: "rgba(15,19,28,0.55)",
  cardLine: "rgba(255,255,255,0.09)",
  cyan: "#22D3EE",
  indigo: "#6366F1",
  ok: "#34D399",
  warn: "#FBBF24",
  err: "#F87171"
};
const sans = "'Pretendard Variable',Pretendard,-apple-system,'Malgun Gothic',sans-serif";
const mono = "'JetBrains Mono','SF Mono',Consolas,monospace";
const IDB_NAME = "addr-refine";
const IDB_STORE = "batch";
function idbOpen() {
  return new Promise((resolve2, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE))
        db.createObjectStore(IDB_STORE, { keyPath: "key" });
    };
    req.onsuccess = () => resolve2(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function idbSet(key, value) {
  try {
    const db = await idbOpen();
    return await new Promise((resolve2, reject) => {
      const tx = db.transaction(IDB_STORE, "readwrite");
      tx.objectStore(IDB_STORE).put({ key, value, ts: Date.now() });
      tx.oncomplete = () => resolve2(true);
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    return false;
  }
}
async function idbGet(key) {
  try {
    const db = await idbOpen();
    return await new Promise((resolve2) => {
      const tx = db.transaction(IDB_STORE, "readonly");
      const r = tx.objectStore(IDB_STORE).get(key);
      r.onsuccess = () => resolve2(r.result?.value ?? null);
      r.onerror = () => resolve2(null);
    });
  } catch {
    return null;
  }
}
async function idbDel(key) {
  try {
    const db = await idbOpen();
    return await new Promise((resolve2) => {
      const tx = db.transaction(IDB_STORE, "readwrite");
      tx.objectStore(IDB_STORE).delete(key);
      tx.oncomplete = () => resolve2(true);
      tx.onerror = () => resolve2(false);
    });
  } catch {
    return false;
  }
}
const BATCH_KEY = "rows-progress";
// 결과 목록은 '미리보기'만 렌더링한다(2026-07-13). 이전엔 전 행을 DOM으로
// 그려서 3만 행이면 노드 십수만 개 + 100행마다 전체 재렌더 → 브라우저 멈춤/강제종료.
// 전체 결과는 엑셀 다운로드로 확인한다.
const PREVIEW_ROWS = 50;
const REG_LABEL = {
  RESOLVED: "\uC870\uD68C\uC644\uB8CC",
  REG_MULTI: "\uBCF5\uC218\uACB0\uACFC",
  REG_NOT_FOUND: "\uAC80\uC0C9\uACB0\uACFC\uC5C6\uC74C",
  REG_UNIT_NOT_FOUND: "\uC138\uB300\uBBF8\uC77C\uCE58",
  REG_SESSION_ERROR: "\uC138\uC158\uC624\uB958",
  REG_RATE_LIMIT: "\uC694\uCCAD\uC81C\uD55C",
  REG_PARSE_ERROR: "\uD30C\uC2F1\uC624\uB958",
  REG_HTTP_ERROR: "HTTP\uC624\uB958",
  REG_TIMEOUT: "\uC2DC\uAC04\uCD08\uACFC",
  REG_ERROR: "\uC870\uD68C\uC624\uB958"
};
function CadastralBackdrop() {
  const digitCols = [
    { left: "3%", d: "1168010100", dur: 52 },
    { left: "94%", d: "1147010300", dur: 57 }
  ];
  const nodes = [
    { x: 545, y: 165, code: "1100000000" },
    // 수도권
    { x: 455, y: 205 },
    // 서해안
    { x: 715, y: 130 },
    // 영동
    { x: 590, y: 345, code: "4311100000" },
    // 충청
    { x: 760, y: 505, code: "2700000000" },
    // 영남내륙
    { x: 470, y: 615, code: "2900000000" },
    // 호남
    { x: 885, y: 640, code: "2600000000" }
    // 동남권
  ];
  const routes = [
    { id: "r1", d: "M545,165 Q740,320 885,640", dur: 8.5, delay: 0 },
    { id: "r2", d: "M545,165 Q430,400 470,615", dur: 10, delay: 2.4 },
    { id: "r3", d: "M455,205 Q640,330 760,505", dur: 9, delay: 4.8 },
    { id: "r4", d: "M715,130 Q560,240 590,345", dur: 7, delay: 1.2 },
    { id: "r5", d: "M590,345 Q700,480 885,640", dur: 8, delay: 6 },
    { id: "r6", d: "M470,615 Q690,600 885,640", dur: 9.5, delay: 3.6 }
  ];
  const meteors = [
    { id: "m1", d: "M-60,80 L1280,560", dur: 14, delay: 1 },
    { id: "m2", d: "M1260,40 L-80,720", dur: 18, delay: 8 }
  ];
  const comet = (routeId, dur, delay, color) => /* @__PURE__ */ React.createElement("g", { key: routeId + "c" }, [0, 0.16, 0.32, 0.48].map((lag, i) => /* @__PURE__ */ React.createElement(
    "circle",
    {
      key: i,
      r: i === 0 ? 3 : 2.2 - i * 0.5,
      fill: color,
      opacity: i === 0 ? 0.95 : 0.4 - i * 0.11,
      style: i === 0 ? { filter: "drop-shadow(0 0 6px " + color + ")" } : void 0
    },
    /* @__PURE__ */ React.createElement("animateMotion", { dur: dur + "s", begin: delay + lag + "s", repeatCount: "indefinite" }, /* @__PURE__ */ React.createElement("mpath", { href: "#" + routeId }))
  )));
  return /* @__PURE__ */ React.createElement("div", { "aria-hidden": "true", style: { position: "fixed", inset: 0, overflow: "hidden", pointerEvents: "none" } }, /* @__PURE__ */ React.createElement("div", { style: { position: "absolute", inset: 0, background: `radial-gradient(1000px 700px at 12% -8%, ${C.indigo}59, transparent 62%),
         radial-gradient(900px 650px at 96% 12%, ${C.cyan}4d, transparent 58%),
         radial-gradient(850px 800px at 50% 118%, #7C3AED40, transparent 62%),
         linear-gradient(168deg, #101528 0%, #0B0E14 45%, #0D1320 100%)` } }), /* @__PURE__ */ React.createElement("div", { className: "aurora", style: {
    position: "absolute",
    inset: "-20%",
    opacity: 0.5,
    background: `conic-gradient(from 210deg at 50% 45%, transparent 0deg, ${C.indigo}2e 70deg, ${C.cyan}30 130deg, transparent 200deg, #7C3AED26 300deg, transparent 360deg)`,
    filter: "blur(70px)"
  } }), /* @__PURE__ */ React.createElement("div", { style: { position: "absolute", inset: 0, opacity: 1, background: `repeating-linear-gradient(0deg, transparent 0 47px, rgba(148,183,255,0.06) 47px 48px),
         repeating-linear-gradient(90deg, transparent 0 47px, rgba(148,183,255,0.06) 47px 48px)` } }), /* @__PURE__ */ React.createElement(
    "svg",
    {
      width: "100%",
      height: "100%",
      viewBox: "0 0 1200 900",
      preserveAspectRatio: "xMidYMid slice",
      style: { position: "absolute", inset: 0 }
    },
    /* @__PURE__ */ React.createElement("defs", null, /* @__PURE__ */ React.createElement("linearGradient", { id: "arc", x1: "0", y1: "0", x2: "1", y2: "1" }, /* @__PURE__ */ React.createElement("stop", { offset: "0%", stopColor: C.cyan, stopOpacity: "0.5" }), /* @__PURE__ */ React.createElement("stop", { offset: "100%", stopColor: C.indigo, stopOpacity: "0.15" }))),
    /* @__PURE__ */ React.createElement("g", { fill: "none", stroke: "url(#arc)", strokeWidth: "1.1" }, routes.map((r) => /* @__PURE__ */ React.createElement("path", { key: r.id, id: r.id, d: r.d }))),
    /* @__PURE__ */ React.createElement("g", { fill: "none", stroke: "none" }, meteors.map((m) => /* @__PURE__ */ React.createElement("path", { key: m.id, id: m.id, d: m.d }))),
    /* @__PURE__ */ React.createElement("g", null, nodes.map((n, i) => /* @__PURE__ */ React.createElement("g", { key: i }, /* @__PURE__ */ React.createElement(
      "circle",
      {
        cx: n.x,
        cy: n.y,
        r: "3",
        fill: C.cyan,
        opacity: "0.9",
        style: { filter: "drop-shadow(0 0 5px rgba(34,211,238,0.8))" }
      }
    ), /* @__PURE__ */ React.createElement("circle", { cx: n.x, cy: n.y, r: "3", fill: "none", stroke: C.cyan, strokeWidth: "1", opacity: "0.5" }, /* @__PURE__ */ React.createElement("animate", { attributeName: "r", values: "3;14", dur: "3.2s", begin: i * 0.45 + "s", repeatCount: "indefinite" }), /* @__PURE__ */ React.createElement("animate", { attributeName: "opacity", values: "0.5;0", dur: "3.2s", begin: i * 0.45 + "s", repeatCount: "indefinite" })), n.code && /* @__PURE__ */ React.createElement(
      "text",
      {
        x: n.x + 10,
        y: n.y - 8,
        fontFamily: "JetBrains Mono, monospace",
        fontSize: "9.5",
        fill: C.cyan,
        fillOpacity: "0.45",
        letterSpacing: "1"
      },
      n.code
    )))),
    /* @__PURE__ */ React.createElement("g", { className: "comet-layer" }, routes.map((r, i) => comet(r.id, r.dur, r.delay, i % 2 === 0 ? C.cyan : "#A5B4FC")), meteors.map((m) => comet(m.id, m.dur, m.delay, "#E0F2FE")))
  ), digitCols.map((c, i) => /* @__PURE__ */ React.createElement("div", { key: i, className: "pnu-drift", style: {
    position: "absolute",
    left: c.left,
    bottom: "-40%",
    fontFamily: mono,
    fontSize: 12,
    lineHeight: 2.6,
    color: C.cyan,
    textShadow: "0 0 8px rgba(34,211,238,0.5)",
    opacity: 0.12,
    letterSpacing: "0.35em",
    writingMode: "vertical-rl",
    animationDuration: `${c.dur}s`,
    animationDelay: `${-i * 9}s`
  } }, (c.d + "\xB7" + c.d.split("").reverse().join("") + "\xB7" + c.d).slice(0, 44))), /* @__PURE__ */ React.createElement("div", { style: { position: "absolute", inset: 0, background: `radial-gradient(1200px 800px at 50% 40%, transparent 62%, ${C.bg}99 100%)` } }), /* @__PURE__ */ React.createElement("div", { style: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: "50%",
    transform: "translateX(-50%)",
    width: "min(100%, 960px)",
    background: `linear-gradient(90deg, transparent 0%, rgba(11,14,20,0.45) 14%, rgba(11,14,20,0.45) 86%, transparent 100%)`
  } }));
}
function PnuHero({ pnu }) {
  if (!pnu) return /* @__PURE__ */ React.createElement("span", { style: { color: C.faint, fontFamily: mono } }, "\u2014");
  const seg = [
    { v: pnu.slice(0, 10), label: "\uBC95\uC815\uB3D9", color: C.cyan },
    { v: pnu.slice(10, 11), label: "\uD544\uC9C0", color: C.indigo },
    { v: pnu.slice(11, 15), label: "\uBCF8\uBC88", color: "#A78BFA" },
    { v: pnu.slice(15, 19), label: "\uBD80\uBC88", color: "#67E8F9" }
  ];
  return /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 14, flexWrap: "wrap", alignItems: "flex-end", padding: "6px 0 2px" } }, seg.map((s, i) => /* @__PURE__ */ React.createElement("div", { key: i, style: { display: "flex", flexDirection: "column", gap: 3 } }, /* @__PURE__ */ React.createElement("span", { style: {
    fontFamily: mono,
    fontSize: "clamp(19px, 3.4vw, 26px)",
    fontWeight: 700,
    color: s.color,
    letterSpacing: "0.12em",
    textShadow: `0 0 18px ${s.color}55`
  } }, s.v), /* @__PURE__ */ React.createElement("span", { style: { fontSize: 9.5, color: C.faint, letterSpacing: "0.2em", fontWeight: 600 } }, s.label, " ", s.v.length))));
}
function StatusDot({ status, big }) {
  const map = {
    CONFIRMED: ["\uD655\uC815", C.ok],
    AMBIGUOUS: ["\uD655\uC778 \uD544\uC694", C.warn],
    VALIDATION_FAILED: ["\uAC80\uC99D \uBD88\uC77C\uCE58", C.warn],
    FAILED: ["\uC2E4\uD328", C.err]
  };
  const [t, color] = map[status] || map.FAILED;
  return /* @__PURE__ */ React.createElement("span", { style: {
    display: "inline-flex",
    alignItems: "center",
    gap: 7,
    fontSize: big ? 13 : 11.5,
    fontWeight: 700,
    color,
    letterSpacing: "0.04em",
    whiteSpace: "nowrap"
  } }, /* @__PURE__ */ React.createElement("span", { style: {
    width: big ? 8 : 6,
    height: big ? 8 : 6,
    borderRadius: "50%",
    background: color,
    boxShadow: `0 0 10px ${color}`
  } }), t);
}
function Row({ k, v, monoV, children }) {
  return /* @__PURE__ */ React.createElement("div", { style: {
    display: "grid",
    gridTemplateColumns: "84px 1fr",
    gap: 10,
    alignItems: "center",
    padding: "8px 0",
    borderBottom: `1px solid rgba(255,255,255,0.05)`
  } }, /* @__PURE__ */ React.createElement("span", { style: { fontSize: 11, color: C.faint, fontWeight: 700, letterSpacing: "0.12em" } }, k), /* @__PURE__ */ React.createElement("span", { style: { fontSize: 13.5, fontFamily: monoV ? mono : sans, wordBreak: "break-all", color: C.ink } }, children ?? v));
}
function EnvSettings({ open, onClose, config, onSave }) {
  const [jusoKey, setJusoKey] = useState(config.jusoKey || "");
  const [kakaoKey, setKakaoKey] = useState(config.kakaoKey || "");
  const [bridgeUrl, setBridgeUrl] = useState(config.bridgeUrl || "");
  const [resolverKey, setResolverKey] = useState(config.resolverKey || "");
  const [saveState, setSaveState] = useState("");
  useEffect(() => {
    if (open) {
      setJusoKey(config.jusoKey || "");
      setKakaoKey(config.kakaoKey || "");
      setBridgeUrl(config.bridgeUrl || "");
      setResolverKey(config.resolverKey || "");
      setSaveState("");
    }
  }, [open, config]);
  if (!open) return null;
  const save = async () => {
    setSaveState("saving");
    const ok = await onSave({
      jusoKey: jusoKey.trim(),
      kakaoKey: kakaoKey.trim(),
      bridgeUrl: bridgeUrl.trim().replace(/\/$/, ""),
      resolverKey: resolverKey.trim()
    });
    setSaveState(ok ? "saved" : "error");
  };
  const envRow = (label, value, setter, ph) => /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 0, fontFamily: mono, fontSize: 12.5, marginBottom: 10 } }, /* @__PURE__ */ React.createElement("span", { style: { color: "#7DD3FC", whiteSpace: "nowrap" } }, label), /* @__PURE__ */ React.createElement("span", { style: { color: C.faint, padding: "0 8px" } }, "="), /* @__PURE__ */ React.createElement(
    "input",
    {
      value,
      onChange: (e) => setter(e.target.value),
      placeholder: ph,
      spellCheck: false,
      style: {
        flex: 1,
        padding: "8px 11px",
        fontSize: 12.5,
        fontFamily: mono,
        border: "1px solid rgba(255,255,255,0.16)",
        borderRadius: 7,
        background: "rgba(11,14,20,0.6)",
        color: "#A7F3D0",
        outline: "none"
      }
    }
  ));
  return /* @__PURE__ */ React.createElement("div", { onClick: onClose, style: {
    position: "fixed",
    inset: 0,
    zIndex: 50,
    background: "rgba(5,7,12,0.6)",
    backdropFilter: "blur(4px)",
    WebkitBackdropFilter: "blur(4px)",
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "center",
    padding: "80px 20px 20px"
  } }, /* @__PURE__ */ React.createElement("div", { onClick: (e) => e.stopPropagation(), style: {
    width: "min(100%, 480px)",
    background: "rgba(15,19,28,0.92)",
    border: `1px solid ${C.cardLine}`,
    borderRadius: 14,
    padding: "18px 20px 16px",
    boxShadow: "0 20px 60px rgba(0,0,0,0.5)"
  } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 } }, /* @__PURE__ */ React.createElement("span", { style: { fontFamily: mono, fontSize: 12, color: C.dim, letterSpacing: "0.1em" } }, /* @__PURE__ */ React.createElement("span", { style: { color: C.cyan } }, "#"), " addr-refine ", /* @__PURE__ */ React.createElement("span", { style: { color: "#7DD3FC" } }, ".env")), /* @__PURE__ */ React.createElement(
    "button",
    {
      onClick: onClose,
      "aria-label": "\uB2EB\uAE30",
      style: { background: "none", border: "none", color: C.dim, fontSize: 17, cursor: "pointer", padding: 4 }
    },
    "\u2715"
  )), envRow("JUSO_CONFM_KEY", jusoKey, setJusoKey, "\uB3C4\uB85C\uBA85\uC8FC\uC18C API \uC2B9\uC778\uD0A4"), envRow("KAKAO_REST_KEY", kakaoKey, setKakaoKey, "\uCE74\uCE74\uC624 REST API \uD0A4"), /* @__PURE__ */ React.createElement("div", { style: { margin: "12px 0 8px", fontFamily: mono, fontSize: 10.5, color: C.faint, letterSpacing: "0.1em" } }, /* @__PURE__ */ React.createElement("span", { style: { color: C.cyan } }, "#"), " \uB4F1\uAE30\uACE0\uC720\uBC88\uD638 \uBE0C\uB9AC\uC9C0 (EC2/\uB85C\uCEEC)"), envRow("BRIDGE_URL", bridgeUrl, setBridgeUrl, "https://xxx.trycloudflare.com \uB610\uB294 http://localhost:8899"), envRow("RESOLVER_KEY", resolverKey, setResolverKey, "EC2 \uBC30\uD3EC \uC2DC \uBC1C\uAE09\uB41C \uD0A4 (\uB85C\uCEEC\uC740 \uBE44\uC6C0)"), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 10, marginTop: 14 } }, /* @__PURE__ */ React.createElement(
    "button",
    {
      onClick: save,
      style: {
        padding: "9px 22px",
        fontSize: 13,
        fontWeight: 700,
        fontFamily: sans,
        border: "none",
        borderRadius: 9,
        cursor: "pointer",
        color: "#0B0E14",
        background: `linear-gradient(135deg, ${C.cyan}, ${C.indigo})`
      }
    },
    "\uC800\uC7A5"
  ), /* @__PURE__ */ React.createElement("span", { style: {
    fontSize: 11.5,
    fontFamily: mono,
    color: saveState === "saved" ? C.ok : saveState === "error" ? C.err : C.faint
  } }, saveState === "saving" && "\uC800\uC7A5\uC911...", saveState === "saved" && "\u2713 \uC800\uC7A5\uB428 \u2014 \uC0C8 \uC138\uC158\uC5D0\uC11C\uB3C4 \uC720\uC9C0\uB429\uB2C8\uB2E4", saveState === "error" && "\uC800\uC7A5 \uC2E4\uD328 \u2014 \uB2E4\uC2DC \uC2DC\uB3C4\uD574\uC8FC\uC138\uC694")), /* @__PURE__ */ React.createElement("p", { style: { fontSize: 10.5, color: C.faint, margin: "12px 0 0", lineHeight: 1.6 } }, "\uD0A4\uB294 \uC774 \uC544\uD2F0\uD329\uD2B8\uC758 \uAC1C\uC778 \uC800\uC7A5\uC18C\uC5D0\uB9CC \uBCF4\uAD00\uB418\uBA70 \uB2E4\uB978 \uC0AC\uC6A9\uC790\uC5D0\uAC8C \uACF5\uC720\uB418\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.")));
}
function CodeLine({ label, digits, source, value, color, muted }) {
  return /* @__PURE__ */ React.createElement("div", { style: {
    display: "flex",
    alignItems: "center",
    gap: 9,
    padding: "6px 0",
    borderBottom: `1px solid rgba(255,255,255,0.05)`,
    flexWrap: "wrap"
  } }, /* @__PURE__ */ React.createElement("span", { style: { fontSize: 11.5, color: C.dim, fontWeight: 700, minWidth: 82 } }, label), /* @__PURE__ */ React.createElement("span", { style: {
    fontFamily: mono,
    fontSize: 9.5,
    color: C.faint,
    border: `1px solid rgba(255,255,255,0.16)`,
    borderRadius: 4,
    padding: "1px 5px"
  } }, digits, "\uC790\uB9AC"), /* @__PURE__ */ React.createElement("span", { style: {
    fontFamily: mono,
    fontSize: 13.5,
    fontWeight: 700,
    color: muted ? C.faint : color,
    letterSpacing: "0.06em",
    wordBreak: "break-all",
    textShadow: muted ? "none" : `0 0 12px ${color}44`
  } }, muted ? "\uBBF8\uC81C\uACF5" : value), /* @__PURE__ */ React.createElement("span", { style: {
    fontSize: 9.5,
    color: C.faint,
    marginLeft: "auto",
    fontFamily: mono,
    letterSpacing: "0.04em"
  } }, source));
}
function UnitPicker({ data, onPick, onClose }) {
  const units = data?.units || [];
  const hasDong = units.some((u) => u.dong);
  const dongs = hasDong ? [...new Set(units.map((u) => u.dong).filter(Boolean))] : [];
  const [sel, setSel] = useState(dongs.length === 1 ? dongs[0] : null);
  const hoList = hasDong ? units.filter((u) => u.dong === sel) : units;
  const btn = (active) => ({
    padding: "9px 4px",
    borderRadius: 8,
    cursor: "pointer",
    background: active ? `${C.cyan}22` : "#0F1420",
    border: `1px solid ${active ? C.cyan : "#1E2636"}`,
    color: active ? C.cyan : C.ink,
    fontSize: 13,
    fontFamily: mono,
    fontWeight: active ? 700 : 500,
    transition: "all .12s"
  });
  return /* @__PURE__ */ React.createElement("div", { style: {
    marginTop: 12,
    padding: 16,
    borderRadius: 12,
    background: "#0C111B",
    border: `1px solid ${C.cyan}33`
  } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 } }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("p", { style: { fontSize: 14, fontWeight: 700, color: C.ink, margin: 0 } }, "\u{1F3E2} ", data.name || "\uC138\uB300 \uC120\uD0DD"), /* @__PURE__ */ React.createElement("p", { style: { fontSize: 11.5, color: C.dim, margin: "4px 0 0" } }, "\uC5EC\uB7EC \uC138\uB300\uAC00 \uC788\uC5B4\uC694. \uD574\uB2F9 \uB3D9\xB7\uD638\uB97C \uACE8\uB77C\uC8FC\uC138\uC694.")), onClose && /* @__PURE__ */ React.createElement("button", { onClick: onClose, style: {
    background: "none",
    border: "none",
    color: C.faint,
    cursor: "pointer",
    fontSize: 16
  } }, "\u2715")), hasDong && /* @__PURE__ */ React.createElement("div", { style: { marginBottom: 12 } }, /* @__PURE__ */ React.createElement("p", { style: { fontSize: 11, color: C.dim, margin: "0 0 6px" } }, "\uB3D9 \uC120\uD0DD"), /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(64px, 1fr))", gap: 6 } }, dongs.map((d) => /* @__PURE__ */ React.createElement("button", { key: d, style: btn(sel === d), onClick: () => setSel(d) }, d, "\uB3D9")))), (!hasDong || sel) && /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("p", { style: { fontSize: 11, color: C.dim, margin: "0 0 6px" } }, "\uD638 \uC120\uD0DD", hasDong ? ` (${sel}\uB3D9)` : "", " \xB7 ", hoList.length, "\uC138\uB300"), /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(64px, 1fr))", gap: 6, maxHeight: 240, overflowY: "auto" } }, hoList.map((u, i) => /* @__PURE__ */ React.createElement("button", { key: i, style: btn(false), onClick: () => onPick(u) }, u.ho, "\uD638")))));
}
function ResultCard({ r, onRegionPick, bridgeUp, reg, regBusy, onLookup }) {
  if (!r) return null;
  return /* @__PURE__ */ React.createElement("div", { className: "result-in", style: {
    background: C.card,
    border: `1px solid ${C.cardLine}`,
    borderRadius: 14,
    padding: "18px 22px",
    marginTop: 18,
    backdropFilter: "blur(8px)",
    WebkitBackdropFilter: "blur(8px)"
  } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 } }, /* @__PURE__ */ React.createElement(StatusDot, { status: r.status, big: true }), r.searchLevel && /* @__PURE__ */ React.createElement("span", { style: { fontFamily: mono, fontSize: 10.5, color: C.faint, letterSpacing: "0.08em" } }, r.searchLevel, r.source ? ` \xB7 ${r.source.toUpperCase()}` : "")), r.status === "CONFIRMED" && /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement(PnuHero, { pnu: r.pnu }), /* @__PURE__ */ React.createElement("div", { style: { marginTop: 10 } }, /* @__PURE__ */ React.createElement(Row, { k: "\uC9C0\uBC88", v: r.jibunAddr }), /* @__PURE__ */ React.createElement(Row, { k: "\uB3C4\uB85C\uBA85", v: r.roadAddr || "\u2014" }), r.bdNm ? /* @__PURE__ */ React.createElement(Row, { k: "\uAC74\uBB3C", v: r.bdNm }) : null, r.unit?.dong || r.unit?.ho ? /* @__PURE__ */ React.createElement(Row, { k: "\uB3D9 \xB7 \uD638", v: `${r.unit.dong ? r.unit.dong + "\uB3D9 " : ""}${r.unit.ho ? r.unit.ho + "\uD638" : ""}` }) : null), /* @__PURE__ */ React.createElement("div", { style: {
    marginTop: 14,
    marginBottom: 4,
    fontSize: 10,
    color: C.faint,
    letterSpacing: "0.16em",
    fontWeight: 700
  } }, "\uC0B0\uCD9C \uCF54\uB4DC"), /* @__PURE__ */ React.createElement(CodeLine, { label: "PNU", digits: 19, source: "juso/kakao", value: r.pnu, color: C.cyan }), /* @__PURE__ */ React.createElement(
    CodeLine,
    {
      label: "\uAC74\uBB3C\uAD00\uB9AC\uBC88\uD638",
      digits: 25,
      source: "juso",
      value: r.bdMgtSn,
      color: "#A78BFA",
      muted: !r.bdMgtSn
    }
  ), /* @__PURE__ */ React.createElement("div", { style: { marginTop: 14, paddingTop: 14, borderTop: `1px dashed rgba(255,255,255,0.14)` } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" } }, /* @__PURE__ */ React.createElement("span", { style: { fontSize: 13, fontWeight: 700, color: C.ink } }, "\uB4F1\uAE30\uACE0\uC720\uBC88\uD638"), /* @__PURE__ */ React.createElement("span", { style: {
    fontFamily: mono,
    fontSize: 9.5,
    color: C.faint,
    border: `1px solid rgba(255,255,255,0.16)`,
    borderRadius: 4,
    padding: "1px 5px"
  } }, "14\uC790\uB9AC"), reg?.status === "RESOLVED" ? /* @__PURE__ */ React.createElement("span", { style: {
    fontSize: 10.5,
    fontWeight: 700,
    color: C.ok,
    background: `${C.ok}1f`,
    borderRadius: 4,
    padding: "2px 7px"
  } }, "\uC870\uD68C \uC644\uB8CC") : /* @__PURE__ */ React.createElement("span", { style: {
    fontSize: 10.5,
    fontWeight: 700,
    color: C.warn,
    background: `${C.warn}1f`,
    borderRadius: 4,
    padding: "2px 7px"
  } }, "\uBBF8\uC0B0\uCD9C \xB7 \uB4F1\uAE30\uC18C \uC870\uD68C")), reg?.status === "RESOLVED" && /* @__PURE__ */ React.createElement("div", { style: {
    fontFamily: mono,
    fontSize: 17,
    fontWeight: 700,
    color: C.ok,
    letterSpacing: "0.1em",
    textShadow: `0 0 14px ${C.ok}55`,
    marginBottom: 6
  } }, reg.unique_no), reg?.status === "REG_MULTI" && /* @__PURE__ */ React.createElement("div", { style: { marginBottom: 6 } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 11.5, color: C.warn, marginBottom: 4 } }, reg.candidates.length, "\uAC74 \u2014 \uC18C\uC7AC\uC9C0\uB85C \uAD6C\uBD84"), reg.candidates.map((c, i) => /* @__PURE__ */ React.createElement("div", { key: i, style: { fontFamily: mono, fontSize: 12.5, color: C.ink } }, /* @__PURE__ */ React.createElement("span", { style: { color: C.ok, fontWeight: 700 } }, c.unique_no), /* @__PURE__ */ React.createElement("span", { style: { color: C.dim, marginLeft: 8 } }, c.sojae)))), reg?.status === "NEED_UNIT" && /* @__PURE__ */ React.createElement("div", { style: {
    fontSize: 12.5,
    color: C.warn,
    marginBottom: 6,
    padding: "8px 12px",
    background: `${C.warn}15`,
    border: `1px solid ${C.warn}44`,
    borderRadius: 8
  } }, "\u26A0\uFE0F ", reg.message), reg && !["RESOLVED", "REG_MULTI", "NEED_UNIT"].includes(reg.status) && /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, color: C.err, marginBottom: 6 } }, REG_LABEL[reg.status] || reg.status, " \u2014 ", reg.message), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" } }, bridgeUp ? /* @__PURE__ */ React.createElement(
    "button",
    {
      onClick: onLookup,
      disabled: regBusy,
      style: {
        padding: "8px 18px",
        fontSize: 12.5,
        fontWeight: 700,
        fontFamily: sans,
        border: "none",
        borderRadius: 8,
        cursor: "pointer",
        color: "#0B0E14",
        background: `linear-gradient(135deg, ${C.cyan}, ${C.indigo})`,
        opacity: regBusy ? 0.6 : 1
      }
    },
    regBusy ? "IROS \uC870\uD68C\uC911\u2026" : reg ? "\uB2E4\uC2DC \uC870\uD68C" : "\uB4F1\uAE30\uACE0\uC720\uBC88\uD638 \uC870\uD68C"
  ) : /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("span", { style: { fontSize: 11, color: C.faint } }, "\uAC80\uC0C9\uC5B4"), /* @__PURE__ */ React.createElement("span", { style: {
    fontFamily: mono,
    fontSize: 12,
    color: C.dim,
    background: "rgba(11,14,20,0.5)",
    padding: "4px 9px",
    borderRadius: 6
  } }, r.irosQuery), /* @__PURE__ */ React.createElement(
    "a",
    {
      href: "https://www.iros.go.kr",
      target: "_blank",
      rel: "noreferrer",
      style: { color: C.cyan, fontSize: 12, fontWeight: 700, textDecoration: "none" }
    },
    "\uC778\uD130\uB137\uB4F1\uAE30\uC18C \u2192"
  ))), /* @__PURE__ */ React.createElement("p", { style: { fontSize: 10, color: C.faint, margin: "8px 0 0", lineHeight: 1.55 } }, bridgeUp ? "\uB85C\uCEEC \uBE0C\uB9AC\uC9C0 \uC5F0\uACB0\uB428 \xB7 \uC870\uD68C \uC2DC IROS \uCC3D\uC774 \uC5F4\uB9BD\uB2C8\uB2E4(\uACB0\uC81C \uC5C6\uC74C, \uBC88\uD638 \uC870\uD68C\uAE4C\uC9C0)." : "\uB85C\uCEEC \uBE0C\uB9AC\uC9C0 \uBBF8\uC2E4\uD589 \xB7 \uC790\uB3D9 \uC870\uD68C\uD558\uB824\uBA74 iros_bridge.py\uB97C \uC2E4\uD589\uD558\uC138\uC694. \uC9C0\uAE08\uC740 \uB525\uB9C1\uD06C\uB85C \uC9C1\uC811 \uC870\uD68C\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4."))), r.status === "AMBIGUOUS" && /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("p", { style: { fontSize: 14, margin: "2px 0 12px", lineHeight: 1.7, color: C.ink } }, r.message), /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gap: 7 } }, r.candidates.map((c, i) => /* @__PURE__ */ React.createElement(
    "button",
    {
      key: i,
      onClick: () => onRegionPick && onRegionPick(c),
      className: "cand",
      style: {
        textAlign: "left",
        background: "rgba(11,14,20,0.25)",
        border: `1px solid rgba(255,255,255,0.16)`,
        borderRadius: 10,
        padding: "12px 15px",
        cursor: "pointer",
        fontFamily: sans,
        fontSize: 13.5,
        display: "flex",
        gap: 12,
        alignItems: "baseline",
        color: C.ink
      }
    },
    /* @__PURE__ */ React.createElement("strong", { style: { color: C.cyan, minWidth: 108, fontWeight: 700 } }, c.sidoSigungu),
    /* @__PURE__ */ React.createElement("span", { style: { color: C.dim } }, c.jibunAddr)
  ))), /* @__PURE__ */ React.createElement("p", { style: { fontSize: 11, color: C.faint, marginTop: 9 } }, "\uD6C4\uBCF4 \uC120\uD0DD \uC2DC \uD574\uB2F9 \uC9C0\uC5ED\uC73C\uB85C \uC881\uD600 \uC7AC\uAC80\uC0C9\uD569\uB2C8\uB2E4.")), (r.status === "FAILED" || r.status === "VALIDATION_FAILED") && /* @__PURE__ */ React.createElement("p", { style: { fontSize: 14, margin: 0, lineHeight: 1.7, color: r.status === "VALIDATION_FAILED" ? C.warn : C.dim } }, r.message));
}
function AddrRefineTestGui() {
  const [tab, setTab] = useState("single");
  const [mode, setMode] = useState("real");
  const [config, setConfig] = useState({ jusoKey: "", kakaoKey: "", bridgeUrl: "", resolverKey: "" });
  const [settingsOpen, setSettingsOpen] = useState(false);
  useEffect(() => {
    (async () => {
      try {
        const r = await window.storage.get("addr-refine:env");
        if (r?.value) setConfig(JSON.parse(r.value));
      } catch {
      }
    })();
    (async () => {
      const saved = await idbGet(BATCH_KEY);
      // v2 포맷({rows, extraHeaders}) 우선, 구버전(배열)도 하위호환으로 읽음
      const savedRows = Array.isArray(saved) ? saved : saved?.rows;
      if (savedRows && Array.isArray(savedRows) && savedRows.length > 0) {
        const refined = savedRows.filter((r) => r.result).length;
        const looked = savedRows.filter((r) => r.reg).length;
        if (refined > 0 || looked > 0) {
          setSavedProgress({ count: savedRows.length, refined, looked });
        }
      }
    })();
  }, []);
  const resumeProgress = useCallback(async () => {
    const saved = await idbGet(BATCH_KEY);
    const savedRows = Array.isArray(saved) ? saved : saved?.rows;
    if (savedRows) {
      setRows(savedRows);
      // extraHeaders(부동산번호 등 원본 컬럼명)도 함께 복원 — 이게 없으면
      // 재개 후 엑셀 출력에서 헤더와 데이터 열이 어긋난다(2026-07-13 버그 수정)
      if (!Array.isArray(saved) && Array.isArray(saved.extraHeaders)) {
        setExtraHeaders(saved.extraHeaders);
      }
      setBatchDone(savedRows.filter((r) => r.result).length);
      setTab("batch");
    }
    setSavedProgress(null);
  }, []);
  const discardProgress = useCallback(async () => {
    // 파괴적 동작 — 며칠치 진행분이 클릭 한 번에 사라질 수 있으므로 확인 필수(PM-11)
    if (!window.confirm("저장된 진행 상황을 완전히 삭제하고 새로 시작할까요?\n(정제·등기조회 결과가 모두 사라지며 되돌릴 수 없습니다)")) return;
    await idbDel(BATCH_KEY);
    setSavedProgress(null);
  }, []);
  const saveConfig = useCallback(async (next) => {
    try {
      const r = await window.storage.set("addr-refine:env", JSON.stringify(next));
      if (r) {
        setConfig(next);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, []);
  const [input, setInput] = useState("");
  const [lastRaw, setLastRaw] = useState("");
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [rows, setRows] = useState([]);
  const [batchBusy, setBatchBusy] = useState(false);
  const [batchDone, setBatchDone] = useState(0);
  const [batchGroupDone, setBatchGroupDone] = useState(0);
  const [batchGroupTotal, setBatchGroupTotal] = useState(0);
  const [autoStopMsg, setAutoStopMsg] = useState("");
  const [fileErr, setFileErr] = useState("");
  const [fileParsing, setFileParsing] = useState(false);
  const [uploadStats, setUploadStats] = useState(null);
  const [extraHeaders, setExtraHeaders] = useState([]);
  const BRIDGE = config.bridgeUrl || "/api";
  const regHeaders = config.resolverKey ? { "X-Resolver-Key": config.resolverKey } : {};
  const [bridgeUp, setBridgeUp] = useState(false);
  const [bridgeHelpOpen, setBridgeHelpOpen] = useState(false);
  const [regBusy, setRegBusy] = useState(false);
  const [regResult, setRegResult] = useState(null);
  const [batchRegBusy, setBatchRegBusy] = useState(false);
  const [batchRegDone, setBatchRegDone] = useState(0);
  const [batchTotal, setBatchTotal] = useState(0);
  const [savedProgress, setSavedProgress] = useState(null);
  const [irosHealth, setIrosHealth] = useState({ bad: 0, total: 0, lastCode: "" });
  const recordRegHealth = useCallback((status) => {
    const SYSTEM_BAD = ["REG_PARSE_ERROR", "REG_HTTP_ERROR", "REG_SESSION_ERROR", "REG_RATE_LIMIT"];
    setIrosHealth((h) => {
      const total = h.total + 1;
      const bad = SYSTEM_BAD.includes(status) ? h.bad + 1 : 0;
      return { bad, total, lastCode: status };
    });
  }, []);
  useEffect(() => {
    let alive = true;
    const ping = async () => {
      try {
        if (BRIDGE === "/api") {
          if (alive) setBridgeUp(true);
          return;
        }
        const r = await fetch(`${BRIDGE}/health`, { signal: AbortSignal.timeout(2500) });
        if (alive) setBridgeUp(r.ok);
      } catch {
        if (alive) setBridgeUp(false);
      }
    };
    ping();
    const t = setInterval(ping, 8e3);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [BRIDGE]);
  const lookupUniqueNo = useCallback(async () => {
    if (!result || result.status !== "CONFIRMED") return;
    if (result.isJip && !(result.unit?.dong || result.unit?.ho)) {
      setRegResult({
        status: "NEED_UNIT",
        message: "\uC9D1\uD569\uAC74\uBB3C\uC785\uB2C8\uB2E4. \uB3D9\xB7\uD638\uB97C \uC785\uB825\uD574\uC57C \uB4F1\uAE30\uB97C \uD2B9\uC815\uD560 \uC218 \uC788\uC5B4\uC694. (\uB3D9\xB7\uD638 \uC5C6\uC774 \uC870\uD68C\uD558\uBA74 \uACB0\uACFC\uAC00 \uB098\uC624\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4)"
      });
      setUnitOpen(true);
      return;
    }
    setRegBusy(true);
    setRegResult(null);
    try {
      const q = encodeURIComponent(result.jibunAddr || result.irosQuery || "");
      const d = result.unit?.dong ? `&dong=${encodeURIComponent(result.unit.dong)}` : "";
      const h = result.unit?.ho ? `&ho=${encodeURIComponent(result.unit.ho)}` : "";
      const b = result.bdNm ? `&bdnm=${encodeURIComponent(result.bdNm)}` : "";
      const r = await fetch(
        `${BRIDGE}/resolve?addr=${q}${d}${h}${b}`,
        { headers: regHeaders, signal: AbortSignal.timeout(6e4) }
      );
      const data = await r.json();
      setRegResult(data);
      recordRegHealth(data.status);
    } catch {
      setRegResult({ status: "ERROR", message: "\uBE0C\uB9AC\uC9C0 \uC751\uB2F5 \uC5C6\uC74C \u2014 \uBE0C\uB9AC\uC9C0 \uC8FC\uC18C/\uC2E4\uD589 \uC0C1\uD0DC\uB97C \uD655\uC778\uD558\uC138\uC694." });
      recordRegHealth("REG_HTTP_ERROR");
    } finally {
      setRegBusy(false);
    }
  }, [result, BRIDGE, config.resolverKey, recordRegHealth]);
  const [batchStop, setBatchStop] = useState(false);
  const batchStopRef = useRef(false);
  const lookupBatchUniqueNo = useCallback(async () => {
    const targets = rows.map((row, idx) => ({ idx, row })).filter(({ row }) => row.result?.status === "CONFIRMED");
    if (targets.length === 0) return;
    setBatchRegBusy(true);
    setBatchRegDone(0);
    setBatchStop(false);
    batchStopRef.current = false;
    const next = [...rows];
    const cache = /* @__PURE__ */ new Map();
    const keyOf = (row) => {
      const p = row.result.pnu || row.result.jibunAddr || "";
      const d = row.result.unit?.dong || "";
      const h = row.result.unit?.ho || "";
      return `${p}|${d}|${h}`;
    };
    const groups = /* @__PURE__ */ new Map();
    for (const t of targets) {
      const k = keyOf(t.row);
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(t);
    }
    const uniqueKeys = [...groups.keys()];
    setBatchTotal(uniqueKeys.length);
    for (let g = 0; g < uniqueKeys.length; g++) {
      if (batchStopRef.current) break;
      const k = uniqueKeys[g];
      const members = groups.get(k);
      const prevReg = members[0].row.reg;
      const retryable = prevReg && ["REG_SESSION_ERROR", "REG_RATE_LIMIT", "REG_TIMEOUT", "REG_HTTP_ERROR", "REG_ERROR", "ERROR"].includes(prevReg.status);
      if (prevReg && !retryable) {
        setBatchRegDone(g + 1);
        continue;
      }
      const { row } = members[0];
      const addr = row.result.jibunAddr || row.result.irosQuery || "";
      const d = row.result.unit?.dong ? `&dong=${encodeURIComponent(row.result.unit.dong)}` : "";
      const h = row.result.unit?.ho ? `&ho=${encodeURIComponent(row.result.unit.ho)}` : "";
      const b = row.result.bdNm ? `&bdnm=${encodeURIComponent(row.result.bdNm)}` : "";
      const now = (/* @__PURE__ */ new Date()).toISOString().slice(0, 19).replace("T", " ");
      let data;
      const regCacheKey = `reg:${k}`;
      const cached = await idbGet(regCacheKey);
      if (cached && cached.status === "RESOLVED") {
        data = cached;
      } else {
        try {
          const r = await fetch(
            `${BRIDGE}/resolve?addr=${encodeURIComponent(addr)}${d}${h}${b}`,
            { headers: regHeaders, signal: AbortSignal.timeout(6e4) }
          );
          data = await r.json();
          data.at = now;
          if (data.status === "RESOLVED") await idbSet(regCacheKey, data);
        } catch {
          data = { status: "REG_ERROR", message: "\uBE0C\uB9AC\uC9C0 \uC751\uB2F5 \uC5C6\uC74C", at: now };
        }
      }
      for (const m of members) {
        next[m.idx] = { ...next[m.idx], reg: data };
      }
      recordRegHealth(data.status);
      setBatchRegDone(g + 1);
      if (g % 50 === 0) {
        setRows([...next]);
        await idbSet(BATCH_KEY, { v: 2, rows: next, extraHeaders });
      }
      if (g < uniqueKeys.length - 1 && !batchStopRef.current) {
        await new Promise((res) => setTimeout(res, 1e3));
      }
    }
    setRows([...next]);
    await idbSet(BATCH_KEY, { v: 2, rows: next, extraHeaders });
    setBatchRegBusy(false);
  }, [rows, BRIDGE, config.resolverKey, extraHeaders]);
  const stopBatch = useCallback(() => {
    batchStopRef.current = true;
    setBatchStop(true);
  }, []);
  const clients = mode === "mock" ? mockClients : makeRealClients(config.jusoKey, config.kakaoKey);
  const [unitDong, setUnitDong] = useState("");
  const [unitHo, setUnitHo] = useState("");
  const [unitOpen, setUnitOpen] = useState(false);
  const [unitList, setUnitList] = useState(null);
  const [unitBusy, setUnitBusy] = useState(false);
  const [unitErr, setUnitErr] = useState("");
  const loadUnitsFor = useCallback(async (pnu, fallbackName) => {
    if (!pnu) return;
    setUnitBusy(true);
    setUnitErr("");
    setUnitList(null);
    try {
      const cacheKey = `units:${pnu}`;
      let data = await idbGet(cacheKey);
      if (!data) {
        const r = await fetch(
          `${BRIDGE}/units?pnu=${encodeURIComponent(pnu)}`,
          { signal: AbortSignal.timeout(15e3) }
        );
        data = await r.json();
        if (data.ok) await idbSet(cacheKey, data);
      }
      if (!data.ok) {
        setUnitErr(data.error || "\uC138\uB300 \uBAA9\uB85D\uC744 \uBD88\uB7EC\uC624\uC9C0 \uBABB\uD588\uC5B4\uC694. \uB3D9\xB7\uD638\uB97C \uC9C1\uC811 \uC785\uB825\uD574\uC8FC\uC138\uC694.");
        return;
      }
      if (data.aptType) setResult((prev) => prev ? { ...prev, aptType: data.aptType } : prev);
      if (data.count === 0) {
        setUnitErr("\uB4F1\uB85D\uB41C \uC138\uB300 \uC815\uBCF4\uAC00 \uC5C6\uC5B4\uC694. \uB3D9\xB7\uD638\uB97C \uC9C1\uC811 \uC785\uB825\uD574\uC8FC\uC138\uC694.");
        return;
      }
      setUnitList({ name: fallbackName || data.name, units: data.units });
    } catch {
      setUnitErr("\uC138\uB300 \uC870\uD68C \uC2E4\uD328 \u2014 \uB3D9\xB7\uD638\uB97C \uC9C1\uC811 \uC785\uB825\uD574\uC8FC\uC138\uC694.");
    } finally {
      setUnitBusy(false);
    }
  }, [BRIDGE]);
  const runSingle = useCallback(async (raw) => {
    if (!raw.trim()) return;
    setBusy(true);
    setUnitList(null);
    setUnitErr("");
    setRegResult(null);
    const r = await refineAddress(raw, clients);
    const isJip = r?.status === "CONFIRMED" && !!r.isJip;
    const dongFinal = r?.unit?.dong || (isJip ? normalizeUnitInput(unitDong) : "") || "";
    const hoFinal = r?.unit?.ho || (isJip ? normalizeUnitInput(unitHo) : "") || "";
    setUnitDong(dongFinal ? String(dongFinal).replace(/[^\d]/g, "") : "");
    setUnitHo(hoFinal ? String(hoFinal).replace(/[^\d]/g, "") : "");
    if (r && r.status === "CONFIRMED") {
      r.unit = { dong: dongFinal || null, ho: hoFinal || null };
      const parts = [r.jibunAddr || ""];
      if (dongFinal) parts.push(`${dongFinal}\uB3D9`);
      if (hoFinal) parts.push(`${hoFinal}\uD638`);
      r.irosQuery = parts.filter(Boolean).join(" ").trim();
    }
    setUnitOpen(isJip);
    setResult(r);
    setLastRaw(raw);
    setBusy(false);
    if (isJip && r.pnu) {
      loadUnitsFor(r.pnu, r.bdNm);
    }
  }, [clients, unitDong, unitHo, loadUnitsFor]);
  const applyUnit = useCallback((dongVal, hoVal) => {
    const d = normalizeUnitInput(dongVal);
    const h = normalizeUnitInput(hoVal);
    setUnitDong(dongVal.replace(/[^\d]/g, ""));
    setUnitHo(hoVal.replace(/[^\d]/g, ""));
    setResult((prev) => {
      if (!prev || prev.status !== "CONFIRMED") return prev;
      const unit = { dong: d, ho: h };
      const parts = [prev.jibunAddr || ""];
      if (d) parts.push(`${d}\uB3D9`);
      if (h) parts.push(`${h}\uD638`);
      return { ...prev, unit, irosQuery: parts.filter(Boolean).join(" ").trim() };
    });
  }, []);
  const findUnits = useCallback(() => {
    if (result?.pnu) loadUnitsFor(result.pnu, result.bdNm);
  }, [result, loadUnitsFor]);
  const onUnitPick = useCallback((u) => {
    applyUnit(u.dong || "", u.ho || "");
    setUnitList(null);
    setUnitOpen(true);
  }, [applyUnit]);
  const onRegionPick = useCallback(async (cand) => {
    if (cand.jibunAddr) {
      const isJip = cand.isJip || !!(cand.bdNm && /아파트|빌라|연립|다세대|오피스텔|맨션|타운|팰리스|캐슬|자이|힐스|푸르지오|래미안|센트|아이파크|더샵|로즈빌|베르디움|엘크루|리슈빌|스위첸/.test(cand.bdNm));
      setResult({
        status: "CONFIRMED",
        jibunAddr: cand.jibunAddr,
        roadAddr: cand.roadAddr || null,
        bdNm: cand.bdNm || null,
        pnu: cand.pnu || null,
        bdMgtSn: cand.bdMgtSn || null,
        unit: {
          dong: unitDong ? normalizeUnitInput(unitDong) : null,
          ho: unitHo ? normalizeUnitInput(unitHo) : null
        },
        irosQuery: cand.jibunAddr,
        source: "juso",
        isJip
      });
      if (isJip) setUnitOpen(true);
      if (isJip && cand.pnu) loadUnitsFor(cand.pnu, cand.bdNm);
      return;
    }
    const region = (cand.sidoSigungu || "").trim();
    const base = lastRaw.replace(region, "").trim();
    await runSingle(`${region} ${base}`.replace(/\s+/g, " ").trim());
  }, [lastRaw, runSingle, unitDong, unitHo, loadUnitsFor]);
  const onFile = useCallback(async (e) => {
    setFileErr("");
    const file = e.target.files?.[0];
    if (!file) return;
    setFileParsing(true);   // 실측 결과 XLSX.read 자체가 병목(3만행 기준 약 1.3초) — 여기서부터 표시
    await new Promise((res) => setTimeout(res, 0));   // "처리 중" 문구가 실제로 화면에 그려질 시간을 줌
    // (안 그러면 곧바로 XLSX.read가 메인스레드를 막아, 상태 갱신이 화면에
    // 반영되기 전에 멈춰버려 "처리 중" 문구가 아예 안 보일 수 있음)
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
      // 주소가 A열이 아닐 수 있으므로, 행에 값이 하나라도 있으면 유효 행으로 봄
      const filled = data.filter((row) => (row ?? []).some((c) => String(c ?? "").trim() !== ""));
      if (filled.length === 0) {
        setFileErr("데이터를 찾지 못했습니다. 파일 내용을 확인해주세요.");
        return;
      }

      // 헤더 행에서 패턴에 맞는 열 인덱스를 찾음(제외 패턴에 걸리면 스킵).
      // 예: "부동산번호(내부관리번호)"는 잡되 "소재지우편번호"는 안 잡아야 하므로
      // 우편번호 열은 별도로 제외 처리한다.
      const findColIdx = (headerRow, patterns, excludePatterns = []) => {
        for (let i = 0; i < headerRow.length; i++) {
          const h = String(headerRow[i] ?? "");
          if (excludePatterns.some((p) => p.test(h))) continue;
          if (patterns.some((p) => p.test(h))) return i;
        }
        return -1;
      };

      const header0 = filled[0].map((h) => String(h ?? ""));
      // "소재지상세주소"처럼 '상세'가 붙은 열은 상세주소로 먼저 찾고,
      // 일반 주소열은 그걸 제외하고 찾는다(안 그러면 상세주소열이
      // 주소열로 잘못 잡힐 수 있음 — '주소'라는 글자가 둘 다에 있으므로).
      const detailColIdx = findColIdx(header0, [/상세\s*주소/]);
      const addrColIdx = findColIdx(
        header0,
        [/주소|address/i],
        detailColIdx >= 0 ? [/상세/] : []
      );

      let extraHeaders2 = [];
      let body = filled;
      let addrIdx = 0;      // 주소로 쓸 열 인덱스(기본값: A열 — 헤더 인식 실패 시 폴백)
      let detailIdx = -1;
      let extraColIdxs = null; // null이면 기존 방식(A열 다음부터 순서대로)

      if (addrColIdx >= 0) {
        // 헤더에서 "주소" 포함 열을 찾음 → 이 행을 헤더로 보고 데이터에서 제외
        addrIdx = addrColIdx;
        detailIdx = detailColIdx;
        extraColIdxs = header0.map((_, i) => i).filter((i) => i !== addrIdx && i !== detailIdx);
        extraHeaders2 = extraColIdxs.map((i) => header0[i].trim() || `열${i + 1}`);
        body = filled.slice(1);
      } else {
        // 주소 열을 못 찾음 → 기존 방식과 동일하게 폴백(A열=주소, 헤더 없음 가정)
        const maxExtra = Math.max(0, ...filled.map((r) => r.length - 1));
        extraHeaders2 = Array.from({ length: maxExtra }, (_, i) => `열${i + 2}`);
      }
      setExtraHeaders(extraHeaders2);

      // 실측(3만행 기준: XLSX.read 1,349ms / sheet_to_json 143ms / 이 루프
      // 63ms) 결과, 이 행 빌드 루프는 전체 소요시간의 4%에 불과해 굳이
      // 청크로 쪼개거나 %를 표시할 이유가 없다(진짜 병목은 위 XLSX.read).
      // 가짜 정밀도를 보여주지 않기 위해 단순 map으로 되돌림 —
      // fileParsing 표시는 onFile 시작부터 끝까지 통째로 켜져 있음.
      const built = body
        .map((r) => {
          const addrVal = String(r[addrIdx] ?? "").trim();
          const detailVal = detailIdx >= 0 ? String(r[detailIdx] ?? "").trim() : "";
          const raw = detailVal ? `${addrVal} ${detailVal}`.replace(/\s+/g, " ").trim() : addrVal;
          const extra = extraColIdxs
            ? extraColIdxs.map((i) => r[i] ?? "")
            : extraHeaders2.map((_, i) => r[i + 1] ?? "");
          return { raw, extra, result: null };
        })
        .filter((row) => row.raw !== "");   // 주소가 실제로 비어있는 행은 제외
      // 사전 분석(API 호출 없음): 정제 시작 전에 호출량·중복 구조를 먼저 파악
      const statMap = /* @__PURE__ */ new Map();
      for (const row of built) {
        const k = normalizeRawKey(row.raw);
        statMap.set(k, (statMap.get(k) || 0) + 1);
      }
      let maxGrp = 0;
      for (const v of statMap.values()) if (v > maxGrp) maxGrp = v;
      const colLetter = (i) => i < 26 ? String.fromCharCode(65 + i) + "열" : `${i + 1}번째 열`;
      setUploadStats({
        total: built.length,
        uniq: statMap.size,
        maxGrp,
        empty: body.length - built.length,
        mapping: addrColIdx >= 0
          ? {
              mode: "header",
              addr: `${header0[addrIdx].trim()}(${colLetter(addrIdx)})`,
              detail: detailIdx >= 0 ? `${header0[detailIdx].trim()}(${colLetter(detailIdx)})` : null
            }
          : { mode: "fallback" },
        sample: (built[0]?.raw || "").slice(0, 40)
      });
      setRows(built);
      setBatchDone(0);
      await idbDel(BATCH_KEY);
      setSavedProgress(null);
    } catch {
      setFileErr("파일을 읽지 못했습니다. xlsx 또는 csv 형식인지 확인해주세요.");
    } finally {
      setFileParsing(false);   // 성공/실패 어느 쪽이든 반드시 꺼지도록 finally로 이동
      e.target.value = "";
    }
  }, []);
  // 정제 결과가 '확정된' 것인지 판정 — 일시 오류(TRANSIENT)는 미확정으로
  // 보아 재정제 시 다시 시도한다. 진짜 0건(영구 실패)은 재호출하지 않음(PM-02).
  const isFinalResult = (res) => res && !(res.status === "FAILED" && res.failKind === "TRANSIENT");
  const runBatch = useCallback(async () => {
    setBatchBusy(true);
    setBatchStop(false);
    setAutoStopMsg("");
    batchStopRef.current = false;
    const next = [...rows];
    let done = next.filter((r) => isFinalResult(r.result)).length;
    setBatchDone(done);
    // ── 원문주소 선(先)중복제거 (2026-07-13 추가) ─────────────────────
    // raw 문자열이 완전히 같은 행끼리 그룹화 → 대표 1건만 juso/kakao 호출
    // → 결과를 그룹 전원에 복사. Stage2(등기조회)가 PNU+동호로 하는 것과
    // 같은 패턴을 정제 단계에도 적용한 것. 같은 담보 부동산이 여러 채권
    // 건으로 반복 등장하는 데이터 특성상 실제 API 호출 수가 크게 줄어든다.
    // (문자열이 달라도 같은 부동산인 중복은 Stage2의 PNU+동호 그룹화가
    // 마저 잡으므로, 여기서는 '글자가 똑같은 중복'만 담당하면 충분함.)
    // 그룹 키 정규화: 유니코드 조합형 통일(NFC) + 앞뒤공백 제거 + 연속공백
    // 1칸 축약. 키'만' 정규화하고 각 행의 raw(원본주소)는 절대 건드리지
    // 않음 — 결과지의 원본주소는 원 시스템 추적용이라 글자 그대로 보존.
    // 번지·동·호 표현을 바꾸는 유사도 병합은 하지 않음(그건 Stage2의
    // PNU+동호 그룹화가 정제 결과 기준으로 정확하게 담당).
    const groups = /* @__PURE__ */ new Map();   // 정규화키 → [행 인덱스...]
    for (let i = 0; i < next.length; i++) {
      if (isFinalResult(next[i].result)) continue;   // 확정분만 스킵 — 일시오류는 재시도 대상
      const k = normalizeRawKey(next[i].raw);
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(i);
    }
    // 진행률 2종: 작업률(고유주소 = 실제 API 호출 단위) / 반영률(원본 행 수)
    setBatchGroupTotal(groups.size);
    let gDone = 0;
    setBatchGroupDone(0);
    let consecTransient = 0;   // 연속 '일시 오류' 수 — 한도 소진/장애 감지용(PM-01)
    for (const [, idxs] of groups) {
      if (batchStopRef.current) break;
      let r;
      try {
        r = await refineAddress(next[idxs[0]].raw, clients);  // 대표는 그룹 첫 행의 원본 raw
        consecTransient = 0;
      } catch (e) {
        // 클라이언트가 던진 일시 오류(네트워크/HTTP/한도) — 영구 실패와 구분해 기록
        r = { status: "FAILED", failKind: "TRANSIENT",
              message: `일시 오류: ${e && e.message ? e.message : e}` };
        consecTransient++;
      }
      for (const i of idxs) {
        next[i] = { ...next[i], result: r };
      }
      gDone++;
      setBatchGroupDone(gDone);
      done += idxs.length;
      setBatchDone(done);
      if (done % 100 < idxs.length) {            // 100건 경계를 지날 때마다 저장
        setRows([...next]);
        await idbSet(BATCH_KEY, { v: 2, rows: next, extraHeaders });
      }
      if (consecTransient >= 20) {
        // 연속 20그룹이 전부 일시오류 = 한도 소진 또는 API 장애 가능성 높음.
        // 계속 헛호출하지 않고 자동 중단(진행분은 저장돼 있고, 실패분은
        // TRANSIENT라 '일괄 정제' 재클릭 시 그 지점부터 재시도됨).
        batchStopRef.current = true;
        setAutoStopMsg(`연속 오류 ${consecTransient}회 감지 — API 한도 소진 또는 장애 가능성이 있어 자동 중단했습니다. 잠시 후(또는 내일) '일괄 정제'를 다시 누르면 실패분부터 이어서 진행합니다.`);
        break;
      }
    }
    setRows([...next]);
    await idbSet(BATCH_KEY, { v: 2, rows: next, extraHeaders });
    // 완료 검증(중단이 아닌 자연 완료일 때만): 모든 행에 결과가 반영됐는지
    if (!batchStopRef.current) {
      const missing = next.filter((r) => !r.result).length;
      if (missing > 0) {
        setFileErr(`검증 경고: ${missing}행에 정제 결과가 반영되지 않았습니다. 다시 정제를 실행해주세요.`);
      }
      const transient = next.filter((r) => r.result && r.result.failKind === "TRANSIENT").length;
      if (transient > 0) {
        setAutoStopMsg(`일시 오류로 실패한 ${transient}행이 있습니다 — '일괄 정제'를 다시 누르면 해당 행만 재시도합니다.`);
      }
    }
    setBatchBusy(false);
  }, [rows, clients, extraHeaders]);
  const buildRecords = useCallback(() => {
    const recs = rows.map((row) => {
      const r = row.result || {};
      const reg = row.reg;
      const jibun = r.jibunAddr || "";
      const sggM = jibun.match(/(?:특별시|광역시|특별자치시|특별자치도|도)\s+([가-힣]+(?:시|군|구)(?:\s+[가-힣]+구)?)/);
      const sigungu = sggM ? sggM[1] : "";
      let gubun = "";
      if (reg?.status === "RESOLVED" && reg.candidates?.[0]) gubun = reg.candidates[0].gubun || "";
      else if (reg?.candidates?.[0]) gubun = reg.candidates[0].gubun || "";
      if (!gubun && r.isJip) gubun = "\uC9D1\uD569\uAC74\uBB3C";
      const aptType = r.aptType || "";
      const regNo = reg?.status === "RESOLVED" ? reg.unique_no || "" : "";
      const pnu = r.pnu || "";
      const pk = regNo || (pnu ? `${pnu}|${r.unit?.dong || ""}|${r.unit?.ho || ""}` : "");
      let failCode = "";
      const okStatus = r.status === "\uD655\uC815" || r.status === "CONFIRMED";
      if (!okStatus) {
        failCode = r.status === "AMBIGUOUS" ? "\uC8FC\uC18C\uD6C4\uBCF4\uBCF5\uC218"
          : r.status === "VALIDATION_FAILED" ? "\uAC80\uC99D\uBD88\uC77C\uCE58"
          : r.status === "FAILED" ? (r.failKind === "TRANSIENT" ? "\uC77C\uC2DC\uC624\uB958" : "\uC8FC\uC18C\uBBF8\uBC1C\uACAC") : "";
      } else if (reg && reg.status !== "RESOLVED") {
        failCode = REG_LABEL[reg.status] || reg.status;
      }
      const addrSrc = r.source === "kakao" ? "\uCE74\uCE74\uC624\uD3F4\uBC31" : r.searchLevel === "L2" ? "JUSO\uC7AC\uAC80\uC0C9" : "JUSO\uC6D0\uBB38";
      const unitSrc = r.unit?.dong || r.unit?.ho ? r.aptType ? "VWorld\uC120\uD0DD" : "\uC9C1\uC811\uC785\uB825" : "";
      return {
        raw: row.raw,
        status: r.status || "\uBBF8\uC2E4\uD589",
        sigungu,
        gubun,
        aptType,
        jibun,
        road: r.roadAddr || "",
        dong: r.unit?.dong || "",
        ho: r.unit?.ho || "",
        pnu,
        bdMgtSn: r.bdMgtSn || "",
        regNo,
        regStatus: reg?.status || "",
        pk,
        failCode,
        addrSrc,
        unitSrc,
        lookupAt: reg?.at || (reg ? (/* @__PURE__ */ new Date()).toISOString().slice(0, 19).replace("T", " ") : ""),
        note: okStatus ? failCode || "" : r.message || r.reason || failCode || "",
        // ── 진단 열(2026-07-13): 전처리 오염 vs 원천 무결과를 눈으로 구분하기 위함 ──
        jusoQuery: r.jusoQuery || "",
        candCount: r.candCount ?? "",
        searchLevel: r.searchLevel || "",
        inputSgg: r.validation?.inputSgg || "",
        resultSgg: r.validation?.resultSgg || "",
        valStatus: r.validation?.status || "",
        valReason: r.validation?.reason || "",
        extra: row.extra || []
      };
    });
    recs.sort((a, b) => (a.sigungu || "\uD7A3").localeCompare(b.sigungu || "\uD7A3") || (a.gubun || "\uD7A3").localeCompare(b.gubun || "\uD7A3") || (a.aptType || "\uD7A3").localeCompare(b.aptType || "\uD7A3") || (a.regNo || "").localeCompare(b.regNo || ""));
    const groupNo = /* @__PURE__ */ new Map();
    let gid = 0;
    for (const rec of recs) {
      if (!rec.pk) continue;
      if (!groupNo.has(rec.pk)) groupNo.set(rec.pk, ++gid);
    }
    const seen = /* @__PURE__ */ new Set();
    for (const rec of recs) {
      if (!rec.pk) {
        rec.dup = "";
        rec.grp = "";
        continue;
      }
      rec.grp = groupNo.get(rec.pk);
      if (seen.has(rec.pk)) {
        rec.dup = "\uC911\uBCF5";
      } else {
        rec.dup = "\uCD5C\uCD08";
        seen.add(rec.pk);
      }
    }
    return recs;
  }, [rows]);
  const HEADERS = ["원본주소", "정제상태", "시군구", "부동산구분", "주택유형", "지번주소", "도로명주소", "동", "호", "PNU", "건물관리번호", "등기고유번호", "중복여부", "중복그룹", "주소확정원천", "동호원천", "등기상태", "실패코드", "조회일시", "비고", "juso\uAC80\uC0C9\uC5B4", "\uD6C4\uBCF4\uAC74\uC218", "\uAC80\uC0C9\uACBD\uB85C", "\uC785\uB825\uC9C0\uC5ED", "\uACB0\uACFC\uC9C0\uC5ED", "\uAC80\uC99D\uC0C1\uD0DC", "\uAC80\uC99D\uC0AC\uC720"];
  const recToRow = (rec) => [
    ...rec.extra,
    rec.raw,
    rec.status,
    rec.sigungu,
    rec.gubun,
    rec.aptType,
    rec.jibun,
    rec.road,
    rec.dong,
    rec.ho,
    rec.pnu,
    rec.bdMgtSn,
    rec.regNo,
    rec.dup,
    rec.grp,
    rec.addrSrc,
    rec.unitSrc,
    REG_LABEL[rec.regStatus] || rec.regStatus || "",
    rec.failCode,
    rec.lookupAt,
    rec.note,
    rec.jusoQuery,
    rec.candCount,
    rec.searchLevel,
    rec.inputSgg,
    rec.resultSgg,
    rec.valStatus,
    rec.valReason
  ];
  const makeSheet = (recs, mode2) => {
    // 부동산번호 등 업로드 원본 열(extraHeaders)을 맨 앞에 배치 — 조인키가
    // 스크롤 없이 바로 보이도록. 나머지(HEADERS)는 기존 순서 그대로.
    const head = [...extraHeaders, ...HEADERS];
    const aoa = [head];
    for (const rec of recs) {
      if (mode2 === "unique" && rec.dup === "중복") continue;
      if (mode2 === "fail") {
        const ok = (rec.status === "확정" || rec.status === "CONFIRMED") && rec.regNo;
        if (ok) continue;
      }
      aoa.push(recToRow(rec));
    }
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    // PNU·건물관리번호·등기고유번호는 선행 0/하이픈 소실 방지를 위해 텍스트
    // 서식 강제. extraHeaders가 앞에 붙었으므로 그 길이만큼 오프셋을 더함.
    const offset = extraHeaders.length;
    for (let i = 1; i < aoa.length; i++) {
      for (const col of [offset + 9, offset + 10, offset + 11]) {
        const ref = XLSX.utils.encode_cell({ r: i, c: col });
        if (ws[ref]) ws[ref].t = "s";
      }
    }
    ws["!cols"] = [
      ...extraHeaders.map(() => 14),
      34,
      9,
      10,
      11,
      11,
      28,
      28,
      6,
      7,
      21,
      25,
      17,
      9,
      9,
      13,
      11,
      11,
      12,
      17,
      15
    , 40, 8, 8, 16, 20, 12, 22].map((w) => ({ wch: w }));
    ws["!freeze"] = { xSplit: 0, ySplit: 1 };
    return ws;
  };
  const makeSummary = (recs) => {
    const ok = recs.filter((r) => r.status === "\uD655\uC815" || r.status === "CONFIRMED");
    const uniq = new Set(ok.map((r) => r.pk).filter(Boolean)).size;
    const aoa = [
      ["\uBD80\uB3D9\uC0B0 \uB4F1\uAE30\uACE0\uC720\uBC88\uD638 \uC815\uC81C\xB7\uC911\uBCF5\uC81C\uAC70 \uACB0\uACFC"],
      [],
      ["\uC804\uCCB4 \uCC98\uB9AC \uAC74\uC218", recs.length],
      ["\uC815\uC81C \uC131\uACF5(\uD655\uC815)", ok.length],
      ["\uC815\uC81C \uC2E4\uD328", recs.length - ok.length],
      ["\uACE0\uC720 \uBD80\uB3D9\uC0B0(\uC911\uBCF5\uC81C\uAC70 \uD6C4)", uniq],
      ["\uC911\uBCF5 \uC81C\uAC70\uB41C \uAC74\uC218", ok.length - uniq],
      []
    ];
    const aggBy = (field2, label) => {
      const m = /* @__PURE__ */ new Map();
      for (const r of ok) {
        const k = r[field2] || "(\uBBF8\uBD84\uB958)";
        if (!m.has(k)) m.set(k, { cnt: 0, keys: /* @__PURE__ */ new Set() });
        m.get(k).cnt++;
        m.get(k).keys.add(r.pk);
      }
      aoa.push([`[${label}\uBCC4 \uC9D1\uACC4]`]);
      aoa.push([label, "\uAC74\uC218", "\uACE0\uC720", "\uC911\uBCF5"]);
      for (const k of [...m.keys()].sort()) {
        const { cnt, keys } = m.get(k);
        aoa.push([k, cnt, keys.size, cnt - keys.size]);
      }
      aoa.push([]);
    };
    aggBy("sigungu", "\uC2DC\uAD70\uAD6C");
    aggBy("gubun", "\uBD80\uB3D9\uC0B0\uAD6C\uBD84");
    aggBy("aptType", "\uC8FC\uD0DD\uC720\uD615");
    const failM = /* @__PURE__ */ new Map();
    for (const r of recs) {
      if ((r.status === "\uD655\uC815" || r.status === "CONFIRMED") && r.regNo) continue;
      const k = r.failCode || "\uBBF8\uC2E4\uD589";
      failM.set(k, (failM.get(k) || 0) + 1);
    }
    if (failM.size) {
      aoa.push(["[\uC2E4\uD328\xB7\uBBF8\uD655\uC815 \uC0AC\uC720\uBCC4]"]);
      aoa.push(["\uC0AC\uC720", "\uAC74\uC218"]);
      for (const k of [...failM.keys()].sort()) aoa.push([k, failM.get(k)]);
      aoa.push([]);
    }
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!cols"] = [{ wch: 26 }, { wch: 12 }, { wch: 10 }, { wch: 10 }];
    return ws;
  };
  const downloadXlsx = useCallback((mode2) => {
    const recs = buildRecords();
    // 무결성 검증(다중집합 비교): 출력은 시군구 등으로 의도적으로 재정렬
    // 되므로 '행 순서'가 아니라 "모든 (원본주소+원본열) 쌍이 업로드된
    // 횟수만큼 정확히 존재"를 검사한다. 부동산번호 누락·뒤섞임을 잡는다.
    // (중복제거본·실패본은 의도적 부분집합이라 검사 대상 아님 — 전체본 기준)
    {
      const sig = (raw, extra) => raw + "\u0001" + JSON.stringify(extra || []);
      const cnt = /* @__PURE__ */ new Map();
      for (const row of rows) {
        const s = sig(row.raw, row.extra);
        cnt.set(s, (cnt.get(s) || 0) + 1);
      }
      let broken = recs.length !== rows.length;
      if (!broken) for (const rec of recs) {
        const s = sig(rec.raw, rec.extra);
        const c = cnt.get(s);
        if (!c) { broken = true; break; }
        cnt.set(s, c - 1);
      }
      if (!broken) for (const v of cnt.values()) if (v !== 0) { broken = true; break; }
      if (broken) {
        alert(`무결성 오류: 업로드 원본(부동산번호 포함)과 결과가 1:1로 대응하지 않습니다 (업로드 ${rows.length}행 / 결과 ${recs.length}행). 다운로드를 중단합니다 — 새로고침 후 "이어서 하기"로 복구해주세요.`);
        return;
      }
    }
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, makeSummary(recs), "\uC694\uC57D");
    const sheetName = mode2 === "unique" ? "\uC911\uBCF5\uC81C\uAC70\uBCF8" : mode2 === "fail" ? "\uC2E4\uD328\xB7\uBBF8\uD655\uC815" : "\uC804\uCCB4(\uC911\uBCF5\uD45C\uC2DC)";
    XLSX.utils.book_append_sheet(wb, makeSheet(recs, mode2), sheetName);
    const fileName = mode2 === "unique" ? "\uC815\uC81C\uACB0\uACFC_\uC911\uBCF5\uC81C\uAC70.xlsx" : mode2 === "fail" ? "\uC815\uC81C\uACB0\uACFC_\uC2E4\uD328\uAC74.xlsx" : "\uC815\uC81C\uACB0\uACFC_\uC804\uCCB4.xlsx";
    XLSX.writeFile(wb, fileName);
  }, [rows, extraHeaders]);
  const stat = rows.reduce((acc, r) => {
    if (r.result) acc[r.result.status] = (acc[r.result.status] || 0) + 1;
    return acc;
  }, {});
  // 등기조회 결과 집계(2026-07-15): 화면에 성공/다건/실패가 안 보여 추가.
  const regStat = rows.reduce((acc, r) => {
    const s = r.reg?.status;
    if (!s) return acc;
    if (s === "RESOLVED") acc.ok++;
    else if (s === "REG_MULTI" || s === "MULTIPLE") acc.multi++;
    else if (s === "REG_UNIT_NOT_FOUND") acc.unitNo++;
    else acc.fail++;   // NOT_FOUND, SESSION_ERROR, RATE_LIMIT 등 전부
    acc.done++;
    return acc;
  }, { ok: 0, multi: 0, unitNo: 0, fail: 0, done: 0 });
  const btnP = {
    padding: "12px 26px",
    fontSize: 14,
    fontWeight: 700,
    fontFamily: sans,
    letterSpacing: "0.02em",
    border: "none",
    borderRadius: 10,
    cursor: "pointer",
    color: "#0B0E14",
    background: `linear-gradient(135deg, ${C.cyan}, ${C.indigo})`,
    boxShadow: `0 0 24px ${C.cyan}33`
  };
  const btnS = {
    padding: "12px 24px",
    fontSize: 13.5,
    fontWeight: 600,
    fontFamily: sans,
    border: `1px solid ${C.cardLine}`,
    borderRadius: 10,
    cursor: "pointer",
    background: "rgba(15,19,28,0.4)",
    color: C.ink
  };
  const field = (w) => ({
    width: w,
    padding: "12px 15px",
    fontSize: 14,
    fontFamily: sans,
    border: `1px solid rgba(255,255,255,0.22)`,
    borderRadius: 10,
    background: "rgba(15,19,28,0.5)",
    backdropFilter: "blur(3px)",
    WebkitBackdropFilter: "blur(3px)",
    color: C.ink,
    outline: "none"
  });
  return /* @__PURE__ */ React.createElement("div", { style: { minHeight: "100vh", background: C.bg, fontFamily: sans, color: C.ink, position: "relative" } }, /* @__PURE__ */ React.createElement("style", null, `
        .aurora { animation: sweep 60s linear infinite; }
        @keyframes sweep { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .pnu-drift { animation-name: drift; animation-timing-function: linear; animation-iteration-count: infinite; }
        @keyframes drift { from { transform: translateY(0); } to { transform: translateY(-70vh); } }
        .result-in { animation: rise .35s cubic-bezier(.2,.9,.3,1); }
        @keyframes rise { from { transform: translateY(10px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        .cand { transition: border-color .15s ease, background .15s ease; }
        .cand:hover { border-color: ${C.cyan}66 !important; background: rgba(34,211,238,0.06) !important; }
        input::placeholder { color: ${C.faint}; }
        input:focus { border-color: ${C.cyan}88 !important; box-shadow: 0 0 0 3px ${C.cyan}22; }
        button:focus-visible, a:focus-visible, input:focus-visible, label:focus-visible { outline: 2px solid ${C.cyan}; outline-offset: 2px; }
        @media (prefers-reduced-motion: reduce) { .pnu-drift, .result-in, .aurora { animation: none !important; } .comet-layer { display: none; } }
      `), /* @__PURE__ */ React.createElement(CadastralBackdrop, null), irosHealth.bad >= 3 && /* @__PURE__ */ React.createElement("div", { style: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    background: "linear-gradient(90deg, #7F1D1D, #B91C1C)",
    borderBottom: "2px solid #F87171",
    padding: "12px 20px",
    display: "flex",
    alignItems: "center",
    gap: 14,
    boxShadow: "0 4px 20px rgba(185,28,28,0.5)"
  } }, /* @__PURE__ */ React.createElement("span", { style: { fontSize: 20 } }, "\u26A0\uFE0F"), /* @__PURE__ */ React.createElement("div", { style: { flex: 1 } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 14, fontWeight: 700, color: "#FFF", fontFamily: sans } }, "\uB4F1\uAE30\uC18C(IROS) \uC870\uD68C\uC5D0 \uC5F0\uC18D \uC2E4\uD328\uD558\uACE0 \uC788\uC2B5\uB2C8\uB2E4 \u2014 \uC2DC\uC2A4\uD15C \uC810\uAC80\uC774 \uD544\uC694\uD560 \uC218 \uC788\uC5B4\uC694"), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, color: "#FECACA", fontFamily: mono, marginTop: 3 } }, "\uC5F0\uC18D ", irosHealth.bad, "\uAC74 \uC2E4\uD328 \xB7 \uB9C8\uC9C0\uB9C9 \uC0AC\uC720: ", REG_LABEL[irosHealth.lastCode] || irosHealth.lastCode, " \xB7 ", "IROS \uC751\uB2F5 \uAD6C\uC870\uAC00 \uBC14\uB00C\uC5C8\uC744 \uAC00\uB2A5\uC131 (\uD30C\uC11C \uC810\uAC80 \uAD8C\uC7A5)")), /* @__PURE__ */ React.createElement(
    "button",
    {
      onClick: () => setIrosHealth({ bad: 0, total: 0, lastCode: "" }),
      style: {
        background: "rgba(0,0,0,0.25)",
        border: "1px solid #F87171",
        color: "#FFF",
        borderRadius: 8,
        padding: "6px 14px",
        cursor: "pointer",
        fontSize: 12.5,
        fontFamily: sans,
        whiteSpace: "nowrap"
      }
    },
    "\uD655\uC778 \xB7 \uB2EB\uAE30"
  )), /* @__PURE__ */ React.createElement("div", { style: { position: "fixed", top: 14, left: 16, zIndex: 40 } }, /* @__PURE__ */ React.createElement(
    "button",
    {
      onClick: () => setBridgeHelpOpen((v) => !v),
      title: bridgeUp ? "\uB4F1\uAE30 \uBE0C\uB9AC\uC9C0 \uC5F0\uACB0\uB428" : "\uB4F1\uAE30 \uBE0C\uB9AC\uC9C0 \uAEBC\uC9D0 \u2014 \uD074\uB9AD\uD558\uBA74 \uC2E4\uD589\uBC95",
      style: {
        display: "flex",
        alignItems: "center",
        gap: 7,
        padding: "6px 12px",
        background: bridgeUp ? `${C.ok}1c` : "rgba(15,19,28,0.5)",
        border: `1px solid ${bridgeUp ? C.ok + "66" : "rgba(255,255,255,0.14)"}`,
        borderRadius: 20,
        cursor: "pointer",
        fontFamily: sans,
        fontSize: 11.5,
        fontWeight: 700,
        color: bridgeUp ? C.ok : C.dim
      }
    },
    /* @__PURE__ */ React.createElement("span", { style: {
      width: 8,
      height: 8,
      borderRadius: "50%",
      background: bridgeUp ? C.ok : C.faint,
      boxShadow: bridgeUp ? `0 0 8px ${C.ok}` : "none"
    } }),
    bridgeUp ? "\uB4F1\uAE30 \uBE0C\uB9AC\uC9C0 \uC5F0\uACB0\uB428" : "\uB4F1\uAE30 \uBE0C\uB9AC\uC9C0 \uAEBC\uC9D0"
  ), bridgeHelpOpen && /* @__PURE__ */ React.createElement("div", { style: {
    marginTop: 8,
    width: "min(90vw, 320px)",
    background: "rgba(15,19,28,0.96)",
    border: `1px solid ${C.cardLine}`,
    borderRadius: 12,
    padding: "14px 16px",
    boxShadow: "0 16px 44px rgba(0,0,0,0.5)"
  } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12.5, fontWeight: 700, color: C.ink, marginBottom: 8 } }, "\uB4F1\uAE30\uACE0\uC720\uBC88\uD638 \uC790\uB3D9\uC870\uD68C \uCF1C\uB294 \uBC95"), /* @__PURE__ */ React.createElement("p", { style: { fontSize: 11.5, color: C.dim, lineHeight: 1.65, margin: "0 0 8px" } }, "\uBE0C\uB77C\uC6B0\uC800\uB294 \uC778\uD130\uB137\uB4F1\uAE30\uC18C\uB97C \uC9C1\uC811 \uC870\uD68C\uD560 \uC218 \uC5C6\uC5B4, \uBE0C\uB9AC\uC9C0 \uC11C\uBC84\uAC00 \uB300\uC2E0 \uC870\uD68C\uD569\uB2C8\uB2E4. \uB450 \uBC29\uC2DD \uC911 \uD558\uB098:"), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 11.5, color: C.dim, lineHeight: 1.7, margin: "0 0 8px" } }, /* @__PURE__ */ React.createElement("div", { style: { marginBottom: 6 } }, /* @__PURE__ */ React.createElement("strong", { style: { color: C.cyan } }, "EC2 (\uC5B4\uB514\uC11C\uB098 \uC811\uC18D)"), /* @__PURE__ */ React.createElement("br", null), "\uC11C\uBC84\uC5D0 ", /* @__PURE__ */ React.createElement("code", { style: { color: C.cyan, fontFamily: mono } }, "setup_ec2.sh"), " \uBC30\uD3EC \u2192 \uBC1C\uAE09\uB41C \uBE0C\uB9AC\uC9C0 \uC8FC\uC18C\xB7\uD0A4\uB97C \u2699 \uC124\uC815\uC5D0 \uC785\uB825. \uD3F0\uC5D0\uC11C\uB3C4 \uC870\uD68C\uB429\uB2C8\uB2E4."), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("strong", { style: { color: C.cyan } }, "\uB85C\uCEEC (\uB0B4 PC)"), /* @__PURE__ */ React.createElement("br", null), /* @__PURE__ */ React.createElement("code", { style: { color: C.cyan, fontFamily: mono } }, "\uC2E4\uD589.bat"), " \uB354\uBE14\uD074\uB9AD \u2192 \uC124\uC815 \uBE44\uC6CC\uB450\uBA74 \uC790\uB3D9\uC73C\uB85C localhost \uC0AC\uC6A9.")), /* @__PURE__ */ React.createElement("p", { style: { fontSize: 10.5, color: C.faint, margin: 0, lineHeight: 1.55 } }, "\uBC30\uC9C0\uAC00 ", /* @__PURE__ */ React.createElement("span", { style: { color: C.ok, fontWeight: 700 } }, "\uCD08\uB85D"), "\uC774\uBA74 \uC5F0\uACB0\uB428. \uBE0C\uB9AC\uC9C0 \uC5C6\uC774\uB3C4 \uC815\uC81C(PNU\xB7\uAC74\uBB3C\uAD00\uB9AC\uBC88\uD638)\uB294 \uC815\uC0C1 \uB3D9\uC791\uD569\uB2C8\uB2E4."))), /* @__PURE__ */ React.createElement(
    "button",
    {
      onClick: () => setSettingsOpen(true),
      "aria-label": "\uC124\uC815",
      title: "\uC124\uC815 (.env)",
      style: {
        position: "fixed",
        top: 14,
        right: 16,
        zIndex: 40,
        width: 36,
        height: 36,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(15,19,28,0.35)",
        border: "1px solid rgba(255,255,255,0.12)",
        borderRadius: "50%",
        cursor: "pointer",
        color: C.dim,
        fontSize: 15,
        opacity: 0.55,
        transition: "opacity .15s ease"
      },
      onMouseEnter: (e) => e.currentTarget.style.opacity = 1,
      onMouseLeave: (e) => e.currentTarget.style.opacity = 0.55
    },
    "\u2699"
  ), /* @__PURE__ */ React.createElement(EnvSettings, { open: settingsOpen, onClose: () => setSettingsOpen(false), config, onSave: saveConfig }), /* @__PURE__ */ React.createElement("div", { style: { position: "relative", zIndex: 1 } }, /* @__PURE__ */ React.createElement("header", { style: { padding: "44px 20px 8px", textAlign: "center" } }, /* @__PURE__ */ React.createElement("div", { style: { fontFamily: mono, fontSize: 11, color: C.cyan, letterSpacing: "0.45em", marginBottom: 12 } }, "ADDR-REFINE\xA0\xB7\xA0v0.1"), /* @__PURE__ */ React.createElement("h1", { style: { fontSize: "clamp(26px, 5.4vw, 40px)", fontWeight: 800, margin: 0, lineHeight: 1.2, letterSpacing: "-0.02em" } }, "\uC5B4\uB5A4 \uC8FC\uC18C\uB4E0,", " ", /* @__PURE__ */ React.createElement("span", { style: {
    background: `linear-gradient(90deg, ${C.cyan}, ${C.indigo})`,
    WebkitBackgroundClip: "text",
    backgroundClip: "text",
    color: "transparent"
  } }, "\uCC3E\uC544\uB0C5\uB2C8\uB2E4")), /* @__PURE__ */ React.createElement("p", { style: { fontSize: 14, color: C.dim, margin: "12px 0 0", lineHeight: 1.6 } }, "\uBBF8\uC815\uC81C \uC8FC\uC18C \u2192 \uC9C0\uBC88 \xB7 \uB3C4\uB85C\uBA85 \xB7 PNU \xB7 \uAC74\uBB3C\uAD00\uB9AC\uBC88\uD638")), /* @__PURE__ */ React.createElement("main", { style: { maxWidth: 800, margin: "0 auto", padding: "26px 20px 80px" } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 10, alignItems: "center", justifyContent: "center", marginBottom: 6, flexWrap: "wrap" } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", background: "rgba(15,19,28,0.4)", border: `1px solid rgba(255,255,255,0.16)`, borderRadius: 9, overflow: "hidden" } }, [["mock", "\uBAA9\uC5C5 \uB370\uC774\uD130"], ["real", "\uC2E4\uC81C API"]].map(([m, label]) => /* @__PURE__ */ React.createElement(
    "button",
    {
      key: m,
      onClick: () => setMode(m),
      style: {
        padding: "8px 16px",
        fontSize: 12,
        fontWeight: 700,
        border: "none",
        cursor: "pointer",
        fontFamily: sans,
        background: mode === m ? "rgba(34,211,238,0.15)" : "transparent",
        color: mode === m ? C.cyan : C.faint
      }
    },
    label
  )))), mode === "real" && /* @__PURE__ */ React.createElement("p", { style: { fontSize: 11, color: C.faint, margin: "8px 0 2px", textAlign: "center", lineHeight: 1.6 } }, config.jusoKey || config.kakaoKey ? "\uC800\uC7A5\uB41C \uD0A4\uB85C \uD638\uCD9C\uD569\uB2C8\uB2E4. " : "\uC6B0\uCE21 \uC0C1\uB2E8 \u2699 \uC124\uC815\uC5D0\uC11C API \uD0A4\uB97C \uBA3C\uC800 \uC800\uC7A5\uD574\uC8FC\uC138\uC694. ", "\uBE0C\uB77C\uC6B0\uC800 CORS \uC815\uCC45\uC73C\uB85C \uC9C1\uC811 \uD638\uCD9C\uC774 \uCC28\uB2E8\uB420 \uC218 \uC788\uC2B5\uB2C8\uB2E4. \uC6B4\uC601 \uD658\uACBD\uC740 \uC11C\uBC84 \uD504\uB85D\uC2DC \uACBD\uC720\uAC00 \uC815\uC2DD \uACBD\uB85C\uC785\uB2C8\uB2E4."), /* @__PURE__ */ React.createElement("div", { style: {
    display: "flex",
    gap: 4,
    justifyContent: "center",
    margin: "20px 0 22px",
    background: "rgba(15,19,28,0.4)",
    border: `1px solid rgba(255,255,255,0.16)`,
    borderRadius: 11,
    padding: 4,
    width: "fit-content",
    marginLeft: "auto",
    marginRight: "auto"
  } }, [["single", "\uB2E8\uC77C \uC815\uC81C"], ["batch", "\uC77C\uAD04 \uC815\uC81C (\uC5D1\uC140)"]].map(([t, label]) => /* @__PURE__ */ React.createElement(
    "button",
    {
      key: t,
      onClick: () => setTab(t),
      style: {
        padding: "9px 22px",
        fontSize: 13.5,
        fontWeight: 700,
        fontFamily: sans,
        border: "none",
        cursor: "pointer",
        background: tab === t ? `linear-gradient(135deg, ${C.cyan}26, ${C.indigo}26)` : "transparent",
        color: tab === t ? C.ink : C.faint,
        borderRadius: 8
      }
    },
    label
  ))), tab === "single" && /* @__PURE__ */ React.createElement("section", null, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 10 } }, /* @__PURE__ */ React.createElement(
    "input",
    {
      value: input,
      onChange: (e) => setInput(e.target.value),
      onKeyDown: (e) => e.key === "Enter" && runSingle(input),
      placeholder: "\uC8FC\uC18C\uB97C \uC544\uBB34 \uD615\uD0DC\uB85C\uB098 \uC785\uB825\uD558\uC138\uC694",
      style: { ...field("100%"), flex: 1, fontSize: 15 }
    }
  ), /* @__PURE__ */ React.createElement("button", { onClick: () => runSingle(input), disabled: busy, style: { ...btnP, opacity: busy ? 0.6 : 1 } }, busy ? "\uCC98\uB9AC\uC911" : "\uC815\uC81C")), /* @__PURE__ */ React.createElement("div", { style: { marginTop: 10 } }, /* @__PURE__ */ React.createElement(
    "button",
    {
      onClick: () => setUnitOpen((v) => !v),
      style: {
        background: "none",
        border: "none",
        cursor: "pointer",
        color: result?.isJip ? C.cyan : C.dim,
        fontSize: 12.5,
        fontFamily: sans,
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 2px"
      }
    },
    /* @__PURE__ */ React.createElement("span", { style: { transform: unitOpen ? "rotate(90deg)" : "none", transition: "transform .15s" } }, "\u25B8"),
    "\uC0C1\uC138\uC8FC\uC18C (\uB3D9\xB7\uD638)",
    result?.isJip && !unitOpen && /* @__PURE__ */ React.createElement("span", { style: {
      fontSize: 10.5,
      color: C.cyan,
      background: `${C.cyan}1f`,
      borderRadius: 4,
      padding: "1px 6px"
    } }, "\uC9D1\uD569\uAC74\uBB3C \xB7 \uC785\uB825 \uAD8C\uC7A5")
  ), unitOpen && /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 10, marginTop: 8, flexWrap: "wrap" } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 6 } }, /* @__PURE__ */ React.createElement("span", { style: { fontSize: 12, color: C.dim, minWidth: 20 } }, "\uB3D9"), /* @__PURE__ */ React.createElement(
    "input",
    {
      value: unitDong,
      onChange: (e) => applyUnit(e.target.value, unitHo),
      inputMode: "numeric",
      placeholder: "101",
      maxLength: 4,
      style: { ...field(80), textAlign: "center", fontFamily: mono }
    }
  )), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 6 } }, /* @__PURE__ */ React.createElement("span", { style: { fontSize: 12, color: C.dim, minWidth: 20 } }, "\uD638"), /* @__PURE__ */ React.createElement(
    "input",
    {
      value: unitHo,
      onChange: (e) => applyUnit(unitDong, e.target.value),
      inputMode: "numeric",
      placeholder: "1502",
      maxLength: 4,
      style: { ...field(80), textAlign: "center", fontFamily: mono }
    }
  )), /* @__PURE__ */ React.createElement("span", { style: { fontSize: 10.5, color: C.faint } }, "\uC22B\uC790\uB9CC \uC785\uB825 (\uB3D9\xB7\uD638 \uAE00\uC790 \uBD88\uD544\uC694)"), result?.status === "CONFIRMED" && result?.isJip && result?.pnu && !unitList && /* @__PURE__ */ React.createElement(
    "button",
    {
      onClick: findUnits,
      disabled: unitBusy,
      style: {
        fontSize: 11.5,
        padding: "6px 12px",
        borderRadius: 7,
        background: `${C.cyan}1a`,
        border: `1px solid ${C.cyan}55`,
        color: C.cyan,
        cursor: "pointer",
        fontFamily: sans,
        opacity: unitBusy ? 0.6 : 1
      }
    },
    unitBusy ? "\uBD88\uB7EC\uC624\uB294 \uC911\u2026" : "\u{1F50D} \uC138\uB300 \uBAA9\uB85D \uB2E4\uC2DC \uBD88\uB7EC\uC624\uAE30"
  )), unitBusy && !unitList && /* @__PURE__ */ React.createElement("p", { style: { fontSize: 12, color: C.cyan, marginTop: 8 } }, "\u{1F3E2} \uC774 \uB2E8\uC9C0\uC758 \uB3D9\xB7\uD638 \uBAA9\uB85D\uC744 \uBD88\uB7EC\uC624\uB294 \uC911\u2026"), unitErr && /* @__PURE__ */ React.createElement("p", { style: { fontSize: 11.5, color: C.dim, marginTop: 8 } }, unitErr), unitList && /* @__PURE__ */ React.createElement(UnitPicker, { data: unitList, onPick: onUnitPick, onClose: () => setUnitList(null) })), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 6, marginTop: 12, flexWrap: "wrap", justifyContent: "center" } }, ["\uC11C\uC6B8\uFF0A\uAC15\uB0A8\uAD6C\uFF01\uD14C\uD5E4\uB780\uB85C\uFF12\uFF11\uFF12", "\uC2E0\uC815\uB3D9 100", "\uC911\uC559\uB3D9 50", "\uCCAD\uC8FC\uC2DC \uC0B0\uC131\uB3D9 \uC0B012-3", "\uB798\uBBF8\uC548\uC6D0\uBCA0\uC77C\uB9AC 101\uB3D9 1502\uD638", "\uC5C6\uB294\uC8FC\uC18C 999"].map((ex) => /* @__PURE__ */ React.createElement(
    "button",
    {
      key: ex,
      onClick: () => {
        setInput(ex);
        runSingle(ex);
      },
      style: {
        fontSize: 11.5,
        padding: "5px 13px",
        background: "rgba(15,19,28,0.35)",
        border: `1px solid rgba(255,255,255,0.16)`,
        borderRadius: 15,
        cursor: "pointer",
        color: C.dim,
        fontFamily: sans
      }
    },
    ex
  ))), /* @__PURE__ */ React.createElement(
    ResultCard,
    {
      r: result,
      onRegionPick,
      bridgeUp,
      reg: regResult,
      regBusy,
      onLookup: lookupUniqueNo
    }
  ), regResult && (regResult.status === "RESOLVED" || regResult.status === "MULTIPLE") && /* @__PURE__ */ React.createElement("p", { style: { fontSize: 11, color: C.faint, textAlign: "center", marginTop: 10 } }, "\u203B \uB2E8\uC77C \uC870\uD68C \uACB0\uACFC\uB294 \uD654\uBA74 \uD45C\uC2DC\uC6A9\uC785\uB2C8\uB2E4. \uC5D1\uC140 \uC800\uC7A5\uC740 \uC77C\uAD04 \uD0ED\uC5D0\uC11C \uC9C0\uC6D0\uB429\uB2C8\uB2E4.")), tab === "batch" && /* @__PURE__ */ React.createElement("section", null, savedProgress && /* @__PURE__ */ React.createElement("div", { style: {
    background: `${C.cyan}12`,
    border: `1px solid ${C.cyan}55`,
    borderRadius: 12,
    padding: "14px 16px",
    marginBottom: 14,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap"
  } }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("p", { style: { margin: 0, fontSize: 13, color: C.ink, fontWeight: 600 } }, "\u{1F504} \uC774\uC804 \uC791\uC5C5\uC774 \uC800\uC7A5\uB418\uC5B4 \uC788\uC5B4\uC694"), /* @__PURE__ */ React.createElement("p", { style: { margin: "4px 0 0", fontSize: 11.5, color: C.dim } }, "\uC804\uCCB4 ", savedProgress.count.toLocaleString(), "\uAC74 \xB7 \uC815\uC81C ", savedProgress.refined.toLocaleString(), " \xB7 \uB4F1\uAE30\uC870\uD68C ", savedProgress.looked.toLocaleString(), " \uC644\uB8CC")), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 8 } }, /* @__PURE__ */ React.createElement("button", { onClick: resumeProgress, style: { ...btnP, padding: "8px 16px", fontSize: 13 } }, "\uC774\uC5B4\uC11C \uD558\uAE30"), /* @__PURE__ */ React.createElement("button", { onClick: discardProgress, style: { ...btnS, padding: "8px 14px", fontSize: 13 } }, "\uC0C8\uB85C \uC2DC\uC791"))), /* @__PURE__ */ React.createElement("div", { style: {
    background: C.card,
    border: `1px dashed ${C.cyan}55`,
    borderRadius: 14,
    padding: "28px 20px",
    textAlign: "center",
    backdropFilter: "blur(4px)",
    WebkitBackdropFilter: "blur(4px)"
  } }, /* @__PURE__ */ React.createElement("p", { style: { margin: "0 0 14px", fontSize: 13, color: C.dim } }, "xlsx / csv \uD30C\uC77C\uC758 ", /* @__PURE__ */ React.createElement("strong", { style: { color: C.ink } }, "A\uC5F4"), "\uC5D0 \uC8FC\uC18C\uB97C \uB123\uC5B4 \uC5C5\uB85C\uB4DC\uD558\uC138\uC694. \uD5E4\uB354 \uD589\uC740 \uC790\uB3D9 \uC778\uC2DD\uB429\uB2C8\uB2E4."), /* @__PURE__ */ React.createElement("label", { style: { ...btnP, display: "inline-block" } }, "\uD30C\uC77C \uC5C5\uB85C\uB4DC", /* @__PURE__ */ React.createElement("input", { type: "file", accept: ".xlsx,.xls,.csv", onChange: onFile, style: { display: "none" } })), fileParsing && /* @__PURE__ */ React.createElement("p", { style: { fontSize: 12.5, color: C.cyan, marginTop: 10 } }, "⏳ 파일 처리 중... (행 수가 많으면 몇 초 걸릴 수 있어요)"), uploadStats && /* @__PURE__ */ React.createElement("p", { style: { fontSize: 12.5, color: C.dim, marginTop: 12, fontFamily: mono } }, `총 ${uploadStats.total.toLocaleString()}행 · 고유주소 ${uploadStats.uniq.toLocaleString()}건 · 최대 중복그룹 ${uploadStats.maxGrp.toLocaleString()}행` + (uploadStats.empty > 0 ? ` · 빈주소 ${uploadStats.empty.toLocaleString()}행 제외` : "")), uploadStats && /* @__PURE__ */ React.createElement("p", { style: { fontSize: 12, color: uploadStats.mapping.mode === "fallback" ? C.warn : C.dim, marginTop: 6 } }, uploadStats.mapping.mode === "header" ? `인식: 주소=${uploadStats.mapping.addr}` + (uploadStats.mapping.detail ? ` · 상세=${uploadStats.mapping.detail} 자동결합` : "") + ` · 샘플: "${uploadStats.sample}"` : `⚠ 주소 헤더 미검출 — A열을 주소로 사용합니다(구양식). 샘플: "${uploadStats.sample}"`), fileErr && /* @__PURE__ */ React.createElement("p", { style: { color: C.err, fontSize: 12.5, marginTop: 12 } }, fileErr)), rows.length > 0 && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 12, margin: "20px 0 14px", flexWrap: "wrap", justifyContent: "center" } }, /* @__PURE__ */ React.createElement("button", { onClick: runBatch, disabled: batchBusy, style: { ...btnP, opacity: batchBusy ? 0.6 : 1 } }, batchBusy ? `정제중 ${batchGroupTotal ? Math.round(batchGroupDone / batchGroupTotal * 100) : 0}% · 고유주소 ${batchGroupDone}/${batchGroupTotal} · 행 ${batchDone}/${rows.length}` : (batchDone > 0 && batchDone === rows.length ? `정제 완료 (${rows.length}건)` : `일괄 정제 (${rows.length}건)`)), batchBusy && /* @__PURE__ */ React.createElement("button", { onClick: stopBatch, style: { ...btnS, borderColor: C.err, color: C.err } }, "\uC911\uB2E8"), autoStopMsg && !batchBusy && /* @__PURE__ */ React.createElement("p", { style: { width: "100%", textAlign: "center", fontSize: 12.5, color: C.warn, margin: "2px 0 0" } }, autoStopMsg), batchStop && !batchBusy && !batchRegBusy && /* @__PURE__ */ React.createElement("span", { style: { fontSize: 12, color: C.dim } }, "\uC911\uB2E8\uB428 \xB7 \uB2E4\uC2DC \uC815\uC81C\uD558\uBA74 \uC774\uC5B4\uC11C \uC9C4\uD589"), bridgeUp && (stat.CONFIRMED || 0) > 0 && !batchRegBusy && /* @__PURE__ */ React.createElement(
    "button",
    {
      onClick: lookupBatchUniqueNo,
      disabled: batchDone === 0,
      style: {
        ...btnP,
        background: `linear-gradient(135deg, ${C.ok}, ${C.cyan})`,
        opacity: batchDone === 0 ? 0.5 : 1
      }
    },
    "\uB4F1\uAE30\uACE0\uC720\uBC88\uD638 \uC77C\uAD04\uC870\uD68C (",
    stat.CONFIRMED || 0,
    "건)"
  ), (!batchBusy && rows.length > 0 && batchDone === rows.length && ((stat.CONFIRMED || 0) === 0 || (!batchRegBusy && batchTotal > 0 && batchRegDone >= batchTotal))) && /* @__PURE__ */ React.createElement("p", { style: { width: "100%", textAlign: "center", fontSize: 13.5, color: C.ok, fontWeight: 600, margin: "4px 0 0" } }, `✅ 전체 처리 완료 · 정제 ${batchDone}건`, (stat.CONFIRMED || 0) > 0 ? ` · 등기조회 ${batchRegDone}건` : ""), batchRegBusy && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("span", { style: { fontFamily: mono, fontSize: 13, color: C.cyan } }, `등기조회 ${batchTotal ? Math.round(batchRegDone / batchTotal * 100) : 0}% (${batchRegDone}/${batchTotal}) · 중복제거 후 · 건당 1초`), /* @__PURE__ */ React.createElement("button", { onClick: stopBatch, style: { ...btnS, borderColor: C.err, color: C.err } }, "\uC911\uB2E8")), (regStat.done > 0) && /* @__PURE__ */ React.createElement("span", { style: { display: "inline-flex", gap: 10, alignItems: "center", fontFamily: mono, fontSize: 12.5, flexWrap: "wrap" } }, /* @__PURE__ */ React.createElement("span", { style: { color: C.ok, fontWeight: 700 } }, `\u2713 \uC131\uACF5 ${regStat.ok}`), /* @__PURE__ */ React.createElement("span", { style: { color: C.warn } }, `\u25C9 \uB2E4\uAC74 ${regStat.multi}`), regStat.unitNo > 0 && /* @__PURE__ */ React.createElement("span", { style: { color: C.warn } }, `\u25C9 \uC138\uB300\uBBF8\uC77C\uCE58 ${regStat.unitNo}`), /* @__PURE__ */ React.createElement("span", { style: { color: C.err } }, `\u2715 \uC2E4\uD328 ${regStat.fail}`)), batchStop && !batchRegBusy && /* @__PURE__ */ React.createElement("span", { style: { fontSize: 12, color: C.dim } }, "\uC911\uB2E8\uB428 \xB7 \uB2E4\uC2DC \uC870\uD68C\uD558\uBA74 \uC774\uC5B4\uC11C \uC9C4\uD589"), /* @__PURE__ */ React.createElement(
    "button",
    {
      onClick: () => downloadXlsx("all"),
      disabled: batchDone === 0,
      style: { ...btnS, opacity: batchDone === 0 ? 0.5 : 1 }
    },
    "\uC804\uCCB4 \uB2E4\uC6B4\uB85C\uB4DC"
  ), /* @__PURE__ */ React.createElement(
    "button",
    {
      onClick: () => downloadXlsx("unique"),
      disabled: batchDone === 0,
      style: {
        ...btnS,
        opacity: batchDone === 0 ? 0.5 : 1,
        borderColor: `${C.ok}88`,
        color: C.ok
      }
    },
    "\uC911\uBCF5\uC81C\uAC70 \uB2E4\uC6B4\uB85C\uB4DC"
  ), /* @__PURE__ */ React.createElement(
    "button",
    {
      onClick: () => downloadXlsx("fail"),
      disabled: batchDone === 0,
      style: {
        ...btnS,
        opacity: batchDone === 0 ? 0.5 : 1,
        borderColor: `${C.warn}88`,
        color: C.warn
      }
    },
    "\uC2E4\uD328\uAC74 \uB2E4\uC6B4\uB85C\uB4DC"
  ), batchDone > 0 && /* @__PURE__ */ React.createElement("span", { style: { fontFamily: mono, fontSize: 12, color: C.dim } }, "\uD655\uC815 ", stat.CONFIRMED || 0, " \xB7 \uD655\uC778\uD544\uC694 ", stat.AMBIGUOUS || 0, " \xB7 \uC2E4\uD328 ", stat.FAILED || 0)), rows.length > PREVIEW_ROWS && /* @__PURE__ */ React.createElement("p", { style: { fontSize: 11.5, color: C.faint, textAlign: "center", margin: "-4px 0 12px" } }, `아래 목록은 상위 ${PREVIEW_ROWS}행 미리보기입니다 (전체 ${rows.length.toLocaleString()}행) — 전체 결과는 엑셀 다운로드로 확인하세요`), /* @__PURE__ */ React.createElement("div", { style: { background: C.card, border: `1px solid ${C.cardLine}`, borderRadius: 13, overflow: "auto", backdropFilter: "blur(10px)" } }, /* @__PURE__ */ React.createElement("table", { style: { width: "100%", borderCollapse: "collapse", fontSize: 12.5 } }, /* @__PURE__ */ React.createElement("thead", null, /* @__PURE__ */ React.createElement("tr", { style: { textAlign: "left" } }, ["#", "\uC785\uB825", "\uC0C1\uD0DC", "\uC815\uC81C \uACB0\uACFC", "PNU", "\uB4F1\uAE30\uACE0\uC720\uBC88\uD638"].map((h) => /* @__PURE__ */ React.createElement("th", { key: h, style: {
    padding: "11px 14px",
    borderBottom: `1px solid ${C.cardLine}`,
    fontSize: 10.5,
    color: C.faint,
    fontWeight: 700,
    letterSpacing: "0.14em"
  } }, h)))), /* @__PURE__ */ React.createElement("tbody", null, rows.slice(0, PREVIEW_ROWS).map((row, i) => {
    const r = row.result;
    return /* @__PURE__ */ React.createElement("tr", { key: i, style: { borderBottom: `1px solid rgba(255,255,255,0.045)` } }, /* @__PURE__ */ React.createElement("td", { style: { padding: "9px 14px", fontFamily: mono, fontSize: 11, color: C.faint } }, i + 1), /* @__PURE__ */ React.createElement("td", { style: { padding: "9px 14px", maxWidth: 185, wordBreak: "break-all", color: C.ink } }, row.raw), /* @__PURE__ */ React.createElement("td", { style: { padding: "9px 14px" } }, r ? /* @__PURE__ */ React.createElement(StatusDot, { status: r.status }) : /* @__PURE__ */ React.createElement("span", { style: { color: C.faint, fontSize: 11 } }, "\uB300\uAE30")), /* @__PURE__ */ React.createElement("td", { style: { padding: "9px 14px", maxWidth: 245, wordBreak: "break-all" } }, r?.status === "CONFIRMED" && /* @__PURE__ */ React.createElement("span", { style: { color: C.ink } }, r.jibunAddr), r?.status === "AMBIGUOUS" && /* @__PURE__ */ React.createElement("span", { style: { color: C.dim } }, r.message), r?.status === "FAILED" && /* @__PURE__ */ React.createElement("span", { style: { color: C.faint } }, r.message), r?.status === "VALIDATION_FAILED" && /* @__PURE__ */ React.createElement("span", { style: { color: C.warn } }, r.message)), /* @__PURE__ */ React.createElement("td", { style: { padding: "9px 14px", whiteSpace: "nowrap", fontFamily: mono, fontSize: 12, letterSpacing: "0.06em" } }, r?.pnu ? /* @__PURE__ */ React.createElement("span", null, /* @__PURE__ */ React.createElement("span", { style: { color: C.cyan } }, r.pnu.slice(0, 10)), /* @__PURE__ */ React.createElement("span", { style: { color: C.indigo } }, r.pnu.slice(10, 11)), /* @__PURE__ */ React.createElement("span", { style: { color: "#A78BFA" } }, r.pnu.slice(11, 15)), /* @__PURE__ */ React.createElement("span", { style: { color: "#67E8F9" } }, r.pnu.slice(15, 19))) : ""), /* @__PURE__ */ React.createElement("td", { style: { padding: "9px 14px", whiteSpace: "nowrap", fontFamily: mono, fontSize: 12 } }, row.reg?.status === "RESOLVED" && /* @__PURE__ */ React.createElement("span", { style: { color: C.ok, fontWeight: 700 } }, row.reg.unique_no), row.reg?.status === "MULTIPLE" && /* @__PURE__ */ React.createElement("span", { style: { color: C.warn } }, row.reg.candidates.length, "\uAC74"), row.reg && !["RESOLVED", "MULTIPLE"].includes(row.reg.status) && /* @__PURE__ */ React.createElement("span", { style: { color: C.err, fontSize: 11 } }, row.reg.status)));
  })))))))));
}

const _root = ReactDOM.createRoot(document.getElementById("root"));
_root.render(React.createElement(AddrRefineTestGui));
