const fs = require('fs');
const content = fs.readFileSync('realty_app/src/pages/dashboard/dashboard.vue', 'utf8');
const lines = content.split('\n');
console.log('Starting lines:', lines.length);

// 1. 删除 reload 函数 (reloadBedroomArea → reloadScatter)
// 起点: async function reloadBedroomArea
// 终点: reloadScatter 函数结束 "}" 之后下一行 (// v0.46.0 注释前的空行)
const reloadStart = lines.findIndex(l => l.includes('async function reloadBedroomArea'));
// 找 reloadScatter 函数结束 "}" 之后的下一行
const reloadScatterIdx = lines.findIndex(l => l.includes('async function reloadScatter'));
if (reloadScatterIdx < 0) {
  console.error('reloadScatter not found');
  process.exit(1);
}
// reloadScatter 函数体 (try { ... } catch { ... })
// 找 reloadScatter 之后第一个 "// v0.46.0" 注释
let reloadEnd = reloadScatterIdx;
while (reloadEnd < lines.length && !lines[reloadEnd].includes('// v0.46.0')) reloadEnd++;
console.log('reload block:', { start: reloadStart, end: reloadEnd });
console.log('  start line:', lines[reloadStart].trim());
console.log('  end line:', lines[reloadEnd].trim());

// 2. 删除 refs/computed 段
const refsStart = lines.findIndex(l => l.includes('// v0.42.0 trend-22: 户型 × 面积 联合分布'));
const refsEnd = lines.findIndex(l => l.includes('// v0.46.0 map-11: 行政区 + 社区 marker 地图'));
console.log('refs block:', { start: refsStart, end: refsEnd });

// 3. 删除 reload 调用
const reloadCallStart = lines.findIndex(l => l.includes('await reloadBedroomArea();'));
const reloadCallEnd = lines.findIndex(l => l.includes('await reloadDistrictMap();'));
console.log('reload calls:', { start: reloadCallStart, end: reloadCallEnd });

// 顺序: 从后往前删 (reload calls → refs → reload functions)
let r = lines;
// 1. 删除 reload 函数 (reloadBedroomArea + reloadOrientationFloor + reloadDecorateAge + reloadScatter)
// reloadStart 是 reloadBedroomArea 函数, reloadEnd 是 reloadScatter 函数之后的下一个 "}"
// reloadEnd 是 "// v0.46.0" 注释所在行 (不是函数结束)
// 调整: 删 reloadStart 到 reloadScatter 函数体结束
// reloadScatter 函数体: async reloadScatter() { try { ... } catch { ... } }
// 找到 reloadScatter 函数结束的 "}" 行
let scatterEnd = reloadScatterIdx;
while (scatterEnd < lines.length && !lines[scatterEnd].startsWith('}')) scatterEnd++;
// 找到 reloadEnd 应该是 scatterEnd + 1 (空行 + 注释)
const realReloadEnd = reloadEnd; // "v0.46.0" 注释行
console.log('realReloadEnd:', realReloadEnd, 'content:', lines[realReloadEnd].trim());

r = [...r.slice(0, reloadStart), ...r.slice(realReloadEnd)];
console.log('After delete reload functions:', r.length, 'Δ:', lines.length - r.length);

// 2. 删除 refs/computed (r 中索引)
const refsStartNew = r.findIndex(l => l.includes('// v0.42.0 trend-22: 户型 × 面积 联合分布'));
const refsEndNew = r.findIndex(l => l.includes('// v0.46.0 map-11: 行政区 + 社区 marker 地图'));
r = [...r.slice(0, refsStartNew), ...r.slice(refsEndNew)];
console.log('After delete refs/computed:', r.length, 'Δ:', lines.length - r.length);

// 3. 删除 reload 调用
const reloadCallStartNew = r.findIndex(l => l.includes('await reloadBedroomArea();'));
// reload 调用块: reloadBedroomArea 之前的注释行 + reloadBedroomArea + reloadOrientationFloor + reloadDecorateAge + reloadScatter 调用 (5 行)
// reloadDistrictMap 之前是 reloadScatter 调用, reloadDistrictMap 注释, reloadDistrictMap 调用
// 找 reloadCallEnd: reloadDistrictMap 调用的索引
const reloadCallEndNew = r.findIndex(l => l.includes('await reloadDistrictMap();'));
// 删 reloadBedroomArea 注释行 (reloadCallStart - 1) 到 reloadDistrictMap 调用行 (reloadCallEndNew) - 1
r = [
  ...r.slice(0, reloadCallStartNew - 1),  // 删注释
  ...r.slice(reloadCallEndNew)            // 删到 reloadDistrictMap 之后 (含 reloadDistrictMap 调用)
];
console.log('After delete reload calls:', r.length, 'Δ:', lines.length - r.length);

fs.writeFileSync('realty_app/src/pages/dashboard/dashboard.vue', r.join('\n'));