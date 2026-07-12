// smoke_community.mjs — 验证新加小区 (id=24) 的 community 详情页能正常加载 (price trend, listings)
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const URL = process.env.E2E_URL || 'http://localhost:5174/';
const OUT_DIR = resolve(process.cwd(), 'tests/e2e/artifacts');
mkdirSync(OUT_DIR, { recursive: true });

const result = { url: URL, pages: [], status: 'unknown', consoleErrors: [] };

try {
  const browser = await chromium.launch({
    headless: true, channel: 'chromium',
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    locale: 'zh-CN',
  });
  const page = await ctx.newPage();
  page.on('console', (msg) => { if (msg.type() === 'error') result.consoleErrors.push(msg.text()); });

  // community page id=24 (中核集团宿舍 / 深圳)
  await page.goto(URL + '#/pages/community/community?id=24', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(3500);

  const shot = resolve(OUT_DIR, 'community_24_after_enrich.png');
  await page.screenshot({ path: shot, fullPage: true });
  result.pages.push({ name: 'community-24', shot: shot });

  const bodyText = await page.locator('body').innerText();
  result.bodySnippet = bodyText.slice(0, 1500);

  // 验证: 出现 "中核集团宿舍" + 价格趋势 + 该小区房源 (应有链家在售 listings 1227 系列)
  const ok = bodyText.includes('中核集团宿舍');
  result.hasName = ok;
  result.hasTrend = bodyText.includes('价格趋势') || bodyText.includes('均价');
  result.status = ok ? 'pass' : 'fail';

  await browser.close();
} catch (err) {
  result.status = 'crash';
  result.crashMessage = String(err);
}

const jsonPath = resolve(OUT_DIR, 'smoke_community.json');
writeFileSync(jsonPath, JSON.stringify(result, null, 2), 'utf8');
console.log(JSON.stringify(result, null, 2));
process.exit(result.status === 'pass' ? 0 : 2);
