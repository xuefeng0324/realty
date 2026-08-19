// tests/e2e/smoke_full_pages.mjs
// 全面测试：访问每个页面 + 截图，收集 console errors
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { mkdirSync, readFileSync } from "node:fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const OUT_DIR = resolve(__dirname, "../e2e-screenshots/full");
mkdirSync(OUT_DIR, { recursive: true });

const BASE_URL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:5174";
const UPGRADE_PATH = "/#/pages/upgrade-popup/upgrade-popup";
const UPGRADE_PENDING_KEY = "realty_app.update.pendingManifest";
const UPGRADE_MANIFEST = {
  versionName: "1.122.0",
  versionCode: 279,
  publishedAt: "2026-08-18T00:00:00+08:00",
  notes: "移动端五栏、行情聚合与本地收藏改版验收。",
  force: false
};

const PAGES = [
  { path: "/#/pages/dashboard/dashboard", name: "01_dashboard" },
  { path: "/#/pages/listing-filter/listing-filter", name: "02_listing_filter" },
  { path: "/#/pages/listing-detail/listing-detail?id=1227", name: "03_listing_detail_1227" },
  { path: "/#/pages/community/community?id=24", name: "04_community_24" },
  { path: "/#/pages/school/school", name: "05_school" },
  { path: "/#/pages/school-detail/school-detail?id=1", name: "06_school_detail" },
  { path: "/#/pages/stats70/stats70", name: "07_stats70" },
  { path: "/#/pages/wangqian/wangqian", name: "08_wangqian" },
  { path: "/#/pages/settings/settings", name: "09_profile" },
  { path: "/#/pages/gov-webview/gov-webview", name: "10_gov_webview" },
  { path: "/#/pages/map-view/map-view", name: "11_map_view" },
  { path: "/#/pages/market/market", name: "12_market" },
  { path: "/#/pages/upgrade-popup/upgrade-popup", name: "13_upgrade_popup" },
  { path: "/#/pages/macro-rates/macro-rates", name: "14_macro_rates" },
  { path: "/#/pages/macro-fx/macro-fx", name: "15_macro_fx" },
  { path: "/#/pages/macro-industry/macro-industry", name: "16_macro_industry" },
  { path: "/#/pages/macro-region/macro-region", name: "17_macro_region" },
  { path: "/#/pages/macro-trade/macro-trade", name: "18_macro_trade" },
  { path: "/#/pages/data-tools/data-tools", name: "19_data_tools" },
  { path: "/#/pages/supply/supply", name: "20_supply" },
  { path: "/#/pages/trend-analysis/trend-analysis", name: "21_trend_analysis" },
  { path: "/#/pages/map-analysis/map-analysis", name: "22_map_analysis" }
];

function assertRouteMatrixMatchesPagesConfig() {
  const pagesConfig = JSON.parse(
    readFileSync(resolve(__dirname, "../../src/pages.json"), "utf8")
  );
  const configured = pagesConfig.pages
    .map((page) => `/#/${page.path}`)
    .sort();
  const covered = PAGES
    .map((page) => page.path.split("?")[0])
    .sort();
  if (JSON.stringify(covered) !== JSON.stringify(configured)) {
    const configuredSet = new Set(configured);
    const coveredSet = new Set(covered);
    const missing = configured.filter((path) => !coveredSet.has(path));
    const extra = covered.filter((path) => !configuredSet.has(path));
    throw new Error(
      `22 路由矩阵与 pages.json 不一致：missing=${missing.join(",") || "none"}; ` +
      `extra=${extra.join(",") || "none"}`
    );
  }
}

async function run() {
  assertRouteMatrixMatchesPagesConfig();
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 420, height: 900 } });
  const page = await ctx.newPage();

  const allErrors = [];
  const summary = [];

  for (const p of PAGES) {
    const errors = [];
    page.removeAllListeners("console");
    page.removeAllListeners("pageerror");
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        errors.push(`[${p.name}] ${msg.text()}`);
      }
    });
    page.on("pageerror", (err) => {
      errors.push(`[${p.name}] PAGEERROR: ${err.message}`);
    });

    try {
      if (p.path === UPGRADE_PATH) {
        await page.goto(`${BASE_URL}/#/pages/dashboard/dashboard`, { waitUntil: "domcontentloaded" });
        await page.evaluate(
          ({ key, manifest }) => localStorage.setItem(key, JSON.stringify(manifest)),
          { key: UPGRADE_PENDING_KEY, manifest: UPGRADE_MANIFEST }
        );
      }
      await page.goto(BASE_URL + p.path, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(2500);
      if (!page.url().includes(p.path.split("?")[0])) {
        throw new Error(`路由被重定向到 ${page.url()}`);
      }
      // 隐藏 uni-page-head
      await page.addStyleTag({ content: ".uni-page-head { display: none !important; }" });
      await page.waitForTimeout(500);
      await page.screenshot({
        path: resolve(OUT_DIR, `${p.name}.png`),
        fullPage: true
      });
      console.log(`[OK] ${p.name} (errors: ${errors.length})`);
      summary.push({ page: p.name, status: "OK", errorCount: errors.length });
    } catch (e) {
      console.log(`[FAIL] ${p.name}: ${e.message}`);
      summary.push({ page: p.name, status: "FAIL", error: e.message });
      await page.screenshot({
        path: resolve(OUT_DIR, `${p.name}_FAIL.png`),
        fullPage: true
      });
    }
    allErrors.push(...errors);
  }

  // 报告
  console.log("\n=== 总结 ===");
  console.log(`总页面: ${PAGES.length}`);
  const failPages = summary.filter((s) => s.status === "FAIL");
  console.log(`失败: ${failPages.length}`);
  if (failPages.length > 0) {
    failPages.forEach((s) => console.log(`  - ${s.page}: ${s.error}`));
  }
  const errorPages = summary.filter((s) => s.errorCount > 0);
  console.log(`有 console errors: ${errorPages.length}`);
  errorPages.forEach((s) => console.log(`  - ${s.page}: ${s.errorCount} 个 error`));

  if (allErrors.length > 0) {
    console.log("\n=== 全部 errors ===");
    allErrors.forEach((e) => console.log(`  ${e}`));
  }

  await browser.close();
  if (failPages.length > 0 || allErrors.length > 0) process.exitCode = 1;
}

run();
