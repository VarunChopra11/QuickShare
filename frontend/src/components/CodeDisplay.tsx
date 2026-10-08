import React, { useState } from 'react';
import { Copy, Check, Share2, Link as LinkIcon, RefreshCw, FileText, HardDrive } from 'lucide-react';
import { CountdownTimer } from './CountdownTimer';
import { ShareCreateResponse } from '../types';

interface CodeDisplayProps {
  shareData: ShareCreateResponse;
  onReset: () => void;
  onCopyNotice?: (msg: string) => void;
}

export const CodeDisplay: React.FC<CodeDisplayProps> = ({
  shareData,
  onReset,
  onCopyNotice,
}) => {
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const getShareLink = () => {
    const url = new URL(window.location.origin);
    url.searchParams.set('code', shareData.code);
    return url.toString();
  };

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(shareData.code);
      setCopiedCode(true);
      if (onCopyNotice) onCopyNotice('Code copied to clipboard');
      setTimeout(() => setCopiedCode(false), 2000);
    } catch {
      // fallback
    }
  };

  const handleCopyLink = async () => {
    try {
      const link = getShareLink();
      await navigator.clipboard.writeText(link);
      setCopiedLink(true);
      if (onCopyNotice) onCopyNotice('Direct link copied to clipboard');
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      // fallback
    }
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'QuickShare Transfer',
          text: `Enter code ${shareData.code} on QuickShare to retrieve shared content:`,
          url: getShareLink(),
        });
      } catch {
        // user cancelled share
      }
    } else {
      handleCopyLink();
    }
  };

  // Format code with a space in the middle for readability: "123 456"
  const formattedCode = `${shareData.code.slice(0, 3)} ${shareData.code.slice(3)}`;

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 md:p-8 shadow-sm flex flex-col gap-6">
      <div className="text-center">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-100/80 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 border border-emerald-300/50 dark:border-emerald-800 mb-3">
          <Check className="w-3.5 h-3.5" /> Ready for retrieval
        </div>
        <h2 className="text-xl font-bold text-zinc-900 dark:text-white">Share Created Successfully</h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
          Enter this 6-digit code on the receiving device to retrieve your content.
        </p>
      </div>

      {/* Prominent 6-digit PIN display */}
      <div
        onClick={handleCopyCode}
        className="cursor-pointer group relative bg-zinc-50 dark:bg-zinc-950/80 border-2 border-dashed border-emerald-500/40 hover:border-emerald-500 dark:border-emerald-600/40 dark:hover:border-emerald-500 rounded-2xl p-6 text-center transition-all duration-200"
      >
        <span className="text-xs uppercase tracking-wider font-semibold text-zinc-400 dark:text-zinc-500 block mb-2">
          Sharing Code
        </span>
        <div className="text-4xl md:text-5xl font-extrabold font-mono tracking-[0.25em] text-zinc-900 dark:text-white select-all">
          {formattedCode}
        </div>
        <div className="mt-3 flex items-center justify-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
          {copiedCode ? (
            <>
              <Check className="w-4 h-4" />
              <span>Copied to clipboard!</span>
            </>
          ) : (
            <>
              <Copy className="w-4 h-4 group-hover:scale-110 transition-transform" />
              <span>Click code to copy</span>
            </>
          )}
        </div>
      </div>

      {/* Expiration countdown */}
      <div className="bg-zinc-50 dark:bg-zinc-950/50 p-4 rounded-xl border border-zinc-200/60 dark:border-zinc-800/80">
        <CountdownTimer
          expiresAt={shareData.expires_at}
          totalDurationSeconds={shareData.expires_in_seconds}
        />
      </div>

      {/* Summary info */}
      <div className="flex items-center justify-around py-2 px-3 border border-zinc-100 dark:border-zinc-800/60 rounded-xl bg-zinc-50/50 dark:bg-zinc-900/50 text-xs text-zinc-600 dark:text-zinc-400">
        <div className="flex items-center gap-1.5">
          <FileText className="w-4 h-4 text-zinc-400" />
          <span>{shareData.has_text ? 'Includes text' : 'No text'}</span>
        </div>
        <div className="w-px h-4 bg-zinc-200 dark:bg-zinc-800" />
        <div className="flex items-center gap-1.5">
          <HardDrive className="w-4 h-4 text-zinc-400" />
          <span>{shareData.file_count} {shareData.file_count === 1 ? 'file' : 'files'}</span>
        </div>
      </div>

      {/* Action buttons */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button
          type="button"
          onClick={handleCopyLink}
          className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/80 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-sm font-medium text-zinc-800 dark:text-zinc-200 transition-colors shadow-sm"
        >
          {copiedLink ? <Check className="w-4 h-4 text-emerald-500" /> : <LinkIcon className="w-4 h-4 text-zinc-500" />}
          <span>{copiedLink ? 'Link Copied!' : 'Copy Direct Link'}</span>
        </button>

        {typeof navigator !== 'undefined' && 'share' in navigator ? (
          <button
            type="button"
            onClick={handleNativeShare}
            className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/80 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-sm font-medium text-zinc-800 dark:text-zinc-200 transition-colors shadow-sm"
          >
            <Share2 className="w-4 h-4 text-zinc-500" />
            <span>Share via Device...</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={handleCopyCode}
            className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/80 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-sm font-medium text-zinc-800 dark:text-zinc-200 transition-colors shadow-sm"
          >
            {copiedCode ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4 text-zinc-500" />}
            <span>{copiedCode ? 'Code Copied!' : 'Copy Code Only'}</span>
          </button>
        )}
      </div>

      {/* Create another button */}
      <button
        type="button"
        onClick={onReset}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-900 text-sm font-medium transition-colors"
      >
        <RefreshCw className="w-4 h-4" />
        <span>Share Something Else</span>
      </button>
    </div>
  );
};
