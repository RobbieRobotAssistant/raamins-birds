import os
from functools import lru_cache


class Settings:
    """Runtime configuration, sourced from environment variables.

    All paths point at BirdNET-Pi-owned data and are read-only to this app.
    """

    def __init__(self) -> None:
        self.birds_db_path: str = os.environ.get(
            "BIRDS_DB_PATH", "/home/rmostag1/BirdNET-Pi/scripts/birds.db"
        )
        self.birdsongs_dir: str = os.environ.get(
            "BIRDSONGS_DIR",
            "/home/rmostag1/BirdNET-Pi/BirdSongs/Extracted/By_Date",
        )
        raw_origins = os.environ.get("ALLOWED_ORIGINS", "")
        self.allowed_origins: list[str] = [
            o.strip() for o in raw_origins.split(",") if o.strip()
        ]
        self.api_host: str = os.environ.get("API_HOST", "127.0.0.1")
        self.api_port: int = int(os.environ.get("API_PORT", "8000"))

        # Moderation: shared secret required to call the delete endpoint. Empty
        # disables moderation entirely (endpoint returns 503).
        self.moderation_token: str = os.environ.get("MODERATION_TOKEN", "")
        # BirdNET-Pi's own web UI (reachable on the Pi over localhost). Its
        # play.php performs the actual deletion of a detection + audio file.
        self.birdnetpi_url: str = os.environ.get(
            "BIRDNETPI_URL", "http://localhost"
        ).rstrip("/")
        self.birdnetpi_user: str = os.environ.get("BIRDNETPI_USER", "birdnet")
        self.birdnetpi_password: str = os.environ.get("BIRDNETPI_PASSWORD", "")


@lru_cache
def get_settings() -> Settings:
    return Settings()
