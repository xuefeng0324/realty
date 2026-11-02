// smoke_wangqian_heatmap.mjs — 「近 4 周二手网签热度榜」卡 E2E
// v1.123.2 改写：该卡已正式迁入数据工具页 pages/data-tools/data-tools（[data-dt-wangqian-rank]），
// 断言从「dashboard attached + 内联 display 截图」升级为「data-tools 页 visible 真实可见」。
// 切城方式：dashboard 壳层真实 pickCity 交互（写 Pinia store）→ hash 导航 → reload 强制全新加载。
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { mkdirSync } from "node:fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const OUT_DIR = resolve(__dirname, "../../screenshots");
mkdirSync(OUT_DIR, { recursive: true });

const BASE = (process.env.REALTY_E2E_BASE_URL || process.env.E2E_BASE_URL || "http://127.0.0.1:5174").replace(/\/$/, "");
const DASH_URL = `${BASE}/#/pages/dashboard/dashboard`;
const DASH_HASH = "#/pages/dashboard/dashboard";
const DT_HASH = "#/pages/data-tools/data-tools";
const CARD = "[data-dt-wangqian-rank]";

// 真实交互切城：dashboard 壳层 [data-home-city] → sheet 选城市（写 Pinia store）。
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
  // 卡片标题带城市名（近 4 周二手网签热度榜 · 深圳），等数据切到目标城市
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

async function expectWangqianCard(page, label, expectedDistricts) {
  const card = page.locator(CARD);
  await card.waitFor({ state: "visible", timeout: 15000 });
  const title = (await card.locator(".card-title").first().textContent()) ?? "";
  if (!title.includes("网签热度榜")) {
    throw new Error(`[${label}] 卡标题异常: ${title}`);
  }
  console.log(`[${label}] 网签热度榜卡 ✓ (${title.trim()})`);
  const rows = await card.locator(".wq-row").count();
  console.log(`[${label}] 行数: ${rows}`);
  if (rows < 3) {
    throw new Error(`[${label}] 热度榜行数过少: ${rows}`);
  }
  const names = await card.locator(".wq-name").allTextContents();
  console.log(`[${label}] 区名: ${names.join(" / ")}`);
  const hit = names.some((n) => expectedDistricts.some((d) => (n ?? "").includes(d)));
  if (!hit) {
    throw new Error(`[${label}] 区名不符合预期: ${names.join(",")}`);
  }
  const gold = await card.locator(".wq-rank-gold").count();
  console.log(`[${label}] 金牌徽章: ${gold}`);
  if (gold < 1) {
    throw new Error(`[${label}] 缺少金牌徽章`);
  }
  return names;
}

async function screenshotCard(page, label, filename) {
  const card = page.locator(CARD);
  await card.scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  await card.screenshot({ path: resolve(OUT_DIR, filename) });
  console.log(`[${label}] 截图已保存 ${filename}`);
}

async function run() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 420, height: 900 } });
  const page = await ctx.newPage();

  try {
    await page.goto(DASH_URL, { waitUntil: "networkidle", timeout: 20000 });

    // === 广州（新房 category 兜底，区名仍是广州行政区）===
    await gotoDataTools(page, "广州");
    await expectWangqianCard(page, "广州", ["天河", "海珠", "越秀", "荔湾", "白云", "黄埔", "番禺", "花都", "南沙", "增城", "从化"]);
    await screenshotCard(page, "gz", "smoke_wangqian_heatmap_gz.png");

    // === 深圳（真实 pickCity 交互 + hash 往返）===
    await backToDashboard(page);
    await gotoDataTools(page, "深圳");
    await expectWangqianCard(page, "深圳", ["南山", "福田", "罗湖", "宝安", "龙岗", "盐田", "龙华", "坪山", "光明"]);
    await screenshotCard(page, "sz", "smoke_wangqian_heatmap_sz.png");

    console.log("\nALL PASS");
  } catch (e) {
    console.error("\nFAIL smoke_wangqian_heatmap:", e.message);
    await page.screenshot({
      path: resolve(OUT_DIR, "smoke_wangqian_heatmap_FAIL.png"),
      fullPage: true
    }).catch(() => null);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

run();
