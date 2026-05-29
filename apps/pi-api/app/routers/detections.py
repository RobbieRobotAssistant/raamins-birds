import sqlite3

from fastapi import APIRouter, Depends, Query

from ..db import TS, get_connection, window_clause
from ..deps import valid_window
from ..models import Detection
from ..util import iso

router = APIRouter(prefix="/api", tags=["detections"])


@router.get("/detections", response_model=list[Detection])
def list_detections(
    window: str = Depends(valid_window),
    limit: int = Query(200, ge=1, le=1000),
    conn: sqlite3.Connection = Depends(get_connection),
) -> list[Detection]:
    """Recent detections, newest first, within the time window."""
    predicate, params = window_clause(window)
    where = f"WHERE {predicate}" if predicate else ""
    rows = conn.execute(
        f"""
        SELECT rowid AS rowid, Sci_Name, Com_Name, Confidence, Date, Time
        FROM detections
        {where}
        ORDER BY {TS} DESC
        LIMIT ?
        """,
        [*params, limit],
    ).fetchall()

    return [
        Detection(
            rowid=r["rowid"],
            sci_name=r["Sci_Name"],
            com_name=r["Com_Name"],
            confidence=r["Confidence"],
            date=r["Date"],
            time=r["Time"],
            timestamp=iso(r["Date"], r["Time"]),
            recording_url=f"/api/recordings/{r['rowid']}",
        )
        for r in rows
    ]
