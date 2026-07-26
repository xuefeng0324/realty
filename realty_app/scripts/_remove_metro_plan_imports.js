const fs = require('fs');
const path = 'realty_app/src/pages/dashboard/dashboard.vue';
const lines = fs.readFileSync(path, 'utf8').split('\n');

// 手动确定 metroPlanRank import 块结束行
// L5042 = '} from "../../local/metroPlanningRanking";'
// L5044 = 'import {'
// L5060 = '} from "../../local/metroPlanningGeoAnalysis";'
// 之前看到 L4989 是 hospitalGeoCoverageStats 之前 = 找出 metroPlanRank import 起始
// 让我们精确找：包含 'summarizeMetroPlanningByCity' 行
let startRank = -1, endRank = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('import {') && lines[i+1] && lines[i+1].includes('summarizeMetroPlanningByCity')) {
    startRank = i;
    break;
  }
}
for (let i = startRank; i < lines.length; i++) {
  if (lines[i].includes('} from "../../local/metroPlanningRanking";')) {
    endRank = i;
    break;
  }
}
console.log('metroPlanningRanking import block L' + (startRank+1) + ' - L' + (endRank+1));

let startGeo = -1, endGeo = -1;
for (let i = endRank + 1; i < lines.length; i++) {
  if (lines[i].includes('import {') && lines[i+1] && lines[i+1].includes('getMetroPlanningGeoByCityCrossReference')) {
    startGeo = i;
    break;
  }
}
for (let i = startGeo; i < lines.length; i++) {
  if (lines[i].includes('} from "../../local/metroPlanningGeoAnalysis";')) {
    endGeo = i;
    break;
  }
}
console.log('metroPlanningGeoAnalysis import block L' + (startGeo+1) + ' - L' + (endGeo+1));

// 删除 2 个块（从后往前删避免 index 错）
const toRemove = new Set();
for (let i = startRank; i <= endRank; i++) toRemove.add(i);
for (let i = startGeo; i <= endGeo; i++) toRemove.add(i);
const result = lines.filter((_, i) => !toRemove.has(i));
console.log('Removed', toRemove.size, 'lines');
fs.writeFileSync(path, result.join('\n'), 'utf8');
console.log('New line count:', result.length);