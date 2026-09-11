# audit-reports — 仓库审计脚本与报告

存放一次性 / 复跑类的仓库审计脚本及其报告，便于后续 commit 引用 + 复跑。

## 目录约定

| 类别 | 文件 | 用途 |
|------|------|------|
| overwrite_risk | `overwrite_risk.py` + `_report.txt` | 扫所有 crawl_*.py 的写入模式（merge / atomic-overwrite / atomic-refuse / overwrite / append），识别"覆盖式写入丢历史"风险（v1.122.41 修了 sz_land_deals / sz_planned_supply） |
| city_distribution | `city_distribution.py` + `_report.txt` | 扫所有 csv 的 city / city_id 列分布，识别数据集中度最高 / 最低的城市（v1.122.41 报告深圳 5643 行最大 / 珠海 2423 行最弱） |
| orphan_crawl | `orphan_crawl.py` + `_report.txt` | 扫所有 crawl_*.py 是否被 .github/workflows/*.yml 或 scripts/*.py 引用，识别孤儿脚本 |

## 复跑方法

```bash
cd realty_app
python changelog/audit-reports/overwrite_risk.py      # 输出 overwrite_risk_report.txt
python changelog/audit-reports/city_distribution.py   # 输出 city_distribution_report.txt
python changelog/audit-reports/orphan_crawl.py        # 输出 orphan_crawl_report.txt
```

## 何时重跑

- 新增 `crawl_*.py` 时跑 `orphan_crawl.py` 确认有引用
- 新增月度源且担心覆盖式写入时跑 `overwrite_risk.py`
- 新增城市时跑 `city_distribution.py` 确认数据集中度

## 历史

2026-09-12：v1.122.41 sz 两爬虫修复时一并产出（本会话）。报告留档当前仓库状态，未来新增源时复跑对比。