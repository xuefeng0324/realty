const fs = require('fs');
const lines = fs.readFileSync('realty_app/src/pages/dashboard/dashboard.vue', 'utf8').split('\n');
const cards = [];
for (let i = 0; i < lines.length; i++) {
  const m = lines[i].match(/^(\s*)<!-- (v\d+\.\d+\.\d+|[A-Z][A-Z0-9-]+)/);
  if (m) cards.push({ line: i + 1, id: m[2], indent: m[1].length, snippet: lines[i].trim().slice(0, 100) });
}
console.log('Total dashboard cards:', cards.length);
for (const c of cards) console.log('L' + c.line + ' [indent=' + c.indent + ']: ' + c.id + ' ' + c.snippet);