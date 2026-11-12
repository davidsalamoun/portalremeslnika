import React, { useState } from 'react';
import {
  LayoutDashboard,
  GitPullRequest,
  PlusCircle,
  Receipt,
  Menu,
  X,
  Users,
  Calendar,
  History,
  TrendingUp,
  Settings,
  Cloud,
  Moon,
  Sun,
  ShieldCheck,
  Phone,
  Calculator,
  Crown,
} from 'lucide-react';
import { TabType } from './Navbar';
import { CloudUser as User } from '../utils/supabase';
import { ContractorProfile } from '../types/contract';
import { getSubscriptionInfo } from '../utils/subscription';

interface BottomNavProps {
  activeTab: TabType;
  onSelectTab: (tab: TabType) => void;
  overdueInvoicesCount?: number;
  onOpenEstimateCalculator?: () => void;
  currentUser?: User | null;
  onOpenCloudModal?: () => void;
  isDarkMode?: boolean;
  onToggleDarkMode?: () => void;
  contractor?: ContractorProfile | null;
  onOpenPaywall?: () => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  onSelectTab,
  overdueInvoicesCount = 0,
  onOpenEstimateCalculator,
  currentUser,
  onOpenCloudModal,
  isDarkMode,
  onToggleDarkMode,
  contractor,
  onOpenPaywall,
}) => {
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const subInfo = getSubscriptionInfo(contractor || null);

  const handleTabClick = (tab: TabType) => {
    setIsMoreMenuOpen(false);
    onSelectTab(tab);
  };

  return (
    <>
      {/* "More" Sheet Overlay for mobile */}
      {isMoreMenuOpen && (
        <div
          className="md:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex flex-col justify-end animate-in fade-in duration-200"
          onClick={() => setIsMoreMenuOpen(false)}
        >
          <div
            className="bg-white dark:bg-slate-900 rounded-t-xl p-5 shadow-2xl border-t border-slate-200 dark:border-slate-800 space-y-4 max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Sheet Handle & Close */}
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-slate-900 dark:bg-slate-800 text-amber-400 flex items-center justify-center">
                  <Menu className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">
                    Nástroje dílny & stavby
                  </h3>
                  <p className="text-3xs text-slate-400">Rychlý přístup na mobilu</p>
                </div>
              </div>
              <button
                onClick={() => setIsMoreMenuOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 bg-slate-100 dark:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* PRO License Card in Sheet */}
            {onOpenPaywall && (
              <button
                onClick={() => {
                  setIsMoreMenuOpen(false);
                  onOpenPaywall();
                }}
                className={`w-full p-3.5 rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                  subInfo.isPro
                    ? 'bg-amber-50/70 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800'
                    : 'bg-amber-500 hover:bg-amber-600 text-slate-950 shadow-xs border-amber-400'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                      subInfo.isPro
                        ? 'bg-amber-400 text-slate-950'
                        : 'bg-slate-950 text-amber-400'
                    }`}
                  >
                    <Crown className="w-5 h-5 fill-current" />
                  </div>
                  <div>
                    <div className="text-xs font-black">
                      {subInfo.isPro ? subInfo.label : 'Přejít na Mistr PRO'}
                    </div>
                    <div
                      className={`text-3xs ${
                        subInfo.isPro
                          ? 'text-slate-500 dark:text-slate-400'
                          : 'text-slate-950 font-medium'
                      }`}
                    >
                      {subInfo.isPro
                        ? 'Klikněte pro daňový doklad a licenci'
                        : 'Neomezené SOD, razítko, QR faktury'}
                    </div>
                  </div>
                </div>
                <div
                  className={`text-3xs font-extrabold px-2.5 py-1 rounded-md ${
                    subInfo.isPro
                      ? 'bg-white dark:bg-slate-900 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-700'
                      : 'bg-slate-950 text-white'
                  }`}
                >
                  {subInfo.isPro ? 'Správa' : 'Aktivovat'}
                </div>
              </button>
            )}

            {/* Grid of Other Tools */}
            <div className="grid grid-cols-2 gap-2.5">
              <button
                onClick={() => handleTabClick('kalendar')}
                className={`p-3 rounded-xl border text-left flex items-center gap-2.5 transition-colors cursor-pointer ${
                  activeTab === 'kalendar'
                    ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-400 text-amber-900 dark:text-amber-200 font-bold'
                    : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                }`}
              >
                <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-400 flex items-center justify-center shrink-0">
                  <Calendar className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white">Kalendář</div>
                  <div className="text-3xs text-slate-500">Etapy & výjezdy</div>
                </div>
              </button>

              <button
                onClick={() => handleTabClick('klienti')}
                className={`p-3 rounded-xl border text-left flex items-center gap-2.5 transition-colors cursor-pointer ${
                  activeTab === 'klienti'
                    ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-400 text-amber-900 dark:text-amber-200 font-bold'
                    : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                }`}
              >
                <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-400 flex items-center justify-center shrink-0">
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white">Adresář</div>
                  <div className="text-3xs text-slate-500">Klienti & kontakty</div>
                </div>
              </button>

              <button
                onClick={() => {
                  setIsMoreMenuOpen(false);
                  if (onOpenEstimateCalculator) {
                    onOpenEstimateCalculator();
                  } else {
                    handleTabClick('nova-smlouva');
                  }
                }}
                className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60 text-left flex items-center gap-2.5 transition-colors cursor-pointer"
              >
                <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0">
                  <Calculator className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white">Kalkulačka</div>
                  <div className="text-3xs text-slate-500">Rychlý rozpočet</div>
                </div>
              </button>

              <button
                onClick={() => handleTabClick('finance')}
                className={`p-3 rounded-xl border text-left flex items-center gap-2.5 transition-colors cursor-pointer ${
                  activeTab === 'finance'
                    ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-400 text-amber-900 dark:text-amber-200 font-bold'
                    : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                }`}
              >
                <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-950/80 text-purple-700 dark:text-purple-400 flex items-center justify-center shrink-0">
                  <TrendingUp className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white">Finance & Daně</div>
                  <div className="text-3xs text-slate-500">Příjmy & výdaje</div>
                </div>
              </button>

              <button
                onClick={() => handleTabClick('nastaveni')}
                className={`p-3 rounded-xl border text-left flex items-center gap-2.5 transition-colors cursor-pointer col-span-2 ${
                  activeTab === 'nastaveni'
                    ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-400 text-amber-900 dark:text-amber-200 font-bold'
                    : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                }`}
              >
                <div className="w-8 h-8 rounded-lg bg-slate-900 dark:bg-slate-800 text-amber-400 flex items-center justify-center shrink-0">
                  <Settings className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white">Můj živnostenský profil</div>
                  <div className="text-3xs text-slate-500">IČO, bankovní účet, zálohy a razítko</div>
                </div>
              </button>
            </div>

            {/* Quick Actions (Cloud + Dark Mode) */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
              {onOpenCloudModal && (
                <button
                  onClick={() => {
                    setIsMoreMenuOpen(false);
                    onOpenCloudModal();
                  }}
                  className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 flex items-center gap-1.5 text-xs font-semibold cursor-pointer"
                  title="Cloud účet"
                >
                  <Cloud className="w-4 h-4 text-blue-600" />
                  <span>{currentUser ? 'Účet OK' : 'Cloud'}</span>
                </button>
              )}

              {onToggleDarkMode && (
                <button
                  onClick={onToggleDarkMode}
                  className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 cursor-pointer"
                  title="Režim vzhledu"
                >
                  {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Fixed Bottom Navigation Bar for Mobile */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200/90 dark:border-slate-800 px-2 py-1.5 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] dark:shadow-[0_-4px_20px_rgba(0,0,0,0.4)]">
        <div className="flex items-center justify-around max-w-lg mx-auto">
          {/* 1. Dnes */}
          <button
            onClick={() => handleTabClick('dashboard')}
            className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-lg transition-all cursor-pointer ${
              activeTab === 'dashboard'
                ? 'text-slate-950 dark:text-white font-bold'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <div className={`p-1 rounded-lg ${activeTab === 'dashboard' ? 'bg-slate-100 dark:bg-slate-800 text-slate-950 dark:text-white' : ''}`}>
              <LayoutDashboard className="w-5 h-5" />
            </div>
            <span className="text-3xs font-semibold mt-0.5">Dnes</span>
          </button>

          {/* 2. Poptávky / CRM / Archiv */}
          <button
            onClick={() => handleTabClick('pipeline')}
            className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-lg transition-all cursor-pointer ${
              activeTab === 'pipeline' || activeTab === 'historie'
                ? 'text-slate-950 dark:text-white font-bold'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <div className={`p-1 rounded-lg ${activeTab === 'pipeline' || activeTab === 'historie' ? 'bg-slate-100 dark:bg-slate-800 text-slate-950 dark:text-white' : ''}`}>
              <GitPullRequest className="w-5 h-5" />
            </div>
            <span className="text-3xs font-semibold mt-0.5">Zakázky</span>
          </button>

          {/* 3. Center Raised "+ Nová smlouva" Button for Thumb */}
          <button
            onClick={() => handleTabClick('nova-smlouva')}
            className="flex flex-col items-center justify-center -mt-5 cursor-pointer group"
          >
            <div className="w-12 h-12 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 flex items-center justify-center shadow-md ring-4 ring-white dark:ring-slate-900 group-active:scale-95 transition-transform">
              <PlusCircle className="w-6 h-6 stroke-[2.5]" />
            </div>
            <span className="text-3xs font-black text-slate-900 dark:text-amber-400 mt-1">
              + Smlouva
            </span>
          </button>

          {/* 4. Faktury & Nezaplacené */}
          <button
            onClick={() => handleTabClick('faktury')}
            className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-lg transition-all cursor-pointer relative ${
              activeTab === 'faktury'
                ? 'text-slate-950 dark:text-white font-bold'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <div className={`p-1 rounded-lg relative ${activeTab === 'faktury' ? 'bg-slate-100 dark:bg-slate-800 text-slate-950 dark:text-white' : ''}`}>
              <Receipt className="w-5 h-5" />
              {overdueInvoicesCount > 0 && (
                <span className="absolute -top-1 -right-1.5 w-4 h-4 bg-rose-600 text-white text-3xs font-black font-mono rounded-full flex items-center justify-center shadow-xs">
                  {overdueInvoicesCount}
                </span>
              )}
            </div>
            <span className="text-3xs font-semibold mt-0.5">Faktury</span>
          </button>

          {/* 5. Více Menu */}
          <button
            onClick={() => setIsMoreMenuOpen(true)}
            className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-lg transition-all cursor-pointer ${
              ['kalendar', 'klienti', 'historie', 'finance', 'nastaveni'].includes(activeTab)
                ? 'text-slate-950 dark:text-white font-bold'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <div className={`p-1 rounded-lg ${['kalendar', 'klienti', 'historie', 'finance', 'nastaveni'].includes(activeTab) ? 'bg-slate-100 dark:bg-slate-800 text-slate-950 dark:text-white' : ''}`}>
              <Menu className="w-5 h-5" />
            </div>
            <span className="text-3xs font-semibold mt-0.5">Více</span>
          </button>
        </div>
      </nav>
    </>
  );
};
