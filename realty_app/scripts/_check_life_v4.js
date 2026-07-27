const { execSync } = require('child_process');
const head = execSync('git show HEAD:realty_app/src/pages/dashboard/dashboard.vue', { encoding: 'utf8' });
const lines = head.split('\n');
// 看 L5430-L5550 范围内有什么
for (let i = 5320; i < 5560; i++) {
  const l = lines[i].trim();
  if (l.length > 0) {
    console.log('L' + (i+1) + ': ' + l.slice(0, 120));
  }
}