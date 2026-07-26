#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""从国家外汇管理局抓取「国际收支平衡表」季度通稿 → CSV。

入口：https://www.safe.gov.cn/safe/whxw/index.html
口径：经常账户 / 货物 / 服务 / 初次收入 / 二次收入 / 资本和金融账户（亿美元，季度流量）。
优先正式数，同季若仅有初步数则保留。
**≠ 房价、≠ 挂牌、≠ 网签、≠ 70 城**；货物/服务与月度 BOP 贸易口径不同（季报 vs 月度初步）。

用法：
  python scripts/crawl_safe_bop.py
  python scripts/crawl_safe_bop.py --max 24 --news-pages 40
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
OUT = ROOT / "static" / "seed" / "safe_bop.csv"
HOME_URL = "https://www.safe.gov.cn/"
NEWS_URL = "https://www.safe.gov.cn/safe/whxw/index.html"
UA = {"User-Agent": "Mozilla/5.0 (compatible; realty-crawler/1.0)"}
CTX = ssl.create_default_context()
FIELDS = [
    "date",
    "current_account_usd_yi",
    "goods_surplus_usd_yi",
    "services_surplus_usd_yi",
    "primary_income_usd_yi",
    "secondary_income_usd_yi",
    "capital_financial_usd_yi",
    "is_preliminary",
    "source_url",
]
Q_MONTH = {"一": 3, "二": 6, "三": 9, "四": 12, "1": 3, "2": 6, "3": 9, "4": 12}


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


def list_notices(*htmls: str) -> list[tuple[str, str, bool]]:
    """Return (url, title, is_preliminary)."""
    out: list[tuple[str, str, bool]] = []
    for html in htmls:
        for m in re.finditer(r'href="([^"]+)"[^>]*>([^<]*)</a>', html):
            title = unescape(re.sub(r"\s+", " ", m.group(2))).strip()
            if "国际收支平衡表" not in title:
                continue
            if any(k in title for k in ("解读", "答记者", "访谈", "修订说明", "新闻发布会")):
                continue
            if not re.search(r"20\d{2}\s*年", title):
                continue
            # 只要季度表；跳过纯月度货物服务贸易（另一爬虫）
            if "货物和服务贸易" in title and "平衡表" not in title:
                continue
            prelim = "初步" in title
            out.append((abs_url(m.group(1)), title, prelim))
    seen: set[str] = set()
    uniq: list[tuple[str, str, bool]] = []
    for url, title, prelim in out:
        if url in seen:
            continue
        seen.add(url)
        uniq.append((url, title, prelim))
    return uniq


def _f(v: float | None) -> str:
    if v is None:
        return ""
    return f"{v:g}"


def _signed(word: str, num: str) -> float:
    v = float(num.replace(",", ""))
    if "逆差" in word or "净流出" in word:
        return -abs(v)
    return abs(v) if "顺差" in word or "净流入" in word else v


def _quarter_date(title: str, text: str) -> str | None:
    m = re.search(r"(20\d{2})\s*年\s*([一二三四1234])\s*季度", title) or re.search(
        r"(20\d{2})\s*年\s*([一二三四1234])\s*季度", text
    )
    if not m:
        return None
    y = int(m.group(1))
    mo = Q_MONTH.get(m.group(2))
    if not mo:
        return None
    return f"{y}-{mo:02d}-01"


