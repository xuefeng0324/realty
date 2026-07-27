const fs = require('fs');
const content = fs.readFileSync('realty_app/src/pages/dashboard/dashboard.vue', 'utf8');
const lines = content.split('\n');

// 删除 L2578 - L3112 (4 张可视化卡 HTML)
// 注意: lines 索引是 0-based，所以对应 L2579-L3113
const startIdx = 2578 - 1; // 2577
const endIdx = 3112;       // 3112 (含) → 删到 3113 之前
// 验证
console.log('First line of delete range:', lines[startIdx].trim());
console.log('Last line of delete range:', lines[endIdx].trim());

const newLines = [...lines.slice(0, startIdx), ...lines.slice(endIdx + 1)];
const newContent = newLines.join('\n');

fs.writeFileSync('realty_app/src/pages/dashboard/dashboard.vue', newContent);
console.log('Before:', lines.length, 'After:', newLines.length, 'Δ:', lines.length - newLines.length);