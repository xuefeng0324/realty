// smoke_wangqian_heatmap.mjs — 「近 4 周二手网签热度榜」卡 E2E
// v1.122+ 改写：dashboard 改版为纯壳层（.home-v122 隐藏旧长页卡），
// 该卡（[data-card-key="wangqian-rank-4w"]）仍在 DOM 渲染但默认不可见（待迁移）。
// 本测试用 attached 断言验证数据层渲染 + 真实 pickCity 交互切城 + 注入样式后元素截图。
//   1. 默认 cityId=1 (广州)：卡片存在 + 至少 3 个区
//   2. pickCity 切到深圳：行数 ≥3 + 区名为深圳核心区 + Top1 金牌
//   3. 元素截图存档
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OUT_DIR = path.resolve(__dirname, "../../screenshots");
fs.mkdirSync(OUT_DIR, { recursive: true });

const BASE = (process.env.REALTY_E2E_BASE_URL || process.env.E2E_BASE_URL || "http://127.0.0.1:5174").replace(/\/$/, "");
const PAGE_URL = `${BASE}/#/pages/dashboard/dashboard`;
const CARD = "[data-card-key='wangqian-rank-4w']";
// scoped CSS 会给隐藏规则追加 [data-v-hash] 提高优先级；
// 样式表覆盖不稳，直接写内联 display:block !important（优先级最高）。
async function unhideCard(page) {
  await page.evaluate((sel) => {
    document.querySelector(sel)?.style.setProperty("display", "block", "important");
  }, CARD);
}

async function pickCity(page, cityName) {
  await page.locator("[data-home-city]").first().click({ force: true });
  await page.locator(".sheet-mask").waitFor({ state: "visible", timeout: 8000 });
  await page.locator(".sheet-item", { hasText: cityName }).first().click({ force: true });
  await page.locator(".sheet-mask").waitFor({ state: "hidden", timeout: 8000 }).catch(() => null);
  // 卡标题带城市名（近 4 周二手网签热度榜 · 深圳），等数据切到目标城市
  await page
    .locator(`${CARD} .card-title`)
    .filter({ hasText: cityName })
    .waitFor({ state: "attached", timeout: 15000 });
}

async function screenshotCard(page, filename) {
  await unhideCard(page);
  const card = page.locator(CARD);
  await card.scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  await card.screenshot({ path: path.join(OUT_DIR, filename) });
  console.log(`  截图 → ${filename}`);
}

async function run() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 420, height: 900 } });
  const page = await ctx.newPage();

  try {
    await page.goto(PAGE_URL, { waitUntil: "networkidle", timeout: 20000 });
    await page.locator(CARD).waitFor({ state: "attached", timeout: 20000 });
    console.log("[heatmap] dashboard 渲染 ✓");

    // 默认广州
    const gzRows = await page.locator(`${CARD} .wq-row`).count();
    if (gzRows < 3) throw new Error(`广州期望 ≥3 区, 实际 ${gzRows}`);
    console.log(`[heatmap] 广州区数: ${gzRows} ✓`);
    await screenshotCard(page, "smoke_wangqian_heatmap_gz.png");

    // 切到深圳（真实 pickCity 交互）
    await pickCity(page, "深圳");

    const szRows = await page.locator(`${CARD} .wq-row`).count();
    if (szRows < 3) throw new Error(`深圳期望 ≥3 区, 实际 ${szRows}`);
    console.log(`[heatmap] 深圳区数: ${szRows} ✓`);

    // 验证区名都是真实深圳区（不是广州区）
    const szNames = await page.locator(`${CARD} .wq-name`).allTextContents();
    console.log("[heatmap] 深圳区名: " + szNames.slice(0, 5).join("、") + "...");
    const gzOnly = ["白云", "黄埔", "增城", "番禺", "南沙", "花都", "从化", "荔湾", "越秀", "海珠"];
    const hasGzOnly = szNames.some((n) => gzOnly.some((g) => n.includes(g)));
    if (hasGzOnly) {
      throw new Error(`深圳区名包含广州区: ${szNames.slice(0, 5)}`);
    }
    const szOnly = ["福田", "南山", "罗湖", "宝安", "龙岗", "龙华"];
    const hasSz = szNames.some((n) => szOnly.some((s) => n.includes(s)));
    if (!hasSz) {
      throw new Error(`深圳区名缺少深圳核心区: ${szNames.slice(0, 5)}`);
    }
    console.log("[heatmap] 深圳区名验证通过 ✓");

    // 验证 Top 1 有"金牌"色
    const rank1 = await page.locator(`${CARD} .wq-rank-gold`).count();
    if (rank1 < 1) throw new Error("未找到金牌 (rank 1)");
    console.log("[heatmap] Top 1 金牌 ✓");

    await screenshotCard(page, "smoke_wangqian_heatmap_sz.png");

    console.log("\nALL PASS");
  } catch (e) {
    console.error("\nFAIL smoke_wangqian_heatmap:", e.message);
    await page.screenshot({
      path: path.join(OUT_DIR, "smoke_wangqian_heatmap_FAIL.png"),
      fullPage: true
    }).catch(() => null);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

run();
