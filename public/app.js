if (typeof window !== 'undefined' && !window.storage) { window.storage = { get: async (k) => { const v = localStorage.getItem(k); return v == null ? null : { key: k, value: v }; }, set: async (k, v) => { localStorage.setItem(k, v); return { key: k, value: v }; }, delete: async (k) => { localStorage.removeItem(k); return { key: k, deleted: true }; }, list: async (p='') => { const keys=[]; for(let i=0;i<localStorage.length;i++){const kk=localStorage.key(i); if(kk&&kk.startsWith(p))keys.push(kk);} return { keys }; }, }; }
const { useState, useEffect, useCallback } = React;
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
  return str.replace(/(\d)\s*번지/g, "$1").replace(/일원|일대|부근|인근|근처/g, " ").replace(/외\s*\d+\s*필지/g, " ").replace(/소재(지)?/g, " ").trim();
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
  for (const sido of [...SIDO_TOKENS].sort((a, b) => b.length - a.length)) {
    if (s.startsWith(sido) && s.length > sido.length && s[sido.length] !== " ") {
      s = sido + " " + s.slice(sido.length);
      break;
    }
  }
  const guRe = /([가-힣]{1,3}(?:시|구|군))(?=[가-힣])/g;
  s = s.replace(guRe, "$1 ").replace(guRe, "$1 ");
  return s.replace(/\s+/g, " ").trim();
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
    jibunAddr: jibun?.address_name ?? doc.address_name ?? null,
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
  } catch {
    return [];
  }
}
async function cascade(pre, clients) {
  const { cleaned, searchText } = pre;
  let items = await safeCall(clients.juso, cleaned);
  if (items.length > 0) return { candidates: items.map(fromJuso), level: "L1" };
  if (searchText && searchText !== cleaned) {
    items = await safeCall(clients.juso, searchText);
    if (items.length > 0) return { candidates: items.map(fromJuso), level: "L2" };
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
      return { candidates: out, level: "L3" };
    }
  }
  return { candidates: [], level: null };
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
  const { candidates, level } = await cascade(pre, clients);
  const result = resolve(candidates, pre);
  result.searchLevel = level;
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
function makeRealClients(jusoKey, kakaoKey) {
  return {
    juso: async (kw) => {
      try {
        const res = await fetch(`/api/juso?keyword=${encodeURIComponent(kw)}`);
        const data = await res.json();
        return data?.juso ?? [];
      } catch {
        return [];
      }
    },
    kakaoKeyword: async (kw) => {
      try {
        const res = await fetch(`/api/kakao?type=keyword&query=${encodeURIComponent(kw)}`);
        const data = await res.json();
        return data?.documents ?? [];
      } catch {
        return [];
      }
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
  } }, reg.unique_no), reg?.status === "MULTIPLE" && /* @__PURE__ */ React.createElement("div", { style: { marginBottom: 6 } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 11.5, color: C.warn, marginBottom: 4 } }, reg.candidates.length, "\uAC74 \u2014 \uC18C\uC7AC\uC9C0\uB85C \uAD6C\uBD84"), reg.candidates.map((c, i) => /* @__PURE__ */ React.createElement("div", { key: i, style: { fontFamily: mono, fontSize: 12.5, color: C.ink } }, /* @__PURE__ */ React.createElement("span", { style: { color: C.ok, fontWeight: 700 } }, c.unique_no), /* @__PURE__ */ React.createElement("span", { style: { color: C.dim, marginLeft: 8 } }, c.sojae)))), reg && !["RESOLVED", "MULTIPLE"].includes(reg.status) && /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, color: C.err, marginBottom: 6 } }, reg.status, " \u2014 ", reg.message), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" } }, bridgeUp ? /* @__PURE__ */ React.createElement(
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
  ))), /* @__PURE__ */ React.createElement("p", { style: { fontSize: 11, color: C.faint, marginTop: 9 } }, "\uD6C4\uBCF4 \uC120\uD0DD \uC2DC \uD574\uB2F9 \uC9C0\uC5ED\uC73C\uB85C \uC881\uD600 \uC7AC\uAC80\uC0C9\uD569\uB2C8\uB2E4.")), r.status === "FAILED" && /* @__PURE__ */ React.createElement("p", { style: { fontSize: 14, margin: 0, lineHeight: 1.7, color: C.dim } }, r.message));
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
  const [fileErr, setFileErr] = useState("");
  const [extraHeaders, setExtraHeaders] = useState([]);
  const BRIDGE = config.bridgeUrl || "/api";
  const regHeaders = config.resolverKey ? { "X-Resolver-Key": config.resolverKey } : {};
  const [bridgeUp, setBridgeUp] = useState(false);
  const [bridgeHelpOpen, setBridgeHelpOpen] = useState(false);
  const [regBusy, setRegBusy] = useState(false);
  const [regResult, setRegResult] = useState(null);
  const [batchRegBusy, setBatchRegBusy] = useState(false);
  const [batchRegDone, setBatchRegDone] = useState(0);
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
      setRegResult(await r.json());
    } catch {
      setRegResult({ status: "ERROR", message: "\uBE0C\uB9AC\uC9C0 \uC751\uB2F5 \uC5C6\uC74C \u2014 \uBE0C\uB9AC\uC9C0 \uC8FC\uC18C/\uC2E4\uD589 \uC0C1\uD0DC\uB97C \uD655\uC778\uD558\uC138\uC694." });
    } finally {
      setRegBusy(false);
    }
  }, [result, BRIDGE, config.resolverKey]);
  const lookupBatchUniqueNo = useCallback(async () => {
    const targets = rows.map((row, idx) => ({ idx, row })).filter(({ row }) => row.result?.status === "CONFIRMED");
    if (targets.length === 0) return;
    setBatchRegBusy(true);
    setBatchRegDone(0);
    const next = [...rows];
    for (let k = 0; k < targets.length; k++) {
      const { idx, row } = targets[k];
      const addr = row.result.jibunAddr || row.result.irosQuery || "";
      const d = row.result.unit?.dong ? `&dong=${encodeURIComponent(row.result.unit.dong)}` : "";
      const h = row.result.unit?.ho ? `&ho=${encodeURIComponent(row.result.unit.ho)}` : "";
      const b = row.result.bdNm ? `&bdnm=${encodeURIComponent(row.result.bdNm)}` : "";
      try {
        const r = await fetch(
          `${BRIDGE}/resolve?addr=${encodeURIComponent(addr)}${d}${h}${b}`,
          { headers: regHeaders, signal: AbortSignal.timeout(6e4) }
        );
        const data = await r.json();
        next[idx] = { ...row, reg: data };
      } catch {
        next[idx] = { ...row, reg: { status: "ERROR", message: "\uBE0C\uB9AC\uC9C0 \uC751\uB2F5 \uC5C6\uC74C" } };
      }
      setBatchRegDone(k + 1);
      setRows([...next]);
    }
    setBatchRegBusy(false);
  }, [rows, BRIDGE, config.resolverKey]);
  const clients = mode === "mock" ? mockClients : makeRealClients(config.jusoKey, config.kakaoKey);
  const [unitDong, setUnitDong] = useState("");
  const [unitHo, setUnitHo] = useState("");
  const [unitOpen, setUnitOpen] = useState(false);
  const runSingle = useCallback(async (raw) => {
    if (!raw.trim()) return;
    setBusy(true);
    const r = await refineAddress(raw, clients);
    if (r?.unit?.dong) setUnitDong(r.unit.dong);
    if (r?.unit?.ho) setUnitHo(r.unit.ho);
    if (r?.status === "CONFIRMED" && r.isJip) setUnitOpen(true);
    setResult(r);
    setLastRaw(raw);
    setBusy(false);
  }, [clients]);
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
      return;
    }
    const region = (cand.sidoSigungu || "").trim();
    const base = lastRaw.replace(region, "").trim();
    await runSingle(`${region} ${base}`.replace(/\s+/g, " ").trim());
  }, [lastRaw, runSingle, unitDong, unitHo]);
  const onFile = useCallback(async (e) => {
    setFileErr("");
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
      const filled = data.filter((row) => String(row?.[0] ?? "").trim() !== "");
      if (filled.length === 0) {
        setFileErr("\uCCAB \uBC88\uC9F8 \uC5F4\uC5D0\uC11C \uC8FC\uC18C\uB97C \uCC3E\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4. A\uC5F4\uC5D0 \uC8FC\uC18C\uB97C \uB123\uC5B4\uC8FC\uC138\uC694.");
        return;
      }
      let extraHeaders2 = [];
      let body = filled;
      if (/주소|address/i.test(String(filled[0][0]))) {
        extraHeaders2 = filled[0].slice(1).map((h, i) => String(h ?? "").trim() || `\uC5F4${i + 2}`);
        body = filled.slice(1);
      } else {
        const maxExtra = Math.max(0, ...filled.map((r) => r.length - 1));
        extraHeaders2 = Array.from({ length: maxExtra }, (_, i) => `\uC5F4${i + 2}`);
      }
      setExtraHeaders(extraHeaders2);
      setRows(body.map((r) => ({
        raw: String(r[0]).trim(),
        extra: extraHeaders2.map((_, i) => r[i + 1] ?? ""),
        result: null
      })));
      setBatchDone(0);
    } catch {
      setFileErr("\uD30C\uC77C\uC744 \uC77D\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4. xlsx \uB610\uB294 csv \uD615\uC2DD\uC778\uC9C0 \uD655\uC778\uD574\uC8FC\uC138\uC694.");
    } finally {
      e.target.value = "";
    }
  }, []);
  const runBatch = useCallback(async () => {
    setBatchBusy(true);
    setBatchDone(0);
    const next = [];
    for (let i = 0; i < rows.length; i++) {
      const r = await refineAddress(rows[i].raw, clients);
      next.push({ raw: rows[i].raw, extra: rows[i].extra, result: r });
      setBatchDone(i + 1);
      setRows([...next, ...rows.slice(i + 1)]);
    }
    setBatchBusy(false);
  }, [rows, clients]);
  const downloadXlsx = useCallback(() => {
    const head = ["\uC785\uB825\uC8FC\uC18C", "\uC0C1\uD0DC", "\uC9C0\uBC88\uC8FC\uC18C", "\uB3C4\uB85C\uBA85\uC8FC\uC18C", "PNU", "\uAC74\uBB3C\uAD00\uB9AC\uBC88\uD638", "\uB3D9", "\uD638", "\uAC80\uC0C9\uB2E8\uACC4", "\uBE44\uACE0", "\uD6C4\uBCF4\uC0C1\uC138", "\uB4F1\uAE30\uACE0\uC720\uBC88\uD638", "\uB4F1\uAE30\uC870\uD68C", ...extraHeaders];
    const aoa = [head];
    for (const row of rows) {
      const r = row.result;
      const candDetail = r?.status === "AMBIGUOUS" ? r.candidates.map((c) => c.sidoSigungu).join(" | ") : "";
      const reg = row.reg;
      const regNo = reg?.status === "RESOLVED" ? reg.unique_no ?? "" : reg?.status === "MULTIPLE" ? (reg.candidates || []).map((c) => c.unique_no).join(" | ") : "";
      const regStatus = reg ? reg.status : "";
      const base = !r ? [row.raw, "\uBBF8\uC2E4\uD589", "", "", "", "", "", "", "", "", ""] : [
        row.raw,
        r.status,
        r.jibunAddr ?? "",
        r.roadAddr ?? "",
        r.pnu ?? "",
        r.bdMgtSn ?? "",
        r.unit?.dong ?? "",
        r.unit?.ho ?? "",
        r.searchLevel ?? "",
        r.status === "AMBIGUOUS" ? `\uD6C4\uBCF4${r.candidates.length}\uAC74:${r.requireLevel}` : r.reason ?? "",
        candDetail
      ];
      aoa.push([...base, regNo, regStatus, ...row.extra ?? []]);
    }
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    for (let i = 1; i < aoa.length; i++) {
      for (const col of [4, 5, 11]) {
        const ref = XLSX.utils.encode_cell({ r: i, c: col });
        if (ws[ref]) ws[ref].t = "s";
      }
    }
    ws["!cols"] = [
      { wch: 34 },
      { wch: 11 },
      { wch: 30 },
      { wch: 30 },
      { wch: 21 },
      { wch: 27 },
      { wch: 6 },
      { wch: 6 },
      { wch: 9 },
      { wch: 20 },
      { wch: 28 },
      { wch: 18 },
      { wch: 11 },
      ...extraHeaders.map(() => ({ wch: 14 }))
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "\uC815\uC81C\uACB0\uACFC");
    XLSX.writeFile(wb, "addr-refine-\uACB0\uACFC.xlsx");
  }, [rows, extraHeaders]);
  const stat = rows.reduce((acc, r) => {
    if (r.result) acc[r.result.status] = (acc[r.result.status] || 0) + 1;
    return acc;
  }, {});
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
      `), /* @__PURE__ */ React.createElement(CadastralBackdrop, null), /* @__PURE__ */ React.createElement("div", { style: { position: "fixed", top: 14, left: 16, zIndex: 40 } }, /* @__PURE__ */ React.createElement(
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
  )), /* @__PURE__ */ React.createElement("span", { style: { fontSize: 10.5, color: C.faint } }, "\uC22B\uC790\uB9CC \uC785\uB825 (\uB3D9\xB7\uD638 \uAE00\uC790 \uBD88\uD544\uC694)"))), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 6, marginTop: 12, flexWrap: "wrap", justifyContent: "center" } }, ["\uC11C\uC6B8\uFF0A\uAC15\uB0A8\uAD6C\uFF01\uD14C\uD5E4\uB780\uB85C\uFF12\uFF11\uFF12", "\uC2E0\uC815\uB3D9 100", "\uC911\uC559\uB3D9 50", "\uCCAD\uC8FC\uC2DC \uC0B0\uC131\uB3D9 \uC0B012-3", "\uB798\uBBF8\uC548\uC6D0\uBCA0\uC77C\uB9AC 101\uB3D9 1502\uD638", "\uC5C6\uB294\uC8FC\uC18C 999"].map((ex) => /* @__PURE__ */ React.createElement(
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
  ), regResult && (regResult.status === "RESOLVED" || regResult.status === "MULTIPLE") && /* @__PURE__ */ React.createElement("p", { style: { fontSize: 11, color: C.faint, textAlign: "center", marginTop: 10 } }, "\u203B \uB2E8\uC77C \uC870\uD68C \uACB0\uACFC\uB294 \uD654\uBA74 \uD45C\uC2DC\uC6A9\uC785\uB2C8\uB2E4. \uC5D1\uC140 \uC800\uC7A5\uC740 \uC77C\uAD04 \uD0ED\uC5D0\uC11C \uC9C0\uC6D0\uB429\uB2C8\uB2E4.")), tab === "batch" && /* @__PURE__ */ React.createElement("section", null, /* @__PURE__ */ React.createElement("div", { style: {
    background: C.card,
    border: `1px dashed ${C.cyan}55`,
    borderRadius: 14,
    padding: "28px 20px",
    textAlign: "center",
    backdropFilter: "blur(4px)",
    WebkitBackdropFilter: "blur(4px)"
  } }, /* @__PURE__ */ React.createElement("p", { style: { margin: "0 0 14px", fontSize: 13, color: C.dim } }, "xlsx / csv \uD30C\uC77C\uC758 ", /* @__PURE__ */ React.createElement("strong", { style: { color: C.ink } }, "A\uC5F4"), "\uC5D0 \uC8FC\uC18C\uB97C \uB123\uC5B4 \uC5C5\uB85C\uB4DC\uD558\uC138\uC694. \uD5E4\uB354 \uD589\uC740 \uC790\uB3D9 \uC778\uC2DD\uB429\uB2C8\uB2E4."), /* @__PURE__ */ React.createElement("label", { style: { ...btnP, display: "inline-block" } }, "\uD30C\uC77C \uC5C5\uB85C\uB4DC", /* @__PURE__ */ React.createElement("input", { type: "file", accept: ".xlsx,.xls,.csv", onChange: onFile, style: { display: "none" } })), fileErr && /* @__PURE__ */ React.createElement("p", { style: { color: C.err, fontSize: 12.5, marginTop: 12 } }, fileErr)), rows.length > 0 && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 12, margin: "20px 0 14px", flexWrap: "wrap", justifyContent: "center" } }, /* @__PURE__ */ React.createElement("button", { onClick: runBatch, disabled: batchBusy, style: { ...btnP, opacity: batchBusy ? 0.6 : 1 } }, batchBusy ? `\uCC98\uB9AC\uC911 ${batchDone}/${rows.length}` : `\uC77C\uAD04 \uC815\uC81C (${rows.length}\uAC74)`), bridgeUp && (stat.CONFIRMED || 0) > 0 && /* @__PURE__ */ React.createElement(
    "button",
    {
      onClick: lookupBatchUniqueNo,
      disabled: batchRegBusy || batchDone === 0,
      style: {
        ...btnP,
        background: `linear-gradient(135deg, ${C.ok}, ${C.cyan})`,
        opacity: batchRegBusy || batchDone === 0 ? 0.5 : 1
      }
    },
    batchRegBusy ? `\uB4F1\uAE30\uC870\uD68C\uC911 ${batchRegDone}/${stat.CONFIRMED || 0}` : `\uB4F1\uAE30\uACE0\uC720\uBC88\uD638 \uC77C\uAD04\uC870\uD68C (${stat.CONFIRMED || 0}\uAC74)`
  ), /* @__PURE__ */ React.createElement("button", { onClick: downloadXlsx, disabled: batchDone === 0, style: { ...btnS, opacity: batchDone === 0 ? 0.5 : 1 } }, "\uACB0\uACFC \uC5D1\uC140 \uB2E4\uC6B4\uB85C\uB4DC"), batchDone > 0 && /* @__PURE__ */ React.createElement("span", { style: { fontFamily: mono, fontSize: 12, color: C.dim } }, "\uD655\uC815 ", stat.CONFIRMED || 0, " \xB7 \uD655\uC778\uD544\uC694 ", stat.AMBIGUOUS || 0, " \xB7 \uC2E4\uD328 ", stat.FAILED || 0)), !bridgeUp && batchDone > 0 && /* @__PURE__ */ React.createElement("p", { style: { fontSize: 11, color: C.faint, textAlign: "center", margin: "-4px 0 12px" } }, "\uB4F1\uAE30\uACE0\uC720\uBC88\uD638 \uC77C\uAD04\uC870\uD68C\uB294 \uB85C\uCEEC \uBE0C\uB9AC\uC9C0(iros_bridge.py) \uC2E4\uD589 \uC2DC \uD65C\uC131\uD654\uB429\uB2C8\uB2E4."), /* @__PURE__ */ React.createElement("div", { style: { background: C.card, border: `1px solid ${C.cardLine}`, borderRadius: 13, overflow: "auto", backdropFilter: "blur(10px)" } }, /* @__PURE__ */ React.createElement("table", { style: { width: "100%", borderCollapse: "collapse", fontSize: 12.5 } }, /* @__PURE__ */ React.createElement("thead", null, /* @__PURE__ */ React.createElement("tr", { style: { textAlign: "left" } }, ["#", "\uC785\uB825", "\uC0C1\uD0DC", "\uC815\uC81C \uACB0\uACFC", "PNU", "\uB4F1\uAE30\uACE0\uC720\uBC88\uD638"].map((h) => /* @__PURE__ */ React.createElement("th", { key: h, style: {
    padding: "11px 14px",
    borderBottom: `1px solid ${C.cardLine}`,
    fontSize: 10.5,
    color: C.faint,
    fontWeight: 700,
    letterSpacing: "0.14em"
  } }, h)))), /* @__PURE__ */ React.createElement("tbody", null, rows.map((row, i) => {
    const r = row.result;
    return /* @__PURE__ */ React.createElement("tr", { key: i, style: { borderBottom: `1px solid rgba(255,255,255,0.045)` } }, /* @__PURE__ */ React.createElement("td", { style: { padding: "9px 14px", fontFamily: mono, fontSize: 11, color: C.faint } }, i + 1), /* @__PURE__ */ React.createElement("td", { style: { padding: "9px 14px", maxWidth: 185, wordBreak: "break-all", color: C.ink } }, row.raw), /* @__PURE__ */ React.createElement("td", { style: { padding: "9px 14px" } }, r ? /* @__PURE__ */ React.createElement(StatusDot, { status: r.status }) : /* @__PURE__ */ React.createElement("span", { style: { color: C.faint, fontSize: 11 } }, "\uB300\uAE30")), /* @__PURE__ */ React.createElement("td", { style: { padding: "9px 14px", maxWidth: 245, wordBreak: "break-all" } }, r?.status === "CONFIRMED" && /* @__PURE__ */ React.createElement("span", { style: { color: C.ink } }, r.jibunAddr), r?.status === "AMBIGUOUS" && /* @__PURE__ */ React.createElement("span", { style: { color: C.dim } }, r.message), r?.status === "FAILED" && /* @__PURE__ */ React.createElement("span", { style: { color: C.faint } }, r.message)), /* @__PURE__ */ React.createElement("td", { style: { padding: "9px 14px", whiteSpace: "nowrap", fontFamily: mono, fontSize: 12, letterSpacing: "0.06em" } }, r?.pnu ? /* @__PURE__ */ React.createElement("span", null, /* @__PURE__ */ React.createElement("span", { style: { color: C.cyan } }, r.pnu.slice(0, 10)), /* @__PURE__ */ React.createElement("span", { style: { color: C.indigo } }, r.pnu.slice(10, 11)), /* @__PURE__ */ React.createElement("span", { style: { color: "#A78BFA" } }, r.pnu.slice(11, 15)), /* @__PURE__ */ React.createElement("span", { style: { color: "#67E8F9" } }, r.pnu.slice(15, 19))) : ""), /* @__PURE__ */ React.createElement("td", { style: { padding: "9px 14px", whiteSpace: "nowrap", fontFamily: mono, fontSize: 12 } }, row.reg?.status === "RESOLVED" && /* @__PURE__ */ React.createElement("span", { style: { color: C.ok, fontWeight: 700 } }, row.reg.unique_no), row.reg?.status === "MULTIPLE" && /* @__PURE__ */ React.createElement("span", { style: { color: C.warn } }, row.reg.candidates.length, "\uAC74"), row.reg && !["RESOLVED", "MULTIPLE"].includes(row.reg.status) && /* @__PURE__ */ React.createElement("span", { style: { color: C.err, fontSize: 11 } }, row.reg.status)));
  })))))))));
}

const _root = ReactDOM.createRoot(document.getElementById("root"));
_root.render(React.createElement(AddrRefineTestGui));
