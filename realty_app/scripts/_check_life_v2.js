const { execSync } = require('child_process');
const head = execSync('git show HEAD:realty_app/src/pages/dashboard/dashboard.vue', { encoding: 'utf8' });
const lines = head.split('\n');
for (let i = 0; i < lines.length; i++) {
  const l = lines[i].trim();
  if (l.startsWith('const life') || l.startsWith('const computed') || l.startsWith('const wangqianWeeklyDistrictTop')) {
    console.log('L' + (i+1) + ': ' + l.slice(0, 120));
  }
}
console.log('---');
// Find all "const life"
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('const life')) {
    console.log('L' + (i+1) + ': ' + lines[i].trim().slice(0, 120));
  }
}