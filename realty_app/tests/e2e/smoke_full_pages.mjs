// tests/e2e/smoke_full_pages.mjs
// 全面测试：访问每个页面 + 截图，收集 console errors
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { mkdirSync } from "node:fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const OUT_DIR = resolve(__dirname, "../e2e-screenshots/full");
mkdirSync(OUT_DIR, { recursive: true });

const BASE_URL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:5174";

const PAGES = [
  { path: "/", name: "01_dashboard_gz" },
  { path: "/#/pages/dashboard/dashboard", name: "01_dashboard" },
  { path: "/#/pages/listing-filter/listing-filter", name: "02_listing_filter" },
  { path: "/#/pages/listing-detail/listing-detail?id=1227", name: "03_listing_detail_1227" },
  { path: "/#/pages/community/community?id=24", name: "04_community_24" },
  { path: "/#/pages/community/community?id=1", name: "04b_community_1" },
  { path: "/#/pages/school/school", name: "05_school" },
  { path: "/#/pages/stats70/stats70", name: "06_stats70" },
  { path: "/#/pages/wangqian/wangqian", name: "07_wangqian" },
  { path: "/#/pages/settings/settings", name: "08_settings" },
  { path: "/#/pages/gov-webview/gov-webview", name: "09_gov_webview" },
  { path: "/#/pages/map-view/map-view", name: "10_map_view" }
];

async function run() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 420, height: 900 } });
  const page = await ctx.newPage();

  const allErrors = [];
  const summary = [];

  for (const p of PAGES) {
    const errors = [];
    page.removeAllListeners("console");
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        errors.push(`[${p.name}] ${msg.text()}`);
      }
    });
    page.on("pageerror", (err) => {
      errors.push(`[${p.name}] PAGEERROR: ${err.message}`);
    });

    try {
      await page.goto(BASE_URL + p.path, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(2500);
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
}

run();