def parse_body(html: str, source_url: str, title: str = "", prelim: bool = False) -> dict[str, str] | None:
    text = unescape(re.sub(r"<[^>]+>", " ", re.sub(r"<script[\s\S]*?</script>", " ", html, flags=re.I)))
    text = re.sub(r"\s+", " ", text).replace("\ufeff", "")

    date = _quarter_date(title, text)
    if not date:
        return None

    # 优先「按美元计值」段，避免抓到人民币段
    usd_block = text
    m_usd = re.search(r"按美元计值[，,]\s*(.{80,520}?)(?:按\s*SDR|（完）|$)", text)
    if m_usd:
        usd_block = m_usd.group(1)

    def grab(names: str) -> float | None:
        m = re.search(
            rf"({names})\s*(-?[\d,.]+)\s*亿\s*美元",
            usd_block,
        )
        if not m:
            m = re.search(rf"({names})\s*(-?[\d,.]+)\s*亿\s*美元", text)
        if not m:
            return None
        return _signed(m.group(1), m.group(2))

    ca = grab(r"经常账户(?:顺差|逆差)")
    goods = grab(r"货物贸易(?:顺差|逆差)")
    svc = grab(r"服务贸易(?:顺差|逆差)")
    pri = grab(r"初次收入(?:顺差|逆差)")
    sec = grab(r"二次收入(?:顺差|逆差)")
    cap = grab(r"资本和金融账户(?:顺差|逆差)")

    # 表兜底：项目名 + 亿美元列（概览表）
    if ca is None or goods is None:
        rows = re.findall(r"<tr[^>]*>([\s\S]*?)</tr>", html, flags=re.I)
        for tr in rows:
            cells = [
                unescape(re.sub(r"<[^>]+>", "", c)).replace("\xa0", " ").strip()
                for c in re.findall(r"<t[hd][^>]*>([\s\S]*?)</t[hd]>", tr, flags=re.I)
            ]
            cells = [re.sub(r"\s+", " ", c) for c in cells if c]
            if len(cells) < 3:
                continue
            name = cells[0]
            nums: list[float] = []
            for c in cells[1:]:
                c2 = c.replace(",", "").replace("−", "-").replace("—", "")
                if re.fullmatch(r"-?\d+(?:\.\d+)?", c2):
                    nums.append(float(c2))
            # 行次, 亿元, 亿美元, 亿SDR → 取亿美元（通常第 2 个数值，跳过行次）
            usd = None
            if len(nums) >= 3:
                # nums[0]=行次小整数, nums[1]=亿元, nums[2]=亿美元
                if nums[0] < 100 and abs(nums[1]) > abs(nums[2]) * 3:
                    usd = nums[2]
                elif len(nums) >= 2:
                    usd = nums[1] if abs(nums[1]) < 50000 else nums[2] if len(nums) > 2 else nums[1]
            elif len(nums) == 2:
                usd = nums[1]
            if usd is None:
                continue
            if re.match(r"^1[\.\s]*经常账户", name) and ca is None:
                ca = usd
            elif "货物" in name and "服务" not in name and goods is None and re.search(r"1\.A\.a|货物$", name):
                goods = usd
            elif re.search(r"1\.A\.b|服务$", name) and "货物" not in name and svc is None:
                svc = usd
            elif "初次收入" in name and pri is None:
                pri = usd
            elif "二次收入" in name and sec is None:
                sec = usd
            elif re.match(r"^2[\.\s]*资本和金融账户", name) and cap is None:
                cap = usd

    if ca is None or goods is None:
        return None

    return {
        "date": date,
        "current_account_usd_yi": _f(ca),
        "goods_surplus_usd_yi": _f(goods),
        "services_surplus_usd_yi": _f(svc),
        "primary_income_usd_yi": _f(pri),
        "secondary_income_usd_yi": _f(sec),
        "capital_financial_usd_yi": _f(cap),
        "is_preliminary": "1" if prelim else "0",
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


def merge_prefer_final(existing: list[dict[str, str]], fresh: list[dict[str, str]]) -> list[dict[str, str]]:
    by_date: dict[str, dict[str, str]] = {}
    for r in existing + fresh:
        d = r.get("date") or ""
        if not d:
            continue
        prev = by_date.get(d)
        if prev is None:
            by_date[d] = r
            continue
        # 正式数覆盖初步数；同档则用新抓到的
        prev_p = prev.get("is_preliminary") == "1"
        cur_p = r.get("is_preliminary") == "1"
        if prev_p and not cur_p:
            by_date[d] = r
        elif prev_p == cur_p:
            by_date[d] = r
        # else: 保留正式数，丢弃新初步数
    return sorted(by_date.values(), key=lambda x: x["date"], reverse=True)


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
    ap.add_argument("--news-pages", type=int, default=40)
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
    for i, (url, title, prelim) in enumerate(notices, 1):
        try:
            row = parse_body(fetch_text(url), url, title, prelim)
            if row:
                fresh.append(row)
                tag = "初步" if prelim else "正式"
                print(
                    f"  [{i}/{len(notices)}] {row['date']} ca={row['current_account_usd_yi']} ({tag}) · {title[:36]}"
                )
            else:
                print(f"  [{i}] parse fail · {title[:50]}")
        except Exception as exc:  # noqa: BLE001
            print(f"  [{i}] ERR {type(exc).__name__}: {exc}")
        time.sleep(args.sleep)

    rows = merge_prefer_final(load_existing(OUT), fresh)
    atomic_write(OUT, rows)
    print(f"[done] {len(rows)} → {OUT}")
    return 0 if rows else 1


if __name__ == "__main__":
    raise SystemExit(main())
