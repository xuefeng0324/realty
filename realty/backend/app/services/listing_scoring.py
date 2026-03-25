from __future__ import annotations

import math
from dataclasses import dataclass
from datetime import date
from typing import Any

from realty.backend.app.models import CommunityOfficial, ListingDetail, SchoolFutureScore
from realty.backend.app.services.score_utils import clamp, parse_floor_number
from realty.backend.app.services.score_utils import MissingFallback


@dataclass
class ListingQualityScoreResult:
    overall_score: float
    dimension_scores: dict[str, float]
    advantages: list[dict[str, Any]]
    disadvantages: list[dict[str, Any]]
    explain_json: dict[str, Any]
    school_future_score_max: float | None
    school_province_key_flag_any: bool | None
    school_city_key_flag_any: bool | None


def orientation_score_v1(orientation: str | None) -> tuple[float, float | None]:
    # returns (score, used_value_for_evidence)
    if not orientation:
        return 20.0, None
    o = orientation.strip()
    mapping = {
        "南": 40.0,
        "南北": 36.0,
        "东西": 34.0,
        "东": 34.0,
        "西": 28.0,
        "东/西": 34.0,
        "北": 18.0,
        "其他": 25.0,
    }
    # normalize common variants
    if o in mapping:
        return mapping[o], mapping[o]
    if o in ("东/西", "东西"):
        return 34.0, 34.0
    if o in ("东", "西"):
        return mapping.get(o, 25.0), mapping.get(o, 25.0)
    if o in ("南北通透",):
        return 36.0, 36.0
    return 25.0, 25.0


def layout_score_v1(bedrooms: int | None, bathrooms: int | None) -> tuple[float, str | None]:
    if bedrooms is None:
        return 15.0, "bedrooms_missing"
    bdr = bedrooms
    bth = bathrooms if bathrooms is not None else 0
    if bdr >= 3 and bth >= 2:
        return 30.0, "bedrooms>=3 & bathrooms>=2"
    if bdr == 3:
        # MVP 里：3 室但 1 卫视为次优
        if bth == 1:
            return 23.0, "bedrooms==3 & bathrooms==1"
        if bth >= 2:
            return 30.0, "bedrooms==3 & bathrooms>=2"
        return 23.0, "bedrooms==3 & bathrooms_unknown_or_0"
    if bdr == 2:
        return 20.0, "bedrooms==2"
    return 10.0, "bedrooms<=1"


def floor_score_v1(floor_number: str | None) -> tuple[float, int | None]:
    if not floor_number:
        return 15.0, None
    f = parse_floor_number(floor_number)
    if f is None:
        return 15.0, None
    if 3 <= f <= 10:
        return 30.0, f
    if 11 <= f <= 15:
        return 24.0, f
    if 16 <= f <= 25:
        return 18.0, f
    if f > 25:
        return 12.0, f
    return 10.0, f


