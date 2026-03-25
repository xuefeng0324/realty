from __future__ import annotations

from datetime import date, timedelta
from typing import Any, Literal, Optional

from fastapi import APIRouter, Query, HTTPException
from pydantic import BaseModel

from sqlalchemy import func
import statistics

from realty.backend.app.db.session import db_session
from realty.backend.app.models import CommunityOfficial, PriceSnapshotWeekly, ListingQualityScore, ListingDetail


router = APIRouter(prefix="/api/v1/communities", tags=["communities"])


class PriceTrendItem(BaseModel):
    period_start: str
    period_end: str
    avg_unit_price: Optional[float]
    median_unit_price: Optional[float]
    listing_count: int
    coverage_score: Optional[float]
    data_policy: Optional[str]
    missingFlag: bool


@router.get("/{communityId}/price-trend")
def community_price_trend(
    communityId: int,
    periodType: Literal["weekly", "monthly"] = Query("weekly"),
    startDate: Optional[date] = Query(None),
    endDate: Optional[date] = Query(None),
    weekEnd: Optional[date] = Query(None),
):
    if periodType != "weekly":
        raise HTTPException(status_code=400, detail="MVP only supports weekly")

    if endDate is None:
        if weekEnd is None:
            raise HTTPException(status_code=400, detail="endDate or weekEnd is required")
        endDate = weekEnd
    if startDate is None:
        startDate = endDate - timedelta(days=90)

    with db_session() as db:
        community = db.query(CommunityOfficial).filter_by(community_id=communityId).first()
        if not community:
            raise HTTPException(status_code=404, detail="Community not found")

        snaps = (
            db.query(PriceSnapshotWeekly)
            .filter(PriceSnapshotWeekly.community_id == communityId)
            .filter(PriceSnapshotWeekly.week_end_date >= startDate)
            .filter(PriceSnapshotWeekly.week_end_date <= endDate)
            .order_by(PriceSnapshotWeekly.week_end_date.asc())
            .all()
        )

        data: list[dict[str, Any]] = []
        for s in snaps:
            period_start_date = s.week_end_date - timedelta(days=6)
            data.append(
                {
                    "period_start": period_start_date.isoformat(),
                    "period_end": s.week_end_date.isoformat(),
                    "avg_unit_price": float(s.avg_unit_price) if s.avg_unit_price is not None else None,
                    "median_unit_price": float(s.median_unit_price) if s.median_unit_price is not None else None,
                    "listing_count": int(s.listing_count or 0),
                    "coverage_score": float(s.coverage_score) if s.coverage_score is not None else None,
                    "data_policy": s.data_policy,
                    "missingFlag": s.listing_count == 0,
                }
            )

        return {
            "communityId": communityId,
            "community_name": community.community_name,
            "periodType": periodType,
            "data": data,
        }


