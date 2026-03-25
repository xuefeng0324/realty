from __future__ import annotations

from datetime import date
from typing import Literal, Optional

from fastapi import APIRouter, Query
from sqlalchemy import func
from sqlalchemy.orm import aliased

from realty.backend.app.core.config import settings
from realty.backend.app.db.session import db_session
from realty.backend.app.models import City, PriceSnapshotWeekly, CommunityOfficial, ListingDetail


router = APIRouter(prefix="/api/v1", tags=["meta"])


@router.get("/cities")
def cities():
    with db_session() as db:
        rows = db.query(City).filter(City.is_active.is_(True)).order_by(City.city_name.asc()).all()
        return {
            "items": [
                {"city_id": c.city_id, "city_code": c.city_code, "city_name": c.city_name}
                for c in rows
            ]
        }


@router.get("/periods")
def periods(
    type: Literal["weekly", "monthly"] = Query("weekly"),
    cityId: Optional[int] = Query(None),
    limit: int = Query(20, ge=1, le=200),
):
    """
    MVP：
    - weekly：从 price_snapshot_weekly 找最近的 week_end_date
    - monthly：先返回 empty（或复用 weekly 逻辑后续扩展）
    """
    if type not in ("weekly", "monthly"):
        return {"type": type, "items": []}

    if type == "monthly":
        return {"type": "monthly", "items": []}

    with db_session() as db:
        q = db.query(PriceSnapshotWeekly.week_end_date).distinct()
        if cityId is not None:
            q = q.join(CommunityOfficial, CommunityOfficial.community_id == PriceSnapshotWeekly.community_id).filter(CommunityOfficial.city_id == cityId)
        weeks = (
            q.order_by(PriceSnapshotWeekly.week_end_date.desc())
            .limit(limit)
            .all()
        )
        items = [w[0].isoformat() for w in weeks if w and w[0] is not None]
        items.reverse()  # ascending for UI
        return {"type": "weekly", "items": items}


@router.get("/runtime")
def runtime():
    db_url = settings.database_url
    db_file = None
    if db_url.startswith("sqlite:///"):
        db_file = db_url.replace("sqlite:///", "", 1)

    with db_session() as db:
        city_count = db.query(func.count(City.city_id)).scalar() or 0
        community_count = db.query(func.count(CommunityOfficial.community_id)).scalar() or 0
        listing_count = db.query(func.count(ListingDetail.listing_id)).scalar() or 0

    return {
        "database_url": db_url,
        "database_file": db_file,
        "rule_version_listing": settings.rule_version_listing,
        "rule_version_school": settings.rule_version_school,
        "data_counts": {
            "cities": int(city_count),
            "communities": int(community_count),
            "listings": int(listing_count),
        },
        "server_date": date.today().isoformat(),
    }


@router.get("/sources")
def sources(
    cityId: int = Query(..., ge=1),
):
    """
    返回当前城市可用的数据来源（listing_detail.source）及条数。
    """
    with db_session() as db:
        rows = (
            db.query(ListingDetail.source, func.count(ListingDetail.listing_id).label("cnt"))
            .filter(ListingDetail.city_id == cityId)
            .group_by(ListingDetail.source)
            .order_by(func.count(ListingDetail.listing_id).desc())
            .all()
        )
    items = [
        {"source": str(r[0] or ""), "listing_count": int(r[1] or 0)}
        for r in rows
        if r is not None
    ]
    return {"cityId": int(cityId), "items": items}


@router.get("/coverage")
def coverage(
    cityId: int = Query(..., ge=1),
    source: Optional[str] = Query(None),
):
    """
    数据覆盖率（按区）：
    - total_districts: 当前城市在 community_official 出现过的区总数
    - covered_districts: 有至少 1 条 listing_detail 的区数
    - empty_districts: 有小区但暂无房源的区名列表
    """
    with db_session() as db:
        ld = aliased(ListingDetail)
        district_rows = (
            db.query(CommunityOfficial.district_name)
            .filter(
                CommunityOfficial.city_id == cityId,
                CommunityOfficial.district_name.isnot(None),
                CommunityOfficial.district_name != "",
            )
            .distinct()
            .all()
        )
        all_districts = sorted({str(r[0]).strip() for r in district_rows if r and r[0]})

        covered_q = (
            db.query(CommunityOfficial.district_name, func.count(ListingDetail.listing_id).label("cnt"))
            .join(ListingDetail, ListingDetail.community_id == CommunityOfficial.community_id)
            .filter(
                CommunityOfficial.city_id == cityId,
                CommunityOfficial.district_name.isnot(None),
                CommunityOfficial.district_name != "",
            )
        )
        if source:
            covered_q = covered_q.filter(ListingDetail.source == source)
        covered_rows = covered_q.group_by(CommunityOfficial.district_name).all()
        covered_pairs = [
            {"district_name": str(r[0]), "listing_count": int(r[1] or 0)}
            for r in covered_rows
            if r and r[0]
        ]
        covered_pairs.sort(key=lambda x: x["listing_count"], reverse=True)
        covered_names = {x["district_name"] for x in covered_pairs}
        empty_districts = [d for d in all_districts if d not in covered_names]

        community_total_rows = (
            db.query(CommunityOfficial.district_name, func.count(CommunityOfficial.community_id).label("community_total"))
            .filter(
                CommunityOfficial.city_id == cityId,
                CommunityOfficial.district_name.isnot(None),
                CommunityOfficial.district_name != "",
            )
            .group_by(CommunityOfficial.district_name)
            .all()
        )
        community_total_map = {
            str(r[0]): int(r[1] or 0) for r in community_total_rows if r and r[0]
        }

        covered_community_q = (
            db.query(
                CommunityOfficial.district_name,
                func.count(func.distinct(CommunityOfficial.community_id)).label("community_with_listing"),
            )
            .join(ld, ld.community_id == CommunityOfficial.community_id)
            .filter(
                CommunityOfficial.city_id == cityId,
                CommunityOfficial.district_name.isnot(None),
                CommunityOfficial.district_name != "",
            )
        )
        if source:
            covered_community_q = covered_community_q.filter(ld.source == source)
        covered_community_rows = covered_community_q.group_by(CommunityOfficial.district_name).all()
        covered_community_map = {
            str(r[0]): int(r[1] or 0) for r in covered_community_rows if r and r[0]
        }

        district_community_gaps = []
        for district_name in all_districts:
            total = int(community_total_map.get(district_name, 0))
            covered = int(covered_community_map.get(district_name, 0))
            missing = max(0, total - covered)
            district_community_gaps.append(
                {
                    "district_name": district_name,
                    "community_total": total,
                    "community_with_listing": covered,
                    "community_missing_listing": missing,
                    "community_coverage_ratio": round((covered / total), 4) if total > 0 else 0.0,
                }
            )
        district_community_gaps.sort(
            key=lambda x: (x["community_missing_listing"], x["community_total"]), reverse=True
        )

    total_districts = len(all_districts)
    covered_districts = len(covered_names)
    coverage_ratio = (covered_districts / total_districts) if total_districts > 0 else 0.0

    return {
        "cityId": int(cityId),
        "source_used": source or "",
        "total_districts": total_districts,
        "covered_districts": covered_districts,
        "coverage_ratio": round(coverage_ratio, 4),
        "empty_districts": empty_districts,
        "district_listing_counts": covered_pairs,
        "district_community_gaps": district_community_gaps,
        "server_date": date.today().isoformat(),
    }
