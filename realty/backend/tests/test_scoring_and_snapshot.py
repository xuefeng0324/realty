from __future__ import annotations

from datetime import date
from types import SimpleNamespace

from realty.backend.app.services.listing_scoring import compute_listing_quality_score_v1
from realty.backend.app.services.school_scoring import compute_school_future_score_v1
from realty.backend.app.services.snapshot_service import select_policy_and_avg


def test_select_policy_and_avg_prefers_latest_when_sample_enough_and_not_deviated() -> None:
    prices = [100.0, 102.0, 101.0, 99.0, 100.0]
    policy, avg_price, median_price = select_policy_and_avg(
        prices=prices,
        latest_price=100.0,
        min_samples_for_latest=5,
        deviation_threshold=0.25,
    )
    assert policy == "latest_non_null"
    assert avg_price == 100.0
    assert median_price == 100.0


def test_select_policy_and_avg_falls_back_to_median_when_deviation_large() -> None:
    prices = [100.0, 100.0, 100.0, 100.0, 100.0]
    policy, avg_price, median_price = select_policy_and_avg(
        prices=prices,
        latest_price=180.0,
        min_samples_for_latest=5,
        deviation_threshold=0.25,
    )
    assert policy == "median_robust"
    assert avg_price == 100.0
    assert median_price == 100.0


def test_compute_school_future_score_v1_handles_missing_inputs_with_fallbacks() -> None:
    school = SimpleNamespace(province_key_flag=True, city_key_flag=True)
    latest = SimpleNamespace(
        latest_level_score_raw=None,
        group_school_flag_raw=None,
        group_school_strength_raw=None,
        district_balance_level_raw=None,
        trend_delta_raw=None,
    )
    prev = None

    res = compute_school_future_score_v1(school=school, latest_indicator=latest, previous_indicator=prev)
    assert 0.0 <= res.trend_score_0_100 <= 100.0
    assert res.confidence_score < 1.0
    assert len(res.feature_contrib_json.get("missing_fallbacks", [])) >= 3


def test_compute_listing_quality_score_v1_emits_advantages_for_near_metro_and_good_school() -> None:
    listing = SimpleNamespace(
        nearest_metro_distance_m=500,
        orientation="南北",
        bedrooms=3,
        bathrooms=2,
        floor_number="6楼",
        has_elevator=True,
        decorate_type="精装",
        build_year=2018,
        unit_price=58000.0,
    )
    school_future = [SimpleNamespace(trend_score_0_100=85.0, province_key_flag=True, city_key_flag=True)]

    res = compute_listing_quality_score_v1(
        listing=listing,
        community_avg_unit_price=60000.0,
        schools_future=school_future,
        now_date=date(2026, 3, 23),
    )
    assert res.overall_score > 70.0
    labels = [a["label"] for a in res.advantages]
    assert "近地铁优" in labels
    assert "强学区优" in labels
