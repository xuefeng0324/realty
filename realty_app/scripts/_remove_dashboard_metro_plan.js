// 清理 dashboard.vue 中 metroPlan dead code (imports + CSS)
const fs = require('fs');
const path = 'realty_app/src/pages/dashboard/dashboard.vue';
let content = fs.readFileSync(path, 'utf8');
const lines = content.split('\n');
let removedLines = 0;

// 1. 移除 metroPlanningRanking import 块 (L5020-L5043 approx)
let startIdx = -1, endIdx = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('} from "../../local/metroPlanningRanking";')) {
    endIdx = i;
    // 往前找 import {... 起始
    for (let j = i - 1; j >= 0; j--) {
      if (lines[j].includes('import {') && lines[j].includes('metroPlanningRanking')) {
        startIdx = j;
        break;
      }
      if (lines[j].includes('import {')) break;
    }
    break;
  }
}
if (startIdx >= 0 && endIdx > startIdx) {
  console.log('Removing metroPlanningRanking import block L' + (startIdx + 1) + '-L' + (endIdx + 1));
  for (let i = startIdx; i <= endIdx; i++) lines[i] = '';
  removedLines += (endIdx - startIdx + 1);
}

// 2. 移除 metroPlanningGeoAnalysis import 块
startIdx = -1; endIdx = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('} from "../../local/metroPlanningGeoAnalysis";')) {
    endIdx = i;
    for (let j = i - 1; j >= 0; j--) {
      if (lines[j].includes('import {') && lines[j].includes('metroPlanningGeoAnalysis')) {
        startIdx = j;
        break;
      }
      if (lines[j].includes('import {')) break;
    }
    break;
  }
}
if (startIdx >= 0 && endIdx > startIdx) {
  console.log('Removing metroPlanningGeoAnalysis import block L' + (startIdx + 1) + '-L' + (endIdx + 1));
  for (let i = startIdx; i <= endIdx; i++) lines[i] = '';
  removedLines += (endIdx - startIdx + 1);
}

// 3. 移除 metroPlan 相关 CSS (/* v1.121.14 规划地铁 */ 块)
startIdx = -1; endIdx = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('v1.121.14 规划地铁')) {
    startIdx = i;
    // 找下一个 */ 结束
    for (let j = i; j < lines.length; j++) {
      if (lines[j].includes('*/') && j > i) {
        endIdx = j;
        break;
      }
    }
    break;
  }
}
if (startIdx >= 0 && endIdx >= startIdx) {
  console.log('Removing metroPlan CSS block L' + (startIdx + 1) + '-L' + (endIdx + 1));
  for (let i = startIdx; i <= endIdx; i++) lines[i] = '';
  removedLines += (endIdx - startIdx + 1);
}

content = lines.filter(l => l !== '').join('\n');
fs.writeFileSync(path, content, 'utf8');
console.log('Removed', removedLines, 'lines total');
console.log('New line count:', content.split('\n').length);