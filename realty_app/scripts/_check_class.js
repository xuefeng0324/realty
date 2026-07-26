const fs = require('fs');
const content = fs.readFileSync('realty_app/src/pages/dashboard/dashboard.vue', 'utf8');
console.log('home-search-input in template:', content.includes('home-search-input'));
console.log('.home-search-input in CSS:', content.includes('.home-search-input'));