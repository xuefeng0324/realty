#!/usr/bin/env python3
"""GBK 探测 fallback 共用 helper。

针对"HTTP header 标 utf-8 但 body 实际 GBK"的政府源（典型如 zfcxjst.gd.gov.cn
等广东省/广州市/深圳市住建局站）：

- GBK 单字节 ASCII 段与 utf-8 兼容 → utf-8 解码"看似成功"但中文段乱码
- body 还含 0xae/0x85 等 GBK 范围外字节 → strict gbk 抛 UnicodeDecodeError
- 必须 errors='replace' 容错 + 中文高频词探测才能稳定选对编码

用法：
    from _gbk_probe import fetch_text_gbk
    text = fetch_text_gbk("http://zfcxjst.gd.gov.cn/xxgk/tjxx/")
    # text 含正确中文（如 '建筑业' / '经济'），不再乱码

替代原 fetch_text：直接复制原 fetch_text body 到调用处改 1 行即可。
"""
from __future__ import annotations

import ssl
import time
from typing import Iterable
from urllib.request import Request, urlopen

# 默认 UA（realty 爬虫统一标识）
DEFAULT_UA = {"User-Agent": "Mozilla/5.0 (compatible; realty-crawler/1.0)"}

# 默认探测词：广东政府源正文必含（任一即可）
DEFAULT_PROBE: tuple[str, ...] = ("建筑业", "经济", "人民政府", "广东")


def fetch_text_gbk(
    url: str,
    *,
    ua: dict[str, str] | None = None,
    probe: Iterable[str] = DEFAULT_PROBE,
    timeout: int = 60,
    max_attempts: int = 3,
    ctx: ssl.SSLContext | None = None,
) -> str:
    """抓 HTML 文本，自动探测 GBK / utf-8 编码。

    优先级（从高到低）：
      1. https → http（或反向）做候选 URL（很多政府站 https 自签证书过期）
      2. 对每个候选 URL 重试 max_attempts 次
      3. 每次拿到 raw 后按 gbk / gb18030 / utf-8 试解码；
         第一个让"中文高频词任一出现"的解码 = 正确编码，立即返回
      4. 全不命中 fallback utf-8 replace（不硬失败）

    抛 RuntimeError 当所有 URL 都失败时。
    """
    ua = ua or DEFAULT_UA
    ctx = ctx or ssl.create_default_context()
    probe = tuple(probe)
    last_err: Exception | None = None

    candidates = [url]
    if url.startswith("https://"):
        candidates.append("http://" + url[len("https://") :])
    elif url.startswith("http://"):
        candidates.append("https://" + url[len("http://") :])

    for candidate in candidates:
        for attempt in range(max_attempts):
            try:
                raw = urlopen(
                    Request(candidate, headers=ua), context=ctx, timeout=timeout
                ).read()
                # 探测正确编码（必须 errors='replace' 容错，因为 body 可能含
                # 0xae/0x85 等 GBK 范围外字节，strict 必抛 UnicodeDecodeError）
                for enc in ("gbk", "gb18030"):
                    text = raw.decode(enc, errors="replace")
                    if any(w in text for w in probe):
                        return text
                # fallback：utf-8 不抛异常（replace 模式），返回乱码但不卡死
                return raw.decode("utf-8", "replace")
            except Exception as e:
                last_err = e
                time.sleep(0.5 * (attempt + 1))
    raise last_err or RuntimeError(f"fetch failed: {url}")