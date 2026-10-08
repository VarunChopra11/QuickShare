import os
import uuid
from pathlib import Path
from typing import List, Tuple
from fastapi import HTTPException, UploadFile, status
from app.config import settings
from app.security import sanitize_filename, is_safe_path


def get_upload_dir() -> Path:
    settings.UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    return settings.UPLOAD_DIR


async def save_upload_file_chunked(
    upload_file: UploadFile,
    max_bytes: int,
    upload_dir: Path | None = None
) -> Tuple[str, str, int, str]:
    """
    Save an UploadFile to disk in chunks to minimize memory consumption.
    Enforces maximum file size during stream writing.
    Returns: (original_sanitized_filename, stored_filename, bytes_written, mime_type)
    """
    target_dir = upload_dir or get_upload_dir()
    original_name = sanitize_filename(upload_file.filename or "file.bin")

    # Determine safe extension
    _, ext = os.path.splitext(original_name)
    ext = ext.lower()[:10]  # keep reasonable extension

    # Stored filename is always a randomized UUID + extension
    stored_name = f"{uuid.uuid4().hex}{ext}"
    target_path = target_dir / stored_name

    if not is_safe_path(target_dir, target_path):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file path."
        )

    bytes_written = 0
    chunk_size = 64 * 1024  # 64 KB chunks

    try:
        with open(target_path, "wb") as f:
            while chunk := await upload_file.read(chunk_size):
                bytes_written += len(chunk)
                if bytes_written > max_bytes:
                    raise HTTPException(
                        status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                        detail=f"File '{original_name}' exceeds maximum allowed size of {settings.MAX_FILE_SIZE_MB} MB."
                    )
                f.write(chunk)
    except Exception:
        # Clean up partial file on failure
        if target_path.exists():
            target_path.unlink()
        raise

    mime_type = upload_file.content_type or "application/octet-stream"
    return original_name, stored_name, bytes_written, mime_type


def cleanup_saved_files(stored_filenames: List[str], upload_dir: Path | None = None) -> None:
    """Helper to remove list of stored files if an operation fails midway."""
    target_dir = upload_dir or get_upload_dir()
    for name in stored_filenames:
        p = target_dir / name
        try:
            if p.is_file():
                p.unlink()
        except OSError:
            pass
