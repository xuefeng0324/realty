from __future__ import annotations

import argparse
import ast
import csv
import re
from datetime import date
from typing import Any, Dict, Optional

from realty.backend.app.db.session import db_session
from realty.backend.app.models import City, CommunityOfficial, ListingDetail, SchoolStandardized


def pick(row: Dict[str, Any], candidates: list[str]) -> Optional[str]:
    for k in candidates:
        if k in row and row[k] not in (None, ""):
            return str(row[k]).strip()
    return None


def parse_float(v: Optional[str]) -> Optional[float]:
    if v is None:
        return None
    s = str(v).strip()
    if not s:
        return None
    s = s.replace(",", "")
    s = re.sub(r"[^\d.\-]", "", s)
    if not s:
        return None
    try:
        return float(s)
    except Exception:
        return None


def parse_int(v: Optional[str]) -> Optional[int]:
    f = parse_float(v)
    if f is None:
        return None
    return int(round(f))


def parse_bool(v: Optional[str]) -> Optional[bool]:
    if v is None:
        return None
    s = str(v).strip().lower()
    if s in ("1", "true", "yes", "y", "是", "有"):
        return True
    if s in ("0", "false", "no", "n", "否", "无"):
        return False
    return None


def parse_tags(v: Optional[str]) -> list[str]:
    if v is None:
        return []
    s = str(v).strip()
    if not s:
        return []
    # Handle python-list-like tags from xjkj123 dataset:
    # "[['vr', 'VR房源'], ['taxfree', '房本满五年']]"
    try:
        obj = ast.literal_eval(s)
        tags: list[str] = []
        if isinstance(obj, list):
            for item in obj:
                if isinstance(item, (list, tuple)):
                    if len(item) >= 2 and item[1]:
                        tags.append(str(item[1]).strip())
                    elif len(item) >= 1 and item[0]:
                        tags.append(str(item[0]).strip())
                elif isinstance(item, str):
                    tags.append(item.strip())
        if tags:
            return [t for t in tags if t]
    except Exception:
        pass

    parts = re.split(r"[,|;/，；\s]+", s)
    return [p for p in (x.strip() for x in parts) if p]


def parse_bedrooms(title: Optional[str]) -> Optional[int]:
    if not title:
        return None
    m = re.search(r"(\d+)\s*室", title)
    if m:
        return int(m.group(1))
    return None


def parse_bathrooms(title: Optional[str]) -> Optional[int]:
    if not title:
        return None
    m = re.search(r"(\d+)\s*卫", title)
    if m:
        return int(m.group(1))
    return None


def parse_school_names(row: Dict[str, Any]) -> list[str]:
    names: list[str] = []

    school_name = pick(row, ["schoolName", "school_name"])
    if school_name:
        for seg in re.split(r"[,|;/，；]+", school_name):
            seg = seg.strip()
            if seg:
                names.append(seg)

    school_arr = pick(row, ["schoolArr", "school_arr"])
    if school_arr:
        try:
            obj = ast.literal_eval(school_arr)
            if isinstance(obj, list):
                for item in obj:
                    if isinstance(item, str):
                        v = item.strip()
                        if v:
                            names.append(v)
                    elif isinstance(item, (list, tuple)):
                        for v in item:
                            if isinstance(v, str) and v.strip():
                                names.append(v.strip())
                    elif isinstance(item, dict):
                        for k in ("name", "schoolName", "school_name"):
                            v = item.get(k)
                            if isinstance(v, str) and v.strip():
                                names.append(v.strip())
        except Exception:
            pass

    # normalize and dedupe
    cleaned = []
    seen = set()
    for n in names:
        n2 = re.sub(r"\s+", " ", n).strip()
        if not n2:
            continue
        if n2 in seen:
            continue
        seen.add(n2)
        cleaned.append(n2)
    return cleaned


def extract_meter_from_text(text: str) -> Optional[int]:
    s = text.strip()
    if not s:
        return None
    m_km = re.search(r"(\d+(?:\.\d+)?)\s*公里", s)
    if m_km:
        return int(round(float(m_km.group(1)) * 1000))
    m_m = re.search(r"(\d+(?:\.\d+)?)\s*米", s)
    if m_m:
        return int(round(float(m_m.group(1))))
    # fallback: plain number likely meters
    m_num = re.search(r"(\d{2,5})", s)
    if m_num:
        return int(m_num.group(1))
    return None


