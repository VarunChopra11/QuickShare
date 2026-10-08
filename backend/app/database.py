import sqlite3
from contextlib import contextmanager
from typing import Generator
from pathlib import Path
from app.config import settings


def get_db_path() -> Path:
    settings.DATA_DIR.mkdir(parents=True, exist_ok=True)
    return settings.DATABASE_PATH


def create_connection(db_path: Path | None = None) -> sqlite3.Connection:
    target_path = db_path or get_db_path()
    conn = sqlite3.connect(
        target_path,
        timeout=10.0,
        detect_types=sqlite3.PARSE_DECLTYPES,
        check_same_thread=False
    )
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode = WAL;")
    conn.execute("PRAGMA foreign_keys = ON;")
    conn.execute("PRAGMA synchronous = NORMAL;")
    conn.execute("PRAGMA busy_timeout = 5000;")
    return conn


@contextmanager
def get_db(db_path: Path | None = None) -> Generator[sqlite3.Connection, None, None]:
    conn = create_connection(db_path)
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db(db_path: Path | None = None) -> None:
    """Initialize database schema and indexes."""
    with get_db(db_path) as conn:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS shares (
                id TEXT PRIMARY KEY,
                code TEXT NOT NULL,
                text_content TEXT,
                created_at INTEGER NOT NULL,
                expires_at INTEGER NOT NULL,
                downloads_count INTEGER DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS files (
                id TEXT PRIMARY KEY,
                share_id TEXT NOT NULL,
                original_filename TEXT NOT NULL,
                stored_filename TEXT NOT NULL,
                file_size INTEGER NOT NULL,
                mime_type TEXT NOT NULL,
                created_at INTEGER NOT NULL,
                FOREIGN KEY (share_id) REFERENCES shares(id) ON DELETE CASCADE
            );

            CREATE INDEX IF NOT EXISTS idx_shares_code ON shares(code);
            CREATE INDEX IF NOT EXISTS idx_shares_expires_at ON shares(expires_at);
            CREATE INDEX IF NOT EXISTS idx_files_share_id ON files(share_id);
        """)
