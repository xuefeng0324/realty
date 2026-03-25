from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Query, HTTPException

from pydantic import BaseModel
from typing import Optional

from realty.backend.app.db.session import db_session
from realty.backend.app.models import SchoolStandardized, SchoolFutureScore


router = APIRouter(prefix="/api/v1/schools", tags=["schools"])


class SchoolSearchItem(BaseModel):
    school_id: int
    official_name: str
    display_name: Optional[str]
    school_type: Optional[str]
    province_key_flag: Optional[bool]
    city_key_flag: Optional[bool]


@router.get("/search")
def search_schools(cityId: int, q: str = Query(..., min_length=1, max_length=100)):
    qq = f"%{q}%"
    with db_session() as db:
        rows = (
            db.query(SchoolStandardized)
            .filter(SchoolStandardized.city_id == cityId)
            .filter(SchoolStandardized.official_name.like(qq) | (SchoolStandardized.display_name != None and SchoolStandardized.display_name.like(qq)))
            .limit(30)
            .all()
        )
        return {
            "cityId": cityId,
            "q": q,
            "items": [
                {
                    "school_id": s.school_id,
                    "official_name": s.official_name,
                    "display_name": s.display_name,
                    "school_type": s.school_type,
                    "province_key_flag": s.province_key_flag,
                    "city_key_flag": s.city_key_flag,
                }
                for s in rows
            ],
        }


@router.get("/{schoolId}/future-score")
def school_future_score(schoolId: int, ruleVersion: Optional[str] = None):
    with db_session() as db:
        q = db.query(SchoolFutureScore).filter(SchoolFutureScore.school_id == schoolId)
        if ruleVersion:
            q = q.filter(SchoolFutureScore.rule_version == ruleVersion)
        row = q.order_by(SchoolFutureScore.calculated_at.desc()).first()
        if not row:
            raise HTTPException(status_code=404, detail="No future score")
        return {
            "school_id": schoolId,
            "rule_version": row.rule_version,
            "trend_score_0_100": float(row.trend_score_0_100),
            "confidence_score": float(row.confidence_score) if row.confidence_score is not None else None,
            "feature_contrib_json": row.feature_contrib_json,
            "explain_text": row.explain_text,
        }
