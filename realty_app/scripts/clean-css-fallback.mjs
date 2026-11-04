#!/usr/bin/env node
/**
 * 清理 var(--color-TOKEN, fallback) 冗余 fallback
 * 原则：CSS 变量是继承属性，Vue scoped style 不隔离 CSS 变量继承
 *      App.vue 在 :root 定义的 token 所有页面都能继承到
 *      fallback 永远不会被用到
 *
 * v2 修复：手动括号配对，安全处理 rgba() / 嵌套 var() fallback
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

/**
 * 手动查找并替换 var(--color-TOKEN, fallback) 模式
 * 正确处理括号嵌套（rgba / 嵌套 var）
 * 只替换 fallback 不含嵌套括号的情况，嵌套的保持原样
 */
function cleanFallbacks(src) {
  let result = "";
  let i = 0;

  while (i < src.length) {
    // 找 var(--color- 开头
    const remaining = src.slice(i);
    const startMatch = remaining.match(/^var\(--(color-[a-z0-9-]+)\s*,\s/);

    if (!startMatch) {
      result += src[i];
      i++;
      continue;
    }

    const tokenName = startMatch[1];
    const startIndex = i;
    // 跳过 var(--color-XXX, 部分
    let parenDepth = 1; // 已经进了 var( 的一层
    let j = i + startMatch[0].length;

    // 向后找配对的 ')'
    while (j < src.length && parenDepth > 0) {
      if (src[j] === "(") parenDepth++;
      else if (src[j] === ")") parenDepth--;
      if (parenDepth > 0) j++;
    }

    // 此时 src[j] 是配对的 ')'
    const fullMatch = src.slice(startIndex, j + 1);

    // 判断 fallback 部分有没有嵌套括号
    // fallback 部分 = 从逗号后到配对结束前
    const commaPos = startMatch[0].indexOf(",");
    const fallbackPart = src.slice(i + startMatch[0].length, j);

    // 计算 fallback 里的括号数
    let fbParens = 0;
    for (const ch of fallbackPart) {
      if (ch === "(") fbParens++;
    }

    if (fbParens === 0) {
      // 简单 fallback：#hex / 数字 / 无括号内容 → 安全清理
      total++;
      result += `var(--${tokenName})`;
    } else {
      // 有嵌套：rgba(...) 或 var(...) → 保持原样
      result += fullMatch;
    }

    i = j + 1;
  }

  return result;
}

for (const filePath of fileList) {
  const src = fs.readFileSync(filePath, "utf-8");
  const cleaned = cleanFallbacks(src);

  if (cleaned !== src) {
    const delta = (src.length - cleaned.length) / 10; // 粗略估算
    console.log(`  ${path.basename(filePath)}: cleaned`);
    fs.writeFileSync(filePath, cleaned, "utf-8");
  }
}

console.log(`\n总计清理: ${total} 处冗余 fallback`);
