import React from 'react';
import {
  PlusCircle,
  Users,
  History,
  Settings,
  Moon,
  Sun,
  TrendingUp,
  Cloud,
  CloudCheck,
  LayoutDashboard,
  Calendar,
  GitPullRequest,
  Receipt,
  Crown,
} from 'lucide-react';
import { CloudUser as User } from '../utils/supabase';
import { ContractorProfile } from '../types/contract';
import { getSubscriptionInfo } from '../utils/subscription';
import { isAresVerified } from '../utils/ares';
import { Logo } from './Logo';

export type TabType =
  | 'dashboard'
  | 'kalendar'
  | 'pipeline'
  | 'nova-smlouva'
  | 'faktury'
  | 'klienti'
  | 'historie'
  | 'finance'
  | 'nastaveni';

interface NavbarProps {
  activeTab: TabType;
  onSelectTab: (tab: TabType) => void;
  contractsCount?: number;
  clientsCount?: number;
  overdueInvoicesCount?: number;
  isDarkMode?: boolean;
  onToggleDarkMode?: () => void;
  currentUser?: User | null;
  onOpenCloudModal?: () => void;
  contractor?: ContractorProfile | null;
  onOpenPaywall?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  onSelectTab,
  contractsCount = 0,
  clientsCount = 0,
  overdueInvoicesCount = 0,
  isDarkMode = false,
  onToggleDarkMode,
  currentUser,
  onOpenCloudModal,
  contractor,
  onOpenPaywall,
}) => {
  const subInfo = getSubscriptionInfo(contractor || null);
  const operationalItems = [
    { id: 'dashboard' as TabType, label: 'Přehled', icon: LayoutDashboard },
    { id: 'kalendar' as TabType, label: 'Kalendář', icon: Calendar },
    { id: 'pipeline' as TabType, label: 'Zakázky', icon: GitPullRequest },
  ];

  const documentItems = [
    {
      id: 'nova-smlouva' as TabType,
      label: 'Nová smlouva',
      icon: PlusCircle,
      isCta: true,
    },
    {
      id: 'faktury' as TabType,
      label: 'Faktury',
      icon: Receipt,
      badge: overdueInvoicesCount > 0 ? `${overdueInvoicesCount}!` : undefined,
      badgeColor: 'rose',
    },
  ];

  const managementItems = [
    {
      id: 'klienti' as TabType,
      label: 'Klienti',
      icon: Users,
      badge: clientsCount > 0 ? clientsCount : undefined,
    },
    {
      id: 'historie' as TabType,
      label: 'Archiv',
      icon: History,
      badge: contractsCount > 0 ? contractsCount : undefined,
    },
    {
      id: 'finance' as TabType,
      label: 'Finance',
      icon: TrendingUp,
    },
    {
      id: 'nastaveni' as TabType,
      label: 'Nastavení',
      icon: Settings,
    },
  ];

  const navItems = [...operationalItems, ...documentItems.filter((item) => !item.isCta), ...managementItems];

  const accountLabel = currentUser?.email || currentUser?.displayName || 'Účet';

  return (
    <>
      {/* Mobil a tablet: úzká horní lišta se značkou; záložky jsou ve spodní liště */}
      <header className="no-print lg:hidden sticky top-0 z-40 bg-blue-600 dark:bg-slate-950 text-white border-b border-blue-700 dark:border-slate-800">
        <div className="px-4 h-14 flex items-center justify-between gap-3">
          <button
            onClick={() => onSelectTab('dashboard')}
            className="min-h-11 flex items-center cursor-pointer"
            aria-label="Řemeslník PRO – přehled"
          >
            <Logo size={26} />
          </button>
          <div className="flex items-center gap-1">
            {onOpenCloudModal && (
              <button
                onClick={onOpenCloudModal}
                className="w-11 h-11 inline-flex items-center justify-center rounded-md hover:bg-white/10 cursor-pointer"
                title="Účet a synchronizace"
                aria-label="Účet a synchronizace"
              >
                {currentUser ? <CloudCheck className="w-5 h-5" /> : <Cloud className="w-5 h-5" />}
              </button>
            )}
            {onToggleDarkMode && (
              <button
                onClick={onToggleDarkMode}
                className="w-11 h-11 inline-flex items-center justify-center rounded-md hover:bg-white/10 cursor-pointer"
                title={isDarkMode ? 'Přepnout na světlý režim' : 'Přepnout na tmavý režim'}
                aria-label={isDarkMode ? 'Přepnout na světlý režim' : 'Přepnout na tmavý režim'}
              >
                {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Počítač: boční nabídka */}
      <aside className="no-print hidden lg:flex fixed inset-y-0 left-0 z-40 w-60 flex-col gap-6 px-4 py-6 bg-blue-600 dark:bg-slate-950 text-white border-r border-blue-700 dark:border-slate-800 overflow-y-auto">
        <button
          onClick={() => onSelectTab('dashboard')}
          className="flex items-center px-2 text-left cursor-pointer"
          aria-label="Řemeslník PRO – přehled"
        >
          <Logo size={30} />
        </button>

        <button
          onClick={() => onSelectTab('nova-smlouva')}
          className={`min-h-12 inline-flex items-center justify-center gap-2 rounded-md font-semibold text-base text-slate-900 cursor-pointer border ${
            activeTab === 'nova-smlouva'
              ? 'bg-white border-white'
              : 'bg-amber-400 hover:bg-amber-300 border-amber-400'
          }`}
        >
          <PlusCircle className="w-5 h-5" />
          <span>Nová smlouva</span>
        </button>

        <nav aria-label="Hlavní nabídka" className="flex flex-col gap-0.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            const badge = 'badge' in item ? (item.badge as string | number | undefined) : undefined;
            const isAlert = 'badgeColor' in item && item.badgeColor === 'rose';
            return (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id)}
                aria-current={isActive ? 'page' : undefined}
                className={`min-h-11 flex items-center gap-3 px-3 rounded-md text-base text-left cursor-pointer transition-colors ${
                  isActive
                    ? 'bg-white text-blue-600 dark:bg-slate-800 dark:text-white font-semibold'
                    : 'text-white font-medium hover:bg-white/10'
                }`}
              >
                <Icon className="w-5 h-5 shrink-0" />
                <span className="flex-1">{item.label}</span>
                {badge !== undefined && (
                  <span
                    className={`text-sm font-semibold px-2 rounded-full ${
                      isAlert
                        ? 'bg-white text-rose-700'
                        : isActive
                          ? 'bg-blue-100 text-blue-800 dark:bg-slate-700 dark:text-slate-100'
                          : 'bg-white/15 text-white'
                    }`}
                  >
                    {isAlert ? String(badge).replace('!', '') : badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="mt-auto flex flex-col gap-3 pt-4 border-t border-white/20 text-sm">
          {contractor?.name && (
            <div className="px-2 leading-snug">
              <div className="font-semibold line-clamp-2" title={contractor.name}>{contractor.name}</div>
              <div className="text-blue-100 dark:text-slate-400">
                {contractor.ico ? `IČO ${contractor.ico}` : ''}
                {isAresVerified(contractor) ? `${contractor.ico ? ', ' : ''}ověřeno v ARES` : ''}
              </div>
            </div>
          )}

          {onOpenPaywall && (
            <button
              onClick={onOpenPaywall}
              className="min-h-11 flex items-center gap-3 px-3 rounded-md text-left font-medium hover:bg-white/10 cursor-pointer"
              title={subInfo.isPro ? `Aktivní licence: ${subInfo.label}` : 'Přejít na plnou verzi Řemeslník PRO'}
            >
              <Crown className="w-5 h-5 shrink-0" />
              <span>{subInfo.isPro ? subInfo.label : 'Aktivovat PRO'}</span>
            </button>
          )}

          {onOpenCloudModal && (
            <button
              onClick={onOpenCloudModal}
              className="min-h-11 flex items-center gap-3 px-3 rounded-md text-left font-medium hover:bg-white/10 cursor-pointer"
              title="Účet a synchronizace zakázek"
            >
              {currentUser ? <CloudCheck className="w-5 h-5 shrink-0" /> : <Cloud className="w-5 h-5 shrink-0" />}
              <span className="truncate">{accountLabel}</span>
            </button>
          )}

          {onToggleDarkMode && (
            <button
              onClick={onToggleDarkMode}
              className="min-h-11 flex items-center gap-3 px-3 rounded-md text-left font-medium hover:bg-white/10 cursor-pointer"
            >
              {isDarkMode ? <Sun className="w-5 h-5 shrink-0" /> : <Moon className="w-5 h-5 shrink-0" />}
              <span>{isDarkMode ? 'Světlý režim' : 'Tmavý režim'}</span>
            </button>
          )}
        </div>
      </aside>
    </>
  );
};
