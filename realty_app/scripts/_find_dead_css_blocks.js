const fs = require('fs');
const lines = fs.readFileSync('realty_app/src/pages/dashboard/dashboard.vue', 'utf8').split('\n');
const cssStart = 8323;
const css = lines.slice(cssStart, lines.length).join('\n');
const fullContent = lines.join('\n');

const cssClasses = new Set();
const re = /\.([a-zA-Z][a-zA-Z0-9_-]*)/g;
let m;
while ((m = re.exec(css))) cssClasses.add(m[1]);

// referenced classes: template class + string literal + dynamic class binding
const referencedClasses = new Set();
const reT = /class="([^"]*)"/g;
while ((m = reT.exec(fullContent))) {
  for (const c of m[1].split(/\s+/)) referencedClasses.add(c);
}
// :class=" prefix + suffix class
const reClass1 = /:class="([^"]+)"/g;
while ((m = reClass1.exec(fullContent))) {
  // 抠出 'abc' string literals
  const liter = m[1].match(/'([a-zA-Z][a-zA-Z0-9_-]*)'/g) || [];
  for (const l of liter) {
    const c = l.replace(/'/g, '');
    if (c.length > 3 && c.includes('-')) referencedClasses.add(c);
  }
  // 也 adding 접尾 part from 'xxx-' + suffix
  const strings = m[1].match(/'([a-zA-Z][a-zA-Z0-9_-]*)-/g);
  if (strings) for (const s of strings) {
    const prefix = s.replace(/'-?$/, '');
    referencedClasses.add(prefix);
  }
}

// 保守动态 class: Component 引用
// MacroKpiCell 使用 'stats70-' + subTrendClass
referencedClasses.add('stats70-up');
referencedClasses.add('stats70-down');
referencedClasses.add('stats70-flat');
// wq-fresh-ok / wq-fresh-warn / wq-fresh-stale 通过 wangqianFreshClass
referencedClasses.add('wq-fresh-ok');
referencedClasses.add('wq-fresh-warn');
referencedClasses.add('wq-fresh-stale');
// medal-gold / medal-silver / medal-bronze 通过 medalClass
referencedClasses.add('medal-gold');
referencedClasses.add('medal-silver');
referencedClasses.add('medal-bronze');
// aqi-good / aqi-ok / aqi-light / aqi-mid / aqi-unknown
referencedClasses.add('aqi-good');
referencedClasses.add('aqi-ok');
referencedClasses.add('aqi-light');
referencedClasses.add('aqi-mid');
referencedClasses.add('aqi-unknown');
// trend-flat
referencedClasses.add('trend-flat');
// wangqian-down
referencedClasses.add('wangqian-down');

const dead = new Set();
for (const c of cssClasses) {
  if (['page','container','row','col','flex','block','hidden','show','hide'].includes(c)) continue;
  if (!referencedClasses.has(c)) dead.add(c);
}
console.log('Dead CSS classes:', dead.size);
console.log('Sample:', [...dead].slice(0, 30));

// 找共同 block（按 /* ... */ 注释分组）
const cssLines = lines.slice(cssStart);
const toRemove = new Set();
let i = 0;
while (i < cssLines.length) {
  const l = cssLines[i];
  const commentMatch = l.match(/^\s*\/\*\s*(v\d+\.\d+\.\d+|F-\w+-\d+|v1\.121\.\d+)/);
  if (commentMatch) {
    let j = i + 1;
    let hasDead = false;
    let blockEnd = i;
    while (j < cssLines.length) {
      const ll = cssLines[j];
      if (ll.match(/^\s*\/\*/)) {
        blockEnd = j - 1;
        break;
      }
      if (ll.match(/^<\/style>/)) {
        blockEnd = j - 1;
        break;
      }
      // 检查是否含 dead class
      for (const c of dead) {
        if (ll.match(new RegExp('\\.' + c + '\\b')) || ll.match(new RegExp('\\.' + c + '(--|-)'))) {
          hasDead = true;
          break;
        }
      }
      j++;
    }
    if (j === cssLines.length) blockEnd = j - 1;
    if (i === blockEnd) {
      i++;
      continue;
    }
    if (hasDead) {
      // 删 i 到 blockEnd
      for (let k = i; k <= blockEnd; k++) toRemove.add(k + cssStart);
      i = blockEnd + 1;
      continue;
    }
  }
  i++;
}
console.log('Lines to remove:', toRemove.size);
const result = lines.filter((_, i) => !toRemove.has(i));
fs.writeFileSync('realty_app/src/pages/dashboard/dashboard.vue', result.join('\n'), 'utf8');
console.log('New line count:', result.length);