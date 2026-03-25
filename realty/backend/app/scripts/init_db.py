from __future__ import annotations

from realty.backend.app.db.session import engine
from realty.backend.app.db.base import Base


def main() -> None:
    Base.metadata.create_all(bind=engine)
    print("DB schema created (if not exists).")


if __name__ == "__main__":
    main()
