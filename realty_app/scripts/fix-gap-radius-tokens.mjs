#!/usr/bin/env node
/**
 * gap 和 border-radius 高频硬编码 → 新增 token
 * foundation 新增:
 *   --space-gap-xs/sm/md  (4/6/10rpx)
 *   --radius-xxs/xs/sm2/md2 (4/6/8/12rpx)
 *
 * v2 改进：gap 和 border-radius 多值声明逐值映射（只替换可映射部分，保留 0/inherit 等）
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PAGES_DIR = path.resolve(__dirname, "../src/pages");

const GAP_MAP = {
  "2rpx": "var(--space-gap-2xs)",
  "4rpx": "var(--space-gap-xs)",
  "6rpx": "var(--space-gap-sm)",
  "10rpx": "var(--space-gap-md)",
  "14rpx": "var(--space-gap-md2)",
  "18rpx": "var(--space-gap-lg)",
};

const RADIUS_MAP = {
  "2rpx": "var(--radius-xxxs)",
  "4rpx": "var(--radius-xxs)",
  "6rpx": "var(--radius-xs)",
  "8rpx": "var(--radius-sm2)",
  "12rpx": "var(--radius-md2)",
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

function tryMapValues(valuesStr, map) {
  const parts = valuesStr.trim().split(/\s+/);
  let anyChanged = false;
  const newParts = parts.map((v) => {
    const trimmed = v.trim();
    if (map[trimmed]) {
      anyChanged = true;
      return map[trimmed];
    }
    return v; // 0 / inherit / 未映射的零星值 保留原样
  });
  return anyChanged ? newParts.join(" ") : null;
}

for (const filePath of fileList) {
  let src = fs.readFileSync(filePath, "utf-8");
  const original = src;

  // --- 1. scoped-style 块 ---
  src = src.replace(
    /(<style[^>]*>)([\s\S]*?)(<\/style>)/g,
    (match, openTag, body, closeTag) => {
      let count = 0;

      let replaced = body.replace(
        /(gap)\s*:\s*([^;}\n]+)/gi,
        (fullMatch, propName, values) => {
          const mapped = tryMapValues(values, GAP_MAP);
          if (mapped) {
            count++;
            return `${propName}: ${mapped}`;
          }
          return fullMatch;
        }
      );

      replaced = replaced.replace(
        /(border-radius)\s*:\s*([^;}\n]+)/gi,
        (fullMatch, propName, values) => {
          const mapped = tryMapValues(values, RADIUS_MAP);
          if (mapped) {
            count++;
            return `${propName}: ${mapped}`;
          }
          return fullMatch;
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
    /(style="[^"]*)(gap|border-radius)\s*:\s*([^;"]+)(\s*;?[^"]*")/g,
    (fullMatch, prefix, propName, values, suffix) => {
      const map = propName === "gap" ? GAP_MAP : RADIUS_MAP;
      const mapped = tryMapValues(values, map);
      if (mapped) {
        totalReplacements++;
        return `${prefix}${propName}: ${mapped}${suffix}`;
      }
      return fullMatch;
    }
  );

  if (src !== original) {
    fs.writeFileSync(filePath, src, "utf-8");
  }
}

console.log(`\n总计: ${totalReplacements} 处 gap/border-radius → token`);
