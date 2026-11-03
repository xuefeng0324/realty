#!/usr/bin/env node
/**
 * gap 和 border-radius 高频硬编码 → 新增 token
 * foundation 新增:
 *   --space-gap-xs/sm/md  (4/6/10rpx)
 *   --radius-xxs/xs/sm2/md2 (4/6/8/12rpx)
 *
 * 安全原则：
 *   - 只替换完整值匹配，避免 calc() 或多值里的误匹配
 *   - border-radius 只处理单值或所有值都可映射的多值声明
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PAGES_DIR = path.resolve(__dirname, "../src/pages");

const GAP_MAP = {
  "4rpx": "var(--space-gap-xs)",
  "6rpx": "var(--space-gap-sm)",
  "10rpx": "var(--space-gap-md)",
};

const RADIUS_MAP = {
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

for (const filePath of fileList) {
  let src = fs.readFileSync(filePath, "utf-8");
  const original = src;

  // --- 1. scoped-style 块 ---
  src = src.replace(
    /(<style[^>]*>)([\s\S]*?)(<\/style>)/g,
    (match, openTag, body, closeTag) => {
      let count = 0;

      // gap 替换
      let replaced = body.replace(
        /(gap)\s*:\s*([^;}\n]+)/gi,
        (fullMatch, propName, values) => {
          const trimmed = values.trim();
          if (GAP_MAP[trimmed]) {
            count++;
            return `${propName}: ${GAP_MAP[trimmed]}`;
          }
          return fullMatch;
        }
      );

      // border-radius 替换（多值安全处理）
      replaced = replaced.replace(
        /(border-radius)\s*:\s*([^;}\n]+)/gi,
        (fullMatch, propName, values) => {
          const parts = values.trim().split(/\s+/);
          // 所有部分都必须可映射才替换
          const allMapped = parts.every((v) => RADIUS_MAP[v.trim()]);
          if (allMapped && parts.length > 0) {
            count++;
            const newParts = parts.map((v) => RADIUS_MAP[v.trim()]);
            return `${propName}: ${newParts.join(" ")}`;
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
      const trimmed = values.trim();
      if (propName === "gap") {
        if (GAP_MAP[trimmed]) {
          totalReplacements++;
          return `${prefix}gap: ${GAP_MAP[trimmed]}${suffix}`;
        }
      } else if (propName === "border-radius") {
        const parts = trimmed.split(/\s+/);
        const allMapped = parts.every((v) => RADIUS_MAP[v.trim()]);
        if (allMapped) {
          totalReplacements++;
          const newParts = parts.map((v) => RADIUS_MAP[v.trim()]);
          return `${prefix}border-radius: ${newParts.join(" ")}${suffix}`;
        }
      }
      return fullMatch;
    }
  );

  if (src !== original) {
    fs.writeFileSync(filePath, src, "utf-8");
  }
}

console.log(`\n总计: ${totalReplacements} 处 gap/border-radius → token`);
