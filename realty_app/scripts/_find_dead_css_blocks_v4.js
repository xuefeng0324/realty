const fs = require('fs');
const lines = fs.readFileSync('realty_app/src/pages/dashboard/dashboard.vue', 'utf8').split('\n');
const cssStart = 8300;
const cssOnly = lines.slice(cssStart, lines.length).join('\n');
const fullContent = lines.join('\n');

const cssClasses = new Set();
const reC = /^\s*\.([a-zA-Z][a-zA-Z0-9_-]*)/gm;
let m;
while ((m = reC.exec(cssOnly))) cssClasses.add(m[1]);
console.log('Defined CSS classes:', cssClasses.size);

const templateClasses = new Set();
const reT = /class="([^"]*)"/g;
while ((m = reT.exec(fullContent))) {
  for (const c of m[1].split(/\s+/)) templateClasses.add(c);
}
console.log('Template classes:', templateClasses.size);

const reBind = /:class="([^"]+)"/g;
const dynamicLiterals = new Set();
const dynamicPrefixes = new Set();
while ((m = reBind.exec(fullContent))) {
  const expr = m[1];
  const litMatches = expr.match(/'([a-zA-Z][a-zA-Z0-9_-]*)'/g) || [];
  for (const l of litMatches) {
    const c = l.replace(/'/g, '');
    dynamicLiterals.add(c);
  }
  const prefixMatches = expr.match(/'([a-zA-Z][a-zA-Z0-9_-]*)(--|-)'\s*\+/g) || [];
  for (const l of prefixMatches) {
    const c = l.replace(/(-|--)'\s*\+$/, '').replace(/'/g, '');
    dynamicPrefixes.add(c);
  }
}

const jsLiterals = new Set();
const reJS = /return\s+["']([a-zA-Z][a-zA-Z0-9_-]*)["']/g;
while ((m = reJS.exec(fullContent))) jsLiterals.add(m[1]);

// 排除 component dynamic binding
dynamicPrefixes.add('stats70');
['wq-fresh-ok','wq-fresh-warn','wq-fresh-stale','medal-gold','medal-silver','medal-bronze','aqi-good','aqi-ok','aqi-light','aqi-mid','aqi-unknown','trend-flat','wangqian-down','medal-flat','medal-flat-mini','cs-medal-gold','cs-medal-silver','cs-medal-bronze','cs-medal-flat','wq-fresh'].forEach(c => jsLiterals.add(c));
dynamicPrefixes.add('home-king-icon');
dynamicPrefixes.add('hero-slide');
dynamicPrefixes.add('quick-tile-icon');

// 找 dead
const dead = new Set();
for (const c of cssClasses) {
  if (['page','container','row','col','flex','block','hidden','show','hide','cell','left','right','center'].includes(c)) continue;
  if (templateClasses.has(c)) continue;
  if (dynamicLiterals.has(c)) continue;
  if (jsLiterals.has(c)) continue;
  let isMatch = false;
  for (const p of dynamicPrefixes) {
    if (c.startsWith(p + '-') || c.startsWith(p + '--')) isMatch = true;
  }
  if (isMatch) continue;
  dead.add(c);
}
console.log('Dead CSS classes:', dead.size);
console.log('Sample:', [...dead].slice(0, 50));