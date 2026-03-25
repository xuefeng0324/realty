from __future__ import annotations

import argparse
import csv
import importlib.util
import os
import sqlite3
from datetime import date
from pathlib import Path
from typing import Any, Optional

from realty.backend.app.db.session import db_session
from realty.backend.app.models import City
from realty.backend.app.scripts.import_listings_csv import main as import_csv_main
from realty.backend.app.scripts.run_mvp_jobs import (
    job_compute_school_future_scores,
    job_generate_weekly_snapshots,
    job_score_listings_for_week,
)


def _load_module_from_path(path: Path, module_name: str) -> Any:
    spec = importlib.util.spec_from_file_location(module_name, str(path))
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Failed to load module: {path}")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def _quote_ident(name: str) -> str:
    return '"' + str(name).replace('"', '""') + '"'


def _table_exists(db_path: Path, table_name: str) -> bool:
    if not db_path.exists():
        return False
    conn = sqlite3.connect(str(db_path))
    try:
        cur = conn.cursor()
        row = cur.execute(
            "select 1 from sqlite_master where type='table' and name=? limit 1",
            (table_name,),
        ).fetchone()
        return bool(row)
    finally:
        conn.close()


def _list_tables(db_path: Path) -> list[str]:
    if not db_path.exists():
        return []
    conn = sqlite3.connect(str(db_path))
    try:
        cur = conn.cursor()
        rows = cur.execute(
            "select name from sqlite_master where type='table' and name not like 'sqlite_%' order by name"
        ).fetchall()
        return [str(r[0]) for r in rows if r and r[0]]
    finally:
        conn.close()


def _row_count(db_path: Path, table_name: str) -> int:
    conn = sqlite3.connect(str(db_path))
    try:
        cur = conn.cursor()
        q = f"select count(1) from {_quote_ident(table_name)}"
        row = cur.execute(q).fetchone()
        return int((row or [0])[0] or 0)
    except Exception:
        return 0
    finally:
        conn.close()


def _ensure_city_table_alias(db_path: Path, city_name: str) -> bool:
    """
    Some old spider DBs may contain mojibake table names instead of the expected Chinese city name.
    If target city table is missing but there is another non-empty table, create an alias table by copy.
    """
    if _table_exists(db_path, city_name):
        return True
    tables = _list_tables(db_path)
    if not tables:
        return False
    # Prefer the table with the most rows as alias source.
    best_table = max(tables, key=lambda t: _row_count(db_path, t))
    if not best_table:
        return False
    conn = sqlite3.connect(str(db_path))
    try:
        cur = conn.cursor()
        cur.execute(
            f"create table if not exists {_quote_ident(city_name)} as select * from {_quote_ident(best_table)}"
        )
        conn.commit()
    finally:
        conn.close()
    return _table_exists(db_path, city_name)


