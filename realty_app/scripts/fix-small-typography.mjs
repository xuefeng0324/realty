#!/usr/bin/env node
/**
 * 视觉可读性修复：
 * 1) font-size: 21rpx → var(--font-caption)（零散的非 token 小字号统一到字幕档）
 * 2) 图表刻度 9px → 11px、11px → 12px（低于 12px 的纯像素字号）
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PAGES_DIR = path.resolve(__dirname, "../src/pages");

const files = [];
function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full);
    else if (e.name.endsWith(".vue")) files.push(full);
  }
}
walk(PAGES_DIR);

let n21 = 0;
let n9 = 0;
let n11 = 0;

for (const f of files) {
  let src = fs.readFileSync(f, "utf-8");
  const before = src;

  src = src.replace(/(font-size\s*:\s*)21rpx\b/gi, (m, p) => {
    n21++;
    return `${p}var(--font-caption)`;
  });
  src = src.replace(/(font-size\s*:\s*)9px\b/gi, (m, p) => {
    n9++;
    return `${p}11px`;
  });
  src = src.replace(/(font-size\s*:\s*)11px\b/gi, (m, p) => {
    n11++;
    return `${p}12px`;
  });

  if (src !== before) {
    fs.writeFileSync(f, src, "utf-8");
    console.log(`fixed ${path.basename(path.dirname(f))}`);
  }
}

console.log(`\n21rpx→font-caption: ${n21} 处, 9px→11px: ${n9} 处, 11px→12px: ${n11} 处`);
