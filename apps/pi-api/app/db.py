from __future__ import annotations

import sqlite3
from typing import Iterator

from .config import get_settings

# window token -> seconds of look-back. "all" means no time filter.
WINDOW_SECONDS: dict[str, int | None] = {
    "1h": 3600,
    "12h": 12 * 3600,
    "24h": 24 * 3600,
    "7d": 7 * 24 * 3600,
    "all": None,
}

# window token -> histogram bucket width in seconds, for /api/stats/by-period.
WINDOW_BUCKET_SECONDS: dict[str, int] = {
    "1h": 300,        # 5 minutes
    "12h": 1800,      # 30 minutes
    "24h": 3600,      # 1 hour
    "7d": 86400,      # 1 day
    "all": 86400,     # 1 day
}

# A single detection timestamp expression reused across queries.
TS = "(Date || ' ' || Time)"


def get_connection() -> Iterator[sqlite3.Connection]:
    """FastAPI dependency yielding a read-only SQLite connection.

    Opened with mode=ro so this process can never mutate BirdNET-Pi's DB,
    even by accident. A fresh connection per request keeps things simple;
    traffic is low because the frontend caches aggressively.
    """
    settings = get_settings()
    uri = f"file:{settings.birds_db_path}?mode=ro"
    conn = sqlite3.connect(uri, uri=True, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()


def window_clause(window: str) -> tuple[str, list[str]]:
    """Return (sql_fragment, params) restricting rows to the time window.

    The fragment is either an empty string ("all") or a WHERE-ready predicate
    beginning with the column expression. Caller composes it into the query.
    """
    seconds = WINDOW_SECONDS.get(window)
    if seconds is None:
        return "", []
    # Compare against now in localtime; BirdNET-Pi stores local Date/Time.
    cutoff = f"-{seconds} seconds"
    return (
        f"datetime({TS}) >= datetime('now', 'localtime', ?)",
        [cutoff],
    )
