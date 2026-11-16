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
      {/* Nabídka „Více“ na mobilu */}
      {isMoreMenuOpen && (
        <div
          className="no-print lg:hidden fixed inset-0 z-50 bg-slate-950/60 flex flex-col justify-end"
          onClick={() => setIsMoreMenuOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Další nabídka"
            className="bg-white dark:bg-slate-900 rounded-t-md border-t border-slate-900 dark:border-slate-600 shadow-2xl max-h-[85vh] overflow-y-auto text-[15px] leading-snug"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 pt-4 pb-1 flex items-center justify-between gap-3">
              <h2 className="text-[26px] font-bold text-slate-900 dark:text-white">Více</h2>
              <button
                type="button"
                onClick={() => setIsMoreMenuOpen(false)}
                aria-label="Zavřít"
                className="w-11 h-11 -mr-2 inline-flex items-center justify-center rounded-md text-slate-900 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-800 border-y border-slate-100 dark:border-slate-800">
              {(
                [
                  { tab: 'kalendar', label: 'Kalendář', icon: Calendar },
                  { tab: 'klienti', label: 'Klienti', icon: Users },
                  { tab: 'historie', label: 'Archiv', icon: History },
                  { tab: 'finance', label: 'Finance', icon: TrendingUp },
                  { tab: 'nastaveni', label: 'Nastavení', icon: Settings },
                ] as const
              ).map(({ tab, label, icon: Icon }) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => handleTabClick(tab)}
                  aria-current={activeTab === tab ? 'page' : undefined}
                  className={`w-full min-h-[52px] px-5 flex items-center gap-3.5 text-left cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 ${
                    activeTab === tab ? 'font-semibold text-blue-600 dark:text-blue-300' : 'font-medium text-slate-900 dark:text-slate-100'
                  }`}
                >
                  <Icon className="w-5 h-5 shrink-0" />
                  <span>{label}</span>
                </button>
              ))}
              {onOpenEstimateCalculator && (
                <button
                  type="button"
                  onClick={() => {
                    setIsMoreMenuOpen(false);
                    onOpenEstimateCalculator();
                  }}
                  className="w-full min-h-[52px] px-5 flex items-center gap-3.5 text-left font-medium text-slate-900 dark:text-slate-100 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <Calculator className="w-5 h-5 shrink-0" />
                  <span>Kalkulačka na obhlídce</span>
                </button>
              )}
              {onOpenPaywall && (
                <button
                  type="button"
                  onClick={() => {
                    setIsMoreMenuOpen(false);
                    onOpenPaywall();
                  }}
                  className="w-full min-h-[52px] px-5 flex items-center gap-3.5 text-left font-medium text-slate-900 dark:text-slate-100 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <Crown className="w-5 h-5 shrink-0" />
                  <span>{subInfo.isPro ? subInfo.label : 'Mistr PRO'}</span>
                </button>
              )}
            </div>

            <div className="px-5 py-3 flex flex-wrap gap-2.5">
              {onOpenCloudModal && (
                <button
                  type="button"
                  onClick={() => {
                    setIsMoreMenuOpen(false);
                    onOpenCloudModal();
                  }}
                  className="min-h-11 px-4 flex-1 min-w-0 inline-flex items-center justify-center gap-2 rounded-md border-[1.5px] border-slate-900 dark:border-slate-500 text-slate-900 dark:text-slate-100 font-semibold cursor-pointer"
                >
                  <Cloud className="w-[18px] h-[18px] shrink-0" />
                  <span className="truncate">{currentUser?.email || 'Účet'}</span>
                </button>
              )}
              {onToggleDarkMode && (
                <button
                  type="button"
                  onClick={onToggleDarkMode}
                  className="min-h-11 px-4 inline-flex items-center justify-center gap-2 rounded-md border-[1.5px] border-slate-900 dark:border-slate-500 text-slate-900 dark:text-slate-100 font-semibold cursor-pointer"
                >
                  {isDarkMode ? <Sun className="w-[18px] h-[18px]" /> : <Moon className="w-[18px] h-[18px]" />}
                  <span>{isDarkMode ? 'Světlý režim' : 'Tmavý režim'}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Fixed Bottom Navigation Bar for Mobile */}
      <nav className="no-print lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200/90 dark:border-slate-800 px-2 py-1.5 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] dark:shadow-[0_-4px_20px_rgba(0,0,0,0.4)]">
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
            <span className="text-3xs font-semibold mt-0.5">Přehled</span>
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
