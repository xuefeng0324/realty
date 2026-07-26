const fs = require('fs');
const content = fs.readFileSync('realty_app/src/pages/dashboard/dashboard.vue', 'utf8');
const skipped = ['region-compare', 'wangqian-rank-4w', 'district-wangqian-3cat', 'commute-rank', 'bedroom-area-heatmap', 'orientation-floor-matrix', 'decorate-age-matrix', 'community-scatter', 'district-map', 'school-dim-weighted', 'macro-lpr-card', 'hospital-rank', 'commercial-heat', 'listing-school-premium', 'multi-community-compare', 'stats70-drift'];
for (const k of skipped) {
  const key = 'data-card-key="' + k + '"';
  const idx = content.indexOf(key);
  if (idx < 0) continue;
  const slice = content.slice(idx, idx + 250);
  console.log('=== ' + k + ' ===');
  console.log(slice.replace(/\n/g, ' | ').slice(0, 250));
  console.log('');
}