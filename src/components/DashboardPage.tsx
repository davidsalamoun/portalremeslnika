import React, { useMemo, useState } from 'react';
import {
  Camera,
  MessageSquare,
  Receipt,
  MapPin,
  Phone,
  ChevronDown,
  ChevronUp,
  Check,
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
  PenLine,
  Send,
  Plus,
  Crown,
} from 'lucide-react';
import { Contract, CalendarEvent, ContractorProfile, CalendarEventType } from '../types/contract';
import { formatCurrency, formatDateCs } from '../utils/numberToWordsCs';
import { getWhatsAppShareUrl } from '../utils/shareUtils';
import { getVocative } from '../utils/vocativeCs';
import { TabType } from './Navbar';
import { WeatherWidget } from './WeatherWidget';
import { getSubscriptionInfo, isProUser } from '../utils/subscription';
import { isInvoiceable, isContractPaid, getFinalBalance, getInvoiceStatus, getContractTotal } from '../utils/invoiceMath';
import { getJobStage, isActiveJob, JOB_STAGE_LABELS } from '../utils/jobStage';
import { Metr } from './Logo';

const EVENT_TYPE_LABELS: Record<CalendarEventType, string> = {
  realizace: 'Realizace',
  obhlidka: 'Obhlídka',
  predani: 'Předání',
  zaloha: 'Záloha',
  material: 'Materiál',
  zaruka: 'Záruka',
  jine: 'Jiné',
};

const TRADE_TEMPLATES = [
  { id: 'tiles-bath', title: 'Koupelny a obklady', count: '14 položek' },
  { id: 'drywall-attic', title: 'Sádrokarton', count: '12 položek' },
  { id: 'painting-interior', title: 'Malování interiérů', count: '10 položek' },
  { id: 'electrical-flat', title: 'Elektroinstalace', count: '18 položek' },
  { id: 'flooring-vinyl', title: 'Podlahy a krytiny', count: '11 položek' },
];

// Společné tvary prvků přehledu (vzhled „Výkres a metr“)
const sectionTitle = 'text-2xl font-semibold text-slate-900 dark:text-white';
const listBox =
  'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md divide-y divide-slate-100 dark:divide-slate-800';
const outlineButton =
  'min-h-11 px-4 inline-flex items-center justify-center gap-2 rounded-md border-[1.5px] border-slate-900 dark:border-slate-500 text-slate-900 dark:text-slate-100 font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors';
const smallAction =
  'min-h-11 px-3 inline-flex items-center justify-center gap-1.5 rounded-md border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-medium hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors';
