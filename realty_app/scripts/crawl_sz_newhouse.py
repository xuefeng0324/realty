"""
深圳市 政府数据开放平台 / 一手房 + 二手房成交 → CSV
=====================================================

数据源（已确认存在）：
  - 一手商品房成交信息（按日统计）     标识符  29200/01903510
  - 二手房成交信息（按日统计）         标识符  29200/01902783
  - 一手商品房按面积统计成交信息       标识符  29200/01903509
  - 一手商品房按用途统计成交信息       标识符  29200/01903511
  - 房地产开发项目销售情况             标识符  29200/03700915
  - 龙岗区-房地产开发项目销售情况      标识符  29200/01700922
  - ...

数据提供方：深圳市住房和建设局（数源单位）。
资源格式：CSV / XLS / JSON / XML —— 配套脚本输出 CSV，App 端可直接 import。

⚠️  本平台需要先用手机号 / 邮箱注册登录一次、获取 appToken，
    然后把 token 通过环境变量 OPENDATA_SZ_TOKEN 传给脚本。
    注册地址： https://opendata.sz.gov.cn/

字段（以"一手商品房成交信息（按日统计）"为准，可先登录页面查看最新字段）：
  - 行政区         例如：福田区
  - 日期           例如：2026-05-12
  - 用途           例如：住宅 / 商业 / 办公 / 工业
  - 成交套数       integer
  - 成交面积       float（平方米）
  - （可能还含）成交均价 / 成交金额 等

输出到：realty_app/static/sz_newhouse_daily.csv
  字段（精简、稳定）：
    date, district, usage, deals, area_sqm, source_url

使用方式：
    # Windows PowerShell：
    $env:OPENDATA_SZ_TOKEN = "eyJ...你注册的token..."
    python scripts/crawl_sz_newhouse.py fetch

    # 一次拉近 365 天（拉满的 record 数大约 365*10*4 = 1.5 万）
    python scripts/crawl_sz_newhouse.py fetch --rows 36500

    # 拉指定数据集
    python scripts/crawl_sz_newhouse.py fetch \
        --dataset "一手商品房成交信息（按日统计）" \
        --rows  18000

    # 不用 token 仅靠默认值（一般拿不到数据，但能跑 dry-run 检查参数）
    python scripts/crawl_sz_newhouse.py info

依赖：
    pip install requests
"""
from __future__ import annotations

import argparse
import csv
import json
import os
import sys
import time
import urllib.parse
from pathlib import Path
from typing import Any

try:
    import requests
except ImportError:
    print("需要 requests：pip install requests", file=sys.stderr)
    raise

# ---------------------------- 已知数据集清单 ----------------------------
DATASETS = {
    "一手商品房成交信息（按日统计）": "29200/01903510",
    "二手房成交信息（按日统计）": "29200/01902783",
    "一手商品房按面积统计成交信息（按日统计）": "29200/01903509",
    "一手商品房按用途统计成交信息（按日统计）": "29200/01903511",
    "房地产开发项目销售情况": "29200/03700915",
}

# 输出 schema
OUT_FIELDS = ["date", "district", "usage", "deals", "area_sqm", "source_url"]


# --------------------------- HTTP 调用底层 ---------------------------

def _base() -> str:
    return os.environ.get("OPENDATA_SZ_BASE", "https://opendata.sz.gov.cn")


def _token() -> str | None:
    return os.environ.get("OPENDATA_SZ_TOKEN", "").strip() or None


def _auth_headers() -> dict[str, str]:
    """构造请求头。注意：实测公开接口不强制 token，登录后才能拿到全量。
    因此我们提供两条路径：带 token / 不带 token.
    """
    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                      "AppleWebKit/537.36 (KHTML, like Gecko) "
                      "Chrome/124.0.0.0 Safari/537.36",
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "zh-CN,zh;q=0.9",
        "Referer": "https://opendata.sz.gov.cn/",
    }
    tok = _token()
    if tok:
        headers["Authorization"] = "Bearer " + tok
        headers["x-auth-token"] = tok
    return headers


