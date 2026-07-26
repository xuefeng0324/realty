const fs = require('fs');
const lines = fs.readFileSync('realty_app/src/pages/dashboard/dashboard.vue', 'utf8').split('\n');
const cssStart = 8323;
const css = lines.slice(cssStart, lines.length).join('\n');
const fullContent = lines.join('\n');

const cssClasses = new Set();
const re = /\.([a-zA-Z][a-zA-Z0-9_-]*)/g;
let m;
while ((m = re.exec(css))) cssClasses.add(m[1]);

// 找 fullContent 中所有 class 字面量（包括 'xxx' "xxx" 等）
const referencedClasses = new Set();
const reT = /class="([^"]*)"/g;
while ((m = reT.exec(fullContent))) {
  for (const c of m[1].split(/\s+/)) referencedClasses.add(c);
}
// 找 'class-name' string literals
const reS = /'([a-zA-Z][a-zA-Z0-9_-]*)'/g;
while ((m = reS.exec(fullContent))) {
  // 排除太短或常用的值
  const c = m[1];
  if (c.length > 3 && c.includes('-')) referencedClasses.add(c);
}

const dead = new Set();
for (const c of cssClasses) {
  if (['page','container','row','col','flex','block','hidden','show','hide'].includes(c)) continue;
  if (!referencedClasses.has(c)) dead.add(c);
}
console.log('Dead CSS classes:', dead.size);
console.log('Sample:', [...dead].slice(0, 30));