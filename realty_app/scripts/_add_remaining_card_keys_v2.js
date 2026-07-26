// 给剩余 7 张核心卡添加 card-key + v-if (multi-line)
const fs = require('fs');
const lines = fs.readFileSync('realty_app/src/pages/dashboard/dashboard.vue', 'utf8').split('\n');

// 版本号 -> card-key
const cardKeyMap = {
  'v0.23.0': 'district-wangqian-3cat',
  'v0.24.0': 'commute-rank',
  'v0.33.0': 'community-score-rank',
  'v0.34.0': 'community-score-weights',
  'v0.47.0': 'school-dim-weighted',
  'v0.53.0': 'macro-lpr-card',
  'v1.121.15 周边商业': 'poi-commercial',
  'v0.26.0': 'school-top-filter-sort'
};

const re = /<!-- (v\d+\.\d+\.\d+(?: \+ v\d+\.\d+\.\d+)?)\s+(\S+)\s+(.+?)\s*-->/;
let count = 0;
for (let i = 0; i < lines.length; i++) {
  const m = lines[i].match(re);
  if (m) {
    const version = m[1];
    const tag = m[2];
    const title = m[3];
    let key = cardKeyMap[version + ' ' + title] || cardKeyMap[version];
    if (!key) continue;
    // 找下一个包含 v-if 的行
    for (let j = i + 1; j < Math.min(i + 10, lines.length); j++) {
      if (lines[j].includes('v-if=') && !lines[j].includes('isCardHidden(')) {
        // 把 !isCardHidden('xxx') && 加在 v-if 值前面
        lines[j] = lines[j].replace(/v-if="([^"]+)"/, (full, vif) => {
          return `v-if="!isCardHidden('${key}') && (${vif})" data-card-key="${key}"`;
        });
        count++;
        break;
      }
    }
  }
}
fs.writeFileSync('realty_app/src/pages/dashboard/dashboard.vue', lines.join('\n'), 'utf8');
console.log('Added card-key to', count, 'cards');