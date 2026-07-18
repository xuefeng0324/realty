"""按依赖顺序重建所有受 listings.csv 影响的派生 CSV。"""
from __future__ import annotations

import subprocess
import sys
import os
from pathlib import Path


SCRIPT_DIR = Path(__file__).resolve().parent
PIPELINE = [
    "compute_district_trend.py",
    "compute_school_premium.py",
    "compute_listing_school_premium.py",
    "compute_layout_distribution.py",
    "compute_listing_tags.py",
    "compute_listing_keyword.py",
    "compute_district_index.py",
    "compute_feature_premium.py",
    "compute_tag_combination.py",
    "compute_listing_freshness.py",
    "compute_bedroom_area.py",
    "compute_orientation_floor.py",
    "compute_decorate_age.py",
    "compute_community_scatter.py",
    "compute_district_metadata.py",
    "compute_community_score.py",
]


def main() -> None:
    env = os.environ.copy()
    env["PYTHONIOENCODING"] = "utf-8"
    env["PYTHONUTF8"] = "1"
    for name in PIPELINE:
        print(f"[rebuild] {name}", flush=True)
        subprocess.run(
            [sys.executable, str(SCRIPT_DIR / name)],
            cwd=SCRIPT_DIR.parent,
            env=env,
            check=True,
        )
    print(f"[rebuild] complete: {len(PIPELINE)} scripts")


if __name__ == "__main__":
    main()
