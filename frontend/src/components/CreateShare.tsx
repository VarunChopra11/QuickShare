import React, { useState, useRef } from 'react';
import { Upload, X, File, AlertCircle, ArrowRight, Loader2 } from 'lucide-react';
import { createShare, formatBytes, ApiRequestError } from '../services/api';
import { ShareCreateResponse } from '../types';
import { CodeDisplay } from './CodeDisplay';

interface CreateShareProps {
  onNotify?: (msg: string) => void;
}

export const CreateShare: React.FC<CreateShareProps> = ({ onNotify }) => {
  const [text, setText] = useState<string>('');
  const [files, setFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadPercent, setUploadPercent] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [createdShare, setCreatedShare] = useState<ShareCreateResponse | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFilesAdded = (newFiles: FileList | File[]) => {
    setError(null);
    const added = Array.from(newFiles);

    // Limit check
    if (files.length + added.length > 10) {
      setError('You can upload a maximum of 10 files per share.');
      return;
    }

    // Single file limit check (50MB)
    for (const f of added) {
      if (f.size > 50 * 1024 * 1024) {
        setError(`File "${f.name}" exceeds the 50 MB limit.`);
        return;
      }
    }

    setFiles((prev) => [...prev, ...added]);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFilesAdded(e.dataTransfer.files);
    }
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const hasText = text.trim().length > 0;
    const hasFiles = files.length > 0;

    if (!hasText && !hasFiles) {
      setError('Please provide some text or select at least one file to share.');
      return;
    }

    setIsUploading(true);
    setUploadPercent(0);

    try {
      const result = await createShare(
        hasText ? text : null,
        files,
        (percent) => setUploadPercent(percent)
      );
      setCreatedShare(result);
    } catch (err: any) {
      if (err instanceof ApiRequestError) {
        setError(err.message);
      } else {
        setError(err.message || 'Failed to create share. Please try again.');
      }
    } finally {
      setIsUploading(false);
    }
  };

  const handleReset = () => {
    setCreatedShare(null);
    setText('');
    setFiles([]);
    setError(null);
    setUploadPercent(0);
  };

  if (createdShare) {
    return (
      <CodeDisplay
        shareData={createdShare}
        onReset={handleReset}
        onCopyNotice={onNotify}
      />
    );
  }

  const totalBytes = files.reduce((acc, f) => acc + f.size, 0);

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 md:p-8 shadow-sm">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-zinc-900 dark:text-white">Create a Temporary Share</h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
          Share files or text. Content self-destructs automatically after 10 minutes.
        </p>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 flex items-start gap-3 text-rose-800 dark:text-rose-300 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-rose-500" />
          <div className="flex-1">
            <span className="font-semibold">Unable to create share:</span> {error}
          </div>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-rose-500 hover:text-rose-700"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        {/* Text / URL area */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label
              htmlFor="text-input"
              className="text-xs font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-400"
            >
              Text, Links, or Notes (Optional)
            </label>
            <span className="text-xs text-zinc-400">
              {text.length} / 50,000
            </span>
          </div>
          <textarea
            id="text-input"
            rows={4}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type text, paste URLs, credentials, or notes here..."
            maxLength={50000}
            className="w-full px-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/60 text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors resize-y text-sm font-sans"
          />
        </div>

        {/* File dropzone */}
        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 block mb-2">
            Files (Optional, max 50MB per file)
          </label>
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-6 sm:p-8 text-center cursor-pointer transition-colors duration-150 flex flex-col items-center justify-center
              ${
                isDragging
                  ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20'
                  : 'border-zinc-300 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-950/30'
              }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={(e) => {
                if (e.target.files) handleFilesAdded(e.target.files);
              }}
              className="hidden"
            />
            <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-3">
              <Upload className="w-6 h-6 stroke-[2.2]" />
            </div>
            <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
              Drag and drop files here, or <span className="text-emerald-600 dark:text-emerald-400 hover:underline">browse</span>
            </p>
            <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">
              Supports photos, documents, archives, code (up to 10 files)
            </p>
          </div>

          {/* Selected files list */}
          {files.length > 0 && (
            <div className="mt-4 flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400 px-1">
                <span>Selected Files ({files.length})</span>
                <span>Total: {formatBytes(totalBytes)}</span>
              </div>
              <div className="max-h-48 overflow-y-auto flex flex-col gap-1.5 pr-1">
                {files.map((file, idx) => (
                  <div
                    key={`${file.name}-${idx}`}
                    className="flex items-center justify-between px-3 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800/60 border border-zinc-200/60 dark:border-zinc-800 text-xs text-zinc-800 dark:text-zinc-200"
                  >
                    <div className="flex items-center gap-2 truncate pr-2">
                      <File className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                      <span className="truncate font-medium">{file.name}</span>
                      <span className="text-zinc-400 text-[11px] flex-shrink-0">
                        ({formatBytes(file.size)})
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFile(idx);
                      }}
                      className="text-zinc-400 hover:text-rose-500 transition-colors p-1"
                      aria-label="Remove file"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Upload progress indicator */}
        {isUploading && (
          <div className="flex flex-col gap-2 p-4 bg-zinc-50 dark:bg-zinc-950 rounded-xl border border-zinc-200 dark:border-zinc-800">
            <div className="flex items-center justify-between text-xs font-medium text-zinc-600 dark:text-zinc-400">
              <span className="flex items-center gap-1.5">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-500" />
                Encrypting & Transferring...
              </span>
              <span>{uploadPercent}%</span>
            </div>
            <div className="w-full bg-zinc-200 dark:bg-zinc-800 h-2 rounded-full overflow-hidden">
              <div
                className="bg-emerald-500 h-full transition-all duration-200 rounded-full"
                style={{ width: `${uploadPercent}%` }}
              />
            </div>
          </div>
        )}

        {/* Submit button */}
        <button
          type="submit"
          disabled={isUploading || (!text.trim() && files.length === 0)}
          className="w-full flex items-center justify-center gap-2 py-3.5 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-sm transition-all duration-150 shadow-sm shadow-emerald-600/20"
        >
          {isUploading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Generating 6-digit Code...</span>
            </>
          ) : (
            <>
              <span>Create Share & Get 6-Digit Code</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>
    </div>
  );
};
