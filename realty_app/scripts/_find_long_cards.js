const fs = require('fs');
const lines = fs.readFileSync('realty_app/src/pages/dashboard/dashboard.vue', 'utf8').split('\n');
const cards = [];
for (let i = 0; i < lines.length; i++) {
  const m = lines[i].match(/^\s*<!-- (v\d+\.\d+\.\d+)\s+/);
  if (m) cards.push({ line: i + 1, id: m[1], snippet: lines[i].trim().slice(0, 80) });
}
const endCards = [];
for (let i = 0; i < cards.length; i++) {
  const next = cards[i + 1];
  const start = cards[i].line;
  const end = next ? next.line - 1 : lines.length;
  endCards.push({ id: cards[i].id, start, end, len: end - start, snippet: cards[i].snippet });
}
endCards.sort((a, b) => b.len - a.len);
console.log('Top 15 longest cards:');
for (const c of endCards.slice(0, 15)) console.log('L' + c.start + ' - L' + c.end + ' (' + c.len + ' lines): ' + c.id + ' ' + c.snippet);
console.log('Total cards:', endCards.length);