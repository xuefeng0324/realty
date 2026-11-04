#!/usr/bin/env node
/**
 * 小字号统一归口到 token（与 v1.123.68 的字号阶梯同步上移一档）：
 *   font-size: 20rpx → var(--font-micro)    (22rpx)
 *   font-size: 22rpx → var(--font-caption)  (24rpx)
 *   font-size: 24rpx → var(--font-body-sm)  (26rpx)
 * 只替换精确的 `font-size: Nrpx`，不触碰 calc() / 简写 / 其他单位。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PAGES_DIR = path.resolve(__dirname, "../src/pages");

const MAP = {
  20: "var(--font-micro)",
  22: "var(--font-caption)",
  24: "var(--font-body-sm)",
};

const files = [];
function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full);
    else if (e.name.endsWith(".vue")) files.push(full);
  }
}
walk(PAGES_DIR);

let total = 0;
const perFile = [];

for (const f of files) {
  let src = fs.readFileSync(f, "utf-8");
  const before = src;

  src = src.replace(/(font-size\s*:\s*)(20|22|24)rpx\b/gi, (m, prefix, size) => {
    total++;
    return `${prefix}${MAP[size]}`;
  });

  if (src !== before) {
    const count = (before.match(/font-size\s*:\s*(20|22|24)rpx\b/gi) || []).length;
    perFile.push(`${path.basename(path.dirname(f))}: ${count}`);
    fs.writeFileSync(f, src, "utf-8");
  }
}

console.log(perFile.join("\n"));
console.log(`\n总计 ${total} 处小字号 → token`);
