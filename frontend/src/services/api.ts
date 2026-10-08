import { ShareCreateResponse, ShareDetailResponse } from '../types';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

export class ApiRequestError extends Error {
  status: number;
  retryAfter?: number;

  constructor(message: string, status: number, retryAfter?: number) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
    this.retryAfter = retryAfter;
  }
}

export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

export async function createShare(
  text: string | null,
  files: File[],
  onProgress?: (percent: number) => void
): Promise<ShareCreateResponse> {
  const formData = new FormData();
  if (text && text.trim()) {
    formData.append('text', text.trim());
  }
  for (const file of files) {
    formData.append('files', file);
  }

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_BASE}/api/shares`);

    if (xhr.upload && onProgress) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percent = Math.round((event.loaded / event.total) * 100);
          onProgress(percent);
        }
      };
    }

    xhr.onload = () => {
      let data: any = {};
      try {
        data = JSON.parse(xhr.responseText);
      } catch {
        data = { detail: xhr.statusText };
      }

      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(data as ShareCreateResponse);
      } else {
        const retryAfterHeader = xhr.getResponseHeader('Retry-After');
        const retryAfter = retryAfterHeader ? parseInt(retryAfterHeader, 10) : undefined;
        const msg = data.detail || `Upload failed with status ${xhr.status}`;
        reject(new ApiRequestError(msg, xhr.status, retryAfter));
      }
    };

    xhr.onerror = () => {
      reject(new ApiRequestError('Network error occurred. Please check your connection.', 0));
    };

    xhr.send(formData);
  });
}

export async function getShare(code: string): Promise<ShareDetailResponse> {
  const response = await fetch(`${API_BASE}/api/shares/${encodeURIComponent(code)}`);

  let data: any;
  try {
    data = await response.json();
  } catch {
    data = { detail: response.statusText };
  }

  if (!response.ok) {
    const retryHeader = response.headers.get('Retry-After');
    const retryAfter = retryHeader ? parseInt(retryHeader, 10) : undefined;
    throw new ApiRequestError(
      data.detail || 'Failed to retrieve share',
      response.status,
      retryAfter
    );
  }

  return data as ShareDetailResponse;
}

export async function deleteShare(code: string): Promise<void> {
  const response = await fetch(`${API_BASE}/api/shares/${encodeURIComponent(code)}`, {
    method: 'DELETE',
  });

  if (!response.ok && response.status !== 404) {
    throw new ApiRequestError('Failed to delete share', response.status);
  }
}

export function getDownloadUrl(code: string, fileId: string): string {
  return `${API_BASE}/api/shares/${encodeURIComponent(code)}/files/${encodeURIComponent(fileId)}`;
}

export function getDownloadAllUrl(code: string): string {
  return `${API_BASE}/api/shares/${encodeURIComponent(code)}/download-all`;
}
