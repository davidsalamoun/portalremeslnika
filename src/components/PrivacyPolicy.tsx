import React, { lazy, Suspense, useEffect, useState } from 'react';
import { Dialog } from './Dialog';
import { PRIVACY_HASH } from '../config/operator';

// Samotný text zásad se načítá až při otevření okna (není součástí úvodního balíku aplikace)
const PrivacyPolicyText = lazy(() => import('./PrivacyPolicyText').then((m) => ({ default: m.PrivacyPolicyText })));

/** Zásady jako okno nad čímkoli – otevře je odkaz s `#ochrana-osobnich-udaju` (úvodní stránka, registrace, aplikace, portál). */
export const PrivacyPolicyHost: React.FC = () => {
  const [open, setOpen] = useState(() => typeof window !== 'undefined' && window.location.hash === PRIVACY_HASH);
  useEffect(() => {
    const onHash = () => setOpen(window.location.hash === PRIVACY_HASH);
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  if (!open) return null;
  const close = () => {
    history.replaceState(null, '', window.location.pathname + window.location.search);
    setOpen(false);
  };
  return (
    <Dialog title="Ochrana osobních údajů" size="3xl" onClose={close}>
      <Suspense fallback={<p role="status" className="text-slate-600 dark:text-slate-400">Načítám…</p>}>
        <PrivacyPolicyText />
      </Suspense>
    </Dialog>
  );
};

/** Odkaz na zásady (otevře okno se zásadami). */
export const PrivacyLink: React.FC<{ className?: string; children?: React.ReactNode }> = ({ className, children }) => (
  <a href={PRIVACY_HASH} className={className ?? 'underline underline-offset-2 cursor-pointer'}>
    {children ?? 'Ochrana osobních údajů'}
  </a>
);