def call_api(dataset_id: str, page: int, page_size: int) -> dict[str, Any]:
    """POST 通用 opendata 接口的具体路径仅在登录后可见；提供一些常见形态尝试。

    注意：网站对直接 curl 不友好，必须在浏览器打开过、拿到 cookie 才能拿数据。
    这里尽量宽松地试若干 endpoint。
    """
    base = _base()

    # 已知的两种最常见 endpoint pattern
    urls = [
        f"{base}/api/apiData/getApiData?page={page}&pageSize={page_size}",
    ]
    # 不同 id 编码
    candidates = [
        dataset_id,  # 29200/01903510
        dataset_id.replace("/", "_"),  # 29200_01903510
        dataset_id.replace("/", ""),  # 2920001903510
    ]

    last_err = None
    for ds in candidates:
        for url in urls:
            full = f"{url}&datasetId={urllib.parse.quote(ds)}"
            try:
                r = requests.post(full, headers=_auth_headers(), timeout=30)
                if r.status_code == 200:
                    try:
                        body = r.json()
                        if isinstance(body, dict) and body.get("code") in (200, 0, "200", "0"):
                            return body
                        # 部分接口返回 {result: {data: [...]}}
                        if "data" in body or "result" in body:
                            return body
                        # 如果是 list 也接受
                        if isinstance(body, list):
                            return {"data": body}
                    except Exception:
                        # 不是 JSON 当 HTML 处理
                        if "<table" in r.text or "<tr" in r.text:
                            return {"_raw_html": r.text}
                    last_err = f"{r.status_code} not json"
                else:
                    last_err = f"HTTP {r.status_code}"
            except Exception as e:
                last_err = repr(e)
    raise RuntimeError(f"未找到可用的 API 端点，dataset={dataset_id}, last_err={last_err}")


def fetch_all_rows(dataset_id: str, target_rows: int) -> list[list[str]]:
    """分页把所有行拉下来，返回列表（每条 record 列表化）。"""
    page_size = 1000
    rows: list[list[str]] = []
    page = 1
    while len(rows) < target_rows:
        body = call_api(dataset_id, page=page, page_size=page_size)
        data_obj = body.get("data") if isinstance(body, dict) else None
        # 兼容多种结构
        if isinstance(data_obj, dict):
            data_obj = data_obj.get("data") or data_obj.get("rows") or data_obj.get("records") or []
        if not isinstance(data_obj, list):
            break
        if not data_obj:
            break
        for rec in data_obj:
            if isinstance(rec, dict):
                rows.append([str(rec.get(k, "")) for k in OUT_FIELDS])
            else:
                rows.append([str(rec)] * len(OUT_FIELDS))
        if len(data_obj) < page_size:
            break
        page += 1
        time.sleep(0.2)
    return rows


# --------------------------- 解析逻辑 ---------------------------

def cmd_info(_: argparse.Namespace) -> int:
    print("已知数据集：")
    for k, v in DATASETS.items():
        print(f"  - {k}\n    id = {v}")
    print()
    print("当前 token 环境变量 OPENDATA_SZ_TOKEN:")
    t = _token()
    if t:
        print(f"  已设置（{len(t)} 字符）")
    else:
        print("  **未设置** —— 公开端点很可能拿不到数据。")
        print("  注册地址: https://opendata.sz.gov.cn/")
        print("  登录后 → 用户中心 → 我的应用 → 创建/获取 appToken → 设环境变量")
    return 0


def cmd_fetch(args: argparse.Namespace) -> int:
    ds_id = DATASETS.get(args.dataset)
    if not ds_id:
        print(f"未知 dataset：{args.dataset}", file=sys.stderr)
        print("可选：" + " / ".join(DATASETS.keys()), file=sys.stderr)
        return 1
    print(f"[fetch] dataset={args.dataset} ({ds_id})")
    try:
        rows = fetch_all_rows(ds_id, args.rows)
    except Exception as e:
        print(f"[fetch] 接口调用失败：{e}", file=sys.stderr)
        print("==> 备选：到 https://opendata.sz.gov.cn/ 登录后下载 CSV，然后用 --csv 模式转换。")
        return 2

    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with open(out_path, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f)
        w.writerow(OUT_FIELDS)
        for r in rows:
            w.writerow(r)
    print(f"[fetch] 完成：{len(rows)} 行 → {out_path}")
    return 0


