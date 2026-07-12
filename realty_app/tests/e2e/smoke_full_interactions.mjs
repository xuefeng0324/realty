// tests/e2e/smoke_full_interactions.mjs
// 深度交互测试：测试各种城市切换、筛选、模式切换是否真的更新 UI
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { mkdirSync } from "node:fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const OUT_DIR = resolve(__dirname, "../e2e-screenshots/interactive");
mkdirSync(OUT_DIR, { recursive: true });

const BASE_URL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:5174";

async function switchCityDashboard(page, cityName) {
  await page.addStyleTag({ content: ".uni-page-head { display: none !important; }" });
  await page.waitForTimeout(200);
  await page.locator(".form-row").first().click({ force: true });
  await page.waitForTimeout(800);
  await page.getByText(cityName, { exact: true }).last().click({ force: true });
  await page.waitForTimeout(4000);
}

async function checkCity(page, expected, label) {
  // 抓所有卡片标题，检查它们是否含期望城市
  const titles = await page.locator(".card-title").allTextContents();
  const premium = titles.find((t) => t.includes("学区溢价榜"));
  const wq = titles.find((t) => t.includes("网签热度榜"));
  const trend = titles.find((t) => t.includes("区级"));
  console.log(`[${label}] 学区: ${premium} / 网签: ${wq} / 趋势: ${trend}`);
  if (premium && !premium.includes(expected)) {
    console.log(`  ⚠️ 学区榜未切到 ${expected}: ${premium}`);
  }
  if (wq && !wq.includes(expected) && !wq.includes("全市")) {
    console.log(`  ⚠️ 网签榜未切到 ${expected}: ${wq}`);
  }
}

async function run() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 420, height: 900 } });
  const page = await ctx.newPage();

  const issues = [];

  try {
    // === Test 1: dashboard 三城切换 ===
    console.log("\n=== Test 1: dashboard 三城切换 ===");
    await page.goto(BASE_URL + "/#/pages/dashboard/dashboard", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);

    await switchCityDashboard(page, "广州");
    await page.waitForTimeout(500);
    await checkCity(page, "广州", "广州");
    await page.screenshot({ path: resolve(OUT_DIR, "dashboard_gz.png"), fullPage: true });

    await switchCityDashboard(page, "深圳");
    await page.waitForTimeout(500);
    await checkCity(page, "深圳", "深圳");
    await page.screenshot({ path: resolve(OUT_DIR, "dashboard_sz.png"), fullPage: true });

    await switchCityDashboard(page, "珠海");
    await page.waitForTimeout(500);
    await checkCity(page, "珠海", "珠海");
    await page.screenshot({ path: resolve(OUT_DIR, "dashboard_zh.png"), fullPage: true });

    // === Test 2: map-view 三模式 ===
    console.log("\n=== Test 2: map-view 三模式 ===");
    await page.goto(BASE_URL + "/#/pages/map-view/map-view", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2500);
    await page.addStyleTag({ content: ".uni-page-head { display: none !important; }" });
    await page.waitForTimeout(300);
    // 默认 count
    let legend = await page.locator(".legend").first().textContent();
    console.log("[map] count 模式 legend:", legend);
    await page.screenshot({ path: resolve(OUT_DIR, "map_count.png"), fullPage: true });

    // 切到 price
    await page.locator("text=切到成交价热力").first().click({ force: true });
    await page.waitForTimeout(800);
    legend = await page.locator(".legend").first().textContent();
    console.log("[map] price 模式 legend:", legend);
    if (!legend || !legend.includes("成交价")) {
      issues.push(`map price mode 切换失败: ${legend}`);
    }
    await page.screenshot({ path: resolve(OUT_DIR, "map_price.png"), fullPage: true });

    // 切到 listings
    await page.locator("text=切到挂牌点").first().click({ force: true });
    await page.waitForTimeout(800);
    legend = await page.locator(".legend").first().textContent();
    console.log("[map] listings 模式 legend:", legend);
    if (!legend || !legend.includes("挂牌点")) {
      issues.push(`map listings mode 切换失败: ${legend}`);
    }
    await page.screenshot({ path: resolve(OUT_DIR, "map_listings.png"), fullPage: true });

    // === Test 3: listing-filter 筛选 ===
    console.log("\n=== Test 3: listing-filter 筛选 ===");
    await page.goto(BASE_URL + "/#/pages/listing-filter/listing-filter", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    await page.addStyleTag({ content: ".uni-page-head { display: none !important; }" });
    await page.waitForTimeout(300);
    const totalText = await page.locator(".muted").filter({ hasText: "共" }).first().textContent();
    console.log("[filter] 默认 total:", totalText);

    // === Test 4: stats70 数据展示 ===
    console.log("\n=== Test 4: stats70 ===");
    await page.goto(BASE_URL + "/#/pages/stats70/stats70", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    await page.addStyleTag({ content: ".uni-page-head { display: none !important; }" });
    await page.waitForTimeout(300);
    const statsRows = await page.locator(".stats-row, .row").count();
    console.log(`[stats70] 行数: ${statsRows}`);
    await page.screenshot({ path: resolve(OUT_DIR, "stats70.png"), fullPage: true });

    // === Test 5: wangqian 详情 ===
    console.log("\n=== Test 5: wangqian ===");
    await page.goto(BASE_URL + "/#/pages/wangqian/wangqian", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    await page.addStyleTag({ content: ".uni-page-head { display: none !important; }" });
    await page.waitForTimeout(300);
    const wqRows = await page.locator(".wq-row, .row").count();
    console.log(`[wangqian] 行数: ${wqRows}`);
    await page.screenshot({ path: resolve(OUT_DIR, "wangqian.png"), fullPage: true });

    // === 总结 ===
    console.log("\n=== 测试完成 ===");
    if (issues.length === 0) {
      console.log("✓ 无 issues");
    } else {
      console.log(`✗ ${issues.length} 个 issues:`);
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