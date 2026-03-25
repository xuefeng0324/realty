from __future__ import annotations

from datetime import date, timedelta
from typing import Any, Dict, Literal, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from sqlalchemy import and_, or_

from realty.backend.app.db.session import db_session
from realty.backend.app.models import ListingDetail, ListingQualityScore


router = APIRouter(prefix="/api/v1/listings", tags=["listings"])


class ListingSort(BaseModel):
    field: Literal["overall_score", "price_value_score", "latest_price", "unit_price"] = "overall_score"
    direction: Literal["asc", "desc"] = "desc"


class PriceAreaRange(BaseModel):
    min: float
    max: float


class ListingFilterRequest(BaseModel):
    cityId: Optional[int] = None
    communityId: Optional[int] = None
    periodType: Literal["weekly", "monthly"] = "weekly"
    weekEnd: Optional[date] = None
    page: int = 1
    pageSize: int = 20

    filters: Dict[str, Any] = Field(default_factory=dict)
    sort: ListingSort = Field(default_factory=ListingSort)


@router.post("/filter")
def filter_listings(req: ListingFilterRequest):
    """
    MVP：
    - 优先基于 listing_quality_score 表做筛选/排序（避免 JSON 复杂查询）
    - 学校关键等级通过 listing_quality_score 中的 school_province_key_flag_any / school_city_key_flag_any
    - 学校未来趋势分阈值通过 school_future_score_max
    """
    if req.periodType != "weekly":
        raise HTTPException(status_code=400, detail="MVP only supports weekly")

    week_end = req.weekEnd or (date.today())
    page = max(1, int(req.page))
    page_size = min(100, max(1, int(req.pageSize)))
    offset = (page - 1) * page_size

    f = req.filters or {}

    price_range = f.get("priceRange")  # expect [min,max] in 10k? contract example uses [60,120]
    area_range = f.get("areaRange")
    orientation = f.get("orientation")
    decorate_type = f.get("decorateType")
    hasElevator = f.get("hasElevator")
    listing_type = f.get("listingType") or f.get("listing_type")
    minQualityScore = f.get("minQualityScore")
    maxQualityScore = f.get("maxQualityScore")
    minSchoolFutureScore = f.get("minSchoolFutureScore")
    schoolProvinceKeyFlag = f.get("schoolProvinceKeyFlag")
    schoolCityKeyFlag = f.get("schoolCityKeyFlag")

    sort_field = (req.sort.field or "overall_score").strip()
    sort_dir = req.sort.direction

    with db_session() as db:
        q = (
            db.query(ListingDetail, ListingQualityScore)
            .join(ListingQualityScore, ListingQualityScore.listing_id == ListingDetail.listing_id)
        )

        q = q.filter(ListingQualityScore.computed_week_end_date == week_end)

        if req.cityId is not None:
            q = q.filter(ListingDetail.city_id == req.cityId)
        if req.communityId is not None:
            q = q.filter(ListingDetail.community_id == req.communityId)
        if req.communityId is None and f.get("communityId") is not None:
            q = q.filter(ListingDetail.community_id == int(f["communityId"]))

        if price_range and isinstance(price_range, list) and len(price_range) == 2:
            q = q.filter(ListingDetail.total_price_10k >= float(price_range[0]), ListingDetail.total_price_10k <= float(price_range[1]))
        if area_range and isinstance(area_range, list) and len(area_range) == 2:
            q = q.filter(ListingDetail.area_sqm >= float(area_range[0]), ListingDetail.area_sqm <= float(area_range[1]))
        if orientation:
            if isinstance(orientation, list):
                q = q.filter(ListingDetail.orientation.in_(orientation))
            else:
                q = q.filter(ListingDetail.orientation == orientation)
        if decorate_type:
            if isinstance(decorate_type, list):
                q = q.filter(ListingDetail.decorate_type.in_(decorate_type))
            else:
                q = q.filter(ListingDetail.decorate_type == decorate_type)
        if listing_type and listing_type != "all":
            q = q.filter(ListingDetail.listing_type == listing_type)
        if hasElevator is not None:
            q = q.filter(ListingDetail.has_elevator == hasElevator)
        if minQualityScore is not None:
            q = q.filter(ListingQualityScore.overall_score_0_100 >= float(minQualityScore))
        if maxQualityScore is not None:
            q = q.filter(ListingQualityScore.overall_score_0_100 <= float(maxQualityScore))
        if minSchoolFutureScore is not None:
            q = q.filter(ListingQualityScore.school_future_score_max >= float(minSchoolFutureScore))
        if schoolProvinceKeyFlag is not None:
            q = q.filter(ListingQualityScore.school_province_key_flag_any == bool(schoolProvinceKeyFlag))
        if schoolCityKeyFlag is not None:
            q = q.filter(ListingQualityScore.school_city_key_flag_any == bool(schoolCityKeyFlag))

        # sort
        if sort_field == "overall_score":
            col = ListingQualityScore.overall_score_0_100
        elif sort_field == "price_value_score":
            # price_value_score lives in dimension_scores_json; MVP: ignore sort or fallback by overall
            col = ListingQualityScore.overall_score_0_100
        else:
            col = ListingQualityScore.overall_score_0_100

        if sort_dir == "asc":
            q = q.order_by(col.asc())
        else:
            q = q.order_by(col.desc())

        rows = q.offset(offset).limit(page_size).all()
        total = q.count()

        items = []
        for l, s in rows:
            items.append(
                {
                    "listing_id": l.listing_id,
                    "title": l.title,
                    "listing_type": l.listing_type,
                    "price_total": l.total_price_10k,
                    "unit_price": l.unit_price,
                    "area_sqm": l.area_sqm,
                    "orientation": l.orientation,
                    "floor_number": l.floor_number,
                    "decorate_type": l.decorate_type,
                    "has_elevator": l.has_elevator,
                    "build_year": l.build_year,
                    "quality_score": float(s.overall_score_0_100),
                    "advantages": s.advantages_json or [],
                    "disadvantages": s.disadvantages_json or [],
                    "explain_preview": {"overall_score": float(s.overall_score_0_100), "dimension_scores": s.dimension_scores_json or {}},
                    "url": l.source_url,
                }
            )

        return {"communityId": req.communityId, "total": total, "page": page, "pageSize": page_size, "rule_version": "listing_quality_score_v1", "items": items}


