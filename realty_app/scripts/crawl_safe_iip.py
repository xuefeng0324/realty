#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""从国家外汇管理局抓取「国际投资头寸表」季末通稿 → CSV。

入口：https://www.safe.gov.cn/safe/whxw/index.html
口径：对外金融资产 / 负债 / 净资产（亿美元，季末）；可含直接投资、证券投资、储备资产分项。
**≠ 房价、≠ 挂牌、≠ 网签、≠ 70 城**。

用法：
  python scripts/crawl_safe_iip.py
  python scripts/crawl_safe_iip.py --max 24 --news-pages 30
"""
from __future__ import annotations

import argparse
import csv
import re
import ssl
import tempfile
import time
from html import unescape
from pathlib import Path
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "static" / "seed" / "safe_iip.csv"
HOME_URL = "https://www.safe.gov.cn/"
NEWS_URL = "https://www.safe.gov.cn/safe/whxw/index.html"
UA = {"User-Agent": "Mozilla/5.0 (compatible; realty-crawler/1.0)"}
CTX = ssl.create_default_context()
FIELDS = [
    "date",
    "assets_usd_yi",
    "liabilities_usd_yi",
    "net_usd_yi",
    "fdi_assets_usd_yi",
    "portfolio_assets_usd_yi",
    "other_assets_usd_yi",
    "reserve_assets_usd_yi",
    "fdi_liab_usd_yi",
    "portfolio_liab_usd_yi",
    "other_liab_usd_yi",
    "source_url",
]


def fetch_text(url: str) -> str:
    raw = urlopen(Request(url, headers=UA), context=CTX, timeout=90).read()
    for enc in ("utf-8", "gbk"):
        try:
            return raw.decode(enc)
        except Exception:
            continue
    return raw.decode("utf-8", "replace")


def abs_url(href: str) -> str:
    if href.startswith("http"):
        return href
    if href.startswith("/"):
        return "https://www.safe.gov.cn" + href
    return href


def news_list_urls(pages: int) -> list[str]:
    out = [NEWS_URL]
    for i in range(2, max(2, pages + 1)):
        out.append(f"https://www.safe.gov.cn/safe/whxw/index_{i}.html")
    return out


def list_notices(*htmls: str) -> list[tuple[str, str]]:
    out: list[tuple[str, str]] = []
    for html in htmls:
        for m in re.finditer(r'href="([^"]+)"[^>]*>([^<]*)</a>', html):
            title = unescape(re.sub(r"\s+", " ", m.group(2))).strip()
            if "国际投资头寸" not in title:
                continue
            if "公布" not in title and "数据" not in title:
                continue
            if any(k in title for k in ("解读", "答记者", "访谈", "修订说明")):
                continue
            # 季末：X月末 / 年末
            if not re.search(r"20\d{2}\s*年.*(?:末|底)", title):
                continue
            out.append((abs_url(m.group(1)), title))
    seen: set[str] = set()
    uniq: list[tuple[str, str]] = []
    for url, title in out:
        if url in seen:
            continue
        seen.add(url)
        uniq.append((url, title))
    return uniq


def _f(v: float | None) -> str:
    if v is None:
        return ""
    return f"{v:g}"


def _month_from_title_or_text(title: str, text: str) -> tuple[int, int] | None:
    # 2026年3月末 / 2025年末
    m = re.search(r"(20\d{2})\s*年\s*(\d{1,2})\s*月末", title) or re.search(
        r"(20\d{2})\s*年\s*(\d{1,2})\s*月末", text
    )
    if m:
        return int(m.group(1)), int(m.group(2))
    m = re.search(r"(20\d{2})\s*年末", title) or re.search(r"(20\d{2})\s*年末", text)
    if m:
        return int(m.group(1)), 12
    return None


def parse_body(html: str, source_url: str, title: str = "") -> dict[str, str] | None:
    text = unescape(re.sub(r"<[^>]+>", " ", re.sub(r"<script[\s\S]*?</script>", " ", html, flags=re.I)))
    text = re.sub(r"\s+", " ", text).replace("\ufeff", "")
    text = re.sub(r"(?<=\d)\s+(?=\d)", "", text)

    ym = _month_from_title_or_text(title, text)
    if not ym:
        return None
    y, mo = ym

    core = re.search(
        r"我国对外金融资产\s*([\d.]+)\s*亿美元[，,]\s*对外负债\s*([\d.]+)\s*亿美元[，,]\s*对外净(?:资产|头寸)\s*([\d.]+)\s*亿美元",
        text,
    )
    if not core:
        core = re.search(
            r"对外金融资产\s*([\d.]+)\s*亿美元[，,]\s*对外金融负债\s*([\d.]+)\s*亿美元[，,]\s*对外净(?:资产|头寸)\s*([\d.]+)\s*亿美元",
            text,
        )
    if not core:
        return None
    assets = float(core.group(1))
    liab = float(core.group(2))
    net = float(core.group(3))

    fdi_a = port_a = other_a = reserve = None
    fdi_l = port_l = other_l = None

    # 散文分项
    m = re.search(
        r"直接投资资产\s*([\d.]+)\s*亿美元[，,]\s*证券投资资产\s*([\d.]+)\s*亿美元",
        text,
    )
    if m:
        fdi_a, port_a = float(m.group(1)), float(m.group(2))
    m = re.search(r"其他投资资产\s*([\d.]+)\s*亿美元[，,]\s*储备资产\s*([\d.]+)\s*亿美元", text)
    if m:
        other_a, reserve = float(m.group(1)), float(m.group(2))
    m = re.search(
        r"直接投资负债\s*([\d.]+)\s*亿美元[，,]\s*证券投资负债\s*([\d.]+)\s*亿美元",
        text,
    )
    if m:
        fdi_l, port_l = float(m.group(1)), float(m.group(2))
    m = re.search(r"其他投资负债\s*([\d.]+)\s*亿美元", text)
    if m:
        other_l = float(m.group(1))

    # 表兜底：净头寸/资产/负债行 + 一级分项（行次后的亿美元列）
    rows = re.findall(r"<tr[^>]*>([\s\S]*?)</tr>", html, flags=re.I)
    section = ""
    for tr in rows:
        cells = [
            unescape(re.sub(r"<[^>]+>", "", c)).replace("\xa0", " ").strip()
            for c in re.findall(r"<t[hd][^>]*>([\s\S]*?)</t[hd]>", tr, flags=re.I)
        ]
        cells = [re.sub(r"\s+", " ", c) for c in cells if c]
        if len(cells) < 2:
            continue
        name = cells[0]
        nums = []
        for c in cells[1:]:
            c2 = c.replace(",", "").replace("−", "-")
            if re.fullmatch(r"-?\d+(?:\.\d+)?", c2):
                nums.append(float(c2))
        if not nums:
            continue
        # 表列：行次, 亿美元, 亿SDR → 取亿美元（通常倒数第二或第一个非行次大数）
        usd = None
        for n in nums:
            if n >= 100:  # 跳过行次小数
                usd = n
                break
        if usd is None:
            continue

        if name in ("净头寸", "净头寸 ") or name.startswith("净头寸"):
            net = usd
        elif name == "资产":
            assets = usd
            section = "assets"
        elif name == "负债":
            liab = usd
            section = "liab"
        elif re.match(r"^1\s*直接投资$", name) or name.strip() == "1 直接投资":
            if section == "assets" and fdi_a is None:
                fdi_a = usd
            elif section == "liab" and fdi_l is None:
                fdi_l = usd
        elif re.match(r"^2\s*证券投资$", name) or name.strip() == "2 证券投资":
            if section == "assets" and port_a is None:
                port_a = usd
            elif section == "liab" and port_l is None:
                port_l = usd
        elif re.match(r"^4\s*其他投资$", name) or name.strip() == "4 其他投资":
            if section == "assets" and other_a is None:
                other_a = usd
            elif section == "liab" and other_l is None:
                other_l = usd
        elif re.match(r"^5\s*储备资产$", name) or name.strip() == "5 储备资产":
            if section == "assets" and reserve is None:
                reserve = usd

    return {
        "date": f"{y}-{mo:02d}-01",
        "assets_usd_yi": _f(assets),
        "liabilities_usd_yi": _f(liab),
        "net_usd_yi": _f(net),
        "fdi_assets_usd_yi": _f(fdi_a),
        "portfolio_assets_usd_yi": _f(port_a),
        "other_assets_usd_yi": _f(other_a),
        "reserve_assets_usd_yi": _f(reserve),
        "fdi_liab_usd_yi": _f(fdi_l),
        "portfolio_liab_usd_yi": _f(port_l),
        "other_liab_usd_yi": _f(other_l),
        "source_url": source_url,
    }


def load_existing(path: Path) -> list[dict[str, str]]:
    if not path.exists():
        return []
    with path.open(encoding="utf-8-sig", newline="") as f:
        rows = list(csv.DictReader(f))
    for r in rows:
        for k in FIELDS:
            r.setdefault(k, "")
    return rows


def atomic_write(path: Path, rows: list[dict[str, str]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(
        "w", encoding="utf-8", newline="", delete=False, dir=str(path.parent), suffix=".tmp"
    ) as tmp:
        w = csv.DictWriter(tmp, fieldnames=FIELDS)
        w.writeheader()
        for r in rows:
            w.writerow({k: r.get(k, "") for k in FIELDS})
        tmp_path = Path(tmp.name)
    tmp_path.replace(path)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--max", type=int, default=24)
    ap.add_argument("--news-pages", type=int, default=30)
    ap.add_argument("--sleep", type=float, default=0.35)
    args = ap.parse_args()

    htmls: list[str] = []
    try:
        htmls.append(fetch_text(HOME_URL))
        print("[list] home ok")
    except Exception as exc:  # noqa: BLE001
        print(f"[list] home ERR {exc}")

    for u in news_list_urls(args.news_pages):
        try:
            htmls.append(fetch_text(u))
            print(f"[list] news {u.split('/')[-1]} ok")
            time.sleep(args.sleep)
        except Exception as exc:  # noqa: BLE001
            print(f"[list] news ERR {u}: {exc}")

    notices = list_notices(*htmls)[: args.max]
    print(f"[list] {len(notices)} notices")
    if not notices:
        return 1

    fresh: list[dict[str, str]] = []
    for i, (url, title) in enumerate(notices, 1):
        try:
            row = parse_body(fetch_text(url), url, title)
            if row:
                fresh.append(row)
                print(f"  [{i}/{len(notices)}] {row['date']} net={row['net_usd_yi']} · {title[:36]}")
            else:
                print(f"  [{i}] parse fail · {title[:50]}")
        except Exception as exc:  # noqa: BLE001
            print(f"  [{i}] ERR {type(exc).__name__}: {exc}")
        time.sleep(args.sleep)

    by_date = {r["date"]: r for r in load_existing(OUT) if r.get("date")}
    for r in fresh:
        by_date[r["date"]] = r
    rows = sorted(by_date.values(), key=lambda x: x["date"], reverse=True)
    atomic_write(OUT, rows)
    print(f"[done] {len(rows)} → {OUT}")
    return 0 if rows else 1


if __name__ == "__main__":
    raise SystemExit(main())
