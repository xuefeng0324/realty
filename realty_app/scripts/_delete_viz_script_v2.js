const fs = require('fs');
const content = fs.readFileSync('realty_app/src/pages/dashboard/dashboard.vue', 'utf8');
const lines = content.split('\n');
console.log('Starting lines:', lines.length);

// 阶段 1: 删 4 个 reload 函数 (L5533-L5698)
// 先确认位置
console.log('L5533:', lines[5532].trim());
console.log('L5698:', lines[5697].trim());
console.log('L5699:', lines[5698].trim());

const r1 = [...lines.slice(0, 5532), ...lines.slice(5699)];
console.log('After delete reload (L5533-L5698):', r1.length, 'Δ:', lines.length - r1.length);

// 阶段 2: 删 4 个 refs + computed (L5331-L5434)
console.log('r1 L5331:', r1[5330].trim());
console.log('r1 L5434:', r1[5433].trim());
console.log('r1 L5435:', r1[5434].trim());

const r2 = [...r1.slice(0, 5330), ...r1.slice(5435)];
console.log('After delete refs/computed (L5331-L5434):', r2.length, 'Δ:', r1.length - r2.length);

// 阶段 3: 删 reload 调用 (4 行调用) + 注释
// 找 reloadBedroomArea 位置
const reloadIdx = r2.findIndex(l => l.includes('reloadBedroomArea'));
console.log('reloadBedroomArea at L' + (reloadIdx + 1));
console.log('Lines around reload:');
for (let i = reloadIdx - 3; i <= reloadIdx + 10; i++) {
  console.log('  L' + (i + 1) + ': ' + r2[i].trim());
}

fs.writeFileSync('realty_app/src/pages/dashboard/dashboard.vue', r2.join('\n'));