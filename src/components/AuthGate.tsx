import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { RefreshCw, CloudOff } from 'lucide-react';
import { supabase, toCloudUser, CloudUser, getStoredSessionUser } from '../utils/supabase';
import { connectAccount, needsAccountConnect, startAutoSync, prepareLocalData } from '../utils/cloudSync';
import { AuthScreen } from './AuthScreen';
import { LandingPage } from './LandingPage';
import { TermsUpdateBanner } from './TermsOfUse';

// Kdo se na tomto zařízení už někdy přihlásil, uvidí po odhlášení rovnou přihlášení, ne úvodní stránku
const RETURNING_KEY = 'remeslnik_returning_user';
const isReturningUser = () => {
  try {
    return localStorage.getItem(RETURNING_KEY) === '1';
  } catch {
    return false;
  }
};
import { resolveIsDark, applyTheme, watchSystemTheme } from '../utils/theme';

const CloudUserContext = createContext<CloudUser | null>(null);

/** Přihlášený uživatel (null jen v portálu pro online podpis, kde se nepřihlašuje). */
export function useCloudUser(): CloudUser | null {
  return useContext(CloudUserContext);
}

type Phase = 'loading' | 'signed-out' | 'recovery' | 'connecting' | 'connect-error' | 'ready';

const FullScreenMessage: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-[#F4F5F2] dark:bg-[#111316] text-slate-700 dark:text-slate-200 px-4 text-center">
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
  // Nepřihlášený: úvodní stránka, nebo přihlášení / registrace
  const [authView, setAuthView] = useState<'landing' | 'login' | 'register'>(() => (isReturningUser() ? 'login' : 'landing'));
  const localReady = useRef(false);

  // Režim podle zařízení nebo vlastní volby uživatele – i na přihlašovací obrazovce
  useEffect(() => {
    applyTheme(resolveIsDark());
    return watchSystemTheme(applyTheme);
  }, []);

  // Sledování přihlášení
  useEffect(() => {
    if (isSigningPortal) return;
    let active = true;

    // Nejdřív připravit lokální data (obrázky do paměti, převod starších dat), teprve pak pustit aplikaci
    // Bez signálu se Supabase snaží vypršelý přístupový klíč obnovit až půl minuty. Když je v prohlížeči uložené
    // přihlášení, aplikace na to nečeká: po krátké chvíli (bez sítě hned) pustí uživatele k datům v zařízení.
    const storedUser = getStoredSessionUser();
    const sessionUser = supabase.auth.getSession().then(({ data }) => toCloudUser(data.session?.user));
    const userOrTimeout: Promise<CloudUser | null | undefined> = storedUser
      ? Promise.race([sessionUser, new Promise<undefined>((resolve) => setTimeout(() => resolve(undefined), navigator.onLine ? 4000 : 0))])
      : sessionUser;
    Promise.all([userOrTimeout, prepareLocalData().catch((err) => console.warn(err))]).then(([sessionResult]) => {
      if (!active) return;
      localReady.current = true;
      // Bez signálu nejde obnovit vypršelý přístupový klíč – uložené přihlášení ale platí dál
      const next = sessionResult ?? getStoredSessionUser();
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
        // Bez signálu Supabase ohlásí „žádné přihlášení“, i když uložené přihlášení trvá – to není odhlášení
        if (event !== 'SIGNED_OUT' && getStoredSessionUser()) return;
        setUser(null);
        setPhase('signed-out');
        return;
      }
      if (event === 'SIGNED_IN') {
        setUser((prev) => (prev?.uid === next.uid ? prev : next));
        setPhase((prev) => {
          if (prev === 'signed-out') return 'connecting';
          // Při startu se čeká na přípravu lokálních dat (viz getSession výše)
          if (prev === 'loading' && localReady.current) return 'connecting';
          return prev;
        });
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
    let active = true;
    if (!needsAccountConnect(user.uid)) {
      // Aplikace smí číst data až po načtení obrázků do paměti
      prepareLocalData().then(() => active && setPhase('ready'));
      return () => {
        active = false;
      };
    }
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
    try {
      localStorage.setItem(RETURNING_KEY, '1');
    } catch {
      // bez úložiště se příště ukáže úvodní stránka
    }
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

  if (phase === 'signed-out') {
    if (authView === 'landing') {
      return <LandingPage onLogin={() => setAuthView('login')} onRegister={() => setAuthView('register')} />;
    }
    return <AuthScreen key={authView} initialMode={authView} onBack={() => setAuthView('landing')} />;
  }

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

  return (
    <CloudUserContext.Provider value={user}>
      <TermsUpdateBanner key={user?.uid} />
      {children}
    </CloudUserContext.Provider>
  );
};
