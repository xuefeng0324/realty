import { chromium } from "playwright";

const BASE_URL = (process.env.E2E_BASE_URL ?? "http://127.0.0.1:5174").replace(/\/$/, "");
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 420, height: 900 } });
const issues = [];
const runtimeErrors = [];

page.on("pageerror", (error) => runtimeErrors.push(error.message));
page.on("console", (message) => {
  if (message.type() === "error") runtimeErrors.push(message.text());
});

try {
  await page.goto(`${BASE_URL}/#/pages/school/school`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1400);
  const overview = page.locator("[data-education-overview]");
  if (await overview.count() !== 1) issues.push("广州学校页未显示官方教育事业概览");
  for (const value of ["3,806", "292.63", "1012", "420"]) {
    if (await overview.getByText(value, { exact: true }).count() !== 1) {
      issues.push(`广州教育概览缺少官方统计值：${value}`);
    }
  }
  if (await overview.getByText("广州市教育局", { exact: false }).count() !== 1) {
    issues.push("广州教育概览未显示官方发布机构");
  }
  const searchInput = page.locator("input").first();
  await searchInput.fill("中学");
  await page.getByText("搜索", { exact: true }).click({ force: true });
  await page.waitForTimeout(300);
  const resultRows = page.locator(".school-row");
  if (await resultRows.count() <= 0) {
    issues.push("学校查询没有可进入详情的结果");
  } else {
    await resultRows.first().click();
    await page.waitForTimeout(500);
    if (!page.url().includes("/pages/school-detail/school-detail?id=")) issues.push("点击学校结果未进入详情页");
    if (await page.locator("[data-school-detail]").count() !== 1) issues.push("学校详情主体未显示");
    if (await page.locator(".factor-row").count() !== 4) issues.push("学校评分构成应显示4项");
    if (await page.getByText("数据说明", { exact: true }).count() !== 1) issues.push("学校详情缺少数据说明");
    if (await page.getByText("人工整理样本", { exact: true }).count() !== 1) issues.push("学校详情未标明整理样本来源");
    if (await page.getByText("当前快照未绑定", { exact: true }).count() !== 1) issues.push("学校详情未披露逐校来源链接缺失");
  }

  await page.goto(`${BASE_URL}/#/pages/school-detail/school-detail?id=999999`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(400);
  if (await page.locator("[data-school-error]").count() !== 1) issues.push("不存在学校未显示错误状态");

  const invalidPage = await browser.newPage({ viewport: { width: 420, height: 900 } });
  await invalidPage.goto(`${BASE_URL}/#/pages/school-detail/school-detail?id=invalid`, { waitUntil: "domcontentloaded" });
  await invalidPage.waitForTimeout(300);
  if (await invalidPage.getByText("学校编号无效").count() < 1) issues.push("无效学校编号未被拦截");
  await invalidPage.close();

  if (runtimeErrors.length) issues.push(`页面记录到 ${runtimeErrors.length} 个错误：${runtimeErrors[0]}`);
  if (issues.length) {
    console.error(`${issues.length} 失败`);
    issues.forEach((issue) => console.error(`- ${issue}`));
    process.exitCode = 1;
  } else {
    console.log("总计: 16 通过 / 0 失败");
  }
} finally {
  await browser.close();
}
