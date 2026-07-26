const fs = require('fs');
const lines = fs.readFileSync('realty_app/src/pages/dashboard/dashboard.vue', 'utf8').split('\n');
let computedCount = 0, refCount = 0, functionCount = 0;
for (let i = 4885; i < 8322; i++) {
  if (lines[i].includes('= computed(')) computedCount++;
  if (lines[i].includes('= ref(')) refCount++;
  if (lines[i].includes('= async (') || lines[i].match(/^async function/)) functionCount++;
}
console.log('Script content:');
console.log('  computed:', computedCount);
console.log('  ref:', refCount);
console.log('  function:', functionCount);