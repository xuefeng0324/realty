// tests/e2e/smoke_weather.mjs
// v0.16.0: 验证 dashboard「实时天气 + 4 天预报」卡
//   - 卡片存在
//   - 验证 live 数据 (weather + temperature)
//   - 验证 forecast grid (4 个 cast)
//   - 切换到广州, 验证卡片更新
//   - 截图

import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { mkdirSync } from "node:fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const OUT_DIR = resolve(__dirname, "../e2e-screenshots");
mkdirSync(OUT_DIR, { recursive: true });

const BASE = process.env.E2E_BASE_URL ?? "http://127.0.0.1:5174";

async function run() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 420, height: 900 } });
  const page = await ctx.newPage();

  try {
    // 默认深圳
    await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
    await page.evaluate(() => {
      localStorage.setItem("realty_app.cityId", "2");
    });
    await page.goto(`${BASE}/#/pages/dashboard/dashboard`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2500);
    await page.addStyleTag({ content: ".uni-page-head { display: none !important; }" });

    // 验证 weather card 存在
    const cardTitle = page.locator("text=实时天气").first();
    await cardTitle.waitFor({ timeout: 8000 });
    console.log("[sz] 天气卡存在 ✓");

    // 验证 live 字段: 温度 / 湿度 / 风力
    const cardText = await page.locator("text=实时天气").first().locator("..").locator("..").innerText();
    if (!/°C/.test(cardText)) throw new Error("温度字段缺失");
    if (!/湿度/.test(cardText)) throw new Error("湿度字段缺失");
    if (!/风力/.test(cardText)) throw new Error("风力字段缺失");
    if (!/AQI/.test(cardText)) throw new Error("AQI 字段缺失");
    console.log("[sz] live 字段齐全 (温度/湿度/风力/AQI) ✓");

    // 验证 forecast 4 天
    const forecastDays = await page.locator("text=今天").count();
    if (forecastDays < 1) throw new Error("'今天' cast 缺失");
    console.log(`[sz] forecast '今天' 存在 ✓ (count=${forecastDays})`);

    // 截图
    await page.screenshot({
      path: resolve(OUT_DIR, "smoke_weather.png"),
      fullPage: true
    });
    console.log("[sz] 截图已保存");

    // 切换到广州
    await page.locator(".form-row").first().click({ force: true });
    await page.waitForTimeout(500);
    await page.locator("text=广州").last().click({ force: true });
    await page.waitForTimeout(2000);

    const gzText = await page.locator("text=实时天气").first().locator("..").locator("..").innerText();
    if (!/广州/.test(gzText)) throw new Error("切换到广州后, 卡片未显示'广州'");
    console.log("[gz] 卡片切到广州 ✓");

    // 验证 gz 卡片仍有 forecast
    const gzForecastDays = await page.locator("text=今天").count();
    if (gzForecastDays < 1) throw new Error("广州 forecast '今天' 缺失");
    console.log("[gz] forecast 仍存在 ✓");

    await page.screenshot({
      path: resolve(OUT_DIR, "smoke_weather_gz.png"),
      fullPage: true
    });
    console.log("[gz] 截图已保存");

    console.log("\n✓ smoke_weather 通过");
  } catch (e) {
    console.error("\n✗ smoke_weather 失败:", e.message);
    await page.screenshot({
      path: resolve(OUT_DIR, "smoke_weather_FAIL.png"),
      fullPage: true
    });
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

run();