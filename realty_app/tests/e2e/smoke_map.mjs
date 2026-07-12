/**
 * smoke_map.mjs
 * =========================
 * 验证"地图找房"页：
 *   1. 通过 #/pages/map-view/map-view 进入
 *   2. 等到 <map> 元素渲染
 *   3. 等到 communities_geo.csv 加载 + markers/circles 计算完成
 *   4. 验证 map-wrap 存在 + 有 markers 或 circles
 *   5. 截图保存
 */
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OUT_DIR = path.resolve(__dirname, "../../e2e-screenshots");
fs.mkdirSync(OUT_DIR, { recursive: true });

const URL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:5174/#/pages/map-view/map-view";

async function run() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 420, height: 900 }
  });
  const page = await ctx.newPage();
  const consoleErrors = [];
  page.on("pageerror", (e) => consoleErrors.push(String(e)));
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text());
  });

  try {
    await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 30000 });
    // 等地图容器
    await page.waitForSelector(".map-wrap", { timeout: 15000 });
    console.log("[map] 容器存在 ✓");
    // 等 map 子元素 (uni-app <map> 渲染后是 uni-map 等)
    await page.waitForSelector(".uni-map, .map, [id*='map']", { timeout: 15000 });
    console.log("[map] <map> 元素渲染 ✓");

    // 等 listings/circles 加载完成（顶部文字有 N 个小区）
    await page.waitForFunction(
      () => {
        const txt = document.body.innerText || "";
        return /(\d+)\s*个小区/.test(txt);
      },
      { timeout: 20000 }
    );
    const bodyText = await page.locator("body").innerText();
    console.log("[map] 顶部计数文字存在 ✓");

    // 找带 N 个小区的行
    const totalMatch = bodyText.match(/(\d+)\s*个小区\s*[·•]\s*(\d+)\s*套挂牌/);
    if (totalMatch) {
      const communities = parseInt(totalMatch[1], 10);
      const listings = parseInt(totalMatch[2], 10);
      if (communities < 50) {
        throw new Error(`期望 ≥50 个小区, 实际 ${communities}`);
      }
      if (listings < 1000) {
        throw new Error(`期望 ≥1000 套挂牌, 实际 ${listings}`);
      }
      console.log(`[map] 统计: ${communities} 个小区 · ${listings} 套挂牌 ✓`);
    } else {
      throw new Error("未找到 'N 个小区 · N 套挂牌' 计数文字");
    }

    // 验证切换到挂牌点按钮存在
    const toggleBtn = await page.locator("text=切到成交价热力").count();
    if (toggleBtn === 0) {
      throw new Error("未找到 '切到成交价热力' 按钮");
    }
    console.log("[map] 切换按钮存在 ✓");

    // 验证深圳/广州/珠海 切换按钮
    for (const city of ["深圳", "广州", "珠海"]) {
      const btn = await page.locator(`text=${city}`).count();
      if (btn === 0) throw new Error(`未找到 ${city} 切换按钮`);
    }
    console.log("[map] 三个城市切换按钮存在 ✓");

    // 截图
    await page.screenshot({
      path: path.join(OUT_DIR, "smoke_map.png"),
      fullPage: true
    });
    console.log("  截图已保存 → smoke_map.png");

    // 切到深圳 (默认可能就是深圳)
    await page.locator("text=深圳").first().click();
    await page.waitForTimeout(1500);
    await page.screenshot({
      path: path.join(OUT_DIR, "smoke_map_sz.png"),
      fullPage: true
    });
    console.log("  截图已保存 → smoke_map_sz.png");

    if (consoleErrors.length > 0) {
      console.warn(`[map] console errors: ${consoleErrors.length}`);
      for (const e of consoleErrors) console.warn("  - " + e.slice(0, 200));
    }
    console.log("\n✓ smoke_map 通过");
  } catch (e) {
    console.error("\n✗ smoke_map 失败:", e.message);
    await page.screenshot({
      path: path.join(OUT_DIR, "smoke_map_FAIL.png"),
      fullPage: true
    });
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

run();