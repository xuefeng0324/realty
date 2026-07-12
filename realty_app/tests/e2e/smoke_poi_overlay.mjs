// tests/e2e/smoke_poi_overlay.mjs
// v0.13.0: 验证 map-view POI overlay 模式
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
    await page.waitForTimeout(2500);
    await page.addStyleTag({ content: ".uni-page-head { display: none !important; }" });
    await page.waitForTimeout(300);

    // 1. count → price (1 click)
    await page.locator("text=切到成交价热力").first().click({ force: true });
    await page.waitForTimeout(700);
    // 2. price → listings (1 click)
    await page.locator("text=切到挂牌点").first().click({ force: true });
    await page.waitForTimeout(700);
    // 3. listings → poi (1 click)
    await page.locator("text=切到 POI").first().click({ force: true });
    await page.waitForTimeout(1000);

    const legend = await page.locator(".legend").first().textContent();
    console.log("[poi] legend:", legend);
    if (!legend || !legend.includes("POI")) {
      throw new Error(`legend 未切到 POI 模式: ${legend}`);
    }

    // 验证 5 类 toggle
    const toggles = await page.locator(".poi-toggle").count();
    console.log(`[poi] toggle 数: ${toggles}`);
    if (toggles !== 5) {
      throw new Error(`期望 5 个 POI toggle, 实际 ${toggles}`);
    }

    // 检查每类计数 (e.g. "🚇 地铁 33")
    const subwayText = await page.locator(".poi-toggle").nth(0).textContent();
    const schoolText = await page.locator(".poi-toggle").nth(1).textContent();
    console.log("[poi] 地铁 toggle:", subwayText);
    console.log("[poi] 学校 toggle:", schoolText);

    await page.screenshot({
      path: resolve(OUT_DIR, "smoke_poi_overlay.png"),
      fullPage: true
    });
    console.log("[poi] 截图已保存");

    // 切到广州 + 截图
    await page.locator("text=广州").first().click({ force: true });
    await page.waitForTimeout(2000);
    await page.screenshot({
      path: resolve(OUT_DIR, "smoke_poi_overlay_gz.png"),
      fullPage: true
    });
    console.log("[poi] gz 截图已保存");

    // toggle 关闭一类
    await page.locator(".poi-toggle").nth(2).click({ force: true });  // 医院 off
    await page.waitForTimeout(500);
    const after = await page.locator(".poi-toggle-off").count();
    console.log(`[poi] off 状态 toggle: ${after}`);
    if (after !== 1) {
      throw new Error(`医院 off 失败, off 数 = ${after}`);
    }
    await page.screenshot({
      path: resolve(OUT_DIR, "smoke_poi_overlay_hospital_off.png"),
      fullPage: true
    });
    console.log("[poi] hospital off 截图已保存");

    console.log("\n✓ smoke_poi_overlay 通过");
  } catch (e) {
    console.error("\n✗ smoke_poi_overlay 失败:", e.message);
    await page.screenshot({
      path: resolve(OUT_DIR, "smoke_poi_overlay_FAIL.png"),
      fullPage: true
    });
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

run();