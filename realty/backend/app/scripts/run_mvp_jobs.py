from __future__ import annotations

import argparse
from datetime import date, timedelta

from sqlalchemy.orm import Session

from realty.backend.app.db.session import db_session
from realty.backend.app.models import (
    SchoolIndicatorSnapshot,
    SchoolFutureScore,
    SchoolStandardized,
    PriceSnapshotWeekly,
    ListingDetail,
    ListingQualityScore,
)
from realty.backend.app.services.school_scoring import compute_school_future_score_v1
from realty.backend.app.services.snapshot_service import generate_weekly_snapshots_for_city
from realty.backend.app.services.listing_scoring import compute_listing_quality_score_v1


def upsert_school_future_score(db: Session, school_id: int, rule_version: str, score_obj: SchoolFutureScore) -> None:
    existing = db.query(SchoolFutureScore).filter(SchoolFutureScore.school_id == school_id, SchoolFutureScore.rule_version == rule_version).first()
    if existing is None:
        db.add(score_obj)
    else:
        existing.trend_score_0_100 = score_obj.trend_score_0_100
        existing.confidence_score = score_obj.confidence_score
        existing.feature_contrib_json = score_obj.feature_contrib_json
        existing.explain_text = score_obj.explain_text
        existing.province_key_flag = score_obj.province_key_flag
        existing.city_key_flag = score_obj.city_key_flag


def job_compute_school_future_scores(rule_version: str) -> int:
    """
    For each school: take latest two SchoolIndicatorSnapshot rows and compute V1 future score.
    """
    computed = 0
    with db_session() as db:
        schools = db.query(SchoolStandardized).all()
        for s in schools:
            latest = (
                db.query(SchoolIndicatorSnapshot)
                .filter(SchoolIndicatorSnapshot.school_id == s.school_id)
                .order_by(SchoolIndicatorSnapshot.indicator_date.desc())
                .limit(1)
                .first()
            )
            if latest is None:
                continue
            prev = (
                db.query(SchoolIndicatorSnapshot)
                .filter(SchoolIndicatorSnapshot.school_id == s.school_id)
                .order_by(SchoolIndicatorSnapshot.indicator_date.desc())
                .offset(1)
                .limit(1)
                .first()
            )

            res = compute_school_future_score_v1(s, latest, prev, rule_version=rule_version)

            obj = SchoolFutureScore(
                school_id=s.school_id,
                rule_version=rule_version,
                trend_score_0_100=res.trend_score_0_100,
                confidence_score=res.confidence_score,
                feature_contrib_json=res.feature_contrib_json,
                explain_text=res.explain_text,
                province_key_flag=s.province_key_flag,
                city_key_flag=s.city_key_flag,
            )
            upsert_school_future_score(db, s.school_id, rule_version, obj)
            computed += 1

        db.flush()
    return computed


def job_generate_weekly_snapshots(city_id: int, week_end_date: date) -> int:
    with db_session() as db:
        # MVP uses listing_detail.unit_price aggregation
        return generate_weekly_snapshots_for_city(db, city_id=city_id, week_end_date=week_end_date)


