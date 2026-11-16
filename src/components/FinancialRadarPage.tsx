import React, { useMemo, useState } from 'react';
import { Package, Printer } from 'lucide-react';
import { Contract, ContractorProfile } from '../types/contract';
import { formatCurrency, formatDateCs } from '../utils/numberToWordsCs';
import { AccountantExportModal } from './AccountantExportModal';
import { isProUser } from '../utils/subscription';
import { getContractTotal, isInvoiceable } from '../utils/invoiceMath';

interface FinancialRadarPageProps {
  contracts: Contract[];
  contractor: ContractorProfile | null;
  onOpenContract: (contract: Contract) => void;
  onToast?: (type: 'success' | 'error' | 'info', text: string) => void;
  onOpenPaywall?: (reason?: string) => void;
}

// Hranice obratu, které řemeslník sleduje (orientačně; rozhodná pravidla ověřuje účetní)
const VAT_LIMIT = 2000000;
const TURNOVER_MARKS = [1000000, 1500000, 2000000];
const MONTH_NAMES = ['led', 'úno', 'bře', 'dub', 'kvě', 'čvn', 'čvc', 'srp', 'zář', 'říj', 'lis', 'pro'];
const MONTH_FULL = ['leden', 'únor', 'březen', 'duben', 'květen', 'červen', 'červenec', 'srpen', 'září', 'říjen', 'listopad', 'prosinec'];

const sectionTitle = 'text-2xl font-semibold text-slate-900 dark:text-white';
const box = 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md';
const outlineButton =
  'min-h-11 px-4 inline-flex items-center justify-center gap-2 rounded-md border-[1.5px] border-slate-900 dark:border-slate-500 text-slate-900 dark:text-slate-100 font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors';
const chip = (active: boolean) =>
  `min-h-11 px-3 inline-flex items-center justify-center rounded-md border font-medium tabular-nums cursor-pointer transition-colors ${
    active
      ? 'border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-900'
      : 'border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800'
  }`;
const bigNumber = 'font-display font-semibold tabular-nums';

const contractDate = (c: Contract) => (c.conclusionDate || c.createdAt || '').slice(0, 10);
const sumExpenses = (c: Contract) => (c.expenses || []).reduce((sum, e) => sum + (e.amount || 0), 0);

