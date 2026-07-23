import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { PIPELINE_VERSION } from "../public/pipeline-contract.mjs";

const appPath = new URL("../public/app.js", import.meta.url);
const outputPath = new URL("../public/build-info.js", import.meta.url);
const appSource = await readFile(appPath);
const appAssetSha256 = createHash("sha256").update(appSource).digest("hex");
const gitCommitSha = process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA || "";
const deploymentId = process.env.VERCEL_DEPLOYMENT_ID || "";
const deployedAt = new Date().toISOString();
const shortSha = gitCommitSha ? gitCommitSha.slice(0, 7) : "local";
const appVersion = `${PIPELINE_VERSION}+${shortSha}.${appAssetSha256.slice(0, 12)}`;
const payload = {
  git_commit_sha: gitCommitSha,
  vercel_deployment_id: deploymentId,
  deployed_at: deployedAt,
  app_version: appVersion,
  app_asset_sha256: appAssetSha256
};
const source = `window.__APP_BUILD_INFO__ = Object.freeze({\n  ...${JSON.stringify(payload, null, 2)},\n  loaded_at: new Date().toISOString()\n});\n`;
await writeFile(outputPath, source, "utf8");
console.log(`Generated public/build-info.js (${appVersion})`);
