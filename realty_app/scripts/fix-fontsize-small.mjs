#!/usr/bin/env node
/**
 * 视觉优化：font-size 18rpx/19rpx → var(--font-micro) (20rpx)
 * 这些比 foundation 最小字体 token 还小，是"字体太小"的直接原因
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PAGES_DIR = path.resolve(__dirname, "../src/pages");

const fileList = [];
let total = 0;

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.name.endsWith(".vue")) fileList.push(full);
  }
}

walk(PAGES_DIR);

for (const filePath of fileList) {
  let src = fs.readFileSync(filePath, "utf-8");
  const original = src;

  src = src.replace(/(font-size\s*:\s*)(18|19)rpx\b/gi, (m, prefix) => {
    total++;
    return `${prefix}var(--font-micro)`;
  });

  if (src !== original) {
    console.log(`  ${path.basename(path.dirname(filePath))}: fixed`);
    fs.writeFileSync(filePath, src, "utf-8");
  }
}

console.log(`\n总计: ${total} 处 font-size 18/19rpx → var(--font-micro)`);
