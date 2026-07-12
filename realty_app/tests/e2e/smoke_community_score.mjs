// smoke_community_score.mjs — v0.33.0 trend-15 小区综合评分卡 E2E
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

    const cardCount = await page.locator("text=小区综合评分 Top 小区").count();
    if (cardCount === 0) {
      console.log(`❌ [${cityName}] 未找到 '🏅 小区综合评分 Top 小区' 卡片`);
      return { ok: false, reason: "card-missing" };
    }

    const rowCount = await page.locator(".cs-row").count();
    if (rowCount < minRows) {
      console.log(`❌ [${cityName}] 行数 ${rowCount} < ${minRows}`);
      return { ok: false, reason: "rows-too-few" };
    }

    const firstName = (await page.locator(".cs-row .cs-name").first().textContent())?.trim();
    const firstTotal = (await page.locator(".cs-row .cs-total").first().textContent())?.trim();
    const total = Number(firstTotal);
    if (!Number.isFinite(total) || total < 0 || total > 100) {
      console.log(`❌ [${cityName}] total 越界: ${firstTotal}`);
      return { ok: false, reason: "total-out-of-range" };
    }

    // 3 维细分 (生活/学区/通勤)
    const dimCount = await page.locator(".cs-row").first().locator(".cs-dim").count();
    if (dimCount !== 3) {
      console.log(`❌ [${cityName}] 维度数不对 (期望 3): ${dimCount}`);
      return { ok: false, reason: "dim-count-wrong" };
    }

    // 检查金牌 (1-3 名)
    const gold = await page.locator(".cs-medal-gold").count();
    if (gold !== 1) {
      console.log(`❌ [${cityName}] 金牌数不对 (期望 1): ${gold}`);
      return { ok: false, reason: "gold-count-wrong" };
    }

    // 截图
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
    const safeName = cityName.replace(/[^\w一-龥]/g, "");
    await page.screenshot({
      path: resolve(SCREENSHOT_DIR, `v0.33.0_community_score_${safeName}.png`),
      fullPage: false
    });

    console.log(
      `✅ [${cityName}] rows=${rowCount} top=${firstName} total=${firstTotal} 🥇#1`
    );
    return { ok: true, firstName, firstTotal, rowCount };
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

  const tops = results.map((r) => r.firstName).filter(Boolean);
  const allSame = new Set(tops).size <= 1;
  if (allSame) {
    console.log("⚠️ 警告: 3 个城市的 top community 全部相同 — 城市切换可能没有生效。");
  } else {
    console.log("✅ 3 个城市的 top community 各不相同 — 城市切换生效。");
  }

  process.exit(fail === 0 ? 0 : 1);
})();