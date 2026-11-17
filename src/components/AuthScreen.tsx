import React, { useState } from 'react';
import { Mail, Lock, LogIn, UserPlus, ArrowLeft, MailCheck, KeyRound, ShieldCheck } from 'lucide-react';
import { supabase, authErrorToCzech } from '../utils/supabase';
import { Logo, Metr } from './Logo';

type AuthMode = 'login' | 'register' | 'forgot' | 'check-email' | 'reset-sent' | 'new-password';

interface AuthScreenProps {
  /** 'new-password' po kliknutí na odkaz pro obnovu hesla z e-mailu */
  initialMode?: 'login' | 'register' | 'new-password';
  /** Zavolá se po úspěšném nastavení nového hesla */
  onPasswordUpdated?: () => void;
  /** Návrat na úvodní stránku (odkaz u značky) */
  onBack?: () => void;
}

const inputClass =
  'w-full min-h-[50px] pl-11 pr-3.5 rounded-md border-[1.5px] text-base bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 border-slate-900 dark:border-slate-500 focus:outline-hidden focus:ring-2 focus:ring-blue-600 dark:focus:ring-amber-400 focus:ring-offset-1 dark:focus:ring-offset-slate-950';
const labelClass = 'block text-base font-semibold text-slate-900 dark:text-slate-100 mb-1.5';
const primaryButtonClass =
  'w-full min-h-[52px] flex items-center justify-center gap-2 px-5 rounded-md bg-amber-400 hover:bg-amber-300 text-slate-900 text-[17px] font-semibold border-[1.5px] border-slate-900 transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed';
const linkClass = 'text-base font-semibold text-blue-600 dark:text-blue-300 underline underline-offset-2 cursor-pointer';

