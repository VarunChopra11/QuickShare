import React, { useEffect, useState } from 'react';
import { Clock, AlertTriangle } from 'lucide-react';

interface CountdownTimerProps {
  expiresAt: number; // Unix timestamp in seconds
  totalDurationSeconds?: number; // Default 600 (10 minutes)
  onExpire?: () => void;
  className?: string;
}

export const CountdownTimer: React.FC<CountdownTimerProps> = ({
  expiresAt,
  totalDurationSeconds = 600,
  onExpire,
  className = '',
}) => {
  const [remaining, setRemaining] = useState<number>(() => {
    const now = Math.floor(Date.now() / 1000);
    return Math.max(0, expiresAt - now);
  });

  useEffect(() => {
    const update = () => {
      const now = Math.floor(Date.now() / 1000);
      const diff = Math.max(0, expiresAt - now);
      setRemaining(diff);

      if (diff <= 0) {
        if (onExpire) onExpire();
      }
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [expiresAt, onExpire]);

  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  const formatted = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  const percent = Math.min(100, Math.max(0, (remaining / totalDurationSeconds) * 100));

  const isLow = remaining < 120; // under 2 minutes
  const isCritical = remaining < 30; // under 30 seconds

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <div className="flex items-center justify-between text-xs font-medium">
        <span className="flex items-center gap-1.5 text-zinc-600 dark:text-zinc-400">
          {isCritical ? (
            <AlertTriangle className="w-3.5 h-3.5 text-rose-500 animate-pulse" />
          ) : (
            <Clock className="w-3.5 h-3.5 text-zinc-500" />
          )}
          <span>Expires in</span>
        </span>
        <span
          className={`font-mono text-sm tracking-wider font-semibold ${
            isCritical
              ? 'text-rose-600 dark:text-rose-400'
              : isLow
              ? 'text-amber-600 dark:text-amber-400'
              : 'text-zinc-800 dark:text-zinc-200'
          }`}
        >
          {formatted}
        </span>
      </div>

      <div className="w-full bg-zinc-200 dark:bg-zinc-800 h-1.5 rounded-full overflow-hidden">
        <div
          className={`h-full transition-all duration-1000 ease-linear rounded-full ${
            isCritical
              ? 'bg-rose-500'
              : isLow
              ? 'bg-amber-500'
              : 'bg-emerald-500'
          }`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
};
