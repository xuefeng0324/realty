// smoke_poi.mjs — 验证 listing-detail / community 展示 POI
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

  // 1. listing-detail (1227 → community_id=1 in v0.4.1)
  await page.goto(URL + '#/pages/listing-detail/listing-detail?id=1227', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(4000);
  const ldShot = resolve(OUT_DIR, 'listing_detail_1227_poi.png');
  await page.screenshot({ path: ldShot, fullPage: true });
  result.pages.push({ name: 'listing-detail-poi', shot: ldShot });

  const ldBody = await page.locator('body').innerText();
  result.listingDetailSnippet = ldBody.slice(0, 3500);

  // 验证: "周边配套" + "地铁" + "m"
  result.listingDetail_ok = {
    hasPoiSection: ldBody.includes('周边配套'),
    hasSubway: ldBody.includes('地铁'),
    hasDistanceUnit: /\d+m|\d+\.\d+km/.test(ldBody),
    hasSchool: ldBody.includes('学校'),
    hasHospital: ldBody.includes('医院'),
    hasMall: ldBody.includes('商场'),
    hasPark: ldBody.includes('公园'),
  };

  // 2. community (24 中核集团宿舍)
  await page.goto(URL + '#/pages/community/community?id=24', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(4000);
  const cShot = resolve(OUT_DIR, 'community_24_poi.png');
  await page.screenshot({ path: cShot, fullPage: true });
  result.pages.push({ name: 'community-poi', shot: cShot });

  const cBody = await page.locator('body').innerText();
  result.communitySnippet = cBody.slice(0, 3500);

  result.community_ok = {
    hasPoiSection: cBody.includes('周边配套'),
    hasSubway: cBody.includes('地铁'),
    hasDistanceUnit: /\d+m|\d+\.\d+km/.test(cBody),
    hasAtLeast3Cats: ['地铁', '学校', '医院', '商场', '公园']
      .filter((c) => cBody.includes(c)).length,
  };

  result.status = (result.listingDetail_ok.hasPoiSection && result.listingDetail_ok.hasSubway &&
                   result.community_ok.hasPoiSection && result.community_ok.hasDistanceUnit && result.community_ok.hasAtLeast3Cats >= 3)
    ? 'pass' : 'fail';

  await browser.close();
} catch (err) {
  result.status = 'crash';
  result.crashMessage = String(err);
}
const jsonPath = resolve(OUT_DIR, 'smoke_poi.json');
writeFileSync(jsonPath, JSON.stringify(result, null, 2), 'utf8');
console.log(JSON.stringify(result, null, 2));
process.exit(result.status === 'pass' ? 0 : 2);
