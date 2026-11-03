#!/usr/bin/env node
/**
 * 简写 margin/padding 硬编码 → var(--space-*) token
 * 同时处理 scoped-style 块和 template inline style
 *
 * 映射表：
 *   8rpx  → var(--space-1)
 *   12rpx → var(--space-2)
 *   16rpx → var(--space-3)
 *   24rpx → var(--space-4)
 *   32rpx → var(--space-5)
 *   40rpx → var(--space-6)
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PAGES_DIR = path.resolve(__dirname, "../src/pages");

const SPACE_MAP = {
  "8rpx": "var(--space-1)",
  "12rpx": "var(--space-2)",
  "16rpx": "var(--space-3)",
  "24rpx": "var(--space-4)",
  "32rpx": "var(--space-5)",
  "40rpx": "var(--space-6)",
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

  // --- 1. scoped-style 块内的简写 margin/padding ---
  src = src.replace(
    /(<style[^>]*>)([\s\S]*?)(<\/style>)/g,
    (match, openTag, body, closeTag) => {
      let count = 0;
      const replaced = body.replace(
        /(margin|padding)\s*:\s*([^;}\n]+)/gi,
        (fullMatch, propName, values) => {
          // 拆分简写值，逐个替换可映射的
          const parts = values.trim().split(/\s+/);
          let changed = false;
          const newParts = parts.map((v) => {
            const trimmed = v.trim();
            if (SPACE_MAP[trimmed]) {
              changed = true;
              return SPACE_MAP[trimmed];
            }
            return v; // 0、auto、其他 token、calc() 里的 rpx 等值不动
          });
          if (changed) {
            count++;
            return `${propName}: ${newParts.join(" ")}`;
          }
          return fullMatch; // 保持原样
        }
      );
      if (count > 0) {
        totalReplacements += count;
        console.log(`  [scoped] ${path.basename(filePath)}: ${count} 处简写替换`);
      }
      return openTag + replaced + closeTag;
    }
  );

  // --- 2. template inline style 属性中的简写 margin/padding ---
  // 匹配 style="..." 属性中的 margin: 或 padding: 后面的值
  src = src.replace(
    /(style="[^"]*)(margin|padding)\s*:\s*([^;"]+)(\s*;?[^"]*")/g,
    (fullMatch, prefix, propName, values, suffix) => {
      const parts = values.trim().split(/\s+/);
      let changed = false;
      const newParts = parts.map((v) => {
        const trimmed = v.trim();
        if (SPACE_MAP[trimmed]) {
          changed = true;
          return SPACE_MAP[trimmed];
        }
        return v;
      });
      if (changed) {
        totalReplacements++;
        console.log(`  [inline] ${path.basename(filePath)}: ${propName}: ${values.trim()} → ${newParts.join(" ")}`);
        return `${prefix}${propName}: ${newParts.join(" ")}${suffix}`;
      }
      return fullMatch;
    }
  );

  if (src !== original) {
    fs.writeFileSync(filePath, src, "utf-8");
  }
}

console.log(`\n总计: ${totalReplacements} 处简写 margin/padding → var(--space-*) token`);
