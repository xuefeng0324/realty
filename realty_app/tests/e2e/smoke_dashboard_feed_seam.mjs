/**
 * 总览信息流「去分割缝」
 * 验收：docs/DASHBOARD_FEED_ACCEPTANCE.md
 *
 * 判据：
 * 1) 非页头 .card 的 margin-bottom ≤ 2px
 * 2) .page 与抽样卡片表面亮度差 ≤ 0.04（同色连续，避免宽沟露对比底）
 * 3) 相邻「均为 .card」的兄弟间隙 ≤ 2px（跳过 topnav/tabs/hero 等功能条）
 * 4) 容器内任意相邻可见兄弟：若间隙 > 12px 则失败（禁止大块 gutter）
 */
import { chromium } from "playwright";

const BASE_URL = (process.env.E2E_BASE_URL ?? "http://127.0.0.1:5174").replace(/\/$/, "");
const MAX_CARD_GAP_PX = 2;
const MAX_ANY_SIBLING_GAP_PX = 12;
const FILTER_MAX_GAP_PX = 12;

const parseRgb = (value) => {
  const m = value?.match(/rgba?\((\d+)[, ]+(\d+)[, ]+(\d+)/i);
  return m ? m.slice(1, 4).map(Number) : null;
};

const lum = (rgb) => {
  const v = rgb.map((c) => {
    const x = c / 255;
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
};

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 420, height: 900 } });
const page = await context.newPage();
const issues = [];

try {
  for (const mode of ["light", "dark"]) {
    await page.goto(`${BASE_URL}/#/pages/dashboard/dashboard`, { waitUntil: "domcontentloaded" });
    await page.evaluate((theme) => localStorage.setItem("realty:themeMode", theme), mode);
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1800);

    const report = await page.evaluate(
      ({ maxCardGap, maxAnyGap, filterMaxGap }) => {
        const visible = (el) => {
          const style = getComputedStyle(el);
          const rect = el.getBoundingClientRect();
          return style.display !== "none" && style.visibility !== "hidden" && rect.height > 4;
        };
        const kids = Array.from(document.querySelector(".container")?.children || []).filter(visible);
        const siblingGaps = [];
        for (let i = 0; i < kids.length - 1; i++) {
          const a = kids[i];
          const b = kids[i + 1];
          const gap = Math.round((b.getBoundingClientRect().top - a.getBoundingClientRect().bottom) * 100) / 100;
          const mb = parseFloat(getComputedStyle(a).marginBottom) || 0;
          const aIsCard = a.classList.contains("card");
          const bIsCard = b.classList.contains("card");
          const isFilter = a.classList.contains("filter-card");
          siblingGaps.push({
            index: i,
            gap,
            mb,
            aIsCard,
            bIsCard,
            isFilter,
            aClass: a.className.toString().slice(0, 60),
            bClass: b.className.toString().slice(0, 60)
          });
        }

        const cards = kids.filter((el) => el.classList.contains("card"));
        const cardMargins = cards.map((el) => ({
          isFilter: el.classList.contains("filter-card"),
          mb: parseFloat(getComputedStyle(el).marginBottom) || 0,
          cls: el.className.toString().slice(0, 60)
        }));

        const pageEl = document.querySelector(".page");
        const sampleCard = cards.find((c) => !c.classList.contains("filter-card"));
        return {
          kidCount: kids.length,
          cardCount: cards.length,
          siblingGaps,
          cardMargins,
          pageBg: pageEl ? getComputedStyle(pageEl).backgroundColor : "",
          cardBg: sampleCard ? getComputedStyle(sampleCard).backgroundColor : "",
          limits: { maxCardGap, maxAnyGap, filterMaxGap }
        };
      },
      { maxCardGap: MAX_CARD_GAP_PX, maxAnyGap: MAX_ANY_SIBLING_GAP_PX, filterMaxGap: FILTER_MAX_GAP_PX }
    );

    if (report.cardCount < 3) {
      issues.push(`${mode}: 可见 .card 过少 (${report.cardCount})`);
    }

    for (const m of report.cardMargins) {
      if (m.isFilter) continue;
      if (m.mb > MAX_CARD_GAP_PX) {
        issues.push(`${mode}: card marginBottom=${m.mb}px > ${MAX_CARD_GAP_PX} (${m.cls})`);
      }
    }

    for (const g of report.siblingGaps) {
      if (g.gap > MAX_ANY_SIBLING_GAP_PX) {
        issues.push(`${mode}: 兄弟间隙 ${g.gap}px > ${MAX_ANY_SIBLING_GAP_PX} [${g.aClass}]→[${g.bClass}]`);
      }
      if (g.aIsCard && g.bIsCard) {
        const limit = g.isFilter ? FILTER_MAX_GAP_PX : MAX_CARD_GAP_PX;
        if (g.gap > limit) {
          issues.push(`${mode}: card→card 间隙 ${g.gap}px > ${limit} [${g.aClass}]→[${g.bClass}]`);
        }
      }
    }

    const pb = parseRgb(report.pageBg);
    const cb = parseRgb(report.cardBg);
    if (pb && cb) {
      const d = Math.abs(lum(pb) - lum(cb));
      if (d > 0.04) {
        issues.push(`${mode}: page/card 亮度差 ${d.toFixed(3)} > 0.04`);
      }
    }

    const wide = report.siblingGaps.filter((g) => g.gap > 2).length;
    console.log(
      `[${mode}] kids=${report.kidCount} cards=${report.cardCount} gaps>2px=${wide} page=${report.pageBg} card=${report.cardBg}`
    );
  }
} finally {
  await browser.close();
}

if (issues.length) {
  console.error("FAIL smoke_dashboard_feed_seam:");
  for (const issue of issues) console.error(" -", issue);
  process.exit(1);
}
console.log("PASS smoke_dashboard_feed_seam");
