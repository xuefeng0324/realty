const fs = require('fs');
const lines = fs.readFileSync('realty_app/src/pages/dashboard/dashboard.vue', 'utf8').split('\n');
for (let i = 0; i < lines.length; i++) {
  if (lines[i].match(/^<style/)) console.log('style start L' + (i+1));
  if (lines[i].match(/^<\/style/)) console.log('style end L' + (i+1));
}