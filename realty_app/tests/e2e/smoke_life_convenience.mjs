// smoke_life_convenience.mjs — v0.31.0 new-9 生活便利度卡 E2E
// 验证 dashboard "🧭 生活便利度 Top 小区" 卡片在深圳 / 广州 / 珠海 3 城市下都正常渲染
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
  console.log(`[pickCity] 当前: "${current.trim()}"`);
  if (current.includes(cityName)) return;
  await page.locator(".form-row", { hasText: "城市" }).first().click({ force: true });
  await page.waitForTimeout(800);
  await page.locator(".sheet-item", { hasText: cityName }).first().click({ force: true });
  await page.waitForTimeout(3500);
}

async function checkCity(browser, ctx, cityName, minRows) {
  const page = await ctx.newPage();
  const consoleErrors = [];
  page.on("pageerror", (e) => consoleErrors.push("[pageerror] " + e.message));
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push("[console.error] " + m.text());
  });

  try {
    await page.goto(BASE, { waitUntil: "networkidle", timeout: 15000 });
    await page.waitForTimeout(1500);
    await pickCity(page, cityName);

    const cardCount = await page.locator("text=生活便利度 Top 小区").count();
    if (cardCount === 0) {
      console.log(`❌ [${cityName}] 未找到 '🧭 生活便利度 Top 小区' 卡片`);
      return { ok: false, reason: "card-missing" };
    }

    const rowCount = await page.locator(".lc-row").count();
    if (rowCount < minRows) {
      console.log(`❌ [${cityName}] 行数 ${rowCount} < ${minRows}`);
      return { ok: false, reason: "rows-too-few" };
    }

    const firstName = (await page.locator(".lc-row .lc-name").first().textContent())?.trim();
    const firstScore = (await page.locator(".lc-row .lc-score").first().textContent())?.trim();
    const score = Number(firstScore);
    // v0.32.0 归一化到 0-100 (score100)
    if (!Number.isFinite(score) || score < 0 || score > 100) {
      console.log(`❌ [${cityName}] score100 越界: ${firstScore}`);
      return { ok: false, reason: "score-out-of-range" };
    }

    const dimCount = await page.locator(".lc-row").first().locator(".lc-dim").count();
    // v0.32.0 新增 C=菜市场 维度 (6 维)
    if (dimCount !== 6) {
      console.log(`❌ [${cityName}] 维度数不对 (期望 6): ${dimCount}`);
      return { ok: false, reason: "dim-count-wrong" };
    }

    // 检查城市均分
    const summary = (await page.locator(".lc-summary").first().textContent())?.trim() ?? "";

    // 截图
    await page.evaluate(() => {
      const cards = document.querySelectorAll(".card");
      for (const c of cards) {
        const t = c.querySelector(".card-title");
        if (t && /生活便利度/.test(t.textContent ?? "")) {
          c.scrollIntoView({ block: "center" });
          return;
        }
      }
    });
    await page.waitForTimeout(500);
    const safeName = cityName.replace(/[^\w一-龥]/g, "");
    await page.screenshot({
      path: resolve(SCREENSHOT_DIR, `v0.32.0_life_convenience_${safeName}.png`),
      fullPage: false
    });

    console.log(
      `✅ [${cityName}] rows=${rowCount} top=${firstName} score=${firstScore}  summary=${summary}`
    );
    return { ok: true, firstName, firstScore, rowCount };
  } catch (e) {
    console.log(`❌ [${cityName}] 异常: ${e?.message ?? e}`);
    return { ok: false, reason: "exception", error: e?.message ?? String(e) };
  } finally {
    if (consoleErrors.length > 0) {
      const filtered = consoleErrors.filter(
        (m) => !/map key not configured|favicon|Loading chunk/i.test(m)
      );
      if (filtered.length > 0) {
        console.log(`⚠️ [${cityName}] console 错误 (${filtered.length}):`);
        filtered.slice(0, 3).forEach((m) => console.log(`   - ${m.slice(0, 200)}`));
      }
    }
    await page.close();
  }
}

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 414, height: 896 },
    deviceScaleFactor: 2
  });
  const results = [];
  for (const city of [
    { name: "广州", minRows: 1 },
    { name: "深圳", minRows: 5 },
    { name: "珠海", minRows: 1 }
  ]) {
    const r = await checkCity(browser, ctx, city.name, city.minRows);
    results.push({ city: city.name, ...r });
  }
  await browser.close();

  const pass = results.filter((r) => r.ok).length;
  const fail = results.length - pass;
  console.log(`\n总计: ${pass} 通过 / ${fail} 失败`);

  // 验证城市差异
  const tops = results.map((r) => r.firstName).filter(Boolean);
  const allSame = new Set(tops).size <= 1;
  if (allSame) {
    console.log(
      "⚠️ 警告: 3 个城市的 top community 全部相同 — 城市切换可能没有生效。"
    );
  } else {
    console.log("✅ 3 个城市的 top community 各不相同 — 城市切换生效。");
  }

  process.exit(fail === 0 ? 0 : 1);
})();