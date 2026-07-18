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
  "\uAD11\uC8FC\uD1B5\uD569\uD2B9\uBCC4\uC2DC",
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
// 법정동 표기 동일성(2026-07-17): 같은 곳인데 표기만 다른 경우를 통과시킨다.
//   장전3동 ↔ 장전동    행정동 → 법정동
//   이도2동 ↔ 이도이동   숫자 ↔ 한글
//   문동리 ↔ 문동동     리 → 동 개편
//   대소면 ↔ 대소읍     면 → 읍 승격
//   양평동 ↔ 양평동2가   세부 구분
function sameBjd(x, y) {
  if (!x || !y) return false;
  const NUM = { "일": "1", "이": "2", "삼": "3", "사": "4", "오": "5",
                "육": "6", "칠": "7", "팔": "8", "구": "9", "십": "10" };
  const norm = (s) => {
    let t = String(s);
    for (const k in NUM) t = t.replace(new RegExp(k + "(?=동|가|$)", "g"), NUM[k]);
    return t.replace(/\d+/g, "").replace(/(동|리|가|읍|면)$/, "");
  };
  if (x === y) return true;
  const nx = norm(x), ny = norm(y);
  if (!nx || !ny) return false;
  return nx === ny;
}
function validateRegion(inputText, resultJibun, sidoOnly = false, relJibunText = "") {
  // 옛 시군구 현대화 후 비교(2026-07-15): 입력이 옛 주소(마산시)이고 결과가
  // 현행(창원시)이면 통폐합이라 정상인데도 불일치로 막히던 문제 해결.
  // 양쪽 다 현대화하면 마산시·창원시가 모두 창원시로 정규화돼 일치.
  const a = extractRegion(modernizeSgg(inputText || ""));
  const b = extractRegion(modernizeSgg(resultJibun || ""));
  const label = (r) => [r.sido, ...r.sgg, r.bjd].filter(Boolean).join(" ");
  const mk = (status, reason) => ({ status, reason, inputSgg: label(a), resultSgg: label(b) });
  if (a.sido && b.sido && a.sido !== b.sido) return mk("MISMATCH", `\uC2DC\uB3C4 \uBD88\uC77C\uCE58(${a.sido}\u2260${b.sido})`);
  // 시도만 검증(2026-07-15): 네이버(L4)가 원본 오류를 교정한 경우 — 부전타워
  // 원본 "만화리"→네이버 "교리"(실측), 당진군→당진시(승격) 등 — 시군구·법정동이
  // 달라도 네이버를 신뢰한다(네이버는 최종 판정 엔진). 단 시도(부산/충남)가
  // 다르면 진짜 오확정(경남→인천 실측)이므로 위에서 이미 차단됨.
  if (sidoOnly) {
    if (!a.sido || !b.sido) return mk("NOT_AVAILABLE", "\uC2DC\uB3C4 \uCD94\uCD9C \uBD88\uAC00");
    // 2026-07-17: 시도만 보고 통과시키면 서구 당하동 물건이 검단구 오류동으로
    // 확정되는 것을 막지 못한다(실측 89건). 법정동까지 본다.
    //   같음 · 표기 차이(장전3동=장전동) · 관련지번(relJibun)이면 통과, 그 외 차단
    if (!a.bjd || !b.bjd) return mk("MATCH", "\uC2DC\uB3C4 \uC77C\uCE58(\uBC95\uC815\uB3D9 \uCD94\uCD9C \uBD88\uAC00)");
    if (sameBjd(a.bjd, b.bjd)) return mk("MATCH", "\uC2DC\uB3C4\u00B7\uBC95\uC815\uB3D9 \uC77C\uCE58");
    if (relJibunText && String(relJibunText).includes(a.bjd))
      return mk("MATCH", "\uAD00\uB828\uC9C0\uBC88 \uC77C\uCE58");
    return mk("MISMATCH", `\uBC95\uC815\uB3D9 \uBD88\uC77C\uCE58(${a.bjd}\u2260${b.bjd})`);
  }
  if (a.sgg.length && b.sgg.length) {
    // 입력이 덜 구체적인 건 정상(성남시 ⊂ 성남시 분당구) — 어긋날 때만 불일치
    const n = Math.min(a.sgg.length, b.sgg.length);
    for (let i = 0; i < n; i++)
      if (a.sgg[i] !== b.sgg[i]) {
        // W2(2026-07-17): \uC2DC\uB3C4 \uAC19\uACE0 \uBC95\uC815\uB3D9 \uAC19\uC73C\uBA74 \uAC1C\uD3B8(\uC778\uCC9C \uC11C\uAD6C\u2192\uAC80\uB2E8\uAD6C \uB4F1). juso \uD604\uD589 \uC2DC\uAD70\uAD6C \uC2E0\uB8B0, \uD1B5\uACFC.
        if (a.sido === b.sido && a.bjd && b.bjd && a.bjd === b.bjd)
          return mk("MATCH", "\uC2DC\uAD70\uAD6C \uAC1C\uD3B8(\uC2DC\uB3C4\u00B7\uBC95\uC815\uB3D9 \uC77C\uCE58)");
        return mk("MISMATCH", `\uC2DC\uAD70\uAD6C \uBD88\uC77C\uCE58(${a.sgg[i]}\u2260${b.sgg[i]})`);
      }
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
  // R11(2026-07-17): 알파벳 동 표기 [A-Z]-[층]-[호].
  //   A-1-* : 101~108   A-2-* : 201~207   A-6-* : 603~608
  //   가운데 숫자가 뒤 숫자의 앞자리와 항상 일치한다(층 중복 표기).
  //   층이 일치할 때만 적용해 다른 구조를 잘못 해석하는 것을 막는다. 실측 81/81.
  const am = searchText.match(/^(.*?)\s*([A-Za-z])\s*-\s*(\d{1,2})\s*-\s*(\d{3,4})\s*$/);
  if (am && String(am[4])[0] === String(Number(am[3]))) {
    return { dong: am[2].toUpperCase(), ho: am[4], text: am[1].trim() };
  }
  // R12(2026-07-17): 건물명 뒤 3~4자리 연속 숫자는 호수(층+호)다.
  //   신세계블루타운 201~1219 · 서도아파트 101~1507 · 삼우목련 101~1304
  //   층별로 정렬되므로 동이 아니다(1219동은 존재할 수 없다).
  //   단 그 숫자가 확정 지번과 같으면 지번이다(반월동 382 남양아파트).
  //   단 뒤에 하이픈이 오면 동호 표기다(녹원맨션103-203) — R9 결과 보호.
  const bm = searchText.match(/^(.*?[가-힣A-Za-z]{2,})\s*(\d{3,4})\s*$/);
  if (bm && BUILDING_TOKEN.test(bm[1])) {
    return { dong: null, ho: bm[2], text: bm[1].trim() };
  }
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
const BUILDING_TOKEN = /(아파트|맨션|타운|오피스텔|빌라|빌리지|타워|하이츠|팰리스|캐슬|자이|푸르지오|리버|주공|연립|훼미리|하우스|시티|더샵|이편한|e편한|래미안|힐스|아이파크|드림빌|스타힐스|파크빌|파크|빌딩|프라자|플라자|파밀리에|스타힐스|해링턴|센트럴|센트레빌|엘크루|데시앙|꿈에그린|한신|현대|삼성|대우|롯데|쌍용|우성|경남|한도|금호|신동아|청도|상가|근린생활|근생|apt|APT|Apt|마을|그린빌|하이빌|힐사이드|르네상스|에버빌|피오레|유쉘|하임|하늘채|리슈빌|스위트|아너스빌|블루밍|메르디앙|어울림|휴먼시아|엘지|엘에이치|LH)/;
const ADMIN_DONG_RI = /^(.+?)(동|리)$/;   // 동/리로 끝나는 행정구역 토큰
const ADMIN_ANY = /(동|리|읍|면|가|구|시|군)$/;

function extractJibunCore(str) {
  // 노이즈 선제거(B): 쉼표 복수지번, 물결 범위, 말미 점, '외' 필지 표기
  let s = str
    .replace(/(\d+-\d+)\s*,\s*\d+-\d+/g, "$1")   // 233-67,233-82 → 233-67
    // R6(2026-07-17): 범위는 통째로 제거한다. 뒤만 지우면 범위 앞 숫자(200)가
    // 지번으로 남아 오확정된다(마전동 1~656 639 → 지번 1로 확정되어 금강타운·
    // 능내공원관리사무소로 감). 제거 후 남는 독립 지번이 대표지번이고,
    // 남는 지번이 없으면 건물명 경로로 자연히 넘어간다.
    //   마전동 657~900 685-1  →  마전동 685-1        지번 조회
    //   초읍동 300~500 초읍한신아파트  →  초읍동 + 건물명   건물명 조회
    .replace(/\d+\s*[~\u223c\u301c\uff5e]\s*\d+/g, " ")
    .replace(/(\d)\s*\.(?=\s|$)/g, "$1 ")          // 302-6. → 302-6
    // '외' 필지 표기 제거(2026-07-15): "외N필지"뿐 아니라 "외"만/"외3"도.
    // 지번 숫자 바로 뒤의 '외 [숫자] [필지]'를 통째로 제거한다.
    //   300외2필지 → 300 / 300외 → 300 / 300외3 → 300
    .replace(/(\d)\s*외\s*\d*\s*필?지?/g, "$1");
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

    // R1(2026-07-17): 행정구역 우선판정. BUILDING_TOKEN이 부분매칭이라
    // 지명(청도군·금호읍·삼성동·금호동)을 건물명으로 오인해 삭제하던 결함.
    //   시|군|구|읍|면 으로 끝나면 무조건 행정구역 (건물명이 이 접미사로 끝나는 사례 없음)
    //   동|리 로 끝나고 건물신호(상가·관리·주거·별관·본관·기타 또는 건물접미어)가
    //   없으면 행정구역. 상가동·제상가동·한라아파트1동은 건물로 남는다.
    const _forceAdmin = isAdminToken(t);

    // 건물명 토큰 — '시티'처럼 시(市)로 끝나는 건물명을 시군구보다 먼저 판정
    if (!_forceAdmin && BUILDING_TOKEN.test(t) && !/^\d/.test(t)) {
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
        if (seenDongRi.has(t)) { prevAdmin = true; lastAdminWasDongRi = true; continue; } // R4 같은 리 중복
        // R5 다른 리/동 연속(2026-07-15): "영천리 반촌리 420" 처럼 서로 다른
        // 리(동)가 연속으로 오면, 지번에 붙은 '뒤의 것'이 진짜 법정동이다.
        // 앞 것(직전 리/동)을 out에서 빼고 뒤 것으로 교체한다. 원본 데이터가
        // 옛 리와 현 리를 함께 적은 오염(실측 486건, 전부 집합건물).
        if (lastAdminWasDongRi && !hitBuilding && out.length > 0 &&
            ADMIN_DONG_RI.test(out[out.length - 1]) && out[out.length - 1] !== t) {
          seenDongRi.delete(out[out.length - 1]);
          out.pop();
        }
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

// W9(2026-07-17): 순수 토지 복수지번을 행 분리(매우 보수적). 집합건물(동호/건물명)은 분리 안 함.
// 안전장치: 동호·층·지하 없음 / 5자리+숫자(동호붙음) 제외 / 3단계 제외 /
//   동 2개 제외 / 부번 3자리+(동호의심) 제외 / 지번뒤 한글토큰(건물명) 제외.
// 복수세대 행분리(2026-07-17): 한 행에 세대가 둘 이상이면 세대별로 행을 나눈다.
//   ① "외 11호실"·"총 12호실"은 개수 표현이라 세대가 아니다
//   ② 뒤 세대가 앞 세대를 포함하면 층 중복 표기다(802 ⊂ 8802, 101동 ⊃ 1동).
//      같은 세대이므로 첫 세대만 채택하고 나누지 않는다
//   ③ 나머지는 별개 세대. 동·호만 다르고 나머지는 그대로 승계한다
function splitUnitsForBatch(raw) {
  const s = String(raw || "").replace(/외\s*\d+\s*호실?/g, " ").replace(/총\s*\d+\s*호실?/g, " ");
  const units = [];
  let m;
  const re = /(\d{1,4})\s*동\s*(\d{1,5})\s*호/g;
  while ((m = re.exec(s))) units.push([m[1], m[2]]);
  if (!units.length) {
    const re2 = /(?<![\d-])(\d{2,5})\s*호/g;
    while ((m = re2.exec(s))) units.push([null, m[1]]);
  }
  if (units.length < 2) return null;
  const f = units[0];
  const real = [f];
  for (const x of units.slice(1)) {
    const hoTypo = x[1] !== f[1] && (x[1].endsWith(f[1]) || f[1].endsWith(x[1]));
    const dongTypo = x[0] && f[0] && x[0] !== f[0] && (f[0].endsWith(x[0]) || x[0].endsWith(f[0]));
    if (hoTypo || dongTypo) continue;
    if (real.some((r) => r[0] === x[0] && r[1] === x[1])) continue;
    real.push(x);
  }
  return real.length >= 2 ? real : null;
}
function splitRowsForBatch(raw) {
  let s = raw.replace(/([가-훣]+구)\s+([가-훣]+동)\s+[가-훣]+시?\s*\1\s+\2/g, "$1 $2").replace(/\s+/g, " ").trim();
  const addrPart = s.replace(/\d+동|\d+호|\d+층|제\d+/g, "");
  if (!/(\d+(?:-\d+)?)\s*,\s*(\d+(?:-\d+)?)/.test(addrPart)) return [raw];
  if (/\d+동|\d+호|지하|지층|B\d/.test(s)) return [raw];
  if (/\d{5,}/.test(s) || /\d+-\d+-\d+/.test(s)) return [raw];
  const dongs = (s.match(/[가-훣]+동/g) || []).filter((d) => !/\d/.test(d));
  if ([...new Set(dongs)].length >= 2) return [raw];
  const m = s.match(/^(.*?[가-훣]+동)\s+([\d\-,\s]+?)(\s+.*)?$/);
  if (!m) return [raw];
  if (m[3] && /[가-훣]/.test(m[3])) return [raw];
  const jibuns = m[2].split(/[,，]/).map((x) => x.trim()).filter((x) => /^\d+-?\d*$/.test(x));
  if (jibuns.length <= 1) return [raw];
  if (jibuns.some((j) => { const p = j.split("-"); return p.length === 2 && p[1].length >= 3; })) return [raw];
  if (!jibuns.every((j) => /^\d{1,4}(-\d{1,2})?$/.test(j))) return [raw];
  return jibuns.map((j) => `${m[1]} ${j}`.replace(/\s+/g, " ").trim());
}
function preprocess(raw) {
  if (typeof raw !== "string" || raw.trim() === "")
    return { cleaned: "", searchText: "", unit: { dong: null, ho: null } };
  let s = toHalfWidth(raw);
  s = hanjaToHangul(s);
  s = s.replace(/[,·.]/g, " ");
  s = s.replace(/(\d)\s*의\s*(\d)/g, "$1-$2");
  s = s.replace(/[()[\]{}]/g, " ");
  // R6(2026-07-17): 범위 제거는 허용문자 필터보다 먼저 해야 한다. 필터가 물결을
  // 공백으로 바꾸면 "657~900"이 "657 900"이 되어 범위인지 알 수 없다.
  // 범위 앞 숫자를 지번으로 남기면 오확정된다(마전동 1~656 639 → 지번 1로 확정,
  // 금강타운·능내공원관리사무소로 감). 통째로 지우면 뒤의 진짜 지번이 대표가 되고,
  // 남는 지번이 없으면 건물명 경로로 자연히 넘어간다.
  s = s.replace(/\d+\s*[~\u223C\u301C\uFF5E]\s*\d+/g, " ");
  s = s.replace(/[^\uAC00-\uD7A3a-zA-Z0-9\s\-/]/g, " ");
  s = stripSuffixes(s);
  // W5(2026-07-17): \uc2dc\uad70\uad6c+\ub3d9 \uc644\uc804\ubc18\ubcf5 \uc624\uc5fc \uc81c\uac70(\uc9c4\uc8fc\uc2dc \uce60\uc554\ub3d9 x2 \u2192 x1). \uc720\ud6151\ub9cc.
  s = s.replace(/([가-훣]+(?:시|군|구))\s+([가-훣]+(?:동|리))\s+\1\s+\2/g, "$1 $2");
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
    } else if (!jibun && core && /[가-힣]+(동|리|읍|면)(\s|$)/.test(core)) {
      // 지번은 없지만 core에 '동/리/읍/면'이 온전히 남은 경우(건물명·상가·동호가
      // 앞서 절단됨). 원본을 그대로 쓰면 '상가'·건물명 잔존물이 juso를 방해하므로
      // core(행정구역까지)로 교체한다. 단 시/군/구만 남은 건 너무 넓어 제외.
      text = core;
    }
  }
    // \ubd80\uac1c\ub3d9\ub958(2026-07-17): \uc27c\ud45c \ub4a4 'N-M'(M 3\uc790\ub9ac+ \ud638 \ub0c4\uc0c8)\uc744 \ub3d9\ud638 \ud6c4\ubcf4\ub85c \ubcf4\uad00.
  // \uba85\uc2dc\uc801 \ub3d9\ud638(dong) \uc5c6\uc744 \ub54c\ub9cc. cascade/resolve\uac00 juso detBdNmList\ub85c \uac80\uc99d\ud574 \ud655\uc815.
  let unitCandidate = null;
  if (!dong && !ho) {
    const uc = raw.match(/,\s*(\d{1,4})-(\d{3,4})(?!\d)/);
    if (uc) unitCandidate = { dong: uc[1], ho: uc[2] };
  }
  // 전처리 구조화(2026-07-17): 조회어를 문자열에서 빼서 만들지 않고
  // 요소별 필드로 분해해 반환한다. 어느 필드가 채워졌는가가 곳 주소 구성이다.
  // cleaned·searchText는 기존 호출부 호환을 위해 유지한다.
  const _reg = extractRegion(modernizeSgg(raw));
  const _se = extractSggEmd(raw);
  const _er = extractEupRi(raw);
  const _rd = extractRoadNo(raw);
  const _jc = extractJibunCore(text);
  return {
    cleaned, searchText: text, unit: { dong, ho }, unitCandidate, raw,
    sido: _reg.sido || "",
    sidoFull: sidoFull(raw),
    sgg: (_reg.sgg && _reg.sgg.length) ? _reg.sgg.join(" ") : (_se.sgg || ""),
    eup: _er.eup || "",
    emd: _er.emd || _se.emd || "",
    emdCands: _er.emdCands && _er.emdCands.length ? _er.emdCands : (_se.emd ? [_se.emd] : []),
    jibun: _jc.jibun || "",
    road: _rd.road,
    buldNo: _rd.buldNo,
    bldName: extractBuildingName(raw)
  };
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
    detBdNmList: item.detBdNmList ?? "",   // 동 목록(부개동류 동호 검증용)
    relJibun: item.relJibun ?? "",         // 관련지번(어달동류 옛/현 지번 연결)
    pnuOk: true,   // juso에서 왔으므로 PNU 확보 가능
    // juso bdKdcd: "1"=공동주택(아파트·연립·다세대), "0"=일반건물
    isJip: item.bdKdcd === "1" || /아파트|빌라|연립|다세대|오피스텔|맨션|타운|팰리스|캐슬|자이|힐스|푸르지오/.test(item.bdNm ?? ""),
    source: "juso"
  };
}
// 네이버 지역검색 결과 → 후보 형식 (2026-07-15)
// 네이버는 PNU를 안 주므로 주소 정보만 담는다. PNU 확보는 이 주소를 juso에
// 재조회할 때만 된다. 여기서 만든 후보는 'PNU 미확보'(pnuOk:false) 상태.
const naverCache = new Map();

function fromNaver(item, naverAddr) {
  // 네이버 지번주소(address)에서 시군구/동/지번을 추출해 최대한 채운다.
  const addr = naverAddr || item.address || item.roadAddress || "";
  return {
    admCd: null,                 // 법정동코드 미상(juso 재확정에서만 확보)
    mtYn: "0",
    mnnm: null,
    slno: "0",
    roadAddr: item.roadAddress || null,
    jibunAddr: item.address || naverAddr || null,   // 네이버 지번주소
    bdMgtSn: null,
    bdNm: item.title || "",
    source: "naver",
    pnuOk: false,                // PNU 미확보(주소는 정상)
    naverAddr: addr,
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
// 옛 시군구 → 현재 시군구 (2026-07-15, 실측 3건 + 여유분)
// 검색 '전에' 원본 주소를 현대화한다(교차검증 예외가 아니라 사전 변환).
// 실데이터: 청원군159 진해시62 마산시51 + 소수. 나머지 통폐합은 실데이터에 없음.
const OLD_SGG_MODERNIZE = [
  [/마산시/g, "창원시"], [/진해시/g, "창원시"], [/창원시\s+창원시/g, "창원시"],
  [/청원군/g, "청주시"],
  [/여천시/g, "여수시"], [/여천군/g, "여수시"],
  [/삼천포시/g, "사천시"], [/충무시/g, "통영시"], [/장승포시/g, "거제시"],
  [/이리시/g, "익산시"], [/동광양시/g, "광양시"],
  // 광주+전남 통합 → 광주통합특별시(2026 개편, juso 반영). 옛 표기와 juso의
  // '전남광주통합특별시' 붙임표기를 모두 하나의 시도명으로 통일해 교차검증이
  // 통과되게 한다. '광주통합특별시'를 표준으로.
  [/전\s*남\s*광주통합특별시/g, "광주통합특별시"],
  [/광주광역시/g, "광주통합특별시"],
  [/전라남도/g, "광주통합특별시"],
  [/(^|\s)광주(?=\s)/g, " 광주통합특별시"],
  [/(^|\s)전남(?=\s)/g, " 광주통합특별시"],
  [/광주통합특별시\s+광주통합특별시/g, "광주통합특별시"],
];
function modernizeSgg(addr) {
  let s = addr || "";
  for (const [re, to] of OLD_SGG_MODERNIZE) s = s.replace(re, to);
  return s.replace(/\s+/g, " ").trim();
}

// 네이버 검색용 건물명 추출(2026-07-15 재작성): 토큰 매칭이 아니라
// '행정구역·지번·동호·노이즈를 제거하고 남는 것'을 건물명으로 본다.
// 토큰 방식은 (1)토큰 없는 아파트명(혜창한마음비치) 누락 (2)"경남"(경상남도
// 약자)을 브랜드로 오인하는 문제가 있었다.
// "경남 마산시 진동면 393-2 혜창한마음비치 상가동 101호" → "혜창한마음비치"
// R1(2026-07-17): 행정구역 우선판정. BUILDING_TOKEN이 부분매칭이라 지명
// (청도군·금호읍·삼성동·금호동)을 건물명으로 오인해 삭제하던 결함을 막는다.
//   시|군|구|읍|면 으로 끝나면 무조건 행정구역 (건물명이 이 접미사로 끝나는 사례 없음)
//   동|리 로 끝나고 건물신호가 없으면 행정구역. 상가동·한라아파트1동은 건물로 남는다.
function isAdminToken(t) {
  if (!t || /^\d/.test(t)) return false;
  if (/(시|군|구|읍|면)$/.test(t)) return true;
  if (!/(동|리)$/.test(t)) return false;
  const bldSignal = /(상가|관리|주거|별관|본관|기타)/.test(t) ||
    /(아파트|맨션|타운|빌라|빌리지|타워|하이츠|팰리스|캐슬|자이|푸르지오|주공|연립|훼미리|하우스|시티|더샵|래미안|힐스|아이파크|파크|빌딩|프라자|플라자|파밀리에|해링턴|센트럴|센트레빌|엘크루|데시앙)/.test(t);
  return !bldSignal;
}
function extractBuildingName(raw) {
  if (!raw) return "";
  // R3(2026-07-17): 괄호를 버리기 전에 건물명 후보를 회수한다. 도로명 표준형식
  // "삼산로 92-50 (용당동, 용당피오레아파트)"는 건물명이 괄호 안에 있다.
  let fromParen = "";
  const pm = String(raw).match(/\(([^)]*)\)/);
  if (pm) {
    for (const part of pm[1].split(/[,·]/).map((x) => x.trim())) {
      if (!part) continue;
      if (/(동|리)$/.test(part) && !BUILDING_TOKEN.test(part)) continue;   // 법정동 제외
      if (BUILDING_TOKEN.test(part) || part.length >= 4) { fromParen = part; break; }
    }
  }
  let s = String(raw).replace(/\([^)]*\)/g, " ").replace(/[,·]/g, " ")
    // 시도 약자를 먼저 제거(경남·경북 등이 '경남아파트' 브랜드로 오인되는 것 방지).
    // 단 뒤에 바로 다른 글자가 붙은 '경남아너스빌'은 안 지워지게 공백 경계 사용.
    .replace(/(^|\s)(경남|경북|전남|전북|충남|충북|강원|경기|제주)(?=\s)/g, " ")
    .replace(/\s+/g, " ").trim();
  const words = s.split(" ").filter(Boolean);
  // 1순위: 건물명 토큰(래미안·타워·아파트 등)이 든 단어를 직접 찾는다.
  // 이 단어는 '리/동'으로 끝나도(원베일리) 건물명이므로 행정구역 제거 대상이 아님.
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    if (!isAdminToken(w) && BUILDING_TOKEN.test(w) && !/^\d/.test(w)) {
      const name = w.replace(/제?\d.*$/, "").replace(/제$/, "");   // 뒤 숫자(101동·제101동) 제거
      const prev = i > 0 ? words[i - 1] : "";
      // 앞 단어가 행정구역/지번/동호가 아니면 건물명의 일부로 포함
      // 앞 단어를 붙일 조건: 숫자가 전혀 없고, 행정구역·동호 표기가 아니어야 한다.
      // (^\d 만 보면 "문동리238"·"내성리159-1"이 통과해 지번을 끌고 온다)
      if (prev && !/\d/.test(prev) && !isAdminToken(prev) &&
          !/(시|군|구|읍|면|동|리|가)$/.test(prev) && !/[동호층]$/.test(prev)) {
        return (prev + " " + name).trim();
      }
      return name.trim();
    }
  }
  // 2순위: 괄호에서 회수한 건물명 후보
  if (fromParen) return fromParen.replace(/\d.*$/, "").trim();
  // 3순위: 행정구역·도로명·지번·동호를 지우고 남는 최장 토큰
  //   R2: [동호층] 제거에 숫자와 경계를 요구한다. 경계가 없으면 "문동리"의
  //       가운데 '동'이 지워져 "문 리"가 되고, 그 잔재가 건물명으로 채택됐다.
  //   R3: 앞 2단어를 무조건 취하지 않는다. 잔재("경남 문동리")가 그럴듯한
  //       오답이 되므로, 남은 것 중 가장 긴 토큰을 고른다.
  s = s
    .replace(/(경남|경북|전남|전북|충남|충북|강원|경기|제주)(?=\s|$)/g, " ")
    // 앞 경계 필수: 없으면 "해운대구"의 '대구'가 광역시로 지워져 "해운"이 잔재로 남는다
    .replace(/(^|\s)(서울|부산|대구|인천|광주|대전|울산|세종)(특별시|광역시|특별자치시)?(?=\s|$)/g, " ")
    .replace(/[가-힣]+(특별시|광역시|특별자치도|도)(?=\s|$)/g, " ")
    .replace(/[가-힣]+\d*번?[로길](?=\s|$)/g, " ")
    .replace(/[가-힣]+(시|군|구|읍|면|동|리|가)(?=\s|$)/g, " ")
    .replace(/\d+(-\d+)?\s*(외\s*\d*\s*필?지?)?/g, " ")
    .replace(/제?\s*\d+\s*[동호층](?=\s|$)/g, " ")
    // 동소(同所)는 등기부에서 "위와 같은 장소"를 뜻하는 참조어다. 지명도 건물명도 아니다.
    .replace(/상가|지하|대지권없음|번지|호실|필지|동소/g, " ")
    .replace(/\s+/g, " ").trim();
  // 한글이 없는 잔재(A-, B- 등)는 건물명이 아니다
  const toks = s.split(" ").filter((t) => t.length >= 2 && /[가-힣]/.test(t));
  if (!toks.length) return "";
  return toks.sort((a, b) => b.length - a.length)[0];
}

