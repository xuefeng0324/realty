const fs = require('fs');
const lines = fs.readFileSync('realty_app/scripts/_dashboard_v121137.txt', 'utf8').split('\n');
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('featurePremium') && lines[i].includes('v-if') && lines[i].includes('class="card"')) {
    console.log('fp L' + (i+1) + ': ' + lines[i].trim().slice(0, 100));
  }
  if (lines[i].includes('tagCombination') && lines[i].includes('v-if') && lines[i].includes('class="card"')) {
    console.log('tc L' + (i+1) + ': ' + lines[i].trim().slice(0, 100));
  }
  if (lines[i].includes('districtMeta') && lines[i].includes('v-if') && lines[i].includes('class="card"')) {
    console.log('dm L' + (i+1) + ': ' + lines[i].trim().slice(0, 100));
  }
}