import React, { useState } from 'react';
import { Dialog } from './Dialog';
import {
  Users,
  X,
  Plus,
  Trash2,
  CheckCircle2,
  DollarSign,
  Clock,
  Phone,
  Send,
  Printer,
  ChevronRight,
  ShieldCheck,
  UserCheck,
  Briefcase,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';
import { Contract, SubcontractorWork, ContractExpense } from '../types/contract';
import { formatCurrency, formatDateCs } from '../utils/numberToWordsCs';
import { getDirectWhatsAppUrl, safeOpenExternalUrl } from '../utils/shareUtils';
import { triggerHaptic } from '../utils/haptics';

interface SubcontractorsModalProps {
  isOpen: boolean;
  onClose: () => void;
  contract: Contract;
  onUpdateContract: (updated: Contract) => void;
  onToast?: (type: 'success' | 'error' | 'info', text: string) => void;
}

const COMMON_ROLES = [
  'Pomocník / Brigádník',
  'Zedník',
  'Instalatér',
  'Elektrikář',
  'Sádrokartonář',
  'Obkladač',
  'Malíř',
  'Topenář',
  'Tesař / Pokrývač',
  'Hodinový manžel',
];

export const SubcontractorsModal: React.FC<SubcontractorsModalProps> = ({
  isOpen,
  onClose,
  contract,
  onUpdateContract,
  onToast,
}) => {
  if (!isOpen) return null;

  const subcontractors: SubcontractorWork[] = contract.subcontractors || [];

  // Form state
  const [isAdding, setIsAdding] = useState(false);
  const [workerName, setWorkerName] = useState('');
  const [role, setRole] = useState(COMMON_ROLES[0]);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [calcType, setCalcType] = useState<'hours' | 'fixed'>('hours');
  const [hoursWorked, setHoursWorked] = useState<number | ''>(8);
  const [hourlyRate, setHourlyRate] = useState<number | ''>(250);
  const [fixedPrice, setFixedPrice] = useState<number | ''>(2000);
  const [taskDescription, setTaskDescription] = useState('');
  const [paidAmount, setPaidAmount] = useState<number | ''>(0);
  const [notes, setNotes] = useState('');

  // Total summary calculations
  const totalHours = subcontractors.reduce((sum, s) => sum + (s.hoursWorked || 0), 0);
  const totalCost = subcontractors.reduce((sum, s) => {
    if (s.fixedPrice && s.fixedPrice > 0) {
      return sum + s.fixedPrice;
    }
    return sum + (s.hoursWorked || 0) * (s.hourlyRate || 0);
  }, 0);
  const totalPaid = subcontractors.reduce((sum, s) => sum + (s.paidAmount || 0), 0);
  const totalRemaining = Math.max(0, totalCost - totalPaid);

  const handleAddWork = (e: React.FormEvent) => {
    e.preventDefault();
    if (!workerName.trim()) {
      if (onToast) onToast('error', 'Zadejte jméno parťáka nebo pomocníka.');
      return;
    }

    const calculatedTotal =
      calcType === 'fixed'
        ? Number(fixedPrice || 0)
        : Number(hoursWorked || 0) * Number(hourlyRate || 0);

    const paid = Number(paidAmount || 0);

    const newWork: SubcontractorWork = {
      id: `sub_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      workerName: workerName.trim(),
      role: role.trim(),
      date,
      hoursWorked: calcType === 'hours' ? Number(hoursWorked || 0) : 0,
      hourlyRate: calcType === 'hours' ? Number(hourlyRate || 0) : 0,
      fixedPrice: calcType === 'fixed' ? Number(fixedPrice || 0) : undefined,
      taskDescription: taskDescription.trim() || undefined,
      paidAmount: paid,
      isFullyPaid: paid >= calculatedTotal && calculatedTotal > 0,
      notes: notes.trim() || undefined,
    };

    const updatedList = [newWork, ...subcontractors];

    onUpdateContract({
      ...contract,
      subcontractors: updatedList,
    });

    triggerHaptic('success');
    if (onToast) onToast('success', `Zápis pro parťáka ${workerName} byl úspěšně uložen.`);

    // Reset form
    setWorkerName('');
    setTaskDescription('');
    setPaidAmount(0);
    setNotes('');
    setIsAdding(false);
  };

  const handleTogglePaid = (workId: string) => {
    const updated = subcontractors.map((s) => {
      if (s.id === workId) {
        const fullAmount =
          s.fixedPrice && s.fixedPrice > 0 ? s.fixedPrice : (s.hoursWorked || 0) * (s.hourlyRate || 0);
        const willBePaid = !s.isFullyPaid;
        return {
          ...s,
          isFullyPaid: willBePaid,
          paidAmount: willBePaid ? fullAmount : 0,
        };
      }
      return s;
    });

    onUpdateContract({
      ...contract,
      subcontractors: updated,
    });
    triggerHaptic('selection');
  };

  const handleDelete = (workId: string) => {
    const updated = subcontractors.filter((s) => s.id !== workId);
    onUpdateContract({
      ...contract,
      subcontractors: updated,
    });
    triggerHaptic('impact');
    if (onToast) onToast('info', 'Záznam práce byl smazán.');
  };

  // 1-klikové propsání do skutečných nákladů zakázky (contract.expenses)
  const handleSyncToExpenses = () => {
    if (subcontractors.length === 0) {
      if (onToast) onToast('info', 'Zatím nemáte žádné záznamy práce k synchronizaci.');
      return;
    }

    const currentExpenses = contract.expenses || [];
    // Odebereme staré výdaje zadané ze subdodavatelů
    const otherExpenses = currentExpenses.filter((e) => !e.title?.startsWith('Parta:'));

    // Vytvoříme souhrnnou položku nebo jednotlivé položky
    const newSubExpenses: ContractExpense[] = subcontractors.map((s) => {
      const amount =
        s.fixedPrice && s.fixedPrice > 0 ? s.fixedPrice : (s.hoursWorked || 0) * (s.hourlyRate || 0);
      return {
        id: `exp_sub_${s.id}`,
        category: 'subcontractor',
        title: `Parta: ${s.workerName} (${s.role || 'práce'}) - ${s.hoursWorked ? `${s.hoursWorked} h` : 'úkol'}`,
        amount: amount,
        date: s.date,
        createdAt: new Date().toISOString(),
      };
    });

    onUpdateContract({
      ...contract,
      expenses: [...otherExpenses, ...newSubExpenses],
    });

    triggerHaptic('success');
    if (onToast) {
      onToast('success', `Náklady na parťáky (${formatCurrency(totalCost)}) byly zapsány do nákladů stavby.`);
    }
  };

  // Odeslání WhatsApp rekapitulace parťákovi
  const handleSendWhatsApp = (item: SubcontractorWork) => {
    const total =
      item.fixedPrice && item.fixedPrice > 0
        ? item.fixedPrice
        : (item.hoursWorked || 0) * (item.hourlyRate || 0);
    const remaining = Math.max(0, total - (item.paidAmount || 0));

    const msg = [
      `Rekapitulace práce ze stavby: ${contract.client.name} (${contract.executionPlace || 'zakázka #' + contract.contractNumber})`,
      `• Pracovník: ${item.workerName}`,
      `• Datum: ${formatDateCs(item.date)}`,
      `• Profese / role: ${item.role || 'pomocné práce'}`,
      item.hoursWorked > 0 ? `• Odpracováno: ${item.hoursWorked} hod. × ${item.hourlyRate} Kč/hod.` : `• Úkolová sazba`,
      item.taskDescription ? `• Činnost: ${item.taskDescription}` : '',
      `• Celková odměna: ${formatCurrency(total)}`,
      `• Již vyplaceno: ${formatCurrency(item.paidAmount || 0)}`,
      remaining > 0 ? `• Zbývá doplatit: ${formatCurrency(remaining)}` : '• Stav: vše vyplaceno',
      ``,
      `Potvrzení o odvedené práci a vyplacené odměně.`,
    ]
      .filter(Boolean)
      .join('\n');

    const url = getDirectWhatsAppUrl(msg);
    safeOpenExternalUrl(url);
  };

  return (
    <Dialog
      title="Parťáci a tým"
      subtitle={<>smlouva {contract.contractNumber}</>}
      size="2xl"
      bare
      closeOnBackdrop={false}
      onClose={onClose}
    >

        {/* Content body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {/* Summary KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <span className="text-sm text-slate-600 dark:text-slate-400 block mb-1">
                Odpracováno
              </span>
              <div className="font-display text-2xl font-semibold text-slate-900 dark:text-white flex items-baseline gap-1">
                <span>{totalHours}</span>
                <span className="text-sm font-semibold text-slate-500 font-sans">hod</span>
              </div>
            </div>

            <div className="p-3.5 rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <span className="text-sm text-slate-600 dark:text-slate-400 block mb-1">
                Celkem pro partu
              </span>
              <div className="font-display text-2xl font-semibold text-slate-900 dark:text-white">
                {formatCurrency(totalCost)}
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <span className="text-sm text-slate-600 dark:text-slate-400 block mb-1">
                Vyplaceno zálohou
              </span>
              <div className="font-display text-2xl font-semibold text-slate-900 dark:text-white">
                {formatCurrency(totalPaid)}
              </div>
            </div>

            <div className={`p-3.5 rounded-xl border ${
              totalRemaining > 0
                ? 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
            }`}>
              <span className="text-sm text-slate-600 dark:text-slate-400 block mb-1">
                Zbývá doplatit
              </span>
              <div className={`text-xl sm:text-2xl font-semibold ${
                'font-display text-slate-900 dark:text-white'
              }`}>
                {formatCurrency(totalRemaining)}
              </div>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1">
            <button
              onClick={() => setIsAdding(!isAdding)}
              className="min-h-11 inline-flex items-center gap-1.5 px-4 py-2.5 rounded-md border-[1.5px] border-slate-900 dark:border-slate-500 text-slate-900 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 text-sm font-semibold transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{isAdding ? 'Zavřít formulář' : 'Zapsat směnu / úkol parťáka'}</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                onClick={handleSyncToExpenses}
                className="min-h-11 inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border-[1.5px] border-slate-900 dark:border-slate-500 text-slate-900 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 text-sm font-semibold cursor-pointer transition-colors"
                title="Zapsat náklady na partu do celkových výdajů stavby"
              >
                <DollarSign className="w-3.5 h-3.5" />
                <span>Propis do nákladů stavby</span>
              </button>
            </div>
          </div>

          {/* Formulář pro přidání směny parťáka */}
          {isAdding && (
            <form onSubmit={handleAddWork} className="p-4 sm:p-5 rounded-xl bg-amber-50/50 dark:bg-amber-950/20 border-2 border-amber-300 dark:border-amber-800 space-y-4">
              <h4 className="font-semibold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-amber-600" />
                <span>Nová směna nebo úkol pro parťáka</span>
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Jméno parťáka / brigádníka: *
                  </label>
                  <input
                    type="text"
                    required
                    value={workerName}
                    onChange={(e) => setWorkerName(e.target.value)}
                    placeholder="Např. Martin Zedník, Pepa pomocník"
                    className="min-h-11 w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Role / profese:
                  </label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="min-h-11 w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                  >
                    {COMMON_ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Datum:
                  </label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="min-h-11 w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              {/* Typ odměny: Hodinovka vs Úkol */}
              <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
                <div className="flex items-center gap-4">
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Způsob odměny:</span>
                  <label className="inline-flex items-center gap-1.5 text-sm font-semibold cursor-pointer">
                    <input
                      type="radio"
                      name="calcType"
                      checked={calcType === 'hours'}
                      onChange={() => setCalcType('hours')}
                    />
                    <span>Hodinová sazba</span>
                  </label>
                  <label className="inline-flex items-center gap-1.5 text-sm font-semibold cursor-pointer">
                    <input
                      type="radio"
                      name="calcType"
                      checked={calcType === 'fixed'}
                      onChange={() => setCalcType('fixed')}
                    />
                    <span>Pevný úkol</span>
                  </label>
                </div>

                {calcType === 'hours' ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-1">
                    <div>
                      <label className="text-[13px] font-semibold text-slate-500 block mb-1">
                        Odpracováno hodin:
                      </label>
                      <input
                        type="number"
                        min="0.5"
                        step="0.5"
                        value={hoursWorked}
                        onChange={(e) => setHoursWorked(parseFloat(e.target.value) || '')}
                        className="min-h-11 w-full px-3 py-1.5 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white font-semibold"
                      />
                    </div>
                    <div>
                      <label className="text-[13px] font-semibold text-slate-500 block mb-1">
                        Hodinová sazba (Kč/h):
                      </label>
                      <input
                        type="number"
                        step="10"
                        value={hourlyRate}
                        onChange={(e) => setHourlyRate(parseFloat(e.target.value) || '')}
                        className="min-h-11 w-full px-3 py-1.5 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white font-semibold"
                      />
                    </div>
                    <div className="col-span-2 sm:col-span-1 flex flex-col justify-end">
                      <span className="text-[13px] font-semibold text-slate-500 block mb-1">Celkem:</span>
                      <div className="px-3 py-1.5 rounded-lg bg-amber-100 dark:bg-amber-950/80 text-amber-900 dark:text-amber-200 text-sm font-semibold">
                        {formatCurrency(Number(hoursWorked || 0) * Number(hourlyRate || 0))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="text-[13px] font-semibold text-slate-500 block mb-1">
                      Pevná odměna za provedený úkol (Kč):
                    </label>
                    <input
                      type="number"
                      value={fixedPrice}
                      onChange={(e) => setFixedPrice(parseFloat(e.target.value) || '')}
                      placeholder="Např. 3000"
                      className="min-h-11 w-full px-3 py-1.5 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white font-semibold max-w-xs"
                    />
                  </div>
                )}
              </div>

              {/* Popis práce & Vyplacená záloha */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Popis činnosti na stavbě:
                  </label>
                  <input
                    type="text"
                    value={taskDescription}
                    onChange={(e) => setTaskDescription(e.target.value)}
                    placeholder="Např. Vynášení suti, penetrace podlah, sekání drážek"
                    className="min-h-11 w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Ihned vyplaceno na ruku / zálohou (Kč):
                  </label>
                  <input
                    type="number"
                    value={paidAmount}
                    onChange={(e) => setPaidAmount(parseFloat(e.target.value) || '')}
                    className="min-h-11 w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white font-semibold"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsAdding(false)}
                  className="min-h-11 inline-flex items-center justify-center px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Zrušit
                </button>
                <button
                  type="submit"
                  className="min-h-11 inline-flex items-center justify-center px-5 py-2 rounded-md border-[1.5px] border-slate-900 bg-amber-400 hover:bg-amber-300 text-slate-900 text-sm font-semibold cursor-pointer transition-colors"
                >
                  Uložit záznam práce
                </button>
              </div>
            </form>
          )}

          {/* Seznam zapsaných směn / lidí */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-slate-500">
              Zapsané směny na zakázce ({subcontractors.length})
            </h4>

            {subcontractors.length === 0 ? (
              <div className="p-8 text-center rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
                <Users className="w-8 h-8 mx-auto text-slate-400" />
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Zatím nemáte zapsaného žádného parťáka ani brigádníka
                </p>
                <p className="text-sm text-slate-500 max-w-sm mx-auto">
                  Klikněte na „Zapsat směnu / úkol parťáka“ pro rychlou evidenci hodin a vyplacených záloh.
                </p>
              </div>
            ) : (
              subcontractors.map((item) => {
                const total =
                  item.fixedPrice && item.fixedPrice > 0
                    ? item.fixedPrice
                    : (item.hoursWorked || 0) * (item.hourlyRate || 0);
                const remaining = Math.max(0, total - (item.paidAmount || 0));

                return (
                  <div
                    key={item.id}
                    className={`p-4 rounded-xl border transition-all ${
                      item.isFullyPaid
                        ? 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
                        : 'bg-amber-50/40 dark:bg-amber-950/20 border-amber-300 dark:border-amber-900/60'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-900 dark:text-white text-base">
                            {item.workerName}
                          </span>
                          <span className="text-[13px] font-semibold px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                            {item.role || 'Práce'}
                          </span>
                          <span className="text-sm text-slate-400">
                            · {formatDateCs(item.date)}
                          </span>
                        </div>

                        {item.taskDescription && (
                          <p className="text-sm text-slate-600 dark:text-slate-300">
                            {item.taskDescription}
                          </p>
                        )}

                        <div className="text-sm text-slate-500 flex flex-wrap items-center gap-x-3 gap-y-1 pt-0.5">
                          {item.hoursWorked > 0 && (
                            <span className="font-medium">
                              <strong>{item.hoursWorked} h</strong> × {item.hourlyRate} Kč/h
                            </span>
                          )}
                          <span>
                            Vyplaceno: <strong className="text-slate-900 dark:text-white">{formatCurrency(item.paidAmount || 0)}</strong>
                          </span>
                          {remaining > 0 && (
                            <span className="text-rose-600 font-semibold">
                              Zbývá: {formatCurrency(remaining)}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Pravá strana: Akce a celková částka */}
                      <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-slate-800">
                        <div className="text-right">
                          <div className="text-base font-semibold text-slate-900 dark:text-white">
                            {formatCurrency(total)}
                          </div>
                          <button
                            type="button"
                            onClick={() => handleTogglePaid(item.id)}
                            className={`min-h-11 inline-flex items-center justify-center text-[13px] font-semibold px-2.5 py-1 rounded-md cursor-pointer transition-colors ${
                              item.isFullyPaid
                                ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                : 'border-[1.5px] border-slate-900 dark:border-slate-500 text-slate-900 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800'
                            }`}
                          >
                            {item.isFullyPaid ? 'Vyplaceno' : 'Označit vyplaceno'}
                          </button>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => handleSendWhatsApp(item)}
                            className="min-h-11 min-w-11 inline-flex items-center justify-center p-2 rounded-xl border-[1.5px] border-slate-900 dark:border-slate-500 text-slate-900 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-all"
                            title="Odeslat parťákovi souhrn na WhatsApp"
                          >
                            <Send className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => handleDelete(item.id)}
                            className="min-h-11 min-w-11 inline-flex items-center justify-center p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 cursor-pointer transition-colors"
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
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <span className="text-sm text-slate-500 font-medium">
            Celkem nákladů na partu: <strong>{formatCurrency(totalCost)}</strong>
          </span>
          <button
            onClick={onClose}
            className="min-h-11 inline-flex items-center justify-center px-5 py-2.5 rounded-md border-[1.5px] border-slate-900 dark:border-slate-500 text-slate-900 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 text-sm font-semibold cursor-pointer transition-colors"
          >
            Hotovo
          </button>
        </div>
      </Dialog>
  );
};
