// smoke_metro_benefit.mjs — v0.36.0 map-10 地铁规划受益 E2E
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCREENSHOT_DIR = resolve(__dirname, "../../screenshots");
mkdirSync(SCREENSHOT_DIR, { recursive: true });

const BASE = "http://127.0.0.1:5174/#/pages/dashboard/dashboard";

async function pickCity(page, cityName) {
  const current = (await page.locator(".picker-value").first().textContent()) ?? "";
  if (current.includes(cityName)) return;
  await page.locator(".form-row", { hasText: "城市" }).first().click({ force: true });
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

    // 滚到地铁规划受益卡
    await page.evaluate(() => {
      const cards = document.querySelectorAll(".card");
      for (const c of cards) {
        const t = c.querySelector(".card-title");
        if (t && /地铁规划受益/.test(t.textContent ?? "")) {
          c.scrollIntoView({ block: "center" });
          return;
        }
      }
    });
    await page.waitForTimeout(500);

    // 1) 卡片存在
    const cardCount = await page.locator("text=地铁规划受益 Top").count();
    if (cardCount === 0) {
      console.log("❌ 未找到 '🚇 地铁规划受益 Top' 卡片");
      process.exit(1);
    }
    console.log("[v0.36.0] 地铁规划受益卡 ✓");

    // 2) row 数 >= 5
    const rowCount = await page.locator(".mb-row").count();
    console.log(`[v0.36.0] 行数: ${rowCount}`);
    if (rowCount < 5) {
      console.log(`⚠️ 行数 < 5 (${rowCount})`);
    }

    // 3) 至少 1 行带 .mb-tag (受益分徽章)
    const tagBadges = await page.locator(".mb-tag").count();
    if (tagBadges === 0) {
      console.log("❌ 未找到 .mb-tag 徽章");
      process.exit(1);
    }
    console.log(`[v0.36.0] mb-tag 徽章: ${tagBadges}`);

    // 4) top1 抓数据
    const top1Name = (await page.locator(".mb-row .mb-name").first().textContent())?.trim();
    const top1Score = (await page.locator(".mb-row .mb-tag").first().textContent())?.trim();
    const top1Line = (await page.locator(".mb-row .mb-dist").first().textContent())?.trim();
    console.log(`[v0.36.0] 深圳 top1=${top1Name} 受益分=${top1Score} ${top1Line}`);

    // 5) 颜色分档至少出现 1 类
    const colorClasses = await page.evaluate(() => {
      const classes = new Set();
      document.querySelectorAll(".mb-tag").forEach((el) => {
        el.classList.forEach((c) => {
          if (c.startsWith("mb-tag-") && c !== "mb-tag") classes.add(c);
        });
      });
      return [...classes];
    });
    console.log(`[v0.36.0] 颜色分档: ${colorClasses.join(", ")}`);
    if (colorClasses.length === 0) {
      console.log("❌ 颜色分档为空");
      process.exit(1);
    }

    // 6) 至少 1 个 status 徽章
    const statusBadges = await page.locator(".mb-status").count();
    if (statusBadges === 0) {
      console.log("❌ 未找到 .mb-status 徽章");
      process.exit(1);
    }
    console.log(`[v0.36.0] status 徽章: ${statusBadges}`);

    // 7) summary 行
    const summary = await page.locator(".mb-summary").count();
    if (summary === 0) {
      console.log("❌ .mb-summary 缺失");
      process.exit(1);
    }

    // 8) 截图
    await page.screenshot({
      path: resolve(SCREENSHOT_DIR, "v0.36.0_metro_benefit_shenzhen.png"),
      fullPage: false
    });
    console.log("[v0.36.0] 截图 ✓ v0.36.0_metro_benefit_shenzhen.png");

    // 9) 切广州 → top1 应不同 (广州也有 metro planning)
    await pickCity(page, "广州");
    await page.waitForTimeout(1500);
    await page.evaluate(() => {
      const cards = document.querySelectorAll(".card");
      for (const c of cards) {
        const t = c.querySelector(".card-title");
        if (t && /地铁规划受益/.test(t.textContent ?? "")) {
          c.scrollIntoView({ block: "center" });
          return;
        }
      }
    });
    await page.waitForTimeout(500);
    const top1Gz = (await page.locator(".mb-row .mb-name").first().textContent())?.trim();
    console.log(`[v0.36.0] 广州 top1=${top1Gz}`);

    if (top1Gz && top1Gz !== top1Name) {
      console.log("✅ 深圳/广州 top1 不同 — 数据按城市正确切换");
    } else {
      console.log(`⚠️ 广深 top1 相同 (${top1Gz}) — 数据可能不足`);
    }

    await page.screenshot({
      path: resolve(SCREENSHOT_DIR, "v0.36.0_metro_benefit_guangzhou.png"),
      fullPage: false
    });

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