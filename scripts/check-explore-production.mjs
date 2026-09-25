#!/usr/bin/env node
// Read-only production check. Compare the deployed game with the checked-out main branch.
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const base = new URL(process.env.EXPLORE_DEPLOY_URL || "https://apps-demo.muyang23333.top/yuanbai/explore/");
const requireLeaderboard = process.argv.includes("--require-leaderboard") || process.env.REQUIRE_LEADERBOARD === "true";
const assets = ["index.html", "core.js", "game.js", "style.css", "yuanbai-art.webp"];
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
const summary = [];

if (base.protocol !== "https:" && base.hostname !== "localhost" && base.hostname !== "127.0.0.1") {
  throw new Error("Production check requires HTTPS (except local test servers).");
}
if (!base.pathname.endsWith("/")) base.pathname += "/";

async function get(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(20000), cache: "no-store" });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return response;
}

async function verifyAssets() {
  const results = await Promise.all(assets.map(async (asset) => {
    const local = await readFile(path.join(root, "public/explore", asset));
    const remoteUrl = asset === "index.html" ? base : new URL(asset, base);
    const remote = Buffer.from(await (await get(remoteUrl)).arrayBuffer());
    if (digest(local) !== digest(remote)) throw new Error(`${asset}: online file differs from this revision`);
    return asset;
  }));
  summary.push(`✅ 线上资源与当前 main 一致：${results.join(", ")}`);
}

async function verifyLeaderboard() {
  try {
    // The API is at the domain root, independent of the app's /yuanbai/ path.
    const url = new URL("/api/yuanbai/game/leaderboard?page=1&season=current", base);
    const data = await (await get(url)).json();
    if (!Array.isArray(data.items) || !Number.isInteger(data.total) || !Number.isInteger(data.page)) {
      throw new Error("response is not a leaderboard page");
    }
    summary.push("✅ 排行榜读取正常；通关提交仍需人工验收");
  } catch (error) {
    const message = `排行榜不可用（${error.message}）。游戏目前只能以练习模式游玩，成绩无法入榜。`;
    summary.push(`⚠️ ${message}`);
    if (requireLeaderboard) throw new Error(message);
    console.warn(message);
  }
}

let deployed = false;
for (let attempt = 1; attempt <= 5; attempt++) {
  try {
    await verifyAssets();
    deployed = true;
    break;
  } catch (error) {
    if (attempt === 5) {
      summary.push(`❌ 五次检查后仍未部署当前版本：${error.message}`);
      break;
    }
    console.log(`第 ${attempt} 次检查：${error.message}，30 秒后重试。`);
    await pause(30000);
  }
}

if (deployed) {
  try {
    await verifyLeaderboard();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
} else {
  process.exitCode = 1;
}

const report = `## 探索元白线上验收\n\n- ${summary.join("\n- ")}\n\n[打开探索元白](${base})\n`;
console.log(report);
if (process.env.GITHUB_STEP_SUMMARY) {
  const { appendFile } = await import("node:fs/promises");
  await appendFile(process.env.GITHUB_STEP_SUMMARY, report);
}
