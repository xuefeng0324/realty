const fs = require('fs');
const content = fs.readFileSync('realty_app/src/pages/dashboard/dashboard.vue', 'utf8');

// 找所有 data-card-key="..."
const keyPositions = [];
let idx = 0;
while ((idx = content.indexOf('data-card-key="', idx + 1)) !== -1) {
  const m = content.slice(idx).match(/^data-card-key="([a-z][a-z0-9-]+)"/);
  if (m) {
    keyPositions.push({ key: m[1], pos: idx });
  }
}

let out = content;
let modified = 0;
let skipped = 0;
const addedKeys = [];
const failed = [];

for (const { key, pos } of keyPositions) {
  // 检查这张卡是否已有 ✕ 按钮
  const slice = out.slice(pos, pos + 2500);
  if (slice.includes(`data-dash-card-hide="${key}"`)) {
    skipped++;
    continue;
  }
  // 找 row-between + card-title 块结束位置
  // 匹配 <view class="row-between"> 之后的 <view class="card-title"...>...</view>
  // 使用更宽松的 regex 匹配含 {{ }} 的 card-title
  const m = slice.match(/<view\s+class="row-between">\s*<view\s+class="card-title"[^>]*>[\s\S]*?<\/view>/);
  if (!m) {
    skipped++;
    failed.push(key);
    continue;
  }
  const insertAt = pos + m.index + m[0].length;
  const hideBtn = `\n          <button\n            class="card-hide-btn"\n            hover-class="tap-row--active"\n            data-dash-card-hide="${key}"\n            @click.stop="toggleCardHidden('${key}')"\n          >✕</button>`;
  out = out.slice(0, insertAt) + hideBtn + out.slice(insertAt);
  modified++;
  addedKeys.push(key);
}

console.log('Modified:', modified, 'Skipped:', skipped);
console.log('Added:', addedKeys.join(', '));
if (failed.length > 0) console.log('Failed:', failed.join(', '));

fs.writeFileSync('realty_app/src/pages/dashboard/dashboard.vue', out);
console.log('dashboard.vue lines after:', out.split('\n').length);