import React, { useState, useEffect } from 'react';
import { X, Cloud, CloudCheck, CloudOff, LogOut, RefreshCw, Info, Trash2, Download, AlertTriangle } from 'lucide-react';
import { CloudUser } from '../utils/supabase';
import {
  syncNow,
  signOutAndClear,
  deleteAccount,
  getCloudSyncStatus,
  subscribeCloudSyncStatus,
  CloudSyncStatus,
} from '../utils/cloudSync';
import { Contract, Client } from '../types/contract';
import { exportAppBackup } from '../utils/backup';

interface CloudAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: CloudUser | null;
  clients: Client[];
  contracts: Contract[];
  onToast?: (type: 'success' | 'error' | 'info', text: string) => void;
}

export const CloudAccountModal: React.FC<CloudAccountModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  clients,
  contracts,
  onToast,
}) => {
  const [status, setStatus] = useState<CloudSyncStatus>(getCloudSyncStatus);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [view, setView] = useState<'account' | 'data-info' | 'delete'>('account');
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteConfirmed, setDeleteConfirmed] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Po zavření se modál příště otevře znovu na přehledu účtu
  useEffect(() => {
    if (!isOpen) {
      setView('account');
      setDeletePassword('');
      setDeleteConfirmed(false);
      setDeleteError(null);
    }
  }, [isOpen]);

  useEffect(() => subscribeCloudSyncStatus(setStatus), []);

  if (!isOpen || !currentUser) return null;

  const isSyncing = status.phase === 'syncing';
  const lastSyncTime = status.lastSyncAt
    ? new Date(status.lastSyncAt).toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' })
    : null;

  const handleSync = async () => {
    const ok = await syncNow();
    if (!onToast) return;
    if (ok) onToast('success', 'Všechna data jsou uložená ve vašem účtu.');
    else onToast('error', 'Synchronizace se nezdařila. Zkontrolujte připojení k internetu; změny zůstávají uložené v tomto zařízení.');
  };

  const handleDeleteAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isDeleting || !currentUser?.email) return;
    setDeleteError(null);
    if (!deleteConfirmed) {
      setDeleteError('Potvrďte prosím zaškrtnutím, že smazání nejde vrátit.');
      return;
    }
    if (!deletePassword) {
      setDeleteError('Zadejte své heslo.');
      return;
    }
    setIsDeleting(true);
    try {
      const result = await deleteAccount(currentUser.email, deletePassword);
      if (result === 'wrong_password') setDeleteError('Heslo není správné.');
      else if (result === 'failed') {
        setDeleteError('Účet se nepodařilo smazat. Zkontrolujte připojení k internetu a zkuste to znovu.');
      }
    } finally {
      setIsDeleting(false);
    }
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await signOutAndClear();
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl w-full max-w-lg shadow-2xl overflow-hidden my-auto">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-900 text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-amber-400">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base leading-tight">Cloudový účet řemeslníka</h3>
              <p className="text-xs text-slate-300">
                Synchronizace smluv, klientů a cen mezi mobilem a PC
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content body */}
        <div className="p-5 space-y-5">
          {view === 'account' && (
          <div className="space-y-4">
            <div className="flex items-center gap-3.5 p-3.5 bg-blue-50/70 dark:bg-blue-950/40 rounded-xl border border-blue-200/80 dark:border-blue-800/60">
              <div className="w-12 h-12 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-lg">
                {currentUser.email?.charAt(0).toUpperCase() || 'U'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-slate-900 dark:text-white truncate">
                  {currentUser.displayName || 'Řemeslník'}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                  {currentUser.email}
                </div>
                {status.phase === 'error' ? (
                  <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-amber-600 dark:text-amber-400 font-semibold">
                    <CloudOff className="w-3.5 h-3.5" />
                    <span>Bez spojení – změny se odešlou později</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
                    <CloudCheck className="w-3.5 h-3.5" />
                    <span>Cloud účet aktivní</span>
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-center">
              <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800">
                <div className="text-xl font-bold text-slate-900 dark:text-white">
                  {contracts.length}
                </div>
                <div className="text-xs text-slate-500">Smluv v cloudu</div>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800">
                <div className="text-xl font-bold text-slate-900 dark:text-white">
                  {clients.length}
                </div>
                <div className="text-xs text-slate-500">Uložených klientů</div>
              </div>
            </div>

            {(lastSyncTime || status.pending > 0) && (
              <div className="text-xs text-center text-slate-500 dark:text-slate-400">
                {lastSyncTime && <>Poslední synchronizace: {lastSyncTime}</>}
                {lastSyncTime && status.pending > 0 && ' · '}
                {status.pending > 0 && <>Čeká na odeslání: {status.pending}</>}
              </div>
            )}

            <div className="pt-2 flex flex-col gap-2">
              <button
                type="button"
                onClick={handleSync}
                disabled={isSyncing}
                className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm shadow-md shadow-blue-600/20 flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>{isSyncing ? 'Probíhá synchronizace...' : 'Synchronizovat nyní'}</span>
              </button>

              <button
                type="button"
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="w-full py-2 px-4 rounded-xl text-xs font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>{isLoggingOut ? 'Odhlašuji...' : 'Odhlásit se z cloudového účtu'}</span>
              </button>
            </div>

            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setView('data-info')}
                className="text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Info className="w-3.5 h-3.5" />
                <span>Kde jsou moje data?</span>
              </button>
              <button
                type="button"
                onClick={() => setView('delete')}
                className="text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Smazat účet</span>
              </button>
            </div>
          </div>
          )}

          {view === 'data-info' && (
            <div className="space-y-4">
              <h4 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
                <Info className="w-4 h-4 text-blue-600" />
                <span>Kde jsou moje data</span>
              </h4>
              <ul className="space-y-2.5 text-sm text-slate-700 dark:text-slate-300 list-disc pl-5">
                <li>
                  <strong>Ve vašem účtu:</strong> profil, klienti, smlouvy, kalendář, ceník, fotky a podpisy jsou uložené
                  v databázi a úložišti služby Supabase v Evropské unii. Po přihlášení je máte na každém zařízení.
                </li>
                <li>
                  <strong>V tomto zařízení:</strong> kopie dat je uložená i v prohlížeči, aby aplikace fungovala bez
                  připojení. Odhlášením se z tohoto zařízení smaže, v účtu zůstává.
                </li>
                <li>
                  <strong>Kdo je vidí:</strong> jen vy po přihlášení. Zákazník, kterému pošlete odkaz k online podpisu,
                  uvidí pouze smluvní strany, předmět díla, cenu, položky a termín – ne vaše náklady, fotky ani deník.
                </li>
                <li>
                  <strong>Údaje vašich zákazníků</strong> (jména, adresy, telefony) do aplikace zadáváte vy a odpovídáte
                  za to, že je smíte zpracovávat.
                </li>
                <li>
                  <strong>Jiné služby:</strong> při dohledání firmy podle IČO se dotaz posílá do registru ARES, předpověď
                  počasí se načítá ze služby Open-Meteo.
                </li>
                <li>
                  <strong>Záloha a smazání:</strong> všechna data si můžete stáhnout do souboru a účet kdykoli nenávratně
                  smazat.
                </li>
              </ul>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    exportAppBackup();
                    if (onToast) onToast('success', 'Záloha dat byla stažena.');
                  }}
                  className="py-2 px-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600 text-white font-semibold text-xs inline-flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Stáhnout zálohu dat</span>
                </button>
                <button
                  type="button"
                  onClick={() => setView('account')}
                  className="py-2 px-3.5 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Zpět na účet
                </button>
              </div>
            </div>
          )}

          {view === 'delete' && (
            <form onSubmit={handleDeleteAccount} className="space-y-4" noValidate>
              <h4 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-600" />
                <span>Smazat účet a všechna data</span>
              </h4>
              <div className="p-3.5 rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 text-sm text-red-800 dark:text-red-200 space-y-1.5">
                <p>
                  Smaže se účet <strong>{currentUser.email}</strong> a s ním nenávratně{' '}
                  <strong>
                    {contracts.length} {contracts.length === 1 ? 'smlouva' : contracts.length >= 2 && contracts.length <= 4 ? 'smlouvy' : 'smluv'}
                  </strong>
                  ,{' '}
                  <strong>
                    {clients.length} {clients.length === 1 ? 'klient' : clients.length >= 2 && clients.length <= 4 ? 'klienti' : 'klientů'}
                  </strong>
                  , kalendář, ceník, fotky a podpisy – v účtu i v tomto zařízení.
                </p>
                <p>Smazání nejde vrátit zpět. Odkazy k online podpisu přestanou fungovat.</p>
              </div>

              <button
                type="button"
                onClick={() => {
                  exportAppBackup();
                  if (onToast) onToast('success', 'Záloha dat byla stažena.');
                }}
                className="py-2 px-3.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold text-xs inline-flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Nejdřív stáhnout zálohu dat</span>
              </button>

              <label className="flex items-start gap-2.5 text-sm text-slate-700 dark:text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={deleteConfirmed}
                  onChange={(e) => setDeleteConfirmed(e.target.checked)}
                  className="mt-0.5 w-4 h-4 accent-red-600 cursor-pointer"
                />
                <span>Rozumím, že se všechna data nenávratně smažou.</span>
              </label>

              <div>
                <label htmlFor="delete-account-password" className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">
                  Pro potvrzení zadejte heslo
                </label>
                <input
                  id="delete-account-password"
                  type="password"
                  autoComplete="current-password"
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border text-sm bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-all focus:outline-hidden focus:ring-2 border-slate-300 dark:border-slate-700 focus:border-red-500 focus:ring-red-100 dark:focus:ring-red-950"
                />
              </div>

              {deleteError && (
                <div role="alert" className="px-3.5 py-2.5 rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 text-sm text-rose-700 dark:text-rose-300">
                  {deleteError}
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="submit"
                  disabled={isDeleting}
                  className="py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold text-sm inline-flex items-center gap-2 cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>{isDeleting ? 'Mažu účet…' : 'Nenávratně smazat účet'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setView('account')}
                  disabled={isDeleting}
                  className="py-2.5 px-4 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-50"
                >
                  Zrušit
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex items-center justify-between">
          <span className="text-[11px] text-slate-400 dark:text-slate-500">
            Zabezpečené cloudové úložiště v EU
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Zavřít
          </button>
        </div>
      </div>
    </div>
  );
};
