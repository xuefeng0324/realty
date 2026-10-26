// layout-fingerprint.mjs — 平台无关的 UI 布局指纹
//
// 为什么不用像素 diff（v1.122.55 修）：
//   实测（Windows 渲染 vs Ubuntu/CI 渲染，同一份构建产物、同一份数据）：
//     - 页面高度差 4px（390x1092 vs 390x1096）→ 旧脚本直接判 size-mismatch，ratio=1，必红
//     - 裁剪到公共区域后，pixelmatch(AA免疫) 差异 6.39%，网格均值差 6.99%
//   而真实 UI 回归的信号量级：
//     - 卡片改色 100x60      → 像素 1.41% / 网格 1.72%
//     - 区块消失 120x40      → 像素 0.44% / 网格 0.92%
//   也就是说「跨平台噪声(6%)」比「真实回归信号(0.4~1.7%)」还大一个量级：
//     - 收紧阈值 → 100% 误报（这就是 e2e 连挂数周的原因）
//     - 放宽阈值 → 什么回归都抓不到，门禁形同虚设
//   根因：像素级比对把「字体栅格化差异」当成了「UI 变化」，而中文页面的字形
//   差异遍布全图，无法用阈值区分。
//
// 换成什么：
//   1) 签名集合（tag + class + 背景色 + 文字色 + 字号 + 字重 + 圆角）
//      —— 全部来自 CSS，不受字体渲染、也不受数据内容影响；
//         重复元素只算一种签名，所以「今天多 3 个小区」不会误报。
//   2) 壳层锚点几何（DOM 深度 ≤ 8 的元素，即数据列表之上的页面骨架）
//      —— 位置尺寸由 CSS 决定，跨平台只差几个 px（字体度量），用容差吸收；
//         文本叶子的宽高不参与（数字长度会随数据变化）。
//
// 两次采集必须用同一份构建产物 + 同一份数据，否则签名/锚点会漂移。

export const FINGERPRINT_VERSION = 2;

/** 采集指纹（在页面上下文里执行） */
export function captureInPage() {
  const Q = 4; // 几何量化步长(px)

  const classOf = (el) => {
    const raw =
      typeof el.className === 'string'
        ? el.className
        : (el.getAttribute && el.getAttribute('class')) || '';
    return raw.trim().replace(/\s+/g, ' ');
  };

  const sigOf = (el) => {
    const cs = getComputedStyle(el);
    return [
      el.tagName,
      classOf(el),
      cs.backgroundColor,
      cs.color,
      cs.fontSize,
      cs.fontWeight,
      cs.borderTopLeftRadius,
    ].join('|');
  };

  const isTextLeaf = (el) =>
    el.children.length === 0 && (el.textContent || '').trim().length > 0;

  const rows = [];
  const walk = (el, depth, parentRect) => {
    const r = el.getBoundingClientRect();
    const sig = sigOf(el);
    const leaf = isTextLeaf(el);

    // 相对父元素的偏移；重复兄弟用「与前一个同签名兄弟的间距」代替绝对 y，
    // 这样列表多几条/少几条都不会改变签名。
    let relY = r.top - parentRect.top;
    if (depth > 0) {
      let prev = el.previousElementSibling;
      while (prev) {
        if (sigOf(prev) === sig) {
          relY = r.top - prev.getBoundingClientRect().top;
          break;
        }
        prev = prev.previousElementSibling;
      }
    }

    if (depth <= 8) {
      rows.push({
        sig,
        depth,
        x: Math.round((r.left - parentRect.left) / Q) * Q,
        y: Math.round(relY / Q) * Q,
        w: leaf ? null : Math.round(r.width / Q) * Q,
        h: leaf ? null : Math.round(r.height / Q) * Q,
      });
    }
    for (const c of el.children) walk(c, depth + 1, r);
  };

  walk(document.body, 0, { top: 0, left: 0 });

  const sigs = new Set();
  const sigCount = new Map();
  for (const el of document.querySelectorAll('*')) {
    const s = sigOf(el);
    sigs.add(s);
    sigCount.set(s, (sigCount.get(s) || 0) + 1);
  }

  return {
    version: 2,
    docHeight: document.documentElement.scrollHeight,
    elementCount: document.querySelectorAll('*').length,
    signatures: [...sigs].sort(),
    signatureCounts: Object.fromEntries([...sigCount.entries()].sort()),
    anchors: rows,
  };
}

/** 归一化成可比较的快照（去重 + 排序） */
export function normalize(fp) {
  const anchorMap = new Map();
  for (const a of fp.anchors) {
    const key = `${a.sig}#${a.depth}`;
    if (!anchorMap.has(key)) anchorMap.set(key, []);
    anchorMap.get(key).push(a);
  }
  const anchors = [...anchorMap.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, list]) => ({
      key,
      n: list.length,
      samples: list.slice(0, 8).map((a) => [a.x, a.y, a.w, a.h]),
    }));
  return {
    version: fp.version,
    docHeight: fp.docHeight,
    elementCount: fp.elementCount,
    signatures: fp.signatures,
    signatureCounts: fp.signatureCounts,
    anchors,
  };
}

export const TOLERANCE = { pos: 8, size: 16 };
