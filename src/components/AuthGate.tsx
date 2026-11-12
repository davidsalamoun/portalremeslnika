import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { RefreshCw, CloudOff } from 'lucide-react';
import { supabase, toCloudUser, CloudUser } from '../utils/supabase';
import { connectAccount, needsAccountConnect, startAutoSync } from '../utils/cloudSync';
import { AuthScreen } from './AuthScreen';

const CloudUserContext = createContext<CloudUser | null>(null);

/** Přihlášený uživatel (null jen v portálu pro online podpis, kde se nepřihlašuje). */
export function useCloudUser(): CloudUser | null {
  return useContext(CloudUserContext);
}

type Phase = 'loading' | 'signed-out' | 'recovery' | 'connecting' | 'connect-error' | 'ready';

function applySavedTheme() {
  try {
    const saved = localStorage.getItem('theme');
    const dark = saved ? saved === 'dark' : window.matchMedia?.('(prefers-color-scheme: dark)').matches;
    document.documentElement.classList.toggle('dark', !!dark);
  } catch {
    // bez přístupu k úložišti zůstane světlý režim
  }
}

const FullScreenMessage: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-[#F8F9FB] dark:bg-[#0B1120] text-slate-700 dark:text-slate-200 px-4 text-center">
    {children}
  </div>
);

/**
 * Pustí do aplikace jen přihlášeného uživatele a při prvním přihlášení v prohlížeči propojí data s účtem.
 * Portál pro online podpis (?sign=…) přihlášení nevyžaduje – otevírá ho zákazník řemeslníka.
 */
export const AuthGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const isSigningPortal = useRef(
    (() => {
      try {
        return !!new URLSearchParams(window.location.search).get('sign');
      } catch {
        return false;
      }
    })()
  ).current;

  const [phase, setPhase] = useState<Phase>('loading');
  const [user, setUser] = useState<CloudUser | null>(null);
  const [connectAttempt, setConnectAttempt] = useState(0);

  useEffect(() => {
    applySavedTheme();
  }, []);

  // Sledování přihlášení
  useEffect(() => {
    if (isSigningPortal) return;
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      const next = toCloudUser(data.session?.user);
      setUser(next);
      setPhase((prev) => (prev === 'recovery' ? prev : next ? 'connecting' : 'signed-out'));
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      const next = toCloudUser(session?.user);
      if (event === 'PASSWORD_RECOVERY') {
        setUser(next);
        setPhase('recovery');
        return;
      }
      if (event === 'SIGNED_OUT' || !next) {
        setUser(null);
        setPhase('signed-out');
        return;
      }
      if (event === 'SIGNED_IN') {
        setUser((prev) => (prev?.uid === next.uid ? prev : next));
        setPhase((prev) => (prev === 'signed-out' || prev === 'loading' ? 'connecting' : prev));
      }
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [isSigningPortal]);

  // Propojení prohlížeče s účtem (jen poprvé, nebo po změně účtu)
  useEffect(() => {
    if (phase !== 'connecting' || !user) return;
    if (!needsAccountConnect(user.uid)) {
      setPhase('ready');
      return;
    }
    let active = true;
    connectAccount(user.uid)
      .then(() => active && setPhase('ready'))
      .catch((err) => {
        console.error('Propojení s účtem se nezdařilo:', err);
        if (active) setPhase('connect-error');
      });
    return () => {
      active = false;
    };
  }, [phase, user, connectAttempt]);

  // Průběžná synchronizace, dokud je uživatel v aplikaci
  useEffect(() => {
    if (phase !== 'ready' || !user) return;
    return startAutoSync();
  }, [phase, user]);

  if (isSigningPortal) return <>{children}</>;

  if (phase === 'loading') {
    return (
      <FullScreenMessage>
        <RefreshCw className="w-6 h-6 animate-spin text-slate-400" />
      </FullScreenMessage>
    );
  }

  if (phase === 'signed-out') return <AuthScreen />;

  if (phase === 'recovery') {
    return <AuthScreen initialMode="new-password" onPasswordUpdated={() => setPhase('connecting')} />;
  }

  if (phase === 'connecting') {
    return (
      <FullScreenMessage>
        <RefreshCw className="w-6 h-6 animate-spin text-amber-500" />
        <p className="text-sm font-semibold">Načítám vaše data…</p>
      </FullScreenMessage>
    );
  }

  if (phase === 'connect-error') {
    return (
      <FullScreenMessage>
        <CloudOff className="w-8 h-8 text-rose-500" />
        <div>
          <p className="text-base font-bold text-slate-900 dark:text-white">Nepodařilo se načíst data z účtu</p>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-sm">
            Zkontrolujte připojení k internetu a zkuste to znovu. Data v tomto prohlížeči zůstala beze změny.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => {
              setPhase('connecting');
              setConnectAttempt((n) => n + 1);
            }}
            className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-sm font-black border border-amber-400 cursor-pointer transition-colors"
          >
            Zkusit znovu
          </button>
          <button
            type="button"
            onClick={() => void supabase.auth.signOut({ scope: 'local' })}
            className="px-4 py-2.5 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 cursor-pointer transition-colors"
          >
            Odhlásit se
          </button>
        </div>
      </FullScreenMessage>
    );
  }

  return <CloudUserContext.Provider value={user}>{children}</CloudUserContext.Provider>;
};
