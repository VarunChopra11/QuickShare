import io
import time
import uuid
import zipfile
from typing import List, Optional
from pathlib import Path
from fastapi import APIRouter, Depends, Form, HTTPException, Request, Response, UploadFile, status
from fastapi.responses import FileResponse, StreamingResponse

from app.config import settings
from app.database import get_db
from app.rate_limit import get_client_ip, rate_limiter
from app.schemas import FileMetadata, ShareCreateResponse, ShareDetailResponse
from app.security import generate_unique_code, validate_code_format, is_safe_path
from app.storage import get_upload_dir, save_upload_file_chunked, cleanup_saved_files

router = APIRouter(prefix="/api/shares", tags=["shares"])


@router.post("", response_model=ShareCreateResponse, status_code=status.HTTP_201_CREATED)
async def create_share(
    request: Request,
    text: Optional[str] = Form(None),
    files: Optional[List[UploadFile]] = None
):
    """
    Create a new temporary share with text, links, and/or files.
    Expires automatically after configured duration (default: 10 minutes).
    """
    client_ip = get_client_ip(request)
    rate_limiter.check_create_rate(client_ip)

    # Sanitize and validate text
    text_content = text.strip() if text else None
    if text_content and len(text_content) > settings.MAX_TEXT_LENGTH:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Text content exceeds maximum limit of {settings.MAX_TEXT_LENGTH} characters."
        )

    # Filter out empty file inputs that some browsers send
    valid_files = [f for f in (files or []) if f.filename and f.filename.strip()]

    if not text_content and not valid_files:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one piece of text or one file must be provided."
        )

    if len(valid_files) > settings.MAX_FILES_PER_SHARE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Too many files. Maximum allowed per share is {settings.MAX_FILES_PER_SHARE}."
        )

    saved_file_records = []
    stored_filenames_to_cleanup = []
    total_bytes = 0

    upload_dir = get_upload_dir()

    try:
        # Save files to disk with chunked streaming
        for upload_file in valid_files:
            original_name, stored_name, file_size, mime = await save_upload_file_chunked(
                upload_file=upload_file,
                max_bytes=settings.max_file_size_bytes,
                upload_dir=upload_dir
            )
            stored_filenames_to_cleanup.append(stored_name)
            total_bytes += file_size

            if total_bytes > settings.max_total_share_size_bytes:
                raise HTTPException(
                    status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                    detail=f"Total upload size exceeds maximum limit of {settings.MAX_TOTAL_SHARE_SIZE_MB} MB."
                )

            saved_file_records.append({
                "id": str(uuid.uuid4()),
                "original_filename": original_name,
                "stored_filename": stored_name,
                "file_size": file_size,
                "mime_type": mime,
                "created_at": int(time.time())
            })

        share_id = str(uuid.uuid4())
        now = int(time.time())
        expiry_seconds = settings.EXPIRY_MINUTES * 60
        expires_at = now + expiry_seconds

        with get_db() as conn:
            code = generate_unique_code(conn)
            conn.execute(
                """
                INSERT INTO shares (id, code, text_content, created_at, expires_at, downloads_count)
                VALUES (?, ?, ?, ?, ?, 0)
                """,
                (share_id, code, text_content, now, expires_at)
            )

            for rec in saved_file_records:
                conn.execute(
                    """
                    INSERT INTO files (id, share_id, original_filename, stored_filename, file_size, mime_type, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                    """,
                    (rec["id"], share_id, rec["original_filename"], rec["stored_filename"], rec["file_size"], rec["mime_type"], rec["created_at"])
                )

        return ShareCreateResponse(
            code=code,
            expires_at=expires_at,
            expires_in_seconds=expiry_seconds,
            file_count=len(saved_file_records),
            has_text=bool(text_content)
        )

    except Exception:
        # Cleanup any stored files on error
        cleanup_saved_files(stored_filenames_to_cleanup, upload_dir)
        raise


@router.get("/{code}", response_model=ShareDetailResponse)
def get_share(code: str, request: Request):
    """
    Retrieve shared content using the 6-digit code.
    Protected against brute-force enumeration.
    """
    client_ip = get_client_ip(request)
    rate_limiter.check_lookup_rate(client_ip)

    if not validate_code_format(code):
        rate_limiter.record_failed_lookup(client_ip)
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invalid or expired code. Please verify the 6-digit code."
        )

    now = int(time.time())

    with get_db() as conn:
        cursor = conn.execute(
            "SELECT * FROM shares WHERE code = ? AND expires_at > ? LIMIT 1",
            (code, now)
        )
        share = cursor.fetchone()

        if not share:
            rate_limiter.record_failed_lookup(client_ip)
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Share not found or has expired."
            )

        rate_limiter.record_successful_lookup(client_ip)

        file_cursor = conn.execute(
            "SELECT id, original_filename, file_size, mime_type, created_at FROM files WHERE share_id = ? ORDER BY created_at ASC",
            (share["id"],)
        )
        files = [
            FileMetadata(
                id=f["id"],
                original_filename=f["original_filename"],
                file_size=f["file_size"],
                mime_type=f["mime_type"],
                created_at=f["created_at"]
            )
            for f in file_cursor.fetchall()
        ]

        remaining = max(0, share["expires_at"] - now)

        return ShareDetailResponse(
            code=share["code"],
            text_content=share["text_content"],
            created_at=share["created_at"],
            expires_at=share["expires_at"],
            remaining_seconds=remaining,
            files=files
        )


