// tests/e2e/smoke_price_heatmap.mjs
// 验证 map-view 挂牌均价热力模式（非成交价）
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { mkdirSync } from "node:fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const OUT_DIR = resolve(__dirname, "../e2e-screenshots");
mkdirSync(OUT_DIR, { recursive: true });

const BASE = (process.env.E2E_BASE_URL ?? "http://127.0.0.1:5174").replace(/\/$/, "");
const BASE_URL = `${BASE}/#/pages/map-view/map-view`;

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

    await page.waitForSelector(".map-mode-btn", { timeout: 15000 });
    await page.locator('.map-mode-btn[data-map-mode="price"]').first().click({ force: true });
    await page.waitForTimeout(800);

    const legend = await page.locator(".legend").first().textContent();
    console.log("legend:", legend);
    if (!legend || !legend.includes("挂牌均价")) {
      throw new Error(`legend 未切到挂牌均价模式: ${legend}`);
    }
    console.log("[price] legend 切到挂牌均价 ✓");

    await page.waitForTimeout(800);
    const legendCard = page.locator("text=挂牌价格分位图例").first();
    await legendCard.waitFor({ timeout: 5000 });
    const legendRows = await page.locator(".legend-row").count();
    console.log(`[price] 挂牌价格分位图例行数: ${legendRows}`);
    if (legendRows < 5) {
      throw new Error(`挂牌价格分位图例行数应 >= 5, 实际 ${legendRows}`);
    }
    const cheapestText = await page.locator("text=最便宜").count();
    const priciestText = await page.locator("text=最贵").count();
    if (cheapestText < 1 || priciestText < 1) {
      throw new Error(`图例应包含「最便宜」「最贵」分位`);
    }
    const swatchCount = await page.locator(".legend-swatch").count();
    console.log(`[price] swatch 数: ${swatchCount}`);
    if (swatchCount < 5) {
      throw new Error(`图例 swatch 应 >= 5, 实际 ${swatchCount}`);
    }
    const cityAvgText = await page.locator("text=城市均价").count();
    if (cityAvgText < 1) {
      throw new Error(`图例应包含「城市均价」汇总`);
    }
    console.log("[price] 挂牌价格分位图例 ✓ (5 档 + 城市均价)");

    await page.screenshot({
      path: resolve(OUT_DIR, "smoke_price_heatmap.png"),
      fullPage: true
    });
    console.log("[price] 截图已保存");

    const gzBtn = page.locator("text=广州").first();
    await gzBtn.click({ force: true });
    await page.waitForTimeout(1200);
    await page.screenshot({
      path: resolve(OUT_DIR, "smoke_price_heatmap_gz.png"),
      fullPage: true
    });
    console.log("[price] 广州截图已保存");

    console.log("PASS smoke_price_heatmap");
  } finally {
    await browser.close();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