// 시군구·읍면동 추출(현대화 후): 캐시키·검색어 조합용
// 도로명·건물번호 추출(2026-07-17): 전처리 구조화. 조회어를 빼서 만들지 않고
// 필드에서 조립하기 위해 도로명과 건물번호를 별도 필드로 분리한다.
// 읍면·리 분리 추출(2026-07-17): 지번은 리에 붙으므로 읍면과 리를 모두 보존해야
// juso 조회가 성립한다. extractSggEmd는 읍면에서 멈춰 리를 놓친다.
// 시도 원형(2026-07-17): extractRegion은 축약형(광주통합·경기)을 준다.
// juso 조회어에는 juso가 아는 이름이 필요하다. 동명 시군구(동구·서구·중구 등
// 6개)가 있어 시도를 빼면 모호해지므로, 원문에서 원형을 뽑아 쓴다.
function sidoFull(addr) {
  // 원문의 시도를 그대로 쓴다. juso는 옛 이름으로 조회해도 찾아주고 결과는
  // 현재 이름으로 돌려준다(실측: "광주광역시 광산구 송정동 266" 조회 →
  // "전남광주통합특별시 광산구 송정동 266" 반환).
  // modernizeSgg는 쓰면 안 된다. 그것이 만드는 "광주통합특별시"는 juso에 없어
  // 조회가 통째로 실패한다(실측 0건, 1,064건 이탈).
  const s = String(addr || "");
  const m = s.match(/([\uAC00-\uD7A3]{2,8}(?:\uD2B9\uBCC4\uC2DC|\uAD11\uC5ED\uC2DC|\uD2B9\uBCC4\uC790\uCE58\uC2DC|\uD2B9\uBCC4\uC790\uCE58\uB3C4|\uB3C4))(?=\s|$)/);
  if (m) return m[1];
  const SHORT = { "서울": "서울특별시", "부산": "부산광역시", "대구": "대구광역시",
    "인천": "인천광역시", "대전": "대전광역시", "울산": "울산광역시", "광주": "광주광역시",
    "세종": "세종특별자치시", "경기": "경기도", "강원": "강원특별자치도",
    "충북": "충청북도", "충남": "충청남도", "전북": "전북특별자치도", "전남": "전라남도",
    "경북": "경상북도", "경남": "경상남도", "제주": "제주특별자치도" };
  const k = Object.keys(SHORT).find((x) => s.startsWith(x));
  return k ? SHORT[k] : "";
}


