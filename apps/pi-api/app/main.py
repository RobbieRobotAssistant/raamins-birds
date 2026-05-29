from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .routers import detections, recordings, species, stats

app = FastAPI(
    title="BirdNET-Pi Public API",
    version="1.0.0",
    description="Read-only access to BirdNET-Pi detections and audio clips.",
)

settings = get_settings()

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_methods=["GET"],
    allow_headers=["*"],
    max_age=3600,
)


@app.middleware("http")
async def default_cache_headers(request: Request, call_next):
    """Give JSON GETs a short shared-cache TTL so the frontend's ISR layer,
    and any CDN in front, can absorb traffic and spare the Pi. Endpoints that
    set their own Cache-Control (e.g. recordings) are left untouched.
    """
    response = await call_next(request)
    if (
        request.method == "GET"
        and response.status_code == 200
        and "cache-control" not in response.headers
    ):
        response.headers["Cache-Control"] = (
            "public, max-age=30, stale-while-revalidate=60"
        )
    return response


app.include_router(detections.router)
app.include_router(species.router)
app.include_router(recordings.router)
app.include_router(stats.router)


@app.get("/health", tags=["meta"])
def health() -> dict[str, str]:
    return {"status": "ok"}


def main() -> None:
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host=settings.api_host,
        port=settings.api_port,
        reload=False,
    )


if __name__ == "__main__":
    main()
