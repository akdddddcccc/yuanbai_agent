#!/usr/bin/env node
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const client = path.join(root, "dist", "client");
const rootIndex = path.join(client, "index.html");
const gameIndex = path.join(client, "explore", "index.html");
const gameTexture = path.join(client, "explore", "assets", "yuanbai-floor.jpg");

for (const file of [rootIndex, gameIndex, gameTexture]) {
  if (!existsSync(file)) throw new Error("Missing Yuanbai portal build input: " + file);
}

// 静态托管直接访问 /dialogue/ 时需要一个真实 index.html；内容仍由 main.jsx 按路径切换。
const dialogueDirectory = path.join(client, "dialogue");
mkdirSync(dialogueDirectory, { recursive: true });
copyFileSync(rootIndex, path.join(dialogueDirectory, "index.html"));

console.log("Prepared Yuanbai routes: /, /dialogue/, /explore/");
