from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from typing import Any

from realty.backend.app.models import (
    SchoolIndicatorSnapshot,
    SchoolStandardized,
)
from realty.backend.app.services.score_utils import clamp, maybe_scale_trend_delta, current_year_floor


@dataclass
class SchoolFutureScoreResult:
    rule_version: str
    trend_score_0_100: float
    confidence_score: float
    feature_contrib_json: dict[str, Any]
    explain_text: str


def compute_school_future_score_v1(
    school: SchoolStandardized,
    latest_indicator: SchoolIndicatorSnapshot,
    previous_indicator: SchoolIndicatorSnapshot | None,
    rule_version: str = "school_future_score_v1",
) -> SchoolFutureScoreResult:
    """
    Implements school_future_score_v1 rule set from docs:
    - latest_level_score (0-100)
    - group_school_flag/strength
    - district_balance_level
    - trend_delta derived from latest-prev if missing
    - province_key_flag / city_key_flag from school entity
    - Missing fallback policies as defined in rules table
    """

    confidence = 1.0

    missing_fallbacks: list[dict[str, Any]] = []

    def norm_0_100(x: float | None) -> float | None:
        if x is None:
            return None
        return clamp(float(x), 0.0, 100.0)

    # latest_level_score
    latest_level_raw = latest_indicator.latest_level_score_raw
    latest_level_score = norm_0_100(latest_level_raw)
    if latest_level_score is None:
        latest_level_score = 50.0
        confidence -= 0.2
        missing_fallbacks.append({"field": "latest_level_score_raw", "policy": "set_to_50", "reason": "NULL"})

    # group
    group_flag = latest_indicator.group_school_flag_raw
    group_strength_raw = latest_indicator.group_school_strength_raw
    group_school_bonus: float
    if group_flag is None:
        group_school_bonus = 40.0
        confidence -= 0.1
        missing_fallbacks.append({"field": "group_school_flag_raw", "policy": "set_to_40", "reason": "NULL"})
    else:
        if bool(group_flag) is True:
            strength = norm_0_100(group_strength_raw) if group_strength_raw is not None else None
            if strength is None:
                group_school_bonus = 80.0
                confidence -= 0.05
                missing_fallbacks.append({"field": "group_school_strength_raw", "policy": "set_to_80", "reason": "NULL"})
            else:
                group_school_bonus = strength
        else:
            group_school_bonus = 40.0

    # district
    district_balance_level_raw = latest_indicator.district_balance_level_raw
    district_balance_bonus = norm_0_100(district_balance_level_raw)
    if district_balance_bonus is None:
        district_balance_bonus = 50.0
        confidence -= 0.15
        missing_fallbacks.append({"field": "district_balance_level_raw", "policy": "set_to_50", "reason": "NULL"})

    # trend delta
    trend_delta_raw = latest_indicator.trend_delta_raw
    if trend_delta_raw is None and previous_indicator is not None:
        if latest_indicator.latest_level_score_raw is not None and previous_indicator.latest_level_score_raw is not None:
            trend_delta_raw = float(latest_indicator.latest_level_score_raw) - float(previous_indicator.latest_level_score_raw)

    trend_delta_score: float
    if trend_delta_raw is None:
        trend_delta_score = 50.0
        confidence -= 0.1
        missing_fallbacks.append({"field": "trend_delta_raw", "policy": "set_to_50", "reason": "NULL"})
    else:
        delta_scaled = maybe_scale_trend_delta(float(trend_delta_raw))
        if delta_scaled > 0:
            trend_delta_score = 50.0 + clamp(delta_scaled, 0.0, 50.0)
        else:
            trend_delta_score = 50.0 - clamp(abs(delta_scaled), 0.0, 50.0)
        trend_delta_score = clamp(trend_delta_score, 0.0, 100.0)

    # Weights (v1)
    w_latest = 0.55
    w_group = 0.20
    w_district = 0.15
    w_trend = 0.10

    trend_score = w_latest * latest_level_score + w_group * group_school_bonus + w_district * district_balance_bonus + w_trend * trend_delta_score
    trend_score = clamp(trend_score, 0.0, 100.0)

    latest_contrib = w_latest * latest_level_score
    group_contrib = w_group * group_school_bonus
    district_contrib = w_district * district_balance_bonus
    trend_contrib = w_trend * trend_delta_score

    explain_text = (
        f"趋势分 {trend_score:.2f}：最新办学水平({w_latest:.2f}*{latest_level_score:.0f})，"
        f"集团化办学({w_group:.2f}*{group_school_bonus:.0f})，"
        f"区县均衡({w_district:.2f}*{district_balance_bonus:.0f})，"
        f"近两期变化({w_trend:.2f}*{trend_delta_score:.0f})。"
        f"缺失回退条目数={len(missing_fallbacks)}，置信度={max(0.0, min(1.0, confidence)):.2f}。"
    )

    feature_contrib_json = {
        "rule_version": rule_version,
        "inputs_used": {
            "latest_level_score": latest_level_score,
            "group_school_bonus": group_school_bonus,
            "district_balance_bonus": district_balance_bonus,
            "trend_delta_score": trend_delta_score,
            "province_key_flag": school.province_key_flag,
            "city_key_flag": school.city_key_flag,
        },
        "weights": {
            "latest": w_latest,
            "group": w_group,
            "district": w_district,
            "trend_delta": w_trend,
        },
        "contribution": {
            "latest_contrib": latest_contrib,
            "group_contrib": group_contrib,
            "district_contrib": district_contrib,
            "trend_delta_contrib": trend_contrib,
        },
        "missing_fallbacks": missing_fallbacks,
        "confidence_score": max(0.0, min(1.0, confidence)),
    }

    return SchoolFutureScoreResult(
        rule_version=rule_version,
        trend_score_0_100=round(trend_score, 2),
        confidence_score=round(max(0.0, min(1.0, confidence)), 4),
        feature_contrib_json=feature_contrib_json,
        explain_text=explain_text,
    )
