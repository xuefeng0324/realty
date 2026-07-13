// smoke_community_metrics.mjs — v0.37.0 trend-17 5 维小区指标 E2E
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCREENSHOT_DIR = resolve(__dirname, "../../screenshots");
mkdirSync(SCREENSHOT_DIR, { recursive: true });

const BASE = "http://127.0.0.1:5175/#/pages/dashboard/dashboard";

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
    // 直接进 community 详情页 (id=1 京基100)
    const baseUrl = "http://127.0.0.1:5175/#/pages/community/community?id=7";
    await page.goto(baseUrl, { waitUntil: "networkidle", timeout: 15000 });
    await page.waitForTimeout(3500);

    // 1) 5 维小区指标卡存在
    const cardCount = await page.locator("text=5 维小区指标").count();
    if (cardCount === 0) {
      console.log("❌ 未找到 '🏅 5 维小区指标' 卡片");
      process.exit(1);
    }
    console.log("[v0.37.0] 5 维小区指标卡 ✓");

    // 2) 5 列 .cm-cell 都在
    const cellCount = await page.locator(".cm-cell").count();
    console.log(`[v0.37.0] cm-cell 数: ${cellCount}`);
    if (cellCount !== 5) {
      console.log(`❌ 单元格数不对: ${cellCount} (应为 5)`);
      process.exit(1);
    }

    // 3) 5 个标签 (生活/学区/通勤/步行地铁/规划地铁)
    const labels = ["生活", "学区", "通勤", "步行地铁", "规划地铁"];
    let foundCount = 0;
    for (const l of labels) {
      const c = await page.locator(`.cm-label:has-text("${l}")`).count();
      if (c > 0) foundCount++;
    }
    console.log(`[v0.37.0] 标签匹配 ${foundCount}/5`);
    if (foundCount < 4) {
      console.log(`❌ 标签数不足 (${foundCount})`);
      process.exit(1);
    }

    // 4) 截图
    await page.screenshot({
      path: resolve(SCREENSHOT_DIR, "v0.37.0_community_metrics_cm7.png"),
      fullPage: false
    });
    console.log("[v0.37.0] 截图 ✓ v0.37.0_community_metrics_cm7.png");

    // 5) 至少 1 个 cm-fill (进度条)
    const fillCount = await page.locator(".cm-fill").count();
    if (fillCount < 1) {
      console.log("❌ 未找到 .cm-fill 进度条");
      process.exit(1);
    }
    console.log(`[v0.37.0] cm-fill 进度条: ${fillCount}`);

    // 6) 颜色分档 ≥ 1 类
    const colorClasses = await page.evaluate(() => {
      const cls = new Set();
      document.querySelectorAll(".cm-fill").forEach((el) => {
        el.classList.forEach((c) => {
          if (c.startsWith("cm-fill-") && c !== "cm-fill") cls.add(c);
        });
      });
      return [...cls];
    });
    console.log(`[v0.37.0] 颜色分档: ${colorClasses.join(", ")}`);
    if (colorClasses.length === 0) {
      console.log("❌ 颜色分档为空");
      process.exit(1);
    }

    // 7) 不同小区 (id=15 保利天悦) 也应该有指标
    await page.goto("http://127.0.0.1:5175/#/pages/community/community?id=15", {
      waitUntil: "networkidle",
      timeout: 15000
    });
    await page.waitForTimeout(2500);
    const card2 = await page.locator("text=5 维小区指标").count();
    if (card2 === 0) {
      console.log("⚠️ id=15 (保利天悦) 无 5 维卡");
    } else {
      console.log("✅ id=15 (保利天悦) 5 维卡也存在");
    }
    await page.screenshot({
      path: resolve(SCREENSHOT_DIR, "v0.37.0_community_metrics_cm15.png"),
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