export const FinancialRadarPage: React.FC<FinancialRadarPageProps> = ({
  contracts,
  contractor,
  onOpenContract,
  onToast,
  onOpenPaywall,
}) => {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [isAccountantModalOpen, setIsAccountantModalOpen] = useState(false);
  const [activeMonth, setActiveMonth] = useState<number | null>(null);
  const isPro = isProUser(contractor);

  const handleOpenAccountantBundle = () => {
    if (!isPro) {
      if (onOpenPaywall) onOpenPaywall('Podklady pro účetní jsou součástí licence Mistr PRO.');
      else onToast?.('info', 'Tato funkce vyžaduje licenci Mistr PRO.');
      return;
    }
    setIsAccountantModalOpen(true);
  };

  const availableYears = useMemo(() => {
    const years = new Set<number>([currentYear]);
    contracts.forEach((c) => {
      const year = Number(contractDate(c).slice(0, 4));
      if (year > 1990) years.add(year);
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [contracts, currentYear]);

  // Zakázky roku: cenová nabídka ani zakázka bez ceny tržbou nejsou
  const yearContracts = useMemo(
    () =>
      contracts
        .filter((c) => isInvoiceable(c) && Number(contractDate(c).slice(0, 4)) === selectedYear)
        .sort((a, b) => contractDate(b).localeCompare(contractDate(a))),
    [contracts, selectedYear],
  );

  const totals = useMemo(() => {
    const t = { revenue: 0, bank: 0, cash: 0, expenses: 0, tripsCost: 0, tripsKm: 0, monthly: Array(12).fill(0) as number[] };
    yearContracts.forEach((c) => {
      const total = getContractTotal(c);
      t.revenue += total;
      const month = Number(contractDate(c).slice(5, 7)) - 1;
      if (month >= 0 && month < 12) t.monthly[month] += total;
      const cash = (c.cashReceipts || []).reduce((sum, r) => sum + (r.amount || 0), 0);
      t.cash += cash;
      t.bank += Math.max(0, total - cash);
      t.expenses += sumExpenses(c);
      (c.trips || []).forEach((trip) => {
        t.tripsKm += trip.distanceKm || 0;
        t.tripsCost += trip.totalCost || 0;
      });
    });
    return t;
  }, [yearContracts]);

  const profit = totals.revenue - totals.expenses;
  const margin = totals.revenue > 0 ? Math.round((profit / totals.revenue) * 100) : 0;
  const limitPercent = Math.min(100, (totals.revenue / VAT_LIMIT) * 100);
  const overLimit = totals.revenue >= VAT_LIMIT;
  const nearLimit = !overLimit && totals.revenue >= VAT_LIMIT * 0.75;
  const maxMonthly = Math.max(...totals.monthly, 1);
  const bestMonth = totals.monthly.indexOf(Math.max(...totals.monthly));
  const shownMonth = activeMonth ?? (totals.revenue > 0 ? bestMonth : null);
  const jobsWord = (n: number) => (n === 1 ? 'zakázka' : n >= 2 && n <= 4 ? 'zakázky' : 'zakázek');

  return (
    <div className="max-w-[1180px] mx-auto pb-16 space-y-7 text-[15px] leading-snug">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl sm:text-[44px] font-bold leading-[1.05] text-slate-900 dark:text-white">Finance</h1>
          <div className="mt-1 text-slate-600 dark:text-slate-400">Obrat, zisk a hranice pro DPH podle uzavřených smluv.</div>
        </div>
        <div className="w-full sm:w-auto flex flex-wrap gap-2.5 no-print">
          <button type="button" onClick={handleOpenAccountantBundle} className={`${outlineButton} flex-1 sm:flex-none`}>
            <Package className="w-[18px] h-[18px]" />
            <span>Podklady pro účetní</span>
          </button>
          <button type="button" onClick={() => window.print()} className={outlineButton}>
            <Printer className="w-[18px] h-[18px]" />
            <span>Tisk</span>
          </button>
        </div>
      </header>

      <div role="group" aria-label="Rok" className="flex flex-wrap gap-2 no-print">
        {availableYears.map((yr) => (
          <button key={yr} type="button" aria-pressed={selectedYear === yr} onClick={() => setSelectedYear(yr)} className={chip(selectedYear === yr)}>
            {yr}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-x-10 gap-y-9 items-start">
        <div className="lg:col-span-7 space-y-9 min-w-0">
          {/* Obrat a hranice DPH */}
          <section aria-labelledby="finance-obrat" className="space-y-2.5">
            <h2 id="finance-obrat" className={sectionTitle}>
              Obrat {selectedYear}
            </h2>
            <div className={box}>
              <div className="px-5 py-[18px] space-y-4">
                <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
                  <div>
                    <div className={`text-[40px] leading-none text-slate-900 dark:text-white font-display font-bold tabular-nums`}>
                      {formatCurrency(totals.revenue)}
                    </div>
                    <div className="mt-1.5 text-slate-600 dark:text-slate-400">
                      z hranice {formatCurrency(VAT_LIMIT)} pro registraci k DPH
                    </div>
                  </div>
                  <span
                    className={`font-semibold px-2.5 py-0.5 rounded-sm ${
                      overLimit
                        ? 'bg-rose-700 text-white'
                        : nearLimit
                          ? 'border-[1.5px] border-rose-700 text-rose-700 dark:border-rose-400 dark:text-rose-400'
                          : 'border border-slate-500 text-slate-900 dark:text-slate-100'
                    }`}
                  >
                    {overLimit ? 'Hranice překročena' : nearLimit ? 'Blíží se hranice' : `Zbývá ${formatCurrency(VAT_LIMIT - totals.revenue)}`}
                  </span>
                </div>

                <div>
                  <div
                    role="img"
                    aria-label={`Obrat tvoří ${Math.round(limitPercent)} % hranice pro DPH`}
                    className="relative h-4 border border-slate-900 dark:border-slate-400 rounded-sm bg-white dark:bg-slate-950 overflow-hidden"
                  >
                    <div
                      className={`absolute inset-y-0 left-0 ${overLimit ? 'bg-rose-700' : 'bg-slate-900 dark:bg-slate-200'}`}
                      style={{ width: `${limitPercent}%` }}
                    />
                    {[50, 75].map((pos) => (
                      <div key={pos} className="absolute inset-y-0 w-px bg-slate-400" style={{ left: `${pos}%` }} />
                    ))}
                  </div>
                  <div className="relative h-5 mt-1 text-[13px] text-slate-600 dark:text-slate-400 tabular-nums">
                    <span className="absolute left-0">0</span>
                    <span className="absolute left-1/2 -translate-x-1/2">1 mil.</span>
                    <span className="absolute left-3/4 -translate-x-1/2">1,5 mil.</span>
                    <span className="absolute right-0">2 mil.</span>
                  </div>
                </div>
              </div>

              <ul className="border-t border-slate-100 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800">
                {TURNOVER_MARKS.map((mark) => {
                  const passed = totals.revenue > mark;
                  return (
                    <li key={mark} className="px-5 py-3 flex items-baseline justify-between gap-4">
                      <span className="text-slate-600 dark:text-slate-400 tabular-nums">Hranice {formatCurrency(mark)}</span>
                      <span className={passed ? 'font-semibold text-rose-700 dark:text-rose-400' : 'font-semibold text-slate-900 dark:text-white tabular-nums'}>
                        {passed ? 'překročena' : `zbývá ${formatCurrency(mark - totals.revenue)}`}
                      </span>
                    </li>
                  );
                })}
              </ul>
              <p className="px-5 py-3.5 border-t border-slate-100 dark:border-slate-800 text-[13px] text-slate-600 dark:text-slate-400">
                Údaje jsou orientační: obrat se tu počítá z cen smluv podle data jejich uzavření, ne podle skutečných plateb.
                Na hranicích 1, 1,5 a 2 mil. Kč závisí pásma paušální daně a registrace k DPH; které pro vás platí a od kdy,
                si ověřte u účetní.
              </p>
            </div>
          </section>

          {/* Tržby po měsících */}
          <section aria-labelledby="finance-mesice" className="space-y-2.5">
            <h2 id="finance-mesice" className={sectionTitle}>
              Tržby po měsících
            </h2>
            <div className={`${box} px-5 py-[18px]`}>
              <div className="min-h-[46px] text-slate-600 dark:text-slate-400" aria-live="polite">
                {shownMonth === null ? (
                  'V tomto roce zatím nejsou žádné tržby.'
                ) : (
                  <>
                    <span className="capitalize">{MONTH_FULL[shownMonth]}</span>
                    {activeMonth === null ? ' (nejsilnější měsíc)' : ''}:{' '}
                    <span className={`${bigNumber} text-[22px] text-slate-900 dark:text-white`}>{formatCurrency(totals.monthly[shownMonth])}</span>
                  </>
                )}
              </div>
              <div className="grid grid-cols-12 gap-[2px] sm:gap-1 items-end h-40 border-b border-slate-900 dark:border-slate-400" onMouseLeave={() => setActiveMonth(null)}>
                {totals.monthly.map((val, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onMouseEnter={() => setActiveMonth(idx)}
                    onFocus={() => setActiveMonth(idx)}
                    onBlur={() => setActiveMonth(null)}
                    onClick={() => setActiveMonth(idx)}
                    aria-label={`${MONTH_FULL[idx]}: ${formatCurrency(val)}`}
                    className="h-full flex items-end justify-center cursor-default"
                  >
                    <span
                      className={`block w-full max-w-9 rounded-t-sm transition-colors ${
                        shownMonth === idx ? 'bg-blue-800 dark:bg-blue-200' : 'bg-blue-600 dark:bg-blue-300'
                      }`}
                      style={{ height: val > 0 ? `${Math.max(3, (val / maxMonthly) * 100)}%` : '0' }}
                    />
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-12 gap-[2px] sm:gap-1 mt-1.5 text-center text-[13px] text-slate-600 dark:text-slate-400" aria-hidden="true">
                {MONTH_NAMES.map((m) => (
                  <span key={m}>{m}</span>
                ))}
              </div>
              <table className="sr-only">
                <caption>Tržby po měsících v roce {selectedYear}</caption>
                <tbody>
                  {totals.monthly.map((val, idx) => (
                    <tr key={idx}>
                      <th scope="row">{MONTH_FULL[idx]}</th>
                      <td>{formatCurrency(val)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <div className="lg:col-span-5 space-y-9 min-w-0">
          {/* Zisk */}
          <section aria-labelledby="finance-zisk" className="space-y-2.5">
            <h2 id="finance-zisk" className={sectionTitle}>
              Zisk
            </h2>
            <div className={`${box} divide-y divide-slate-100 dark:divide-slate-800`}>
              <div className="px-5 py-[18px] !border-b !border-slate-900 dark:!border-slate-500">
                <div className={`text-[40px] leading-none font-display font-bold tabular-nums ${profit < 0 ? 'text-rose-700 dark:text-rose-400' : 'text-slate-900 dark:text-white'}`}>
                  {formatCurrency(profit)}
                </div>
                <div className="mt-1.5 text-slate-600 dark:text-slate-400">
                  tržby minus výdaje na zakázky, marže {margin} %, {yearContracts.length} {jobsWord(yearContracts.length)}
                </div>
              </div>
              {[
                { label: 'Tržby', value: formatCurrency(totals.revenue), strong: true },
                { label: 'z toho na účet', value: formatCurrency(totals.bank), sub: true },
                { label: 'z toho v hotovosti', value: formatCurrency(totals.cash), sub: true },
                { label: 'Výdaje na zakázky', value: `−${formatCurrency(totals.expenses)}`, strong: true },
                { label: `Jízdy (${totals.tripsKm} km), nejsou odečtené`, value: formatCurrency(totals.tripsCost) },
              ].map((row) => (
                <div key={row.label} className={`px-5 py-3 flex items-baseline justify-between gap-4 ${row.sub ? 'pl-9' : ''}`}>
                  <span className="text-slate-600 dark:text-slate-400">{row.label}</span>
                  <span className={`tabular-nums whitespace-nowrap ${row.strong ? 'font-semibold text-slate-900 dark:text-white' : 'text-slate-900 dark:text-slate-100'}`}>
                    {row.value}
                  </span>
                </div>
              ))}
            </div>
          </section>

          {/* Zakázky roku */}
          <section aria-labelledby="finance-zakazky" className="space-y-2.5">
            <h2 id="finance-zakazky" className={sectionTitle}>
              Zakázky {selectedYear}
            </h2>
            <div className={`${box} divide-y divide-slate-100 dark:divide-slate-800`}>
              {yearContracts.length === 0 && (
                <div className="px-5 py-5 text-slate-600 dark:text-slate-300">V roce {selectedYear} není žádná smlouva s cenou.</div>
              )}
              {yearContracts.map((c) => {
                const total = getContractTotal(c);
                const jobProfit = total - sumExpenses(c);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => onOpenContract(c)}
                    className="w-full px-5 py-3.5 flex items-baseline justify-between gap-4 text-left cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <span className="min-w-0">
                      <span className="block font-semibold text-slate-900 dark:text-white">{c.client?.name}</span>
                      <span className="block text-slate-600 dark:text-slate-400">
                        {c.contractNumber}, {formatDateCs(contractDate(c))}
                      </span>
                    </span>
                    <span className="text-right shrink-0">
                      <span className={`block ${bigNumber} text-[19px] text-slate-900 dark:text-white`}>{formatCurrency(total)}</span>
                      <span className={`block tabular-nums ${jobProfit < 0 ? 'font-semibold text-rose-700 dark:text-rose-400' : 'text-slate-600 dark:text-slate-400'}`}>
                        zisk {formatCurrency(jobProfit)}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        </div>
      </div>

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
