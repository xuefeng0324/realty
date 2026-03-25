from __future__ import annotations

import math
import re
from dataclasses import dataclass
from datetime import date
from typing import Any


def clamp(x: float, lo: float, hi: float) -> float:
    if x is None or math.isnan(x):
        return lo
    return max(lo, min(hi, x))


_FLOOR_RE = re.compile(r"(-?\d+)")


def parse_floor_number(floor_number: str | None) -> int | None:
    """
    Parse floor number from strings like:
      - '第6楼'
      - '6楼'
      - '6'
    Returns first integer, or None if not parseable.
    """
    if not floor_number:
        return None
    m = _FLOOR_RE.search(floor_number)
    if not m:
        return None
    try:
        return int(m.group(1))
    except Exception:
        return None


def maybe_scale_trend_delta(trend_delta_raw: float) -> float:
    """
    trend_delta_raw may be:
    - fraction change in [-1, 1] (e.g. +0.12 meaning +12%)
    - or already a scaled value (e.g. +10, -3)

    We normalize to a roughly [-100, 100] range for V1 mapping.
    """
    if abs(trend_delta_raw) <= 1.0:
        return trend_delta_raw * 100.0
    return trend_delta_raw


def current_year_floor(d: date | None = None) -> int:
    d = d or date.today()
    return d.year


@dataclass
class MissingFallback:
    field: str
    policy: str
    reason: str | None = None


def json_list_max(values: list[float] | None) -> float | None:
    if not values:
        return None
    return max(values)
