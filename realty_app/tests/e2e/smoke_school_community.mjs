// smoke_school_community.mjs — v0.14.0 学区评分 Top 小区卡 E2E
// v1.123.2 改写：该卡已正式迁入数据工具页 pages/data-tools/data-tools（[data-dt-school-top]），
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
const CARD = "[data-dt-school-top]";

// 城市 → 该卡可能出现的区名（用于等数据真正切到目标城市）
const CITY_DISTRICTS = {
  "深圳": /南山|福田|罗湖|宝安|龙岗|龙华|盐田|坪山|光明/,
  "广州": /天河|越秀|海珠|荔湾|白云|黄埔|番禺|花都|南沙|增城|从化/
};

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
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.locator(CARD).waitFor({ state: "visible", timeout: 20000 });
  // 等第一行小区 meta 出现目标城市的区名，确保数据切到目标城市
  await page
    .locator(`${CARD} .community-row .muted`)
    .filter({ hasText: CITY_DISTRICTS[cityName] })
    .first()
    .waitFor({ state: "visible", timeout: 15000 });
}

async function backToDashboard(page) {
  await page.evaluate((h) => { location.hash = h; }, DASH_HASH);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.locator("[data-home-city]").first().waitFor({ state: "visible", timeout: 20000 });
}

async function expectSchoolCommunityCard(page, label) {
  const card = page.locator(CARD);
  await card.waitFor({ state: "visible", timeout: 15000 });
  const title = (await card.locator(".card-title").first().textContent()) ?? "";
  if (!title.includes("学区评分 Top")) {
    throw new Error(`[${label}] 卡标题异常: ${title}`);
  }
  console.log(`[${label}] 学区评分 Top 小区卡 ✓ (${title.trim()})`);
  // 过滤/排序控件随卡迁移：3 个 spc-row 必须可见
  const spcRows = await card.locator(".spc-row").count();
  console.log(`[${label}] spc 控件行: ${spcRows}`);
  if (spcRows < 3) {
    throw new Error(`[${label}] spc 控件缺失（${spcRows} < 3）`);
  }
  // 至少 1 个小区行
  const items = await card.locator(".sp-medal-mini").count();
  console.log(`[${label}] 小区数: ${items}`);
  if (items < 1) {
    throw new Error(`[${label}] 学区评分 Top 0 条`);
  }
  // 取第一行
  const firstRow = card.locator(".community-row").first();
  const firstName = (await firstRow.locator(".community-name").textContent())?.trim();
  const firstScore = (await firstRow.locator(".muted").first().textContent())?.trim();
  console.log(`[${label}] Top 1: ${firstName}`);
  console.log(`[${label}] score meta: ${firstScore}`);
  if (!firstScore || !/评分 \d+\.\d/.test(firstScore)) {
    throw new Error(`[${label}] 学区评分 meta 格式错: ${firstScore}`);
  }
  return firstName;
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
    // v1.123.31 flake 加固：networkidle 易受挂起请求影响；后续 [data-home-city] 显式等待已覆盖渲染
    await page.goto(DASH_URL, { waitUntil: "domcontentloaded", timeout: 20000 });

    // === 广州 ===
    await gotoDataTools(page, "广州");
    const gzTop1 = await expectSchoolCommunityCard(page, "广州");
    await screenshotCard(page, "gz", "smoke_school_community_gz.png");

    // === 深圳（真实 pickCity 交互 + hash 往返）===
    await backToDashboard(page);
    await gotoDataTools(page, "深圳");
    const szTop1 = await expectSchoolCommunityCard(page, "深圳");
    const cardText = await page.locator(CARD).textContent();
    if (!/南山|福田|罗湖/.test(cardText ?? "")) {
      console.warn("[sz] 学区评分榜 Top 区不在南山/福田/罗湖");
    }
    if (gzTop1 && szTop1 && gzTop1 !== szTop1) {
      console.log("✅ 广深 Top1 不同 — 数据按城市正确切换");
    } else {
      console.warn(`⚠️ 广深 Top1 相同 (${szTop1})`);
    }
    await screenshotCard(page, "sz", "smoke_school_community_sz.png");

    console.log("\nALL PASS");
  } catch (e) {
    console.error("\nFAIL smoke_school_community:", e.message);
    await page.screenshot({
      path: resolve(OUT_DIR, "smoke_school_community_FAIL.png"),
      fullPage: true
    }).catch(() => null);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

run();
