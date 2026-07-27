const fs = require('fs');
const content = fs.readFileSync('realty_app/src/pages/dashboard/dashboard.vue', 'utf8');
const lines = content.split('\n');
console.log('Starting lines:', lines.length);

// 1. refs/computed: 只删 v0.42-v0.45 refs/scatter 衍生, 不删 freshness/communityScore/life*
// 起点: // v0.42.0 trend-22: 户型 × 面积 联合分布
// 终点: const scatterValueDipCrossCity = ...; 之后第一个空行 (// fresh start?)

// 找 v0.42-v0.45 refs 起点
const refsStart = lines.findIndex(l => l.includes('// v0.42.0 trend-22: 户型 × 面积 联合分布'));
// 找下一个 // freshness 注释 = L5910
const freshnessIdx = lines.findIndex(l => l.includes('const freshnessCitySummary'));
// 找 scatterValueDipCrossCity 的结束
const scatterValueDipIdx = lines.findIndex(l => l.includes('const scatterValueDipCrossCity'));
let scatterValueDipEnd = scatterValueDipIdx;
while (scatterValueDipEnd < lines.length && !lines[scatterValueDipEnd].startsWith(');')) scatterValueDipEnd++;
console.log('refs start L' + (refsStart + 1));
console.log('scatterValueDipCrossCity L' + (scatterValueDipIdx + 1));
console.log('scatterValueDipCrossCity end L' + (scatterValueDipEnd + 1));

// 删 LrefsStart 到 LscatterValueDipEnd (含); ) 后下一行
const refsEnd = scatterValueDipEnd;
// 检查 refsEnd 之后是空行 + // 注释
console.log('refsEnd+1:', lines[refsEnd + 1]);
console.log('refsEnd+2:', lines[refsEnd + 2]);

let r = [...lines.slice(0, refsStart), ...lines.slice(refsEnd + 1)];
console.log('After delete refs:', r.length, 'Δ:', lines.length - r.length);

// 2. reload 函数
const reloadStart = r.findIndex(l => l.includes('async function reloadBedroomArea'));
// 找 reloadScatter 函数结束
const reloadScatterIdx = r.findIndex(l => l.includes('async function reloadScatter'));
let scatterEnd = reloadScatterIdx;
while (scatterEnd < r.length && !r[scatterEnd].startsWith('}')) scatterEnd++;
// 找 scatterEnd 之后第一个注释或函数定义
let reloadEnd = scatterEnd;
while (reloadEnd < r.length && r[reloadEnd].trim() === '') reloadEnd++;
console.log('reloadStart L' + (reloadStart + 1) + ': ' + r[reloadStart].trim());
console.log('reloadScatter L' + (reloadScatterIdx + 1));
console.log('scatterEnd L' + (scatterEnd + 1) + ': ' + r[scatterEnd].trim());
console.log('reloadEnd L' + (reloadEnd + 1) + ': ' + r[reloadEnd].trim());

r = [...r.slice(0, reloadStart), ...r.slice(reloadEnd)];
console.log('After delete reload:', r.length, 'Δ:', lines.length - r.length);

// 3. reload 调用
const reloadCallStart = r.findIndex(l => l.includes('await reloadBedroomArea();'));
const reloadCallEnd = r.findIndex(l => l.includes('await reloadDistrictMap();'));
console.log('reloadCallStart L' + (reloadCallStart + 1));
console.log('reloadCallEnd L' + (reloadCallEnd + 1));

// 删 reloadCallStart - 1 注释行 + reloadDistrictMap 调用行 (含)
r = [
  ...r.slice(0, reloadCallStart - 1),
  ...r.slice(reloadCallEnd + 1)
];
console.log('After delete reload calls:', r.length, 'Δ:', lines.length - r.length);

fs.writeFileSync('realty_app/src/pages/dashboard/dashboard.vue', r.join('\n'));