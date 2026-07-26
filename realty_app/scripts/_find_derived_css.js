const fs = require('fs');
const content = fs.readFileSync('realty_app/src/pages/dashboard/dashboard.vue', 'utf8');
const lines = content.split('\n');
for (let i = 0; i < lines.length; i++) {
  const m = lines[i].match(/^\s*\/\*\s*(v\d+\.\d+\.\d+|v1\.121\.\d+)/);
  if (m) {
    const tag = lines[i].trim();
    if (tag.includes('派生') || tag.includes('衍生') || tag.includes('二级')) {
      console.log('L' + (i+1) + ': ' + tag);
    }
  }
}