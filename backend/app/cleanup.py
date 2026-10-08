import logging
import time
from pathlib import Path
from typing import Tuple
from app.config import settings
from app.database import get_db, init_db

logger = logging.getLogger("quickshare.cleanup")


def cleanup_expired_shares(
    db_path: Path | None = None,
    upload_dir: Path | None = None
) -> Tuple[int, int]:
    """
    Find all expired shares, safely delete their associated physical files,
    and remove the database records.
    Returns: (cleaned_shares_count, cleaned_files_count)
    """
    init_db(db_path)
    target_upload_dir = upload_dir or settings.UPLOAD_DIR
    target_upload_dir.mkdir(parents=True, exist_ok=True)
    now = int(time.time())
    cleaned_shares = 0
    cleaned_files = 0

    with get_db(db_path) as conn:
        # Find all expired share IDs
        cursor = conn.execute(
            "SELECT id FROM shares WHERE expires_at <= ?",
            (now,)
        )
        expired_share_ids = [row["id"] for row in cursor.fetchall()]

        if not expired_share_ids:
            return 0, 0

        # Collect and delete all files associated with these shares
        for share_id in expired_share_ids:
            file_cursor = conn.execute(
                "SELECT stored_filename FROM files WHERE share_id = ?",
                (share_id,)
            )
            file_rows = file_cursor.fetchall()

            for row in file_rows:
                stored_filename = row["stored_filename"]
                file_path = target_upload_dir / stored_filename
                try:
                    if file_path.is_file():
                        file_path.unlink()
                        cleaned_files += 1
                except Exception as e:
                    logger.warning(f"Error removing physical file {stored_filename}: {e}")

            # Delete the share (files table has ON DELETE CASCADE, but delete explicitly to be safe)
            conn.execute("DELETE FROM files WHERE share_id = ?", (share_id,))
            conn.execute("DELETE FROM shares WHERE id = ?", (share_id,))
            cleaned_shares += 1

    if cleaned_shares > 0:
        logger.info(f"Cleanup complete: deleted {cleaned_shares} expired share(s) and {cleaned_files} physical file(s)")

    return cleaned_shares, cleaned_files


def clean_orphan_files(
    db_path: Path | None = None,
    upload_dir: Path | None = None
) -> int:
    """
    Remove any physical files in upload_dir that are not referenced in the database.
    Useful for system maintenance and error recovery.
    """
    target_upload_dir = upload_dir or settings.UPLOAD_DIR
    if not target_upload_dir.exists():
        return 0

    init_db(db_path)
    with get_db(db_path) as conn:
        cursor = conn.execute("SELECT stored_filename FROM files")
        active_filenames = {row["stored_filename"] for row in cursor.fetchall()}

    removed_count = 0
    for file_path in target_upload_dir.iterdir():
        if file_path.is_file() and file_path.name not in active_filenames:
            try:
                file_path.unlink()
                removed_count += 1
            except Exception as e:
                logger.warning(f"Error removing orphan file {file_path.name}: {e}")

    if removed_count > 0:
        logger.info(f"Orphan cleanup complete: removed {removed_count} orphan file(s)")
    return removed_count


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
    print("Running QuickShare manual cleanup...")
    shares_count, files_count = cleanup_expired_shares()
    orphan_count = clean_orphan_files()
    print(f"Cleaned {shares_count} expired shares, {files_count} files, and {orphan_count} orphan files.")