function extractEupRi(addr) {
  const s = modernizeSgg(addr || "");
  const eup = (s.match(/([\uAC00-\uD7A3]{1,6}(?:\uC74D|\uBA74))(?=\s|\d|$)/) || [])[1] || "";
  // 지번 바로 앞의 동/리/가를 1순위로 택한다. 리가 둘이면 뒤가 진짜인 경우가 많다.
  //   인주면 신성리 공세리 274-1  →  공세리 (juso 실측 1건)
  // 다만 항상 그렇지는 않으므로 앞 리도 후보로 남겨 조회 폴백에 쓴다.
  const cands = [];
  const near = s.match(/[\uAC00-\uD7A3]{1,6}\d?(?:\uB3D9|\uB9AC|\uAC00)\s*(?=\d)/g);
  if (near && near.length) cands.push(near[near.length - 1].trim());
  const all = s.match(/[\uAC00-\uD7A3]{1,6}\d?(?:\uB3D9|\uB9AC|\uAC00)(?=\s|\d|$)/g) || [];
  for (const x of all) if (!cands.includes(x)) cands.push(x);
  if (!cands.length && eup) {
    const after = s.slice(s.indexOf(eup) + eup.length);
    const m2 = (after.match(/([\uAC00-\uD7A3]{1,6}(?:\uB9AC|\uB3D9))(?=\s|\d|$)/) || [])[1];
    if (m2) cands.push(m2);
  }
  // 행정동(도곡1동) → 법정동(도곡동)
  const norm = (x) => { const m = x.match(/^([\uAC00-\uD7A3]+)\d+(\uB3D9)$/); return m ? m[1] + m[2] : x; };
  const list = [...new Set(cands.map(norm))];
  return { eup, emd: list[0] || "", emdCands: list };
}


