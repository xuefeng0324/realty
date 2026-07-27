const fs = require('fs');
const content = fs.readFileSync('realty_app/src/pages/dashboard/dashboard.vue', 'utf8');
const lines = content.split('\n');

// 删除 L10088-L10391 (含) — 4 段可视化 CSS
const startIdx = 10088 - 1; // 10087
const endIdx = 10391;        // 10391 (含) → 删到 10392 之前
console.log('First:', lines[startIdx].trim());
console.log('Last:', lines[endIdx].trim());

const newLines = [...lines.slice(0, startIdx), ...lines.slice(endIdx + 1)];
fs.writeFileSync('realty_app/src/pages/dashboard/dashboard.vue', newLines.join('\n'));
console.log('Before:', lines.length, 'After:', newLines.length, 'Δ:', lines.length - newLines.length);