@router.get("/{code}/files/{file_id}")
def download_file(code: str, file_id: str, request: Request):
    """
    Download a specific file from a share.
    """
    client_ip = get_client_ip(request)
    rate_limiter.check_lookup_rate(client_ip)

    if not validate_code_format(code):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Share not found or has expired."
        )

    now = int(time.time())

    with get_db() as conn:
        share_cursor = conn.execute(
            "SELECT id FROM shares WHERE code = ? AND expires_at > ? LIMIT 1",
            (code, now)
        )
        share = share_cursor.fetchone()
        if not share:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Share not found or has expired."
            )

        file_cursor = conn.execute(
            "SELECT original_filename, stored_filename, mime_type FROM files WHERE id = ? AND share_id = ? LIMIT 1",
            (file_id, share["id"])
        )
        file_rec = file_cursor.fetchone()
        if not file_rec:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="File not found in this share."
            )

        # Increment download counter
        conn.execute(
            "UPDATE shares SET downloads_count = downloads_count + 1 WHERE id = ?",
            (share["id"],)
        )

    upload_dir = get_upload_dir()
    file_path = upload_dir / file_rec["stored_filename"]

    if not is_safe_path(upload_dir, file_path) or not file_path.is_file():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="File is no longer available on disk."
        )

    return FileResponse(
        path=file_path,
        media_type=file_rec["mime_type"],
        filename=file_rec["original_filename"],
        headers={
            "X-Content-Type-Options": "nosniff",
            "Content-Disposition": f'attachment; filename="{file_rec["original_filename"]}"'
        }
    )


@router.get("/{code}/download-all")
def download_all_files(code: str, request: Request):
    """
    Download all files in a share packaged as a single ZIP archive.
    """
    client_ip = get_client_ip(request)
    rate_limiter.check_lookup_rate(client_ip)

    if not validate_code_format(code):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Share not found or has expired."
        )

    now = int(time.time())

    with get_db() as conn:
        share_cursor = conn.execute(
            "SELECT id FROM shares WHERE code = ? AND expires_at > ? LIMIT 1",
            (code, now)
        )
        share = share_cursor.fetchone()
        if not share:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Share not found or has expired."
            )

        file_cursor = conn.execute(
            "SELECT original_filename, stored_filename FROM files WHERE share_id = ?",
            (share["id"],)
        )
        files = file_cursor.fetchall()
        if not files:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No files attached to this share."
            )

    upload_dir = get_upload_dir()

    # Create zip archive in memory (or stream)
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        used_names = set()
        for f in files:
            file_path = upload_dir / f["stored_filename"]
            if file_path.is_file() and is_safe_path(upload_dir, file_path):
                # Avoid duplicate names in zip
                name = f["original_filename"]
                if name in used_names:
                    name = f"{uuid.uuid4().hex[:6]}_{name}"
                used_names.add(name)
                zf.write(file_path, arcname=name)

    zip_buffer.seek(0)
    zip_filename = f"quickshare_{code}.zip"

    return StreamingResponse(
        zip_buffer,
        media_type="application/zip",
        headers={
            "Content-Disposition": f'attachment; filename="{zip_filename}"',
            "X-Content-Type-Options": "nosniff"
        }
    )


@router.delete("/{code}", status_code=status.HTTP_204_NO_CONTENT)
def delete_share(code: str, request: Request):
    """
    Immediately delete/burn a share and its physical files.
    """
    if not validate_code_format(code):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invalid code format."
        )

    upload_dir = get_upload_dir()

    with get_db() as conn:
        cursor = conn.execute("SELECT id FROM shares WHERE code = ? LIMIT 1", (code,))
        share = cursor.fetchone()
        if not share:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Share not found."
            )

        share_id = share["id"]
        # Find files
        file_cursor = conn.execute("SELECT stored_filename FROM files WHERE share_id = ?", (share_id,))
        for row in file_cursor.fetchall():
            p = upload_dir / row["stored_filename"]
            try:
                if p.is_file():
                    p.unlink()
            except OSError:
                pass

        conn.execute("DELETE FROM files WHERE share_id = ?", (share_id,))
        conn.execute("DELETE FROM shares WHERE id = ?", (share_id,))

    return Response(status_code=status.HTTP_204_NO_CONTENT)
