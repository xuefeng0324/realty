const fs = require('fs');
const lines = fs.readFileSync('realty_app/src/pages/dashboard/dashboard.vue', 'utf8').split('\n');
// 找 /* v0.91.0 70 城 12 月同比趋势派生卡 */ 注释 + 后续 dead CSS
let commentIdx = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('v0.91.0 70 城 12 月同比趋势派生卡')) {
    commentIdx = i;
    break;
  }
}
if (commentIdx < 0) {
  console.log('Comment not found');
  process.exit(1);
}
console.log('Comment at L' + (commentIdx + 1));
// 找下一个 /* 注释 /</style>
let blockEnd = commentIdx;
for (let i = commentIdx + 1; i < lines.length; i++) {
  if (lines[i].match(/^\s*\/\*/) || lines[i].match(/^<\/style>/)) {
    blockEnd = i - 1;
    break;
  }
}
console.log('Block ends at L' + (blockEnd + 1));
const toRemove = new Set();
for (let i = commentIdx; i <= blockEnd; i++) toRemove.add(i);
const result = lines.filter((_, i) => !toRemove.has(i));
fs.writeFileSync('realty_app/src/pages/dashboard/dashboard.vue', result.join('\n'), 'utf8');
console.log('Removed', toRemove.size, 'lines');
console.log('New line count:', result.length);