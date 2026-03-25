from __future__ import annotations

import argparse
import time
from datetime import date
from typing import Optional

from realty.backend.app.models import City
from realty.backend.app.scripts.run_mvp_jobs import (
    job_compute_school_future_scores,
    job_generate_weekly_snapshots,
    job_score_listings_for_week,
)
from realty.backend.app.db.session import db_session
from realty.backend.app.scripts.lianjia_auto_refresh import job_refresh_lianjia_city


def run_once(city_id: int, week_end: date, rule_listing: str, rule_school: str) -> None:
    school_cnt = job_compute_school_future_scores(rule_version=rule_school)
    print(f"[scheduler] school score done: {school_cnt}")

    snap_cnt = job_generate_weekly_snapshots(city_id=city_id, week_end_date=week_end)
    print(f"[scheduler] weekly snapshot done: {snap_cnt}")

    listing_cnt = job_score_listings_for_week(
        city_id=city_id,
        week_end_date=week_end,
        rule_version_listing=rule_listing,
        rule_version_school=rule_school,
    )
    print(f"[scheduler] listing score done: {listing_cnt}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--cityId", type=int, default=1)
    parser.add_argument("--weekEnd", type=str, default=None, help="YYYY-MM-DD, default=today")
    parser.add_argument("--ruleVersionListing", type=str, default="listing_quality_score_v1")
    parser.add_argument("--ruleVersionSchool", type=str, default="school_future_score_v1")
    parser.add_argument("--intervalMinutes", type=int, default=60, help="Run interval in minutes")
    parser.add_argument("--maxRuns", type=int, default=0, help="0 means infinite loop")
    parser.add_argument("--enableLianjiaAutoImport", action="store_true", help="Run Lianjia spider -> import -> recompute before ETL.")
    parser.add_argument(
        "--presetShenzhenHighCoverage",
        action="store_true",
        help="Preset for Shenzhen high coverage: city=深圳, interval=1440m, limitRows=10000, weekly full init.",
    )
    parser.add_argument("--lianjiaFullInit", action="store_true", help="Run SaveCityBorderIntoDB/HoleCityDown (slow).")
    parser.add_argument("--lianjiaCityName", type=str, default=None, help="Override Lianjia spider city name (e.g. 深圳).")
    parser.add_argument("--lianjiaLimitRows", type=int, default=0, help="Export row limit for testing. 0 means unlimited.")
    parser.add_argument(
        "--lianjiaWeeklyFullInit",
        action="store_true",
        help="When enabled, run full_init every 7th run (in addition to --lianjiaFullInit).",
    )
    parser.add_argument("--lianjiaSource", type=str, default="lianjia_spider_auto", help="ListingDetail.source for imported data.")
    args = parser.parse_args()

    if args.presetShenzhenHighCoverage:
        args.enableLianjiaAutoImport = True
        args.intervalMinutes = 1440
        args.lianjiaCityName = args.lianjiaCityName or "深圳"
        if int(args.lianjiaLimitRows) <= 0:
            args.lianjiaLimitRows = 10000
        args.lianjiaWeeklyFullInit = True

    fixed_week_end = None if not args.weekEnd else date.fromisoformat(args.weekEnd)
    interval_sec = max(1, args.intervalMinutes) * 60

    run_count = 0
    while True:
        run_count += 1
        week_end = fixed_week_end or date.today()
        print(f"[scheduler] run #{run_count} begin, week_end={week_end.isoformat()}")

        if args.enableLianjiaAutoImport:
            try:
                with db_session() as db:
                    city: Optional[City] = db.query(City).filter(City.city_id == args.cityId).first()
                    if city is None:
                        raise RuntimeError(f"[scheduler] cityId={args.cityId} not found")
                    city_name_for_spider = args.lianjiaCityName or city.city_name
                    city_code = city.city_code

                job_refresh_lianjia_city(
                    city_id=args.cityId,
                    city_code=city_code,
                    city_name_for_spider=city_name_for_spider,
                    source=args.lianjiaSource,
                    crawl_date=week_end,
                    full_init=(args.lianjiaFullInit or (args.lianjiaWeeklyFullInit and run_count % 7 == 1)),
                    limit_rows=max(0, int(args.lianjiaLimitRows)),
                    export_csv_path=None,  # default path in script
                    lianjia_dir=None,  # default in script
                    do_spider=True,
                    rule_version_listing=args.ruleVersionListing,
                    rule_version_school=args.ruleVersionSchool,
                )
            except Exception as e:
                print(f"[scheduler] lianjia auto import failed: {e}")
                # Fallback: still recompute derived tables with existing DB data.
                run_once(
                    city_id=args.cityId,
                    week_end=week_end,
                    rule_listing=args.ruleVersionListing,
                    rule_school=args.ruleVersionSchool,
                )
        else:
            run_once(
                city_id=args.cityId,
                week_end=week_end,
                rule_listing=args.ruleVersionListing,
                rule_school=args.ruleVersionSchool,
            )
        print(f"[scheduler] run #{run_count} finished")

        if args.maxRuns > 0 and run_count >= args.maxRuns:
            print("[scheduler] reached maxRuns, exit.")
            break

        time.sleep(interval_sec)


if __name__ == "__main__":
    main()
