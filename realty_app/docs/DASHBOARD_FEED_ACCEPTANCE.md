# 总览长页信息流「去分割缝」验收标准

> 流程总则：[FEATURE_ACCEPTANCE.md](./FEATURE_ACCEPTANCE.md)  
> 对照：
> - [Material Design 3 — Lists / Surface](https://m3.material.io/components/lists/overview)（列表项用 outline 细分隔，避免大块 gutter）
> - 贝壳找房 / 链家 App 首页信息流：同色表面连续滚动，块与块之间不是「另一条背景色沟」
> - uni-ui `uni-list` 惯例：项间为细分割线，而非大 margin 露底

## 1. 问题定义

总览（dashboard）为超长滚动页。旧样式每个 `.card` 有：

- `margin-bottom: 24rpx`
- 独立 `box-shadow` + 圆角边框
- 页面底色 / 径向渐变与卡片表面色差大

滚动时，卡片之间的**页面底色条带**看起来像「每一整屏背景被分割线切开」，观感差。

## 2. 方案（克制，仅总览）

| 做 | 不做 |
|----|------|
| 仅 `dashboard` 页：信息流同色表面、去大 gutter | 不改其它 Tab 页卡片体系 |
| 项间保留 **1rpx hairline**（outline） | 不做成完全无分隔的一坨 |
| 顶部筛选卡可保留轻微抬起（锚点） | 不重做整套视觉品牌 |

## 3. 验收标准

### 期望

1. 总览连续滚动时，相邻内容块之间**看不到明显对比色宽条**（宽 gutter）  
2. 块与块可用细线区分；浅色/深色均如此  
3. 顶部「市场数据工作台」筛选区仍可识别为页头  
4. 主题切换后（浅/深）仍满足 1–3  

### 不期望

1. 其它页面（房源/设置等）被连带改成「无 gutter」  
2. 去掉所有分隔导致章节无法分辨  
3. 为去缝引入新的强渐变条纹  

### 自动化

- [x] `tests/e2e/smoke_dashboard_feed_seam.mjs`：非页头 card `margin-bottom≤2px`；page/card 亮度差≤0.04；card→card 间隙≤2px；任意兄弟间隙≤12px
- [x] `npm run type-check` / `npm test` 通过
- [x] 既有 `smoke_theme_visual.mjs` 仍通过（不破坏主题）

### 手工（H5 或真机）

1. 打开总览，慢滑 3～5 屏  
2. 浅色、深色各滑一遍  
3. 通过：无明显「黑/灰宽缝」横切画面；失败则截图阻断发版  

## 4. 验证记录（发版时填写）

见对应 changelog「验证」节。

---

最后更新：2026-07-26