@router.get("/{listingId}")
def get_listing_detail(listingId: int, weekEnd: Optional[date] = None):
    """
    Return full listing detail with full explain_json.
    If weekEnd is provided, prefer that score record;
    otherwise return latest computed score for this listing.
    """
    with db_session() as db:
        listing = db.query(ListingDetail).filter(ListingDetail.listing_id == listingId).first()
        if listing is None:
            raise HTTPException(status_code=404, detail="Listing not found")

        score_q = db.query(ListingQualityScore).filter(ListingQualityScore.listing_id == listingId)
        if weekEnd is not None:
            score_q = score_q.filter(ListingQualityScore.computed_week_end_date == weekEnd)
        score = score_q.order_by(ListingQualityScore.computed_week_end_date.desc()).first()
        if score is None:
            raise HTTPException(status_code=404, detail="Listing score not found")

        return {
            "listing": {
                "listing_id": listing.listing_id,
                "city_id": listing.city_id,
                "community_id": listing.community_id,
                "title": listing.title,
                "source": listing.source,
                "source_listing_id": listing.source_listing_id,
                "source_url": listing.source_url,
                "total_price_10k": listing.total_price_10k,
                "unit_price": listing.unit_price,
                "area_sqm": listing.area_sqm,
                "listing_type": listing.listing_type,
                "bedrooms": listing.bedrooms,
                "bathrooms": listing.bathrooms,
                "orientation": listing.orientation,
                "floor_number": listing.floor_number,
                "has_elevator": listing.has_elevator,
                "decorate_type": listing.decorate_type,
                "build_year": listing.build_year,
                "nearest_metro_distance_m": listing.nearest_metro_distance_m,
                "school_ids_json": listing.school_ids_json,
                "tags_json": listing.tags_json,
                "crawl_date": listing.crawl_date.isoformat() if listing.crawl_date else None,
            },
            "score": {
                "rule_version": score.rule_version,
                "computed_week_end_date": score.computed_week_end_date.isoformat() if score.computed_week_end_date else None,
                "overall_score_0_100": score.overall_score_0_100,
                "dimension_scores_json": score.dimension_scores_json or {},
                "advantages_json": score.advantages_json or [],
                "disadvantages_json": score.disadvantages_json or [],
                "explain_json": score.explain_json or {},
                "school_future_score_max": score.school_future_score_max,
                "school_province_key_flag_any": score.school_province_key_flag_any,
                "school_city_key_flag_any": score.school_city_key_flag_any,
            },
        }