@router.get("/{communityId}/quality-summary")
def quality_summary(
    communityId: int,
    days: int = Query(30, ge=1, le=3650),
    periodType: Literal["weekly", "monthly"] = Query("weekly"),
    includeRadar: bool = Query(False),
):
    if periodType != "weekly":
        raise HTTPException(status_code=400, detail="MVP only supports weekly")

    with db_session() as db:
        end = date.today()
        start = end - timedelta(days=days)

        scores = (
            db.query(ListingQualityScore)
            .join(ListingDetail, ListingDetail.listing_id == ListingQualityScore.listing_id)
            .filter(ListingDetail.community_id == communityId)
            .filter(ListingQualityScore.computed_week_end_date >= start)
            .filter(ListingQualityScore.computed_week_end_date <= end)
            .all()
        )
        if not scores:
            return {
                "communityId": communityId,
                "periodType": periodType,
                "days": days,
                "bins": [],
                "scoreStats": {},
                "rule_version": None,
                "radar": None if includeRadar else None,
            }

        vals = [float(s.overall_score_0_100) for s in scores]
        # bins 0-39,40-59,60-79,80-100
        bins = [
            {"bin": "0-39", "count": 0},
            {"bin": "40-59", "count": 0},
            {"bin": "60-79", "count": 0},
            {"bin": "80-100", "count": 0},
        ]
        for v in vals:
            if v < 40:
                bins[0]["count"] += 1
            elif v < 60:
                bins[1]["count"] += 1
            elif v < 80:
                bins[2]["count"] += 1
            else:
                bins[3]["count"] += 1

        scoreStats = {
            "min": min(vals),
            "max": max(vals),
            "avg": sum(vals) / len(vals),
            "median": sorted(vals)[len(vals) // 2],
        }
        rule_version = scores[0].rule_version

        radar = None
        if includeRadar:
            # average each dimension
            dims = ["location_score", "house_quality_score", "building_age_score", "amenity_score", "price_value_score"]
            dim_vals = {d: [] for d in dims}
            for s in scores:
                ds = s.dimension_scores_json or {}
                for d in dims:
                    if d in ds and ds[d] is not None:
                        dim_vals[d].append(float(ds[d]))

            radar_values = {}
            for d in dims:
                arr = dim_vals[d]
                if not arr:
                    radar_values[d] = {"avg": 0, "min": 0, "max": 0}
                else:
                    radar_values[d] = {"avg": sum(arr) / len(arr), "min": min(arr), "max": max(arr)}

            radar = {
                "rule_version": rule_version,
                "dimensions": dims,
                "values": {
                    "location_score": radar_values["location_score"],
                    "house_quality_score": radar_values["house_quality_score"],
                    "building_age_score": radar_values["building_age_score"],
                    "amenity_score": radar_values["amenity_score"],
                    "price_value_score": radar_values["price_value_score"],
                },
            }

        return {
            "communityId": communityId,
            "periodType": periodType,
            "days": days,
            "bins": bins,
            "scoreStats": scoreStats,
            "rule_version": rule_version,
            "radar": radar,
        }


@router.get("/{communityId}/quality-summary-filtered")
def quality_summary_filtered(
    communityId: int,
    weekEnd: date = Query(...),
    minQualityScore: float = Query(60.0),
    maxQualityScore: Optional[float] = Query(None),
    listingType: Optional[str] = Query(None),
    periodType: Literal["weekly", "monthly"] = Query("weekly"),
    includeRadar: bool = Query(False),
):
    """
    Filtered by minQualityScore on the same computed_week_end_date (weekEnd).
    This keeps charts consistent with the "房源筛选" table.
    """
    if periodType != "weekly":
        raise HTTPException(status_code=400, detail="MVP only supports weekly")

    with db_session() as db:
        q = (
            db.query(ListingQualityScore)
            .join(ListingDetail, ListingDetail.listing_id == ListingQualityScore.listing_id)
            .filter(ListingDetail.community_id == communityId)
            .filter(ListingQualityScore.computed_week_end_date == weekEnd)
            .filter(ListingQualityScore.overall_score_0_100 >= minQualityScore)
        )
        if maxQualityScore is not None:
            q = q.filter(ListingQualityScore.overall_score_0_100 <= maxQualityScore)
        if listingType is not None and listingType != "all":
            q = q.filter(ListingDetail.listing_type == listingType)
        scores = q.all()

        bins = [
            {"bin": "0-39", "count": 0},
            {"bin": "40-59", "count": 0},
            {"bin": "60-79", "count": 0},
            {"bin": "80-100", "count": 0},
        ]

        if not scores:
            dims = ["location_score", "house_quality_score", "building_age_score", "amenity_score", "price_value_score"]
            radar = None
            if includeRadar:
                radar = {
                    "rule_version": None,
                    "dimensions": dims,
                    "values": {
                        "location_score": {"avg": 0, "min": 0, "max": 0},
                        "house_quality_score": {"avg": 0, "min": 0, "max": 0},
                        "building_age_score": {"avg": 0, "min": 0, "max": 0},
                        "amenity_score": {"avg": 0, "min": 0, "max": 0},
                        "price_value_score": {"avg": 0, "min": 0, "max": 0},
                    },
                }
            return {
                "communityId": communityId,
                "periodType": periodType,
                "days": 0,
                "bins": bins,
                "scoreStats": {"min": 0, "max": 0, "avg": 0, "median": 0},
                "rule_version": None,
                "radar": radar,
            }

        vals = [float(s.overall_score_0_100) for s in scores]
        for v in vals:
            if v < 40:
                bins[0]["count"] += 1
            elif v < 60:
                bins[1]["count"] += 1
            elif v < 80:
                bins[2]["count"] += 1
            else:
                bins[3]["count"] += 1

        scoreStats = {
            "min": min(vals),
            "max": max(vals),
            "avg": sum(vals) / len(vals),
            "median": statistics.median(vals),
        }
        rule_version = scores[0].rule_version

        radar = None
        if includeRadar:
            dims = ["location_score", "house_quality_score", "building_age_score", "amenity_score", "price_value_score"]
            dim_vals = {d: [] for d in dims}
            for s in scores:
                ds = s.dimension_scores_json or {}
                for d in dims:
                    if d in ds and ds[d] is not None:
                        dim_vals[d].append(float(ds[d]))

            radar_values = {}
            for d in dims:
                arr = dim_vals[d]
                if not arr:
                    radar_values[d] = {"avg": 0, "min": 0, "max": 0}
                else:
                    radar_values[d] = {"avg": sum(arr) / len(arr), "min": min(arr), "max": max(arr)}

            radar = {
                "rule_version": rule_version,
                "dimensions": dims,
                "values": radar_values,
            }

        return {
            "communityId": communityId,
            "periodType": periodType,
            "days": 0,
            "bins": bins,
            "scoreStats": scoreStats,
            "rule_version": rule_version,
            "radar": radar,
        }


@router.get("/{communityId}/price-trend-filtered")
def community_price_trend_filtered(
    communityId: int,
    startDate: Optional[date] = Query(None),
    endDate: Optional[date] = Query(None),
    weekEnd: Optional[date] = Query(None),
    periodType: Literal["weekly", "monthly"] = Query("weekly"),
    minQualityScore: float = Query(60.0),
    maxQualityScore: Optional[float] = Query(None),
    listingType: Optional[str] = Query(None),
):
    """
    Filtered by minQualityScore on ListingQualityScore at each computed_week_end_date.
    """
    if periodType != "weekly":
        raise HTTPException(status_code=400, detail="MVP only supports weekly")

    if endDate is None:
        if weekEnd is None:
            raise HTTPException(status_code=400, detail="endDate or weekEnd is required")
        endDate = weekEnd
    if startDate is None:
        startDate = endDate - timedelta(days=90)

    with db_session() as db:
        q = (
            db.query(ListingQualityScore.computed_week_end_date)
            .join(ListingDetail, ListingDetail.listing_id == ListingQualityScore.listing_id)
            .filter(ListingDetail.community_id == communityId)
            .filter(ListingQualityScore.computed_week_end_date >= startDate)
            .filter(ListingQualityScore.computed_week_end_date <= endDate)
            .filter(ListingQualityScore.overall_score_0_100 >= minQualityScore)
        )
        if maxQualityScore is not None:
            q = q.filter(ListingQualityScore.overall_score_0_100 <= maxQualityScore)
        if listingType is not None and listingType != "all":
            q = q.filter(ListingDetail.listing_type == listingType)
        week_ends = (
            q.distinct()
            .order_by(ListingQualityScore.computed_week_end_date.asc())
            .all()
        )

        dates = [w[0] for w in week_ends if w and w[0] is not None]
        if not dates:
            return {"communityId": communityId, "periodType": periodType, "data": []}

        series: list[dict[str, Any]] = []
        for we in dates:
            rows_q = (
                db.query(ListingDetail.unit_price)
                .join(ListingQualityScore, ListingQualityScore.listing_id == ListingDetail.listing_id)
                .filter(ListingDetail.community_id == communityId)
                .filter(ListingQualityScore.computed_week_end_date == we)
                .filter(ListingQualityScore.overall_score_0_100 >= minQualityScore)
                .filter(ListingDetail.unit_price.is_not(None))
            )
            if listingType is not None and listingType != "all":
                rows_q = rows_q.filter(ListingDetail.listing_type == listingType)
            if maxQualityScore is not None:
                rows_q = rows_q.filter(ListingQualityScore.overall_score_0_100 <= maxQualityScore)
            rows = rows_q.all()
            prices = [float(r[0]) for r in rows if r and r[0] is not None]
            listing_count_sum = len(prices)
            avg_unit = (sum(prices) / listing_count_sum) if listing_count_sum else None
            median_unit = statistics.median(prices) if listing_count_sum else None
            coverage = min(1.0, float(listing_count_sum) / 30.0) if listing_count_sum else None

            period_start_date = we - timedelta(days=6)
            series.append(
                {
                    "period_start": period_start_date.isoformat(),
                    "period_end": we.isoformat(),
                    "avg_unit_price": avg_unit,
                    "median_unit_price": median_unit,
                    "listing_count": listing_count_sum,
                    "coverage_score": coverage,
                    "data_policy": "filtered_latest_non_null" if listing_count_sum else None,
                    "missingFlag": False if listing_count_sum else True,
                }
            )

        return {"communityId": communityId, "periodType": periodType, "data": series}


@router.get("/{communityId}/top-tags")
def top_tags(communityId: int, limit: int = Query(20, ge=1, le=200)):
    with db_session() as db:
        # use recent 30 days scores as MVP
        end = date.today()
        start = end - timedelta(days=30)
        scores = (
            db.query(ListingQualityScore.advantages_json, ListingQualityScore.disadvantages_json)
            .join(ListingDetail, ListingDetail.listing_id == ListingQualityScore.listing_id)
            .filter(ListingDetail.community_id == communityId)
            .filter(ListingQualityScore.computed_week_end_date >= start)
            .filter(ListingQualityScore.computed_week_end_date <= end)
            .all()
        )

        adv_map: dict[str, int] = {}
        dis_map: dict[str, int] = {}
        # MVP：用 confidence 作为 scoreHint
        adv_hint_score: dict[str, float] = {}
        dis_hint_score: dict[str, float] = {}

        for adv, dis in scores:
            for tag in (adv or []) or []:
                label = tag.get("label")
                if not label:
                    continue
                adv_map[label] = adv_map.get(label, 0) + 1
                if "confidence" in tag:
                    adv_hint_score[label] = float(tag["confidence"])
            for tag in (dis or []) or []:
                label = tag.get("label")
                if not label:
                    continue
                dis_map[label] = dis_map.get(label, 0) + 1
                if "confidence" in tag:
                    dis_hint_score[label] = float(tag["confidence"])

        advantages = [{"label": k, "count": v, "scoreHint": adv_hint_score.get(k)} for k, v in sorted(adv_map.items(), key=lambda x: x[1], reverse=True)[:limit]]
        disadvantages = [{"label": k, "count": v, "scoreHint": dis_hint_score.get(k)} for k, v in sorted(dis_map.items(), key=lambda x: x[1], reverse=True)[:limit]]

        return {"communityId": communityId, "advantages": advantages, "disadvantages": disadvantages}
