const fs = require('fs');
const lines = fs.readFileSync('realty_app/src/pages/dashboard/dashboard.vue', 'utf8').split('\n');
const re = /<!-- (v\d+\.\d+\.\d+(?: \+ v\d+\.\d+\.\d+)?)\s+(\S+)\s+(.+?)\s*-->/;
const titles = [];
for (let i = 0; i < lines.length; i++) {
  const m = lines[i].match(re);
  if (m) titles.push({ line: i + 1, version: m[1], tag: m[2], title: m[3] });
}
console.log('Total cards:', titles.length);
const untitled = [];
for (let i = 0; i < titles.length; i++) {
  const t = titles[i];
  let hasKey = false;
  for (let j = t.line; j < t.line + 5 && j < lines.length; j++) {
    if (lines[j].includes('data-card-key=')) { hasKey = true; break; }
  }
  if (!hasKey) {
    console.log('L' + t.line + ': ' + t.version + ' ' + t.tag + ' ' + t.title);
    untitled.push(t);
  }
}
console.log('No card-key:', untitled.length);