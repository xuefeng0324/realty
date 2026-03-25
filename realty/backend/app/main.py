from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from realty.backend.app.core.config import settings
from realty.backend.app.api.v1 import stats as stats_router
from realty.backend.app.api.v1 import communities as communities_router
from realty.backend.app.api.v1 import listings as listings_router
from realty.backend.app.api.v1 import schools as schools_router
from realty.backend.app.api.v1 import meta as meta_router


app = FastAPI(
    title="Realty Quality & Price Analytics (MVP)",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_allow_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(stats_router.router)
app.include_router(communities_router.router)
app.include_router(listings_router.router)
app.include_router(schools_router.router)
app.include_router(meta_router.router)


@app.get("/healthz")
def healthz():
    return {"ok": True}
