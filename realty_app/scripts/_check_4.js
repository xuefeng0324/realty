const fs = require('fs');
const c = fs.readFileSync('realty_app/src/pages/dashboard/dashboard.vue', 'utf8');
const key = 'data-card-key="multi-community-compare"';
const idx = c.indexOf(key);
console.log(c.slice(idx, idx + 700));
console.log('====');
const idx2 = c.indexOf('data-card-key="listing-school-premium"');
console.log(c.slice(idx2, idx2 + 600));