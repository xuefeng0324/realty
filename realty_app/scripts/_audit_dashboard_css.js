const fs = require('fs');
const lines = fs.readFileSync('realty_app/src/pages/dashboard/dashboard.vue', 'utf8').split('\n');
const cssStart = 8323;
const css = lines.slice(cssStart, lines.length).join('\n');
const classes = new Set();
const re = /\.([a-zA-Z][a-zA-Z0-9_-]*)/g;
let m;
while ((m = re.exec(css))) classes.add(m[1]);
console.log('CSS classes:', classes.size);

const template = lines.slice(0, 4884).join('\n');
const usedClasses = new Set();
const reT = /class="([^"]*)"/g;
while ((m = reT.exec(template))) {
  for (const c of m[1].split(/\s+/)) usedClasses.add(c);
}
console.log('Template classes:', usedClasses.size);

let unused = 0;
const unusedClasses = [];
for (const c of classes) {
  if (['page','container','row','col','flex','block','hidden','show','hide'].includes(c)) continue;
  if (!usedClasses.has(c)) {
    unused++;
    unusedClasses.push(c);
  }
}
console.log('Unused CSS classes:', unused);
console.log('Sample unused:', unusedClasses.slice(0, 30))