def compute_listing_quality_score_v1(
    listing: ListingDetail,
    community_avg_unit_price: float | None,
    schools_future: list[SchoolFutureScore],
    rule_version: str = "listing_quality_score_v1",
    now_date: date | None = None,
) -> ListingQualityScoreResult:
    """
    Implements listing_quality_score_v1 rules from docs with explain_json and tags.
    """

    now_date = now_date or date.today()

    missing_fallbacks: list[dict[str, Any]] = []

    # --- location_score ---
    metro = listing.nearest_metro_distance_m
    metro_missing = metro is None
    if metro_missing:
        metro_subscore = 30.0
        missing_fallbacks.append({"field": "nearest_metro_distance_m", "policy": "set_to_30", "reason": "NULL"})
    else:
        if metro < 500:
            metro_subscore = 60.0
        elif metro < 1000:
            metro_subscore = 50.0
        elif metro < 2000:
            metro_subscore = 35.0
        else:
            metro_subscore = 20.0

    school_scores = [s.trend_score_0_100 for s in schools_future if s is not None]
    school_future_score_max = max(school_scores) if school_scores else None

    if school_future_score_max is None:
        school_subscore = 20.0
        missing_fallbacks.append({"field": "school_future_scores", "policy": "set_to_20", "reason": "EMPTY"})
    else:
        school_subscore = round(0.8 * school_future_score_max + 8, 2)
        school_subscore = clamp(school_subscore, 0.0, 40.0)

    location_score = clamp(metro_subscore + school_subscore, 0.0, 100.0)

    # --- house_quality_score ---
    orientation_sc, _ = orientation_score_v1(listing.orientation)
    if listing.orientation is None:
        missing_fallbacks.append({"field": "orientation", "policy": "set_to_20", "reason": "NULL"})

    layout_sc, _ = layout_score_v1(listing.bedrooms, listing.bathrooms)
    if listing.bedrooms is None:
        missing_fallbacks.append({"field": "bedrooms", "policy": "set_layout_to_15", "reason": "NULL"})

    floor_sc, parsed_floor = floor_score_v1(listing.floor_number)
    if listing.floor_number is None or parsed_floor is None:
        missing_fallbacks.append({"field": "floor_number", "policy": "set_to_15", "reason": "NULL_OR_UNPARSEABLE"})

    house_quality_score = clamp(orientation_sc + layout_sc + floor_sc, 0.0, 100.0)

    # --- building_age_score ---
    if listing.build_year is None:
        building_age_score = 50.0
        missing_fallbacks.append({"field": "build_year", "policy": "set_to_50", "reason": "NULL"})
    else:
        age = now_date.year - int(listing.build_year)
        if age < 5:
            building_age_score = 95.0
        elif age < 10:
            building_age_score = 85.0
        elif age < 15:
            building_age_score = 75.0
        elif age < 20:
            building_age_score = 60.0
        else:
            building_age_score = 40.0
    building_age_score = clamp(building_age_score, 0.0, 100.0)

    # --- amenity_score ---
    if listing.has_elevator is None:
        elevator_subscore = 30.0
        missing_fallbacks.append({"field": "has_elevator", "policy": "set_to_30", "reason": "NULL"})
    else:
        elevator_subscore = 60.0 if bool(listing.has_elevator) else 25.0

    if not listing.decorate_type:
        decorate_subscore = 20.0
        missing_fallbacks.append({"field": "decorate_type", "policy": "set_to_20", "reason": "NULL"})
    else:
        dt = listing.decorate_type.strip()
        decorate_map = {"精装": 40.0, "简装": 28.0, "毛坯": 18.0}
        decorate_subscore = decorate_map.get(dt, 22.0)

    amenity_score = clamp(elevator_subscore + decorate_subscore, 0.0, 100.0)

    # --- price_value_score ---
    unit_price = listing.unit_price
    if unit_price is None or community_avg_unit_price is None or community_avg_unit_price <= 0:
        price_value_score = 50.0
        missing_fallbacks.append({"field": "unit_price_or_community_avg_unit_price", "policy": "set_to_50", "reason": "NULL_OR_BAD"})
    else:
        ratio = float(unit_price) / float(community_avg_unit_price)
        if ratio < 0.90:
            price_value_score = 95.0
        elif ratio < 0.95:
            price_value_score = 85.0
        elif ratio <= 1.05:
            price_value_score = 70.0
        elif ratio <= 1.15:
            price_value_score = 55.0
        else:
            price_value_score = 40.0
    price_value_score = clamp(price_value_score, 0.0, 100.0)

    # --- overall ---
    w_location = 0.30
    w_house = 0.25
    w_age = 0.15
    w_amenity = 0.15
    w_price = 0.15

    overall = (
        w_location * location_score
        + w_house * house_quality_score
        + w_age * building_age_score
        + w_amenity * amenity_score
        + w_price * price_value_score
    )
    overall = round(clamp(overall, 0.0, 100.0), 2)

    # --- tags ---
    metro_dist = listing.nearest_metro_distance_m
    advantages: list[dict[str, Any]] = []
    disadvantages: list[dict[str, Any]] = []

    def add_adv(label: str, confidence: float, evidence_rule: str, evidence: dict[str, Any] | None = None) -> None:
        advantages.append({"label": label, "confidence": confidence, "evidence": {"rule": evidence_rule, **(evidence or {})}})

    def add_dis(label: str, confidence: float, evidence_rule: str, evidence: dict[str, Any] | None = None) -> None:
        disadvantages.append({"label": label, "confidence": confidence, "evidence": {"rule": evidence_rule, **(evidence or {})}})

    # advantages rules (from docs)
    if metro_dist is not None and metro_dist < 1000 and location_score >= 70:
        add_adv("近地铁优", 0.92, "nearest_metro_distance_m<1000 & location_score>=70", {"metro": metro_dist})
    if school_future_score_max is not None and school_future_score_max >= 80:
        add_adv("强学区优", 0.90, "max_school_future_score>=80", {"max_school_future_score": school_future_score_max})
    if listing.bedrooms is not None and listing.bedrooms >= 3 and (layout_sc is not None) and layout_sc >= 25:
        add_adv("户型佳", 0.86, "bedrooms>=3 & layout_score>=25", {"bedrooms": listing.bedrooms, "layout_score": layout_sc})
    if listing.orientation in ("南", "南北") and orientation_sc >= 36:
        add_adv("采光朝向优", 0.84, "orientation in ['南','南北'] & orientation_score>=36", {"orientation_score": orientation_sc})
    if listing.has_elevator is True and amenity_score >= 70:
        add_adv("电梯优", 0.88, "has_elevator=true & amenity_score>=70", {"amenity_score": amenity_score})
    if listing.decorate_type == "精装":
        add_adv("精装修优", 0.82, "decorate_type='精装'")
    if price_value_score >= 85:
        add_adv("性价比高", 0.90, "price_value_score>=85", {"price_value_score": price_value_score})

    # disadvantages rules
    if metro_dist is not None and metro_dist > 2000 and location_score <= 45:
        add_dis("距地铁远", 0.88, "nearest_metro_distance_m>2000 & location_score<=45", {"metro": metro_dist})
    if school_future_score_max is not None and school_future_score_max < 60:
        add_dis("学区弱", 0.82, "max_school_future_score<60", {"max_school_future_score": school_future_score_max})
    if building_age_score <= 50:
        add_dis("房龄偏老", 0.86, "building_age_score<=50")
    if listing.has_elevator is False and amenity_score <= 45:
        add_dis("无电梯/设施差", 0.85, "has_elevator=false & amenity_score<=45", {"amenity_score": amenity_score})
    if listing.decorate_type == "毛坯":
        add_dis("装修偏差", 0.75, "decorate_type='毛坯'")
    if price_value_score <= 55:
        add_dis("性价比偏低", 0.80, "price_value_score<=55", {"price_value_score": price_value_score})

    # clamp topK tags
    advantages = sorted(advantages, key=lambda x: x["confidence"], reverse=True)[:3]
    disadvantages = sorted(disadvantages, key=lambda x: x["confidence"], reverse=True)[:3]

    # school flags for filter
    school_province_key_flag_any = any((s.province_key_flag is True) for s in schools_future)
    school_city_key_flag_any = any((s.city_key_flag is True) for s in schools_future)

    dimension_scores = {
        "location_score": float(round(location_score, 2)),
        "house_quality_score": float(round(house_quality_score, 2)),
        "building_age_score": float(round(building_age_score, 2)),
        "amenity_score": float(round(amenity_score, 2)),
        "price_value_score": float(round(price_value_score, 2)),
    }

    dimension_contrib = {
        "location_contrib": round(w_location * location_score, 2),
        "house_quality_contrib": round(w_house * house_quality_score, 2),
        "building_age_contrib": round(w_age * building_age_score, 2),
        "amenity_contrib": round(w_amenity * amenity_score, 2),
        "price_value_contrib": round(w_price * price_value_score, 2),
    }

    explain_json = {
        "rule_version": rule_version,
        "inputs_snapshot": {
            "nearest_metro_distance_m": listing.nearest_metro_distance_m,
            "orientation": listing.orientation,
            "bedroom_count": listing.bedrooms,
            "bathroom_count": listing.bathrooms,
            "floor_number": listing.floor_number,
            "has_elevator": listing.has_elevator,
            "decorate_type": listing.decorate_type,
            "build_year": listing.build_year,
            "unit_price": listing.unit_price,
            "community_avg_unit_price": community_avg_unit_price,
            "school_future_scores": [s.trend_score_0_100 for s in schools_future],
        },
        "dimension_scores": dimension_scores,
        "overall_score": overall,
        "dimension_contributions": dimension_contrib,
        "label_evidence": {
            "advantages": advantages,
            "disadvantages": disadvantages,
        },
        "missing_fallbacks": missing_fallbacks,
    }

    return ListingQualityScoreResult(
        overall_score=overall,
        dimension_scores=dimension_scores,
        advantages=advantages,
        disadvantages=disadvantages,
        explain_json=explain_json,
        school_future_score_max=school_future_score_max,
        school_province_key_flag_any=school_province_key_flag_any if school_province_key_flag_any else None,
        school_city_key_flag_any=school_city_key_flag_any if school_city_key_flag_any else None,
    )
