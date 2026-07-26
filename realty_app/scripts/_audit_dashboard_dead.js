const fs = require('fs');
const lines = fs.readFileSync('realty_app/src/pages/dashboard/dashboard.vue', 'utf8').split('\n');
const template = lines.slice(0, 4884).join('\n');
const script = lines.slice(4885, 8322).join('\n');

// 找所有 const xxx = computed/ref
const re = /const (\w+)\s*=\s*(computed|ref|watch|onMounted)\(/g;
const variables = [];
let m;
while ((m = re.exec(script))) {
  variables.push({ name: m[1], kind: m[2] });
}

// 检查每个变量在 template 中是否引用
const dead = [];
for (const v of variables) {
  const vRegex = new RegExp('\\b' + v.name + '\\b');
  if (!vRegex.test(template)) {
    dead.push({ name: v.name, kind: v.kind });
  }
}
console.log('Total variables:', variables.length);
console.log('Dead (not in template):', dead.length);
for (const d of dead.slice(0, 60)) console.log('  ', d.kind, d.name);