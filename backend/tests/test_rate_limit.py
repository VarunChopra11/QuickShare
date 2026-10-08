import time
from fastapi.testclient import TestClient
from app.main import app
from app.config import settings

client = TestClient(app)


def test_failed_attempts_trigger_rate_limit():
    # Make multiple failed code lookups exceeding MAX_FAILED_ATTEMPTS
    for i in range(settings.MAX_FAILED_ATTEMPTS):
        res = client.get(f"/api/shares/00000{i}")
        assert res.status_code == 404

    # The next attempt should be blocked by rate limit (HTTP 429)
    locked_res = client.get("/api/shares/111111")
    assert locked_res.status_code == 429
    assert "Too many failed code attempts" in locked_res.json()["detail"]
    assert "Retry-After" in locked_res.headers
