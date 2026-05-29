import sqlite3

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse

from ..audio import media_type_for, resolve_clip_path
from ..db import get_connection

router = APIRouter(prefix="/api", tags=["recordings"])


@router.get("/recordings/{rowid}")
def stream_recording(
    rowid: int,
    conn: sqlite3.Connection = Depends(get_connection),
) -> FileResponse:
    """Stream the audio clip for a single detection (by rowid)."""
    row = conn.execute(
        "SELECT Date, Com_Name, File_Name FROM detections WHERE rowid = ?",
        [rowid],
    ).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail=f"no detection {rowid}")

    path = resolve_clip_path(row["Date"], row["Com_Name"], row["File_Name"])
    if path is None:
        raise HTTPException(status_code=404, detail="clip file not found on disk")

    # Clips are immutable once written; allow long client/proxy caching.
    return FileResponse(
        path,
        media_type=media_type_for(path),
        headers={"Cache-Control": "public, max-age=86400, immutable"},
    )
