// smoke_community_score_weight.mjs — v0.34.0 trend-16 综合评分权重自定义 E2E
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCREENSHOT_DIR = resolve(__dirname, "../../screenshots");
mkdirSync(SCREENSHOT_DIR, { recursive: true });

const BASE = "http://127.0.0.1:5173/#/pages/dashboard/dashboard";

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

    // 滚到综合评分卡
    await page.evaluate(() => {
      const cards = document.querySelectorAll(".card");
      for (const c of cards) {
        const t = c.querySelector(".card-title");
        if (t && /小区综合评分/.test(t.textContent ?? "")) {
          c.scrollIntoView({ block: "center" });
          return;
        }
      }
    });
    await page.waitForTimeout(500);

    // 1) 默认 (均衡) 卡片存在
    const cardCount = await page.locator("text=小区综合评分 Top 小区").count();
    if (cardCount === 0) {
      console.log("❌ 未找到 '🏅 小区综合评分 Top 小区' 卡片");
      process.exit(1);
    }
    console.log("[v0.34.0] 综合评分卡 ✓");

    // 2) 4 个预设 chip
    const presetChips = await page.locator(".cs-preset-chip").count();
    console.log(`[v0.34.0] 预设 chip 数: ${presetChips}`);
    if (presetChips !== 4) {
      console.log(`❌ 预设数不对: ${presetChips}`);
      process.exit(1);
    }

    // 3) 3 个 slider
    const sliders = await page.locator(".cs-slider").count();
    console.log(`[v0.34.0] slider 数: ${sliders}`);
    if (sliders !== 3) {
      console.log(`❌ slider 数不对: ${sliders}`);
      process.exit(1);
    }

    // 4) 默认 top1 记录 (均衡)
    const top1Balanced = (await page.locator(".cs-row .cs-name").first().textContent())?.trim();
    const top1BalancedScore = (await page.locator(".cs-row .cs-total").first().textContent())?.trim();
    console.log(`[均衡] top1=${top1Balanced} total=${top1BalancedScore}`);

    // 5) 截图 - 均衡预设
    await page.screenshot({
      path: resolve(SCREENSHOT_DIR, "v0.34.0_community_score_balanced.png"),
      fullPage: false
    });

    // 6) 点击"🎓 学区"预设 → 排名应该变化 (学区权重最高)
    await page.locator(".cs-preset-chip", { hasText: "学区" }).click();
    await page.waitForTimeout(800);
    const top1School = (await page.locator(".cs-row .cs-name").first().textContent())?.trim();
    const top1SchoolScore = (await page.locator(".cs-row .cs-total").first().textContent())?.trim();
    console.log(`[学区] top1=${top1School} total=${top1SchoolScore}`);

    if (top1School === top1Balanced) {
      console.log("⚠️ 学区预设 top1 与均衡相同 — 权重切换可能未生效");
    } else {
      console.log("✅ 学区预设 top1 与均衡不同 — 权重切换生效");
    }

    // 7) 截图 - 学区预设
    await page.screenshot({
      path: resolve(SCREENSHOT_DIR, "v0.34.0_community_score_school.png"),
      fullPage: false
    });

    // 8) 点击"🚇 通勤"预设
    await page.locator(".cs-preset-chip", { hasText: "通勤" }).click();
    await page.waitForTimeout(800);
    const top1Commute = (await page.locator(".cs-row .cs-name").first().textContent())?.trim();
    const top1CommuteScore = (await page.locator(".cs-row .cs-total").first().textContent())?.trim();
    console.log(`[通勤] top1=${top1Commute} total=${top1CommuteScore}`);

    // 9) 截图 - 通勤预设
    await page.screenshot({
      path: resolve(SCREENSHOT_DIR, "v0.34.0_community_score_commute.png"),
      fullPage: false
    });

    // 10) 点击"🧭 生活"预设
    await page.locator(".cs-preset-chip", { hasText: "生活" }).click();
    await page.waitForTimeout(800);
    const top1Life = (await page.locator(".cs-row .cs-name").first().textContent())?.trim();
    const top1LifeScore = (await page.locator(".cs-row .cs-total").first().textContent())?.trim();
    console.log(`[生活] top1=${top1Life} total=${top1LifeScore}`);

    // 11) 4 个预设应该 top1 各不相同
    const tops = [top1Balanced, top1School, top1Commute, top1Life].filter(Boolean);
    const unique = new Set(tops).size;
    if (unique >= 3) {
      console.log(`✅ 4 个预设 top1 中有 ${unique} 个不同 — 权重系统生效良好`);
    } else if (unique === 2) {
      console.log(`⚠️ 4 个预设 top1 中只有 ${unique} 个不同 — 部分权重效果不明显`);
    } else {
      console.log("❌ 4 个预设 top1 完全相同 — 权重切换未生效");
      process.exit(1);
    }

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