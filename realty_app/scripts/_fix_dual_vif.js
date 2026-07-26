// 合并重复 v-if: v-if="!isCardHidden('xxx')" v-if="..." → v-if="!isCardHidden('xxx') && (...)"
const fs = require('fs');
const lines = fs.readFileSync('realty_app/src/pages/dashboard/dashboard.vue', 'utf8').split('\n');
let count = 0;
const re = /<view v-if="!isCardHidden\('([^']+)'\)" v-if="([^"]+)"/g;
for (let i = 0; i < lines.length; i++) {
  const m = re.exec(lines[i]);
  if (m) {
    const key = m[1];
    const other = m[2];
    lines[i] = lines[i].replace(re, `<view v-if="!isCardHidden('${key}') && (${other})"`);
    re.lastIndex = 0;
    count++;
  }
}
fs.writeFileSync('realty_app/src/pages/dashboard/dashboard.vue', lines.join('\n'), 'utf8');
console.log('Fixed dual v-if:', count);