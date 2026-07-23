export const PIPELINE_VERSION = "addr-pipeline-v7";

export const MODULE_VERSIONS = Object.freeze({
  COMMON_NORMALIZE: "4",
  UNIT_PARSE: "9",
  JUSO_LOOKUP: "9",
  NAVER_RECOVERY: "5",
  REGION_VALIDATE: "6",
  GROUP_HINT: "3",
  DONGSO_RECOVERY: "2",
  GROUP_PROPAGATION: "5",
  OLD_ADDRESS: "4",
  MULTILOT_RECOVERY: "1",
  OWNER_UNIT_RECOVERY: "1",
  SUB_BUILDING: "2",
  BUILDING_CANDIDATE_INTENT: "1",
  EXPLICIT_PARCEL_INTENT: "2"
});

function canonical(value) {
  if (value === null || value === undefined) return null;
  if (Array.isArray(value)) return value.map(canonical);
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value).sort().map((key) => [key, canonical(value[key])])
    );
  }
  if (typeof value === "bigint") return String(value);
  return value;
}

export function stableSerialize(value) {
  return JSON.stringify(canonical(value));
}

export function fingerprintValue(value) {
  const text = stableSerialize(value);
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  const mask = 0xffffffffffffffffn;
  for (let i = 0; i < text.length; i++) {
    hash ^= BigInt(text.charCodeAt(i));
    hash = (hash * prime) & mask;
  }
  return `fnv1a64:${hash.toString(16).padStart(16, "0")}`;
}

function selectedModuleVersions(appliedModules) {
  const names = Array.isArray(appliedModules) && appliedModules.length
    ? appliedModules
    : ["COMMON_NORMALIZE"];
  return Object.fromEntries(
    [...new Set(names)].sort().map((name) => [name, MODULE_VERSIONS[name] || "unknown"])
  );
}

export function dependencyFingerprint(row, upstreamEvidence = {}, appliedModules = null) {
  return fingerprintValue({
    pipelineVersion: PIPELINE_VERSION,
    moduleVersions: selectedModuleVersions(appliedModules),
    input: {
      raw: String(row?.raw || ""),
      zip: String(row?.zip || ""),
      unitOverride: row?.unitOverride || null,
      extra: Array.isArray(row?.extra) ? row.extra : []
    },
    upstreamEvidence
  });
}

function resultForFingerprint(result) {
  const omitted = new Set([
    "resultFingerprint", "dependencyFingerprint", "pipelineVersion",
    "appliedModules", "moduleVersions", "at"
  ]);
  return Object.fromEntries(
    Object.entries(result || {}).filter(([key]) => !omitted.has(key))
  );
}

export function resultFingerprint(result) {
  return fingerprintValue(resultForFingerprint(result));
}

export function appliedModulesFor(result, upstreamEvidence = {}) {
  const modules = ["COMMON_NORMALIZE", "UNIT_PARSE"];
  if (result?.jusoQuery || result?.source === "juso") modules.push("JUSO_LOOKUP");
  if (result?.source === "naver" || result?.searchLevel === "L3") modules.push("NAVER_RECOVERY");
  if (result?.validation) modules.push("REGION_VALIDATE");
  if (upstreamEvidence.groupHints) modules.push("GROUP_HINT");
  if (upstreamEvidence.dongsoAnchor) modules.push("DONGSO_RECOVERY");
  if (upstreamEvidence.propagatedFrom) modules.push("GROUP_PROPAGATION");
  if (upstreamEvidence.oldAddressMap || result?.validation?.oldAddressMap) modules.push("OLD_ADDRESS");
  if (result?.multiLotRecovery || result?.source === "juso-land-multilot") modules.push("MULTILOT_RECOVERY");
  if (result?.ownerUnitRecovery || result?.source === "owner-unit-recovery") modules.push("OWNER_UNIT_RECOVERY");
  return [...new Set(modules)].sort();
}

export function attachPipelineMetadata(row, result, upstreamEvidence = {}) {
  const appliedModules = appliedModulesFor(result, upstreamEvidence);
  const enriched = {
    ...(result || {}),
    pipelineVersion: PIPELINE_VERSION,
    moduleVersions: selectedModuleVersions(appliedModules),
    dependencyFingerprint: dependencyFingerprint(row, upstreamEvidence, appliedModules),
    appliedModules
  };
  enriched.resultFingerprint = resultFingerprint(enriched);
  return enriched;
}

export function isReusableResult(row, upstreamEvidence = {}) {
  const result = row?.result;
  if (!result) return false;
  if (result.status === "SYSTEM_ERROR") return false;
  if (result.status === "FAILED" && result.failKind === "TRANSIENT") return false;
  if (result.pipelineVersion !== PIPELINE_VERSION) return false;
  if (!Array.isArray(result.appliedModules) || !result.appliedModules.length) return false;
  if (result.dependencyFingerprint !== dependencyFingerprint(row, upstreamEvidence, result.appliedModules)) return false;
  return result.resultFingerprint === resultFingerprint(result);
}

export function cloneResult(result) {
  if (typeof structuredClone === "function") return structuredClone(result);
  return JSON.parse(JSON.stringify(result));
}
