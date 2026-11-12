import React, { useState } from 'react';
import {
  Wrench,
  X,
  Plus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Calendar,
  Send,
  Building2,
  DollarSign,
  RotateCcw,
  ShieldAlert,
} from 'lucide-react';
import { Contract, ToolRental, ContractExpense } from '../types/contract';
import { formatCurrency, formatDateCs } from '../utils/numberToWordsCs';
import { getDirectWhatsAppUrl, safeOpenExternalUrl } from '../utils/shareUtils';
import { triggerHaptic } from '../utils/haptics';

interface ToolRentalModalProps {
  isOpen: boolean;
  onClose: () => void;
  contract: Contract;
  onUpdateContract: (updated: Contract) => void;
  onToast?: (type: 'success' | 'error' | 'info', text: string) => void;
}

const COMMON_COMPANIES = [
  'DEK půjčovna',
  'Boels Rental',
  'Ramirent',
  'Stavebniny PRODOMA',
  'Hornbach půjčovna',
  'Bauhaus půjčovna',
  'Vlastní firemní stroj',
  'Jiné',
];

const COMMON_MACHINES = [
  'Jádrová vrtačka s vodním chlazením',
  'Vibrační deska 150–200 kg',
  'Bourací kladivo SDS-Max / HEX',
  'Průmyslový stavební odvlhčovač',
  'Drážkovací fréza do zdiva s odsáváním',
  'Pojízdné hliníkové lešení 6m',
  'Stavební shozy na suť (sada 10m)',
  'Generátor / elektrocentrála 5 kW',
  'Stříkací zařízení Airless na malby',
  'Řezačka na zámkovou dlažbu',
];

