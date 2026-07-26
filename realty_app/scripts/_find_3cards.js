const fs = require('fs');
const lines = fs.readFileSync('realty_app/scripts/_dashboard_v121137.txt', 'utf8').split('\n');
const starts = {};
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('v0.39.0 trend-19: 特征画像溢价')) starts.fp = i;
  if (lines[i].includes('v0.40.0 trend-20: 标签组合热度')) starts.tc = i;
  if (lines[i].includes('districtMeta && districtMeta.items.length > 0')) starts.dm = i;
}
console.log('starts:', starts);