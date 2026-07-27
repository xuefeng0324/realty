const { execSync } = require('child_process');
const head = execSync('git show HEAD:realty_app/src/pages/dashboard/dashboard.vue', { encoding: 'utf8' });
const lines = head.split('\n');
for (let i = 5920; i < 5990; i++) {
  console.log('L' + (i+1) + ': ' + lines[i].trim().slice(0, 120));
}