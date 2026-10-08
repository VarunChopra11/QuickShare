from typing import List, Optional
from pydantic import BaseModel, Field


class FileMetadata(BaseModel):
    id: str
    original_filename: str
    file_size: int
    mime_type: str
    created_at: int


class ShareCreateResponse(BaseModel):
    code: str = Field(description="The 6-digit sharing code")
    expires_at: int = Field(description="Unix timestamp when share expires")
    expires_in_seconds: int = Field(description="Seconds until expiration")
    file_count: int = Field(description="Number of uploaded files")
    has_text: bool = Field(description="Whether text content is present")


class ShareDetailResponse(BaseModel):
    code: str
    text_content: Optional[str] = None
    created_at: int
    expires_at: int
    remaining_seconds: int
    files: List[FileMetadata] = Field(default_factory=list)


class HealthResponse(BaseModel):
    status: str
    active_shares: int
    storage_ok: bool
    version: str = "1.0.0"
