#!/usr/bin/env node
/**
 * font-weight 硬编码 → var(--font-weight-*) token
 * foundation 新增: --font-weight-medium(500) / semibold(600) / bold(700)
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PAGES_DIR = path.resolve(__dirname, "../src/pages");

const FW_MAP = {
  "500": "var(--font-weight-medium)",
  "600": "var(--font-weight-semibold)",
  "700": "var(--font-weight-bold)",
};

let totalReplacements = 0;
const fileList = [];

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

  // --- 1. scoped-style 块内 ---
  src = src.replace(
    /(<style[^>]*>)([\s\S]*?)(<\/style>)/g,
    (match, openTag, body, closeTag) => {
      let count = 0;
      const replaced = body.replace(
        /(font-weight)\s*:\s*(500|600|700)\b/gi,
        (fullMatch, propName, value) => {
          count++;
          return `${propName}: ${FW_MAP[value]}`;
        }
      );
      if (count > 0) {
        totalReplacements += count;
        console.log(`  [scoped] ${path.basename(filePath)}: ${count} 处`);
      }
      return openTag + replaced + closeTag;
    }
  );

  // --- 2. template inline style ---
  src = src.replace(
    /(style="[^"]*)font-weight\s*:\s*(500|600|700)(\s*;?[^"]*")/g,
    (fullMatch, prefix, value, suffix) => {
      totalReplacements++;
      return `${prefix}font-weight: ${FW_MAP[value]}${suffix}`;
    }
  );

  if (src !== original) {
    fs.writeFileSync(filePath, src, "utf-8");
  }
}

console.log(`\n总计: ${totalReplacements} 处 font-weight → token`);
