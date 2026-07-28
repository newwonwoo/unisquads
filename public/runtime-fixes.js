// Runtime compatibility fixes loaded before app.js.
// Keep this file dependency-free so it can protect the main module during startup.

// TestLogPanel is declared outside AddrRefineTestGui but uses btnS, which was
// previously local to AddrRefineTestGui. A classic-script global binding keeps
// the panel render-safe until the style is moved into the component module.
var btnS = window.btnS || Object.freeze({
  padding: "9px 16px",
  fontSize: 12.5,
  fontWeight: 700,
  fontFamily: "'Pretendard Variable',Pretendard,-apple-system,'Malgun Gothic',sans-serif",
  color: "#E7EAF2",
  background: "rgba(15,19,28,0.7)",
  border: "1px solid rgba(255,255,255,0.16)",
  borderRadius: 8,
  cursor: "pointer"
});
window.btnS = btnS;

(() => {
  const APARTMENT_INTENT = /(아파트|푸르지오|래미안|자이|힐스테이트|아이파크|더샵|e편한|롯데캐슬|주공|하늘채|센트레빌|데시앙|해링턴|파밀리에|리슈빌|스위트|르네상스|맨션|빌라|오피스텔)/i;
  const EXPLICIT_ANCILLARY_INTENT = /(경로당|노인정|관리사무소|관리실|어린이집|유치원|상가|공인중개|중개사무소|주차장|커뮤니티|휘트니스|피트니스)/i;
  const ANCILLARY_TITLE = /(경로당|노인정|관리사무소|관리실|입주자대표|어린이집|유치원|상가|공인중개|중개사무소|부동산|주차장|커뮤니티|게스트하우스|독서실|휘트니스|피트니스)/i;
  const ANCILLARY_CATEGORY = /(경로당|노인정|복지시설|관리사무소|어린이집|유치원|상가|공인중개|중개사무소|주차장|커뮤니티센터|체육시설)/i;
  const ANCILLARY_SUFFIX = /(?:경로당|노인정|관리사무소|관리실|입주자대표(?:회의)?|어린이집|유치원|제?상가동|상가|공인중개사무소|공인중개|중개사무소|부동산|주차장|커뮤니티센터|커뮤니티|게스트하우스|독서실|휘트니스|피트니스)$/i;

  function plainText(value) {
    return String(value || "")
      .replace(/<[^>]*>/g, "")
      .replace(/&amp;/gi, "&")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
      .replace(/\s+/g, " ")
      .trim();
  }

  function compactKey(value) {
    return plainText(value)
      .toLowerCase()
      .replace(/[^0-9a-z가-힣]/g, "");
  }

  function isAncillaryItem(item) {
    const title = plainText(item?.title);
    const category = plainText(item?.category);
    return ANCILLARY_TITLE.test(title) || ANCILLARY_CATEGORY.test(category);
  }

  function ancillaryParentTitle(item) {
    let title = plainText(item?.title);
    const original = title;
    for (let i = 0; i < 2; i++) {
      const stripped = title
        .replace(ANCILLARY_SUFFIX, "")
        .replace(/[\s\-·,/]+$/g, "")
        .trim();
      if (stripped === title) break;
      title = stripped;
    }
    return title && title !== original ? title : "";
  }

  function recoverAncillaryParentItems(items, query) {
    const queryKey = compactKey(query);
    const seen = new Set();
    const recovered = [];
    for (const item of items) {
      if (!isAncillaryItem(item)) continue;
      const parentTitle = ancillaryParentTitle(item);
      const parentKey = compactKey(parentTitle);
      const address = plainText(item?.address || item?.roadAddress);
      if (parentKey.length < 4 || !address) continue;
      if (!queryKey.includes(parentKey)) continue;
      const identity = `${parentKey}|${compactKey(item?.address)}|${compactKey(item?.roadAddress)}`;
      if (seen.has(identity)) continue;
      seen.add(identity);
      recovered.push({
        ...item,
        title: parentTitle,
        category: "",
        __ancillaryParentRecovered: true
      });
    }
    return recovered;
  }

  function filterNaverItems(items, query) {
    const source = Array.isArray(items) ? items : [];
    const normalizedQuery = plainText(query);
    if (!APARTMENT_INTENT.test(normalizedQuery)) return source;
    if (EXPLICIT_ANCILLARY_INTENT.test(normalizedQuery)) return source;
    const primary = source.filter((item) => !isAncillaryItem(item));
    if (primary.length) return primary;
    return recoverAncillaryParentItems(source, normalizedQuery);
  }

  const api = Object.freeze({
    plainText,
    compactKey,
    isAncillaryItem,
    ancillaryParentTitle,
    recoverAncillaryParentItems,
    filterNaverItems
  });
  window.__ADDR_RUNTIME_FIXES__ = api;

  if (typeof window.fetch !== "function" || window.__ADDR_NAVER_FETCH_FILTER__) return;
  window.__ADDR_NAVER_FETCH_FILTER__ = true;
  const originalFetch = window.fetch.bind(window);

  window.fetch = async function patchedFetch(input, init) {
    const response = await originalFetch(input, init);
    const requestUrl = typeof input === "string" ? input : String(input?.url || "");
    let parsedUrl;
    try {
      parsedUrl = new URL(requestUrl, window.location?.href || "http://localhost/");
    } catch {
      return response;
    }
    if (!/\/api\/naver\/?$/.test(parsedUrl.pathname)) return response;

    const query = parsedUrl.searchParams.get("query") || "";
    let data;
    try {
      data = await response.clone().json();
    } catch {
      return response;
    }
    if (!data || !Array.isArray(data.items)) return response;

    const filteredItems = filterNaverItems(data.items, query);
    if (
      filteredItems.length === data.items.length &&
      filteredItems.every((item, index) => item === data.items[index])
    ) return response;

    const headers = new Headers(response.headers);
    headers.set("content-type", "application/json; charset=utf-8");
    return new Response(JSON.stringify({ ...data, items: filteredItems }), {
      status: response.status,
      statusText: response.statusText,
      headers
    });
  };
})();