def parse_subway_distance_m(row: Dict[str, Any]) -> Optional[int]:
    # explicit structured columns first
    direct = parse_int(pick(row, ["nearest_metro_distance_m", "metro_distance_m", "subwayDistance"]))
    if direct is not None:
        return direct

    candidates: list[int] = []

    subway_info = pick(row, ["subwayInfo", "subway_info"])
    if subway_info:
        # raw text parse
        d = extract_meter_from_text(subway_info)
        if d is not None:
            candidates.append(d)

        # list/dict parse
        try:
            obj = ast.literal_eval(subway_info)
            stack = [obj]
            while stack:
                cur = stack.pop()
                if isinstance(cur, dict):
                    for k, v in cur.items():
                        if isinstance(v, (dict, list, tuple)):
                            stack.append(v)
                        else:
                            if isinstance(v, str):
                                d2 = extract_meter_from_text(v)
                                if d2 is not None:
                                    candidates.append(d2)
                            elif isinstance(v, (int, float)) and ("distance" in str(k).lower() or "meter" in str(k).lower()):
                                candidates.append(int(round(float(v))))
                elif isinstance(cur, (list, tuple)):
                    for v in cur:
                        if isinstance(v, (dict, list, tuple)):
                            stack.append(v)
                        elif isinstance(v, str):
                            d3 = extract_meter_from_text(v)
                            if d3 is not None:
                                candidates.append(d3)
        except Exception:
            pass

    if not candidates:
        return None
    # nearest metro distance
    return min(candidates)


def get_or_create_city(city_code: str, city_name: str) -> int:
    with db_session() as db:
        city = db.query(City).filter(City.city_code == city_code).first()
        if city is None:
            city = City(city_code=city_code, city_name=city_name, is_active=True)
            db.add(city)
            db.flush()
        return city.city_id


def get_or_create_community(city_id: int, name: str, district: Optional[str], region: Optional[str]) -> int:
    with db_session() as db:
        c = (
            db.query(CommunityOfficial)
            .filter(CommunityOfficial.city_id == city_id, CommunityOfficial.community_name == name)
            .first()
        )
        if c is None:
            c = CommunityOfficial(
                city_id=city_id,
                community_name=name,
                district_name=district,
                region_name=region,
            )
            db.add(c)
            db.flush()
        else:
            if district and not c.district_name:
                c.district_name = district
            if region and not c.region_name:
                c.region_name = region
        return c.community_id


def get_or_create_school(city_id: int, school_name: str) -> int:
    with db_session() as db:
        s = (
            db.query(SchoolStandardized)
            .filter(SchoolStandardized.city_id == city_id, SchoolStandardized.official_name == school_name)
            .first()
        )
        if s is None:
            s = SchoolStandardized(
                city_id=city_id,
                official_name=school_name,
                display_name=school_name,
                school_type=None,
                province_key_flag=None,
                city_key_flag=None,
            )
            db.add(s)
            db.flush()
        return s.school_id


