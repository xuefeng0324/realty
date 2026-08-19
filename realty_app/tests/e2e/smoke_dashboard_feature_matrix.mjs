import { chromium } from "playwright";

const BASE_URL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:5174";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 420, height: 900 } });
const issues = [];
const runtimeErrors = [];

page.on("pageerror", (error) => runtimeErrors.push(error.message));
page.on("console", (message) => {
  if (message.type() === "error") runtimeErrors.push(message.text());
});

const matrix = {
  本地: ["政府网签", "库存、供需与土地"],
  全国: ["全国 70 城指数"],
  宏观: ["利率与信贷", "汇市与跨境资金", "产业与投资", "区域与城市基本面", "贸易与外需"],
  工具: ["趋势可视化", "行政区行情地图", "数据工具"]
};

try {
  await page.goto(`${BASE_URL}/#/pages/market/market`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(900);

  const metrics = await page.locator(".market-metric-grid .metric-card:visible").allTextContents();
  for (const semantic of ["挂牌价", "网签量", "70 城指数"]) {
    if (!metrics.some((text) => text.includes(semantic))) {
      issues.push(`行情页缺少核心口径：${semantic}`);
    }
  }

  for (const [section, titles] of Object.entries(matrix)) {
    const tab = page.locator(".segmented-tabs__item:visible").filter({ hasText: section });
    if ((await tab.count()) !== 1) {
      issues.push(`行情缺少分类：${section}`);
      continue;
    }
    await tab.click();
    await page.waitForTimeout(120);
    if ((await tab.getAttribute("aria-pressed")) !== "true") {
      issues.push(`${section} 分类未激活`);
    }
    for (const title of titles) {
      const entry = page.locator(".entity-list-item:visible").filter({ hasText: title });
      if ((await entry.count()) !== 1) issues.push(`${section} 分类缺少入口：${title}`);
    }
  }

  if (runtimeErrors.length) issues.push(`行情功能矩阵出现运行错误：${runtimeErrors[0]}`);

  if (issues.length) {
    console.error(`${issues.length} 失败`);
    issues.forEach((issue) => console.error(`- ${issue}`));
    process.exitCode = 1;
  } else {
    console.log("总计: 行情 4 分类 / 11 个迁移入口通过");
  }
} finally {
  await browser.close();
}
