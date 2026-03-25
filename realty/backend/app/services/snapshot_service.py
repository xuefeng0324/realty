from __future__ import annotations

import statistics
from datetime import date, timedelta
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from realty.backend.app.models import ListingDetail, PriceSnapshotWeekly, CommunityOfficial


def compute_week_window(week_end_date: date) -> tuple[date, date]:
    week_start = week_end_date - timedelta(days=6)
    return week_start, week_end_date


def select_policy_and_avg(prices: list[float], latest_price: float, min_samples_for_latest: int, deviation_threshold: float) -> tuple[str, float, float]:
    """
    Returns (policy, avg_unit_price, median_unit_price)
    policy:
      - latest_non_null
      - median_robust
    """
    median_price = statistics.median(prices)
    if len(prices) < min_samples_for_latest:
        return "median_robust", median_price, median_price

    if median_price == 0:
        return "median_robust", median_price, median_price

    deviation = abs(latest_price - median_price) / median_price
    if deviation > deviation_threshold:
        return "median_robust", median_price, median_price

    return "latest_non_null", latest_price, median_price


def generate_weekly_snapshot_for_community(
    db: Session,
    community_id: int,
    week_end_date: date,
    unit_price_min: float = 1000.0,
    unit_price_max: float = 200000.0,
    min_samples_for_latest: int = 5,
    target_listing_count: float = 30.0,
    deviation_threshold: float = 0.25,
    coverage_low_conf_threshold: float = 0.2,
) -> PriceSnapshotWeekly | None:
    week_start, week_end = compute_week_window(week_end_date)

    # fetch window samples
    stmt = (
        select(ListingDetail)
        .where(
            ListingDetail.community_id == community_id,
            ListingDetail.is_valid.is_(True),
            ListingDetail.crawl_date >= week_start,
            ListingDetail.crawl_date <= week_end,
            ListingDetail.unit_price.is_not(None),
            ListingDetail.unit_price >= unit_price_min,
            ListingDetail.unit_price <= unit_price_max,
        )
        .order_by(ListingDetail.crawl_date.desc())
    )
    window_listings = list(db.execute(stmt).scalars().all())

    if not window_listings:
        return None

    prices = [float(l.unit_price) for l in window_listings if l.unit_price is not None]
    if not prices:
        return None

    # latest_non_null candidate: first element in crawl_date desc ordering
    latest_price = prices[0]

    policy, avg_unit_price, median_unit_price = select_policy_and_avg(
        prices=prices,
        latest_price=latest_price,
        min_samples_for_latest=min_samples_for_latest,
        deviation_threshold=deviation_threshold,
    )

    listing_count = len(prices)
    coverage_score = min(1.0, float(listing_count) / float(target_listing_count))

    # Upsert
    snap = (
        db.query(PriceSnapshotWeekly)
        .filter(PriceSnapshotWeekly.community_id == community_id, PriceSnapshotWeekly.week_end_date == week_end_date)
        .first()
    )
    if snap is None:
        snap = PriceSnapshotWeekly(
            community_id=community_id,
            week_start_date=week_start,
            week_end_date=week_end,
            avg_unit_price=avg_unit_price,
            median_unit_price=median_unit_price,
            listing_count=listing_count,
            coverage_score=coverage_score,
            data_policy=policy,
            source_priority_used="listing_detail_unit_price",
        )
        db.add(snap)
    else:
        snap.week_start_date = week_start
        snap.avg_unit_price = avg_unit_price
        snap.median_unit_price = median_unit_price
        snap.listing_count = listing_count
        snap.coverage_score = coverage_score
        snap.data_policy = policy
        snap.source_priority_used = "listing_detail_unit_price"

    return snap


def generate_weekly_snapshots_for_city(
    db: Session,
    city_id: int,
    week_end_date: date,
    community_ids: list[int] | None = None,
) -> int:
    if community_ids is None:
        community_ids = [c.community_id for c in db.query(CommunityOfficial).filter(CommunityOfficial.city_id == city_id).all()]
    count = 0
    for cid in community_ids:
        snap = generate_weekly_snapshot_for_community(db, cid, week_end_date)
        if snap is not None:
            count += 1
    db.flush()
    return count
