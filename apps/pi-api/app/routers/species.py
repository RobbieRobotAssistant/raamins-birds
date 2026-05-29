import sqlite3

from fastapi import APIRouter, Depends, HTTPException, Query

from ..db import TS, get_connection, window_clause
from ..deps import valid_window
from ..models import RecentDetection, SpeciesDetail, SpeciesListEntry, SpeciesListItem
from ..util import genus_of, iso

router = APIRouter(prefix="/api", tags=["species"])

_SORTS = {
    "count": "count DESC, com_name ASC",
    "recent": "last_heard DESC",
    "alpha": "com_name ASC",
}


@router.get("/species", response_model=list[SpeciesListItem])
def life_list(
    sort: str = Query("count", pattern="^(count|recent|alpha)$"),
    conn: sqlite3.Connection = Depends(get_connection),
) -> list[SpeciesListItem]:
    """All-time life list: one row per species (distinct Sci_Name)."""
    rows = conn.execute(
        f"""
        SELECT Sci_Name AS sci_name,
               MAX(Com_Name) AS com_name,
               COUNT(*) AS count,
               MAX({TS}) AS last_heard
        FROM detections
        GROUP BY Sci_Name
        ORDER BY {_SORTS[sort]}
        """
    ).fetchall()

    return [
        SpeciesListItem(
            sci_name=r["sci_name"],
            com_name=r["com_name"],
            count=r["count"],
            last_heard=r["last_heard"].replace(" ", "T"),
        )
        for r in rows
    ]


@router.get("/species-list", response_model=list[SpeciesListEntry])
def species_list(
    conn: sqlite3.Connection = Depends(get_connection),
) -> list[SpeciesListEntry]:
    """Distinct species, for the offline image-generation script."""
    rows = conn.execute(
        """
        SELECT Sci_Name AS sci_name, MAX(Com_Name) AS com_name
        FROM detections
        GROUP BY Sci_Name
        ORDER BY com_name
        """
    ).fetchall()
    return [
        SpeciesListEntry(sci_name=r["sci_name"], com_name=r["com_name"]) for r in rows
    ]


@router.get("/species/{sci_name:path}", response_model=SpeciesDetail)
def species_detail(
    sci_name: str,
    window: str = Depends(valid_window),
    recent_limit: int = Query(12, ge=1, le=50),
    conn: sqlite3.Connection = Depends(get_connection),
) -> SpeciesDetail:
    """Detail for one species, keyed on Sci_Name (URL-encoded)."""
    summary = conn.execute(
        f"""
        SELECT MAX(Com_Name) AS com_name,
               COUNT(*) AS all_time_count,
               MIN({TS}) AS first_heard,
               MAX({TS}) AS last_heard
        FROM detections
        WHERE Sci_Name = ?
        """,
        [sci_name],
    ).fetchone()

    if summary is None or summary["all_time_count"] == 0:
        raise HTTPException(status_code=404, detail=f"no detections for '{sci_name}'")

    predicate, params = window_clause(window)
    win_where = f"AND {predicate}" if predicate else ""
    window_count = conn.execute(
        f"SELECT COUNT(*) AS c FROM detections WHERE Sci_Name = ? {win_where}",
        [sci_name, *params],
    ).fetchone()["c"]

    recent_rows = conn.execute(
        f"""
        SELECT rowid AS rowid, {TS} AS ts, Confidence AS confidence
        FROM detections
        WHERE Sci_Name = ?
        ORDER BY {TS} DESC
        LIMIT ?
        """,
        [sci_name, recent_limit],
    ).fetchall()

    recent = [
        RecentDetection(
            rowid=r["rowid"],
            timestamp=r["ts"].replace(" ", "T"),
            confidence=r["confidence"],
            recording_url=f"/api/recordings/{r['rowid']}",
        )
        for r in recent_rows
    ]

    return SpeciesDetail(
        sci_name=sci_name,
        com_name=summary["com_name"],
        genus=genus_of(sci_name),
        all_time_count=summary["all_time_count"],
        window_count=window_count,
        first_heard=summary["first_heard"].replace(" ", "T"),
        last_heard=summary["last_heard"].replace(" ", "T"),
        recent=recent,
    )
