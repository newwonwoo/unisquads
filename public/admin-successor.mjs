export const ADMIN_SUCCESSOR_MAP_VERSION = "admin-successor-v1";

const RULES = Object.freeze([
  // 시군구 통폐합·승격
  { id: "SGG_MASAN_CHANGWON", kind: "SGG", from: "마산시", to: "창원시" },
  { id: "SGG_JINHAE_CHANGWON", kind: "SGG", from: "진해시", to: "창원시" },
  { id: "SGG_CHEONGWON_CHEONGJU", kind: "SGG", from: "청원군", to: "청주시" },
  { id: "SGG_DANGJIN_PROMOTION", kind: "SGG", from: "당진군", to: "당진시" },
  { id: "SGG_YEOCHEON_YEOSU_CITY", kind: "SGG", from: "여천시", to: "여수시" },
  { id: "SGG_YEOCHEON_YEOSU_COUNTY", kind: "SGG", from: "여천군", to: "여수시" },
  { id: "SGG_SAMCHEONPO_SACHEON", kind: "SGG", from: "삼천포시", to: "사천시" },
  { id: "SGG_CHUNGMU_TONGYEONG", kind: "SGG", from: "충무시", to: "통영시" },
  { id: "SGG_JANGSEUNGPO_GEOJE", kind: "SGG", from: "장승포시", to: "거제시" },
  { id: "SGG_IRI_IKSAN", kind: "SGG", from: "이리시", to: "익산시" },
  { id: "SGG_DONGGWANGYANG_GWANGYANG", kind: "SGG", from: "동광양시", to: "광양시" },
  { id: "SGG_INCHEON_SEOGU_GEOMDAN", kind: "SGG", sido: "인천", from: "서구", to: "검단구" },

  // 실데이터에서 반복 확인된 읍면동 개편. 같은 어간이라는 이유만으로는 통과시키지 않는다.
  { id: "BJD_BAEBANG_PROMOTION", kind: "BJD", from: "배방면", to: "배방읍" },
  { id: "BJD_YONGJIN_PROMOTION", kind: "BJD", from: "용진면", to: "용진읍" },
  { id: "BJD_GORYEONG_DAEGAYA", kind: "BJD", from: "고령읍", to: "대가야읍" },
  { id: "BJD_DAESO_PROMOTION", kind: "BJD", from: "대소면", to: "대소읍" },
  { id: "BJD_SONGAK_PROMOTION", kind: "BJD", from: "송악면", to: "송악읍" },
  { id: "BJD_DONGSAN_YEOUI", kind: "BJD", from: "동산동", to: "여의동" },
  { id: "BJD_GOGANGBON_GOGANG", kind: "BJD", from: "고강본동", to: "고강동" },
  { id: "BJD_MUNDONG_REFORM", kind: "BJD", from: "문동리", to: "문동동" }
]);

export function findAdminSuccessor(from, to, kind, context = {}) {
  const source = String(from || "").trim();
  const target = String(to || "").trim();
  const sido = String(context.sido || "").trim();
  const rule = RULES.find((item) => item.kind === kind && item.from === source &&
    item.to === target && (!item.sido || item.sido === sido));
  if (!rule) return null;
  return {
    version: ADMIN_SUCCESSOR_MAP_VERSION,
    ruleId: rule.id,
    kind: rule.kind,
    from: rule.from,
    to: rule.to,
    sido: rule.sido || sido || ""
  };
}

export function modernizeKnownAdminTokens(text) {
  const replacements = new Map(
    RULES.filter((item) => item.kind === "SGG" && !item.sido)
      .map((item) => [item.from, item.to])
  );
  return String(text || "").replace(/\s+/g, " ").trim().split(" ")
    .map((token) => replacements.get(token) || token)
    .join(" ");
}

export function findOldAdminTokens(text) {
  const source = String(text || "").replace(/[()[\]{},.·]/g, " ")
    .replace(/\s+/g, " ").trim().split(" ");
  const found = RULES.filter((rule) => source.includes(rule.from)).map((rule) => ({
    ruleId: rule.id,
    kind: rule.kind,
    from: rule.from,
    to: rule.to,
    sido: rule.sido || ""
  }));
  return found.length ? { version: ADMIN_SUCCESSOR_MAP_VERSION, rules: found } : null;
}

export function listAdminSuccessorRules() {
  return RULES.map((rule) => ({ ...rule }));
}
