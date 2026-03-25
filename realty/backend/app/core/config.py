import os
from typing import Optional, List


class Settings:
    """
    Runtime configuration.
    Defaults are chosen for local development using SQLite.
    """

    def __init__(self) -> None:
        # Important: make sqlite path stable and independent of current working directory.
        repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
        default_db_path = os.path.join(repo_root, "realty.db")
        default_db_url = "sqlite:///" + default_db_path.replace("\\", "/")

        self.database_url: str = os.getenv("DATABASE_URL", default_db_url)
        self.redis_url: Optional[str] = os.getenv("REDIS_URL")
        self.rule_version_listing: str = os.getenv("RULE_VERSION_LISTING", "listing_quality_score_v1")
        self.rule_version_school: str = os.getenv("RULE_VERSION_SCHOOL", "school_future_score_v1")
        self.cors_allow_origins: List[str] = [
            o.strip() for o in os.getenv("CORS_ALLOW_ORIGINS", "*").split(",") if o.strip()
        ]


settings = Settings()