// N번길·N길은 도로명의 일부다(문장로22길을 문장로+22로 쪠개면 안 됨).
function extractRoadNo(raw) {
  const s = String(raw || "").replace(/\([^)]*\)/g, " ").replace(/[,\u00b7]/g, " ")
    .replace(/\s+/g, " ").trim();
  const m = s.match(/([\uac00-\ud7a3]{2,}(?:\d+)?[\ub85c\uae38](?:\d+\ubc88?\uae38)?)\s*(\d{1,5}(?:-\d{1,4})?)(?!\d)/);
  if (!m) return { road: "", buldNo: "" };
  return { road: m[1], buldNo: m[2] };
}
function extractSggEmd(addr) {
  const s = modernizeSgg(addr || "");
  const sgg = (s.match(/([가-힣]+(?:시|군|구))/) || [])[1] || "";
  let emd = (s.match(/([가-힣]+(?:읍|면|동))(?=\s|\d|$)/) || [])[1] || "";
  // W11(2026-07-17): 행정동(도곡1동=한글+숫자+동)을 법정동(도곡동)으로. 숫자 떼어 추출.
  if (!emd) { const m = s.match(/([가-힣]+)\d+(동)/); if (m) emd = m[1] + m[2]; }
  // 괄호 안 법정동 ((방어동), (중동,대길이룸)) 추출
  if (!emd) { const p = s.match(/[（(]([가-힣]+(?:동|리|읍|면))[,，)）]/); if (p) emd = p[1]; }
  return { sgg, emd };
}

