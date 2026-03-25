from __future__ import annotations

from datetime import datetime
from typing import Any
from typing import Optional

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    JSON,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from realty.backend.app.db.base import Base


def utcnow() -> datetime:
    return datetime.utcnow()


JSONType = JSON


class City(Base):
    __tablename__ = "t_city"

    city_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    city_code: Mapped[str] = mapped_column(String(16), unique=True, nullable=False)
    city_name: Mapped[str] = mapped_column(String(64), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)


class CommunityOfficial(Base):
    __tablename__ = "community_official"

    community_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    city_id: Mapped[int] = mapped_column(ForeignKey("t_city.city_id"), nullable=False, index=True)
    community_name: Mapped[str] = mapped_column(String(255), nullable=False)

    # 简化：先不强制 region/district 主表，先落字段用于对比展示
    district_name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    region_name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)

    __table_args__ = (
        UniqueConstraint("city_id", "community_name", name="uq_city_community_name"),
    )


class SchoolStandardized(Base):
    __tablename__ = "school_standardized"

    school_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    city_id: Mapped[int] = mapped_column(ForeignKey("t_city.city_id"), nullable=False, index=True)

    official_name: Mapped[str] = mapped_column(String(255), nullable=False)
    display_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    school_type: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)

    # 省一级 / 市一级（用于筛选）
    province_key_flag: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    city_key_flag: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)

    __table_args__ = (UniqueConstraint("city_id", "official_name", name="uq_city_school_name"),)


class SchoolIndicatorSnapshot(Base):
    __tablename__ = "school_indicator_snapshot"

    indicator_snapshot_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    school_id: Mapped[int] = mapped_column(ForeignKey("school_standardized.school_id"), nullable=False, index=True)
    indicator_date: Mapped[Date] = mapped_column(Date, nullable=False, index=True)

    # 输入特征（V1 规则需要）
    latest_level_score_raw: Mapped[Optional[float]] = mapped_column(Float, nullable=True)  # 0-100
    group_school_flag_raw: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    group_school_strength_raw: Mapped[Optional[float]] = mapped_column(Float, nullable=True)  # 0-100
    district_balance_level_raw: Mapped[Optional[float]] = mapped_column(Float, nullable=True)  # 0-100

    # 若缺失，可用 latest - previous 推导
    trend_delta_raw: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    source: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)


class SchoolFutureScore(Base):
    __tablename__ = "school_future_score"

    score_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    school_id: Mapped[int] = mapped_column(ForeignKey("school_standardized.school_id"), nullable=False, index=True)
    rule_version: Mapped[str] = mapped_column(String(32), nullable=False, index=True)

    trend_score_0_100: Mapped[float] = mapped_column(Float, nullable=False, default=50.0)
    confidence_score: Mapped[float] = mapped_column(Float, nullable=False, default=1.0)

    feature_contrib_json: Mapped[Any] = mapped_column(JSONType, nullable=True)
    explain_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    province_key_flag: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    city_key_flag: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)

    calculated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)

    __table_args__ = (
        UniqueConstraint("school_id", "rule_version", name="uq_school_rule_version_latest"),
    )


class ListingDetail(Base):
    __tablename__ = "listing_detail"

    listing_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    city_id: Mapped[int] = mapped_column(ForeignKey("t_city.city_id"), nullable=False, index=True)
    community_id: Mapped[int] = mapped_column(ForeignKey("community_official.community_id"), nullable=False, index=True)

    source: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    source_listing_id: Mapped[Optional[str]] = mapped_column(String(255), unique=True, nullable=True)
    source_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # listing_type: second_hand (二手) / new_house (新房)
    # 用于同一套 UI/图表区分不同房源类型，并在 filtered 接口中保持一致性。
    listing_type: Mapped[Optional[str]] = mapped_column(String(16), index=True, nullable=True)

    title: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    total_price_10k: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    unit_price: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    area_sqm: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    bedrooms: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    bathrooms: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    orientation: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    floor_number: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    has_elevator: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    decorate_type: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    build_year: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    nearest_metro_distance_m: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    # school_ids 存 JSON 数组（MVP）
    school_ids_json: Mapped[Any] = mapped_column(JSONType, nullable=True)

    tags_json: Mapped[Any] = mapped_column(JSONType, nullable=True)

    is_valid: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    crawl_date: Mapped[Date] = mapped_column(Date, nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)


class PriceSnapshotWeekly(Base):
    __tablename__ = "price_snapshot_weekly"

    snapshot_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    community_id: Mapped[int] = mapped_column(ForeignKey("community_official.community_id"), nullable=False, index=True)
    week_start_date: Mapped[Date] = mapped_column(Date, nullable=False, index=True)
    week_end_date: Mapped[Date] = mapped_column(Date, nullable=False, index=True)

    avg_unit_price: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    median_unit_price: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    listing_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    coverage_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    data_policy: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    source_priority_used: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)

    __table_args__ = (
        UniqueConstraint("community_id", "week_end_date", name="uq_community_week_end"),
    )


class ListingQualityScore(Base):
    __tablename__ = "listing_quality_score"

    score_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    listing_id: Mapped[int] = mapped_column(ForeignKey("listing_detail.listing_id"), nullable=False, index=True)
    rule_version: Mapped[str] = mapped_column(String(32), nullable=False, index=True)

    computed_week_end_date: Mapped[Date] = mapped_column(Date, nullable=False, index=True)
    confidence_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    overall_score_0_100: Mapped[float] = mapped_column(Float, nullable=False, default=50.0)

    # 维度分
    dimension_scores_json: Mapped[Any] = mapped_column(JSONType, nullable=True)
    advantages_json: Mapped[Any] = mapped_column(JSONType, nullable=True)
    disadvantages_json: Mapped[Any] = mapped_column(JSONType, nullable=True)
    explain_json: Mapped[Any] = mapped_column(JSONType, nullable=True)

    # 为筛选服务（避免 JSON 查询）
    school_future_score_max: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    school_province_key_flag_any: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    school_city_key_flag_any: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)

    computed_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)

    __table_args__ = (UniqueConstraint("listing_id", "computed_week_end_date", name="uq_listing_week_end"),)
