import sqlite3

from fastapi import APIRouter, Depends, Query

from ..db import TS, WINDOW_BUCKET_SECONDS, get_connection, window_clause
from ..deps import valid_window
from ..models import FirstDetection, PeriodBucket, TopSpecies
from ..util import epoch_to_iso

router = APIRouter(prefix="/api/stats", tags=["stats"])


@router.get("/top-species", response_model=list[TopSpecies])
def top_species(
    window: str = Depends(valid_window),
    limit: int = Query(10, ge=1, le=100),
    conn: sqlite3.Connection = Depends(get_connection),
) -> list[TopSpecies]:
    """Most-detected species within the window."""
    predicate, params = window_clause(window)
    where = f"WHERE {predicate}" if predicate else ""
    rows = conn.execute(
        f"""
        SELECT Sci_Name AS sci_name, MAX(Com_Name) AS com_name, COUNT(*) AS count
        FROM detections
        {where}
        GROUP BY Sci_Name
        ORDER BY count DESC, com_name ASC
        LIMIT ?
        """,
        [*params, limit],
    ).fetchall()
    return [TopSpecies(**dict(r)) for r in rows]


@router.get("/first-detections", response_model=list[FirstDetection])
def first_detections(
    limit: int = Query(20, ge=1, le=100),
    conn: sqlite3.Connection = Depends(get_connection),
) -> list[FirstDetection]:
    """Newest life-list additions: earliest detection per species, recent first."""
    rows = conn.execute(
        f"""
        SELECT Sci_Name AS sci_name,
               MAX(Com_Name) AS com_name,
               MIN({TS}) AS first_heard
        FROM detections
        GROUP BY Sci_Name
        ORDER BY first_heard DESC
        LIMIT ?
        """,
        [limit],
    ).fetchall()
    return [
        FirstDetection(
            sci_name=r["sci_name"],
            com_name=r["com_name"],
            first_heard=r["first_heard"].replace(" ", "T"),
        )
        for r in rows
    ]


@router.get("/by-period", response_model=list[PeriodBucket])
def by_period(
    window: str = Depends(valid_window),
    conn: sqlite3.Connection = Depends(get_connection),
) -> list[PeriodBucket]:
    """Detection counts bucketed for a histogram of the active window."""
    predicate, params = window_clause(window)
    where = f"WHERE {predicate}" if predicate else ""
    bucket_seconds = WINDOW_BUCKET_SECONDS[window]
    rows = conn.execute(
        f"""
        SELECT (CAST(strftime('%s', {TS}) AS INTEGER) / ?) * ? AS bucket,
               COUNT(*) AS count
        FROM detections
        {where}
        GROUP BY bucket
        ORDER BY bucket
        """,
        [bucket_seconds, bucket_seconds, *params],
    ).fetchall()
    return [
        PeriodBucket(bucket=epoch_to_iso(int(r["bucket"])), count=r["count"])
        for r in rows
    ]
