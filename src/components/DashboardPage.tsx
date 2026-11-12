import React, { useMemo, useState } from 'react';
import {
  Calendar,
  Clock,
  Briefcase,
  AlertCircle,
  CheckCircle2,
  PlusCircle,
  Camera,
  MessageSquare,
  TrendingUp,
  Receipt,
  ArrowRight,
  MapPin,
  Phone,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  X,
  DollarSign,
  AlertTriangle,
  Send,
  Kanban,
  CalendarDays,
  FileText,
  Lock,
  Calculator,
  ShoppingCart,
  Banknote,
  Car,
  Package,
  Gauge,
  Users,
  Wrench,
  ShieldCheck,
  FolderArchive,
  Layers,
  SquareSplitVertical,
  Paintbrush,
  Zap,
  Hammer,
  Crown,
} from 'lucide-react';
import { Contract, CalendarEvent, ContractorProfile } from '../types/contract';
import { formatCurrency, formatDateCs } from '../utils/numberToWordsCs';
import { getWhatsAppShareUrl } from '../utils/shareUtils';
import { getVocative } from '../utils/vocativeCs';
import { TabType } from './Navbar';
import { WeatherWidget } from './WeatherWidget';
import { getSubscriptionInfo, isProUser } from '../utils/subscription';

interface DashboardPageProps {
  contracts: Contract[];
  calendarEvents: CalendarEvent[];
  contractor?: ContractorProfile | null;
  onSelectTab: (tab: TabType) => void;
  onOpenContract: (contract: Contract) => void;
  onNewContract: () => void;
  onOpenPaywall?: () => void;
  onSelectTradeTemplate?: (tplId: string) => void;
  onOpenReceiptScan: () => void;
  onOpenQuickMessages?: (contract: Contract) => void;
  onOpenSigningKiosk?: (contract: Contract) => void;
  onOpenEstimateCalculator?: () => void;
  onOpenShoppingList?: (contract: Contract) => void;
  onOpenQuickCashReceipt?: (contract: Contract) => void;
  onOpenLogbook?: (contract: Contract) => void;
  onOpenAccountantModal?: () => void;
  onOpenTechnicalProtocols?: (contract: Contract) => void;
  onOpenSubcontractors?: (contract: Contract) => void;
  onOpenToolRental?: (contract: Contract) => void;
  onOpenDepartureChecklist?: (contract: Contract) => void;
  onOpenArchive?: (contract: Contract) => void;
  onFastPhotoCapture?: (contract: Contract, file: File) => void;
  onToggleEventDone?: (eventId: string) => void;
  onMarkInvoicePaid?: (contractId: string) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  contracts,
  calendarEvents,
  contractor,
  onSelectTab,
  onOpenContract,
  onNewContract,
  onOpenPaywall,
  onSelectTradeTemplate,
  onOpenReceiptScan,
  onOpenQuickMessages,
  onOpenSigningKiosk,
  onOpenEstimateCalculator,
  onOpenShoppingList,
  onOpenQuickCashReceipt,
  onOpenLogbook,
  onOpenAccountantModal,
  onOpenTechnicalProtocols,
  onOpenSubcontractors,
  onOpenToolRental,
  onOpenDepartureChecklist,
  onOpenArchive,
  onFastPhotoCapture,
  onToggleEventDone,
  onMarkInvoicePaid,
}) => {
  const [activeToolsContractId, setActiveToolsContractId] = useState<string | null>(null);
  const isPro = isProUser(contractor || null);
  const todayStr = new Date().toISOString().split('T')[0];

  // Dnešní a nejbližší události (včetně termínů ze smluv)
  const todayEvents = useMemo(() => {
    return calendarEvents.filter((e) => e.date === todayStr);
  }, [calendarEvents, todayStr]);

  const upcomingEvents = useMemo(() => {
    return calendarEvents
      .filter((e) => e.date > todayStr)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 4);
  }, [calendarEvents, todayStr]);

  // Zakázky v realizaci
  const inProgressContracts = useMemo(() => {
    return contracts.filter(
      (c) => c.status === 'in_progress' || c.leadStage === 'realization'
    );
  }, [contracts]);

  // Nezaplacené faktury a pohledávky
  const unpaidInvoices = useMemo(() => {
    return contracts
      .filter((c) => {
        // Pouze zakázky, které nejsou 'paid' a mají stanovenou cenu
        if (c.status === 'paid' || c.paidDate) return false;
        if (c.status === 'draft' && !c.leadStage) return false;
        return true;
      })
      .map((c) => {
        // Splatnost standardně 14 dní od předání nebo uzavření
        const baseDate = c.conclusionDate || c.createdAt.split('T')[0];
        const dueObj = new Date(baseDate);
        dueObj.setDate(dueObj.getDate() + 14);
        const dueDateStr = dueObj.toISOString().split('T')[0];
        const isOverdue = dueDateStr < todayStr;
        const diffMs = Math.abs(new Date(todayStr).getTime() - dueObj.getTime());
        const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

        const paidAdvance = c.advanceAmount || 0;
        const total = c.price + (c.amendments || []).reduce((s, a) => s + (a.priceDifference || 0), 0);
        const remainingToPay = Math.max(0, total - paidAdvance);

        return {
          contract: c,
          dueDate: dueDateStr,
          isOverdue,
          diffDays,
          remainingToPay,
        };
      })
      .sort((a, b) => {
        if (a.isOverdue && !b.isOverdue) return -1;
        if (!a.isOverdue && b.isOverdue) return 1;
        return a.dueDate.localeCompare(b.dueDate);
      });
  }, [contracts, todayStr]);

  const totalUnpaidAmount = unpaidInvoices.reduce((s, i) => s + i.remainingToPay, 0);
  const overdueCount = unpaidInvoices.filter((i) => i.isOverdue).length;

  // Pipeline stavy
  const pipelineCounts = useMemo(() => {
    const counts = {
      inquiry: 0,
      quote: 0,
      contract: 0,
      realization: 0,
      completed: 0,
    };
    contracts.forEach((c) => {
      const stage = c.leadStage || (c.docKind === 'quote' ? 'quote' : c.status === 'in_progress' ? 'realization' : c.status === 'paid' ? 'completed' : 'contract');
      if (counts[stage as keyof typeof counts] !== undefined) {
        counts[stage as keyof typeof counts]++;
      }
    });
    return counts;
  }, [contracts]);

  // Formátované datum pro hlavičku
  const formattedToday = useMemo(() => {
    try {
      const d = new Date();
      const days = ['Neděle', 'Pondělí', 'Úterý', 'Středa', 'Čtvrtek', 'Pátek', 'Sobota'];
      const months = [
        'ledna',
        'února',
        'března',
        'dubna',
        'května',
        'června',
        'července',
        'srpna',
        'září',
        'října',
        'listopadu',
        'prosince',
      ];
      return `${days[d.getDay()]} ${d.getDate()}. ${months[d.getMonth()]} ${d.getFullYear()}`;
    } catch {
      return formatDateCs(todayStr);
    }
  }, [todayStr]);

  // Dynamický pozdrav podle denní doby a jména uživatele (namísto obecného "Řídicí panel")
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    let salutation = 'Dobrý den';
    if (hour >= 4 && hour < 10) {
      salutation = 'Dobré ráno';
    } else if (hour >= 10 && hour < 12) {
      salutation = 'Dobré dopoledne';
    } else if (hour >= 12 && hour < 18) {
      salutation = 'Dobré odpoledne';
    } else if (hour >= 18 && hour < 22) {
      salutation = 'Dobrý večer';
    } else {
      salutation = 'Dobrý večer';
    }

    if (contractor?.name) {
      const vocativeName = getVocative(contractor.name);
      if (vocativeName) {
        return `${salutation}, ${vocativeName}!`;
      }
    }
    return `Vítejte, ${salutation.toLowerCase()}!`;
  }, [contractor?.name]);

  return (
    <div className="max-w-[1100px] mx-auto pb-16 space-y-6">
      {/* Horní hlavička dashboardu - Industriální řemeslnický pracovní stůl */}
      <div className="bg-slate-900 dark:bg-slate-950 text-white p-5 sm:p-6 rounded-xl border border-slate-800 shadow-sm relative overflow-hidden animate-in fade-in slide-in-from-top-1 duration-300">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              <span className="font-mono text-xs font-semibold text-slate-300">{formattedToday}</span>
              <span aria-hidden="true" className="text-slate-700">·</span>
              <span className="text-xs text-slate-400 font-mono">Deník zakázek & smluv</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              {greeting}
            </h1>
            <p className="text-xs text-slate-300 max-w-xl">
              Denní přehled: plánované obhlídky a montáže, rozpracované zakázky a přehled plateb.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0 sm:self-center">
            <div className="flex items-center gap-4 px-4 py-2.5 rounded-lg bg-slate-850/90 border border-slate-700/80 text-xs">
              <div>
                <span className="text-slate-400 block text-[10px] font-mono uppercase font-bold tracking-wider">V realizaci</span>
                <span className="font-extrabold text-white text-sm font-mono tabular-nums">{inProgressContracts.length} staveb</span>
              </div>
              <div className="w-px h-6 bg-slate-700" />
              <div>
                <span className="text-slate-400 block text-[10px] font-mono uppercase font-bold tracking-wider">Poptávky</span>
                <span className="font-extrabold text-white text-sm font-mono tabular-nums">{pipelineCounts.inquiry + pipelineCounts.quote} poptávek</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* PRO Upgrade / Trial Status Banner */}
      {(!isProUser(contractor || null) || contractor?.subscriptionPlan === 'pro_trial') && onOpenPaywall && (
        <div className={`p-4 rounded-xl border transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs ${
          contractor?.subscriptionPlan === 'pro_trial'
            ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 text-amber-950 dark:text-amber-200'
            : 'bg-slate-900 dark:bg-slate-950 border-slate-800 text-white'
        }`}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-400 text-slate-950 flex items-center justify-center shrink-0 font-bold shadow-xs">
              <Crown className="w-5 h-5 fill-current" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-bold ${contractor?.subscriptionPlan === 'pro_trial' ? 'text-amber-950 dark:text-white' : 'text-white'}`}>
                  {contractor?.subscriptionPlan === 'pro_trial'
                    ? `Zkušební verze Mistr PRO (${getSubscriptionInfo(contractor).daysLeft ?? 14} dní zbývá)`
                    : 'Přejděte na plnou verzi Řemeslník PRO'}
                </span>
                <span className={`text-[10px] font-extrabold px-1.5 py-0.2 rounded ${
                  contractor?.subscriptionPlan === 'pro_trial'
                    ? 'bg-amber-200 dark:bg-amber-900 text-amber-950 dark:text-amber-200'
                    : 'bg-amber-400/20 text-amber-300 border border-amber-400/30'
                }`}>
                  {contractor?.subscriptionPlan === 'pro_trial' ? 'Aktivní' : '14 dní zdarma'}
                </span>
              </div>
              <p className={`text-xs mt-0.5 leading-relaxed ${contractor?.subscriptionPlan === 'pro_trial' ? 'text-amber-800 dark:text-amber-300' : 'text-slate-300'}`}>
                {contractor?.subscriptionPlan === 'pro_trial'
                  ? 'Všechny funkce jsou odemčeny. Zkontrolujte daňový doklad nebo aktivujte roční plán se slevou 2 měsíce.'
                  : `Využíváte bezplatný tarif (${contracts.length}/3 smluv). Získejte neomezené smlouvy, oficiální živnostenské razítko a faktury s QR platbou.`}
              </p>
            </div>
          </div>

          <button
            onClick={onOpenPaywall}
            className="w-full sm:w-auto px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 active:scale-95 text-slate-950 text-xs font-black shadow-xs flex items-center justify-center gap-1.5 cursor-pointer shrink-0 transition-all"
          >
            <Crown className="w-3.5 h-3.5 fill-current" />
            <span>{contractor?.subscriptionPlan === 'pro_trial' ? 'Spravovat licenci' : 'Vyzkoušet PRO zdarma'}</span>
          </button>
        </div>
      )}

      {/* Rychlé řemeslné předlohy pro živnostníka */}
      <div className="bg-white dark:bg-slate-900 rounded-xl p-4 sm:p-5 border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-2">
            <FileText className="w-4 h-4 text-amber-500" />
            <span>Předvyplněné položkové rozpočty a smlouvy</span>
          </span>
          <span className="text-[11px] font-mono text-slate-400 hidden sm:inline">Předpis dle ČSN · položkové normy</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5">
          {[
            { id: 'tiles-bath', title: 'Koupelny & obklady', norm: 'ČSN 73 3451', icon: Layers, count: '14 položek' },
            { id: 'drywall-attic', title: 'Sádrokarton & SDK', norm: 'ČSN EN 13964', icon: SquareSplitVertical, count: '12 položek' },
            { id: 'painting-interior', title: 'Malování interiérů', norm: 'ČSN 74 4505', icon: Paintbrush, count: '10 položek' },
            { id: 'electrical-flat', title: 'Elektroinstalace', norm: 'ČSN 33 2000', icon: Zap, count: '18 položek' },
            { id: 'flooring-vinyl', title: 'Podlahy & krytiny', norm: 'ČSN 74 4505', icon: Hammer, count: '11 položek' },
          ].map((t) => {
            const IconComponent = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => (onSelectTradeTemplate ? onSelectTradeTemplate(t.id) : onNewContract())}
                className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 hover:border-amber-500/70 dark:hover:border-amber-400/60 bg-slate-50 dark:bg-slate-950/60 hover:bg-white dark:hover:bg-slate-900 text-left transition-all cursor-pointer shadow-2xs group flex flex-col justify-between gap-2"
              >
                <div className="flex items-center justify-between">
                  <div className="w-8 h-8 rounded-md bg-slate-900 dark:bg-slate-800 text-amber-400 flex items-center justify-center group-hover:bg-amber-500 group-hover:text-slate-950 transition-colors">
                    <IconComponent className="w-4 h-4" />
                  </div>
                  <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                    {t.norm}
                  </span>
                </div>
                <div>
                  <span className="text-xs font-bold text-slate-900 dark:text-white block leading-tight">{t.title}</span>
                  <span className="text-[10px] font-mono text-slate-400 block mt-0.5">{t.count}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Rychlé statistické karty - Průmyslový přehled stavby */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
        {/* Dnešní program */}
        <div
          onClick={() => onSelectTab('kalendar')}
          className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs hover:border-slate-400 dark:hover:border-slate-700 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[11px]">
              Dnes v plánu
            </span>
            <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center font-bold">
              <CalendarDays className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <h3 className="text-2xl font-black text-slate-900 dark:text-white tabular-nums tracking-tight">
              {todayEvents.length}
            </h3>
            <span className="text-xs text-slate-400 font-medium">
              {todayEvents.length === 1 ? 'položka' : todayEvents.length < 5 ? 'položky' : 'položek'}
            </span>
          </div>
          <div className="mt-2 text-[11px] text-slate-500 group-hover:text-slate-900 dark:group-hover:text-white flex items-center gap-1 transition-colors font-semibold">
            <span>Otevřít kalendář</span>
            <ChevronRight className="w-3 h-3" />
          </div>
        </div>

        {/* V realizaci */}
        <div
          onClick={() => onSelectTab('pipeline')}
          className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs hover:border-slate-400 dark:hover:border-slate-700 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider text-[11px]">
              V realizaci
            </span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-950/80 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
              <Briefcase className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <h3 className="text-2xl font-black text-slate-900 dark:text-white tabular-nums tracking-tight">
              {inProgressContracts.length}
            </h3>
            <span className="text-xs text-slate-400 font-medium">běžících staveb</span>
          </div>
          <div className="mt-2 text-[11px] text-slate-500 group-hover:text-slate-900 dark:group-hover:text-white flex items-center gap-1 transition-colors font-semibold">
            <span>Zobrazit zakázky</span>
            <ChevronRight className="w-3 h-3" />
          </div>
        </div>

        {/* Pohledávky / Nezaplacené faktury */}
        <div
          onClick={() => onSelectTab('faktury')}
          className={`p-4 sm:p-5 rounded-xl border shadow-2xs transition-all cursor-pointer group ${
            overdueCount > 0
              ? 'bg-rose-50/60 dark:bg-rose-950/30 border-rose-300 dark:border-rose-900/60'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-xs font-bold uppercase tracking-wider text-[11px] ${overdueCount > 0 ? 'text-rose-700 dark:text-rose-400' : 'text-slate-500'}`}>
              Pohledávky
            </span>
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold ${
              overdueCount > 0
                ? 'bg-rose-100 text-rose-700 dark:bg-rose-900 dark:text-rose-200 animate-pulse'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
            }`}>
              <Receipt className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <h3 className={`text-xl sm:text-2xl font-black tabular-nums tracking-tight ${overdueCount > 0 ? 'text-rose-800 dark:text-rose-200' : 'text-slate-900 dark:text-white'}`}>
              {formatCurrency(totalUnpaidAmount)}
            </h3>
          </div>
          <div className="mt-2 text-[11px] flex items-center gap-1 font-semibold">
            {overdueCount > 0 ? (
              <span className="text-rose-700 dark:text-rose-300 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> {overdueCount} {overdueCount === 1 ? 'po splatnosti' : 'po splatnosti'}
              </span>
            ) : (
              <span className="text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Vše uhrazeno v termínu
              </span>
            )}
          </div>
        </div>

        {/* Otevřené poptávky & leady */}
        <div
          onClick={() => onSelectTab('pipeline')}
          className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs hover:border-slate-400 dark:hover:border-slate-700 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[11px]">
              Poptávky & Nabídky
            </span>
            <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center font-bold">
              <Kanban className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <h3 className="text-2xl font-black font-mono text-slate-900 dark:text-white tabular-nums tracking-tight">
              {pipelineCounts.inquiry + pipelineCounts.quote}
            </h3>
            <span className="text-xs text-slate-400 font-medium">k nacenění</span>
          </div>
          <div className="mt-2 text-[11px] text-slate-500 group-hover:text-slate-900 dark:group-hover:text-white flex items-center gap-1 transition-colors font-semibold">
            <span>Průběh zakázek</span>
            <ChevronRight className="w-3 h-3" />
          </div>
        </div>
      </div>

      {/* Rychlá terénní lišta */}
      <div className="flex flex-wrap items-center gap-2 p-2.5 sm:p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider px-2">
          Terénní nástroje:
        </span>
        <button
          onClick={onOpenReceiptScan}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 sm:py-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold border border-slate-200 dark:border-slate-700 cursor-pointer transition-colors"
        >
          <Camera className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
          <span>Vyfotit účtenku</span>
        </button>
        {onOpenEstimateCalculator && (
          <button
            onClick={onOpenEstimateCalculator}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 sm:py-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold border border-slate-200 dark:border-slate-700 cursor-pointer transition-colors"
          >
            <Calculator className="w-3.5 h-3.5 text-amber-600" />
            <span>Kalkulačka na obhlídce</span>
          </button>
        )}
        {isPro && onOpenAccountantModal && (
          <button
            onClick={onOpenAccountantModal}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 sm:py-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 text-emerald-900 dark:text-emerald-300 text-xs font-bold border border-emerald-200/80 cursor-pointer transition-colors"
            title="1-klikový měsíční / kvartální balíček pro účetní (CSV, hotovostní PPD, cesťáky a protokol o předání)"
          >
            <Package className="w-3.5 h-3.5 text-emerald-600" />
            <span>Balíček pro účetní</span>
          </button>
        )}
      </div>

      {/* Hlídač počasí pro stavbu a limity ČSN */}
      <WeatherWidget />

      {/* Dva hlavní bloky vedle sebe */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Levý sloupec (7/12): Kalendář & Běžící stavby */}
        <div className="lg:col-span-7 space-y-6">
          {/* Dnešní program & úkoly */}
          <div className="bg-white dark:bg-slate-900 rounded-xl p-5 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-2xs">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950 text-blue-600 flex items-center justify-center font-bold">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-base">
                    Dnešní program a úkoly
                  </h3>
                  <p className="text-xs text-slate-500">
                    {todayEvents.length > 0
                      ? `${todayEvents.length} naplánovaných položek na dnešek`
                      : 'Na dnešek nemáte žádnou zapsanou schůzku či montáž'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => onSelectTab('kalendar')}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-semibold flex items-center gap-1 cursor-pointer"
              >
                <span>Celý kalendář</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            {todayEvents.length === 0 ? (
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800 text-center space-y-2">
                <p className="text-xs text-slate-500">
                  Dnes máte volnější režim nebo pracujete na dílně.
                </p>
                <button
                  onClick={() => onSelectTab('kalendar')}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-[#1E3A78] text-xs font-semibold cursor-pointer transition-colors"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>+ Přidat obhlídku nebo úkol na dnešek</span>
                </button>
              </div>
            ) : (
              <div className="space-y-2.5">
                {todayEvents.map((event) => (
                  <div
                    key={event.id}
                    className={`p-3.5 rounded-xl border transition-all flex items-start justify-between gap-3 ${
                      event.done
                        ? 'bg-slate-50/60 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 opacity-60'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-2xs hover:border-blue-300'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <button
                        type="button"
                        onClick={() => onToggleEventDone?.(event.id)}
                        className={`mt-0.5 w-5 h-5 rounded-md flex items-center justify-center border transition-colors cursor-pointer ${
                          event.done
                            ? 'bg-emerald-600 border-emerald-600 text-white'
                            : 'border-slate-300 dark:border-slate-700 hover:border-emerald-500'
                        }`}
                      >
                        {event.done && <CheckCircle2 className="w-3.5 h-3.5" />}
                      </button>

                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${
                              event.type === 'obhlidka'
                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                : event.type === 'realizace'
                                ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                                : event.type === 'predani'
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                            }`}
                          >
                            {event.type}
                          </span>
                          <span
                            className={`text-sm font-bold ${
                              event.done ? 'line-through text-slate-400' : 'text-slate-900 dark:text-white'
                            }`}
                          >
                            {event.title}
                          </span>
                        </div>

                        {event.time && (
                          <div className="text-xs font-semibold text-slate-500 flex items-center gap-1">
                            <Clock className="w-3 h-3 text-slate-400" />
                            <span>V {event.time} hod.</span>
                          </div>
                        )}

                        {event.clientName && (
                          <div className="text-xs text-slate-600 dark:text-slate-300 flex items-center gap-1">
                            <span>Klient: {event.clientName}</span>
                          </div>
                        )}

                        {event.location && (
                          <div className="text-xs text-slate-500 flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-slate-400" />
                            <span>{event.location}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Nadcházející dny rychlý seznam */}
            {upcomingEvents.length > 0 && (
              <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">
                  V nejbližších dnech:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {upcomingEvents.map((ue) => (
                    <div
                      key={ue.id}
                      className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800 text-xs flex items-center justify-between"
                    >
                      <div className="truncate pr-2">
                        <span className="font-semibold text-slate-900 dark:text-white block truncate">
                          {ue.title}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          {formatDateCs(ue.date)} {ue.time ? `(${ue.time})` : ''}
                        </span>
                      </div>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 uppercase shrink-0">
                        {ue.type}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Probíhající realizace a stavby */}
          <div className="bg-white dark:bg-slate-900 rounded-xl p-5 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-2xs">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-950 text-amber-600 flex items-center justify-center font-bold">
                  <Briefcase className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-base">
                    Aktuální zakázky v realizaci ({inProgressContracts.length})
                  </h3>
                  <p className="text-xs text-slate-500">
                    Práce, které právě provádíte se zákazníky
                  </p>
                </div>
              </div>
              <button
                onClick={() => onSelectTab('pipeline')}
                className="text-xs text-amber-600 dark:text-amber-400 hover:underline font-semibold flex items-center gap-1 cursor-pointer"
              >
                <span>Všechny fáze</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            {inProgressContracts.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400 p-4 text-center">
                Žádná zakázka není momentálně ve stavu „Probíhá realizace“.
              </p>
            ) : (
              <div className="space-y-3">
                {inProgressContracts.slice(0, 4).map((contract) => {
                  const clientPhone = contract.client.phone?.trim();
                  const clientAddress = contract.client.address || contract.executionPlace;
                  const isDelayed = contract.deliveryDate && new Date(contract.deliveryDate) < new Date();

                  return (
                    <div
                      key={contract.id}
                      className={`p-4 rounded-xl border transition-all shadow-2xs hover:shadow-xs ${
                        isDelayed
                          ? 'border-rose-300 dark:border-rose-900/60 bg-rose-50/20 dark:bg-rose-950/20'
                          : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                        <div className="space-y-1 cursor-pointer flex-1" onClick={() => onOpenContract(contract)}>
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-base text-slate-950 dark:text-white">
                              {contract.client.name}
                            </span>
                            <span className="text-xs font-mono font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                              #{contract.contractNumber}
                            </span>
                            {isDelayed && (
                              <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1">
                                <AlertCircle className="w-3 h-3" /> Termín vypršel
                              </span>
                            )}
                          </div>
                          <p className="text-xs font-medium text-slate-800 dark:text-slate-200 line-clamp-2">
                            {contract.workDescription}
                          </p>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600 dark:text-slate-300 pt-1">
                            <span className="font-semibold">
                              Termín: <strong className={isDelayed ? 'text-rose-600 font-bold' : 'text-slate-900 dark:text-white'}>{formatDateCs(contract.deliveryDate)}</strong>
                            </span>
                            {clientAddress && (
                              <span className="flex items-center gap-1 font-medium truncate max-w-[200px]">
                                <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                {clientAddress}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="font-black text-xl text-slate-950 dark:text-white block tabular-nums">
                            {formatCurrency(contract.price)}
                          </span>
                          <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                            V realizaci
                          </span>
                        </div>
                      </div>

                      {/* Zjednodušená lišta akcí: 4 klíčová tlačítka + Nástroje stavby */}
                      <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-2">
                        {clientPhone && (
                          <a
                            href={`tel:${clientPhone}`}
                            className="min-h-[40px] px-3.5 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-2xs active:scale-95 transition-all"
                            title="Zavolat klientovi z mobilu"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Phone className="w-4 h-4" />
                            <span>Zavolat</span>
                          </a>
                        )}

                        {clientAddress && (
                          <a
                            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(clientAddress)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="min-h-[40px] px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-2xs active:scale-95 transition-all"
                            title="Spustit GPS navigaci na stavbu"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MapPin className="w-4 h-4" />
                            <span>Navigovat</span>
                          </a>
                        )}

                        {/* 1-klikové rychlé foto mobilem přímo do zakázky */}
                        <label
                          className="min-h-[40px] px-3.5 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition-all shadow-2xs"
                          title="Vyfotit stavbu nebo skrytou vadu mobilem"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Camera className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                          <span>Vyfotit</span>
                          <input
                            type="file"
                            accept="image/*"
                            capture="environment"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file && onFastPhotoCapture) {
                                onFastPhotoCapture(contract, file);
                              }
                            }}
                          />
                        </label>

                        {/* Předat mobil k podpisu zákazníkovi (Kiosk) */}
                        {onOpenSigningKiosk && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenSigningKiosk(contract);
                            }}
                            className="min-h-[40px] px-3.5 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs flex items-center justify-center gap-1.5 active:scale-95 transition-all cursor-pointer shadow-2xs"
                            title="Předat telefon zákazníkovi k podpisu prstem (skryje ostatní finance)"
                          >
                            <Lock className="w-3.5 h-3.5" />
                            <span>Podepsat</span>
                          </button>
                        )}

                        {/* Rozbalovací menu: Nástroje stavby (Mistr PRO) */}
                        {isPro && (() => {
                          const isMenuOpen = activeToolsContractId === contract.id;
                          const hasOverdueTool = contract.toolRentals?.some((t) => !t.isReturned);
                          return (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveToolsContractId(isMenuOpen ? null : contract.id);
                              }}
                              className={`min-h-[40px] px-3.5 py-2 rounded-lg border text-xs font-bold flex items-center justify-center gap-1.5 active:scale-95 transition-all cursor-pointer ${
                                isMenuOpen
                                  ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                                  : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-700'
                              }`}
                              title="Otevřít nástroje pro stavbu (PPD hotovost, nákupní lístek, parťáci, zkoušky ČSN, půjčovna, odjezd)"
                            >
                              <Wrench className="w-3.5 h-3.5" />
                              <span>Nástroje stavby</span>
                              {hasOverdueTool && (
                                <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" title="Upozornění: nevrácené nářadí" />
                              )}
                              {isMenuOpen ? (
                                <ChevronUp className="w-3.5 h-3.5" />
                              ) : (
                                <ChevronDown className="w-3.5 h-3.5 opacity-70" />
                              )}
                            </button>
                          );
                        })()}

                        <button
                          onClick={() => onOpenContract(contract)}
                          className="min-h-[40px] px-3.5 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-800 dark:text-slate-200 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors ml-auto"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>Detail</span>
                        </button>
                      </div>

                      {/* Rozbalovací panel nástrojů stavby (Mistr PRO) */}
                      {isPro && activeToolsContractId === contract.id && (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className="mt-3 p-4 rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 space-y-3 shadow-inner"
                        >
                          <div className="flex items-center justify-between pb-2 border-b border-slate-200/80 dark:border-slate-800">
                            <span className="text-xs font-extrabold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                              <Wrench className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                              Nástroje & evidence pro stavbu #{contract.contractNumber}
                            </span>
                            <button
                              type="button"
                              onClick={() => setActiveToolsContractId(null)}
                              className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                              title="Zavřít panel nástrojů"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>

                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                            {/* PPD hotovost */}
                            {onOpenQuickCashReceipt && (
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveToolsContractId(null);
                                  onOpenQuickCashReceipt(contract);
                                }}
                                className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-emerald-500 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/40 text-left transition-all cursor-pointer group shadow-2xs"
                              >
                                <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900 dark:text-white group-hover:text-emerald-700">
                                  <Banknote className="w-4 h-4 text-emerald-600 shrink-0" />
                                  <span>PPD hotovost</span>
                                </div>
                                <span className="text-[10px] text-slate-500 block mt-0.5">Příjem peněz na ruku</span>
                              </button>
                            )}

                            {/* Materiál do stavebnin */}
                            {onOpenShoppingList && (
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveToolsContractId(null);
                                  onOpenShoppingList(contract);
                                }}
                                className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-blue-500 hover:bg-blue-50/50 dark:hover:bg-blue-950/40 text-left transition-all cursor-pointer group shadow-2xs"
                              >
                                <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900 dark:text-white group-hover:text-blue-700">
                                  <ShoppingCart className="w-4 h-4 text-amber-600 shrink-0" />
                                  <span>Materiál & DEK</span>
                                </div>
                                <span className="text-[10px] text-slate-500 block mt-0.5">Nákupní lístek</span>
                              </button>
                            )}

                            {/* Cesťák & kniha jízd */}
                            {onOpenLogbook && (
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveToolsContractId(null);
                                  onOpenLogbook(contract);
                                }}
                                className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-blue-500 hover:bg-blue-50/50 dark:hover:bg-blue-950/40 text-left transition-all cursor-pointer group shadow-2xs"
                              >
                                <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900 dark:text-white group-hover:text-blue-700">
                                  <Car className="w-4 h-4 text-blue-600 shrink-0" />
                                  <span>Kniha jízd</span>
                                </div>
                                <span className="text-[10px] text-slate-500 block mt-0.5">Cesťák na celou stavbu</span>
                              </button>
                            )}

                            {/* Parťáci a tým */}
                            {onOpenSubcontractors && (
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveToolsContractId(null);
                                  onOpenSubcontractors(contract);
                                }}
                                className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-amber-500 hover:bg-amber-50/50 dark:hover:bg-amber-950/40 text-left transition-all cursor-pointer group shadow-2xs"
                              >
                                <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900 dark:text-white group-hover:text-amber-700">
                                  <Users className="w-4 h-4 text-amber-600 shrink-0" />
                                  <span>Parťáci & brigáda</span>
                                </div>
                                <span className="text-[10px] text-slate-500 block mt-0.5">
                                  {contract.subcontractors?.length
                                    ? `${contract.subcontractors.length} pracovníků`
                                    : 'Evidence hodin'}
                                </span>
                              </button>
                            )}

                            {/* Půjčovna nářadí */}
                            {onOpenToolRental && (
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveToolsContractId(null);
                                  onOpenToolRental(contract);
                                }}
                                className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-cyan-500 hover:bg-cyan-50/50 dark:hover:bg-cyan-950/40 text-left transition-all cursor-pointer group shadow-2xs"
                              >
                                <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900 dark:text-white group-hover:text-cyan-700">
                                  <Wrench className="w-4 h-4 text-cyan-600 shrink-0" />
                                  <span>Půjčovna nářadí</span>
                                  {contract.toolRentals?.some((t) => !t.isReturned) && (
                                    <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0 ml-auto" title="Nevrácené nářadí" />
                                  )}
                                </div>
                                <span className="text-[10px] text-slate-500 block mt-0.5">Termíny vrácení (DEK)</span>
                              </button>
                            )}

                            {/* Zkoušky ČSN */}
                            {onOpenTechnicalProtocols && (
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveToolsContractId(null);
                                  onOpenTechnicalProtocols(contract);
                                }}
                                className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-teal-500 hover:bg-teal-50/50 dark:hover:bg-teal-950/40 text-left transition-all cursor-pointer group shadow-2xs"
                              >
                                <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900 dark:text-white group-hover:text-teal-700">
                                  <Gauge className="w-4 h-4 text-teal-600 shrink-0" />
                                  <span>Zkoušky ČSN</span>
                                  {contract.technicalProtocols && contract.technicalProtocols.length > 0 && (
                                    <span className="text-[10px] font-bold text-teal-600 ml-auto">
                                      ({contract.technicalProtocols.length})
                                    </span>
                                  )}
                                </div>
                                <span className="text-[10px] text-slate-500 block mt-0.5">Tlakovky vody, topení</span>
                              </button>
                            )}

                            {/* Odjezd ze stavby */}
                            {onOpenDepartureChecklist && (
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveToolsContractId(null);
                                  onOpenDepartureChecklist(contract);
                                }}
                                className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-emerald-500 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/40 text-left transition-all cursor-pointer group shadow-2xs"
                              >
                                <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900 dark:text-white group-hover:text-emerald-700">
                                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                                  <span>Odjezd ze stavby</span>
                                </div>
                                <span className="text-[10px] text-slate-500 block mt-0.5">Voda, elektřina, zámky</span>
                              </button>
                            )}

                            {/* Kompletní složka zakázky */}
                            {onOpenArchive && (
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveToolsContractId(null);
                                  onOpenArchive(contract);
                                }}
                                className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-indigo-500 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/40 text-left transition-all cursor-pointer group shadow-2xs"
                              >
                                <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900 dark:text-white group-hover:text-indigo-700">
                                  <FolderArchive className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                                  <span>Složka zakázky</span>
                                </div>
                                <span className="text-[10px] text-slate-500 block mt-0.5">Šanon a archiv v PDF</span>
                              </button>
                            )}

                            {/* Rychlá SMS / WhatsApp zpráva */}
                            {onOpenQuickMessages && (
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveToolsContractId(null);
                                  onOpenQuickMessages(contract);
                                }}
                                className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-blue-500 hover:bg-blue-50/50 dark:hover:bg-blue-950/40 text-left transition-all cursor-pointer group shadow-2xs col-span-2 sm:col-span-4"
                              >
                                <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900 dark:text-white group-hover:text-blue-700">
                                  <MessageSquare className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                                  <span>Rychlá SMS / WhatsApp (Jsem na cestě, Schnutí, Závoz materiálu)</span>
                                </div>
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Upozornění na prémiové nástroje pro uživatele základní verze */}
            {!isPro && (
              <div className="mt-4 p-4 rounded-xl bg-slate-900 dark:bg-slate-950 border border-slate-800 text-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-amber-400 text-slate-950 flex items-center justify-center shrink-0 font-bold shadow-xs">
                    <Crown className="w-4 h-4 fill-current" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-bold text-white">
                        Základní verze pro řemeslníky
                      </h4>
                      <span className="text-[10px] px-2 py-0.2 rounded bg-amber-400/20 text-amber-300 border border-amber-400/30 font-bold">
                        Zdarma
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">
                      Smlouvy, podpis klienta na mobilu, fotky a GPS navigaci máte aktivní. Pokročilé terénní moduly (kniha jízd, parťáci, půjčovna nářadí, protokoly ČSN a balíček pro účetní) se odemknou v licenci Mistr PRO.
                    </p>
                  </div>
                </div>
                {onOpenPaywall && (
                  <button
                    type="button"
                    onClick={() => onOpenPaywall()}
                    className="w-full sm:w-auto px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-black flex items-center justify-center gap-1.5 shrink-0 shadow-xs cursor-pointer transition-all active:scale-95 whitespace-nowrap"
                  >
                    <Crown className="w-3.5 h-3.5 fill-current" />
                    <span>Odemknout PRO</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Pravý sloupec (5/12): Nezaplacené faktury & Hlídač splatnosti */}
        <div className="lg:col-span-5 space-y-6">
          {/* Hlídač nezaplacených faktur (Semafor) */}
          <div className="bg-white dark:bg-slate-900 rounded-xl p-5 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-2xs">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold ${
                    overdueCount > 0
                      ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                      : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                  }`}
                >
                  <Receipt className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-base">
                    Nezaplacené faktury
                  </h3>
                  <p className="text-xs text-slate-500">
                    {overdueCount > 0
                      ? `${overdueCount} po splatnosti`
                      : 'Pohledávky k inkasu'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => onSelectTab('faktury')}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-semibold flex items-center gap-1 cursor-pointer"
              >
                <span>Všechny</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            {unpaidInvoices.length === 0 ? (
              <div className="p-4 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-800 text-center space-y-1">
                <CheckCircle2 className="w-6 h-6 text-emerald-600 mx-auto" />
                <p className="text-xs font-bold text-emerald-900 dark:text-emerald-200">
                  Všechny zakázky jsou řádně uhrazeny!
                </p>
                <p className="text-[11px] text-emerald-700 dark:text-emerald-400">
                  Žádné pohledávky po splatnosti.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {unpaidInvoices.slice(0, 4).map(({ contract, dueDate, isOverdue, diffDays, remainingToPay }) => {
                  const whatsappUrl = getWhatsAppShareUrl(contract, 'faktura');
                  return (
                    <div
                      key={contract.id}
                      className={`p-3.5 rounded-xl border transition-all space-y-2 ${
                        isOverdue
                          ? 'bg-rose-50/50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/60'
                          : 'bg-slate-50/60 dark:bg-slate-800/40 border-slate-200/80 dark:border-slate-800'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="font-bold text-sm text-slate-900 dark:text-white block">
                            {contract.client.name}
                          </span>
                          <span className="text-[11px] text-slate-500 font-mono">
                            FA-{contract.invoiceNumber || '2026001'} · VS {contract.variableSymbol || '2026001'}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="font-extrabold text-sm text-slate-900 dark:text-white block">
                            {formatCurrency(remainingToPay)}
                          </span>
                          <span
                            className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${
                              isOverdue
                                ? 'bg-rose-100 text-rose-800 dark:bg-rose-900/80 dark:text-rose-200 animate-pulse'
                                : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                            }`}
                          >
                            {isOverdue ? `Po splatnosti (${diffDays}d)` : `Splatnost ${formatDateCs(dueDate)}`}
                          </span>
                        </div>
                      </div>

                      {/* Akce u faktury: WhatsApp upomínka + Označit za zaplaceno */}
                      <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-slate-200/60 dark:border-slate-700/60">
                        <a
                          href={whatsappUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 hover:underline"
                          title="Odeslat přátelskou upomínku na WhatsApp klienta"
                        >
                          <Send className="w-3 h-3 text-emerald-600" />
                          <span>WhatsApp upomínka</span>
                        </a>

                        <button
                          type="button"
                          onClick={() => onMarkInvoicePaid?.(contract.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-semibold cursor-pointer transition-colors shadow-2xs"
                        >
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Zaplaceno</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Průběh a fáze zakázek */}
          <div className="bg-white dark:bg-slate-900 rounded-xl p-5 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3.5">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-md bg-slate-900 dark:bg-slate-800 text-amber-400 flex items-center justify-center">
                  <Kanban className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h4 className="font-extrabold text-sm text-slate-900 dark:text-white">
                    Průběh a etapy zakázek
                  </h4>
                  <span className="text-[10px] font-mono text-slate-400">Stav prací od první poptávky po předání díla</span>
                </div>
              </div>
              <button
                onClick={() => onSelectTab('pipeline')}
                className="text-xs font-mono font-bold text-amber-600 dark:text-amber-400 hover:underline cursor-pointer"
              >
                Otevřít přehled zakázek →
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              {/* 1. Nové poptávky */}
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800/90 hover:border-slate-300 dark:hover:border-slate-700 transition-colors">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    01 · Poptávky
                  </span>
                </div>
                <span className="text-2xl font-black font-mono tabular-nums text-slate-900 dark:text-white">
                  {pipelineCounts.inquiry}
                </span>
                <span className="text-[10px] text-slate-400 block mt-0.5">k obhlídce / nacenění</span>
              </div>

              {/* 2. Odeslané nabídky */}
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800/90 hover:border-slate-300 dark:hover:border-slate-700 transition-colors">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    02 · Nabídky
                  </span>
                </div>
                <span className="text-2xl font-black font-mono tabular-nums text-slate-900 dark:text-white">
                  {pipelineCounts.quote}
                </span>
                <span className="text-[10px] text-slate-400 block mt-0.5">čeká na podpis SOD</span>
              </div>

              {/* 3. V realizaci */}
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800/90 hover:border-slate-300 dark:hover:border-slate-700 transition-colors">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    03 · Stavba
                  </span>
                </div>
                <span className="text-2xl font-black font-mono tabular-nums text-slate-900 dark:text-white">
                  {pipelineCounts.realization}
                </span>
                <span className="text-[10px] text-slate-400 block mt-0.5">aktivní montáž</span>
              </div>

              {/* 4. Dokončeno & Zaplaceno */}
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800/90 hover:border-slate-300 dark:hover:border-slate-700 transition-colors">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    04 · Uzavřeno
                  </span>
                </div>
                <span className="text-2xl font-black font-mono tabular-nums text-slate-900 dark:text-white">
                  {pipelineCounts.completed}
                </span>
                <span className="text-[10px] text-slate-400 block mt-0.5">předáno & doplaceno</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
