const fs = require('fs');
const lines = fs.readFileSync('realty_app/src/pages/dashboard/dashboard.vue', 'utf8').split('\n');
// 找 4 张可视化卡
const titles = [
  'v0.42.0 trend-22 户型',
  'v0.43.0 trend-23 朝向',
  'v0.44.0 trend-24 装修',
  'v0.45.0 trend-25 社区'
];
for (const t of titles) {
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(t)) {
      console.log('L' + (i + 1) + ': ' + lines[i].trim().slice(0, 80));
    }
  }
}