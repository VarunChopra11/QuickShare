import io
import time
from fastapi.testclient import TestClient
from app.main import app
from app.config import settings

client = TestClient(app)


def test_create_text_share():
    response = client.post(
        "/api/shares",
        data={"text": "Hello QuickShare! This is a test message."}
    )
    assert response.status_code == 201
    data = response.json()
    assert "code" in data
    assert len(data["code"]) == 6
    assert data["code"].isdigit()
    assert data["has_text"] is True
    assert data["file_count"] == 0
    assert data["expires_in_seconds"] == 600


def test_create_and_retrieve_text_share():
    # 1. Create
    msg = "Confidential Wi-Fi Password: SuperSecret123"
    create_res = client.post(
        "/api/shares",
        data={"text": msg}
    )
    assert create_res.status_code == 201
    code = create_res.json()["code"]

    # 2. Retrieve
    get_res = client.get(f"/api/shares/{code}")
    assert get_res.status_code == 200
    share_data = get_res.json()
    assert share_data["code"] == code
    assert share_data["text_content"] == msg
    assert share_data["remaining_seconds"] > 0
    assert len(share_data["files"]) == 0


def test_create_and_retrieve_file_share():
    file_content = b"Binary or text test data inside uploaded file."
    files = [
        ("files", ("test_note.txt", io.BytesIO(file_content), "text/plain"))
    ]
    create_res = client.post(
        "/api/shares",
        data={"text": "Here is the file you requested"},
        files=files
    )
    assert create_res.status_code == 201
    code = create_res.json()["code"]
    assert create_res.json()["file_count"] == 1

    # Retrieve metadata
    get_res = client.get(f"/api/shares/{code}")
    assert get_res.status_code == 200
    data = get_res.json()
    assert len(data["files"]) == 1
    file_info = data["files"][0]
    assert file_info["original_filename"] == "test_note.txt"
    assert file_info["file_size"] == len(file_content)

    # Download file
    download_res = client.get(f"/api/shares/{code}/files/{file_info['id']}")
    assert download_res.status_code == 200
    assert download_res.content == file_content
    assert download_res.headers.get("x-content-type-options") == "nosniff"


def test_download_all_as_zip():
    files = [
        ("files", ("file1.txt", io.BytesIO(b"Content 1"), "text/plain")),
        ("files", ("file2.txt", io.BytesIO(b"Content 2"), "text/plain")),
    ]
    create_res = client.post("/api/shares", files=files)
    assert create_res.status_code == 201
    code = create_res.json()["code"]

    download_zip_res = client.get(f"/api/shares/{code}/download-all")
    assert download_zip_res.status_code == 200
    assert download_zip_res.headers.get("content-type") == "application/zip"
    assert len(download_zip_res.content) > 0


def test_invalid_code_returns_404():
    res = client.get("/api/shares/999999")
    assert res.status_code == 404

    # Non-digit or wrong length code
    res_bad = client.get("/api/shares/abc")
    assert res_bad.status_code == 404


def test_delete_share():
    create_res = client.post("/api/shares", data={"text": "Temporary secret"})
    code = create_res.json()["code"]

    del_res = client.delete(f"/api/shares/{code}")
    assert del_res.status_code == 204

    # Now retrieving should be 404
    get_res = client.get(f"/api/shares/{code}")
    assert get_res.status_code == 404


def test_filename_sanitization_and_traversal():
    # Attempt directory traversal in filename
    evil_filename = "../../../etc/passwd"
    files = [
        ("files", (evil_filename, io.BytesIO(b"innocent content"), "text/plain"))
    ]
    create_res = client.post("/api/shares", files=files)
    assert create_res.status_code == 201
    code = create_res.json()["code"]

    get_res = client.get(f"/api/shares/{code}")
    data = get_res.json()
    assert len(data["files"]) == 1
    # Check that ../ was stripped
    assert ".." not in data["files"][0]["original_filename"]
    assert "/" not in data["files"][0]["original_filename"]


def test_empty_share_rejected():
    res = client.post("/api/shares", data={})
    assert res.status_code == 400
    assert "At least one piece of text or one file" in res.json()["detail"]


def test_oversized_text_rejected():
    oversized_text = "x" * (settings.MAX_TEXT_LENGTH + 10)
    res = client.post("/api/shares", data={"text": oversized_text})
    assert res.status_code == 400
    assert "Text content exceeds maximum limit" in res.json()["detail"]

