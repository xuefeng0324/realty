from __future__ import annotations

import argparse
import json
from datetime import date, timedelta

from sqlalchemy import delete

from realty.backend.app.db.base import Base
from realty.backend.app.db.session import engine
from realty.backend.app.db.session import db_session
from realty.backend.app.models import (
    City,
    CommunityOfficial,
    SchoolIndicatorSnapshot,
    SchoolFutureScore,
    SchoolStandardized,
    PriceSnapshotWeekly,
    ListingDetail,
    ListingQualityScore,
)
from realty.backend.app.scripts.init_db import main as init_main
from realty.backend.app.scripts.run_mvp_jobs import (
    job_compute_school_future_scores,
    job_generate_weekly_snapshots,
    job_score_listings_for_week,
)


def maybe_reset_tables(reset: bool) -> None:
    if not reset:
        return
    # Demo schema evolves frequently during development (e.g. 新增 listing_type 字段）。
    # SQLite 无迁移：这里直接 drop/create，确保新列能落到真实表结构上。
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--reset", action="store_true", help="Reset demo data.")
    parser.add_argument("--cityId", type=int, default=1)
    args = parser.parse_args()

    # Ensure tables exist
    init_main()
    maybe_reset_tables(args.reset)

    today = date.today()
    prev_indicator_date = today - timedelta(days=20)
    latest_indicator_date = today - timedelta(days=10)

    # weekly snapshot uses week_end_date = today (rolling 7 days)
    week_end_date = today

    created_city_id: int | None = None
    created_community_id: int | None = None
    with db_session() as db:
        # 1) City
        city = City(city_code="sz", city_name="深圳", is_active=True)
        db.add(city)
        db.flush()  # get city_id

        city_id = city.city_id
        created_city_id = city_id

        # 2) Community (official)
        community = CommunityOfficial(
            city_id=city_id,
            community_name="示例小区A",
            district_name="南山区",
            region_name="科技园板块",
        )
        db.add(community)
        db.flush()
        community_id = community.community_id
        created_community_id = community_id

        # 3) Schools
        school1 = SchoolStandardized(
            city_id=city_id,
            official_name="示例省级重点中学",
            display_name="省重示例中学",
            school_type="初中",
            province_key_flag=True,
            city_key_flag=True,
        )
        school2 = SchoolStandardized(
            city_id=city_id,
            official_name="示例市级名校",
            display_name="市名示例中学",
            school_type="初中",
            province_key_flag=False,
            city_key_flag=True,
        )
        db.add_all([school1, school2])
        db.flush()

        # 4) School indicator snapshots (two points for trend)
        # trend_delta_raw should be small fraction (<=1) so mapping behaves as in docs.
        snap1_prev = SchoolIndicatorSnapshot(
            school_id=school1.school_id,
            indicator_date=prev_indicator_date,
            latest_level_score_raw=80.0,
            group_school_flag_raw=True,
            group_school_strength_raw=85.0,
            district_balance_level_raw=78.0,
            trend_delta_raw=None,
            source="demo",
        )
        snap1_latest = SchoolIndicatorSnapshot(
            school_id=school1.school_id,
            indicator_date=latest_indicator_date,
            latest_level_score_raw=86.0,
            group_school_flag_raw=True,
            group_school_strength_raw=88.0,
            district_balance_level_raw=82.0,
            trend_delta_raw=0.08,  # +8%
            source="demo",
        )
        snap2_prev = SchoolIndicatorSnapshot(
            school_id=school2.school_id,
            indicator_date=prev_indicator_date,
            latest_level_score_raw=70.0,
            group_school_flag_raw=False,
            group_school_strength_raw=None,
            district_balance_level_raw=65.0,
            trend_delta_raw=None,
            source="demo",
        )
        snap2_latest = SchoolIndicatorSnapshot(
            school_id=school2.school_id,
            indicator_date=latest_indicator_date,
            latest_level_score_raw=74.0,
            group_school_flag_raw=False,
            group_school_strength_raw=None,
            district_balance_level_raw=68.0,
            trend_delta_raw=-0.05,  # -5%
            source="demo",
        )
        db.add_all([snap1_prev, snap1_latest, snap2_prev, snap2_latest])

        # 5) Listing detail (3 listings in the same community within last 7 days)
        def total_price_10k(unit_price: float, area_sqm: float) -> float:
            return round((unit_price * area_sqm) / 10000.0, 2)

        crawl_dates = [today - timedelta(days=0), today - timedelta(days=1), today - timedelta(days=3)]
        listings = [
            # Good: near metro + south/north + elevator + good school1
            {
                "crawl_date": crawl_dates[0],
                "listing_type": "second_hand",
                "title": "示例小区A 精装 南北通透 近地铁",
                "total_price_10k": total_price_10k(62000.0, 120.0),
                "unit_price": 62000.0,
                "area_sqm": 120.0,
                "bedrooms": 3,
                "bathrooms": 2,
                "orientation": "南北",
                "floor_number": "6楼",
                "has_elevator": True,
                "decorate_type": "精装",
                "build_year": 2016,
                "nearest_metro_distance_m": 800,
                "school_ids_json": [school1.school_id],
                "tags_json": ["近地铁", "强学区", "精装修"],
                "source": "demo",
                "source_listing_id": "demo-1",
                "source_url": "https://example.com/listing/1",
            },
            # Middle/negative: far metro + north + no elevator + weaker school2
            {
                "crawl_date": crawl_dates[1],
                "listing_type": "new_house",
                "title": "示例小区A 简装 北向 无电梯 距地铁较远",
                "total_price_10k": total_price_10k(54000.0, 88.0),
                "unit_price": 54000.0,
                "area_sqm": 88.0,
                "bedrooms": 2,
                "bathrooms": 1,
                "orientation": "北",
                "floor_number": "15楼",
                "has_elevator": False,
                "decorate_type": "简装",
                "build_year": 2004,
                "nearest_metro_distance_m": 2500,
                "school_ids_json": [school2.school_id],
                "tags_json": ["距地铁远", "无电梯", "北向"],
                "source": "demo",
                "source_listing_id": "demo-2",
                "source_url": "https://example.com/listing/2",
            },
            # Mixed: south + good school1 + old-ish but elevator
            {
                "crawl_date": crawl_dates[2],
                "listing_type": "second_hand",
                "title": "示例小区A 毛坯 南向 低楼层 有电梯",
                "total_price_10k": total_price_10k(59000.0, 100.0),
                "unit_price": 59000.0,
                "area_sqm": 100.0,
                "bedrooms": 3,
                "bathrooms": 2,
                "orientation": "南",
                "floor_number": "2楼",
                "has_elevator": True,
                "decorate_type": "毛坯",
                "build_year": 1999,
                "nearest_metro_distance_m": 1200,
                "school_ids_json": [school1.school_id, school2.school_id],
                "tags_json": ["南向", "低楼层", "毛坯"],
                "source": "demo",
                "source_listing_id": "demo-3",
                "source_url": "https://example.com/listing/3",
            },
        ]

        for item in listings:
            db.add(
                ListingDetail(
                    city_id=city_id,
                    community_id=community_id,
                    source=item["source"],
                    source_listing_id=item["source_listing_id"],
                    source_url=item["source_url"],
                    listing_type=item["listing_type"],
                    title=item["title"],
                    total_price_10k=item["total_price_10k"],
                    unit_price=item["unit_price"],
                    area_sqm=item["area_sqm"],
                    bedrooms=item["bedrooms"],
                    bathrooms=item["bathrooms"],
                    orientation=item["orientation"],
                    floor_number=item["floor_number"],
                    has_elevator=item["has_elevator"],
                    decorate_type=item["decorate_type"],
                    build_year=item["build_year"],
                    nearest_metro_distance_m=item["nearest_metro_distance_m"],
                    school_ids_json=item["school_ids_json"],
                    tags_json=item["tags_json"],
                    is_valid=True,
                    crawl_date=item["crawl_date"],
                )
            )

        db.flush()

    if created_city_id is None:
        raise RuntimeError("Failed to create demo city_id.")

    # Compute derived scores/snapshots for quick API validation
    # 1) school_future_score
    job_compute_school_future_scores(rule_version="school_future_score_v1")

    # 2) weekly snapshot
    job_generate_weekly_snapshots(city_id=created_city_id, week_end_date=week_end_date)

    # 3) listing quality score
    job_score_listings_for_week(
        city_id=created_city_id,
        week_end_date=week_end_date,
        rule_version_listing="listing_quality_score_v1",
        rule_version_school="school_future_score_v1",
    )

    print("Seed demo data inserted and computed derived tables.")
    print(f"week_end_date={week_end_date.isoformat()}")
    if created_community_id is not None:
        print(f"communityId={created_community_id}")
    print("Try these API endpoints:")
    print(f"  GET /api/v1/stats/community-ranking?cityId={created_city_id}&periodType=weekly&weekEnd={week_end_date.isoformat()}&metric=avg_unit_price&top=20")
    if created_community_id is not None:
        print(
            "  GET /api/v1/communities/{communityId}/price-trend?periodType=weekly&startDate=2026-01-01&endDate=2026-12-31".format(
                communityId=created_community_id
            )
        )
        print(
            f"  GET /api/v1/communities/{created_community_id}/quality-summary?days=30&periodType=weekly&includeRadar=true"
        )


if __name__ == "__main__":
    main()
