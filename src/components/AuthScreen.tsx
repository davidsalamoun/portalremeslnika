import React, { useState } from 'react';
import { FileText, Mail, Lock, LogIn, UserPlus, ArrowLeft, MailCheck, KeyRound, ShieldCheck } from 'lucide-react';
import { supabase, authErrorToCzech } from '../utils/supabase';

type AuthMode = 'login' | 'register' | 'forgot' | 'check-email' | 'reset-sent' | 'new-password';

interface AuthScreenProps {
  /** 'new-password' po kliknutí na odkaz pro obnovu hesla z e-mailu */
  initialMode?: 'login' | 'new-password';
  /** Zavolá se po úspěšném nastavení nového hesla */
  onPasswordUpdated?: () => void;
}

const inputClass =
  'w-full pl-10 pr-3.5 py-2.5 rounded-xl border text-sm bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-all focus:outline-hidden focus:ring-2 border-slate-300 dark:border-slate-700 focus:border-[#1E3A78] dark:focus:border-blue-500 focus:ring-blue-100 dark:focus:ring-blue-950';
const labelClass = 'block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1';
const primaryButtonClass =
  'w-full flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-sm font-black shadow-xs border border-amber-400 transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed';
const linkClass =
  'text-sm font-semibold text-[#1E3A78] dark:text-blue-400 hover:underline cursor-pointer';

export const AuthScreen: React.FC<AuthScreenProps> = ({ initialMode = 'login', onPasswordUpdated }) => {
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
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#F8F9FB] dark:bg-[#0B1120] text-slate-900 dark:text-slate-100 px-3 py-8 transition-colors">
      {/* Logo */}
      <div className="flex items-center gap-2.5 mb-6">
        <div className="w-11 h-11 rounded-xl bg-slate-950 text-white flex items-center justify-center shadow-xs border border-slate-800">
          <FileText className="w-5.5 h-5.5 text-amber-400" />
        </div>
        <div className="flex flex-col leading-tight">
          <span className="font-black text-xl text-slate-900 dark:text-white tracking-tight flex items-center gap-1.5">
            Řemeslník{' '}
            <span className="text-[10px] font-black px-1.5 py-0.2 rounded bg-amber-400 text-slate-950 tracking-wide">
              PRO
            </span>
          </span>
          <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
            smlouvy & zakázky
          </span>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl w-full max-w-md shadow-xl overflow-hidden">
        {/* Hlavička */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-900 text-white">
          <h1 className="font-extrabold text-lg leading-tight">{titles[mode].title}</h1>
          {titles[mode].subtitle && <p className="text-xs text-slate-300 mt-0.5">{titles[mode].subtitle}</p>}
        </div>

        {isInfo ? (
          <div className="p-5 space-y-4 text-center">
            <div className="w-14 h-14 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
              <MailCheck className="w-7 h-7" />
            </div>
            <p className="text-sm text-slate-700 dark:text-slate-300">
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
            <p className="text-xs text-slate-500 dark:text-slate-400">
              E-mail nedorazil? Zkontrolujte složku se spamem, případně to za chvíli zkuste znovu.
            </p>
            <button type="button" onClick={() => switchMode('login')} className={primaryButtonClass}>
              <ArrowLeft className="w-4 h-4" />
              <span>Zpět na přihlášení</span>
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-5 space-y-4" noValidate>
            {mode !== 'new-password' && (
              <div>
                <label htmlFor="auth-email" className={labelClass}>
                  E-mail
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
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
                <div className="flex items-center justify-between mb-1">
                  <label htmlFor="auth-password" className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                    {mode === 'new-password' ? 'Nové heslo' : 'Heslo'}
                  </label>
                  {mode === 'login' && (
                    <button type="button" onClick={() => switchMode('forgot')} className="text-xs font-semibold text-[#1E3A78] dark:text-blue-400 hover:underline cursor-pointer">
                      Zapomenuté heslo?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
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
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
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
                className="px-3.5 py-2.5 rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 text-sm text-rose-700 dark:text-rose-300"
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
              <p className="text-sm text-center text-slate-600 dark:text-slate-400">
                Ještě nemáte účet?{' '}
                <button type="button" onClick={() => switchMode('register')} className={linkClass}>
                  Zaregistrujte se
                </button>
              </p>
            )}
            {mode === 'register' && (
              <>
                <p className="text-xs text-slate-500 dark:text-slate-400 flex items-start gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>
                    Pokud už v tomto prohlížeči máte rozpracované smlouvy nebo klienty, po registraci se přenesou do
                    vašeho účtu.
                  </span>
                </p>
                <p className="text-sm text-center text-slate-600 dark:text-slate-400">
                  Už účet máte?{' '}
                  <button type="button" onClick={() => switchMode('login')} className={linkClass}>
                    Přihlaste se
                  </button>
                </p>
              </>
            )}
            {mode === 'forgot' && (
              <p className="text-sm text-center">
                <button type="button" onClick={() => switchMode('login')} className={linkClass}>
                  Zpět na přihlášení
                </button>
              </p>
            )}
          </form>
        )}
      </div>
    </div>
  );
};
