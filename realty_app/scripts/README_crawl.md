# 实时数据：v3 (CDN 下发)

## 整条链路

```
       [每周日 21:00 UTC = 周一 05:00 北京时间]
                      ↓
   GitHub Actions runner（全新 IP，每周一拉一次数据）
                      ↓
       scripts/crawl_anjuke.py  →  抓 m.anjuke.com 移动版
                      ↓
       写 static/seed/listings.csv (兼容 schema)
       写 static/seed/crawl_meta.json (含 sha256)
                      ↓
       git commit + push 到 main 分支
                      ↓
       jsDelivr CDN 自动缓存
       https://cdn.jsdelivr.net/gh/xuefeng0324/realty@main/realty_app/static/seed/
                      ↓
       用户在 app 内点 "刷新数据" 按钮
       （src/pages/settings/settings.vue）
                      ↓
       src/local/dataRefresher.ts:
         - 拉 meta 看 SHA 是否变化
         - 拉 CSV, parse, merge 到本地 snapshot
         - 缓存 SHA + 时间
```

## 现在能跑

- ✅ **手动触发** `Actions > crawl-weekly > Run workflow`
- ✅ **自动触发** 每周日 21:00 UTC = 周一 05:00 UTC+8
- ✅ fallback：cron 失败 → app 用包内 seed（不会卡死）

## 待做的

- ⏳ **第 1 次 cron 跑通后**——你就能在 app 上点"刷新数据" → 看到真实挂牌
- ⏳ **当前 listings.csv 是 fake 数据**（1226 条 random 生成）
- ⏳ 等 cron 跑过几次，会被替换为真 m.anjuke 数据

## 数据格式约束

listings.csv 字段必须和 `seed_real_data.py` 第 264-276 行输出一致。
新增/删除字段都必须同步更新：

- `scripts/crawl_anjuke.py` (OUT_FIELDS = [...])
- `src/local/importer.ts` (parse 函数)
- `src/local/dataRefresher.ts` (parseListings 函数)

漏一个就会报：本地 fake 数据被远端替换后 app 全空。

## 为什么选安居客而不是房天下 / 链家

- 链家 m.lianjia.com → HIP 风控 captcha，30 秒拦
- 房天下桌面 / m 版 → 3G 反爬 challenge
- **m.anjuke.com** → 第一次会话可用，第一次能拿到 30+ 页真实挂牌
- ⚠️ 会话级反爬，单 IP 30 秒即被 ban

这意味着 **必须是新 IP 跑**（CI runner 每启动是新 IP；本机多次跑会失败）。

## 本地开发

```bash
cd realty_app
python scripts/crawl_anjuke.py --dry-run --limit 50
```

会打印"将写入 N 条"，不实际落盘。仅用于验证 parser 工作。

## 法律 / ToS 声明

**仅供学习/研究使用**。请遵守 m.anjuke.com 用户协议：
- 不要高频 / 高并发
- 数据不在 app 外再分发
- 商业用途请联系 58 同城 / 安居客商务

## 已知问题

- **`crawl_anjuke.py` 跑通会受当日 IP / 反爬规则影响**——爬不到时不会报错，而是 0 条，需要看 git commit history 验证。考虑加 retry + 失败告警。
- **app 端 `refreshFromRemote` 在无网时**只显示"无法连接 jsDelivr"，但不会回退到包内 seed（已加载的）。第一次启动时 net 不可用 → 仍然加载包内 seed（因为 App.vue 用 `buildSeedSnapshot()`）。
