import { chromium } from "playwright";

const BASE_URL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:5174";
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 420, height: 900 } });
const page = await context.newPage();
const issues = [];

try {
  await page.goto(`${BASE_URL}/#/pages/dashboard/dashboard`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1800);

  const initialCollapsed = await page.locator(".overview-card--collapsed").count();
  if (initialCollapsed !== 6) issues.push(`默认应折叠 6 个概览分组，实际 ${initialCollapsed}`);

  const summaries = await page.locator("[data-overview-summary]").count();
  if (summaries !== 6) issues.push(`折叠状态下应保留 6 个摘要，实际 ${summaries}`);
  const collapsedDetailCount = await page.locator("#overview-school .sd-block, #overview-lpr .lpr-kpi, #overview-community .cs-weights").count();
  if (collapsedDetailCount !== 0) issues.push(`折叠状态仍渲染了 ${collapsedDetailCount} 个详情模块`);

  await page.locator(".overview-jump").filter({ hasText: "区域" }).click({ force: true });
  await page.waitForTimeout(800);
  const afterOneExpand = await page.locator(".overview-card--collapsed").count();
  if (afterOneExpand !== 5) issues.push(`单卡展开后应剩 5 个折叠分组，实际 ${afterOneExpand}`);

  const toggleAll = page.locator(".overview-toggle-all");
  await toggleAll.click();
  const afterAllExpand = await page.locator(".overview-card--collapsed").count();
  if (afterAllExpand !== 0) issues.push(`全部展开后仍有 ${afterAllExpand} 个折叠分组`);
  const expandedDetailCount = await page.locator("#overview-school .sd-block, #overview-lpr .lpr-kpi, #overview-community .cs-weights").count();
  if (expandedDetailCount !== 4) issues.push(`全部展开后详情模块应恢复 4 个，实际 ${expandedDetailCount}`);
  const providentFundCount = await page.locator("[data-provident-fund-rate]").count();
  if (providentFundCount !== 1) issues.push(`全部展开后应显示公积金利率卡，实际 ${providentFundCount}`);
  const monthlyBefore = await page.locator("[data-combo-monthly]").textContent();
  const fundInput = page.locator('[data-combo-input="fund"] input');
  await fundInput.fill("80");
  const monthlyAfterAmount = await page.locator("[data-combo-monthly]").textContent();
  if (monthlyAfterAmount === monthlyBefore) issues.push("修改公积金贷款额度后月供未更新");
  await page.locator('[data-combo-years="20"]').click();
  const monthlyAfterYears = await page.locator("[data-combo-monthly]").textContent();
  if (monthlyAfterYears === monthlyAfterAmount) issues.push("切换20年期限后月供未更新");
  await page.locator(".combo-reset").click();
  await page.waitForTimeout(150);
  if (await page.locator('[data-combo-years="30"].combo-year-btn--active').count() !== 1) issues.push("重置后未恢复30年");
  if (await fundInput.inputValue() !== "50") issues.push("重置后公积金额度未恢复50万元");

  await toggleAll.click();
  const afterAllCollapse = await page.locator(".overview-card--collapsed").count();
  if (afterAllCollapse !== 6) issues.push(`全部收起后应恢复 6 个折叠分组，实际 ${afterAllCollapse}`);

  let inventoryToggle = page.locator(".gz-inventory-toggle");
  if (await inventoryToggle.count() === 0) {
    const cityButton = page.locator(".form-row").filter({ hasText: "城市" });
    await cityButton.click();
    const guangzhou = page.locator(".sheet-item").filter({ hasText: "广州" });
    await guangzhou.click();
    await page.waitForTimeout(700);
    inventoryToggle = page.locator(".gz-inventory-toggle");
  }
  if (await inventoryToggle.count() !== 1) {
    issues.push("切换广州后未显示新房库存卡片");
  } else {
    await inventoryToggle.click();
    const districtDetails = await page.locator("[data-gz-inventory-detail]").count();
    if (districtDetails !== 11) issues.push(`展开库存分区后应显示 11 区，实际 ${districtDetails}`);
    await inventoryToggle.click();
    const collapsedDetails = await page.locator("[data-gz-inventory-detail]").count();
    if (collapsedDetails !== 0) issues.push(`收起库存分区后仍有 ${collapsedDetails} 行详情`);
  }

  if (issues.length) {
    console.error(`${issues.length} 失败 / 0 通过`);
    for (const issue of issues) console.error(`- ${issue}`);
    process.exitCode = 1;
  } else {
    console.log("总计: 15 通过 / 0 失败");
  }
} finally {
  await browser.close();
}
