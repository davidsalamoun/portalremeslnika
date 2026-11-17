import React, { lazy, Suspense, useEffect, useState } from 'react';
import { Dialog } from './Dialog';
import { TERMS_HASH, TERMS_VERSION } from '../config/operator';
import { supabase } from '../utils/supabase';

// Samotný text podmínek se načítá až při otevření okna (není součástí úvodního balíku aplikace)
const TermsOfUseText = lazy(() => import('./TermsOfUseText').then((m) => ({ default: m.TermsOfUseText })));

/** Podmínky jako okno nad čímkoli – otevře je odkaz s `#podminky-pouzivani` (úvodní stránka, registrace, aplikace). */
export const TermsOfUseHost: React.FC = () => {
  const [open, setOpen] = useState(() => typeof window !== 'undefined' && window.location.hash === TERMS_HASH);
  useEffect(() => {
    const onHash = () => setOpen(window.location.hash === TERMS_HASH);
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  if (!open) return null;
  const close = () => {
    history.replaceState(null, '', window.location.pathname + window.location.search);
    setOpen(false);
  };
  return (
    <Dialog title="Podmínky používání" size="3xl" onClose={close}>
      <Suspense fallback={<p role="status" className="text-slate-600 dark:text-slate-400">Načítám…</p>}>
        <TermsOfUseText />
      </Suspense>
    </Dialog>
  );
};

/** Odkaz na podmínky (otevře okno s podmínkami). */
export const TermsLink: React.FC<{ className?: string; children?: React.ReactNode }> = ({ className, children }) => (
  <a href={TERMS_HASH} className={className ?? 'underline underline-offset-2 cursor-pointer'}>
    {children ?? 'Podmínky používání'}
  </a>
);

/** Údaje o souhlasu s podmínkami, které se ukládají k účtu (user_metadata v Supabase). */
export const termsAcceptance = () => ({ terms_version: TERMS_VERSION, terms_accepted_at: new Date().toISOString() });

/**
 * Pruh nad aplikací pro účet, který aktuální znění podmínek ještě nepotvrdil (účty založené před jejich vydáním
 * nebo před poslední změnou). Bez signálu se neukazuje – souhlas se ukládá do účtu.
 */
export const TermsUpdateBanner: React.FC = () => {
  const [state, setState] = useState<'hidden' | 'new' | 'updated'>('hidden');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!navigator.onLine) return;
    let active = true;
    supabase.auth
      .getSession()
      .then(({ data }) => {
        const meta = data.session?.user?.user_metadata as { terms_version?: string } | undefined;
        if (!active || !data.session) return;
        if (meta?.terms_version === TERMS_VERSION) return;
        setState(meta?.terms_version ? 'updated' : 'new');
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  if (state === 'hidden') return null;

  const accept = async () => {
    setBusy(true);
    setError(null);
    try {
      const { error: err } = await supabase.auth.updateUser({ data: termsAcceptance() });
      if (err) throw err;
      setState('hidden');
    } catch {
      setError('Souhlas se nepodařilo uložit. Zkontrolujte připojení k internetu a zkuste to znovu.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="no-print lg:pl-60 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
        <p className="flex-1 text-[15px] text-slate-700 dark:text-slate-200">
          <strong className="font-semibold text-slate-900 dark:text-white">
            {state === 'updated' ? 'Aktualizovali jsme podmínky používání.' : 'Vydali jsme podmínky používání aplikace.'}
          </strong>{' '}
          Prosíme o jejich potvrzení.
          {error && (
            <span role="alert" className="block mt-1 text-rose-700 dark:text-rose-300">
              {error}
            </span>
          )}
        </p>
        <div className="flex items-center gap-2 shrink-0">
          <TermsLink className="min-h-11 inline-flex items-center px-4 rounded-md border-[1.5px] border-slate-300 dark:border-slate-600 text-[15px] font-semibold text-slate-900 dark:text-white hover:bg-slate-50 dark:hover:bg-slate-800">
            Přečíst
          </TermsLink>
          <button
            type="button"
            onClick={accept}
            disabled={busy}
            className="min-h-11 px-4 rounded-md bg-amber-400 hover:bg-amber-300 text-slate-900 text-[15px] font-semibold border-[1.5px] border-slate-900 cursor-pointer disabled:opacity-60"
          >
            {busy ? 'Ukládám…' : 'Souhlasím'}
          </button>
        </div>
      </div>
    </div>
  );
};
