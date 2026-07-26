const fs = require('fs');
let content = fs.readFileSync('realty_app/src/pages/data-tools/data-tools.vue', 'utf8');
const lines = content.split('\n');
let replacedCount = 0;
for (let i = 0; i < lines.length; i++) {
  const l = lines[i];
  if (l.includes('class="card" data-tab="all,transit"')) {
    if (lines[i+2] && lines[i+2].includes('地铁步行通勤 Top')) {
      lines[i] = l.replace('class="card" data-tab="all,transit">', 'class="card" data-tab="all,transit" data-dt-commute-walk>');
      replacedCount++;
    } else if (lines[i+2] && lines[i+2].includes('地铁规划受益 Top')) {
      lines[i] = l.replace('class="card" data-tab="all,transit">', 'class="card" data-tab="all,transit" data-dt-plan-benefit>');
      replacedCount++;
    }
  } else if (l.includes('class="card" data-tab="all,price"')) {
    if (lines[i+2] && lines[i+2].includes('📐 挂牌结构')) {
      lines[i] = l.replace('class="card" data-tab="all,price">', 'class="card" data-tab="all,price" data-dt-listing-structure>');
      replacedCount++;
    } else if (lines[i+2] && lines[i+2].includes('🔖 挂牌标签')) {
      lines[i] = l.replace('class="card" data-tab="all,price">', 'class="card" data-tab="all,price" data-dt-listing-tags>');
      replacedCount++;
    }
  } else if (l.includes('class="card" data-tab="all,school"')) {
    if (lines[i+2] && lines[i+2].includes('🏫 重点学校维度')) {
      lines[i] = l.replace('class="card" data-tab="all,school">', 'class="card" data-tab="all,school" data-dt-school-dimension>');
      replacedCount++;
    }
  }
}
console.log('Replaced:', replacedCount);
fs.writeFileSync('realty_app/src/pages/data-tools/data-tools.vue', lines.join('\n'), 'utf8');