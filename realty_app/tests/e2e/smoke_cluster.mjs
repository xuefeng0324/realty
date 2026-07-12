// tests/e2e/smoke_cluster.mjs
// v0.18.0 map-2: 验证 listings 模式的 marker 聚合
// - 进入 map-view → 切到 listings 模式
// - 验证 legend 含聚合提示
// - 验证 marker 渲染到地图
// - 截图
import { chromium } from "playwright";
import { strict as assert } from "node:assert";
import { mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const SCREENSHOT_DIR = resolve(__dirname, "../../screenshots");
mkdirSync(SCREENSHOT_DIR, { recursive: true });

const BASE = "http://localhost:5174/#/pages/map-view/map-view";

async function clickButton(page, text) {
  const btn = page.locator(`uni-button:has-text("${text}"), button:has-text("${text}")`).first();
  await btn.waitFor({ timeout: 5000 });
  await btn.click();
  await page.waitForTimeout(1200);
}

async function run() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const consoleErrors = [];
  page.on("pageerror", (e) => consoleErrors.push("[pageerror] " + e.message));
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push("[console.error] " + msg.text());
  });

  // 深圳
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.evaluate(() => localStorage.setItem("realty_app.cityId", "2"));
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(3500);

  // 切到 listings 模式: count → price → listings
  await clickButton(page, "切到成交价热力");
  await clickButton(page, "切到挂牌点");
  await page.waitForTimeout(1500);

  // 验证 legend
  const legend = await page.locator(".legend").first().textContent();
  console.log(`[smoke_cluster] legend: ${legend?.trim()}`);
  assert.ok(legend?.includes("聚合"), "legend 应包含『聚合』");

  // marker 渲染到地图 (高德 H5 canvas, 但 DOM 应有 amap-marker)
  const markerDivCount = await page.evaluate(() =>
    document.querySelectorAll(".amap-marker").length
  );
  console.log(`[smoke_cluster] 深圳 amap-marker 数: ${markerDivCount}`);
  assert.ok(markerDivCount >= 1, `深圳 listings 模式应有 marker, 实际 ${markerDivCount}`);

  // 验证 v-if / v-else-if 渲染正确（不该有 metro 模式标志）
  const metroLegend = legend?.includes("地铁规划");
  assert.ok(!metroLegend, "listings 模式不应显示地铁规划 legend");

  await page.screenshot({
    path: resolve(SCREENSHOT_DIR, "v0.18.0_cluster_sz.png"),
    fullPage: true
  });

  await browser.close();

  const realErrors = consoleErrors.filter(
    (e) => !e.includes("Failed to load resource") && !e.includes("404")
  );
  if (realErrors.length > 0) {
    console.warn("[smoke_cluster] console errors:");
    realErrors.forEach((e) => console.warn("  " + e));
  }

  console.log("[smoke_cluster] PASSED ✓");
}

run().catch((e) => {
  console.error("[smoke_cluster] FAILED:", e);
  process.exit(1);
});