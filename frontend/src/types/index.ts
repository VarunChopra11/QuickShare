export interface FileMetadata {
  id: string;
  original_filename: string;
  file_size: number;
  mime_type: string;
  created_at: number;
}

export interface ShareCreateResponse {
  code: string;
  expires_at: number;
  expires_in_seconds: number;
  file_count: number;
  has_text: boolean;
}

export interface ShareDetailResponse {
  code: string;
  text_content: string | null;
  created_at: number;
  expires_at: number;
  remaining_seconds: number;
  files: FileMetadata[];
}

export interface ApiError {
  detail: string;
  retryAfter?: number;
}
