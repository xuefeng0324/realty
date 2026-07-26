const fs = require('fs');
const lines = fs.readFileSync('realty_app/src/pages/dashboard/dashboard.vue', 'utf8').split('\n');
const template = lines.slice(0, 4884).join('\n');
const script = lines.slice(4885, 8322).join('\n');
const scriptOnlySet = new Set();  // 找其它 script 段引用

const re = /const (\w+)\s*=\s*(computed|ref|watch|onMounted)\(/g;
const variables = [];
let m;
while ((m = re.exec(script))) {
  variables.push({ name: m[1], kind: m[2] });
}

// 真正 dead = 不在 template + 不在 script 段引用
const dead = [];
for (const v of variables) {
  const vRegex = new RegExp('\\b' + v.name + '\\b');
  const inTemplate = vRegex.test(template);
  // 找 script 段中其他位置引用
  const scriptWithoutSelf = script.replace(new RegExp('const ' + v.name + ' =', 'g'), 'const X_ =');
  const inScript = vRegex.test(scriptWithoutSelf);
  if (!inTemplate && !inScript) {
    dead.push({ name: v.name, kind: v.kind });
  }
}
console.log('Total variables:', variables.length);
console.log('Dead:', dead.length);
for (const d of dead) console.log('  ', d.kind, d.name);