def export_lianjia_detail_db_to_csv(
    detail_db_path: Path,
    out_csv_path: Path,
    limit_rows: int = 0,
    table_name: Optional[str] = None,
) -> int:
    """
    Export `DetailInfo.db` (from Lianjia spider) to a CSV file compatible with import_listings_csv.py.
    """
    if not detail_db_path.exists():
        raise FileNotFoundError(str(detail_db_path))

    conn = sqlite3.connect(str(detail_db_path))
    cur = conn.cursor()

    tables = [r[0] for r in cur.execute("select name from sqlite_master where type='table' order by name").fetchall()]
    if not tables:
        raise RuntimeError("No table found in DetailInfo.db")

    # Usually only one table; allow forcing table_name to avoid wrong-city export.
    if table_name and table_name in tables:
        target_table = table_name
    else:
        target_table = tables[0]

    cols = cur.execute(f"pragma table_info({_quote_ident(target_table)})").fetchall()
    col_names = [c[1] for c in cols]

    query = f"select {', '.join([_quote_ident(c) for c in col_names])} from {_quote_ident(target_table)}"
    params: list[Any] = []
    if limit_rows and limit_rows > 0:
        query += " limit ?"
        params = [limit_rows]

    rows = cur.execute(query, params).fetchall()

    out_csv_path.parent.mkdir(parents=True, exist_ok=True)
    with open(out_csv_path, "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.writer(f)
        writer.writerow(col_names)
        for r in rows:
            writer.writerow([("" if v is None else v) for v in r])

    return len(rows)


def job_refresh_lianjia_city(
    *,
    city_id: int,
    city_code: str,
    city_name_for_spider: str,
    source: str,
    crawl_date: date,
    full_init: bool,
    limit_rows: int,
    export_csv_path: Optional[Path],
    lianjia_dir: Optional[Path],
    do_spider: bool,
    rule_version_listing: str,
    rule_version_school: str,
) -> None:
    """
    1) Run Lianjia spider to refresh `DetailInfo.db`
    2) Export `DetailInfo.db` to CSV
    3) Import CSV into our backend DB
    4) Recompute school_future_score -> weekly_snapshot -> listing_score for current week_end=crawl_date
    """
    repo_root = Path(__file__).resolve().parents[3]  # backend/app/scripts -> backend/app -> backend -> repo root
    lianjia_dir = lianjia_dir or (repo_root / "data" / "sources" / "Lianjia")
    export_csv_path = export_csv_path or (lianjia_dir / "DetailInfo_export_auto.csv")

    lianjia_py = lianjia_dir / "lianjia.py"
    if not lianjia_py.exists():
        raise FileNotFoundError(str(lianjia_py))

    mod = _load_module_from_path(lianjia_py, "lianjia_spider")

    if do_spider:
        # Ensure all spider sqlite files are created/updated under the spider directory.
        old_cwd = os.getcwd()
        os.chdir(str(lianjia_dir))
        try:
            if full_init:
                # These can be very slow; keep them off by default.
                if hasattr(mod, "SaveCityBorderIntoDB"):
                    try:
                        mod.SaveCityBorderIntoDB(city_name_for_spider)
                    except Exception as e:
                        print(f"[lianjia_auto_refresh] SaveCityBorderIntoDB failed: {e}")
                if hasattr(mod, "HoleCityDown"):
                    try:
                        mod.HoleCityDown(city_name_for_spider)
                    except Exception as e:
                        print(f"[lianjia_auto_refresh] HoleCityDown failed: {e}")

            # Try to auto-fix mojibake/legacy table names before GetCompleteHousingInfo.
            area_db_path = lianjia_dir / "LianJia_area.db"
            if not _ensure_city_table_alias(area_db_path, city_name_for_spider):
                raise RuntimeError(
                    f"LianJia_area city table missing for '{city_name_for_spider}', "
                    f"available tables={_list_tables(area_db_path)}"
                )

            if hasattr(mod, "GetCompleteHousingInfo"):
                mod.GetCompleteHousingInfo(city_name_for_spider)
            else:
                raise RuntimeError("lianjia.py missing GetCompleteHousingInfo()")
        finally:
            os.chdir(old_cwd)

    detail_db_path = lianjia_dir / "DetailInfo.db"
    _ensure_city_table_alias(detail_db_path, city_name_for_spider)
    exported = export_lianjia_detail_db_to_csv(
        detail_db_path=detail_db_path,
        out_csv_path=export_csv_path,
        limit_rows=limit_rows,
        table_name=city_name_for_spider,
    )
    print(f"[lianjia_auto_refresh] exported rows={exported} to {export_csv_path}")

    # Import CSV by calling the existing importer module entrypoint.
    # Note: import_listings_csv.py expects CLI args; we emulate them via argparse-friendly call.
    # Keep it simple: call main() by temporarily building sys.argv in-process is brittle,
    # so we re-use it via `subprocess` would be heavier. Here we use a direct call by constructing
    # a minimal CSV import with its existing functions is future work; for now we keep a safe CLI approach.
    #
    # For the current MVP, it's acceptable because this job runs in scheduler anyway.
    #
    # We call it via a small trick: exec main() with injected args.
    import sys

    prev_argv = sys.argv
    try:
        sys.argv = [
            "import_listings_csv.py",
            "--csv",
            str(export_csv_path),
            "--cityCode",
            city_code,
            "--cityName",
            city_name_for_spider,
            "--source",
            source,
            "--listingType",
            "second_hand",
            "--crawlDate",
            crawl_date.isoformat(),
        ]
        import_csv_main()
    finally:
        sys.argv = prev_argv

    # Recompute derived tables for current week_end (use crawl_date as reference).
    job_compute_school_future_scores(rule_version=rule_version_school)
    job_generate_weekly_snapshots(city_id=city_id, week_end_date=crawl_date)
    job_score_listings_for_week(
        city_id=city_id,
        week_end_date=crawl_date,
        rule_version_listing=rule_version_listing,
        rule_version_school=rule_version_school,
    )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--cityId", type=int, required=True)
    parser.add_argument("--ruleVersionListing", type=str, default="listing_quality_score_v1")
    parser.add_argument("--ruleVersionSchool", type=str, default="school_future_score_v1")

    # Lianjia spider uses Chinese city names as keys (e.g. '深圳').
    parser.add_argument("--lianjiaCityName", type=str, default=None)
    parser.add_argument("--lianjiaFullInit", action="store_true", help="Run SaveCityBorderIntoDB/HoleCityDown (slow).")
    parser.add_argument("--limitRows", type=int, default=0, help="0 means unlimited export rows (useful for testing).")
    parser.add_argument("--skipSpider", action="store_true", help="Skip fetching from Lianjia; only export existing DetailInfo.db and import it.")

    parser.add_argument("--source", type=str, default="lianjia_spider_auto")
    parser.add_argument("--crawlDate", type=str, default=None, help="YYYY-MM-DD, default=today")
    parser.add_argument("--exportCsvPath", type=str, default=None, help="Override export CSV path.")
    args = parser.parse_args()

    with db_session() as db:
        city = db.query(City).filter(City.city_id == args.cityId).first()
        if city is None:
            raise RuntimeError(f"cityId={args.cityId} not found in backend DB")
        city_code = city.city_code
        backend_city_name = city.city_name

    city_name_for_spider = args.lianjiaCityName or backend_city_name

    crawl_date = date.today() if not args.crawlDate else date.fromisoformat(args.crawlDate)

    repo_root = Path(__file__).resolve().parents[3]  # backend/app/scripts -> backend/app -> backend -> repo root
    lianjia_dir = repo_root / "data" / "sources" / "Lianjia"
    export_csv_path = Path(args.exportCsvPath) if args.exportCsvPath else (lianjia_dir / "DetailInfo_export_auto.csv")

    job_refresh_lianjia_city(
        city_id=args.cityId,
        city_code=city_code,
        city_name_for_spider=city_name_for_spider,
        source=args.source,
        crawl_date=crawl_date,
        full_init=args.lianjiaFullInit,
        limit_rows=max(0, int(args.limitRows)),
        export_csv_path=export_csv_path,
        lianjia_dir=lianjia_dir,
        do_spider=not args.skipSpider,
        rule_version_listing=args.ruleVersionListing,
        rule_version_school=args.ruleVersionSchool,
    )


if __name__ == "__main__":
    main()
