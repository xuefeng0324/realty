const fs = require('fs');
for (const name of ['listing_structure','district_portrait','feature_premium','listing_tags','tag_combination','school_indicator','school_dimension']) {
  const content = fs.readFileSync('realty_app/scripts/_dt_' + name + '.txt', 'utf8');
  const re = /(?:v-for|v-if)="([^"]+)"/g;
  let m;
  const seen = new Set();
  const refs = [];
  while ((m = re.exec(content))) {
    const expr = m[1];
    const id = expr.match(/^(\w+)/)?.[1];
    if (id && !seen.has(id)) { seen.add(id); refs.push(id); }
  }
  console.log(name + ':', refs.join(', '));
}