const fs = require('fs');
const lines = fs.readFileSync('realty_app/src/pages/dashboard/dashboard.vue', 'utf8').split('\n');
const cssStart = 8323;
const css = lines.slice(cssStart, lines.length).join('\n');
const fullContent = lines.join('\n');

// 真正 dead class: 既不在 class="..." 也不在 :class="..." 拼接也不在 JS 字符串
// 1. 找 template class 引用
const templateClasses = new Set();
const reT = /class="([^"]*)"/g;
let m;
while ((m = reT.exec(fullContent))) {
  for (const c of m[1].split(/\s+/)) templateClasses.add(c);
}

// 2. 找 :class=" 'xxx' + yyy " 或 'xxx-' + yyy 动态拼接
const reBind = /:class="([^"]+)"/g;
const dynamicPrefixes = new Set();
const dynamicLiterals = new Set();
while ((m = reBind.exec(fullContent))) {
  const expr = m[1];
  // 抠出 '...-...'  literal
  const litMatches = expr.match(/'([a-zA-Z][a-zA-Z0-9_-]*)'/g) || [];
  for (const l of litMatches) {
    const c = l.replace(/'/g, '');
    dynamicLiterals.add(c);
  }
  // 抠出 'xxx-' + yyy  - prefix
  const prefixMatches = expr.match(/'([a-zA-Z][a-zA-Z0-9_-]*)-'\s*\+/g) || [];
  for (const l of prefixMatches) {
    const c = l.replace(/'-'\s*\+$/, '').replace(/'/g, '');
    dynamicPrefixes.add(c);
  }
}

// 3. JS 字符串 literal 'xxx' (返回 class name)
const reJS = /return\s+"([a-zA-Z][a-zA-Z0-9_-]*)"/g;
const jsLiterals = new Set();
while ((m = reJS.exec(fullContent))) jsLiterals.add(m[1]);
const reJS2 = /return\s+'([a-zA-Z][a-zA-Z0-9_-]*)'/g;
while ((m = reJS2.exec(fullContent))) jsLiterals.add(m[1]);

// 4. Component dynamically class binding:
// MacroKpiCell subTrendClass props produces 'stats70-' + xxx
dynamicPrefixes.add('stats70');
// wq-fresh-ok/warn/stale in JS literal strings
jsLiterals.add('wq-fresh-ok');
jsLiterals.add('wq-fresh-warn');
jsLiterals.add('wq-fresh-stale');
// medal-gold/silver/bronze
jsLiterals.add('medal-gold');
jsLiterals.add('medal-silver');
jsLiterals.add('medal-bronze');
// aqi-good/ok/light/mid/unknown
jsLiterals.add('aqi-good');
jsLiterals.add('aqi-ok');
jsLiterals.add('aqi-light');
jsLiterals.add('aqi-mid');
jsLiterals.add('aqi-unknown');
// trend-flat
jsLiterals.add('trend-flat');
// wangqian-down
jsLiterals.add('wangqian-down');

// 5. 找 CSS 中所有 class
const cssClasses = new Set();
const reC = /\.([a-zA-Z][a-zA-Z0-9_-]*)/g;
while ((m = reC.exec(css))) cssClasses.add(m[1]);

// 6. 找 dead
const dead = new Set();
for (const c of cssClasses) {
  if (['page','container','row','col','flex','block','hidden','show','hide'].includes(c)) continue;
  if (templateClasses.has(c)) continue;
  if (dynamicLiterals.has(c)) continue;
  if (jsLiterals.has(c)) continue;
  // 检查是否匹配 dynamic prefix
  for (const p of dynamicPrefixes) {
    if (c.startsWith(p + '-')) continue;
  }
  dead.add(c);
}
console.log('Dead CSS classes:', dead.size);
console.log('Sample:', [...dead].slice(0, 30));