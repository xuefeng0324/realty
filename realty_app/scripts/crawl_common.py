#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Realty 爬虫共用 helper（v1.122.27 起）。

背景：
- v1.122.25 修了 6 个 GD 爬虫 fetch_text bug（旧版 utf-8 优先看似成功但
  GBK body 中文段乱码），引入 _gbk_probe.fetch_text_gbk 共用 helper。
- v1.122.26 同样修了 5 个 PBC 爬虫。

共 11 个 crawl_*.py 文件顶部都有同款 4 行样板：
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    from _gbk_probe import fetch_text_gbk  # noqa: E402
    UA = {"User-Agent": "Mozilla/5.0 (compatible; realty-crawler/1.0)"}
    CTX = ssl.create_default_context()

    def fetch_text(url: str) -> str:
        return fetch_text_gbk(url, ua=UA, ctx=CTX)

本模块把样板收成 1 行 `from crawl_common import fetch_text`。
fetch_text 行为完全等于 _gbk_probe.fetch_text_gbk（带默认 UA + 默认
ctx + https/http 双栈 + 3 次重试 + gbk/gb18030 探测）。

非通用爬虫（crawl_gd_construction / crawl_gd_economy）有特殊逻辑，
本轮不重构，按既有逻辑跑。
"""
from __future__ import annotations

import ssl
import sys
from pathlib import Path

_HERE = Path(__file__).resolve().parent
if str(_HERE) not in sys.path:
    sys.path.insert(0, str(_HERE))

from _gbk_probe import DEFAULT_UA, fetch_text_gbk  # noqa: E402


def default_ctx() -> ssl.SSLContext:
    """返回默认 SSL context（每次新建，避免多个爬虫共享后被 monkey-patch）。"""
    return ssl.create_default_context()


# fetch_text 直接 re-export _gbk_probe.fetch_text_gbk
# 调用方写 fetch_text(url) 等价于 fetch_text_gbk(url)
fetch_text = fetch_text_gbk


__all__ = ["DEFAULT_UA", "default_ctx", "fetch_text", "fetch_text_gbk"]
