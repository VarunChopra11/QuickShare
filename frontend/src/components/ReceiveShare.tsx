import React, { useState, useEffect } from 'react';
import {
  Download,
  File,
  Copy,
  Check,
  AlertCircle,
  Loader2,
  Trash2,
  RefreshCw,
  Archive,
  ExternalLink,
  Lock,
} from 'lucide-react';
import { CodeInput } from './CodeInput';
import { CountdownTimer } from './CountdownTimer';
import {
  getShare,
  deleteShare,
  getDownloadUrl,
  getDownloadAllUrl,
  formatBytes,
  ApiRequestError,
} from '../services/api';
import { ShareDetailResponse } from '../types';

interface ReceiveShareProps {
  initialCode?: string;
  onNotify?: (msg: string) => void;
}

export const ReceiveShare: React.FC<ReceiveShareProps> = ({ initialCode = '', onNotify }) => {
  const [code, setCode] = useState<string>(initialCode);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [shareData, setShareData] = useState<ShareDetailResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedText, setCopiedText] = useState<boolean>(false);
  const [rateLimitSeconds, setRateLimitSeconds] = useState<number | null>(null);

  // If initialCode provided, automatically attempt retrieval
  useEffect(() => {
    if (initialCode && initialCode.length === 6) {
      handleRetrieve(initialCode);
    }
  }, [initialCode]);

  // Handle rate-limit countdown timer if locked out
  useEffect(() => {
    if (rateLimitSeconds === null || rateLimitSeconds <= 0) return;
    const timer = setInterval(() => {
      setRateLimitSeconds((prev) => (prev && prev > 1 ? prev - 1 : null));
    }, 1000);
    return () => clearInterval(timer);
  }, [rateLimitSeconds]);

  const handleRetrieve = async (codeToFetch = code) => {
    const trimmed = codeToFetch.trim();
    if (trimmed.length !== 6) {
      setError('Please enter a full 6-digit code.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const data = await getShare(trimmed);
      setShareData(data);
    } catch (err: any) {
      if (err instanceof ApiRequestError) {
        if (err.status === 429 && err.retryAfter) {
          setRateLimitSeconds(err.retryAfter);
        }
        setError(err.message);
      } else {
        setError(err.message || 'Error retrieving share. Please check the code.');
      }
      setShareData(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyText = async () => {
    if (!shareData?.text_content) return;
    try {
      await navigator.clipboard.writeText(shareData.text_content);
      setCopiedText(true);
      if (onNotify) onNotify('Text copied to clipboard');
      setTimeout(() => setCopiedText(false), 2000);
    } catch {
      // fallback
    }
  };

  const handleDeleteShare = async () => {
    if (!shareData) return;
    const confirmBurn = window.confirm(
      'Are you sure you want to delete this share now? The text and files will be permanently erased.'
    );
    if (!confirmBurn) return;

    setIsDeleting(true);
    try {
      await deleteShare(shareData.code);
      if (onNotify) onNotify('Share erased successfully');
      setShareData(null);
      setCode('');
    } catch (err: any) {
      setError(err.message || 'Failed to delete share');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleReset = () => {
    setShareData(null);
    setCode('');
    setError(null);
  };

  // Helper to render text with clickable links
  const renderTextWithLinks = (content: string) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = content.split(urlRegex);

    return parts.map((part, index) => {
      if (part.match(urlRegex)) {
        return (
          <a
            key={index}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="text-emerald-600 dark:text-emerald-400 underline hover:text-emerald-700 dark:hover:text-emerald-300 inline-flex items-center gap-1 break-all"
          >
            {part}
            <ExternalLink className="w-3 h-3 inline-block flex-shrink-0" />
          </a>
        );
      }
      return <span key={index}>{part}</span>;
    });
  };

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 md:p-8 shadow-sm">
      {!shareData ? (
        <div>
          <div className="text-center mb-6">
            <h2 className="text-xl font-bold text-zinc-900 dark:text-white">Retrieve a Share</h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
              Enter the 6-digit code provided by the sender.
            </p>
          </div>

          {/* Rate limit warning banner */}
          {rateLimitSeconds !== null && rateLimitSeconds > 0 && (
            <div className="mb-6 p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 flex items-center gap-3 text-amber-800 dark:text-amber-300 text-sm">
              <Lock className="w-5 h-5 flex-shrink-0 text-amber-600" />
              <div>
                <span className="font-semibold">Too many incorrect attempts.</span> Protection active.
                Try again in <span className="font-mono font-bold">{rateLimitSeconds}s</span>.
              </div>
            </div>
          )}

          {/* Error banner */}
          {error && rateLimitSeconds === null && (
            <div className="mb-6 p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 flex items-center gap-3 text-rose-800 dark:text-rose-300 text-sm">
              <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-500" />
              <div className="flex-1">{error}</div>
            </div>
          )}

          {/* Large Code Input */}
          <div className="flex flex-col items-center my-6">
            <CodeInput
              value={code}
              onChange={(newCode) => {
                setCode(newCode);
                setError(null);
              }}
              onSubmit={() => handleRetrieve(code)}
              disabled={isLoading || (rateLimitSeconds !== null && rateLimitSeconds > 0)}
              autoFocus={!initialCode}
            />
          </div>

          {/* Retrieve Button */}
          <button
            type="button"
            onClick={() => handleRetrieve(code)}
            disabled={
              isLoading ||
              code.length !== 6 ||
              (rateLimitSeconds !== null && rateLimitSeconds > 0)
            }
            className="w-full flex items-center justify-center gap-2 py-3.5 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-sm transition-all duration-150 shadow-sm shadow-emerald-600/20"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Checking code...</span>
              </>
            ) : (
              <span>Retrieve Shared Content</span>
            )}
          </button>
        </div>
      ) : (
        /* Share Retrieved View */
        <div className="flex flex-col gap-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-zinc-200 dark:border-zinc-800 gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase font-semibold tracking-wider text-zinc-400">
                  Retrieved Share
                </span>
                <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                  #{shareData.code}
                </span>
              </div>
              <h2 className="text-xl font-bold text-zinc-900 dark:text-white mt-1">Shared Content</h2>
            </div>

            <div className="min-w-[180px]">
              <CountdownTimer
                expiresAt={shareData.expires_at}
                onExpire={() => {
                  setError('This share has expired and was removed.');
                  setShareData(null);
                }}
              />
            </div>
          </div>

          {/* Text content preview */}
          {shareData.text_content && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
                  Shared Text / Link
                </span>
                <button
                  type="button"
                  onClick={handleCopyText}
                  className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 font-medium py-1 px-2 rounded-md hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-colors"
                >
                  {copiedText ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Text</span>
                    </>
                  )}
                </button>
              </div>

              <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800 text-sm text-zinc-800 dark:text-zinc-200 whitespace-pre-wrap break-words font-sans max-h-64 overflow-y-auto leading-relaxed">
                {renderTextWithLinks(shareData.text_content)}
              </div>
            </div>
          )}

          {/* Files List */}
          {shareData.files.length > 0 && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
                  Files ({shareData.files.length})
                </span>

                {shareData.files.length > 1 && (
                  <a
                    href={getDownloadAllUrl(shareData.code)}
                    download={`quickshare_${shareData.code}.zip`}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 py-1 px-2.5 rounded-lg border border-emerald-300 dark:border-emerald-800/80 bg-emerald-50/50 dark:bg-emerald-950/30 transition-colors"
                  >
                    <Archive className="w-3.5 h-3.5" />
                    <span>Download All (ZIP)</span>
                  </a>
                )}
              </div>

              <div className="flex flex-col gap-2">
                {shareData.files.map((file) => (
                  <div
                    key={file.id}
                    className="flex items-center justify-between p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-600 dark:text-zinc-400 flex-shrink-0">
                        <File className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-zinc-900 dark:text-white truncate">
                          {file.original_filename}
                        </p>
                        <p className="text-xs text-zinc-400">
                          {formatBytes(file.file_size)}
                        </p>
                      </div>
                    </div>

                    <a
                      href={getDownloadUrl(shareData.code, file.id)}
                      download={file.original_filename}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition-colors flex-shrink-0 shadow-sm"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download</span>
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Bottom actions: Burn now & Retrieve another */}
          <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row gap-3 justify-between items-center">
            <button
              type="button"
              onClick={handleDeleteShare}
              disabled={isDeleting}
              className="w-full sm:w-auto flex items-center justify-center gap-1.5 text-xs text-rose-600 dark:text-rose-400 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 py-2.5 px-3.5 rounded-lg transition-colors border border-transparent hover:border-rose-200 dark:hover:border-rose-900/60"
            >
              {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
              <span>Delete / Erase Share Now</span>
            </button>

            <button
              type="button"
              onClick={handleReset}
              className="w-full sm:w-auto flex items-center justify-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 py-2.5 px-4 rounded-lg font-medium transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retrieve Another Code</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
