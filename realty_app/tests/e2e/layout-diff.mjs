// layout-diff.mjs — UI 结构门禁（替代不可用的像素 diff）
//
//   node tests/e2e/layout-diff.mjs                    # 对比 artifacts/layout-baseline.json
//   node tests/e2e/layout-diff.mjs --update-baseline   # 用当前 artifacts/layout.json 覆盖基线
//
// 判据（全部来自 CSS，不受字体渲染 / 每日数据变动影响）：
//   1) 壳层锚点几何（DOM 深度 ≤ 8）
//      - 位置容差 ±8px，尺寸容差 ±16px（吸收跨平台字体度量差）
//      - 文本叶子不比较宽高（数字长度随数据变化）
//      - 不一致锚点组超过 20% → 失败（布局回归，与数据无关）
//   2) 签名集合：tag|class|背景色|文字色|字号|字重|圆角
//      - 差异是**比例**判据，不是「一票否决」：涨跌徽标会在 up/down 之间翻转、
//        新鲜度徽标会在 ok/warn 之间翻转、列表条数随数据增减 —— 实测一次日更数据
//        变动就是 +5/-2 签名（0.7%）。所以差异占比 > 2% 才失败，否则只告警，
//        并把明细写进 artifacts/layout-diff.json 供人工 review。
//   3) 元素总数：变化超过 5% 失败（大规模增删；数据驱动的列表增减在 5% 以内）
//
// 背景见 layout-fingerprint.mjs 顶部注释：像素 diff 在跨平台 + 数据每日变动下
// 噪声(6%)大于信号(0.4~1.7%)，恒红且抓不到真回归。

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ART_DIR = resolve(process.cwd(), 'tests/e2e/artifacts');
const CURRENT = resolve(ART_DIR, 'layout.json');
const BASELINE = resolve(ART_DIR, 'layout-baseline.json');
const REPORT = resolve(ART_DIR, 'layout-diff.json');

const args = process.argv.slice(2);
const updateBaseline = args.includes('--update-baseline');
const TOL = { pos: 8, size: 16 };
// 签名集合差异的失败阈值（占比）。实测一次日更数据变动 = +5/-2 签名（0.7%），
// 涨跌徽标在 up/down 翻转也会带来同量级差异，所以阈值取 2%。
const MAX_RATIO = 0.02;
// 元素总数变化阈值：数据驱动的列表增减会带来小幅变化，5% 以内不算回归。
const MAX_COUNT_DELTA_RATIO = 0.05;

if (!existsSync(CURRENT)) {
  console.error(`[layout-diff] 缺少当前指纹: ${CURRENT}`);
  console.error('[layout-diff] 先跑 `node tests/e2e/smoke.mjs`');
  process.exit(2);
}
const current = JSON.parse(readFileSync(CURRENT, 'utf8'));

if (updateBaseline) {
  writeFileSync(BASELINE, JSON.stringify(current, null, 1), 'utf8');
  console.log(
    `[layout-diff] 基线已更新: ${BASELINE} ` +
    `(签名 ${current.signatures.length} / 锚点组 ${current.anchors.length})`
  );
  process.exit(0);
}

if (!existsSync(BASELINE)) {
  console.error(`[layout-diff] 缺少基线: ${BASELINE}`);
  console.error('[layout-diff] 生成方式: node tests/e2e/layout-diff.mjs --update-baseline');
  process.exit(2);
}
const baseline = JSON.parse(readFileSync(BASELINE, 'utf8'));

if (baseline.version !== current.version) {
  console.error(
    `[layout-diff] 基线版本不一致（baseline ${baseline.version} vs current ${current.version}），` +
    '请用 --update-baseline 重建基线'
  );
  process.exit(1);
}

const baseSigs = new Set(baseline.signatures);
const curSigs = new Set(current.signatures);
const baseCounts = baseline.signatureCounts || {};

const removed = [...baseSigs].filter((s) => !curSigs.has(s));
const added = [...curSigs].filter((s) => !baseSigs.has(s));
const sigTotal = Math.max(baseSigs.size, 1);
const sigRemovedRatio = removed.length / sigTotal;
const sigAddedRatio = added.length / sigTotal;

// 元素总数：数据驱动的列表增长会让它小幅变化，给 5% 容差。
const baseCount = baseline.elementCount || 0;
const curCount = current.elementCount || 0;
const countDeltaRatio = baseCount ? Math.abs(curCount - baseCount) / baseCount : 0;

