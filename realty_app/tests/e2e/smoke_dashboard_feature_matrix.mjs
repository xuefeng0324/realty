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
  price: [
    "区/板块对比", "区级近 8 周房价趋势", "区房价指数", "区涨幅榜", "小区综合评分",
    "特征画像溢价", "标签组合热度", "房源新鲜度", "户型 × 面积", "朝向 × 楼层",
    "装修 × 楼龄", "总价 × 单价 散点", "LPR + 房贷利率", "高学区评分房源"
  ],
  school: ["房源标签云", "区情画像", "学区 5 维评分", "学区溢价榜"],
  transit: ["通勤时长榜", "地铁步行通勤", "地铁规划受益", "生活便利度", "商业热度"],
  map: ["总价 × 单价 散点", "行政区域图"]
};

try {
  await page.goto(`${BASE_URL}/#/pages/dashboard/dashboard`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1600);

  for (const [tab, titles] of Object.entries(matrix)) {
    await page.locator(`.dash-tab[data-tab="${tab}"]`).click();
    await page.waitForTimeout(250);
    if (await page.locator(".dash-tab--active").getAttribute("data-tab") !== tab) {
      issues.push(`${tab} 专业页签未激活`);
    }
    for (const title of titles) {
      const visible = page.locator(".card-title:visible").filter({ hasText: title });
      if (await visible.count() < 1) issues.push(`${tab} 页签缺少可见功能卡：${title}`);
    }
    if (tab === "price") {
      const districtRow = page.locator("#overview-market .bar-row:visible").first();
      if (await districtRow.count() === 1) {
        await districtRow.click();
        await page.waitForTimeout(250);
      }
    }
  }

  await page.locator('.dash-tab[data-tab="price"]').click();
  if (await page.locator(".bar-row:visible").count() <= 0) issues.push("价格画像没有区级柱状数据");
  if (await page.locator(".lf-row:visible").count() <= 0) issues.push("房源新鲜度没有分布数据");

  await page.locator('.dash-tab[data-tab="school"]').click();
  if (await page.locator(".sd-block:visible").count() <= 0) issues.push("学区评分没有维度数据");
  if (await page.locator(".sp-row:visible").count() <= 0) issues.push("学区溢价榜没有排行数据");

  await page.locator('.dash-tab[data-tab="transit"]').click();
  if (await page.locator(".commute-row:visible, .mw-row:visible, .mb-row:visible").count() <= 0) {
    issues.push("通勤地铁页签没有排行数据");
  }

  await page.locator('.dash-tab[data-tab="map"]').click();
  if (await page.locator("svg:visible").count() <= 0) issues.push("地图视图页签没有可见图形");

  if (runtimeErrors.length) issues.push(`功能矩阵出现 ${runtimeErrors.length} 个运行错误：${runtimeErrors[0]}`);

  if (issues.length) {
    console.error(`${issues.length} 失败`);
    issues.forEach((issue) => console.error(`- ${issue}`));
    process.exitCode = 1;
  } else {
    console.log("总计: 29 通过 / 0 失败");
  }
} finally {
  await browser.close();
}
