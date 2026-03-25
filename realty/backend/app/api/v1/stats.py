from __future__ import annotations

from datetime import date
from typing import Literal, Optional

from fastapi import APIRouter, Depends, Query, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from realty.backend.app.db.session import db_session
from realty.backend.app.models import CommunityOfficial, PriceSnapshotWeekly, ListingDetail


router = APIRouter(prefix="/api/v1/stats", tags=["stats"])


class PriceTrendResponseItem(BaseModel):
    period_start: str
    period_end: str
    avg_unit_price: Optional[float]
    median_unit_price: Optional[float]
    listing_count: int
    coverage_score: Optional[float]
    data_policy: Optional[str]
    missingFlag: bool


@router.get("/community-price-trend")
def community_price_trend(
    cityId: int = Query(...),
    startDate: date = Query(...),
    endDate: date = Query(...),
    periodType: Literal["weekly", "monthly"] = Query("weekly"),
):
    """
    MVP 只实现 weekly：返回全城聚合的周走势。
    month 先复用 weekly 数据（工程上易扩展）。
    """
    if periodType != "weekly":
        raise HTTPException(status_code=400, detail="MVP only supports weekly")

    with db_session() as db:
        # Use all communities in city, aggregate by week_end_date
        # For performance, MVP selects snapshots within date range.
        weeks = (
            db.query(PriceSnapshotWeekly.week_end_date)
            .join(CommunityOfficial, CommunityOfficial.community_id == PriceSnapshotWeekly.community_id)
            .filter(CommunityOfficial.city_id == cityId)
            .filter(PriceSnapshotWeekly.week_end_date >= startDate, PriceSnapshotWeekly.week_end_date <= endDate)
            .group_by(PriceSnapshotWeekly.week_end_date)
            .order_by(PriceSnapshotWeekly.week_end_date.asc())
            .all()
        )

        if not weeks:
            return {"cityId": cityId, "periodType": periodType, "series": []}

        series: list[dict] = []
        for (we,) in weeks:
            week_snaps = (
                db.query(PriceSnapshotWeekly)
                .join(CommunityOfficial, CommunityOfficial.community_id == PriceSnapshotWeekly.community_id)
                .filter(CommunityOfficial.city_id == cityId)
                .filter(PriceSnapshotWeekly.week_end_date == we)
                .all()
            )
            avg_prices = [s.avg_unit_price for s in week_snaps if s.avg_unit_price is not None]
            median_prices = [s.median_unit_price for s in week_snaps if s.median_unit_price is not None]
            listing_count_sum = sum(s.listing_count for s in week_snaps)
            coverage_avg = (
                sum(s.coverage_score or 0 for s in week_snaps) / max(1, len(week_snaps))
                if week_snaps
                else None
            )
            data_policy = None
            if week_snaps:
                # If multiple, keep the most frequent policy
                policies = [s.data_policy for s in week_snaps if s.data_policy]
                data_policy = max(set(policies), key=policies.count) if policies else None

            # period_start derived from week_end (weekly = week_end-6)
            period_start = (we.toordinal() - 6)
            period_start_date = date.fromordinal(period_start)
            missingFlag = len(avg_prices) == 0

            series.append(
                {
                    "period_start": period_start_date.isoformat(),
                    "period_end": we.isoformat(),
                    "avg_unit_price": (sum(avg_prices) / len(avg_prices)) if avg_prices else None,
                    "median_unit_price": (sum(median_prices) / len(median_prices)) if median_prices else None,
                    "listing_count": listing_count_sum,
                    "coverage_score": coverage_avg,
                    "data_policy": data_policy,
                    "missingFlag": missingFlag,
                }
            )

        return {"cityId": cityId, "periodType": periodType, "series": series}


