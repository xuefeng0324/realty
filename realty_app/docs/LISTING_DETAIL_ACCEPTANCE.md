# 房源详情验收（对照贝壳 / 链家）

> 功能 ID：`F-LIST-03` / `F-LIST-04`  
> 对照：
> - 贝壳 / 链家 App 详情：**图集首屏** → **总价大字 + 单价** → **户型摘要** → **标签 pill** → **小区入口** → **底栏主 CTA（去贝壳）**
> - 本产品不做经纪带看；无真图 URL 时必须**明示空态**，禁止伪造封面。

## 0. 合格线

1. 详情首屏有图集区；无实图时文案说明原因，不留大片空白无解释。  
2. 价区结构接近贝壳：总价突出、单价辅文、户型/面积一行。  
3. 标签 pill 与列表同源（`tags_json` / `listing_tags`）；无标签时有空态。  
4. 底栏：有 `source_url` 时主 CTA 唤起竞品；无 URL 时仍有「同小区全部房源」等辅操作。  
5. 文案不把挂牌标成「成交价」。

---

## 1. UI（U）

| # | Given | When | Then |
|---|-------|------|------|
| U1 | 任意详情 | 首屏 | `[data-listing-gallery]` 可见 |
| U2 | 无封面 URL | 看图集区 | 含「暂无实景图」类说明 |
| U3 | 有标签 | 价区下 | `[data-listing-tags]` 有 pill |
| U4 | 无标签 | 价区下 | `[data-listing-tags-empty]` 或等价空态 |
| U5 | 有同小区其它房 | 顶栏 | 「同小区其他」可点，滚到 `#same-community-listings` |
| U6 | 有 source_url | 底栏 | 「查看参考页面/源链接」「复制链接」文字垂直居中（`display:flex` + `align-items:center`） |

## 2. 功能（F）

| # | Given | When | Then |
|---|-------|------|------|
| F1 | 有 source_url | 点底栏主 CTA | 走 `openHousingSourceUrl`（App 优先） |
| F2 | 无 source_url | 点底栏主 CTA | 进入 `listing-filter?communityId=` |
| F3 | 同小区列表行 | 点击 | `redirectTo` 该 listing 详情 |

## 3. 逻辑（L）

| # | Given | When | Then |
|---|-------|------|------|
| L1 | 同小区含无单价房源 | 列表 | **仍展示**（不因 unitPrice≤0 整行丢弃） |
| L2 | 标题「在售」 | 计数文案 | 用「挂牌/样本」口径，不假装全市在售盘点 |

## 4. 自动化

```powershell
npx vitest run tests/listingTags.test.ts tests/openExternal.test.ts tests/priceSemantics.test.ts
# H5：
node tests/e2e/smoke_listings.mjs
```

门禁：`listing-detail.vue` 含 `data-listing-gallery`、`data-listing-tags`；列表页含 `data-listing-card`。

---

最后更新：2026-07-26
