// tests/e2e/smoke_v093_district_drift_strict.mjs
// v0.93.1: dashboard v0.93 卡"严格 ≥13 周"口径 + 兜底说明
import { chromium } from "playwright";

const BASE = process.env.E2E_BASE_URL ?? "http://127.0.0.1:5174";
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();

const errors = [];
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(`console.error: ${m.text()}`);
});

const issues = [];
async function fail(msg) { issues.push(msg); console.error("FAIL:", msg); }
async function pass(msg) { console.log("OK:", msg); }

try {
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2200);
  await page.goto(`${BASE}/#/pages/dashboard/dashboard`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2500);

  const card = page
    .locator(".card")
    .filter({ has: page.locator(".card-title", { hasText: "分区近 12 周均价变动" }) })
    .first();
  if ((await card.count()) === 0) {
    await fail("dashboard 缺少 v0.93 卡（标题: 分区近 12 周均价变动）");
  } else {
    await pass("找到 v0.93 卡");
    const text = await card.innerText();
    // 严格口径字眼 OR 兜底口径字眼
    if (/≥13 周/.test(text)) {
      await pass("含 ≥13 周 严格口径字眼");
    } else if (/全\s*\d+\s*区样本不足时回退/.test(text)) {
      await pass("无 ≥13 周 数据时显示兜底口径");
    } else {
      await fail(`v0.93 卡角标既无严格也无兜底字眼。当前 text: ${text.slice(0, 200)}`);
    }
    // 脚注
    if (/严格\s*12\s*周对比仅\s*\d+\s*区/.test(text)) {
      await pass("脚注：严格 12 周对比仅 X 区");
    } else {
      await fail(`v0.93 卡脚注缺失或格式异。当前: ${text.slice(-200)}`);
    }
  }

  if (errors.length) {
    issues.push(`runtime errors: ${errors.length}`);
    errors.slice(0, 3).forEach((e) => console.error("RUNTIME:", e));
  } else {
    await pass("无 runtime error");
  }

  if (issues.length === 0) {
    console.log("\nv0.93.1 strict 模式 E2E ✅");
    process.exit(0);
  } else {
    console.log(`\n❌ ${issues.length} 失败`);
    process.exit(1);
  }
} finally {
  await browser.close();
}
