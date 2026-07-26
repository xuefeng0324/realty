const fs = require('fs');

// 28 张核心卡：版本号 -> card-key
const cardKeys = {
  'v0.8.0': 'district-8w-trend',
  'v0.10.0': 'wangqian-rank-4w',
  'v0.11.0': 'school-premium-rank',
  'v0.14.0 + v0.26.0': 'school-top-community',
  'v0.17.0': 'listing-school-premium',
  'v0.19.0': 'commercial-heat',
  'v0.20.0': 'multi-community-compare',
  'v0.23.0': 'district-wangqian-rank',
  'v0.24.0': 'commute-rank',
  'v0.25.0': 'layout-distribution',
  'v0.28.0': 'listing-tag-cloud',
  'v0.29.0': 'district-index',
  'v0.30.0': 'district-4w-change',
  'v0.32.0': 'life-convenience',
  'v0.33.0': 'community-score-rank',
  'v0.34.0': 'community-score-weights',
  'v0.41.0': 'listing-freshness',
  'v0.42.0': 'bedroom-area-heatmap',
  'v0.43.0': 'orientation-floor-matrix',
  'v0.44.0': 'decorate-age-matrix',
  'v0.45.0': 'community-scatter',
  'v0.46.0': 'district-map',
  'v0.47.0': 'school-dim-weighted',
  'v0.53.0': 'macro-lpr',
  'v1.116.0': 'stats70-drift',
  'v1.117.0': 'lpr-mortgage-signal',
  'v1.121.12': 'hospital-rank',
  'v1.121.15 周边商业': 'poi-commercial'
};

const lines = fs.readFileSync('realty_app/src/pages/dashboard/dashboard.vue', 'utf8').split('\n');

// 找每张核心卡的 <view ... data-tab=...> 起始行（紧接在 <!-- vX.X.X ... --> 注释之后）
let count = 0;
let i = 0;
while (i < lines.length) {
  const m = lines[i].match(/<!-- (v\d+\.\d+\.\d+(?: \+ v\d+\.\d+\.\d+)?)\s+\S+\s+(.+?)\s*-->/);
  if (m) {
    const version = m[1];
    const title = m[2];
    // 找 card-key
    let key = cardKeys[version + ' ' + title];
    if (!key) key = cardKeys[version];
    if (key) {
      // 找下一个 <view ... class="card" data-tab="...">
      for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
        if (lines[j].match(/<view\s+v-if=/) || (lines[j].match(/<view/) && lines[j].match(/class="card/))) {
          // 已在 v-if 中包，跳过
          if (lines[j].includes('v-if="!isCardHidden')) break;
          // 在 <view ...> 后插入 v-if="!isCardHidden('xxx')" 包裹
          const newLine = lines[j].replace(/<view/, `<view v-if="!isCardHidden('${key}')"`).replace(/(class="card[^"]*")/, `$1 data-card-key="${key}"`);
          if (newLine !== lines[j]) {
            lines[j] = newLine;
            count++;
          }
          break;
        }
      }
    }
  }
  i++;
}

fs.writeFileSync('realty_app/src/pages/dashboard/dashboard.vue', lines.join('\n'), 'utf8');
console.log('Added v-if to', count, 'cards');