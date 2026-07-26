// 地图找房主路径（对照贝壳）：筛选 + 点小区出底栏 + 点房源进详情
import { chromium } from "playwright";

const BASE_URL = (process.env.E2E_BASE_URL ?? "http://127.0.0.1:5174").replace(/\/$/, "");
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 420, height: 900 } });
const issues = [];

try {
  await page.goto(`${BASE_URL}/#/pages/map-view/map-view`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);

  const mode = await page.locator("#realty-map").getAttribute("data-map-mode");
  if (mode !== "listings") issues.push(`默认模式应为找房 listings，实际 ${mode}`);

  if ((await page.locator("[data-price-band]").count()) < 4) {
    issues.push("应有总价筛选按钮");
  }
  if ((await page.locator("[data-bedroom-band]").count()) < 4) {
    issues.push("应有户型筛选按钮");
  }

  const findCount = Number(await page.locator("#realty-map").getAttribute("data-find-listing-count"));
  if (!Number.isFinite(findCount) || findCount <= 0) {
    issues.push(`找房挂牌数应 > 0，实际 ${findCount}`);
  }

  await page.locator('[data-price-band="200_400"]').click();
  await page.waitForTimeout(400);
  const filtered = Number(await page.locator("#realty-map").getAttribute("data-find-listing-count"));
  if (!Number.isFinite(filtered) || filtered < 0) issues.push("筛选后挂牌数异常");
  if (filtered > findCount) issues.push("收紧总价后挂牌数不应增加");

  // 打开某小区底栏（H5 钩子，因 map marker 非 DOM）
  const opened = await page.evaluate(() => {
    const api = window.__realtyMapFind;
    if (!api?.openCommunitySheet) return false;
    // 取页面上第一个可见小区 id：从 summary 无法取，用种子常见 id 24 / 1
    api.openCommunitySheet(24);
    return true;
  });
  if (!opened) {
    issues.push("缺少 window.__realtyMapFind 测试钩子");
  } else {
    await page.waitForTimeout(300);
    if ((await page.locator("[data-find-sheet]").count()) !== 1) {
      // 小区 24 可能不在当前城，再试 1
      await page.evaluate(() => window.__realtyMapFind?.openCommunitySheet?.(1));
      await page.waitForTimeout(300);
    }
    if ((await page.locator("[data-find-sheet]").count()) !== 1) {
      issues.push("打开小区后应出现找房底栏");
    } else {
      const rows = await page.locator("[data-find-listing-id]").count();
      if (rows < 1) {
        // 筛选过严可能导致 0；放宽后再开
        await page.locator('[data-price-band="all"]').click();
        await page.locator('[data-bedroom-band="all"]').click();
        await page.waitForTimeout(200);
        await page.evaluate(() => window.__realtyMapFind?.openCommunitySheet?.(1));
        await page.waitForTimeout(300);
      }
      const rows2 = await page.locator("[data-find-listing-id]").count();
      if (rows2 < 1) issues.push("底栏应至少 1 条挂牌（放宽筛选后）");
      else {
        await page.locator("[data-find-listing-id]").first().click();
        await page.waitForTimeout(800);
        const url = page.url();
        if (!url.includes("listing-detail")) {
          issues.push(`点房源应进入详情，实际 URL=${url}`);
        }
      }
    }
  }

  if (issues.length) {
    console.error(`FAIL smoke_map_find：${issues.length}`);
    issues.forEach((i) => console.error(`- ${i}`));
    process.exitCode = 1;
  } else {
    console.log(`PASS smoke_map_find（默认找房，筛选前 ${findCount} 套，筛选后 ${filtered} 套）`);
  }
} finally {
  await browser.close();
}
