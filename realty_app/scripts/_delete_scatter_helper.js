const fs = require('fs');
const content = fs.readFileSync('realty_app/src/pages/dashboard/dashboard.vue', 'utf8');
const lines = content.split('\n');

// 找 L5485-L5526 范围: "// v0.42.0 trend-22:" 到 "};" (scatterAxisTicks 结束)
const startIdx = lines.findIndex(l => l.includes('// v0.42.0 trend-22: 户型 × 面积 联合分布'));
const endIdx = lines.findIndex(l => l.includes('const scatterAxisTicks = computed'));
// end 是 "};" 行
let endRealIdx = endIdx;
while (endRealIdx < lines.length && !lines[endRealIdx].startsWith('});')) endRealIdx++;
console.log('start:', startIdx + 1, 'end:', endRealIdx + 1);

const r = [...lines.slice(0, startIdx), ...lines.slice(endRealIdx + 1)];
console.log('Δ:', lines.length - r.length);
fs.writeFileSync('realty_app/src/pages/dashboard/dashboard.vue', r.join('\n'));