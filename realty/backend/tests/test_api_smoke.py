from __future__ import annotations

from fastapi.testclient import TestClient

from realty.backend.app.main import app


client = TestClient(app)


def test_runtime_endpoint_ok() -> None:
    r = client.get("/api/v1/runtime")
    assert r.status_code == 200
    data = r.json()
    assert "database_url" in data
    assert "rule_version_listing" in data


def test_stats_endpoints_basic_flow() -> None:
    # find a valid weekEnd via periods
    periods = client.get("/api/v1/periods", params={"type": "weekly", "cityId": 1, "limit": 5}).json()
    items = periods.get("items", [])
    week_end = items[-1] if items else "2026-03-23"

    r1 = client.get(
        "/api/v1/stats/district-compare",
        params={"cityId": 1, "periodType": "weekly", "weekEnd": week_end},
    )
    assert r1.status_code == 200
    dc = r1.json()
    assert dc.get("items") is not None

    r2 = client.get(
        "/api/v1/stats/community-ranking",
        params={"cityId": 1, "periodType": "weekly", "weekEnd": week_end, "metric": "avg_unit_price", "top": 20},
    )
    assert r2.status_code == 200
    cr = r2.json()
    assert cr.get("data") is not None
