// smoke_metro_walk.mjs — v0.35.0 map-9 地铁步行通勤 E2E
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

    // 滚到地铁步行通勤卡
    await page.evaluate(() => {
      const cards = document.querySelectorAll(".card");
      for (const c of cards) {
        const t = c.querySelector(".card-title");
        if (t && /地铁步行通勤/.test(t.textContent ?? "")) {
          c.scrollIntoView({ block: "center" });
          return;
        }
      }
    });
    await page.waitForTimeout(500);

    // 1) 卡片存在
    const cardCount = await page.locator("text=地铁步行通勤 Top").count();
    if (cardCount === 0) {
      console.log("❌ 未找到 '🚶 地铁步行通勤 Top' 卡片");
      process.exit(1);
    }
    console.log("[v0.35.0] 地铁步行通勤卡 ✓");

    // 2) 卡片里的行数 > 0
    const rowCount = await page.locator(".mw-row").count();
    console.log(`[v0.35.0] 行数: ${rowCount}`);
    if (rowCount < 3) {
      console.log(`⚠️ 行数 < 3 (只有 ${rowCount} 个，可能数据不全)`);
    }

    // 3) 至少 1 行带 .mw-min class (颜色分档)
    const minBadges = await page.locator(".mw-min").count();
    console.log(`[v0.35.0] mw-min 徽章: ${minBadges}`);
    if (minBadges === 0) {
      console.log("❌ 未找到 .mw-min 徽章");
      process.exit(1);
    }

    // 4) top1 row 抓出数据
    const top1Name = (await page.locator(".mw-row .mw-name").first().textContent())?.trim();
    const top1Min = (await page.locator(".mw-row .mw-min").first().textContent())?.trim();
    const top1Dist = (await page.locator(".mw-row .mw-dist").first().textContent())?.trim();
    console.log(`[v0.35.0] top1=${top1Name} 步行=${top1Min} ${top1Dist}`);

    // 5) 颜色分档至少出现 1 类
    const colorClasses = await page.evaluate(() => {
      const classes = new Set();
      document.querySelectorAll(".mw-min").forEach((el) => {
        el.classList.forEach((c) => {
          if (c.startsWith("mw-min-") && c !== "mw-min") classes.add(c);
        });
      });
      return [...classes];
    });
    console.log(`[v0.35.0] 颜色分档: ${colorClasses.join(", ")}`);
    if (colorClasses.length === 0) {
      console.log("❌ 颜色分档为空");
      process.exit(1);
    }

    // 6) summary 行 (avg / fastest) 应当出现
    const summary = await page.locator(".mw-summary").count();
    if (summary === 0) {
      console.log("❌ .mw-summary 缺失");
      process.exit(1);
    }

    // 7) 截图
    await page.screenshot({
      path: resolve(SCREENSHOT_DIR, "v0.35.0_metro_walk_shenzhen.png"),
      fullPage: false
    });
    console.log("[v0.35.0] 截图 ✓ v0.35.0_metro_walk_shenzhen.png");

    // 8) 切广州 → 应该有不同的 top1
    await pickCity(page, "广州");
    await page.waitForTimeout(1500);
    await page.evaluate(() => {
      const cards = document.querySelectorAll(".card");
      for (const c of cards) {
        const t = c.querySelector(".card-title");
        if (t && /地铁步行通勤/.test(t.textContent ?? "")) {
          c.scrollIntoView({ block: "center" });
          return;
        }
      }
    });
    await page.waitForTimeout(500);
    const top1Gz = (await page.locator(".mw-row .mw-name").first().textContent())?.trim();
    console.log(`[v0.35.0] 广州 top1=${top1Gz}`);

    if (top1Gz && top1Gz !== top1Name) {
      console.log("✅ 深圳/广州 top1 不同 — 数据来源按城市正确切换");
    } else {
      console.log(`⚠️ 广深 top1 相同 (${top1Gz}) — 可能数据不足或排错`);
    }

    await page.screenshot({
      path: resolve(SCREENSHOT_DIR, "v0.35.0_metro_walk_guangzhou.png"),
      fullPage: false
    });
    console.log("[v0.35.0] 截图 ✓ v0.35.0_metro_walk_guangzhou.png");

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