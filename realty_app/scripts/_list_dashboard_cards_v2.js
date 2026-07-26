const fs = require('fs');
const lines = fs.readFileSync('realty_app/src/pages/dashboard/dashboard.vue', 'utf8').split('\n');
const titles = [];
for (let i = 0; i < lines.length; i++) {
  const m = lines[i].match(/<!-- (v\d+\.\d+\.\d+)\s+(\S+)\s+(.+?)\s*-->/);
  if (m) titles.push({ line: i + 1, version: m[1], tag: m[2], title: m[3] });
}
console.log('Total cards:', titles.length);
for (const t of titles) console.log('L' + t.line + ': ' + t.version + ' ' + t.tag + ' - ' + t.title);