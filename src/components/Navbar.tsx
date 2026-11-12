import React from 'react';
import {
  FileText,
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
    { id: 'dashboard' as TabType, label: 'Dnes', icon: LayoutDashboard },
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

  const renderNavItem = (item: {
    id: TabType;
    label: string;
    icon: any;
    isCta?: boolean;
    badge?: string | number;
    badgeColor?: string;
  }) => {
    const Icon = item.icon;
    const isActive = activeTab === item.id;

    if (item.isCta) {
      return (
        <button
          key={item.id}
          onClick={() => onSelectTab(item.id)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer shadow-xs ${
            isActive
              ? 'bg-amber-600 text-slate-950 ring-2 ring-amber-400'
              : 'bg-amber-500 hover:bg-amber-600 text-slate-950 active:scale-95'
          }`}
          title="Založit novou smlouvu o dílo nebo cenovou nabídku"
        >
          <Icon className="w-3.5 h-3.5" />
          <span>{item.label}</span>
        </button>
      );
    }

    return (
      <button
        key={item.id}
        onClick={() => onSelectTab(item.id)}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
          isActive
            ? 'bg-slate-900 text-white dark:bg-blue-600 dark:text-white font-bold shadow-xs'
            : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 font-medium'
        }`}
      >
        <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-slate-400 dark:text-slate-400'}`} />
        <span>{item.label}</span>
        {item.badge !== undefined && (
          <span
            className={`ml-0.5 text-[10px] font-mono tabular-nums px-1.5 py-0.2 rounded font-bold ${
              item.badgeColor === 'rose'
                ? 'bg-rose-600 text-white'
                : isActive
                ? 'bg-white/20 text-white'
                : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
            }`}
          >
            {item.badge}
          </span>
        )}
      </button>
    );
  };

  return (
    <header className="sticky top-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 shadow-2xs transition-colors">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 h-15 sm:h-16 flex items-center justify-between gap-3">
        {/* Logo & Contractor Badge */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => onSelectTab('dashboard')}
            className="flex items-center gap-2.5 text-left group focus:outline-hidden cursor-pointer"
          >
            <div className="w-9 h-9 rounded-xl bg-slate-950 text-white flex items-center justify-center shadow-xs border border-slate-800 group-hover:border-amber-500/50 transition-colors">
              <FileText className="w-4.5 h-4.5 text-amber-400" />
            </div>
            <div className="flex flex-col leading-tight">
              <span className="font-black text-base text-slate-900 dark:text-white tracking-tight flex items-center gap-1.5">
                Řemeslník <span className="text-[10px] font-black px-1.5 py-0.2 rounded bg-amber-400 text-slate-950 tracking-wide">PRO</span>
              </span>
              <span className="text-3xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">smlouvy & zakázky</span>
            </div>
          </button>

          {contractor?.name && (
            <div className="hidden xl:flex items-center gap-2 pl-3 border-l border-slate-200 dark:border-slate-800 text-left">
              <div className="leading-tight">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate max-w-[170px]">
                    {contractor.name}
                  </span>
                  <span className="inline-flex items-center gap-0.5 text-[9px] font-bold font-mono px-1 py-0.2 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
                    ARES ✓
                  </span>
                </div>
                {contractor.ico && (
                  <span className="text-[10px] font-mono text-slate-400">
                    IČO: {contractor.ico}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Desktop Nav Items in 3 clear functional sections */}
        <nav className="hidden lg:flex items-center gap-1 bg-slate-50 dark:bg-slate-950/60 p-1 rounded-xl border border-slate-200 dark:border-slate-800/80">
          {/* Provoz na stavbě */}
          <div className="flex items-center gap-0.5">
            {operationalItems.map(renderNavItem)}
          </div>

          <div className="w-px h-5 bg-slate-200 dark:bg-slate-800 mx-1" />

          {/* Smlouvy & Faktury */}
          <div className="flex items-center gap-1">
            {documentItems.map(renderNavItem)}
          </div>

          <div className="w-px h-5 bg-slate-200 dark:border-slate-800 mx-1" />

          {/* Agenda & Rejstřík */}
          <div className="flex items-center gap-0.5">
            {managementItems.map(renderNavItem)}
          </div>
        </nav>

        {/* Actions on Right */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* PRO License Status Button */}
          {onOpenPaywall && (
            <button
              onClick={onOpenPaywall}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-2xs border ${
                subInfo.isPro
                  ? 'bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/70 text-amber-900 dark:text-amber-200 border-amber-300 dark:border-amber-800'
                  : 'bg-amber-500 hover:bg-amber-600 text-slate-950 font-black border-amber-400'
              }`}
              title={
                subInfo.isPro
                  ? `Aktivní licence: ${subInfo.label}`
                  : 'Přejít na plnou verzi Řemeslník PRO'
              }
            >
              <Crown className="w-3.5 h-3.5 fill-current" />
              <span className="hidden sm:inline">
                {subInfo.isPro
                  ? subInfo.plan === 'pro_trial'
                    ? `PRO (${subInfo.daysLeft ?? 14}d)`
                    : 'Mistr PRO'
                  : 'Aktivovat PRO'}
              </span>
              <span className="sm:hidden font-extrabold">PRO</span>
            </button>
          )}

          {/* Cloud Account Button */}
          {onOpenCloudModal && (
            <button
              onClick={onOpenCloudModal}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer border shadow-2xs ${
                currentUser
                  ? 'bg-blue-50 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-200'
              }`}
              title="Cloudový účet a synchronizace zakázek"
            >
              {currentUser ? (
                <>
                  <CloudCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span className="max-w-[70px] truncate hidden sm:inline">
                    {currentUser.displayName?.split(' ')[0] || 'Cloud'}
                  </span>
                </>
              ) : (
                <>
                  <Cloud className="w-3.5 h-3.5 text-blue-600" />
                  <span className="hidden sm:inline">Cloud</span>
                </>
              )}
            </button>
          )}

          {/* Dark Mode Toggle */}
          {onToggleDarkMode && (
            <button
              onClick={onToggleDarkMode}
              className="p-1.5 rounded-lg text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all cursor-pointer border border-slate-200 dark:border-slate-700 shadow-2xs"
              title={isDarkMode ? 'Přepnout na denní režim' : 'Přepnout na noční režim'}
              aria-label="Přepnout noční režim"
            >
              {isDarkMode ? (
                <Sun className="w-3.5 h-3.5 text-amber-400" />
              ) : (
                <Moon className="w-3.5 h-3.5 text-slate-600" />
              )}
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