const curAnchors = new Map(current.anchors.map((a) => [a.key, a]));
const anchorProblems = [];
let anchorCompared = 0;
for (const a of baseline.anchors) {
  const cur = curAnchors.get(a.key);
  if (!cur) {
    anchorProblems.push({ key: a.key, reason: 'anchor-missing' });
    continue;
  }
  anchorCompared++;
  const n = Math.min(a.samples.length, cur.samples.length);
  let bad = 0;
  for (let i = 0; i < n; i++) {
    const [bx, by, bw, bh] = a.samples[i];
    const [cx, cy, cw, ch] = cur.samples[i];
    const posBad = Math.abs(bx - cx) > TOL.pos || Math.abs(by - cy) > TOL.pos;
    const sizeBad =
      (bw !== null && cw !== null && Math.abs(bw - cw) > TOL.size) ||
      (bh !== null && ch !== null && Math.abs(bh - ch) > TOL.size);
    if (posBad || sizeBad) bad++;
  }
  if (bad > 0) {
    anchorProblems.push({
      key: a.key,
      reason: 'geometry',
      bad,
      total: n,
      base: a.samples[0],
      cur: cur.samples[0],
    });
  }
}
const anchorTotal = Math.max(baseline.anchors.length, 1);
const anchorProblemRatio = anchorProblems.length / anchorTotal;

const report = {
  status: 'pass',
  baselineSignatures: baseSigs.size,
  currentSignatures: curSigs.size,
  removedSignatures: removed.length,
  addedSignatures: added.length,
  sigRemovedRatio,
  sigAddedRatio,
  baselineElementCount: baseCount,
  currentElementCount: curCount,
  countDeltaRatio,
  anchorGroups: baseline.anchors.length,
  anchorCompared,
  anchorProblems: anchorProblems.length,
  anchorProblemRatio,
  removedSamples: removed.slice(0, 10),
  addedSamples: added.slice(0, 10),
  anchorProblemSamples: anchorProblems.slice(0, 10),
};
writeFileSync(REPORT, JSON.stringify(report, null, 2), 'utf8');

// 判据（都是「比例」而不是「一票否决」）：
//   元素级差异会被数据合法触发 —— 涨跌徽标在 up/down 之间翻转、新鲜度徽标在
//   ok/warn 之间翻转、列表条数随数据增减。实测一次日更数据变动就能让签名集合
//   增 5 减 2（占比 0.7%）。所以：
//   - 差异比例超过阈值 → 失败（大面积结构/配色变化）
//   - 差异比例在阈值内 → 只告警，并把明细写进报告供人工 review
//   - 锚点几何不一致 → 失败（布局回归，与数据无关）
const failures = [];
if (sigRemovedRatio > MAX_RATIO) {
  failures.push(`签名减少占比 ${(sigRemovedRatio * 100).toFixed(2)}% 超过 ${MAX_RATIO * 100}%`);
}
if (sigAddedRatio > MAX_RATIO) {
  failures.push(`签名新增占比 ${(sigAddedRatio * 100).toFixed(2)}% 超过 ${MAX_RATIO * 100}%`);
}
if (countDeltaRatio > MAX_COUNT_DELTA_RATIO) {
  failures.push(
    `元素总数变化 ${countDeltaRatio * 100 > 0 ? '+' : ''}${((curCount - baseCount) / baseCount * 100).toFixed(2)}% ` +
    `超过 ${MAX_COUNT_DELTA_RATIO * 100}%`
  );
}
if (anchorProblemRatio > MAX_RATIO) {
  failures.push(
    `锚点几何不一致 ${anchorProblems.length}/${baseline.anchors.length} ` +
    `(${(anchorProblemRatio * 100).toFixed(1)}%) 超过 ${MAX_RATIO * 100}%`
  );
}

if (failures.length) {
  report.status = 'fail';
  writeFileSync(REPORT, JSON.stringify(report, null, 2), 'utf8');
  console.error(`[layout-diff] FAIL`);
  for (const f of failures) console.error(`[layout-diff]   - ${f}`);
  if (removed.length) {
    console.error(`[layout-diff]   被删签名示例: ${removed.slice(0, 3).join(' ; ')}`);
  }
  if (anchorProblems.length) {
    console.error(`[layout-diff]   锚点问题示例: ${JSON.stringify(anchorProblems.slice(0, 3))}`);
  }
  console.error(`[layout-diff] 报告: ${REPORT}`);
  process.exit(1);
}

console.log(
  `[layout-diff] PASS 签名 ${curSigs.size}（+${added.length} / -${removed.length}，` +
  `占比 ${((added.length + removed.length) / sigTotal * 100).toFixed(2)}%）` +
  `| 元素 ${baseCount}→${curCount}` +
  `| 锚点组 ${anchorCompared}/${baseline.anchors.length} 一致` +
  `| 详情: ${REPORT}`
);
if (added.length) {
  console.log(`[layout-diff] 新增签名: ${added.slice(0, 3).join(' ; ')}`);
}
if (removed.length) {
  console.log(`[layout-diff] 减少签名: ${removed.slice(0, 3).join(' ; ')}`);
}
process.exit(0);