// 우편번호 복구(2026-07-17): 시군구 없는 주소를 구우편번호(6자리)로 지역 복구.
// 무결성: 단일매핑만(다중매핑 16개 제외됨) + 6자리 완전일치만. CSV에 없으면 복구 안 함.
let _zipMap = null;   // { regions: [...], map: {우편번호: 지역인덱스} }
async function loadZipMap() {
  if (_zipMap !== null) return _zipMap;
  try {
    const res = await fetch("/zipmap.json");
    if (!res.ok) { _zipMap = { regions: [], map: {} }; return _zipMap; }
    _zipMap = await res.json();
  } catch { _zipMap = { regions: [], map: {} }; }
  return _zipMap;
}
function lookupZip(zipcode) {
  // 반환: ["시도|시군구", ...] 후보 배열(다중매핑=인접지역, 순환조회 대상) / 없음: []
  // 문자열로 받아 앞0 보존, 6자리 완전일치만.
  if (!_zipMap || !zipcode) return [];
  const z = String(zipcode).replace(/\.\d+$/, "").replace(/[^0-9]/g, "");   // 소수점 이하 먼저 제거(엑셀 480050.0)
  if (z.length !== 6) return [];   // 6자리 구우편번호만
  const idxs = _zipMap.map[z];
  if (idxs === undefined) return [];
  // 하위호환: 옛 포맷(단일 숫자)이면 배열로 감쌈
  const arr = Array.isArray(idxs) ? idxs : [idxs];
  return arr.map((i) => _zipMap.regions[i]).filter(Boolean);   // ["경기도|의정부시", ...]
}
// 네이버 후보 검증(2026-07-17): 첫 결과 맹신 금지. category·제목·지번·지역으로
// 점수화해 최적 후보 선택. 검증 정보(시군구·지번) 부족시 확정 안 함(검토필요).
// 실측 근거: "신도아파트" 검색 첫결과=신도그랑피아(타건물), 진짜는 3번째.
function pickNaverCandidate(items, origRaw, bldName, zipRegions) {
  const a = extractRegion(modernizeSgg(origRaw || ""));
  const origSido = a.sido, origSgg = a.sgg[0];
  const origJibun = ((origRaw || "").match(/([가-훣]+동)\s*(\d{1,4}-?\d*)/) || [])[2];
  const isAptOrig = /아파트|빌라|맨션|연립|다세대|오피스텔|주공|@/.test(origRaw + (bldName || ""));
  function score(item) {
    let sc = 0; const rs = [];
    const addr = item.address || "", cat = item.category || "", title = item.title || "";
    if (isAptOrig) {
      if (/주택|아파트|빌라|연립|다세대|오피스텔/.test(cat)) sc += 20;
      else if (/음식|카페|편의점|중개|병원|학원|은행|마트|상가|주차/.test(cat)) { sc -= 100; rs.push("비주거"); }
    }
    if (bldName) {
      const nb = bldName.replace(/아파트|apt/gi, "").trim();
      const nt = title.replace(/아파트|apt/gi, "").trim();
      if (nt === nb) { sc += 40; rs.push("제목정확"); }
      else if (nb && (title.includes(nb) || nb.includes(nt))) sc += 15;
      else { sc -= 20; rs.push("제목불일치"); }
    }
    const cj = (addr.match(/([가-훣]+동)\s*(\d{1,4}-?\d*)/) || [])[2];
    if (origJibun && cj) { if (origJibun === cj) { sc += 50; rs.push("지번일치"); } else { sc -= 50; rs.push("지번불일치"); } }
    const b = extractRegion(modernizeSgg(addr));
    if (origSido && b.sido) { if (origSido === b.sido) sc += 30; else { sc -= 100; rs.push("시도불일치"); } }
    if (origSgg && b.sgg[0] && origSgg === b.sgg[0]) sc += 20;
    return { sc, rs, item };
  }
  const scored = items.map(score).sort((x, y) => y.sc - x.sc);
  const top = scored[0];
  const topRegion = extractRegion(modernizeSgg(top.item.address || ""));
  const topSido = topRegion.sido;
  // 지역 검증: 원문 시도 일치 or (원문 시도 없으면) 우편번호 복구지역과 시군구 일치
  let hasRegionCheck = !!(origSido && topSido === origSido);
  if (!hasRegionCheck && (!origSido) && Array.isArray(zipRegions) && zipRegions.length > 0) {
    // 우편번호 복구지역(들) 중 하나라도 후보의 시도·시군구와 일치하면 검증 통과(인접지역 순환)
    const topSgg = topRegion.sgg[0] || "";
    hasRegionCheck = zipRegions.some((zr) => {
      const [zsido, zsgg] = zr.split("|");
      return zsido === topSido && (!zsgg || !topSgg || zsgg === topSgg || zsgg.includes(topSgg) || topSgg.includes(zsgg));
    });
  }
  const strong = top.rs.includes("지번일치") || top.rs.includes("제목정확");
  const gap = scored.length < 2 || (top.sc - scored[1].sc >= 20);
  const confident = hasRegionCheck && strong && gap && top.sc > 0;
  return { picked: top.item, confident, reason: top.rs.join(",") };
}
async function cascade(pre, clients) {
  const { cleaned, searchText } = pre;
  // jusoQuery: juso에 '실제로' 전달된 문자열(진단용). 전처리가 주소를 깨뜨렸는지
  // 원문과 나란히 봐야 판별 가능하므로 결과지에 그대로 남긴다.
  const tried = [cleaned];
  // W1\uc635\uc158B(2026-07-17): \uc9c0\ubc88\uc5c6\uc74c(\ub3d9/\ub9ac\uc11c \ub05d)+\uc9c4\uc9dc \uac74\ubb3c\uba85\uc774\uba74 juso\ub294 \ubabb \uc881\ud798. \ub124\uc774\ubc84 L3\ub85c \uac74\ubb3c\uba85 \uc870\ud68c\u2192\uc9c0\ubc88\ud655\ubcf4.
  const _stTrim = (searchText || "").trim();
  const _noJibun = /[\uac00-\ud7a3]+(\ub3d9|\ub9ac|\uc74d|\uba74)$/.test(_stTrim);
  const _realBld = /(\uc544\ud30c\ud2b8|\ub9e8\uc158|\ube4c\ub77c|\ube4c\ub9ac\uc9c0|\ud0c0\uc6cc|\ud30c\ud06c|\uc8fc\uacf5|\uc790\uc774|\uce90\uc2ac|\ud0c0\uc6b4|\ud558\uc774\uce20|\ud330\ub9ac\uc2a4|\ud790\uc2a4|\ud558\uc784|\ud558\ub298\ucc44|e\ud3b8\ud55c|\ud478\ub974\uc9c0\uc624|\ub798\ubbf8\uc548|\uc544\uc774\ud30c\ud06c|\ub354\uc0f5|\ub9ac\uc288\ube4c|\uc2a4\uc704\ud2b8|\ub974\ub124\uc0c1\uc2a4)/i.test(pre.raw || cleaned);
  const _isRoad = /[\uac00-\ud7a3]+(\ub85c|\uae38)\s*\d/.test(pre.raw || cleaned);
  const bldNameForGate = extractBuildingName(pre.raw || cleaned);
  const skipJuso = _noJibun && _realBld && !_isRoad;
  // \uc804\ucc98\ub9ac \uad6c\uc870\ud654(2026-07-17): \uc870\ud68c\uc5b4\ub97c \uc6d0\ubb38\uc5d0\uc11c \ube7c\uc9c0 \uc54a\uace0 \ud544\ub4dc\uc5d0\uc11c \uc870\ub9bd\ud55c\ub2e4.
  // \ub123\uc9c0 \uc54a\uc740 \uac83\uc740 \uc560\ucd08\uc5d0 \ub4e4\uc5b4\uac08 \uc218 \uc5c6\uc73c\ubbc0\ub85c \uac74\ubb3c\uba85\u00b7\ub3d9\ud638 \uc794\uc7ac \uc81c\uac70 \uaddc\uce59\uc774 \ud544\uc694 \uc5c6\ub2e4.
  // \uc21c\uc11c: \ub3c4\ub85c\uba85 \u2192 \uc9c0\ubc88 \u2192 (\ub458 \ub2e4 \uc5c6\uac70\ub098 \uc2e4\ud328) \ub124\uc774\ubc84 \uac74\ubb3c\uba85
  // 시도는 조회어에 넣지 않는다. extractRegion이 축약형(광주통합)을 주는데
  // juso에 없는 이름이라 조회가 통째로 실패한다(실측 1,064건 이탈).
  // 시군구+법정동+지번이면 juso가 충분히 특정한다.
  const _head = [pre.sidoFull, pre.sgg].filter(Boolean).join(" ");
  const roadQuery = (pre.road && pre.buldNo) ? [_head, pre.road, pre.buldNo].filter(Boolean).join(" ") : "";
  const jibunQuery = pre.jibun ? [_head, pre.eup, pre.emd, pre.jibun].filter(Boolean).join(" ") : "";
  let items = [];
  if (!skipJuso) {
    if (roadQuery) {
      tried.push(roadQuery);
      items = await safeCall(clients.juso, roadQuery);
      if (items.length > 0)
        return { candidates: items.map(fromJuso), level: "R1", jusoQuery: tried.join(" \u25B8 "), count: items.length };
    }
    if (jibunQuery) {
      // 요소를 줄여가며 재시도한다. 읍면·리가 개편·폐지된 곳은 전체 조합으로는
      // 못 찾는다(신현읍 문동리 → 문동동으로 개편, 실측 0건).
      //   1차 시도+시군구+읍면+리+지번   2차 시군구+리+지번   3차 시군구+지번
      // 리가 둘이면 어느 쪽에 지번이 붙는지 원문만으로는 알 수 없다.
      //   인주면 신성리 공세리 274-1  →  공세리가 정답(juso 실측)
      // 반대인 경우도 있으므로 후보를 순서대로 모두 시도한다.
      // 리는 항상 남긴다. 리까지 빼면 다른 지번이 걸린다(거제시 238).
      const _tries = [];
      const _cands = (pre.emdCands && pre.emdCands.length) ? pre.emdCands : [pre.emd].filter(Boolean);
      for (const em of _cands)
        _tries.push([pre.sidoFull, pre.sgg, pre.eup, em, pre.jibun].filter(Boolean).join(" "));
      const _primaryCount = _tries.length;   // 읍면 포함 형태의 개수
      for (const em of _cands)
        if (pre.eup) _tries.push([pre.sgg, em, pre.jibun].filter(Boolean).join(" "));
      // 리가 둘이면 첫 성공에서 멈추지 않고 둘 다 조회한다. 멈추면 다른 리에도
      // 결과가 있는지 알 수 없어 모호한 건을 확정해 버린다(우편번호 다중매핑과 같은 이유).
      //   한쪽만 결과  →  그것으로 확정
      //   양쪽 다 결과 →  후보를 합쳐 resolve가 판정(PNU 같으면 확정, 다르면 AMBIGUOUS)
      const _multiRi = _cands.length >= 2;
      const _collected = [];
      for (let i = 0; i < _tries.length; i++) {
        const q = _tries[i];
        // 읍면 포함 형태를 다 돌아 결과를 얻었으면 읍면 뗀 형태는 시도하지 않는다
        if (i >= _primaryCount && _collected.length) break;
        if (tried.includes(q)) continue;
        tried.push(q);
        items = await safeCall(clients.juso, q);
        if (!items.length) continue;
        if (!_multiRi)
          return { candidates: items.map(fromJuso), level: "J1", jusoQuery: tried.join(" \u25B8 "), count: items.length };
        _collected.push(...items);
      }
      if (_collected.length) {
        const seen = new Set();
        const uniq = _collected.filter((x) => {
          const k = (x.admCd || "") + "|" + (x.lnbrMnnm || "") + "|" + (x.lnbrSlno || "") + "|" + (x.bdMgtSn || "");
          if (seen.has(k)) return false;
          seen.add(k); return true;
        });
        return { candidates: uniq.map(fromJuso), level: "J1", jusoQuery: tried.join(" \u25B8 "), count: uniq.length };
      }
    }
    // 구성을 못 뽑았고 건물명도 없을 때만 기존 방식(원문·지번코어)으로 폴백한다.
    // 지번·도로명이 없는데 juso를 부르면 그 법정동의 아무 주소나 돌아와 무의미하다.
    // 건물명이 있으면 네이버로 가는 것이 맞다(초읍한신아파트·클래시움아파트).
    if (!roadQuery && !jibunQuery && !bldNameForGate) {
      items = await safeCall(clients.juso, cleaned);
      // R10: 숫자 없는 검색어의 복수 결과는 채택하지 않는다(그 법정동의 아무 주소)
      const _noNumL1 = !/\d/.test(cleaned);
      if (items.length > 0 && !(_noNumL1 && items.length > 1))
        return { candidates: items.map(fromJuso), level: "L1", jusoQuery: tried.join(" \u25B8 "), count: items.length };
      if (searchText && searchText !== cleaned) {
        tried.push(searchText);
        items = await safeCall(clients.juso, searchText);
        // R10(2026-07-17): 검색어에 숫자가 전혀 없으면 juso는 그 법정동의 아무 주소나
        // 돌려준다. 결과가 복수면 채택하지 않고 다음 경로(네이버·전파)로 보낸다.
        // 단일 확정은 유지한다 — juso가 지구명으로 정확히 찾아주는 경우가 있다
        // (정왕동 시화지구 → 정왕동 1873-2 영남아파트).
        const _noNum = !/\d/.test(searchText);
        if (items.length > 0 && !(_noNum && items.length > 1))
          return { candidates: items.map(fromJuso), level: "L2", jusoQuery: tried.join(" \u25B8 "), count: items.length };
      }
    }
  }
  // 카카오(구 L3) 제거(2026-07-15): 카카오맵/로컬 API가 유료로 전환되어
  // (비즈월렛·결제카드·월 청구 필요) 회사 툴에 부적합. 네이버 지역검색이
  // 무료(월 77.5만)로 동일한 건물명 검색을 하고 옛주소 교정력이 더 강함이
  // 실측됨(부전타워 만화리→교리, 혜창 마산→창원). 카카오 고유 이점이던
  // b_code(행정동코드)도 juso를 무조건 거치므로 불필요.
  // ── L3: 네이버 지역검색 (2026-07-15, 구 L4에서 승격) ──────────────
  // juso 실패 + 건물명 있을 때. 네이버를 '최종 정상주소 판정 엔진'으로 사용:
  // 네이버가 주소를 주면 그걸 정상주소로 채택하고, juso는 PNU 확보 목적으로만
  // 재조회한다(주소 판정과 PNU 확보 분리).
  if (clients.naverLocal) {
    const bldName = extractBuildingName(pre.raw || cleaned);
    if (bldName) {
      let { sgg, emd } = extractSggEmd(pre.raw || cleaned);
      // \uc6b0\ud3b8\ubc88\ud638 \ubcf5\uad6c(2026-07-17): \uc2dc\uad70\uad6c \uc5c6\uc73c\uba74 \uc6b0\ud3b8\ubc88\ud638\ub85c \uc9c0\uc5ed \ubcf5\uad6c(\ubb34\uacb0\uc131: \ub2e8\uc77c\ub9e4\ud551\u00b76\uc790\ub9ac\ub9cc).
      // \ubcf5\uad6c \uc2dc\uad70\uad6c\ub97c \ub124\uc774\ubc84 \uac80\uc0c9 \ubb38\ub9e5\uc5d0 \uc0ac\uc6a9. \uc6d0\ubb38\uc5d0 \uc2dc\uad70\uad6c \uc788\uc73c\uba74 \uc548 \uc500(\uc6d0\ubb38 \uc6b0\uc120).
      // \ubcf5\uad6c \uc9c0\uc5ed\uc740 \uac80\uc0c9\ubc94\uc704\uc77c \ubfd0 \ucd5c\uc885\uc8fc\uc18c \uc544\ub2d8. \ub124\uc774\ubc84 \uacb0\uacfc\uc640 \ub300\uc870\ub294 \ud6c4\ubcf4\uac80\uc99d\uc5d0\uc11c.
      // 우편번호 복구 후보(다중매핑=인접지역 순환조회). 시군구 없을 때만.
      let zipSggList = [];
      let zipRegions = [];   // ["시도|시군구", ...] 후보검증 지역대조용
      if (!sgg && pre?.zipcode) {
        zipRegions = lookupZip(pre.zipcode);   // ["경기도|의정부시", ...]
        zipSggList = zipRegions.map((zr) => (zr.split("|")[1] || "")).filter(Boolean);
      }
      // 검색어 3단계화(보완사항 3): 좁은 것부터. 3단계 다 0건이어야 인적오류 확정.
      // 우편번호 복구 시군구가 있으면 각 후보를 앞에 붙여 순환조회(인접지역 다 시도).
      const baseQueries = [
        [sgg, emd, bldName].filter(Boolean).join(" "),   // 1차: 시군구+읍면동+건물명
        [sgg, bldName].filter(Boolean).join(" "),        // 2차: 시군구+건물명
        bldName,                                          // 3차: 건물명만
      ];
      const zipQueries = zipSggList.map((zsgg) => [zsgg, bldName].filter(Boolean).join(" "));
      const queries = [...zipQueries, ...baseQueries]     // 우편번호 후보 먼저(좁음) → 건물명만(넓음)
        .filter((q, i, arr) => q && arr.indexOf(q) === i);  // 중복 제거

      let naverItems = null;
      // \uc6b0\ud3b8\ubc88\ud638 \ub2e4\uc911\ub9e4\ud551(\uc778\uc811\uc9c0\uc5ed): '\ud55c\ubc88\ub9cc \uac80\uc0c9' \uc6d0\uce59\uc744 \uae68\uace0 \ud6c4\ubcf4 \uc2dc\uad70\uad6c\ub97c \ubaa8\ub450 \uc870\ud68c\ud574
      // \uacb0\uacfc\ub97c \ud569\uce5c\ub2e4. \uccab \uacb0\uacfc\uc5d0\uc11c \uba48\ucd94\uba74 \uc9c4\uc9dc\uac00 \ub2e4\ub978 \uc778\uc811\uc2dc\uad70\uad6c\uc5d0 \uc788\uc744 \ub54c \ub193\uce68. \uac80\uc99d(pickNaverCandidate)\uc774
      // \ud569\uce5c \uc804\uccb4 \ud6c4\ubcf4 \uc911 \ucd5c\uc120\uc744 \uace0\ub974\ubbc0\ub85c \uc624\ud655\uc815\uc774 \uc624\ud788\ub824 \uc900\ub2e4. \ub2e8\uc77c\ub9e4\ud551/\uc77c\ubc18\uc740 \uae30\uc874\ub300\ub85c \uccab \uacb0\uacfc\uc11c \uba48\ucda4.
      const multiZip = zipQueries.length >= 2;
      const collected = [];
      for (const q of queries) {
        // 캐시키(보완사항 2): 시군구+건물명. 건물명 단독 캐싱 금지(동명 타지역 방지).
        const cacheKey = `${sgg}|${bldName}|${q}`;
        let items;
        if (naverCache.has(cacheKey)) {
          items = naverCache.get(cacheKey);
        } else {
          items = await safeCall(clients.naverLocal, q);  // 시스템오류면 throw→상위 재시도
          naverCache.set(cacheKey, items);
        }
        // \ub2e4\uc911\ub9e4\ud551 \uc21c\ud658 \uc911\uc774\uba74 \uacb0\uacfc\ub97c \ub204\uc801, \uc544\ub2c8\uba74 \uccab \uacb0\uacfc\uc11c \uba48\ucda4
        if (multiZip && zipQueries.includes(q)) {
          if (items && items.length > 0) collected.push(...items);   // 인접시군구 결과 누적(멈추지 않음)
        } else {
          if (items && items.length > 0) { naverItems = items; break; }   // 일반: 첫 결과서 멈춤
        }
      }
      // 다중매핑 누적 결과가 있으면 그걸 후보로(중복 title+address 제거)
      if (multiZip && collected.length > 0) {
        const seen = new Set();
        naverItems = collected.filter((it) => {
          const k = (it.title || "") + "|" + (it.address || "");
          if (seen.has(k)) return false;
          seen.add(k); return true;
        });
      }

      if (naverItems && naverItems.length > 0) {
        // 네이버 후보 검증(2026-07-17): 첫 결과 맹신 금지. category·제목·지번·지역으로
        // 최적 후보 선택. 검증정보 부족(시군구·지번 없음)이면 확정 안 함(검토필요).
        const picked = pickNaverCandidate(naverItems, pre.raw || cleaned, bldName, zipRegions);
        const top = picked.picked;
        const naverConfident = picked.confident;
        const naverAddr = top.roadAddress || top.address || "";   // 도로명 우선
        // ★ 주소는 네이버로 확정. juso는 PNU 확보용으로만 재조회(실패해도 주소는 유효).
        let cand = null;
        if (naverAddr) {
          const reAddr = modernizeSgg(naverAddr);
          const jusoItems = await safeCall(clients.juso, reAddr);
          if (jusoItems.length > 0) {
            cand = fromJuso(jusoItems[0]);           // PNU까지 확보
          } else {
            // PNU 미확보지만 네이버 주소는 정상 → 별도 상태로 남긴다
            cand = fromNaver(top, naverAddr);
          }
        }
        if (cand) {
          // W8(2026-07-17): 원문 지번 있는데 네이버 결과 지번과 다르면 오확정 의심
          // (신도아파트 290-1 → 신도그랑피아 642-2). 검토필요 표시. 지번 없으면 스킵.
          let _reviewNeeded = null;
          const _origJibun = ((pre.raw || cleaned).match(/\b(\d{1,4}-\d+)\b/) || [])[1];
          const _resJibun = ((cand.jibunAddr || "").match(/[가-힣]+동\s+(\d+-?\d*)/) || [])[1];
          if (_origJibun && _resJibun && _origJibun !== _resJibun) {
            _reviewNeeded = "naver_jibun_mismatch";
          } else if (!naverConfident) {
            // 후보 검증정보 부족(시군구·지번 없음) → 네이버 단독 확정 금지(문서 원칙)
            _reviewNeeded = "naver_unverified";
          }
          return {
            candidates: [cand], level: "L3",
            jusoQuery: tried.join(" \u25B8 ") + " \u25B8 [\uB124\uC774\uBC84]" + bldName,
            count: 1,
            naverAddr,                                 // 진단: 네이버가 준 주소
            naverPnuOk: !!cand.pnuOk,                  // PNU 확보 여부
            reviewNeeded: _reviewNeeded,
          };
        }
      } else {
        // 3단계 모두 정상 호출 + 0건 → 인적 입력오류(보완사항 1: 시스템오류와 구분됨)
        return {
          candidates: [], level: "L4_NORESULT",
          jusoQuery: tried.join(" \u25B8 ") + " \u25B8 [\uB124\uC774\uBC84:0\uAC74]" + bldName,
          count: 0, humanInputError: true,
        };
      }
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
  let unit = pre?.unit ?? { dong: null, ho: null };
  if (!pre || pre.cleaned === "")
    return { status: "FAILED", reason: "EMPTY_INPUT", message: "\uC8FC\uC18C\uB97C \uC785\uB825\uD574\uC8FC\uC138\uC694." };
  const deduped = dedupe(candidates).filter((c) => c.admCd);
  // 부개동류(2026-07-17): 동호 후보(쉼표 뒤 N-M)를 juso detBdNmList로 검증.
  // 후보 동(312)이 실제 동목록에 'N동'으로 있으면 동호 확정(추측 아님).
  if (!unit.dong && pre?.unitCandidate && deduped.length > 0) {
    const detList = deduped.map((c) => c.detBdNmList || "").join(",");
    const wantDong = pre.unitCandidate.dong;
    if (detList.includes(wantDong + "동")) {
      unit = { dong: wantDong, ho: pre.unitCandidate.ho };
    }
  }
  // R12(2026-07-17): 호만 있고 동이 없을 때 juso detBdNmList로 동을 정한다.
  //   동 항목 0개(상가·관리실만) → 동 없음, 호만 사용
  //   동 항목 1개               → 그 동으로 확정  (서도아파트 = 101동 하나뿐)
  //   동 항목 2개 이상          → 판단 불가. 비워 두고 검토 대상으로
  if (!unit.dong && unit.ho && deduped.length > 0) {
    const dongs = [...new Set(
      deduped.map((c) => c.detBdNmList || "").join(",")
        .split(/[,\s]+/).filter((x) => /^\d{1,4}동$/.test(x))
    )];
    if (dongs.length === 1) unit = { dong: dongs[0].replace("동", ""), ho: unit.ho };
  }
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
  // R7(2026-07-17): 복수 후보 중 원문 건물명과 bdNm이 일치하는 것을 채택한다.
  //   EXACT   정규화(공백·숫자 제거) 후 완전일치       → 채택
  //   PARTIAL 포함관계, 짧은 쪽이 3자 이상 고유명       → 채택
  //   RISKY   포함관계지만 짧은 쪽이 일반명            → 미채택
  //           "주공아파트"↔"개포주공아파트"는 전국의 주공 중 아무거나 걸린다
  //           "신현대아파트"↔"현대아파트"는 다른 단지다
  if (deduped.length >= 2 && pre?.bldName) {
    const norm = (x) => String(x || "").replace(/\s/g, "").replace(/\d/g, "");
    const GENERIC = /^(주공|현대|삼성|대우|롯데|한신|경남|우성|쌍용|금호|신동아|시영)?(아파트|맨션|빌라|연립|타운)$/;
    const o = norm(pre.bldName);
    const hits = deduped.filter((cand) => {
      const b = norm(cand.bdNm);
      if (!o || !b) return false;
      if (o === b) return true;
      if (!(b.includes(o) || o.includes(b))) return false;
      const shorter = o.length <= b.length ? o : b;
      return shorter.length >= 3 && !GENERIC.test(shorter);
    });
    if (hits.length === 1) {
      const cand = hits[0];
      return {
        status: "CONFIRMED",
        jibunAddr: cand.jibunAddr, roadAddr: cand.roadAddr,
        bdNm: cand.bdNm || null, pnu: buildPnu(cand), bdMgtSn: cand.bdMgtSn || null,
        unit, irosQuery: buildIrosQuery(cand, unit), source: cand.source,
        isJip: !!cand.isJip, reviewNeeded: "bldname_matched"
      };
    }
  }
  // W-NEW(2026-07-17): 후보 여러 개여도 PNU 동일하면 같은 지번(juso가 상가동/주거동
  // 등으로 나눈 것). 동·호로 IROS 세대특정 가능 → CONFIRMED. PNU 다르면 진짜 AMBIGUOUS.
  const pnusW = deduped.map((c) => buildPnu(c));
  const allPnuSameW = pnusW.length > 0 && pnusW.every((p) => p && p === pnusW[0]);
  if (allPnuSameW) {
    const rep = deduped.find((c) => c.isJip) || deduped[0];
    return {
      status: "CONFIRMED",
      jibunAddr: rep.jibunAddr,
      roadAddr: rep.roadAddr,
      bdNm: rep.bdNm || null,
      pnu: buildPnu(rep),
      bdMgtSn: rep.bdMgtSn || null,
      unit,
      irosQuery: buildIrosQuery(rep, unit),
      source: rep.source,
      isJip: !!rep.isJip,
      reviewNeeded: "juso_multi"
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
// R9(2026-07-17) 동소(同所) 기준행: 등기부 표기로 "위와 같은 장소"를 뜻한다.
// 지명이 아니라 앞 항목을 가리키는 참조어이므로 원문 데이터의 순서가 근거가 된다.
// 같은 행정구역으로 시작하는 원문 중 가장 먼저 나온 행의 건물명을 기준으로 삼는다.
// 제거가 아니라 치환이다 — 동소는 건물명 자리에 있으므로 건물명을 넣으면
// 기존 파서가 동·호까지 그대로 처리한다.
//   화룡동 동소103-203  →  화룡동 녹원맨션103-203  →  103동 203호 + 지번 181-2
function buildDongsoAnchors(rows) {
  const first = new Map();
  for (const row of rows) {
    const raw = String(row && row.raw || "");
    if (!raw) continue;
    const p = preprocess(raw);
    const key = [p.sgg, p.eup, p.emd].filter(Boolean).join("|");
    if (!key) continue;
    if (!first.has(key) && p.bldName) first.set(key, p.bldName);
  }
  return first;
}
// R8'(2026-07-17) 주소군 전파: 원문에 식별정보가 아예 없는 행을, 같은 그룹의
// 확정 결과로 채운다. 원문에 건물명이 적혀 있으면 그것이 답이므로 대상이 아니다
// (사천동 25-123 일신힐사이드가 정도드림빌로 둔갑하는 것을 대상 정의에서 막는다).
//   그룹키  우편번호 + 소유자명 + 법정동
//   조건    그룹 내 CONFIRMED의 PNU가 정확히 1종
//   전파    지번주소·도로명주소·PNU·건물관리번호   금지  동·호·원본주소
function propagateAddressGroup(rows, groupHints) {
  const FAIL = ["AMBIGUOUS", "HUMAN_INPUT_ERROR", "VALIDATION_FAILED", "FAILED", "NAVER_CONFIRMED_PNU_FAILED"];
  const g = new Map();
  for (const row of rows) {
    const raw = String(row && row.raw || "");
    if (!raw) continue;
    const p = preprocess(raw);
    // 지번 자리의 N-M이 집단 판정상 동·호면 지번을 비운다(전파 대상이 된다)
    if (groupHints && p.jibun) {
      const jp = p.jibun.split("-");
      const _own = String((row.extra || []).find((x) => x && /[가-힣]/.test(String(x))) || "");
      if (jp.length === 2 && Number(jp[1]) >= 100 &&
          groupHints.get(groupKeyOf(p, row.zip, _own) + "|JIBUN_AS_UNIT") === "UNIT") {
        p.unit = { dong: jp[0], ho: jp[1] };
        p.jibun = "";
      }
    }
    const zip = String(row.zip || "").replace(/\.\d+$/, "").replace(/[^0-9]/g, "");
    const owner = String((row.extra || []).find((x) => x && /[가-힣]/.test(String(x))) || "");
    const key = zip + "|" + owner + "|" + (p.emd || "");
    if (!zip || !owner || !p.emd) continue;
    if (!g.has(key)) g.set(key, []);
    g.get(key).push({ row, p });
  }
  let filled = 0;
  for (const [, arr] of g) {
    const conf = arr.filter((x) => x.row.result && x.row.result.status === "CONFIRMED" && x.row.result.pnu);
    if (!conf.length) continue;
    const pnus = [...new Set(conf.map((x) => x.row.result.pnu))];
    if (pnus.length !== 1) continue;          // 단지가 둘이면 판단 불가
    const src = conf[0].row.result;
    for (const x of arr) {
      const r = x.row.result;
      if (!r || !FAIL.includes(r.status)) continue;
      const isDongso = /동소/.test(String(x.row.raw || ""));
      if (x.p.bldName && !isDongso) continue;  // 원문에 건물명이 있으면 그것이 답
                                              // (동소는 참조어라 자기 건물명이 아니다)
      if (x.p.jibun || x.p.road) continue;    // 원문에 주소 구성이 있으면 대상 아님
      x.row.result = {
        ...r,
        status: "CONFIRMED",
        jibunAddr: src.jibunAddr, roadAddr: src.roadAddr,
        pnu: src.pnu, bdMgtSn: src.bdMgtSn, bdNm: src.bdNm,
        unit: x.p.unit,                        // 동·호는 각 행 원문에서
        source: "주소군전파",
        reviewNeeded: r.reviewNeeded || "group_propagated"
      };
      filled++;
    }
  }
  return filled;
}
// 집단 판정(2026-07-17): 배치는 전체 데이터를 갖고 있으므로, 행 하나로는
// 애매한 것을 같은 지번 그룹의 값 분포로 확정할 수 있다.
//   옥산리 1346-9  앞: 501 502 …  뒤: 101 102 …   → 흩어짐 = 동·호
//   사천동 25-123  앞: 25만        뒤: 131만       → 고정  = 별개 지번
// 단독 1건은 판정하지 않고 UNKNOWN으로 두어 juso detBdNmList 검증에 맡긴다.
// 집단 판정·조회가 같은 그룹 키를 쓰도록 한 곳에 둔다.
// 우편번호+소유자가 있으면 그것을, 없으면 시군구+법정동을 쓴다.
function groupKeyOf(pre, zip, owner) {
  const z = String(zip || "").replace(/\.\d+$/, "").replace(/[^0-9]/g, "");
  const o = String(owner || "");
  return (z && o) ? (z + "|" + o) : [pre.sgg, pre.emd].join("|");
}
function buildGroupHints(rows) {
  const g = new Map();
  for (const row of rows) {
    const raw = String(row && row.raw || "");
    if (!raw) continue;
    const p = preprocess(raw);
    if (!p.jibun) continue;
    const idx = raw.indexOf(p.jibun);
    if (idx < 0) continue;
    const m = raw.slice(idx + p.jibun.length).match(/(?:^|\s)(\d{1,4})-(\d{2,4})(?!\d)/);
    if (!m) continue;
    const k = [p.sgg, p.emd, p.jibun].join("|");
    if (!g.has(k)) g.set(k, []);
    g.get(k).push([m[1], m[2]]);
  }
  const out = new Map();
  for (const [k, v] of g) {
    if (v.length < 2) { out.set(k, "UNKNOWN"); continue; }
    const a = new Set(v.map((x) => x[0])), b = new Set(v.map((x) => x[1]));
    out.set(k, (a.size > 1 || b.size > 1) ? "UNIT" : "JIBUN");
  }
  // 지번 자리의 N-M이 실은 동·호인 경우(화룡동 105-501). 같은 단지에
  // 정상 지번을 가진 행이 있고, 나머지가 부번 3자리 이상으로 흩어지면 동·호다.
  //   화룡동 181-2(정상) · 105-501 · 106-201 …  →  105동 501호
  // 그룹 키는 우편번호+소유자다. 법정동으로 묶으면 같은 단지가 갈린다
  //   (석정리 대심리78-1 → "대심리" / 석정리 103-311 → "석정리", 실측 900건 미판정).
  const byEmd = new Map();
  for (const row of rows) {
    const raw = String(row && row.raw || "");
    if (!raw) continue;
    const p = preprocess(raw);
    if (!p.jibun) continue;
    const owner = String((row.extra || []).find((x) => x && /[가-힣]/.test(String(x))) || "");
    const key = groupKeyOf(p, row.zip, owner);
    if (!byEmd.has(key)) byEmd.set(key, []);
    byEmd.get(key).push(p.jibun);
  }
  for (const [key, list] of byEmd) {
    if (list.length < 3) continue;
    const parts = list.map((x) => x.split("-"));
    const normal = parts.filter((x) => x.length === 1 || Number(x[1]) < 100);
    const unitLike = parts.filter((x) => x.length === 2 && Number(x[1]) >= 100);
    // 정상 지번이 있고, 동호 형태가 여럿이며 값이 흩어질 때만
    if (!normal.length || unitLike.length < 2) continue;
    const dongs = new Set(unitLike.map((x) => x[0]));
    if (dongs.size < 2 && unitLike.length < 3) continue;
    out.set(key + "|JIBUN_AS_UNIT", "UNIT");
  }
  return out;
}
async function refineAddress(raw, clients, zipcode = "", groupHints = null, unitOverride = null, dongsoAnchors = null, owner = "") {
  // R9: 동소를 기준행 건물명으로 치환한 뒤 전처리한다(치환 후 파싱해야 동·호가 잡힌다)
  let _raw = raw;
  if (dongsoAnchors && /동소/.test(String(raw))) {
    const p0 = preprocess(raw);
    const bld = dongsoAnchors.get([p0.sgg, p0.eup, p0.emd].filter(Boolean).join("|"));
    if (bld) _raw = String(raw).replace(/동소\s*/, bld);
  }
  const pre = preprocess(_raw);
  // 복수세대 분리행: 배치가 지정한 세대를 그대로 쓴다(원문에는 여러 세대가 있다)
  if (unitOverride) pre.unit = { dong: unitOverride.dong || null, ho: unitOverride.ho || null };
  // 집단 판정(2026-07-17): 지번 뒤 N-M을 배치 전체 분포로 확정한다.
  //   UNIT  → 동·호로 채택 (juso 호출 없이 확정)
  //   JIBUN → 별개 지번. 동·호로 쓰지 않는다
  //   없음/UNKNOWN → 후보로만 보관해 detBdNmList 검증에 맡긴다
  // 지번 자리의 N-M이 실은 동·호인 경우(화룡동 105-501). 집단이 그렇게 판정했고
  // 부번이 3자리 이상이면 지번을 비우고 동·호로 옮긴다. 지번은 R8' 전파가 채운다.
  if (groupHints && pre.jibun && !pre.unit.dong && !pre.unit.ho) {
    const jp = pre.jibun.split("-");
    if (jp.length === 2 && Number(jp[1]) >= 100 &&
        groupHints.get(groupKeyOf(pre, zipcode, owner) + "|JIBUN_AS_UNIT") === "UNIT") {
      pre.unit = { dong: jp[0], ho: jp[1] };
      pre.jibun = "";
    }
  }
  if (groupHints && pre.jibun && !pre.unit.dong && !pre.unit.ho) {
    const idx = String(raw).indexOf(pre.jibun);
    if (idx >= 0) {
      const m = String(raw).slice(idx + pre.jibun.length).match(/(?:^|\s)(\d{1,4})-(\d{2,4})(?!\d)/);
      if (m) {
        const hint = groupHints.get([pre.sgg, pre.emd, pre.jibun].join("|"));
        if (hint === "UNIT") pre.unit = { dong: m[1], ho: m[2] };
        else if (hint !== "JIBUN") pre.unitCandidate = { dong: m[1], ho: m[2] };
      }
    }
  }
  if (zipcode) pre.zipcode = zipcode;   // 우편번호 지역복구용(cascade에서 사용)
  if (pre.cleaned === "") return resolve([], pre);
  let cascadeResult;
  try {
    cascadeResult = await cascade(pre, clients);
  } catch (e) {
    // safeCall이 시스템오류(네이버 API 장애 등)를 throw로 전파 → SYSTEM_ERROR
    return {
      status: "SYSTEM_ERROR",
      reason: "SYSTEM_ERROR",
      message: `\uC870\uD68C \uC2DC\uC2A4\uD15C \uC624\uB958 \u2014 \uC7AC\uC2DC\uB3C4 \uD544\uC694 (${e?.message || e})`,
      searchLevel: null, jusoQuery: pre.cleaned, candCount: 0,
      validation: { status: "NOT_AVAILABLE", reason: "", inputSgg: "", resultSgg: "" },
    };
  }
  const { candidates, level, jusoQuery, count, humanInputError, naverAddr, naverPnuOk } = cascadeResult;

  // ── L4 네이버 최종 판정 결과 처리 (2026-07-15) ──────────────────
  // 네이버는 '최종 정상주소 판정 엔진'. 주소 판정과 PNU 확보를 분리한다.
  if (level === "L3") {
    if (naverPnuOk) {
      // 네이버 주소 + juso로 PNU 확보 → 완전 확정. 아래 일반 CONFIRMED 경로로.
    } else {
      // 네이버 주소는 정상이나 PNU 미확보 → 별도 상태(주소는 유효)
      const c = candidates[0] || {};
      return {
        status: "NAVER_CONFIRMED_PNU_FAILED",
        jibunAddr: c.jibunAddr || naverAddr || null,
        roadAddr: c.roadAddr || null,
        bdNm: c.bdNm || null,
        pnu: null, bdMgtSn: null,
        unit: pre.unit,
        searchLevel: "L3", jusoQuery, candCount: count,
        naverAddr,
        message: `\uB124\uC774\uBC84 \uC8FC\uC18C \uD655\uC778(PNU \uBBF8\uD655\uBCF4): ${naverAddr || c.jibunAddr || ""}`,
        validation: { status: "NOT_AVAILABLE", reason: "네이버 확정", inputSgg: "", resultSgg: "" },
      };
    }
  }
  if (humanInputError) {
    // 네이버 3단계 정상호출 + 전부 0건 → 인적 입력오류(주소 자체가 틀림)
    return {
      status: "HUMAN_INPUT_ERROR",
      reason: "HUMAN_INPUT_ERROR",
      message: "\uB124\uC774\uBC84 \uC815\uC0C1 \uC870\uD68C\uD588\uC73C\uB098 \uACB0\uACFC \uC5C6\uC74C \u2014 \uC785\uB825 \uC8FC\uC18C \uD655\uC778 \uD544\uC694(\uC624\uD0C0/\uC874\uC7AC\uD558\uC9C0 \uC54A\uB294 \uC8FC\uC18C)",
      searchLevel: "L3", jusoQuery, candCount: 0,
      validation: { status: "NOT_AVAILABLE", reason: "", inputSgg: "", resultSgg: "" },
    };
  }

  const result = resolve(candidates, pre);
  result.searchLevel = level;
  result.jusoQuery = jusoQuery;        // 진단: juso에 실제로 간 검색어
  result.candCount = count;            // 진단: 원천이 돌려준 후보 수
  // W10(2026-07-17): 검토필요 플래그 통합. resolve(juso_multi) + cascade(naver_jibun_mismatch).
  result.reviewNeeded = result.reviewNeeded || cascadeResult.reviewNeeded || null;
  if (result.status === "CONFIRMED") {
    // L4(네이버 확정)는 시도만 검증 — 네이버가 시군구/법정동 오류를 교정한
    // 것을 막지 않기 위함(부전타워 만화리→교리, 당진군→당진시 실측).
    const _rel = (cascadeResult.candidates || []).map((x) => x.relJibun || "").join(" ");
    const v = validateRegion(pre.cleaned, result.jibunAddr, level === "L3", _rel);
    result.validation = v;
    // 용도 검증(2026-07-17): 원문이 주거인데 결과가 비주거면 확정하지 않는다.
    //   하안주공8단지 808동 → 하안북초등학교 / 신개금주공3단지 → 부산당감3동우체국
    //   pickNaverCandidate의 category 판정과 같은 원리를 juso 결과(bdNm)에 적용한다.
    const RESID = /(아파트|맨션|빌라|타운|타워|하이츠|캐슬|자이|푸르지오|래미안|주공|힐스|오피스텔|연립|마을|하임|하늘채|더샵|스위첸|힐스테이트|그린빌|하이빌|빌리지)/;
    const NONRES = /(주유소|상회|관리사무소|경비실|놀이터|창고|공장|처리|센터|교회|성당|학교|유치원|병원|의원|약국|마트|편의점|은행|사무소|영업소|정비|시설|회관|주차장|식당|우체국|파출소|소방|농협)/;
    const _rbd = String(result.bdNm || "");
    if (RESID.test(pre.raw || "") && _rbd && NONRES.test(_rbd) && !RESID.test(_rbd)) {
      result.status = "VALIDATION_FAILED";
      result.message = `용도 불일치 — 원문은 주거인데 결과가 비주거입니다(${_rbd})`;
      result.validation = { status: "MISMATCH", reason: `용도 불일치(${_rbd})`,
                            inputSgg: v.inputSgg, resultSgg: v.resultSgg };
    } else if (v.status === "MISMATCH") {
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
  // 네이버 지역검색 mock(2026-07-15, 카카오 대체). 건물명으로 장소 검색.
  naverLocal: async (query) => MOCK_KAKAO_DB
    .filter((e) => e.keys.some((k) => query.includes(k)))
    .map((e) => ({
      title: e.doc.place_name || "",
      address: e.doc.address_name || "",
      roadAddress: e.doc.road_address_name || "",
      mapx: e.doc.x || "", mapy: e.doc.y || "",
    })),
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
    naverLocal: async (query) => {
      let res;
      try {
        res = await fetch(`/api/naver?query=${encodeURIComponent(query)}`);
      } catch {
        throw transientErr("네이버 네트워크 오류");   // 시스템 오류 → 재시도
      }
      if (!res.ok) throw transientErr(`네이버 HTTP ${res.status}`);
      let data;
      try { data = await res.json(); } catch { throw transientErr("네이버 응답 파싱 실패"); }
      // ok:false = API 장애(인증/한도/타임아웃/서버). 시스템 오류로 전파 → 재시도.
      // 인적 오류(결과 0건)와 절대 섞지 않는다(보완사항 1).
      if (data && data.ok === false) {
        throw transientErr(`네이버 ${data.error_kind || "ERROR"}: ${data.error || ""}`.trim());
      }
      return data?.items ?? [];   // ok:true + 빈 배열 = 진짜 0건(HUMAN_INPUT_ERROR로 분류)
    },
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
    NAVER_CONFIRMED_PNU_FAILED: ["\uB124\uC774\uBC84\uD655\uC815(PNU\uBBF8\uD655\uBCF4)", C.cyan],
    AMBIGUOUS: ["\uD655\uC778 \uD544\uC694", C.warn],
    VALIDATION_FAILED: ["\uAC80\uC99D \uBD88\uC77C\uCE58", C.warn],
    HUMAN_INPUT_ERROR: ["\uC785\uB825\uC624\uB958", C.warn],
    SYSTEM_ERROR: ["\uC2DC\uC2A4\uD15C\uC624\uB958(\uC7AC\uC2DC\uB3C4)", C.err],
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
      // 우편번호(2026-07-17): 시군구 없는 주소의 지역 복구용. 소재지우편번호 등.
      const zipColIdx = findColIdx(header0, [/우편\s*번호|우편|zip/i]);
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
        .flatMap((r) => {
          const addrVal = String(r[addrIdx] ?? "").trim();
          const detailVal = detailIdx >= 0 ? String(r[detailIdx] ?? "").trim() : "";
          const raw = detailVal ? `${addrVal} ${detailVal}`.replace(/\s+/g, " ").trim() : addrVal;
          const extra = extraColIdxs
            ? extraColIdxs.map((i) => r[i] ?? "")
            : extraHeaders2.map((_, i) => r[i + 1] ?? "");
          // 우편번호(2026-07-17): 시군구 복구용. 각 분리행에 복제.
          const zip = zipColIdx >= 0 ? String(r[zipColIdx] ?? "").trim() : "";
          // W9: 순수 토지 복수지번은 지번마다 행 분리. extra(업로드 원본열)는 각 행에 복제.
          // 복수세대 우선: 한 행에 세대가 둘 이상이면 세대별로 나눈다.
          // 동·호만 다르고 나머지(원본주소·extra·우편번호)는 그대로 승계한다.
          const units = splitUnitsForBatch(raw);
          if (units) {
            return units.map((u) => ({
              raw, extra, zip, result: null,
              unitOverride: { dong: u[0], ho: u[1] }
            }));
          }
          const splits = splitRowsForBatch(raw);
          return splits.map((sraw) => ({ raw: sraw, extra, zip, result: null }));
        })
        .filter((row) => row.raw !== "");   // 주소가 실제로 비어있는 행은 제외
      // 사전 분석(API 호출 없음): 정제 시작 전에 호출량·중복 구조를 먼저 파악
      const statMap = /* @__PURE__ */ new Map();
      for (const row of built) {
        const uo0 = row.unitOverride;
        const k = normalizeRawKey(row.raw) + (uo0 ? `#${uo0.dong || ""}-${uo0.ho || ""}` : "");
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
    await loadZipMap();   // 우편번호 복구맵 1회 로드(캐시). 실패해도 복구만 스킵.
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
      // 복수세대 분리행은 원문이 같으므로 세대를 키에 포함해야 각각 조회된다
      const uo = next[i].unitOverride;
      const k = normalizeRawKey(next[i].raw) + (uo ? `#${uo.dong || ""}-${uo.ho || ""}` : "");
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(i);
    }
    // 진행률 2종: 작업률(고유주소 = 실제 API 호출 단위) / 반영률(원본 행 수)
    // 집단 판정(2026-07-17): 전체를 한 번 훑어 같은 지번 그룹의 값 분포를 모은다.
    // 행 하나로는 동호인지 지번인지 모르는 것을 집단으로 확정한다.
    const groupHints = buildGroupHints(next);
    const dongsoAnchors = buildDongsoAnchors(next);
    setBatchGroupTotal(groups.size);
    let gDone = 0;
    setBatchGroupDone(0);
    let consecTransient = 0;   // 연속 '일시 오류' 수 — 한도 소진/장애 감지용(PM-01)
    for (const [, idxs] of groups) {
      if (batchStopRef.current) break;
      let r;
      try {
        r = await refineAddress(next[idxs[0]].raw, clients, next[idxs[0]].zip, groupHints, next[idxs[0]].unitOverride, dongsoAnchors, (next[idxs[0]].extra || []).find((x) => x && /[가-힣]/.test(String(x))) || "");  // 대표는 그룹 첫 행의 원본 raw + 우편번호
        consecTransient = 0;
      } catch (e) {
        // W4(2026-07-17): transient(API 순간한도 429 등)면 800ms 대기 후 1회 자동 재시도.
        // 순간한도는 잠깐 기다리면 풀림. 1회만(2회+는 배치 지연). 실패 시 기존 TRANSIENT 기록.
        try {
          await new Promise((res) => setTimeout(res, 800));
          r = await refineAddress(next[idxs[0]].raw, clients, next[idxs[0]].zip, groupHints, next[idxs[0]].unitOverride, dongsoAnchors, (next[idxs[0]].extra || []).find((x) => x && /[가-힣]/.test(String(x))) || "");
          consecTransient = 0;
        } catch (e2) {
          r = { status: "FAILED", failKind: "TRANSIENT",
                message: `일시 오류(재시도 후): ${e2 && e2.message ? e2.message : e2}` };
          consecTransient++;
        }
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
    // R8'(2026-07-17): 모든 조회가 끝난 뒤 마지막에 전파한다. 앞 단계가
    // CONFIRMED를 늘릴수록 기준행이 생기는 그룹도 늘어나므로 순서가 중요하다.
    if (!batchStopRef.current) propagateAddressGroup(next, groupHints);
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
          : r.status === "NAVER_CONFIRMED_PNU_FAILED" ? "\uB124\uC774\uBC84\uD655\uC815\uBBF8PNU"
          : r.status === "HUMAN_INPUT_ERROR" ? "\uC785\uB825\uC624\uB958"
          : r.status === "SYSTEM_ERROR" ? "\uC2DC\uC2A4\uD15C\uC624\uB958"
          : r.status === "FAILED" ? (r.failKind === "TRANSIENT" ? "\uC77C\uC2DC\uC624\uB958" : "\uC8FC\uC18C\uBBF8\uBC1C\uACAC") : "";
      } else if (reg && reg.status !== "RESOLVED") {
        failCode = REG_LABEL[reg.status] || reg.status;
      }
      const addrSrc = r.source === "naver" ? "\uB124\uC774\uBC84L3" : r.searchLevel === "L3" ? "\uB124\uC774\uBC84L3" : r.searchLevel === "L2" ? "JUSO\uC7AC\uAC80\uC0C9" : "JUSO\uC6D0\uBB38";
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
        reviewNeeded: r.reviewNeeded || "",
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
  const HEADERS = ["원본주소", "정제상태", "시군구", "부동산구분", "주택유형", "지번주소", "도로명주소", "동", "호", "PNU", "건물관리번호", "등기고유번호", "중복여부", "중복그룹", "주소확정원천", "동호원천", "등기상태", "실패코드", "조회일시", "비고", "juso\uAC80\uC0C9\uC5B4", "\uD6C4\uBCF4\uAC74\uC218", "\uAC80\uC0C9\uACBD\uB85C", "\uC785\uB825\uC9C0\uC5ED", "\uACB0\uACFC\uC9C0\uC5ED", "\uAC80\uC99D\uC0C1\uD0DC", "\uAC80\uC99D\uC0AC\uC720", "\uAC80\uD1A0\uC720\uD615"];
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
    rec.valReason,
    rec.reviewNeeded
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
