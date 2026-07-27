const fs = require('fs');
const content = fs.readFileSync('realty_app/src/pages/dashboard/dashboard.vue', 'utf8');
const lines = content.split('\n');
console.log('Starting lines:', lines.length);

// 阶段 1: 找 v0.42-v0.45 reload 块边界 (按注释定位)
// reloadBedroomArea 在 "// v0.42.0 trend-22: 户型 × 面积 联合分布" 注释之后
function findBlockByComments(lines, startComment, endComment) {
  const startIdx = lines.findIndex(l => l.includes(startComment));
  if (startIdx < 0) return { start: -1, end: -1 };
  // endComment 是下一个 "v0.46.0" 注释前一行
  const endIdx = lines.findIndex(l => l.includes(endComment));
  if (endIdx < 0) return { start: -1, end: -1 };
  // 实际: 删除从 startIdx 到 endIdx-1
  return { start: startIdx, end: endIdx };
}

// 1. 删除 reload 函数块
// HEAD 中: L5533 "// v0.42.0 trend-22: 户型 × 面积 联合分布" → L5699 "// v0.46.0 map-11: 行政区 + 社区 marker 地图"
// 我们删 reload 函数: 找第一个 "async function reloadBedroomArea" 到 "// v0.46.0" 注释前
function findReloadBlock(lines) {
  const startIdx = lines.findIndex(l => l.includes('async function reloadBedroomArea'));
  if (startIdx < 0) return null;
  // 找到 reloadDistrictMap 之后第一个 "}" 之前的内容
  const districtMapIdx = lines.findIndex(l => l.includes('async function reloadDistrictMap'));
  if (districtMapIdx < 0) return null;
  // 找 reloadDistrictMap 函数的结束 "}" 之后第一个空行 (注释前)
  let endIdx = districtMapIdx;
  while (endIdx < lines.length && !lines[endIdx].includes('// v0.46.0')) {
    endIdx++;
  }
  return { start: startIdx, end: endIdx };
}

const reloadBlock = findReloadBlock(lines);
console.log('reload block:', reloadBlock);

// 2. 删除 refs/computed 段: 找 "// v0.42.0 trend-22: 户型 × 面积 联合分布" 注释到 "// v0.46.0" 注释
const refsStart = lines.findIndex(l => l.includes('// v0.42.0 trend-22: 户型 × 面积 联合分布'));
const refsEnd = lines.findIndex(l => l.includes('// v0.46.0 map-11: 行政区 + 社区 marker 地图'));
console.log('refs block:', { start: refsStart, end: refsEnd });

// 3. 删除 reload 调用 (L6571 in HEAD → 找 reloadBedroomArea 调用)
const reloadCallIdx = lines.findIndex(l => l.includes('await reloadBedroomArea();'));
const reloadCallEndIdx = lines.findIndex((l, i) => i > reloadCallIdx && l.includes('await reloadDistrictMap();'));
console.log('reload calls:', { start: reloadCallIdx, end: reloadCallEndIdx });

// 执行删除 (从后往前删以免索引错位)
let r = lines;
// 1. 删除 reload 函数块 (含 reloadDistrictMap 调用注释)
r = [...r.slice(0, reloadBlock.start), ...r.slice(reloadBlock.end)];
console.log('After delete reload functions:', r.length, 'Δ:', lines.length - r.length);

// 2. 删除 refs/computed 段 (r 中索引)
const refsStartNew = r.findIndex(l => l.includes('// v0.42.0 trend-22: 户型 × 面积 联合分布'));
const refsEndNew = r.findIndex(l => l.includes('// v0.46.0 map-11: 行政区 + 社区 marker 地图'));
r = [...r.slice(0, refsStartNew), ...r.slice(refsEndNew)];
console.log('After delete refs/computed:', r.length, 'Δ:', lines.length - r.length);

// 3. 删除 reload 调用块 (r 中索引, 找包含 reloadBedroomArea 的 await 行, 删到 reloadDistrictMap 调用之后下一行注释)
const reloadCallStart = r.findIndex(l => l.includes('await reloadBedroomArea();'));
const reloadCallEnd = r.findIndex((l, i) => i > reloadCallStart && l.includes('await reloadDistrictMap();'));
// 删 reloadBedroomArea 之前的注释 + 之后到 reloadDistrictMap 之间的 reloadScatter + reloadDistrictMap 注释
r = [
  ...r.slice(0, reloadCallStart - 1),  // 删 "// v0.42.0" 注释
  ...r.slice(reloadCallEnd + 1)         // 删 reloadDistrictMap 调用行
];
console.log('After delete reload calls:', r.length, 'Δ:', lines.length - r.length);

fs.writeFileSync('realty_app/src/pages/dashboard/dashboard.vue', r.join('\n'));