def upsert_listing(
    city_id: int,
    community_id: int,
    row: Dict[str, Any],
    source: str,
    listing_type: str,
    default_crawl_date: date,
    school_ids: list[int],
) -> bool:
    resolved_listing_type = listing_type
    # Lianjia spider 导出的 DetailInfo_export.csv 里会带 isNew（1/0）
    # 用它自动区分新房/二手房，避免你手工准备两份 CSV。
    is_new_raw = pick(row, ["isNew", "is_new"])
    if is_new_raw is not None:
        is_new = parse_bool(is_new_raw)
        if is_new is True:
            resolved_listing_type = "new_house"
        elif is_new is False:
            resolved_listing_type = "second_hand"
    if resolved_listing_type not in ("second_hand", "new_house"):
        resolved_listing_type = "second_hand"
    source_listing_id = pick(row, ["source_listing_id", "houseId", "listing_id", "id"])
    source_url = pick(row, ["source_url", "url", "detail_url", "houseUrl", "viewUrl"])
    title = pick(row, ["title", "house_title", "name"])
    district = pick(row, ["district_name", "districtName", "district"])
    region = pick(row, ["region_name", "regionName", "bizcircle", "region"])

    total_price_10k = parse_float(pick(row, ["total_price_10k", "totalPrice", "price_total", "price"]))
    unit_price = parse_float(pick(row, ["unit_price", "unitPrice"]))
    area_sqm = parse_float(pick(row, ["area_sqm", "area", "buildingArea", "square"]))
    orientation = pick(row, ["orientation", "toward"])
    floor_number = pick(row, ["floor_number", "floor", "floorStat"])
    decorate_type = pick(row, ["decorate_type", "decorateType"])
    build_year = parse_int(pick(row, ["build_year", "buildYear"]))
    nearest_metro_distance_m = parse_subway_distance_m(row)
    has_elevator = parse_bool(pick(row, ["has_elevator", "elevator"]))
    tags = parse_tags(pick(row, ["tags_json", "tags"]))
    crawl_date_raw = pick(row, ["crawl_date", "date", "crawlDate"])
    crawl = default_crawl_date
    if crawl_date_raw:
        try:
            crawl = date.fromisoformat(str(crawl_date_raw)[:10])
        except Exception:
            crawl = default_crawl_date

    with db_session() as db:
        existing = None
        if source_listing_id:
            existing = (
                db.query(ListingDetail)
                .filter(ListingDetail.source_listing_id == source_listing_id)
                .first()
            )

        if existing is None:
            obj = ListingDetail(
                city_id=city_id,
                community_id=community_id,
                source=source,
                source_listing_id=source_listing_id,
                source_url=source_url,
                listing_type=resolved_listing_type,
                title=title,
                total_price_10k=total_price_10k,
                unit_price=unit_price,
                area_sqm=area_sqm,
                bedrooms=parse_bedrooms(title),
                bathrooms=parse_bathrooms(title),
                orientation=orientation,
                floor_number=floor_number,
                has_elevator=has_elevator,
                decorate_type=decorate_type,
                build_year=build_year,
                nearest_metro_distance_m=nearest_metro_distance_m,
                school_ids_json=school_ids,
                tags_json=tags,
                is_valid=True,
                crawl_date=crawl,
            )
            db.add(obj)
            return True

        existing.community_id = community_id
        existing.source = source
        existing.source_url = source_url or existing.source_url
        existing.listing_type = resolved_listing_type
        existing.title = title or existing.title
        existing.total_price_10k = total_price_10k
        existing.unit_price = unit_price
        existing.area_sqm = area_sqm
        existing.bedrooms = parse_bedrooms(title) if title else existing.bedrooms
        existing.bathrooms = parse_bathrooms(title) if title else existing.bathrooms
        existing.orientation = orientation
        existing.floor_number = floor_number
        existing.has_elevator = has_elevator
        existing.decorate_type = decorate_type
        existing.build_year = build_year
        existing.nearest_metro_distance_m = nearest_metro_distance_m
        existing.school_ids_json = school_ids
        existing.tags_json = tags
        existing.crawl_date = crawl
        return False


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--csv", required=True, help="CSV file path")
    parser.add_argument("--cityCode", default="sz")
    parser.add_argument("--cityName", default="Shenzhen")
    parser.add_argument("--source", default="lianjia_csv")
    parser.add_argument("--listingType", default="second_hand", help="second_hand / new_house")
    parser.add_argument("--crawlDate", default=None, help="Default crawl date YYYY-MM-DD")
    args = parser.parse_args()

    default_crawl_date = date.today() if not args.crawlDate else date.fromisoformat(args.crawlDate)
    city_id = get_or_create_city(args.cityCode, args.cityName)

    inserted = 0
    updated = 0
    skipped = 0

    with open(args.csv, "r", encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            community_name = pick(row, ["community_name", "communityName", "xiaoqu", "community"])
            if not community_name:
                skipped += 1
                continue
            district = pick(row, ["district_name", "districtName", "district"])
            region = pick(row, ["region_name", "regionName", "bizcircle", "region"])
            community_id = get_or_create_community(city_id, community_name, district, region)
            school_names = parse_school_names(row)
            school_ids = [get_or_create_school(city_id, n) for n in school_names]
            is_insert = upsert_listing(
                city_id=city_id,
                community_id=community_id,
                row=row,
                source=args.source,
                listing_type=args.listingType,
                default_crawl_date=default_crawl_date,
                school_ids=school_ids,
            )
            if is_insert:
                inserted += 1
            else:
                updated += 1

    print(f"CSV import done: inserted={inserted}, updated={updated}, skipped={skipped}, city_id={city_id}")


if __name__ == "__main__":
    main()
