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
const failed = [];

// 已知还没添加的 keys (基于 _add_hide_buttons_v2 输出)
const needFix = ['life-convenience', 'listing-school-premium', 'commercial-heat', 'multi-community-compare'];

for (const { key, pos } of keyPositions) {
  if (!needFix.includes(key)) continue;
  // 检查这张卡是否已有 ✕ 按钮
  const slice = out.slice(pos, pos + 5000);
  if (slice.includes(`data-dash-card-hide="${key}"`)) {
    skipped++;
    continue;
  }
  // 找 row-between + 整个 <view class="card-title">...</view> 块结束
  // 我们要找的是 <view class="row-between"> 后面第一个 <view class="card-title">...</view>
  // 允许 card-title 内部含 {{ }}
  const m = slice.match(/<view\s+class="row-between">\s*<view\s+class="card-title"(?:\s+style="[^"]*")?>[\s\S]*?<\/view>\s*<\/view>/);
  if (!m) {
    failed.push(key);
    continue;
  }
  const insertAt = pos + m.index + m[0].length;
  const hideBtn = `\n          <button\n            class="card-hide-btn"\n            hover-class="tap-row--active"\n            data-dash-card-hide="${key}"\n            @click.stop="toggleCardHidden('${key}')"\n          >✕</button>`;
  out = out.slice(0, insertAt) + hideBtn + out.slice(insertAt);
  modified++;
}

console.log('Modified:', modified, 'Skipped:', skipped);
if (failed.length > 0) console.log('Failed:', failed.join(', '));

fs.writeFileSync('realty_app/src/pages/dashboard/dashboard.vue', out);
console.log('dashboard.vue lines after:', out.split('\n').length);