@router.get("/community-ranking")
def community_ranking(
    cityId: int = Query(...),
    periodType: Literal["weekly", "monthly"] = Query("weekly"),
    weekEnd: date = Query(...),
    metric: Literal["avg_unit_price", "listing_count"] = Query("avg_unit_price"),
    top: int = Query(20, le=100),
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
    source: Optional[str] = Query(None),
):
    if periodType != "weekly":
        raise HTTPException(status_code=400, detail="MVP only supports weekly")

    with db_session() as db:
        q = (
            db.query(CommunityOfficial.community_id, CommunityOfficial.community_name, PriceSnapshotWeekly.avg_unit_price, PriceSnapshotWeekly.median_unit_price, PriceSnapshotWeekly.listing_count, PriceSnapshotWeekly.coverage_score, PriceSnapshotWeekly.data_policy)
            .join(PriceSnapshotWeekly, PriceSnapshotWeekly.community_id == CommunityOfficial.community_id)
            .filter(CommunityOfficial.city_id == cityId)
            .filter(PriceSnapshotWeekly.week_end_date == weekEnd)
        )
        if source:
            week_start = date.fromordinal(weekEnd.toordinal() - 6)
            source_community_ids = (
                db.query(ListingDetail.community_id)
                .filter(ListingDetail.city_id == cityId)
                .filter(ListingDetail.source == source)
                .filter(ListingDetail.crawl_date >= week_start, ListingDetail.crawl_date <= weekEnd)
                .distinct()
                .all()
            )
            source_community_ids = [r[0] for r in source_community_ids]
            if not source_community_ids:
                return {
                    "cityId": cityId,
                    "periodType": periodType,
                    "weekEnd": weekEnd.isoformat(),
                    "metric": metric,
                    "top": top,
                    "page": page,
                    "pageSize": pageSize,
                    "total": 0,
                    "data": [],
                }
            q = q.filter(CommunityOfficial.community_id.in_(source_community_ids))
        if metric == "avg_unit_price":
            q = q.order_by(PriceSnapshotWeekly.avg_unit_price.desc().nullslast(), PriceSnapshotWeekly.listing_count.desc())
        else:
            q = q.order_by(PriceSnapshotWeekly.listing_count.desc(), PriceSnapshotWeekly.avg_unit_price.desc().nullslast())

        total = q.count()
        limit_count = min(top, pageSize)
        offset = (page - 1) * pageSize
        rows = q.offset(offset).limit(limit_count).all()
        data = []
        for idx, r in enumerate(rows, start=offset + 1):
            data.append(
                {
                    "rank": idx,
                    "community_id": r[0],
                    "community_name": r[1],
                    "avg_unit_price": float(r[2]) if r[2] is not None else None,
                    "median_unit_price": float(r[3]) if r[3] is not None else None,
                    "listing_count": int(r[4] or 0),
                    "coverage_score": float(r[5]) if r[5] is not None else None,
                    "data_policy": r[6],
                }
            )

        return {
            "cityId": cityId,
            "periodType": periodType,
            "weekEnd": weekEnd.isoformat(),
            "metric": metric,
            "top": top,
            "page": page,
            "pageSize": pageSize,
            "total": total,
            "data": data,
        }


@router.get("/district-compare")
def district_compare(
    cityId: int = Query(...),
    periodType: Literal["weekly", "monthly"] = Query("weekly"),
    weekEnd: date = Query(...),
    source: Optional[str] = Query(None),
):
    """
    MVP 使用 community_official.district_name 做“区/板块对比”。
    """
    if periodType != "weekly":
        raise HTTPException(status_code=400, detail="MVP only supports weekly")

    with db_session() as db:
        q = (
            db.query(
                CommunityOfficial.district_name,
                PriceSnapshotWeekly.avg_unit_price,
                PriceSnapshotWeekly.median_unit_price,
                PriceSnapshotWeekly.listing_count,
                PriceSnapshotWeekly.coverage_score,
            )
            .join(PriceSnapshotWeekly, PriceSnapshotWeekly.community_id == CommunityOfficial.community_id)
            .filter(CommunityOfficial.city_id == cityId)
            .filter(PriceSnapshotWeekly.week_end_date == weekEnd)
        )
        if source:
            week_start = date.fromordinal(weekEnd.toordinal() - 6)
            source_community_ids = (
                db.query(ListingDetail.community_id)
                .filter(ListingDetail.city_id == cityId)
                .filter(ListingDetail.source == source)
                .filter(ListingDetail.crawl_date >= week_start, ListingDetail.crawl_date <= weekEnd)
                .distinct()
                .all()
            )
            source_community_ids = [r[0] for r in source_community_ids]
            if source_community_ids:
                q = q.filter(CommunityOfficial.community_id.in_(source_community_ids))
            else:
                return {"cityId": cityId, "periodType": periodType, "weekEnd": weekEnd.isoformat(), "items": []}

        rows = q.all()

        bucket: dict[str, dict] = {}
        for district_name, avg, median, listing_count, coverage_score in rows:
            key = district_name or "未知"
            b = bucket.setdefault(key, {"district_name": key, "avg_unit_price_list": [], "median_unit_price_list": [], "listing_count_sum": 0, "coverage_list": []})
            if avg is not None:
                b["avg_unit_price_list"].append(float(avg))
            if median is not None:
                b["median_unit_price_list"].append(float(median))
            b["listing_count_sum"] += int(listing_count or 0)
            if coverage_score is not None:
                b["coverage_list"].append(float(coverage_score))

        items = []
        for key, b in bucket.items():
            avg_val = (sum(b["avg_unit_price_list"]) / len(b["avg_unit_price_list"])) if b["avg_unit_price_list"] else None
            median_val = (sum(b["median_unit_price_list"]) / len(b["median_unit_price_list"])) if b["median_unit_price_list"] else None
            cov = (sum(b["coverage_list"]) / len(b["coverage_list"])) if b["coverage_list"] else None
            items.append(
                {
                    "district_name": key,
                    "avg_unit_price": avg_val,
                    "median_unit_price": median_val,
                    "listing_count": b["listing_count_sum"],
                    "coverage_score": cov,
                }
            )

        # stable order by avg price desc with nulls last
        items.sort(key=lambda x: (x["avg_unit_price"] is None, -(x["avg_unit_price"] or 0)))

        return {"cityId": cityId, "periodType": periodType, "weekEnd": weekEnd.isoformat(), "items": items}