export const ToolRentalModal: React.FC<ToolRentalModalProps> = ({
  isOpen,
  onClose,
  contract,
  onUpdateContract,
  onToast,
}) => {
  if (!isOpen) return null;

  const toolRentals: ToolRental[] = contract.toolRentals || [];

  const [isAdding, setIsAdding] = useState(false);
  const [toolName, setToolName] = useState(COMMON_MACHINES[0]);
  const [customToolName, setCustomToolName] = useState('');
  const [rentalCompany, setRentalCompany] = useState(COMMON_COMPANIES[0]);
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [expectedReturnDate, setExpectedReturnDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 3);
    return d.toISOString().split('T')[0];
  });
  const [dailyRate, setDailyRate] = useState<number | ''>(450);
  const [deposit, setDeposit] = useState<number | ''>(5000);
  const [rechargeToClient, setRechargeToClient] = useState(true);
  const [notes, setNotes] = useState('');

  // Výpočet celkových nákladů na půjčovné
  const calculateDays = (item: ToolRental) => {
    const start = new Date(item.startDate).getTime();
    const end = item.isReturned && item.actualReturnDate
      ? new Date(item.actualReturnDate).getTime()
      : Math.max(new Date().getTime(), new Date(item.expectedReturnDate).getTime());
    const diff = Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)));
    return diff;
  };

  const totalCost = toolRentals.reduce((sum, item) => {
    const days = calculateDays(item);
    return sum + days * (item.dailyRate || 0);
  }, 0);

  const activeRentalsCount = toolRentals.filter((t) => !t.isReturned).length;

  const handleAddRental = (e: React.FormEvent) => {
    e.preventDefault();
    const finalToolName = toolName === 'Jiné' ? customToolName.trim() : toolName;

    if (!finalToolName) {
      if (onToast) onToast('error', 'Vyberte nebo zadejte název stroje / nářadí.');
      return;
    }

    const newRental: ToolRental = {
      id: `tool_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      toolName: finalToolName,
      rentalCompany: rentalCompany.trim(),
      startDate,
      expectedReturnDate,
      dailyRate: Number(dailyRate || 0),
      deposit: deposit ? Number(deposit) : undefined,
      isReturned: false,
      rechargeToClient,
      notes: notes.trim() || undefined,
    };

    const updated = [newRental, ...toolRentals];
    onUpdateContract({
      ...contract,
      toolRentals: updated,
    });

    triggerHaptic('success');
    if (onToast) onToast('success', `Stroj ${finalToolName} byl zaevidován k zakázce.`);

    // Reset
    setIsAdding(false);
    setCustomToolName('');
    setNotes('');
  };

  const handleToggleReturned = (id: string) => {
    const today = new Date().toISOString().split('T')[0];
    const updated = toolRentals.map((item) => {
      if (item.id === id) {
        const willBeReturned = !item.isReturned;
        return {
          ...item,
          isReturned: willBeReturned,
          actualReturnDate: willBeReturned ? today : undefined,
        };
      }
      return item;
    });

    onUpdateContract({
      ...contract,
      toolRentals: updated,
    });
    triggerHaptic('selection');
  };

  const handleDelete = (id: string) => {
    const updated = toolRentals.filter((item) => item.id !== id);
    onUpdateContract({
      ...contract,
      toolRentals: updated,
    });
    triggerHaptic('impact');
    if (onToast) onToast('info', 'Záznam o výpůjčce byl smazán.');
  };

  // Synchronizace do nákladů stavby
  const handleSyncToExpenses = () => {
    if (toolRentals.length === 0) {
      if (onToast) onToast('info', 'Zatím nemáte žádné výpůjčky k přičtení.');
      return;
    }

    const currentExpenses = contract.expenses || [];
    const otherExpenses = currentExpenses.filter((e) => !e.title?.startsWith('Půjčovné:'));

    const newToolExpenses: ContractExpense[] = toolRentals.map((item) => {
      const days = calculateDays(item);
      const cost = days * (item.dailyRate || 0);
      return {
        id: `exp_tool_${item.id}`,
        category: 'tools',
        title: `Půjčovné: ${item.toolName} (${item.rentalCompany}) - ${days} dní`,
        amount: cost,
        date: item.startDate,
        createdAt: new Date().toISOString(),
      };
    });

    onUpdateContract({
      ...contract,
      expenses: [...otherExpenses, ...newToolExpenses],
    });

    triggerHaptic('success');
    if (onToast) {
      onToast('success', `Náklady na půjčovné (${formatCurrency(totalCost)}) byly zapsány do nákladů stavby.`);
    }
  };

  // WhatsApp připomínka řidiči nebo parťákovi k vrácení stroje
  const handleSendReminder = (item: ToolRental) => {
    const days = calculateDays(item);
    const cost = days * (item.dailyRate || 0);

    const msg = [
      `Připomínka vrácení stroje ze stavby:`,
      `• Stroj: ${item.toolName}`,
      `• Půjčovna: ${item.rentalCompany}`,
      `• Termín vrácení: ${formatDateCs(item.expectedReturnDate)}`,
      `• Denní sazba: ${formatCurrency(item.dailyRate)} / den (naběhlo už ${formatCurrency(cost)})`,
      item.deposit ? `• Vratná kauce k vyzvednutí: ${formatCurrency(item.deposit)}` : '',
      `Prosím o pohlídání včasného vrácení, ať zbytečně nenabíhají další dny.`,
    ]
      .filter(Boolean)
      .join('\n');

    const url = getDirectWhatsAppUrl(msg);
    safeOpenExternalUrl(url);
  };

  const todayStr = new Date().toISOString().split('T')[0];

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl w-full max-w-3xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden my-auto">
        {/* Header - Industrial Tool Rental */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950 text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
              <Wrench className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-400 text-slate-950">
                  Strojní park
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  #{contract.contractNumber}
                </span>
              </div>
              <h3 className="font-black text-base leading-tight text-white mt-0.5">
                Půjčovna nářadí & Mechanizace
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="px-2.5 py-1.5 rounded-lg border border-slate-800 bg-slate-900 hover:bg-slate-800 text-xs font-mono font-bold text-slate-400 hover:text-white cursor-pointer active:scale-95 transition-all flex items-center gap-1.5"
          >
            <X className="w-4 h-4" />
            <span className="hidden sm:inline">ESC</span>
          </button>
        </div>

        {/* Content body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {/* Summary KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="p-3.5 rounded-xl bg-cyan-50/70 dark:bg-cyan-950/40 border border-cyan-200/80 dark:border-cyan-900/60">
              <span className="text-3xs font-black uppercase tracking-wider text-cyan-700 dark:text-cyan-400 block mb-1">
                Aktivně půjčeno
              </span>
              <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white flex items-baseline gap-1 font-mono">
                <span>{activeRentalsCount}</span>
                <span className="text-xs font-semibold text-slate-500 font-sans">strojů na stavbě</span>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
              <span className="text-3xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1">
                Naběhlé půjčovné celkem
              </span>
              <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white font-mono">
                {formatCurrency(totalCost)}
              </div>
            </div>

            <div className="col-span-2 sm:col-span-1 p-3.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-900/60">
              <span className="text-3xs font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-400 block mb-1">
                Vratné kauce celkem
              </span>
              <div className="text-xl sm:text-2xl font-black text-emerald-700 dark:text-emerald-300 font-mono">
                {formatCurrency(
                  toolRentals
                    .filter((t) => !t.isReturned && t.deposit)
                    .reduce((sum, t) => sum + (t.deposit || 0), 0)
                )}
              </div>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1">
            <button
              onClick={() => setIsAdding(!isAdding)}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-cyan-700 hover:bg-cyan-800 text-white text-xs font-bold shadow-xs active:scale-95 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{isAdding ? 'Zavřít formulář' : '+ Půjčit stroj / nářadí'}</span>
            </button>

            <button
              onClick={handleSyncToExpenses}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold border border-slate-200 dark:border-slate-700 cursor-pointer transition-colors"
              title="Přičíst naběhlé půjčovné do skutečných nákladů stavby"
            >
              <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
              <span>Zapsat do nákladů stavby</span>
            </button>
          </div>

          {/* Formulář pro novou výpůjčku */}
          {isAdding && (
            <form onSubmit={handleAddRental} className="p-4 sm:p-5 rounded-xl bg-cyan-50/50 dark:bg-cyan-950/20 border-2 border-cyan-300 dark:border-cyan-800 space-y-4">
              <h4 className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                <Wrench className="w-4 h-4 text-cyan-600" />
                <span>Zaevidovat zapůjčený stroj / techniku</span>
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Stroj nebo nářadí: *
                  </label>
                  <select
                    value={toolName}
                    onChange={(e) => setToolName(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                  >
                    {COMMON_MACHINES.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                    <option value="Jiné">+ Vlastní název stroje...</option>
                  </select>
                </div>

                {toolName === 'Jiné' && (
                  <div>
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                      Zadejte název stroje: *
                    </label>
                    <input
                      type="text"
                      required
                      value={customToolName}
                      onChange={(e) => setCustomToolName(e.target.value)}
                      placeholder="Např. Vibrační lať na beton"
                      className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                    />
                  </div>
                )}

                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Půjčovna / zdroj:
                  </label>
                  <select
                    value={rentalCompany}
                    onChange={(e) => setRentalCompany(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                  >
                    {COMMON_COMPANIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Datum zapůjčení:
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Termín vrácení: *
                  </label>
                  <input
                    type="date"
                    required
                    value={expectedReturnDate}
                    onChange={(e) => setExpectedReturnDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white font-bold"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Denní sazba (Kč/den):
                  </label>
                  <input
                    type="number"
                    value={dailyRate}
                    onChange={(e) => setDailyRate(parseFloat(e.target.value) || '')}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white font-bold"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Vratná kauce (Kč):
                  </label>
                  <input
                    type="number"
                    value={deposit}
                    onChange={(e) => setDeposit(parseFloat(e.target.value) || '')}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsAdding(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Zrušit
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-cyan-700 hover:bg-cyan-800 text-white text-xs font-extrabold shadow-sm cursor-pointer transition-colors"
                >
                  Uložit výpůjčku
                </button>
              </div>
            </form>
          )}

          {/* Seznam půjčených strojů */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Stroje a technika na této zakázce ({toolRentals.length})
            </h4>

            {toolRentals.length === 0 ? (
              <div className="p-8 text-center rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-800 space-y-2">
                <Wrench className="w-8 h-8 mx-auto text-slate-400" />
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Žádná technika z půjčovny není zapsána
                </p>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Půjčujete lešení, vrtačku nebo odvlhčovač? Zaevidujte ho a aplikace pohlídá včasné vrácení bez sankcí.
                </p>
              </div>
            ) : (
              toolRentals.map((item) => {
                const days = calculateDays(item);
                const cost = days * (item.dailyRate || 0);
                const isOverdue = !item.isReturned && item.expectedReturnDate < todayStr;
                const isDueToday = !item.isReturned && item.expectedReturnDate === todayStr;

                return (
                  <div
                    key={item.id}
                    className={`p-4 rounded-xl border transition-all ${
                      item.isReturned
                        ? 'bg-slate-50 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 opacity-75'
                        : isOverdue
                        ? 'bg-rose-50/50 dark:bg-rose-950/30 border-rose-300 dark:border-rose-900/80 shadow-2xs'
                        : isDueToday
                        ? 'bg-amber-50/50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-900/80 shadow-2xs'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-2xs'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-slate-900 dark:text-white text-base">
                            {item.toolName}
                          </span>
                          <span className="text-3xs font-mono font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                            {item.rentalCompany}
                          </span>
                        </div>

                        <div className="text-xs text-slate-600 dark:text-slate-300 flex flex-wrap items-center gap-x-3 gap-y-1">
                          <span>
                            Od: <strong>{formatDateCs(item.startDate)}</strong>
                          </span>
                          <span>
                            Vrátit do: <strong className={isOverdue ? 'text-rose-600 font-black' : isDueToday ? 'text-amber-600 font-black' : 'text-slate-900 dark:text-white'}>{formatDateCs(item.expectedReturnDate)}</strong>
                          </span>
                          <span>
                            Sazba: <strong>{formatCurrency(item.dailyRate)} / den</strong>
                          </span>
                          {item.deposit && (
                            <span className="text-slate-500">
                              (Kauce: {formatCurrency(item.deposit)})
                            </span>
                          )}
                        </div>

                        {/* Status štítek */}
                        <div className="pt-1">
                          {item.isReturned ? (
                            <span className="inline-flex items-center gap-1 text-2xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/80 px-2 py-0.5 rounded-md uppercase tracking-wider">
                              <CheckCircle2 className="w-3 h-3" />
                              Vráceno {item.actualReturnDate ? formatDateCs(item.actualReturnDate) : ''}
                            </span>
                          ) : isOverdue ? (
                            <span className="inline-flex items-center gap-1 text-2xs font-black text-rose-800 dark:text-rose-200 bg-rose-200 dark:bg-rose-900 px-2.5 py-0.5 rounded-md uppercase tracking-wider">
                              <AlertTriangle className="w-3 h-3" />
                              PO TERMÍNU VRÁCENÍ!
                            </span>
                          ) : isDueToday ? (
                            <span className="inline-flex items-center gap-1 text-2xs font-black text-amber-900 dark:text-amber-200 bg-amber-200 dark:bg-amber-900 px-2.5 py-0.5 rounded-md uppercase tracking-wider">
                              <Clock className="w-3 h-3" />
                              VRÁTIT DNES DO 16:00!
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-2xs font-bold text-cyan-700 dark:text-cyan-300 bg-cyan-100 dark:bg-cyan-950 px-2 py-0.5 rounded-md uppercase tracking-wider">
                              ✓ V termínu (běží {days}. den)
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Pravá strana: Náklady a akce */}
                      <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-slate-800">
                        <div className="text-right">
                          <span className="text-3xs uppercase font-bold text-slate-400 block">
                            Naběhlo ({days} dní)
                          </span>
                          <div className="text-base font-black text-slate-900 dark:text-white font-mono">
                            {formatCurrency(cost)}
                          </div>
                          <button
                            type="button"
                            onClick={() => handleToggleReturned(item.id)}
                            className={`text-2xs font-bold px-2.5 py-1 rounded-lg cursor-pointer transition-colors shadow-2xs ${
                              item.isReturned
                                ? 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                                : 'bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold'
                            }`}
                          >
                            {item.isReturned ? 'Znovu označit zapůjčeno' : '✓ Vrátit stroj'}
                          </button>
                        </div>

                        <div className="flex items-center gap-1.5">
                          {!item.isReturned && (
                            <button
                              onClick={() => handleSendReminder(item)}
                              className="p-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-300 cursor-pointer transition-all"
                              title="Odeslat připomínku k vrácení na WhatsApp"
                            >
                              <Send className="w-4 h-4 text-emerald-600" />
                            </button>
                          )}

                          <button
                            onClick={() => handleDelete(item.id)}
                            className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 cursor-pointer transition-colors"
                            title="Smazat záznam"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 flex items-center justify-between">
          <span className="text-xs text-slate-500 font-medium">
            Celkem naběhlé půjčovné: <strong>{formatCurrency(totalCost)}</strong>
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 text-xs font-bold cursor-pointer transition-colors"
          >
            Hotovo
          </button>
        </div>
      </div>
    </div>
  );
};
