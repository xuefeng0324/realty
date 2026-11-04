// tests/e2e/smoke_visual_quality.mjs
// 视觉质量门禁（v1.123.71）：把人工移动端巡检的三项检查固化成断言。
//
//   1) 文本被裁切：叶子文本元素超出最近 overflow:hidden/clip 祖先边界 >2px（X 或 Y），
//      且叶子自身没有 ellipsis / -webkit-line-clamp（省略号与行数截断是刻意设计，放行），
//      且不在 scroll-view / swiper 内部（横向滚动条是设计意图）。
//      对应真实 bug：v1.123.69 修复的 community .cm-grid repeat(5,1fr) 溢出 37px。
//   2) 最小字号：可见叶子文本的 computed font-size 低于最小 token 探针值 - 1.5px
//      （--font-micro = 22rpx ≈ 11px；抓绕过 token 的 9px/10px 硬编码回归）。
//      可用 E2E_MIN_FONT_PX 覆盖阈值（如做反向验证：设 20 应当失败）。
//   3) 静态扫描：src/pages/**/*.vue 禁止 grid-template-columns: repeat(N, 1fr)
//      （1fr = minmax(auto,1fr)，内容 min-content 会把整行撑出容器；
//      必须写 minmax(0,1fr) 让轨道可收缩）。
//
// 运行方式：
//   node tests/e2e/smoke_visual_quality.mjs          # 需要先起 dev/build 服务
//   run_suite.mjs extended 组 + CI realty-app-e2e workflow 均会执行本脚本。
import { chromium } from "playwright";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdirSync, writeFileSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ARTIFACTS_DIR = resolve(__dirname, "artifacts");

const BASE_URL = (
  process.env.E2E_BASE_URL ??
  process.env.E2E_URL ??
  "http://127.0.0.1:5174"
).replace(/\/$/, "");
const MIN_FONT_OVERRIDE = Number.parseFloat(process.env.E2E_MIN_FONT_PX ?? "");

// 与 smoke_full_pages.mjs 的 22 路由矩阵保持一致（含 pages.json 校验逻辑见该脚本）
const PAGES = [
  { path: "/#/pages/dashboard/dashboard", name: "dashboard", wait: 2200 },
  { path: "/#/pages/listing-filter/listing-filter", name: "listing-filter" },
  { path: "/#/pages/listing-detail/listing-detail?id=1227", name: "listing-detail" },
  { path: "/#/pages/community/community?id=24", name: "community", wait: 1800 },
  { path: "/#/pages/school/school", name: "school" },
  { path: "/#/pages/school-detail/school-detail?id=1", name: "school-detail" },
  { path: "/#/pages/stats70/stats70", name: "stats70" },
  { path: "/#/pages/wangqian/wangqian", name: "wangqian" },
  { path: "/#/pages/settings/settings", name: "settings" },
  { path: "/#/pages/gov-webview/gov-webview", name: "gov-webview" },
  { path: "/#/pages/map-view/map-view", name: "map-view", wait: 1800 },
  { path: "/#/pages/market/market", name: "market" },
  { path: "/#/pages/upgrade-popup/upgrade-popup", name: "upgrade-popup" },
  { path: "/#/pages/macro-rates/macro-rates", name: "macro-rates" },
  { path: "/#/pages/macro-fx/macro-fx", name: "macro-fx" },
  { path: "/#/pages/macro-industry/macro-industry", name: "macro-industry" },
  { path: "/#/pages/macro-region/macro-region", name: "macro-region" },
  { path: "/#/pages/macro-trade/macro-trade", name: "macro-trade" },
  { path: "/#/pages/data-tools/data-tools", name: "data-tools", wait: 1800 },
  { path: "/#/pages/supply/supply", name: "supply" },
  { path: "/#/pages/trend-analysis/trend-analysis", name: "trend-analysis" },
  { path: "/#/pages/map-analysis/map-analysis", name: "map-analysis" }
];

// ---------------------------------------------------------------
// 3) 静态扫描：repeat(N, 1fr) 回归护栏（纯文件系统检查，先于浏览器启动）
// ---------------------------------------------------------------
const SRC_SCAN_DIRS = [
  resolve(__dirname, "../../src/pages"),
  resolve(__dirname, "../../src/components")
];
const gridRegressions = [];

function walkVueFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkVueFiles(full));
    else if (entry.name.endsWith(".vue")) out.push(full);
  }
  return out;
}

const repoRoot = resolve(__dirname, "../..");
for (const dir of SRC_SCAN_DIRS) {
  for (const file of walkVueFiles(dir)) {
    const src = readFileSync(file, "utf8");
    const lines = src.split("\n");
    for (let i = 0; i < lines.length; i++) {
      if (/grid-template-columns\s*:\s*[^;]*repeat\(\s*\d+\s*,\s*1fr\s*\)/.test(lines[i])) {
        gridRegressions.push(`${relative(repoRoot, file)}:${i + 1} ${lines[i].trim()}`);
      }
    }
  }
}

if (gridRegressions.length > 0) {
  console.error(`静态扫描失败：发现 ${gridRegressions.length} 处 repeat(N, 1fr)（应为 minmax(0, 1fr)）：`);
  for (const hit of gridRegressions) console.error(`  - ${hit}`);
  process.exitCode = 1;
} else {
  console.log("[静态扫描] repeat(N,1fr) 回归护栏：0 处，通过");
}

