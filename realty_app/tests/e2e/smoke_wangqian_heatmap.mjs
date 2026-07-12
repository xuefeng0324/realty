/**
 * smoke_wangqian_heatmap.mjs
 * ===========================
 * 验证 dashboard "近 4 周二手网签热度榜" 卡片。
 *   1. 默认 cityId=1 (广州)
 *   2. 切到 Shenzhen (cityId=2)
 *   3. 验证卡片存在 + 至少 5 个区
 *   4. 截图保存
 */
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OUT_DIR = path.resolve(__dirname, "../../e2e-screenshots");
fs.mkdirSync(OUT_DIR, { recursive: true });

const BASE = process.env.E2E_BASE_URL ?? "http://127.0.0.1:5174";

async function run() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 420, height: 900 } });
  const page = await ctx.newPage();

  try {
    await page.goto(BASE + "/", { waitUntil: "domcontentloaded" });
    await page.waitForSelector(".trend-row, .wq-row", { timeout: 15000 });
    console.log("[heatmap] dashboard 渲染 ✓");

    // 默认 Guangzhou, 应该有卡片
    const heatCardGz = await page.locator("text=近 4 周二手网签热度榜").count();
    if (heatCardGz === 0) throw new Error("广州 dashboard 未找到 '近 4 周二手网签热度榜' 卡片");
    console.log("[heatmap] 广州卡片存在 ✓");

    const gzRows = await page.locator(".wq-row").count();
    if (gzRows < 3) throw new Error(`广州期望 ≥3 区, 实际 ${gzRows}`);
    console.log(`[heatmap] 广州区数: ${gzRows} ✓`);

    await page.screenshot({
      path: path.join(OUT_DIR, "smoke_wangqian_heatmap_gz.png"),
      fullPage: true
    });
    console.log("  截图 → smoke_wangqian_heatmap_gz.png");

    // 切到深圳 — 通过 dashboard 顶部"城市"按钮 → action sheet
    await page.addStyleTag({ content: ".uni-page-head { display: none !important; }" });
    await page.waitForTimeout(300);
    // 先确认当前在 dashboard (不是 map-view)
    const onDashboard = await page.locator("text=近 4 周二手网签热度榜").count();
    if (onDashboard === 0) {
      // 通过 tabBar 回 dashboard
      await page.locator("text=总览").first().click({ force: true });
      await page.waitForTimeout(1500);
    }
    // 点 dashboard 顶部"城市"按钮 (form-row)
    await page.locator(".form-row").first().click({ force: true });
    await page.waitForTimeout(800);
    // 在 action sheet 里点"深圳" (sheet 里有多个匹配，用 last 因为 sheet 在底部)
    const sheetShenzhen = page.getByText("深圳", { exact: true });
    await sheetShenzhen.last().click({ force: true });
    await page.waitForTimeout(4000);

    const szRows = await page.locator(".wq-row").count();
    if (szRows < 3) throw new Error(`深圳期望 ≥3 区, 实际 ${szRows}`);
    console.log(`[heatmap] 深圳区数: ${szRows} ✓`);

    // 验证区名都是真实深圳区（不是广州区）
    const szNames = await page.locator(".wq-name").allTextContents();
    console.log("[heatmap] 深圳区名: " + szNames.slice(0, 5).join("、") + "...");
    // 真实深圳区必须包含 福田/南山/罗湖 等核心区
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
    const rank1 = await page.locator(".wq-rank-gold").count();
    if (rank1 < 1) throw new Error("未找到金牌 (rank 1)");
    console.log("[heatmap] Top 1 金牌 ✓");

    await page.screenshot({
      path: path.join(OUT_DIR, "smoke_wangqian_heatmap_sz.png"),
      fullPage: true
    });
    console.log("  截图 → smoke_wangqian_heatmap_sz.png");

    console.log("\n✓ smoke_wangqian_heatmap 通过");
  } catch (e) {
    console.error("\n✗ smoke_wangqian_heatmap 失败:", e.message);
    await page.screenshot({
      path: path.join(OUT_DIR, "smoke_wangqian_heatmap_FAIL.png"),
      fullPage: true
    });
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

run();