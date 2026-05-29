from __future__ import annotations

import mimetypes
from pathlib import Path

from .config import get_settings


def resolve_clip_path(date: str, com_name: str, file_name: str) -> Path | None:
    """Map a detection row to its audio clip on disk.

    BirdNET-Pi stores clips under By_Date/{Date}/{Com_Name}/{File_Name},
    where spaces in the common name become underscores. We try that exact
    path first, then fall back to a recursive search for the basename so a
    layout variation in the fork doesn't break playback.

    NOTE: the live clip directory is empty until detections occur, so this
    resolution can only be fully confirmed post-deploy (see DEPLOY.md).
    """
    settings = get_settings()
    base = Path(settings.birdsongs_dir)
    basename = Path(file_name).name  # guard against any stray path parts

    primary = base / date / com_name.replace(" ", "_") / basename
    if primary.is_file():
        return primary

    # Fallback: BirdNET-Pi sometimes nests differently; find by basename.
    for match in base.rglob(basename):
        if match.is_file():
            return match

    return None


def media_type_for(path: Path) -> str:
    """Best-effort content type from the clip's extension (mp3 by default)."""
    guessed, _ = mimetypes.guess_type(str(path))
    return guessed or "application/octet-stream"