def job_score_listings_for_week(city_id: int, week_end_date: date, rule_version_listing: str, rule_version_school: str) -> int:
    """
    For each listing in window [week_end-6, week_end], compute listing_quality_score_v1 using:
      - community price_snapshot_weekly (same week_end_date; fallback to latest previous)
      - school_future_score (latest computed; V1)
    """
    week_start = week_end_date - timedelta(days=6)
    computed = 0

    with db_session() as db:
        listings = (
            db.query(ListingDetail)
            .filter(ListingDetail.city_id == city_id)
            .filter(ListingDetail.crawl_date >= week_start)
            .filter(ListingDetail.crawl_date <= week_end_date)
            .filter(ListingDetail.is_valid.is_(True))
            .all()
        )

        for l in listings:
            # community avg price (same week_end; fallback to latest before)
            snap = (
                db.query(PriceSnapshotWeekly)
                .filter(PriceSnapshotWeekly.community_id == l.community_id)
                .filter(PriceSnapshotWeekly.week_end_date == week_end_date)
                .first()
            )
            if snap is None:
                snap = (
                    db.query(PriceSnapshotWeekly)
                    .filter(PriceSnapshotWeekly.community_id == l.community_id)
                    .filter(PriceSnapshotWeekly.week_end_date <= week_end_date)
                    .order_by(PriceSnapshotWeekly.week_end_date.desc())
                    .first()
                )
            community_avg = float(snap.avg_unit_price) if snap and snap.avg_unit_price is not None else None

            # schools
            school_ids = l.school_ids_json or []
            if isinstance(school_ids, str):
                # allow stored JSON string
                import json

                try:
                    school_ids = json.loads(school_ids)
                except Exception:
                    school_ids = []

            if not isinstance(school_ids, list):
                school_ids = []

            schools_future = []
            if school_ids:
                schools_future = (
                    db.query(SchoolFutureScore)
                    .filter(SchoolFutureScore.rule_version == rule_version_school)
                    .filter(SchoolFutureScore.school_id.in_(school_ids))
                    .all()
                )

            res = compute_listing_quality_score_v1(
                listing=l,
                community_avg_unit_price=community_avg,
                schools_future=schools_future,
                rule_version=rule_version_listing,
            )

            # upsert
            existing = (
                db.query(ListingQualityScore)
                .filter(ListingQualityScore.listing_id == l.listing_id, ListingQualityScore.computed_week_end_date == week_end_date)
                .first()
            )
            if existing is None:
                obj = ListingQualityScore(
                    listing_id=l.listing_id,
                    rule_version=rule_version_listing,
                    computed_week_end_date=week_end_date,
                    confidence_score=1.0,
                    overall_score_0_100=res.overall_score,
                    dimension_scores_json=res.dimension_scores,
                    advantages_json=res.advantages,
                    disadvantages_json=res.disadvantages,
                    explain_json=res.explain_json,
                    school_future_score_max=res.school_future_score_max,
                    school_province_key_flag_any=res.school_province_key_flag_any,
                    school_city_key_flag_any=res.school_city_key_flag_any,
                )
                db.add(obj)
            else:
                existing.overall_score_0_100 = res.overall_score
                existing.dimension_scores_json = res.dimension_scores
                existing.advantages_json = res.advantages
                existing.disadvantages_json = res.disadvantages
                existing.explain_json = res.explain_json
                existing.school_future_score_max = res.school_future_score_max
                existing.school_province_key_flag_any = res.school_province_key_flag_any
                existing.school_city_key_flag_any = res.school_city_key_flag_any
            computed += 1

        db.flush()
    return computed


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--job", choices=["init", "school", "weekly_snapshot", "listing_score"], required=True)
    parser.add_argument("--cityId", type=int, default=1)
    parser.add_argument("--weekEnd", type=str, default=None, help="YYYY-MM-DD")
    parser.add_argument("--ruleVersionListing", type=str, default="listing_quality_score_v1")
    parser.add_argument("--ruleVersionSchool", type=str, default="school_future_score_v1")
    args = parser.parse_args()

    if args.job == "school":
        c = job_compute_school_future_scores(rule_version=args.ruleVersionSchool)
        print(f"Computed school_future_score for {c} schools.")
        return

    if args.job == "weekly_snapshot":
        if not args.weekEnd:
            raise ValueError("--weekEnd is required")
        we = date.fromisoformat(args.weekEnd)
        c = job_generate_weekly_snapshots(city_id=args.cityId, week_end_date=we)
        print(f"Generated weekly snapshots for {c} communities.")
        return

    if args.job == "listing_score":
        if not args.weekEnd:
            raise ValueError("--weekEnd is required")
        we = date.fromisoformat(args.weekEnd)
        c = job_score_listings_for_week(
            city_id=args.cityId,
            week_end_date=we,
            rule_version_listing=args.ruleVersionListing,
            rule_version_school=args.ruleVersionSchool,
        )
        print(f"Computed listing_quality_score for {c} listings.")
        return

    if args.job == "init":
        from realty.backend.app.scripts.init_db import main as init_main

        init_main()
        return


if __name__ == "__main__":
    main()
