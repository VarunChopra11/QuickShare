import pytest
from pathlib import Path
from fastapi.testclient import TestClient

from app.config import settings
from app.database import init_db
from app.main import app
from app.rate_limit import rate_limiter


@pytest.fixture(autouse=True)
def setup_test_env(tmp_path: Path):
    """Isolate database and upload directory for each test run."""
    test_db = tmp_path / "test_quickshare.db"
    test_uploads = tmp_path / "test_uploads"
    test_uploads.mkdir(parents=True, exist_ok=True)

    # Override settings for testing
    settings.DATA_DIR = tmp_path
    settings.DATABASE_PATH = test_db
    settings.UPLOAD_DIR = test_uploads
    settings.EXPIRY_MINUTES = 10

    # Reset rate limiter state between tests
    with rate_limiter._lock:
        rate_limiter._lookup_requests.clear()
        rate_limiter._create_requests.clear()
        rate_limiter._failed_attempts.clear()

    init_db(test_db)
    yield
