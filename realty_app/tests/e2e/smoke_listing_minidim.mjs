// smoke_listing_minidim.mjs — v0.37.0 trend-17 listing 列表迷你评分条 E2E
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCREENSHOT_DIR = resolve(__dirname, "../../screenshots");
mkdirSync(SCREENSHOT_DIR, { recursive: true });

const BASE = "http://127.0.0.1:5175/#/pages/listing-filter/listing-filter";

async function pickCity(page, cityName) {
  const current = (await page.locator(".picker-value").first().textContent()) ?? "";
  if (current.includes(cityName)) return;
  await page.locator(".picker-value.tap").first().click({ force: true });
  await page.waitForTimeout(800);
  await page.locator(".sheet-item", { hasText: cityName }).first().click({ force: true });
  await page.waitForTimeout(3500);
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
    await page.goto(BASE, { waitUntil: "networkidle", timeout: 15000 });
    await page.waitForTimeout(1500);
    await pickCity(page, "深圳");

    // 触发筛选
    const applyBtn = page.locator("button", { hasText: "应用" });
    if (await applyBtn.count() > 0) {
      await applyBtn.first().click({ force: true });
      await page.waitForTimeout(3500);
    }

    // 1) 列表卡片存在
    const rowCount = await page.locator(".listing-row").count();
    console.log(`[v0.37.0] 房源行数: ${rowCount}`);
    if (rowCount < 3) {
      console.log(`❌ 行数 ${rowCount} < 3`);
      process.exit(1);
    }

    // 2) 至少 1 个 .minidim-row (5 维迷你条)
    const minidimRows = await page.locator(".minidim-row").count();
    if (minidimRows === 0) {
      console.log("❌ 未找到 .minidim-row");
      process.exit(1);
    }
    console.log(`[v0.37.0] minidim-row: ${minidimRows}`);

    // 3) 1 行里有 5 个 .minidim-cell
    const cellsInFirst = await page.locator(".minidim-row").first().locator(".minidim-cell").count();
    console.log(`[v0.37.0] 第一行 cell 数: ${cellsInFirst}`);
    if (cellsInFirst !== 5) {
      console.log(`❌ 第一行 cell 数: ${cellsInFirst} (应为 5)`);
      process.exit(1);
    }

    // 4) 5 个标签 (位置/房屋/楼龄/配套/性价比)
    const labels = ["位置", "房屋", "楼龄", "配套", "性价比"];
    let found = 0;
    for (const l of labels) {
      const c = await page.locator(".minidim-row .minidim-label", { hasText: l }).count();
      if (c > 0) found++;
    }
    console.log(`[v0.37.0] 标签匹配 ${found}/5`);
    if (found < 4) {
      console.log(`❌ 标签缺失 (${found})`);
      process.exit(1);
    }

    // 5) 颜色分档 ≥ 1 类
    const colorClasses = await page.evaluate(() => {
      const cls = new Set();
      document.querySelectorAll(".minidim-fill").forEach((el) => {
        el.classList.forEach((c) => {
          if (c.startsWith("minidim-fill-") && c !== "minidim-fill") cls.add(c);
        });
      });
      return [...cls];
    });
    console.log(`[v0.37.0] 颜色分档: ${colorClasses.join(", ")}`);
    if (colorClasses.length === 0) {
      console.log("❌ 颜色分档为空");
      process.exit(1);
    }

    // 6) 截图
    await page.screenshot({
      path: resolve(SCREENSHOT_DIR, "v0.37.0_listing_minidim.png"),
      fullPage: false
    });
    console.log("[v0.37.0] 截图 ✓ v0.37.0_listing_minidim.png");

    // 7) top1 listing 抓出 5 维评分
    const topRow = page.locator(".listing-row").first();
    const top1Scores = await topRow.locator(".minidim-cell .minidim-val").allTextContents();
    console.log(`[v0.37.0] top1 5维分: ${top1Scores.join("/")}`);

    console.log("\n总计: 1 通过 / 0 失败");
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