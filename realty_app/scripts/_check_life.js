const fs = require('fs');
const { execSync } = require('child_process');
const head = execSync('git show HEAD:realty_app/src/pages/dashboard/dashboard.vue', { encoding: 'utf8' });
const lines = head.split('\n');
for (let i = 5600; i < 5800; i++) {
  if (lines[i].includes('lifeConvenienceParetoSubway') || lines[i].includes('lifeMarketNearTop') || lines[i].includes('lifeDistrictTop')) {
    console.log('L' + (i+1) + ': ' + lines[i].trim().slice(0, 120));
  }
}
console.log('---');
console.log('Total lines:', lines.length);