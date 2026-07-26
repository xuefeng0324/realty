const fs = require('fs');
const content = fs.readFileSync('realty_app/src/pages/dashboard/dashboard.vue', 'utf8');
// 找 data-tools 入口卡
const re = /data-data-tools-entry|data-tools|数据工具/g;
let m;
let count = 0;
let pos = -1;
while ((pos = content.search(re)) !== -1) {
  count++;
  pos++;
}
console.log('data-tools-entry occurrences:', count);

// 找 v1.121.14/v1.121.15 注释
const lines = content.split('\n');
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('v1.121.14') || lines[i].includes('v1.121.15') || lines[i].includes('v1.121.18') || lines[i].includes('v1.121.12')) {
    console.log('L' + (i+1) + ': ' + lines[i].trim().slice(0, 100));
  }
}