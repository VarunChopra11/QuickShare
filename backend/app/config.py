from pathlib import Path
from typing import List, Union
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    APP_NAME: str = "QuickShare"
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    DEBUG: bool = False

    # Expiration in minutes (Default: 10 minutes)
    EXPIRY_MINUTES: int = 10

    # Storage paths
    DATA_DIR: Path = Path("data")
    UPLOAD_DIR: Path = Path("data/uploads")
    DATABASE_PATH: Path = Path("data/quickshare.db")

    # File & payload limits
    MAX_FILE_SIZE_MB: int = 50
    MAX_TOTAL_SHARE_SIZE_MB: int = 100
    MAX_FILES_PER_SHARE: int = 10
    MAX_TEXT_LENGTH: int = 50000  # 50k characters

    # Security & Rate Limiting
    # Max code lookup attempts per IP per minute
    RATE_LIMIT_LOOKUP_PER_MINUTE: int = 20
    # Max share creation per IP per minute
    RATE_LIMIT_CREATE_PER_MINUTE: int = 10
    # Max failed code attempts per IP before temporary lockout
    MAX_FAILED_ATTEMPTS: int = 5
    FAILED_ATTEMPT_LOCKOUT_SECONDS: int = 60

    # Background cleanup interval in seconds
    CLEANUP_INTERVAL_SECONDS: int = 30

    # Allowed CORS Origins (can be comma-separated string or list)
    CORS_ORIGINS: Union[str, List[str]] = ["*"]

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

    @property
    def cors_origin_list(self) -> List[str]:
        if isinstance(self.CORS_ORIGINS, str):
            return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]
        return self.CORS_ORIGINS

    @property
    def max_file_size_bytes(self) -> int:
        return self.MAX_FILE_SIZE_MB * 1024 * 1024

    @property
    def max_total_share_size_bytes(self) -> int:
        return self.MAX_TOTAL_SHARE_SIZE_MB * 1024 * 1024


settings = Settings()
