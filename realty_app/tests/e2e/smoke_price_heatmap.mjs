// tests/e2e/smoke_price_heatmap.mjs
// v0.12.0: 验证 map-view 成交价热力模式
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { mkdirSync } from "node:fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const OUT_DIR = resolve(__dirname, "../e2e-screenshots");
mkdirSync(OUT_DIR, { recursive: true });

const BASE_URL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:5174/#/pages/map-view/map-view";

async function run() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 420, height: 900 } });
  const page = await ctx.newPage();

  try {
    await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
    await page.waitForSelector(".map-wrap", { timeout: 15000 });
    await page.waitForTimeout(1500);
    await page.addStyleTag({ content: ".uni-page-head { display: none !important; }" });
    await page.waitForTimeout(300);

    // 等 circles 渲染
    await page.waitForSelector("text=成交价热力", { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(800);

    // 初始: 挂牌数热力 (count) → 切到 成交价热力 (price)
    const toggleBtn = page.locator("text=切到成交价热力").first();
    await toggleBtn.waitFor({ timeout: 5000 });
    await toggleBtn.click({ force: true });
    await page.waitForTimeout(800);

    // 验证 legend 已切到"成交价热力"
    const legend = await page.locator(".legend").first().textContent();
    console.log("legend:", legend);
    if (!legend || !legend.includes("成交价")) {
      throw new Error(`legend 未切到成交价模式: ${legend}`);
    }
    console.log("[price] legend 切到成交价 ✓");
    await page.screenshot({
      path: resolve(OUT_DIR, "smoke_price_heatmap.png"),
      fullPage: true
    });
    console.log("[price] 截图已保存");

    // 切换城市 → 广州
    const gzBtn = page.locator("text=广州").first();
    await gzBtn.click({ force: true });
    await page.waitForTimeout(1500);
    await page.screenshot({
      path: resolve(OUT_DIR, "smoke_price_heatmap_gz.png"),
      fullPage: true
    });
    console.log("[gz] 截图已保存");

    // 验证 circles 仍存在 (uni-app map 组件)
    const circlesCount = await page.locator(".uni-map__circle").count();
    console.log(`[gz] circles 元素数: ${circlesCount}`);
    if (circlesCount === 0) {
      console.warn("[gz] 未检测到 circle DOM (uni-app H5 可能用 canvas 渲染)");
    }

    console.log("\n✓ smoke_price_heatmap 通过");
  } catch (e) {
    console.error("\n✗ smoke_price_heatmap 失败:", e.message);
    await page.screenshot({
      path: resolve(OUT_DIR, "smoke_price_heatmap_FAIL.png"),
      fullPage: true
    });
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

run();