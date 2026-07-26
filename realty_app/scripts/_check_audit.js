const fs = require('fs');
const content = fs.readFileSync('realty_app/src/pages/dashboard/dashboard.vue', 'utf8');

// 模拟 audit 的 referenced classes
const referencedClasses = new Set();
const reT = /class="([^"]*)"/g;
let m;
while ((m = reT.exec(content))) {
  for (const c of m[1].split(/\s+/)) referencedClasses.add(c);
}
console.log('home-search-input in referenced:', referencedClasses.has('home-search-input'));
console.log('home-search-btn in referenced:', referencedClasses.has('home-search-btn'));
console.log('home-search-modes in referenced:', referencedClasses.has('home-search-modes'));