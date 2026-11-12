import React, { useState, useEffect } from 'react';
import { X, Cloud, CloudCheck, CloudOff, LogOut, RefreshCw } from 'lucide-react';
import { CloudUser } from '../utils/supabase';
import {
  syncNow,
  signOutAndClear,
  getCloudSyncStatus,
  subscribeCloudSyncStatus,
  CloudSyncStatus,
} from '../utils/cloudSync';
import { Contract, Client } from '../types/contract';

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
          </div>
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
