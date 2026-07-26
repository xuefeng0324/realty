const fs = require('fs');
const content = fs.readFileSync('realty_app/src/pages/dashboard/dashboard.vue', 'utf8');
const matches = [...content.matchAll(/data-card-key="([a-z][a-z0-9-]+)"/g)];
const keys = [...new Set(matches.map(m => m[1]))];
console.log('Total card-keys:', keys.length);
for (const k of keys) console.log(' ', k);