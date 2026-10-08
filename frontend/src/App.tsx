import React, { useState, useEffect } from 'react';
import { Send, Inbox, Shield, Zap, Sparkles } from 'lucide-react';
import { Header } from './components/Header';
import { CreateShare } from './components/CreateShare';
import { ReceiveShare } from './components/ReceiveShare';
import { Toast } from './components/Toast';

type Tab = 'send' | 'receive';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('send');
  const [initialCode, setInitialCode] = useState<string>('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Check URL query parameters for code (e.g. ?code=123456)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const codeParam = params.get('code');
    if (codeParam && /^\d{6}$/.test(codeParam)) {
      setInitialCode(codeParam);
      setActiveTab('receive');
    }
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  return (
    <div className="min-h-screen flex flex-col bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
      <Header />

      <main className="flex-1 max-w-2xl w-full mx-auto px-4 py-8 md:py-12 flex flex-col justify-start">
        {/* Navigation Tabs */}
        <div className="flex justify-center mb-8">
          <div className="inline-flex p-1 rounded-xl bg-zinc-200/70 dark:bg-zinc-800/70 border border-zinc-200 dark:border-zinc-700/60 shadow-inner">
            <button
              type="button"
              onClick={() => setActiveTab('send')}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-semibold transition-all duration-150 ${
                activeTab === 'send'
                  ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-sm'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
              }`}
            >
              <Send className="w-4 h-4" />
              <span>Send</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('receive')}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-semibold transition-all duration-150 ${
                activeTab === 'receive'
                  ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-sm'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
              }`}
            >
              <Inbox className="w-4 h-4" />
              <span>Receive</span>
            </button>
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'send' ? (
          <CreateShare onNotify={showToast} />
        ) : (
          <ReceiveShare initialCode={initialCode} onNotify={showToast} />
        )}

        {/* Privacy & Feature Highlights */}
        <div className="mt-12 grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
          <div className="p-4 rounded-xl bg-white/50 dark:bg-zinc-900/40 border border-zinc-200/50 dark:border-zinc-800/50 flex flex-col items-center">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-2">
              <Zap className="w-4 h-4" />
            </div>
            <h3 className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">10-Minute Ephemeral</h3>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1">
              Data and physical files are wiped clean from disk immediately upon expiration.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-white/50 dark:bg-zinc-900/40 border border-zinc-200/50 dark:border-zinc-800/50 flex flex-col items-center">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-2">
              <Shield className="w-4 h-4" />
            </div>
            <h3 className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">Zero Accounts</h3>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1">
              No signups, passwords, or tracking cookies. Just simple 6-digit PIN transfers.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-white/50 dark:bg-zinc-900/40 border border-zinc-200/50 dark:border-zinc-800/50 flex flex-col items-center">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-2">
              <Sparkles className="w-4 h-4" />
            </div>
            <h3 className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">Brute-Force Protected</h3>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1">
              Rate limiting, entropy checks, and lockout defenses block enumeration attacks.
            </p>
          </div>
        </div>
      </main>

      <footer className="py-6 text-center text-xs text-zinc-500 dark:text-zinc-500 border-t border-zinc-200/60 dark:border-zinc-800/60">
        <p>QuickShare • Lightweight ARM-optimized temporary transfer service</p>
      </footer>

      <Toast message={toastMessage} />
    </div>
  );
};
