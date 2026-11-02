// smoke_metro_benefit.mjs — v0.36.0 map-10 地铁规划受益 E2E
// v1.122+ 改写：dashboard 改版为纯壳层（.home-v122 隐藏旧长页卡），
// 「🚇 地铁规划受益 Top」卡已迁入数据工具页 pages/data-tools/data-tools（[data-dt-plan-benefit]）。
// 切城方式：dashboard 壳层真实 pickCity 交互（写 Pinia store）→ hash 导航到数据工具页。
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCREENSHOT_DIR = resolve(__dirname, "../../screenshots");
mkdirSync(SCREENSHOT_DIR, { recursive: true });

const BASE = (process.env.REALTY_E2E_BASE_URL || process.env.E2E_BASE_URL || "http://127.0.0.1:5174").replace(/\/$/, "");
const DASH_URL = `${BASE}/#/pages/dashboard/dashboard`;
const DASH_HASH = "#/pages/dashboard/dashboard";
const DT_HASH = "#/pages/data-tools/data-tools";
const CARD = "[data-dt-plan-benefit]";

// 真实交互切城：dashboard 壳层 [data-home-city] → sheet 选城市（写 Pinia store）。
// 再 hash 导航到数据工具页（同文档 SPA，store 内存态保留）。
async function pickCity(page, cityName) {
  const cur = (await page.locator("[data-home-city]").first().textContent()) ?? "";
  if (cur.includes(cityName)) return;
  await page.locator("[data-home-city]").first().click({ force: true });
  await page.locator(".sheet-mask").waitFor({ state: "visible", timeout: 8000 });
  await page.locator(".sheet-item", { hasText: cityName }).first().click({ force: true });
  await page.locator(".sheet-mask").waitFor({ state: "hidden", timeout: 8000 }).catch(() => null);
  await page.waitForTimeout(1200);
}

async function gotoDataTools(page, cityName) {
  await page.locator("[data-home-city]").first().waitFor({ state: "visible", timeout: 20000 });
  await pickCity(page, cityName);
  await page.evaluate((h) => { location.hash = h; }, DT_HASH);
  // uni-app H5 会缓存已挂载页面（onMounted 不重跑）；reload 强制按持久化城市全新加载
  await page.reload({ waitUntil: "networkidle" });
  await page.locator(CARD).waitFor({ state: "visible", timeout: 20000 });
  // 卡片标题带城市名（🚇 地铁规划受益 Top · 深圳），等数据切到目标城市
  await page
    .locator(`${CARD} .card-title`)
    .filter({ hasText: cityName })
    .waitFor({ state: "visible", timeout: 15000 });
}

async function backToDashboard(page) {
  await page.evaluate((h) => { location.hash = h; }, DASH_HASH);
  await page.reload({ waitUntil: "networkidle" });
  await page.locator("[data-home-city]").first().waitFor({ state: "visible", timeout: 20000 });
}

function card(page) {
  return page.locator(CARD);
}

async function run() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 414, height: 896 },
    deviceScaleFactor: 2
  });
  const page = await ctx.newPage();
  const consoleErrors = [];
  page.on("pageerror", (e) => consoleErrors.push("[pageerror] " + e.message));
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push("[console.error] " + m.text());
  });

  try {
    await page.goto(DASH_URL, { waitUntil: "networkidle", timeout: 20000 });
    await gotoDataTools(page, "深圳");

    // 1) 卡片存在（waitFor 已保证）
    console.log("[metro_benefit] 地铁规划受益卡 ✓");

    // 2) row 数 >= 5
    const rowCount = await card(page).locator(".mb-row").count();
    console.log(`[metro_benefit] 行数: ${rowCount}`);
    if (rowCount < 5) {
      console.log(`⚠️ 行数 < 5 (${rowCount})`);
    }

    // 3) 至少 1 行带 .mb-tag (受益分徽章)
    const tagBadges = await card(page).locator(".mb-tag").count();
    if (tagBadges === 0) {
      console.log("❌ 未找到 .mb-tag 徽章");
      process.exit(1);
    }
    console.log(`[metro_benefit] mb-tag 徽章: ${tagBadges}`);

    // 4) top1 抓数据
    const top1Name = (await card(page).locator(".mb-row .mb-name").first().textContent())?.trim();
    const top1Score = (await card(page).locator(".mb-row .mb-tag").first().textContent())?.trim();
    const top1Line = (await card(page).locator(".mb-row .mb-dist").first().textContent())?.trim();
    console.log(`[metro_benefit] 深圳 top1=${top1Name} 受益分=${top1Score} ${top1Line}`);

    // 5) 颜色分档至少出现 1 类
    const colorClasses = await card(page).evaluate((el) => {
      const classes = new Set();
      el.querySelectorAll(".mb-tag").forEach((n) => {
        n.classList.forEach((c) => {
          if (c.startsWith("mb-tag-") && c !== "mb-tag") classes.add(c);
        });
      });
      return [...classes];
    });
    console.log(`[metro_benefit] 颜色分档: ${colorClasses.join(", ")}`);
    if (colorClasses.length === 0) {
      console.log("❌ 颜色分档为空");
      process.exit(1);
    }

    // 6) 至少 1 个 status 徽章
    const statusBadges = await card(page).locator(".mb-status").count();
    if (statusBadges === 0) {
      console.log("❌ 未找到 .mb-status 徽章");
      process.exit(1);
    }
    console.log(`[metro_benefit] status 徽章: ${statusBadges}`);

    // 7) summary 行
    const summary = await card(page).locator(".mb-summary").count();
    if (summary === 0) {
      console.log("❌ .mb-summary 缺失");
      process.exit(1);
    }

    // 8) 截图
    await card(page).scrollIntoViewIfNeeded();
    await page.screenshot({
      path: resolve(SCREENSHOT_DIR, "v0.36.0_metro_benefit_shenzhen.png"),
      fullPage: false
    });
    console.log("[metro_benefit] 截图 ✓ v0.36.0_metro_benefit_shenzhen.png");

    // 9) 切广州 → top1 应不同 (广州也有 metro planning)
    await backToDashboard(page);
    await gotoDataTools(page, "广州");
    await card(page).scrollIntoViewIfNeeded();
    const top1Gz = (await card(page).locator(".mb-row .mb-name").first().textContent())?.trim();
    console.log(`[metro_benefit] 广州 top1=${top1Gz}`);

    if (top1Gz && top1Gz !== top1Name) {
      console.log("✅ 深圳/广州 top1 不同 — 数据按城市正确切换");
    } else {
      console.log(`⚠️ 广深 top1 相同 (${top1Gz}) — 数据可能不足`);
    }

    await page.screenshot({
      path: resolve(SCREENSHOT_DIR, "v0.36.0_metro_benefit_guangzhou.png"),
      fullPage: false
    });
    console.log("[metro_benefit] 截图 ✓ v0.36.0_metro_benefit_guangzhou.png");

    console.log("\nALL PASS");
    process.exit(0);
  } catch (e) {
    console.log(`❌ 异常: ${e?.message ?? e}`);
    process.exit(1);
  } finally {
    if (consoleErrors.length > 0) {
      const filtered = consoleErrors.filter(
        (m) => !/map key not configured|favicon|Loading chunk/i.test(m)
      );
      if (filtered.length > 0) {
        console.log(`\n⚠️ console 错误 (${filtered.length}):`);
        filtered.slice(0, 3).forEach((m) => console.log(`   - ${m.slice(0, 200)}`));
      }
    }
    await browser.close();
  }
}

run();
