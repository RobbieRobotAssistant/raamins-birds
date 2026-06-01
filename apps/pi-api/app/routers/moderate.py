from __future__ import annotations

import base64
import secrets
import sqlite3
import urllib.error
import urllib.parse
import urllib.request
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException

from ..config import get_settings
from ..db import get_connection

router = APIRouter(prefix="/api/moderate", tags=["moderate"])


def _require_token(x_moderation_token: Optional[str]) -> None:
    settings = get_settings()
    if not settings.moderation_token:
        raise HTTPException(status_code=503, detail="moderation not configured")
    if not x_moderation_token or not secrets.compare_digest(
        x_moderation_token, settings.moderation_token
    ):
        raise HTTPException(status_code=403, detail="invalid moderation token")


def _birdnetpi_delete(deletefile: str) -> tuple[int, str]:
    """Ask BirdNET-Pi's own play.php to delete a detection (row + audio).

    deletefile is the By_Date-relative path: "<Date>/<Com_Name_>/<File_Name>".
    Authenticated with HTTP Basic (BirdNET-Pi: user 'birdnet', Caddy password).
    We route the delete through BirdNET-Pi so it performs its own cleanup rather
    than us writing to birds.db underneath it.
    """
    settings = get_settings()
    url = (
        f"{settings.birdnetpi_url}/play.php?deletefile="
        + urllib.parse.quote(deletefile)
    )
    req = urllib.request.Request(url, method="GET")
    creds = f"{settings.birdnetpi_user}:{settings.birdnetpi_password}".encode()
    req.add_header("Authorization", "Basic " + base64.b64encode(creds).decode())
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return resp.status, resp.read(2048).decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        return e.code, e.reason or "http error"
    except urllib.error.URLError as e:
        raise HTTPException(
            status_code=502, detail=f"could not reach BirdNET-Pi: {e.reason}"
        )


@router.post("/delete/{rowid}")
def delete_detection(
    rowid: int,
    x_moderation_token: Optional[str] = Header(default=None),
    conn: sqlite3.Connection = Depends(get_connection),
) -> dict:
    """Delete one detection at the source, via BirdNET-Pi. Token-gated."""
    _require_token(x_moderation_token)

    row = conn.execute(
        "SELECT Date, Com_Name, File_Name FROM detections WHERE rowid = ?",
        [rowid],
    ).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail=f"no detection {rowid}")

    deletefile = f"{row['Date']}/{row['Com_Name'].replace(' ', '_')}/{row['File_Name']}"
    status, _body = _birdnetpi_delete(deletefile)
    if status == 401:
        raise HTTPException(status_code=502, detail="BirdNET-Pi auth rejected")

    # Confirm the row is actually gone (fresh read-only connection via dependency
    # would be cached at request scope, so open a new one).
    settings = get_settings()
    check = sqlite3.connect(
        f"file:{settings.birds_db_path}?mode=ro", uri=True, check_same_thread=False
    )
    try:
        still = check.execute(
            "SELECT 1 FROM detections WHERE rowid = ?", [rowid]
        ).fetchone()
    finally:
        check.close()
    if still is not None:
        raise HTTPException(
            status_code=502,
            detail=f"BirdNET-Pi did not delete the detection (status {status})",
        )

    return {"deleted": True, "rowid": rowid, "deletefile": deletefile}
