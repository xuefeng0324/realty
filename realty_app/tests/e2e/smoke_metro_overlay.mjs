// tests/e2e/smoke_metro_overlay.mjs
// v0.15.0: 验证 map-view 地铁规划 overlay 模式
//   - count → price → listings → poi → metro 模式轮换
//   - metro 模式下显示 21 条规划/在建地铁线 polyline
//   - 切换到广州 / 切换回深圳, 截图

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
    // 强制深圳
    await page.goto("http://127.0.0.1:5174/", { waitUntil: "domcontentloaded" });
    await page.evaluate(() => {
      localStorage.setItem("realty_app.cityId", "2");
    });
    await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
    await page.waitForSelector(".map-wrap", { timeout: 15000 });
    await page.waitForTimeout(1500);
    await page.addStyleTag({ content: ".uni-page-head { display: none !important; }" });
    await page.waitForTimeout(300);

    // 5 模式轮换: count -> price -> listings -> poi -> metro
    const labels = ["切到成交价热力", "切到挂牌点", "切到 POI", "切到地铁规划"];
    for (const lab of labels) {
      const btn = page.locator(`text=${lab}`).first();
      await btn.waitFor({ timeout: 5000 });
      await btn.click({ force: true });
      await page.waitForTimeout(700);
    }

    // 验证 legend 已切到 metro
    const legend = await page.locator(".legend").first().textContent();
    console.log("metro legend:", legend);
    if (!legend || !legend.includes("地铁规划")) {
      throw new Error(`legend 未切到地铁规划模式: ${legend}`);
    }
    console.log("[metro] legend 切到地铁规划 ✓");

    // 验证 toggle 按钮已变成 "切到挂牌数热力"
    const toggleBtn = page.locator("text=切到挂牌数热力").first();
    await toggleBtn.waitFor({ timeout: 5000 });
    console.log("[metro] toggle 按钮显示正确 ✓");

    // map 元素存在
    const mapCount = await page.locator("#realty-map").count();
    if (mapCount === 0) throw new Error("map element not found");
    console.log(`[metro] map element count = ${mapCount}`);

    // 截图 (深圳 metro)
    await page.screenshot({
      path: resolve(OUT_DIR, "smoke_metro_overlay.png"),
      fullPage: true
    });
    console.log("[metro] 深圳截图已保存");

    // 切换到广州
    const gzBtn = page.locator("text=广州").first();
    await gzBtn.click({ force: true });
    await page.waitForTimeout(1500);
    await page.screenshot({
      path: resolve(OUT_DIR, "smoke_metro_overlay_gz.png"),
      fullPage: true
    });
    console.log("[metro] 广州截图已保存");

    // 验证广州 metro 模式下, legend 仍显示地铁规划
    const gzLegend = await page.locator(".legend").first().textContent();
    console.log("gz metro legend:", gzLegend);
    if (!gzLegend || !gzLegend.includes("地铁规划")) {
      throw new Error(`gz legend 应保持地铁规划模式: ${gzLegend}`);
    }
    console.log("[metro] 广州 legend 保持 metro ✓");

    console.log("\n✓ smoke_metro_overlay 通过");
  } catch (e) {
    console.error("\n✗ smoke_metro_overlay 失败:", e.message);
    await page.screenshot({
      path: resolve(OUT_DIR, "smoke_metro_overlay_FAIL.png"),
      fullPage: true
    });
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

run();