def cmd_csv_convert(args: argparse.Namespace) -> int:
    """用户在 opendata.sz.gov.cn 网页上手动下载的 CSV → 转为应用标准格式。"""
    src = Path(args.src)
    if not src.exists():
        print(f"找不到 {src}", file=sys.stderr)
        return 1
    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    raw = src.read_text(encoding="utf-8-sig")
    import csv as _csv, io as _io
    rows = list(_csv.reader(_io.StringIO(raw)))
    if not rows:
        print("源文件为空")
        return 1
    header = rows[0]
    print(f"[convert] 源文件列名：{header}")
    # 列名映射（按猜测，实际字段以用户实际下载为准）
    def find(*candidates: str) -> int | None:
        for c in candidates:
            if c in header:
                return header.index(c)
        # 模糊
        for i, h in enumerate(header):
            for c in candidates:
                if c in h:
                    return i
        return None

    idx_date = find("日期", "date", "成交日期")
    idx_district = find("行政区", "区", "district", "地区")
    idx_usage = find("用途", "物业类型", "usage")
    idx_deals = find("成交套数", "套数", "deals", "count")
    idx_area = find("成交面积", "面积", "area_sqm", "area")

    missing = []
    for name, idx in [
        ("date", idx_date), ("district", idx_district),
        ("usage", idx_usage), ("deals", idx_deals), ("area_sqm", idx_area),
    ]:
        if idx is None:
            missing.append(name)
    if missing:
        print(f"[convert] 无法确定列索引：{missing}\n源表头：{header}", file=sys.stderr)
        print("[convert] 请手工按实际 CSV 表头调整本脚本的候选列名。", file=sys.stderr)
        return 2

    with open(out_path, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f)
        w.writerow(OUT_FIELDS)
        for r in rows[1:]:
            if len(r) <= max(idx_date, idx_district, idx_usage, idx_deals, idx_area):
                continue
            w.writerow([
                r[idx_date].strip(),
                r[idx_district].strip(),
                r[idx_usage].strip(),
                r[idx_deals].strip(),
                r[idx_area].strip(),
                f"https://opendata.sz.gov.cn/wap/data/api/toApiDetails/{DATASETS.get(args.dataset, '')}",
            ])
    print(f"[convert] 完成 → {out_path}")
    return 0


# --------------------------- 入口 ---------------------------

def main() -> int:
    parser = argparse.ArgumentParser(description="深圳政府数据成交爬虫")
    sub = parser.add_subparsers(dest="cmd", required=True)

    p1 = sub.add_parser("info", help="显示已知数据集和当前 token 状态")
    p1.set_defaults(func=cmd_info)

    p2 = sub.add_parser("fetch", help="拉取指定数据集并写出 CSV（需 token）")
    p2.add_argument("--dataset", default="一手商品房成交信息（按日统计）")
    p2.add_argument("--out", default="realty_app/static/sz_newhouse_daily.csv")
    p2.add_argument("--rows", type=int, default=15000)
    p2.set_defaults(func=cmd_fetch)

    p3 = sub.add_parser("convert", help="把用户在网页下载的 CSV 转窄表格式")
    p3.add_argument("--src", required=True, help="用户从 opendata 网页下载的 CSV")
    p3.add_argument("--dataset", default="一手商品房成交信息（按日统计）")
    p3.add_argument("--out", default="realty_app/static/sz_newhouse_daily.csv")
    p3.set_defaults(func=cmd_csv_convert)

    args = parser.parse_args()
    return args.func(args)


if __name__ == "__main__":
    raise SystemExit(main())
