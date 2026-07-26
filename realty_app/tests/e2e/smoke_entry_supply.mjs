/**
 * test-entry-1：金刚区「库存」→ 滚动到 #entry-supply
 * 需本地 H5：E2E_BASE_URL 默认 http://127.0.0.1:5174
 */
import { chromium } from "playwright";

const BASE_URL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:5174";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 420, height: 900 } });
const issues = [];

try {
  await page.goto(`${BASE_URL}/#/pages/dashboard/dashboard`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForTimeout(1800);

  // 金刚区库存按钮（home-king-tile / data-home-king）
  const inv = page.locator(".home-king-tile, [data-home-king]").filter({ hasText: "库存" }).first();
  if ((await inv.count()) < 1) {
    issues.push("找不到金刚区「库存」入口");
  } else {
    await inv.click();
    await page.waitForTimeout(1500);
    const supply = page.locator("#entry-supply");
    if ((await supply.count()) < 1) {
      issues.push("点击库存后页面无 #entry-supply（当前城市可能无供需卡）");
    } else {
      // 视口相交即可（sticky 头 / block:center 可能导致 y 略负）
      const visible = await supply.evaluate((el) => {
        const r = el.getBoundingClientRect();
        const vh = window.innerHeight || 900;
        return r.bottom > 40 && r.top < vh - 40;
      });
      if (!visible) {
        const box = await supply.boundingBox();
        issues.push(`#entry-supply 未进入视口附近 (y=${box ? Math.round(box.y) : "?"})`);
      }
    }
  }

  if (issues.length) {
    console.error(`${issues.length} 失败`);
    issues.forEach((i) => console.error(`- ${i}`));
    process.exitCode = 1;
  } else {
    console.log("总计: entry-supply 通过");
  }
} catch (e) {
  console.error("E2E 失败（是否已起 npm run dev:h5？）:", e instanceof Error ? e.message : e);
  process.exitCode = 1;
} finally {
  await browser.close();
}
