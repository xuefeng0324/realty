const fs = require('fs');
const path = 'realty_app/src/pages/dashboard/dashboard.vue';
const lines = fs.readFileSync(path, 'utf8').split('\n');

// 找 metroPlan computed 块 (L5555-L5595)
// 起始: 'const metroFastLines = computed(...'
// 结束: 'const metroBuildingLines = computed(...' 之后的 });
// 用 'const metroBuildingLines' + ');' 行 作为结束

let startIdx = -1, endIdx = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('const metroFastLines = computed')) {
    startIdx = i;
    break;
  }
}
for (let i = startIdx; i < lines.length; i++) {
  if (lines[i].includes('const metroBuildingLines = computed')) {
    // 找 ); 结束
    for (let j = i; j < lines.length; j++) {
      if (lines[j].trim() === ');') {
        endIdx = j;
        break;
      }
    }
    break;
  }
}
console.log('metroPlan computed block L' + (startIdx+1) + ' - L' + (endIdx+1));
for (let i = startIdx; i <= endIdx; i++) lines[i] = '';
const result = lines.filter((_, i) => i < startIdx || i > endIdx).join('\n');
fs.writeFileSync(path, result, 'utf8');
console.log('Removed', (endIdx - startIdx + 1), 'lines');
console.log('New line count:', result.split('\n').length);