from fastapi import HTTPException, Query

from .db import WINDOW_SECONDS


def valid_window(
    window: str = Query("24h", description="One of: 1h, 12h, 24h, 7d, all"),
) -> str:
    if window not in WINDOW_SECONDS:
        raise HTTPException(
            status_code=400,
            detail=f"invalid window '{window}'; expected one of {list(WINDOW_SECONDS)}",
        )
    return window
