const fs = require('fs');
const content = fs.readFileSync('realty_app/src/pages/dashboard/dashboard.vue', 'utf8');

// 找所有 data-card-key="..." + 看其 .row-between 块
const cardKeys = [...new Set([...content.matchAll(/data-card-key="([a-z][a-z0-9-]+)"/g)].map(m => m[1]))];
console.log('Total card keys:', cardKeys.length);

// 对每张卡，找到 .row-between 块添加 ✕ 按钮（如果还没有）
// 用更智能的方式：找到 .row-between 在 data-card-key 附近的块
let out = content;
// 找出所有 data-card-key 的位置
const keyPositions = [];
let idx = 0;
while ((idx = out.indexOf('data-card-key="', idx + 1)) !== -1) {
  const m = out.slice(idx).match(/^data-card-key="([a-z][a-z0-9-]+)"/);
  if (m) {
    keyPositions.push({ key: m[1], pos: idx });
  }
}

let modified = 0;
let skipped = 0;
const addedKeys = [];

for (const { key, pos } of keyPositions) {
  // 检查这张卡是否已有 ✕ 按钮 (查找 pos 之后 2000 字符内)
  const slice = out.slice(pos, pos + 2000);
  if (slice.includes(`data-dash-card-hide="${key}"`)) {
    skipped++;
    continue;
  }
  // 找最近后续的 <view class="row-between"> 块
  const rbMatch = slice.match(/<view\s+class="row-between">\s*<view\s+class="card-title">([^<]+)<\/view>/);
  if (!rbMatch) {
    skipped++;
    continue;
  }
  const cardTitleEnd = pos + rbMatch.index + rbMatch[0].length;
  // 在 card-title 后面插入 ✕ 按钮
  const insertAt = cardTitleEnd;
  const hideBtn = `\n          <button\n            class="card-hide-btn"\n            hover-class="tap-row--active"\n            data-dash-card-hide="${key}"\n            @click.stop="toggleCardHidden('${key}')"\n          >✕</button>`;
  // 找现有的 <view class="row-between"> 块的结尾 </view>
  // 实际上我们应该在 <view class="card-title">之后 + 在 muted 之前 插入
  // 让我们直接找 .row-between 块结尾: 整个 <view class="row-between">...</view>
  // 因为不安全的替换，我们仅在 muted 之前插入
  // 实际更安全：在整个 <view class="row-between"> 开头 + class="card-title"> 之后
  out = out.slice(0, insertAt) + hideBtn + out.slice(insertAt);
  modified++;
  addedKeys.push(key);
}

console.log('Modified:', modified, 'Skipped:', skipped);
console.log('Added:', addedKeys.join(', '));

fs.writeFileSync('realty_app/src/pages/dashboard/dashboard.vue', out);
console.log('dashboard.vue lines after:', out.split('\n').length);