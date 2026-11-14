import React, { useState, useMemo } from 'react';
import {
  TrendingUp,
  ShieldAlert,
  ShieldCheck,
  DollarSign,
  Download,
  Printer,
  Calendar,
  AlertTriangle,
  Info,
  CheckCircle,
  FileSpreadsheet,
  PieChart,
  ArrowUpRight,
  Banknote,
  Receipt,
  Car,
  Package,
  Crown,
} from 'lucide-react';
import { Contract, ContractorProfile } from '../types/contract';
import { formatCurrency, formatDateCs } from '../utils/numberToWordsCs';
import { AccountantExportModal } from './AccountantExportModal';
import { isProUser } from '../utils/subscription';

interface FinancialRadarPageProps {
  contracts: Contract[];
  contractor: ContractorProfile | null;
  onOpenContract: (contract: Contract) => void;
  onToast?: (type: 'success' | 'error' | 'info', text: string) => void;
  onOpenPaywall?: (reason?: string) => void;
}

const DPH_LIMIT = 2000000; // 2 000 000 Kč zákonný limit pro registraci plátce DPH v ČR
const PAUSAL_BAND_1 = 1000000;
const PAUSAL_BAND_2 = 1500000;
const PAUSAL_BAND_3 = 2000000;

export const FinancialRadarPage: React.FC<FinancialRadarPageProps> = ({
  contracts,
  contractor,
  onOpenContract,
  onToast,
  onOpenPaywall,
}) => {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [isAccountantModalOpen, setIsAccountantModalOpen] = useState<boolean>(false);
  const isPro = isProUser(contractor);

  const handleOpenAccountantBundle = () => {
    if (!isPro) {
      if (onOpenPaywall) {
        onOpenPaywall(
          'Kompletní balíček pro účetní (export pro Pohodu, Money S3, hotovostní doklady a cesťáky v ZIP) je prémiová funkce v licenci Mistr PRO.'
        );
      } else if (onToast) {
        onToast('info', 'Tato funkce vyžaduje licenci Mistr PRO.');
      }
      return;
    }
    setIsAccountantModalOpen(true);
  };

  // Available years from contracts
  const availableYears = useMemo(() => {
    const years = new Set<number>();
    years.add(currentYear);
    contracts.forEach((c) => {
      const year = new Date(c.conclusionDate || c.createdAt).getFullYear();
      if (!isNaN(year)) years.add(year);
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [contracts, currentYear]);

  // Filtrované zakázky pro daný rok
  const yearContracts = useMemo(() => {
    return contracts.filter((c) => {
      // Cenová nabídka není smlouva – do obratu ani příjmů se nepočítá
      if (c.docKind === 'quote') return false;
      const year = new Date(c.conclusionDate || c.createdAt).getFullYear();
      return year === selectedYear;
    });
  }, [contracts, selectedYear]);

  // Výpočty příjmů
  const {
    totalRevenue,
    bankRevenue,
    cashRevenue,
    totalExpenses,
    totalTripsCost,
    totalTripsKm,
    monthlyRevenue,
  } = useMemo(() => {
    let rev = 0;
    let bank = 0;
    let cash = 0;
    let exp = 0;
    let tripCost = 0;
    let tripKm = 0;

    const monthly: number[] = Array(12).fill(0);

    yearContracts.forEach((c) => {
      // Základní cena smlouvy + dodatky
      const amendmentsSum = (c.amendments || []).reduce(
        (sum, a) => sum + (a.priceDifference || 0),
        0
      );
      const contractTotal = c.price + amendmentsSum;
      rev += contractTotal;

      // Měsíc pro graf
      const d = new Date(c.conclusionDate || c.createdAt);
      const monthIdx = d.getMonth();
      if (monthIdx >= 0 && monthIdx < 12) {
        monthly[monthIdx] += contractTotal;
      }

      // Hotovost z pokladních dokladů
      const receiptsSum = (c.cashReceipts || []).reduce((sum, r) => sum + (r.amount || 0), 0);
      cash += receiptsSum;
      bank += Math.max(0, contractTotal - receiptsSum);

      // Výdaje k zakázce
      const expSum = (c.expenses || []).reduce((sum, e) => sum + (e.amount || 0), 0);
      exp += expSum;

      // Jízdy
      (c.trips || []).forEach((t) => {
        tripKm += t.distanceKm || 0;
        tripCost += t.totalCost || 0;
      });
    });

    return {
      totalRevenue: rev,
      bankRevenue: bank,
      cashRevenue: cash,
      totalExpenses: exp,
      totalTripsCost: tripCost,
      totalTripsKm: tripKm,
      monthlyRevenue: monthly,
    };
  }, [yearContracts]);

  // Čistý zisk z podnikání
  const netBusinessProfit = totalRevenue - totalExpenses;
  const businessMargin = totalRevenue > 0 ? Math.round((netBusinessProfit / totalRevenue) * 100) : 0;

  // DPH limit výpočty
  const dphPercent = Math.min(100, Math.round((totalRevenue / DPH_LIMIT) * 100));
  const dphRemaining = Math.max(0, DPH_LIMIT - totalRevenue);

  // Pásmo paušální daně
  const pausalBand = useMemo(() => {
    if (totalRevenue <= PAUSAL_BAND_1) {
      return {
        band: 1,
        title: '1. pásmo (do 1 000 000 Kč)',
        color: 'text-emerald-700 dark:text-emerald-300',
        bg: 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800',
        limit: PAUSAL_BAND_1,
        remains: PAUSAL_BAND_1 - totalRevenue,
        desc: 'Nejvýhodnější paušální daň (měsíční platba zahrnuje daň, sociální i zdravotní pojištění).',
      };
    } else if (totalRevenue <= PAUSAL_BAND_2) {
      return {
        band: 2,
        title: '2. pásmo (1 000 000 – 1 500 000 Kč)',
        color: 'text-blue-700 dark:text-blue-300',
        bg: 'bg-blue-50 dark:bg-blue-950/40 border-blue-300 dark:border-blue-800',
        limit: PAUSAL_BAND_2,
        remains: PAUSAL_BAND_2 - totalRevenue,
        desc: 'Střední pásmo paušální daně.',
      };
    } else if (totalRevenue <= PAUSAL_BAND_3) {
      return {
        band: 3,
        title: '3. pásmo (1 500 000 – 2 000 000 Kč)',
        color: 'text-amber-700 dark:text-amber-300',
        bg: 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800',
        limit: PAUSAL_BAND_3,
        remains: PAUSAL_BAND_3 - totalRevenue,
        desc: 'Vyšší pásmo paušální daně. Blížíte se limitu pro registraci k DPH!',
      };
    } else {
      return {
        band: 4,
        title: 'Překročeno 2 000 000 Kč',
        color: 'text-red-700 dark:text-red-300',
        bg: 'bg-red-50 dark:bg-red-950/40 border-red-300 dark:border-red-800',
        limit: DPH_LIMIT,
        remains: 0,
        desc: 'Překročen obrat 2 mil. Kč – vzniká povinnost registrace plátce DPH a nelze uplatnit paušální daň!',
      };
    }
  }, [totalRevenue]);

  // Export do CSV pro účetní / daňové přiznání
  const handleExportCsv = () => {
    try {
      const headers = [
        'Číslo smlouvy',
        'Faktura č.',
        'Datum uzavření',
        'Klient',
        'IČO klienta',
        'Předmět díla',
        'Základní cena (Kč)',
        'Vícepráce (Kč)',
        'Celkem tržba (Kč)',
        'Záloha (Kč)',
        'Výdaje na zakázku (Kč)',
        'Čistý zisk (Kč)',
        'Stav zakázky',
      ];

      const rows = yearContracts.map((c) => {
        const amend = (c.amendments || []).reduce((s, a) => s + (a.priceDifference || 0), 0);
        const exp = (c.expenses || []).reduce((s, e) => s + (e.amount || 0), 0);
        const total = c.price + amend;
        const profit = total - exp;

        return [
          `"${c.contractNumber}"`,
          `"${c.invoiceNumber || ''}"`,
          `"${c.conclusionDate || ''}"`,
          `"${(c.client.name || '').replace(/"/g, '""')}"`,
          `"${c.client.ico || ''}"`,
          `"${(c.workDescription || '').substring(0, 100).replace(/"/g, '""')}"`,
          c.price,
          amend,
          total,
          c.advanceAmount || 0,
          exp,
          profit,
          `"${c.status || 'draft'}"`,
        ].join(';');
      });

      const csvContent = '\uFEFF' + [headers.join(';'), ...rows].join('\r\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `OSVC_danovy_prehled_${selectedYear}_${contractor?.ico || 'remeslnik'}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      if (onToast) onToast('success', `Přehled pro účetní za rok ${selectedYear} byl stažen v CSV.`);
    } catch (e) {
      console.error(e);
      if (onToast) onToast('error', 'Nepodařilo se exportovat CSV soubor.');
    }
  };

  const MONTH_NAMES = ['Led', 'Úno', 'Bře', 'Dub', 'Kvě', 'Čvn', 'Čvc', 'Srp', 'Zář', 'Říj', 'Lis', 'Pro'];
  const maxMonthly = Math.max(...monthlyRevenue, 1);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6 sm:space-y-8 text-slate-800 dark:text-slate-100">
      {/* Top Banner & Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-3 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-8 h-8 rounded-lg bg-slate-900 text-white dark:bg-blue-600 flex items-center justify-center shadow-xs">
              <TrendingUp className="w-4 h-4" />
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white">
              OSVČ Finanční radar
            </h1>
            <span className="text-[11px] px-2 py-0.5 rounded font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
              Daně & Obrat
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Hlídač obratu pro DPH limit 2 000 000 Kč, pásma paušální daně a celkový čistý zisk živnosti
          </p>
        </div>

        {/* Action Controls: Year selector + Export buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700">
            <span className="text-xs font-semibold px-2 text-slate-500 dark:text-slate-400">Rok:</span>
            {availableYears.map((yr) => (
              <button
                key={yr}
                onClick={() => setSelectedYear(yr)}
                className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all cursor-pointer tabular-nums ${
                  selectedYear === yr
                    ? 'bg-white dark:bg-slate-900 text-slate-950 dark:text-white shadow-xs ring-1 ring-slate-300 dark:ring-slate-700'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {yr}
              </button>
            ))}
          </div>

          <button
            onClick={handleOpenAccountantBundle}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-500 text-white font-bold text-xs shadow-xs transition-all cursor-pointer active:scale-95"
            title={isPro ? "Kompletní balíček pro účetní na 1 klik" : "Vyžaduje licenci Mistr PRO"}
          >
            <Package className="w-4 h-4" />
            <span>Balíček pro účetní & CSV</span>
            {!isPro && (
              <span className="px-1.5 py-0.2 rounded bg-amber-400 text-slate-950 text-[10px] font-black">
                PRO
              </span>
            )}
          </button>

          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-xs border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
            title="Vytisknout roční přehled"
          >
            <Printer className="w-4 h-4" />
            <span className="hidden sm:inline">Tisk</span>
          </button>
        </div>
      </div>

      {/* Upozornění na balíček pro účetní pro uživatele základní verze */}
      {!isPro && (
        <div className="p-4 rounded-xl bg-slate-900 dark:bg-slate-950 border border-slate-800 text-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-400 text-slate-950 flex items-center justify-center shrink-0 font-bold shadow-xs">
              <Crown className="w-4 h-4 fill-current" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-xs font-bold text-white">
                  1-klikový export pro účetní v Mistr PRO
                </h4>
                <span className="text-[10px] px-2 py-0.2 rounded bg-amber-400/20 text-amber-300 border border-amber-400/30 font-bold">
                  Prémiový modul
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">
                Základní sledování ročního obratu a limitu DPH máte zdarma. 1-klikový balíček pro účetní (všechny faktury v PDF, CSV pro účetní software a kniha jízd v jednom ZIP) se odemknou s licencí Mistr PRO.
              </p>
            </div>
          </div>
          {onOpenPaywall && (
            <button
              type="button"
              onClick={() =>
                onOpenPaywall(
                  'Kompletní balíček pro účetní (export pro Pohodu, Money S3, hotovostní doklady a cesťáky v ZIP) je dostupný v předplatném Mistr PRO.'
                )
              }
              className="w-full sm:w-auto px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-black flex items-center justify-center gap-1.5 shrink-0 shadow-xs cursor-pointer transition-all active:scale-95 whitespace-nowrap"
            >
              <Crown className="w-3.5 h-3.5 fill-current" />
              <span>Aktivovat PRO</span>
            </button>
          )}
        </div>
      )}

      {/* Hlavní radarové panely */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Levý sloupec: Hlídač limitu DPH 2 mil. Kč (7 cols) */}
        <div className="lg:col-span-7 space-y-5">
          {/* DPH Barometr */}
          <div className="p-5 sm:p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Hlídač plátcovství DPH v roce {selectedYear}
                </span>
                <h3 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-baseline gap-2">
                  <span>{formatCurrency(totalRevenue)}</span>
                  <span className="text-xs sm:text-sm font-semibold text-slate-400">
                    / limit {formatCurrency(DPH_LIMIT)}
                  </span>
                </h3>
              </div>

              <div
                className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 border ${
                  totalRevenue >= DPH_LIMIT
                    ? 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200 border-red-300'
                    : totalRevenue >= DPH_LIMIT * 0.75
                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200 border-amber-300'
                    : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200 border-emerald-300'
                }`}
              >
                {totalRevenue >= DPH_LIMIT ? (
                  <>
                    <ShieldAlert className="w-4 h-4 text-red-600" />
                    <span>Překročeno – plátce DPH</span>
                  </>
                ) : totalRevenue >= DPH_LIMIT * 0.75 ? (
                  <>
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    <span>Pozor, blíží se limit</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <span>Neplátce DPH (v bezpečí)</span>
                  </>
                )}
              </div>
            </div>

            {/* Progress Bar DPH */}
            <div className="space-y-1.5 mb-4">
              <div className="flex justify-between text-xs font-semibold text-slate-600 dark:text-slate-400">
                <span>Vyučerpáno: {dphPercent}%</span>
                <span>Zbývá do limitu: <strong className="text-slate-900 dark:text-white">{formatCurrency(dphRemaining)}</strong></span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-3.5 overflow-hidden p-0.5 border border-slate-200/80 dark:border-slate-700">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    dphPercent >= 100
                      ? 'bg-red-600'
                      : dphPercent >= 75
                      ? 'bg-amber-500'
                      : 'bg-linear-to-r from-emerald-500 to-blue-500'
                  }`}
                  style={{ width: `${Math.min(100, Math.max(3, dphPercent))}%` }}
                />
              </div>
              <div className="flex justify-between text-[11px] text-slate-400 pt-0.5">
                <span>0 Kč</span>
                <span>1 000 000 Kč</span>
                <span>2 000 000 Kč (Zákonný limit)</span>
              </div>
            </div>

            {/* Stručné vysvětlení pro živnostníka */}
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/70 text-xs text-slate-600 dark:text-slate-300 flex items-start gap-2.5">
              <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <div>
                {totalRevenue >= DPH_LIMIT ? (
                  <strong className="text-red-600 dark:text-red-400 block mb-0.5">
                    Překročili jste obrat 2 000 000 Kč za posledních 12 po sobě jdoucích měsíců.
                  </strong>
                ) : (
                  <span>
                    Do zákonného limitu pro povinnou registraci k DPH vám v roce {selectedYear} zbývá ještě{' '}
                    <strong className="text-slate-900 dark:text-white">{formatCurrency(dphRemaining)}</strong>.
                  </span>
                )}
                <span> Do obratu se započítávají veškerá plnění ze smluv, faktur i hotovostních pokladních dokladů.</span>
              </div>
            </div>
          </div>

          {/* Paušální daň panel */}
          <div className={`p-5 rounded-xl border shadow-sm ${pausalBand.bg}`}>
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-white/80 dark:bg-slate-900/80 flex items-center justify-center shadow-xs">
                  <PieChart className="w-4 h-4 text-blue-600" />
                </div>
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                    Paušální daň OSVČ
                  </span>
                  <h4 className={`text-base sm:text-lg font-bold ${pausalBand.color}`}>
                    {pausalBand.title}
                  </h4>
                </div>
              </div>
              <span className="text-xs px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 font-mono font-bold border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200">
                Pásmo {pausalBand.band}
              </span>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 mb-3">
              {pausalBand.desc}
            </p>

            {pausalBand.remains > 0 && (
              <div className="text-xs bg-white/70 dark:bg-slate-900/60 p-2.5 rounded-lg border border-slate-200/60 dark:border-slate-800">
                Do překročení tohoto pásma zbývá vyfakturovat:{' '}
                <strong className="font-bold text-slate-900 dark:text-white">
                  {formatCurrency(pausalBand.remains)}
                </strong>
              </div>
            )}
          </div>

          {/* Měsíční graf tržeb */}
          <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
            <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-4 flex items-center justify-between">
              <span>Tržby po měsících ({selectedYear})</span>
              <span className="text-slate-400 font-normal">v Kč</span>
            </h4>

            <div className="grid grid-cols-12 gap-1.5 sm:gap-2 items-end h-36 pt-4 px-1">
              {monthlyRevenue.map((val, idx) => {
                const heightPercent = maxMonthly > 0 ? Math.round((val / maxMonthly) * 100) : 0;
                return (
                  <div key={idx} className="flex flex-col items-center gap-1.5 h-full justify-end group">
                    <span className="text-[9px] font-semibold text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity truncate">
                      {val > 0 ? `${Math.round(val / 1000)}k` : ''}
                    </span>
                    <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-t-md h-28 flex items-end overflow-hidden">
                      <div
                        className="w-full bg-blue-600 hover:bg-blue-500 dark:bg-blue-500 dark:hover:bg-blue-400 rounded-t-md transition-all duration-300"
                        style={{ height: `${Math.max(val > 0 ? 8 : 2, heightPercent)}%` }}
                        title={`${MONTH_NAMES[idx]}: ${formatCurrency(val)}`}
                      />
                    </div>
                    <span className="text-[10px] font-semibold text-slate-500">
                      {MONTH_NAMES[idx]}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Pravý sloupec: Finanční zdraví & Čistý zisk (5 cols) */}
        <div className="lg:col-span-5 space-y-5">
          {/* Ziskovost živnosti */}
          <div className="p-5 sm:p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-emerald-600" />
              <span>Finanční bilance živnosti ({selectedYear})</span>
            </h3>

            {/* Hlavní zisk */}
            <div className="p-4 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/80">
              <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-300 block mb-1 uppercase tracking-wider">
                Celkový čistý zisk
              </span>
              <div className="text-2xl sm:text-3xl font-black text-emerald-950 dark:text-emerald-100">
                {formatCurrency(netBusinessProfit)}
              </div>
              <div className="flex items-center gap-2 mt-1.5 text-xs text-emerald-700 dark:text-emerald-300 font-medium">
                <span>Průměrná marže: <strong>{businessMargin}%</strong></span>
                <span>·</span>
                <span>{yearContracts.length} zakázek</span>
              </div>
            </div>

            {/* Rozpad položek bilance */}
            <div className="space-y-2.5 text-xs sm:text-sm divide-y divide-slate-100 dark:divide-slate-800">
              <div className="flex justify-between py-1.5">
                <span className="text-slate-500 flex items-center gap-1.5">
                  <ArrowUpRight className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Celkové příjmy (tržby)</span>
                </span>
                <strong className="font-bold text-slate-900 dark:text-white">
                  {formatCurrency(totalRevenue)}
                </strong>
              </div>

              <div className="flex justify-between py-1.5 pl-5 text-xs text-slate-500">
                <span>z toho bezhotovostně (účet)</span>
                <span>{formatCurrency(bankRevenue)}</span>
              </div>

              <div className="flex justify-between py-1.5 pl-5 text-xs text-slate-500">
                <span className="flex items-center gap-1">
                  <Banknote className="w-3 h-3 text-emerald-600" />
                  <span>z toho hotovost (PPD)</span>
                </span>
                <span>{formatCurrency(cashRevenue)}</span>
              </div>

              <div className="flex justify-between py-1.5 text-rose-600 dark:text-rose-400">
                <span className="flex items-center gap-1.5">
                  <Receipt className="w-3.5 h-3.5" />
                  <span>Výdaje na zakázky (materiál)</span>
                </span>
                <strong className="font-bold">
                  -{formatCurrency(totalExpenses)}
                </strong>
              </div>

              <div className="flex justify-between py-1.5 text-blue-600 dark:text-blue-400">
                <span className="flex items-center gap-1.5">
                  <Car className="w-3.5 h-3.5" />
                  <span>Cestovní náhrady ({totalTripsKm} km)</span>
                </span>
                <strong className="font-bold">
                  {formatCurrency(totalTripsCost)}
                </strong>
              </div>
            </div>
          </div>

          {/* Seznam zakázek v roce s jejich ziskem */}
          <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
            <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
              Přehled zakázek v roce {selectedYear} ({yearContracts.length})
            </h4>

            {yearContracts.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-6">
                V roce {selectedYear} nemáte uloženy žádné zakázky.
              </p>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {yearContracts.map((c) => {
                  const amend = (c.amendments || []).reduce((s, a) => s + (a.priceDifference || 0), 0);
                  const exp = (c.expenses || []).reduce((s, e) => s + (e.amount || 0), 0);
                  const total = c.price + amend;
                  const profit = total - exp;

                  return (
                    <div
                      key={c.id}
                      onClick={() => onOpenContract(c)}
                      className="p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 hover:border-blue-300 dark:hover:border-blue-700 bg-slate-50/50 dark:bg-slate-800/40 hover:bg-blue-50/40 dark:hover:bg-blue-950/30 transition-all cursor-pointer flex items-center justify-between text-xs"
                    >
                      <div className="truncate mr-2">
                        <div className="font-semibold text-slate-900 dark:text-white truncate">
                          {c.client.name}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {c.contractNumber} · {formatDateCs(c.conclusionDate || c.createdAt)}
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="font-bold text-slate-900 dark:text-white">
                          {formatCurrency(total)}
                        </div>
                        <div
                          className={`text-[11px] font-semibold ${
                            profit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'
                          }`}
                        >
                          Zisk: {formatCurrency(profit)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 📦 1-klikový Balíček pro účetní Modal */}
      <AccountantExportModal
        isOpen={isAccountantModalOpen}
        onClose={() => setIsAccountantModalOpen(false)}
        contracts={contracts}
        contractor={contractor}
        onToast={onToast}
      />
    </div>
  );
};
