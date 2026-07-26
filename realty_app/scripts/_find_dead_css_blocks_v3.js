const fs = require('fs');
const lines = fs.readFileSync('realty_app/src/pages/dashboard/dashboard.vue', 'utf8').split('\n');
const cssStart = 8323;
const cssOnly = lines.slice(cssStart, lines.length).join('\n');
const fullContent = lines.join('\n');

// 重要: 只 .className { ... } 正式定义 才进入 cssClasses
// 简单规则：行以 .className 开头或缩进+ .className
const cssClasses = new Set();
const reC = /^\s*\.([a-zA-Z][a-zA-Z0-9_-]*)/gm;
let m;
while ((m = reC.exec(cssOnly))) cssClasses.add(m[1]);
console.log('Defined CSS classes:', cssClasses.size);

// 检查使用情况
const templateClasses = new Set();
const reT = /class="([^"]*)"/g;
while ((m = reT.exec(fullContent))) {
  for (const c of m[1].split(/\s+/)) templateClasses.add(c);
}

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
  const prefixMatches = expr.match(/'([a-zA-Z][a-zA-Z0-9_-]*)-'\s*\+/g) || [];
  for (const l of prefixMatches) {
    const c = l.replace(/'-'\s*\+$/, '').replace(/'/g, '');
    dynamicPrefixes.add(c);
  }
  // 找 'class-xxx' + varName
  const pMatches = expr.match(/'([a-zA-Z][a-zA-Z0-9_-]*)-'\s*\+/g);
  for (const l of pMatches || []) {
    dynamicPrefixes.add(l.replace(/'-'\s*\+$/, '').replace(/'/g, ''));
  }
}

const jsLiterals = new Set();
const reJS = /return\s+["']([a-zA-Z][a-zA-Z0-9_-]*)["']/g;
while ((m = reJS.exec(fullContent))) jsLiterals.add(m[1]);

// 加入 component props
dynamicPrefixes.add('stats70');
['wq-fresh-ok','wq-fresh-warn','wq-fresh-stale','medal-gold','medal-silver','medal-bronze','aqi-good','aqi-ok','aqi-light','aqi-mid','aqi-unknown','trend-flat','wangqian-down'].forEach(c => jsLiterals.add(c));

// 找 dead
const dead = new Set();
for (const c of cssClasses) {
  if (['page','container','row','col','flex','block','hidden','show','hide'].includes(c)) continue;
  // 排除常见 JS 关键字
  if (['id','value','kind','reason','tab','path','anchor','action','items','district','totalUnits','fastest','communityName','toast','scrollSelector','every','has','district_name','includes','navigateTo','good','ok','nope','row','col','level','name','date','label','city','type','count','rpx','height','px','em','rem','x','y','z','a','b','c','d','e','f','g','h','i','j','k','l','m','n','o','p','q','r','s','t','u','v','w'].includes(c)) continue;
  if (templateClasses.has(c)) continue;
  if (dynamicLiterals.has(c)) continue;
  if (jsLiterals.has(c)) continue;
  for (const p of dynamicPrefixes) {
    if (c.startsWith(p + '-')) continue;
  }
  dead.add(c);
}
console.log('Dead CSS classes:', dead.size);
console.log('Sample:', [...dead].slice(0, 40));