export const AuthScreen: React.FC<AuthScreenProps> = ({ initialMode = 'login', onPasswordUpdated, onBack }) => {
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordAgain, setPasswordAgain] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const switchMode = (next: AuthMode) => {
    setError(null);
    setPassword('');
    setPasswordAgain('');
    setMode(next);
  };

  const validatePassword = (): boolean => {
    if (password.length < 8) {
      setError('Heslo musí mít alespoň 8 znaků.');
      return false;
    }
    if (password !== passwordAgain) {
      setError('Hesla se neshodují.');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isBusy) return;
    setError(null);
    const cleanEmail = email.trim();

    if (mode !== 'new-password' && !/^\S+@\S+\.\S+$/.test(cleanEmail)) {
      setError('Zadejte platnou e-mailovou adresu.');
      return;
    }

    setIsBusy(true);
    try {
      if (mode === 'login') {
        const { error: err } = await supabase.auth.signInWithPassword({ email: cleanEmail, password });
        if (err) throw err;
      } else if (mode === 'register') {
        if (!validatePassword()) return;
        const { data, error: err } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (err) throw err;
        if (data.user && data.user.identities && data.user.identities.length === 0) {
          setError('Účet s tímto e-mailem už existuje. Přihlaste se, nebo si obnovte heslo.');
          return;
        }
        if (!data.session) switchMode('check-email');
      } else if (mode === 'forgot') {
        const { error: err } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
          redirectTo: window.location.origin,
        });
        if (err) throw err;
        switchMode('reset-sent');
      } else if (mode === 'new-password') {
        if (!validatePassword()) return;
        const { error: err } = await supabase.auth.updateUser({ password });
        if (err) throw err;
        onPasswordUpdated?.();
      }
    } catch (err: any) {
      setError(authErrorToCzech(err));
    } finally {
      setIsBusy(false);
    }
  };

  const titles: Record<AuthMode, { title: string; subtitle: string }> = {
    login: { title: 'Přihlášení', subtitle: 'Přihlaste se ke svým smlouvám, klientům a fakturám.' },
    register: { title: 'Nový účet', subtitle: 'Vaše data budou bezpečně uložená a dostupná z mobilu i počítače.' },
    forgot: { title: 'Zapomenuté heslo', subtitle: 'Pošleme vám e-mail s odkazem pro nastavení nového hesla.' },
    'check-email': { title: 'Potvrďte svůj e-mail', subtitle: '' },
    'reset-sent': { title: 'E-mail odeslán', subtitle: '' },
    'new-password': { title: 'Nové heslo', subtitle: 'Zvolte si nové heslo ke svému účtu.' },
  };

  const isInfo = mode === 'check-email' || mode === 'reset-sent';

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-[#F4F5F2] dark:bg-[#111316] text-slate-900 dark:text-slate-100 transition-colors">
      {/* Levá část: značka, jedna věta o tom, co aplikace dělá, a metr s cestou zakázky */}
      <div
        className="lg:flex-1 flex flex-col justify-between gap-8 lg:gap-12 px-6 py-7 sm:px-10 lg:px-14 lg:py-12 bg-blue-600 text-white"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.09) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.09) 1px, transparent 1px), linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)',
          backgroundSize: '120px 120px, 120px 120px, 24px 24px, 24px 24px',
        }}
      >
        {onBack ? (
          <button type="button" onClick={onBack} aria-label="Řemeslník PRO – úvodní stránka" className="self-start cursor-pointer">
            <Logo size={34} />
          </button>
        ) : (
          <Logo size={34} />
        )}

        <div className="max-w-xl">
          <p className="font-display font-bold text-3xl sm:text-5xl lg:text-6xl leading-[1.04]">
            Smlouva, faktura i předávací protokol dřív, než sbalíte nářadí.
          </p>
          <p className="hidden sm:block mt-5 text-lg text-blue-100 max-w-md">
            Zakázky, podpisy zákazníků a platby na jednom místě. V mobilu na stavbě i večer u počítače.
          </p>
        </div>

        <div className="hidden sm:flex flex-col gap-2 max-w-md">
          <Metr step={5} done animate onDark label="Cesta zakázky od poptávky po zaplacení" />
          <div className="grid grid-cols-6 text-[13px] text-blue-100">
            <span>Poptávka</span>
            <span>Nabídka</span>
            <span>Smlouva</span>
            <span>Realizace</span>
            <span>Předáno</span>
            <span>Zaplaceno</span>
          </div>
        </div>
      </div>

      {/* Pravá část: formulář */}
      <div className="flex-1 flex items-start lg:items-center justify-center px-6 py-8 sm:px-10 lg:px-14 lg:py-12">
      <div className="w-full max-w-sm">
        <div className="mb-6">
          <h1 className="font-bold text-4xl leading-tight">{titles[mode].title}</h1>
          {titles[mode].subtitle && (
            <p className="text-base text-slate-600 dark:text-slate-300 mt-1">{titles[mode].subtitle}</p>
          )}
        </div>

        {isInfo ? (
          <div className="space-y-4">
            <div className="w-14 h-14 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <MailCheck className="w-7 h-7" />
            </div>
            <p className="text-base text-slate-700 dark:text-slate-300">
              {mode === 'check-email' ? (
                <>
                  Na adresu <strong>{email.trim()}</strong> jsme poslali potvrzovací e-mail. Klikněte v něm na odkaz
                  a účet bude aktivní.
                </>
              ) : (
                <>
                  Pokud u nás existuje účet s adresou <strong>{email.trim()}</strong>, poslali jsme na ni odkaz pro
                  nastavení nového hesla.
                </>
              )}
            </p>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              E-mail nedorazil? Zkontrolujte složku se spamem, případně to za chvíli zkuste znovu.
            </p>
            <button type="button" onClick={() => switchMode('login')} className={primaryButtonClass}>
              <ArrowLeft className="w-4 h-4" />
              <span>Zpět na přihlášení</span>
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            {mode !== 'new-password' && (
              <div>
                <label htmlFor="auth-email" className={labelClass}>
                  E-mail
                </label>
                <div className="relative">
                  <Mail className="w-5 h-5 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    id="auth-email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="vas@email.cz"
                    className={inputClass}
                    required
                  />
                </div>
              </div>
            )}

            {mode !== 'forgot' && (
              <div>
                <div className="flex items-baseline justify-between gap-3 mb-1.5">
                  <label htmlFor="auth-password" className="text-base font-semibold text-slate-900 dark:text-slate-100">
                    {mode === 'new-password' ? 'Nové heslo' : 'Heslo'}
                  </label>
                  {mode === 'login' && (
                    <button type="button" onClick={() => switchMode('forgot')} className="text-[15px] font-medium text-blue-600 dark:text-blue-300 underline underline-offset-2 cursor-pointer">
                      Zapomenuté heslo?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Lock className="w-5 h-5 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    id="auth-password"
                    type="password"
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={mode === 'login' ? 'Vaše heslo' : 'Alespoň 8 znaků'}
                    className={inputClass}
                    required
                  />
                </div>
              </div>
            )}

            {(mode === 'register' || mode === 'new-password') && (
              <div>
                <label htmlFor="auth-password-again" className={labelClass}>
                  Heslo znovu
                </label>
                <div className="relative">
                  <Lock className="w-5 h-5 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    id="auth-password-again"
                    type="password"
                    autoComplete="new-password"
                    value={passwordAgain}
                    onChange={(e) => setPasswordAgain(e.target.value)}
                    placeholder="Zopakujte heslo"
                    className={inputClass}
                    required
                  />
                </div>
              </div>
            )}

            {error && (
              <div
                role="alert"
                className="px-3.5 py-2.5 rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 text-base text-rose-700 dark:text-rose-300"
              >
                {error}
              </div>
            )}

            <button type="submit" disabled={isBusy} className={primaryButtonClass}>
              {mode === 'login' && <LogIn className="w-4 h-4" />}
              {mode === 'register' && <UserPlus className="w-4 h-4" />}
              {mode === 'forgot' && <Mail className="w-4 h-4" />}
              {mode === 'new-password' && <KeyRound className="w-4 h-4" />}
              <span>
                {isBusy
                  ? 'Chvíli strpení…'
                  : mode === 'login'
                    ? 'Přihlásit se'
                    : mode === 'register'
                      ? 'Vytvořit účet'
                      : mode === 'forgot'
                        ? 'Poslat odkaz pro obnovu'
                        : 'Uložit nové heslo'}
              </span>
            </button>

            {mode === 'login' && (
              <p className="text-base text-slate-600 dark:text-slate-300">
                Ještě nemáte účet?{' '}
                <button type="button" onClick={() => switchMode('register')} className={linkClass}>
                  Zaregistrujte se
                </button>
              </p>
            )}
            {mode === 'register' && (
              <>
                <p className="text-sm text-slate-600 dark:text-slate-400 flex items-start gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>
                    Pokud už v tomto prohlížeči máte rozpracované smlouvy nebo klienty, po registraci se přenesou do
                    vašeho účtu.
                  </span>
                </p>
                <p className="text-base text-slate-600 dark:text-slate-300">
                  Už účet máte?{' '}
                  <button type="button" onClick={() => switchMode('login')} className={linkClass}>
                    Přihlaste se
                  </button>
                </p>
              </>
            )}
            {mode === 'forgot' && (
              <p className="text-base">
                <button type="button" onClick={() => switchMode('login')} className={linkClass}>
                  Zpět na přihlášení
                </button>
              </p>
            )}
          </form>
        )}
      </div>
      </div>
    </div>
  );
};
