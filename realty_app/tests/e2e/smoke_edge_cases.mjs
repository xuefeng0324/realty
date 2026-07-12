// tests/e2e/smoke_edge_cases.mjs
// 边缘场景测试
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { mkdirSync } from "node:fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const OUT_DIR = resolve(__dirname, "../e2e-screenshots/edge");
mkdirSync(OUT_DIR, { recursive: true });

const BASE_URL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:5174";

async function run() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 420, height: 900 } });
  const page = await ctx.newPage();

  const issues = [];

  try {
    // === Edge 1: listing-detail 多个 listing ===
    console.log("\n=== Edge 1: 多个 listing ===");
    for (const id of [1227, 1, 100, 500, 1286]) {
      await page.goto(`${BASE_URL}/#/pages/listing-detail/listing-detail?id=${id}`, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(1500);
      await page.addStyleTag({ content: ".uni-page-head { display: none !important; }" });
      const hasData = await page.locator("text=总价").count();
      const hasError = await page.locator("text=未找到").count();
      const hasLoading = await page.locator("text=加载中").count();
      console.log(`listing ${id}: data=${hasData} err=${hasError} loading=${hasLoading}`);
      if (hasError > 0) {
        issues.push(`listing ${id} 显示"未找到"`);
      }
    }

    // === Edge 2: community 多个 community ===
    console.log("\n=== Edge 2: 多个 community ===");
    for (const id of [1, 5, 10, 24, 50, 52]) {
      await page.goto(`${BASE_URL}/#/pages/community/community?id=${id}`, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(1500);
      await page.addStyleTag({ content: ".uni-page-head { display: none !important; }" });
      const hasName = await page.locator(".community-name, .name").count();
      const hasErr = await page.locator("text=未找到").count();
      console.log(`community ${id}: name=${hasName} err=${hasErr}`);
      if (hasErr > 0) {
        issues.push(`community ${id} 显示"未找到"`);
      }
    }

    // === Edge 3: 不存在的 ID ===
    console.log("\n=== Edge 3: 不存在的 ID ===");
    await page.goto(`${BASE_URL}/#/pages/listing-detail/listing-detail?id=99999`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);
    await page.addStyleTag({ content: ".uni-page-head { display: none !important; }" });
    const notFound1 = await page.locator("text=未找到").count();
    console.log(`listing 99999: notFound=${notFound1}`);

    await page.goto(`${BASE_URL}/#/pages/community/community?id=99999`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);
    await page.addStyleTag({ content: ".uni-page-head { display: none !important; }" });
    const notFound2 = await page.locator("text=未找到").count();
    console.log(`community 99999: notFound=${notFound2}`);

    // === Edge 4: 无效的 cityId ===
    console.log("\n=== Edge 4: 无效 cityId ===");
    await page.goto(`${BASE_URL}/`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);
    await page.evaluate(() => {
      localStorage.setItem("realty_app.cityId", "999");
    });
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2500);
    await page.addStyleTag({ content: ".uni-page-head { display: none !important; }" });
    await page.screenshot({ path: resolve(OUT_DIR, "invalid_city.png"), fullPage: true });
    const errorMsg = await page.locator("text=未获取到").count();
    console.log(`invalid cityId: errorMsg=${errorMsg}`);

    // === Edge 5: 大量数据展示性能 ===
    console.log("\n=== Edge 5: 大数据量 ===");
    await page.evaluate(() => {
      localStorage.setItem("realty_app.cityId", "2");
    });
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
    await page.addStyleTag({ content: ".uni-page-head { display: none !important; }" });
    await page.screenshot({ path: resolve(OUT_DIR, "shenzhen_dashboard.png"), fullPage: true });
    console.log("深圳 dashboard 已加载");

    // === 总结 ===
    console.log("\n=== 边缘测试完成 ===");
    if (issues.length === 0) {
      console.log("✓ 无 issues");
    } else {
      console.log(`⚠ ${issues.length} 个 issues:`);
      issues.forEach((i) => console.log(`  - ${i}`));
    }
  } catch (e) {
    console.error("✗ 测试失败:", e.message);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

run();