const textLink = 'min-h-11 inline-flex items-center font-medium text-blue-600 dark:text-blue-300 underline underline-offset-2 cursor-pointer';
const bigNumber = 'font-display font-semibold tabular-nums';

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

  // Rozpracované zakázky: vše, co ještě není zaplacené; nejdál pokročilé nahoře
  const activeJobs = useMemo(() => {
    return contracts
      .filter(isActiveJob)
      .map((contract) => ({ contract, stage: getJobStage(contract) }))
      .sort((a, b) => b.stage.percent - a.stage.percent || (a.contract.deliveryDate || '').localeCompare(b.contract.deliveryDate || ''));
  }, [contracts]);
  const shownJobs = activeJobs.slice(0, 6);

  // Nezaplacené faktury a pohledávky
  const unpaidInvoices = useMemo(() => {
    return contracts
      .filter((c) => {
        // Pouze smlouvy s cenou, které nejsou zaplacené (nabídka ani poptávka pohledávkou nejsou)
        if (!isInvoiceable(c) || isContractPaid(c)) return false;
        if (c.status === 'draft' && !c.leadStage) return false;
        return true;
      })
      .map((c) => {
        // Splatnost 14 dní od předání díla – stejně jako na dokladu faktury (utils/invoiceMath)
        const { dueDate: dueDateStr, isOverdue, daysPastDue } = getInvoiceStatus(c, todayStr);
        const diffDays = Math.abs(daysPastDue);
        const remainingToPay = getFinalBalance(c);

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
        return `${salutation}, ${vocativeName}`;
      }
    }
    return salutation;
  }, [contractor?.name]);

  const overdueAmount = unpaidInvoices.filter((i) => i.isOverdue).reduce((sum, i) => sum + i.remainingToPay, 0);
  const subInfo = getSubscriptionInfo(contractor || null);

  const tools = (contract: Contract) =>
    [
      { label: 'Příjem hotovosti', icon: Banknote, run: onOpenQuickCashReceipt },
      { label: 'Nákupní seznam', icon: ShoppingCart, run: onOpenShoppingList },
      { label: 'Kniha jízd', icon: Car, run: onOpenLogbook },
      { label: 'Parťáci a tým', icon: Users, run: onOpenSubcontractors },
      { label: 'Půjčené nářadí', icon: Package, run: onOpenToolRental, alert: contract.toolRentals?.some((t) => !t.isReturned) },
      { label: 'Zkoušky a protokoly', icon: Gauge, run: onOpenTechnicalProtocols },
      { label: 'Odjezd ze stavby', icon: ShieldCheck, run: onOpenDepartureChecklist },
      { label: 'Složka zakázky', icon: FolderArchive, run: onOpenArchive },
      { label: 'Zpráva zákazníkovi', icon: MessageSquare, run: onOpenQuickMessages },
    ].filter((t) => !!t.run);

  return (
    <div className="max-w-[1180px] mx-auto pb-16 space-y-9 text-[15px] leading-snug">
      {/* Hlavička: datum, pozdrav a vedlejší akce */}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-slate-500 dark:text-slate-400">{formattedToday}</div>
          <h1 className="text-4xl sm:text-[44px] font-bold leading-[1.05] text-slate-900 dark:text-white">{greeting}</h1>
        </div>
        <div className="w-full sm:w-auto flex flex-wrap gap-2.5">
          <button type="button" onClick={onOpenReceiptScan} className={`${outlineButton} w-full sm:w-auto`}>
            <Receipt className="w-[18px] h-[18px]" />
            <span>Vyfotit účtenku</span>
          </button>
          {onOpenEstimateCalculator && (
            <button type="button" onClick={onOpenEstimateCalculator} className={`${outlineButton} w-full sm:w-auto`}>
              <Calculator className="w-[18px] h-[18px]" />
              <span>Kalkulačka na obhlídce</span>
            </button>
          )}
          {isPro && onOpenAccountantModal && (
            <button type="button" onClick={onOpenAccountantModal} className={`${outlineButton} w-full sm:w-auto`}>
              <FolderArchive className="w-[18px] h-[18px]" />
              <span>Podklady pro účetní</span>
            </button>
          )}
        </div>
      </header>

      {/* Nabídka plné verze – jen se zapnutým placením */}
      {(!isPro || contractor?.subscriptionPlan === 'pro_trial') && onOpenPaywall && (
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-[1.5px] border-blue-600 dark:border-blue-400 rounded-md text-blue-700 dark:text-blue-200">
          <div className="flex items-center gap-3">
            <Crown className="w-5 h-5 shrink-0" />
            <span className="font-medium">
              {contractor?.subscriptionPlan === 'pro_trial'
                ? `Zkušební verze Mistr PRO, zbývá ${subInfo.daysLeft ?? 14} dní`
                : 'Plná verze: neomezené smlouvy, razítko a nástroje stavby'}
            </span>
          </div>
          <button type="button" onClick={onOpenPaywall} className={outlineButton}>
            {contractor?.subscriptionPlan === 'pro_trial' ? 'Spravovat licenci' : 'Vyzkoušet PRO zdarma'}
          </button>
        </div>
      )}

      {/* Dnes */}
      <section aria-labelledby="prehled-dnes" className="space-y-2.5">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="prehled-dnes" className={sectionTitle}>
            Dnes
          </h2>
          <button type="button" onClick={() => onSelectTab('kalendar')} className={textLink}>
            Celý kalendář
          </button>
        </div>
        <div className={listBox}>
          {todayEvents.length === 0 && (
            <div className="px-5 py-4 flex flex-wrap items-center justify-between gap-3">
              <span className="text-slate-600 dark:text-slate-300">Na dnešek nemáte nic naplánováno.</span>
              <button type="button" onClick={() => onSelectTab('kalendar')} className={smallAction}>
                <Plus className="w-4 h-4" />
                <span>Přidat obhlídku nebo úkol</span>
              </button>
            </div>
          )}
          {todayEvents.map((event) => (
            <div key={event.id} className={`px-5 py-3.5 flex items-center gap-4 ${event.done ? 'opacity-60' : ''}`}>
              <button
                type="button"
                onClick={() => onToggleEventDone?.(event.id)}
                aria-pressed={!!event.done}
                aria-label={event.done ? `Označit „${event.title}“ jako nehotové` : `Označit „${event.title}“ jako hotové`}
                className="w-11 h-11 -ml-2.5 shrink-0 inline-flex items-center justify-center cursor-pointer"
              >
                <span
                  className={`w-6 h-6 rounded-sm border-[1.5px] inline-flex items-center justify-center ${
                    event.done
                      ? 'bg-emerald-700 border-emerald-700 text-white'
                      : 'border-slate-900 dark:border-slate-400 bg-white dark:bg-slate-950'
                  }`}
                >
                  {event.done && <Check className="w-4 h-4" strokeWidth={3} />}
                </span>
              </button>
              <div className={`w-14 shrink-0 text-[22px] ${bigNumber}`}>{event.time || ''}</div>
              <div className="flex-1 min-w-0">
                <div className={`font-semibold text-slate-900 dark:text-white ${event.done ? 'line-through' : ''}`}>
                  {event.title}
                </div>
                <div className="text-slate-600 dark:text-slate-400">
                  {[EVENT_TYPE_LABELS[event.type], event.clientName, event.location].filter(Boolean).join(', ')}
                </div>
              </div>
              {event.location && (
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.location)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`${textLink} shrink-0 !hidden sm:!inline-flex`}
                >
                  Navigovat
                </a>
              )}
            </div>
          ))}
          {upcomingEvents.map((event) => (
            <div key={event.id} className="px-5 py-3 flex items-baseline gap-4 text-slate-600 dark:text-slate-400">
              <div className="w-36 shrink-0 whitespace-nowrap tabular-nums">
                {formatDateCs(event.date)}
                {event.time ? `, ${event.time}` : ''}
              </div>
              <div className="flex-1 min-w-0 truncate">
                <span className="text-slate-900 dark:text-slate-100">{event.title}</span>
                <span>, {EVENT_TYPE_LABELS[event.type].toLowerCase()}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-x-10 gap-y-9 items-start">
        {/* Rozpracované zakázky s metrem */}
        <section aria-labelledby="prehled-zakazky" className="xl:col-span-3 space-y-2.5 min-w-0">
          <div className="flex items-baseline justify-between gap-3">
            <h2 id="prehled-zakazky" className={sectionTitle}>
              Rozpracované zakázky
            </h2>
            <button type="button" onClick={() => onSelectTab('pipeline')} className={textLink}>
              Všechny zakázky{activeJobs.length > shownJobs.length ? ` (${activeJobs.length})` : ''}
            </button>
          </div>
          <div className={listBox}>
            {shownJobs.length === 0 && (
              <div className="px-5 py-5 flex flex-wrap items-center justify-between gap-3">
                <span className="text-slate-600 dark:text-slate-300">Zatím tu není žádná rozpracovaná zakázka.</span>
                <button type="button" onClick={onNewContract} className={smallAction}>
                  <Plus className="w-4 h-4" />
                  <span>Nová smlouva</span>
                </button>
              </div>
            )}
            {shownJobs.map(({ contract, stage }) => {
              const clientPhone = contract.client?.phone?.replace(/\s+/g, '');
              const clientAddress = contract.client?.address;
              const total = getContractTotal(contract);
              const onSite = stage.key === 'contract' || stage.key === 'realization' || stage.key === 'handover';
              const isToolsOpen = activeToolsContractId === contract.id;
              const jobTools = tools(contract);
              const hasToolAlert = jobTools.some((t) => t.alert);
              const term =
                stage.key === 'quote' && contract.quoteValidUntil
                  ? `nabídka platí do ${formatDateCs(contract.quoteValidUntil)}`
                  : contract.deliveryDate
                    ? `předání ${formatDateCs(contract.deliveryDate)}`
                    : '';
              return (
                <div key={contract.id} className="px-5 py-[18px] space-y-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <div className="min-w-0 flex-1 basis-56">
                      <button
                        type="button"
                        onClick={() => onOpenContract(contract)}
                        className="text-left text-[17px] font-semibold text-slate-900 dark:text-white hover:underline underline-offset-2 cursor-pointer"
                      >
                        {contract.workDescription || 'Zakázka bez popisu'}
                      </button>
                      <div className="text-slate-600 dark:text-slate-400">
                        {[contract.client?.name, clientAddress].filter(Boolean).join(', ')}
                      </div>
                    </div>
                    <div className="w-full sm:w-auto flex sm:block items-baseline justify-between gap-3 sm:text-right">
                      <div className={`text-[22px] text-slate-900 dark:text-white ${bigNumber}`}>
                        {total > 0 ? formatCurrency(total) : 'bez ceny'}
                      </div>
                      {term && <div className="text-slate-600 dark:text-slate-400">{term}</div>}
                    </div>
                  </div>

                  <Metr percent={stage.percent} label={`Fáze zakázky: ${stage.label}`} />
                  <div className="hidden sm:flex justify-between gap-2 text-[13px] text-slate-600 dark:text-slate-400">
                    {JOB_STAGE_LABELS.map((s) => (
                      <span key={s.key} className={s.key === stage.key ? 'font-semibold text-slate-900 dark:text-white' : ''}>
                        {s.label}
                      </span>
                    ))}
                  </div>

                  <div className="font-medium text-slate-900 dark:text-slate-100">
                    <span className="sm:hidden">{stage.label}: </span>
                    {stage.next}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {clientPhone && (
                      <a href={`tel:${clientPhone}`} className={smallAction}>
                        <Phone className="w-4 h-4" />
                        <span>Zavolat</span>
                      </a>
                    )}
                    {clientAddress && (
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(clientAddress)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={smallAction}
                      >
                        <MapPin className="w-4 h-4" />
                        <span>Navigovat</span>
                      </a>
                    )}
                    {onSite && (
                      <label className={smallAction}>
                        <Camera className="w-4 h-4" />
                        <span>Vyfotit</span>
                        <input
                          type="file"
                          accept="image/*"
                          capture="environment"
                          className="sr-only"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file && onFastPhotoCapture) onFastPhotoCapture(contract, file);
                          }}
                        />
                      </label>
                    )}
                    {onSite && onOpenSigningKiosk && (
                      <button type="button" onClick={() => onOpenSigningKiosk(contract)} className={smallAction}>
                        <PenLine className="w-4 h-4" />
                        <span>Podpis zákazníka</span>
                      </button>
                    )}
                    {onSite && isPro && jobTools.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setActiveToolsContractId(isToolsOpen ? null : contract.id)}
                        aria-expanded={isToolsOpen}
                        className={smallAction}
                      >
                        <Wrench className="w-4 h-4" />
                        <span>Nástroje stavby</span>
                        {hasToolAlert && <span className="w-2 h-2 rounded-full bg-rose-600" title="Nevrácené nářadí" />}
                        {isToolsOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    )}
                  </div>

                  {isToolsOpen && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
                      {jobTools.map((tool) => {
                        const Icon = tool.icon;
                        return (
                          <button
                            key={tool.label}
                            type="button"
                            onClick={() => {
                              setActiveToolsContractId(null);
                              tool.run?.(contract);
                            }}
                            className={`${smallAction} justify-start text-left`}
                          >
                            <Icon className="w-4 h-4 shrink-0" />
                            <span>{tool.label}</span>
                            {tool.alert && <span className="w-2 h-2 rounded-full bg-rose-600 shrink-0" title="Nevrácené nářadí" />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Čeká na zaplacení */}
        <section aria-labelledby="prehled-platby" className="xl:col-span-2 space-y-2.5 min-w-0">
          <div className="flex items-baseline justify-between gap-3">
            <h2 id="prehled-platby" className={sectionTitle}>
              Čeká na zaplacení
            </h2>
            <button type="button" onClick={() => onSelectTab('faktury')} className={textLink}>
              Všechny faktury
            </button>
          </div>
          <div className={listBox}>
            <div className="px-5 py-[18px] !border-b !border-slate-900 dark:!border-slate-500">
              <div className={`text-[40px] leading-none text-slate-900 dark:text-white font-display font-bold tabular-nums`}>
                {formatCurrency(totalUnpaidAmount)}
              </div>
              <div className="mt-1.5 text-slate-600 dark:text-slate-400">
                {unpaidInvoices.length === 0
                  ? 'Všechny faktury jsou zaplacené.'
                  : `${unpaidInvoices.length === 1 ? 'v jedné faktuře' : `ve ${unpaidInvoices.length} fakturách`}${
                      overdueCount > 0 ? `, z toho ${formatCurrency(overdueAmount)} po splatnosti` : ''
                    }`}
              </div>
            </div>
            {unpaidInvoices.slice(0, 5).map(({ contract, dueDate, isOverdue, diffDays, remainingToPay }) => (
              <div key={contract.id} className="px-5 py-4 space-y-2.5">
                <div className="flex items-baseline justify-between gap-3">
                  <div className="min-w-0">
                    <button
                      type="button"
                      onClick={() => onOpenContract(contract)}
                      className="text-left font-semibold text-slate-900 dark:text-white hover:underline underline-offset-2 cursor-pointer"
                    >
                      {contract.client?.name || 'Klient bez jména'}
                    </button>
                    <div className="text-slate-600 dark:text-slate-400">Faktura {contract.invoiceNumber || contract.contractNumber}</div>
                  </div>
                  <div className={`text-[22px] whitespace-nowrap text-slate-900 dark:text-white ${bigNumber}`}>
                    {formatCurrency(remainingToPay)}
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span
                    className={`font-semibold px-2.5 py-0.5 rounded-sm ${
                      isOverdue
                        ? 'bg-rose-700 text-white'
                        : 'border border-slate-500 text-slate-900 dark:text-slate-100'
                    }`}
                  >
                    {isOverdue
                      ? `${diffDays} ${diffDays === 1 ? 'den' : diffDays >= 2 && diffDays <= 4 ? 'dny' : 'dní'} po splatnosti`
                      : `splatná ${formatDateCs(dueDate)}`}
                  </span>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                    <a
                      href={getWhatsAppShareUrl(contract, 'faktura')}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`${textLink} gap-1.5`}
                    >
                      <Send className="w-4 h-4" />
                      <span>Upomínka</span>
                    </a>
                    <button
                      type="button"
                      onClick={() => onMarkInvoicePaid?.(contract.id)}
                      className={`${textLink} gap-1.5`}
                    >
                      <Check className="w-4 h-4" />
                      <span>Zaplaceno</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Počasí na stavbě */}
      <WeatherWidget />

      {/* Začít ze šablony */}
      <section aria-labelledby="prehled-sablony" className="space-y-2.5">
        <h2 id="prehled-sablony" className={sectionTitle}>
          Nová smlouva ze šablony
        </h2>
        <div className="flex flex-wrap gap-2.5">
          {TRADE_TEMPLATES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => (onSelectTradeTemplate ? onSelectTradeTemplate(t.id) : onNewContract())}
              className={`${smallAction} flex-col !items-start !justify-center !gap-0 py-2 px-4 text-left`}
            >
              <span className="font-semibold">{t.title}</span>
              <span className="text-[13px] text-slate-600 dark:text-slate-400">{t.count}</span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
};
