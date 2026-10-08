import io
import time
from fastapi.testclient import TestClient
from app.main import app
from app.config import settings
from app.database import get_db
from app.cleanup import cleanup_expired_shares

client = TestClient(app)


def test_cleanup_expired_shares_and_files():
    # 1. Create a share with file
    files = [
        ("files", ("expire_test.txt", io.BytesIO(b"Data that will expire"), "text/plain"))
    ]
    create_res = client.post("/api/shares", data={"text": "To be expired"}, files=files)
    assert create_res.status_code == 201
    code = create_res.json()["code"]

    # Retrieve file info
    get_res = client.get(f"/api/shares/{code}")
    assert get_res.status_code == 200
    file_info = get_res.json()["files"][0]

    # Verify physical file exists on disk
    with get_db() as conn:
        cursor = conn.execute("SELECT stored_filename FROM files WHERE id = ?", (file_info["id"],))
        stored_filename = cursor.fetchone()["stored_filename"]
        file_path = settings.UPLOAD_DIR / stored_filename
        assert file_path.is_file()

        # Manually backdate expires_at to 10 seconds ago
        past_time = int(time.time()) - 10
        conn.execute("UPDATE shares SET expires_at = ? WHERE code = ?", (past_time, code))

    # 2. Run cleanup
    shares_cleaned, files_cleaned = cleanup_expired_shares(
        db_path=settings.DATABASE_PATH,
        upload_dir=settings.UPLOAD_DIR
    )
    assert shares_cleaned >= 1
    assert files_cleaned >= 1

    # 3. Verify physical file was deleted from disk
    assert not file_path.exists()

    # 4. Verify accessing the code returns 404
    expired_get = client.get(f"/api/shares/{code}")
    assert expired_get.status_code == 404


def test_cleanup_after_simulated_restart():
    """Verify that if files expired while the server was offline, startup cleanup prunes them."""
    # 1. Create a share with file
    files = [
        ("files", ("offline_expired.txt", io.BytesIO(b"Data created before shutdown"), "text/plain"))
    ]
    create_res = client.post("/api/shares", data={"text": "Offline test"}, files=files)
    code = create_res.json()["code"]

    with get_db() as conn:
        cursor = conn.execute("SELECT stored_filename FROM files WHERE share_id = (SELECT id FROM shares WHERE code = ?)", (code,))
        stored_filename = cursor.fetchone()["stored_filename"]
        file_path = settings.UPLOAD_DIR / stored_filename
        assert file_path.is_file()

        # Simulate time passed while server was stopped
        past_time = int(time.time()) - 100
        conn.execute("UPDATE shares SET expires_at = ? WHERE code = ?", (past_time, code))

    # 2. Simulate server restart: calling cleanup_expired_shares as lifespan does on startup
    shares_cleaned, files_cleaned = cleanup_expired_shares(
        db_path=settings.DATABASE_PATH,
        upload_dir=settings.UPLOAD_DIR
    )
    assert shares_cleaned >= 1
    assert files_cleaned >= 1
    assert not file_path.exists()

