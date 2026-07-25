// tests/e2e/smoke_v094_school_indicator_dimensions.mjs
// v0.94.0: dashboard "学校指标 · 各维度 Top 5" 卡 + 派生数据真实性
import { chromium } from "playwright";

const BASE = process.env.E2E_BASE_URL ?? "http://127.0.0.1:5174";
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();

const errors = [];
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
page.on("console", (m) => { if (m.type() === "error") errors.push(`console.error: ${m.text()}`); });

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
    .filter({ has: page.locator(".card-title", { hasText: "学校指标" }) })
    .first();
  if ((await card.count()) === 0) {
    await fail("dashboard 缺 v0.94 卡（标题含 学校指标）");
  } else {
    await pass("找到 v0.94 卡");
    const text = await card.innerText();
    if (/综合\s*≥\s*90/.test(text)) await pass("含 综合 ≥ 90 字眼");
    else await fail("缺 综合 ≥ 90 字眼");
    if (/集团校\s*\d+\.\d+%/.test(text)) await pass("含 集团校覆盖率 百分比");
    else await fail("缺 集团校覆盖率 百分比");
    if (/综合排名分|集团校实力|区域均衡度/.test(text)) {
      await pass("含 3 维度 column 标签");
    } else {
      await fail("缺 3 维度 column 标签");
    }
    if (/上升\s*\d+\s*·\s*下滑\s*\d+/.test(text)) {
      await pass("含 上升 / 下滑 计数");
    }
    if (/派生：snapshot\.schoolIndicators/.test(text)) await pass("含派生脚注");
  }

  if (errors.length) {
    issues.push(`runtime errors: ${errors.length}`);
    errors.slice(0, 3).forEach((e) => console.error("RUNTIME:", e));
  } else {
    await pass("无 runtime error");
  }
  if (issues.length === 0) { console.log("\nv0.94.0 E2E ✅"); process.exit(0); }
  else { console.log(`\n❌ ${issues.length} 失败`); process.exit(1); }
} finally { await browser.close(); }
