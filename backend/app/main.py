import asyncio
import logging
from pathlib import Path
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware

from app.config import settings
from app.database import init_db
from app.cleanup import cleanup_expired_shares
from app.routers import shares, health

# Configure structured, non-leaking logging
logging.basicConfig(
    level=logging.DEBUG if settings.DEBUG else logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("quickshare")


async def periodic_cleanup_task():
    """Background task running every interval to clean expired shares and physical files."""
    logger.info(f"Background cleanup task started (interval: {settings.CLEANUP_INTERVAL_SECONDS}s)")
    while True:
        try:
            await asyncio.sleep(settings.CLEANUP_INTERVAL_SECONDS)
            shares_deleted, files_deleted = cleanup_expired_shares()
            if shares_deleted > 0:
                logger.info(f"Periodic cleanup: pruned {shares_deleted} expired shares, {files_deleted} files")
        except asyncio.CancelledError:
            logger.info("Background cleanup task stopped.")
            break
        except Exception as e:
            logger.error(f"Error during periodic cleanup cycle: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup:
    logger.info(f"Starting {settings.APP_NAME}...")
    settings.DATA_DIR.mkdir(parents=True, exist_ok=True)
    settings.UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

    # Initialize SQLite schema
    init_db()

    # Initial cleanup of any shares that expired while the server was down/restarted
    expired_shares, expired_files = cleanup_expired_shares()
    if expired_shares > 0:
        logger.info(f"Startup cleanup: removed {expired_shares} stale shares and {expired_files} files from previous session")

    # Start periodic background cleanup loop
    cleanup_task = asyncio.create_task(periodic_cleanup_task())

    yield

    # Shutdown:
    cleanup_task.cancel()
    try:
        await cleanup_task
    except asyncio.CancelledError:
        pass
    logger.info(f"{settings.APP_NAME} stopped cleanly.")


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        return response


app = FastAPI(
    title=settings.APP_NAME,
    description="Production-ready, lightweight temporary file/text sharing service.",
    version="1.0.0",
    lifespan=lifespan
)

# Security headers middleware
app.add_middleware(SecurityHeadersMiddleware)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# Register routers
app.include_router(shares.router)
app.include_router(health.router)

# Mount frontend production build if available (ideal for single-port / low-RAM ARM deployment)
frontend_dist = Path(__file__).resolve().parent.parent.parent / "frontend" / "dist"
if frontend_dist.is_dir():
    from fastapi.staticfiles import StaticFiles
    app.mount("/", StaticFiles(directory=str(frontend_dist), html=True), name="static")
else:
    @app.get("/")
    def root():
        return {
            "service": settings.APP_NAME,
            "version": "1.0.0",
            "docs": "/docs",
            "status": "operational",
            "note": "Frontend build not detected. Run `npm run build` in frontend/ or run Vite dev server."
        }

