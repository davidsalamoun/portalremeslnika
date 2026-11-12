import React, { useState, useEffect } from 'react';
import {
  X,
  Cloud,
  CloudCheck,
  CloudOff,
  User as UserIcon,
  LogIn,
  LogOut,
  RefreshCw,
  CheckCircle2,
  ShieldCheck,
  Smartphone,
  Laptop,
  ArrowRight,
  Database,
} from 'lucide-react';
import { User } from 'firebase/auth';
import {
  loginWithGoogle,
  logoutUser,
  syncContractorProfileToCloud,
  loadContractorProfileFromCloud,
  syncContractToCloud,
  loadContractsFromCloud,
  syncClientToCloud,
  loadClientsFromCloud,
} from '../utils/firebase';
import { Contract, Client, ContractorProfile } from '../types/contract';

interface CloudAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  contractor: ContractorProfile | null;
  clients: Client[];
  contracts: Contract[];
  onCloudDataLoaded: (data: {
    contractor?: ContractorProfile;
    clients?: Client[];
    contracts?: Contract[];
  }) => void;
  onToast?: (type: 'success' | 'error' | 'info', text: string) => void;
}

export const CloudAccountModal: React.FC<CloudAccountModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  contractor,
  clients,
  contracts,
  onCloudDataLoaded,
  onToast,
}) => {
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(() => {
    return localStorage.getItem('last_cloud_sync');
  });

  if (!isOpen) return null;

  const handleLogin = async () => {
    setIsLoggingIn(true);
    try {
      const user = await loginWithGoogle();
      if (onToast) onToast('success', `Přihlášen jako ${user.displayName || user.email}`);
      // Automatická synchronizace po přihlášení
      await performCloudSync(user.uid);
    } catch (err: any) {
      console.error(err);
      if (onToast) onToast('error', err?.message || 'Přihlášení se nezdařilo.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logoutUser();
      if (onToast) onToast('info', 'Byl jste odhlášen z cloudového účtu.');
    } catch (err: any) {
      console.error(err);
      if (onToast) onToast('error', 'Chyba při odhlašování.');
    }
  };

  const performCloudSync = async (userId: string) => {
    setIsSyncing(true);
    try {
      // 1. Uložit lokální profil zhotovitele do cloudu pokud existuje
      if (contractor) {
        await syncContractorProfileToCloud(contractor, userId);
      }

      // 2. Synchronizovat lokální klienty do cloudu
      for (const cl of clients) {
        await syncClientToCloud(cl, userId);
      }

      // 3. Synchronizovat smlouvy do cloudu
      for (const ct of contracts) {
        await syncContractToCloud(ct, userId);
      }

      // 4. Načíst z cloudu všechna data (např. vytvořená na jiném zařízení)
      const cloudContracts = await loadContractsFromCloud(userId);
      const cloudClients = await loadClientsFromCloud(userId);
      const cloudProfile = await loadContractorProfileFromCloud(userId);

      onCloudDataLoaded({
        contractor: (cloudProfile as ContractorProfile) || undefined,
        clients: cloudClients.length > 0 ? cloudClients : undefined,
        contracts: cloudContracts.length > 0 ? cloudContracts : undefined,
      });

      const now = new Date().toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' });
      setLastSyncTime(now);
      localStorage.setItem('last_cloud_sync', now);

      if (onToast) onToast('success', 'Všechny smlouvy a klienti jsou synchronizováni s cloudem.');
    } catch (err: any) {
      console.error(err);
      if (onToast) onToast('error', err?.message || 'Chyba při synchronizaci s cloudem.');
    } finally {
      setIsSyncing(false);
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
                Synchronizace smluv, klientů a cen mezi mobilem a PC (Firebase)
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
          {!currentUser ? (
            /* Neodhlášený stav */
            <div className="text-center py-4 space-y-4">
              <div className="w-16 h-16 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto">
                <Database className="w-8 h-8" />
              </div>
              <div>
                <h4 className="font-bold text-slate-800 dark:text-white text-base">
                  Zálohujte si zakázky a mějte je všude s sebou
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto mt-1">
                  Po přihlášení jedním kliknutím přes Google účet se vaše smlouvy, klienti i ceník
                  automaticky ukládají do zabezpečeného cloudu. Můžete aplikaci otevřít na mobilu na stavbě
                  nebo večer u počítače.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 text-left bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
                <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                  <Smartphone className="w-4 h-4 text-blue-600" />
                  <span>Přístup z mobilu na stavbě</span>
                </div>
                <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                  <Laptop className="w-4 h-4 text-blue-600" />
                  <span>Práce na počítači v dílně</span>
                </div>
                <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                  <CloudCheck className="w-4 h-4 text-emerald-600" />
                  <span>Automatická záloha</span>
                </div>
                <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>Šifrovaná data v ČR/EU</span>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleLogin}
                  disabled={isLoggingIn}
                  className="w-full py-3 px-4 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-750 text-slate-800 dark:text-white font-semibold text-sm shadow-md border border-slate-300 dark:border-slate-700 flex items-center justify-center gap-3 cursor-pointer transition-all"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                  <span>{isLoggingIn ? 'Přihlašuji...' : 'Přihlásit se přes Google'}</span>
                </button>
              </div>
            </div>
          ) : (
            /* Přihlášený uživatel */
            <div className="space-y-4">
              <div className="flex items-center gap-3.5 p-3.5 bg-blue-50/70 dark:bg-blue-950/40 rounded-xl border border-blue-200/80 dark:border-blue-800/60">
                {currentUser.photoURL ? (
                  <img
                    src={currentUser.photoURL}
                    alt={currentUser.displayName || ''}
                    className="w-12 h-12 rounded-full border-2 border-white shadow-xs"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-lg">
                    {currentUser.email?.charAt(0).toUpperCase() || 'U'}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-slate-900 dark:text-white truncate">
                    {currentUser.displayName || 'Řemeslník'}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                    {currentUser.email}
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
                    <CloudCheck className="w-3.5 h-3.5" />
                    <span>Cloud účet aktivní</span>
                  </div>
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

              {lastSyncTime && (
                <div className="text-xs text-center text-slate-500 dark:text-slate-400">
                  Poslední synchronizace: {lastSyncTime}
                </div>
              )}

              <div className="pt-2 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => performCloudSync(currentUser.uid)}
                  disabled={isSyncing}
                  className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm shadow-md shadow-blue-600/20 flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                  <span>{isSyncing ? 'Probíhá synchronizace...' : 'Synchronizovat nyní'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full py-2 px-4 rounded-xl text-xs font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Odhlásit se z cloudového účtu</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex items-center justify-between">
          <span className="text-[11px] text-slate-400 dark:text-slate-500">
            Zabezpečené cloudové úložiště Firebase
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