// ---------------------------------------------------------------
// 1) + 2) 运行时检查：每页裁切文本 / 最小字号
// ---------------------------------------------------------------
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await context.newPage();
const runtimeIssues = [];
const pageStats = [];

try {
  for (const target of PAGES) {
    await page.goto(`${BASE_URL}${target.path}`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(target.wait ?? 1000);

    const result = await page.evaluate((override) => {
      const isVisible = (element) => {
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return (
          style.display !== "none" &&
          style.visibility !== "hidden" &&
          rect.width > 1 &&
          rect.height > 1
        );
      };
      const hasDirectText = (element) => {
        for (const node of element.childNodes) {
          if (node.nodeType === 3 && node.textContent.trim().length > 0) return true;
        }
        return false;
      };
      const describe = (element) => {
        const cls = typeof element.className === "string" && element.className
          ? `.${element.className.trim().split(/\s+/).slice(0, 2).join(".")}`
          : "";
        return `${element.tagName.toLowerCase()}${cls} “${element.textContent.trim().slice(0, 24)}”`;
      };

      // --font-micro 探针：变量定义在 uni-page-body 上，探针必须挂进它才能解析
      const host = document.querySelector("uni-page-body") ?? document.body;
      const probe = document.createElement("div");
      probe.style.cssText = "position:absolute;visibility:hidden;font-size:var(--font-micro)";
      host.appendChild(probe);
      const probePx = Number.parseFloat(getComputedStyle(probe).fontSize);
      probe.remove();

      const minFontPx = Number.isFinite(override) && override > 0
        ? override
        : (Number.isFinite(probePx) ? probePx - 1.5 : 9.5);

      const leaves = Array.from(document.querySelectorAll("*"))
        .filter((element) => isVisible(element) && hasDirectText(element))
        .filter((element) => !String(element.className).includes("luna-dom-highlighter"));

      const clipped = [];
      const tinyFonts = [];

      for (const leaf of leaves) {
        const style = getComputedStyle(leaf);

        // 2) 最小字号
        const fontPx = Number.parseFloat(style.fontSize);
        if (Number.isFinite(fontPx) && fontPx < minFontPx) {
          tinyFonts.push(`${describe(leaf)} font-size ${fontPx}px < ${minFontPx.toFixed(1)}px`);
        }

        // 1) 裁切：省略号 / 行数截断是刻意设计
        if (style.textOverflow === "ellipsis") continue;
        if (style.webkitLineClamp && style.webkitLineClamp !== "none") continue;
        // 横向滚动容器（页签条等）与轮播内部轨道是设计意图
        if (leaf.closest("scroll-view, .uni-scroll-view, swiper, .uni-swiper, .hero-scroll")) continue;

        const leafRect = leaf.getBoundingClientRect();
        let ancestor = leaf.parentElement;
        while (ancestor && ancestor !== document.documentElement) {
          const ancestorStyle = getComputedStyle(ancestor);
          const clipsX = ancestorStyle.overflowX === "hidden" || ancestorStyle.overflowX === "clip";
          const clipsY = ancestorStyle.overflowY === "hidden" || ancestorStyle.overflowY === "clip";
          if (clipsX || clipsY) {
            const ancestorRect = ancestor.getBoundingClientRect();
            const overX = clipsX ? Math.max(leafRect.right - ancestorRect.right, ancestorRect.left - leafRect.left) : 0;
            const overY = clipsY ? Math.max(leafRect.bottom - ancestorRect.bottom, ancestorRect.top - leafRect.top) : 0;
            if (overX > 2 || overY > 2) {
              clipped.push(
                `${describe(leaf)} 超出 ${ancestor.tagName.toLowerCase()}.${String(ancestor.className).split(/\s+/)[0] || ""} 边界 X+${Math.max(0, Math.round(overX))}px/Y+${Math.max(0, Math.round(overY))}px`
              );
            }
            break; // 最近裁剪祖先即裁决者
          }
          ancestor = ancestor.parentElement;
        }
      }

      return { minFontPx, leaves: leaves.length, clipped, tinyFonts };
    }, MIN_FONT_OVERRIDE);

    pageStats.push({
      page: target.name,
      leaves: result.leaves,
      clipped: result.clipped.length,
      tinyFonts: result.tinyFonts.length
    });

    for (const item of result.clipped) runtimeIssues.push(`[${target.name}] 文本被裁切：${item}`);
    for (const item of result.tinyFonts) runtimeIssues.push(`[${target.name}] 字号过小：${item}`);
  }

  mkdirSync(ARTIFACTS_DIR, { recursive: true });
  writeFileSync(
    join(ARTIFACTS_DIR, "visual-quality.json"),
    JSON.stringify({ baseUrl: BASE_URL, minFontPx: MIN_FONT_OVERRIDE || "auto(--font-micro-1.5)", pages: pageStats, issues: runtimeIssues }, null, 2)
  );

  console.log("\n[逐页统计]");
  for (const stat of pageStats) {
    console.log(
      `  ${stat.page.padEnd(16)} 文本叶子 ${String(stat.leaves).padStart(4)}  裁切 ${stat.clipped}  小字 ${stat.tinyFonts}`
    );
  }

  if (runtimeIssues.length > 0) {
    console.error(`\n视觉质量审计失败：${runtimeIssues.length} 项`);
    for (const issue of runtimeIssues) console.error(`- ${issue}`);
    process.exitCode = 1;
  } else {
    console.log(`\n视觉质量审计通过：${PAGES.length} 页面，0 裁切 / 0 小字`);
  }
} finally {
  await browser.close();
}
