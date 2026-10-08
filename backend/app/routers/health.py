import time
from fastapi import APIRouter
from app.config import settings
from app.database import get_db
from app.schemas import HealthResponse

router = APIRouter(prefix="/api/health", tags=["health"])


@router.get("", response_model=HealthResponse)
def health_check():
    """System health check and basic diagnostics."""
    now = int(time.time())
    active_shares = 0
    storage_ok = False

    try:
        with get_db() as conn:
            cursor = conn.execute("SELECT COUNT(*) as count FROM shares WHERE expires_at > ?", (now,))
            active_shares = cursor.fetchone()["count"]

        # Check storage writeable
        test_file = settings.DATA_DIR / ".health_check"
        test_file.touch(exist_ok=True)
        if test_file.exists():
            test_file.unlink()
            storage_ok = True
    except Exception:
        storage_ok = False

    return HealthResponse(
        status="ok" if storage_ok else "degraded",
        active_shares=active_shares,
        storage_ok=storage_ok,
        version="1.0.0"
    )
