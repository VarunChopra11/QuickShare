import re
import secrets
import time
from pathlib import Path
import sqlite3


def generate_unique_code(conn: sqlite3.Connection, max_retries: int = 20) -> str:
    """
    Generate a cryptographically secure 6-digit code.
    Ensures no collision with any non-expired share.
    """
    now = int(time.time())
    for _ in range(max_retries):
        # Generate 6 digits: 000000 - 999999
        code = f"{secrets.randbelow(1_000_000):06d}"
        cursor = conn.execute(
            "SELECT 1 FROM shares WHERE code = ? AND expires_at > ? LIMIT 1",
            (code, now)
        )
        if cursor.fetchone() is None:
            return code

    raise RuntimeError("Failed to generate a unique share code. Please try again.")


def validate_code_format(code: str) -> bool:
    """Validate that code is exactly 6 decimal digits."""
    return bool(code and len(code) == 6 and code.isdigit())


def sanitize_filename(filename: str) -> str:
    """
    Sanitize an uploaded filename to prevent directory traversal,
    null bytes, control characters, and unsafe characters.
    """
    if not filename:
        return "unnamed_file"

    # Extract basename only to prevent directory traversal
    name = Path(filename).name

    # Remove null bytes and control characters
    name = re.sub(r"[\x00-\x1f\x7f-\x9f]", "", name)

    # Replace forbidden path characters
    name = re.sub(r'[\\/:*?"<>|]', "_", name)

    # Collapse multiple dots / spaces
    name = re.sub(r"\.{2,}", ".", name)
    name = name.strip(" .")

    if not name:
        return "unnamed_file"

    # Limit filename length to 120 chars while preserving extension
    if len(name) > 120:
        parts = name.rsplit(".", 1)
        if len(parts) == 2 and len(parts[1]) <= 10:
            ext = "." + parts[1]
            base = parts[0][: 120 - len(ext)]
            name = base + ext
        else:
            name = name[:120]

    return name


def is_safe_path(base_dir: Path, target_path: Path) -> bool:
    """Ensure target_path resolves strictly inside base_dir."""
    try:
        resolved_base = base_dir.resolve()
        resolved_target = target_path.resolve()
        return resolved_target.is_relative_to(resolved_base)
    except (ValueError, RuntimeError):
        return False
