import React, { useState, useRef } from 'react';
import {
  X,
  Plus,
  Trash2,
  DollarSign,
  TrendingUp,
  Receipt,
  Camera,
  Upload,
  Calendar,
  Building,
  Tag,
  Percent,
  CheckCircle,
  FileSpreadsheet,
  Printer,
} from 'lucide-react';
import { Contract, ContractExpense, ExpenseCategory } from '../types/contract';
import { formatCurrency, formatDateCs } from '../utils/numberToWordsCs';
import { compressImageFile } from '../utils/imageCompression';

interface ExpensesAndProfitModalProps {
  isOpen: boolean;
  onClose: () => void;
  contract: Contract;
  onUpdateContract: (updated: Contract) => void;
  onToast?: (type: 'success' | 'error' | 'info', text: string) => void;
}

const CATEGORY_META: Record<
  ExpenseCategory,
  { label: string; badgeClass: string }
> = {
  material: {
    label: 'Materiál na stavbu',
    badgeClass: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-700',
  },
  tools: {
    label: 'Nářadí & Půjčovna',
    badgeClass: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-700',
  },
  subcontractor: {
    label: 'Subdodavatel / Pomocník',
    badgeClass: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-700',
  },
  travel: {
    label: 'Doprava & PHM',
    badgeClass: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-700',
  },
  other: {
    label: 'Ostatní výdaje',
    badgeClass: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-700',
  },
};

export const ExpensesAndProfitModal: React.FC<ExpensesAndProfitModalProps> = ({
  isOpen,
  onClose,
  contract,
  onUpdateContract,
  onToast,
}) => {
  const [expenses, setExpenses] = useState<ContractExpense[]>(contract.expenses || []);
  const [title, setTitle] = useState('');
  const [supplier, setSupplier] = useState('');
  const [amount, setAmount] = useState<number | ''>('');
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [category, setCategory] = useState<ExpenseCategory>('material');
  const [notes, setNotes] = useState('');
  const [receiptPhotoUrl, setReceiptPhotoUrl] = useState<string | undefined>(undefined);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [selectedReceiptPreview, setSelectedReceiptPreview] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Celkové příjmy ze zakázky (smlouva + dodatky)
  const totalAmendments = (contract.amendments || []).reduce(
    (sum, a) => sum + (a.priceDifference || 0),
    0
  );
  const totalIncome = contract.price + totalAmendments;

  // Celkové výdaje
  const totalExpenses = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);

  // Čistý zisk a marže
  const netProfit = totalIncome - totalExpenses;
  const marginPercent = totalIncome > 0 ? Math.round((netProfit / totalIncome) * 100) : 0;

  // Subtotals per category
  const expensesByCategory = expenses.reduce((acc, curr) => {
    acc[curr.category] = (acc[curr.category] || 0) + curr.amount;
    return acc;
  }, {} as Record<ExpenseCategory, number>);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploadingPhoto(true);
      const compressed = await compressImageFile(file, 1200, 1200, 0.7);
      setReceiptPhotoUrl(compressed);
      if (onToast) onToast('info', 'Fotka účtenky byla nahrána a zkomprimována.');
    } catch (err) {
      console.error(err);
      if (onToast) onToast('error', 'Nepodařilo se zpracovat fotografii účtenky.');
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handleAddExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      if (onToast) onToast('error', 'Zadejte název výdaje.');
      return;
    }
    const numAmount = typeof amount === 'number' ? amount : parseFloat(String(amount));
    if (isNaN(numAmount) || numAmount <= 0) {
      if (onToast) onToast('error', 'Zadejte platnou částku výdaje větší než 0 Kč.');
      return;
    }

    const newExpense: ContractExpense = {
      id: `exp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      date,
      title: title.trim(),
      supplier: supplier.trim() || undefined,
      amount: Math.round(numAmount),
      category,
      receiptPhotoUrl,
      notes: notes.trim() || undefined,
      createdAt: new Date().toISOString(),
    };

    const updatedExpenses = [newExpense, ...expenses];
    setExpenses(updatedExpenses);

    const updatedContract = {
      ...contract,
      expenses: updatedExpenses,
    };
    onUpdateContract(updatedContract);

    // Reset formuláře
    setTitle('');
    setSupplier('');
    setAmount('');
    setNotes('');
    setReceiptPhotoUrl(undefined);
    if (fileInputRef.current) fileInputRef.current.value = '';

    if (onToast) {
      onToast('success', `Výdaj „${newExpense.title}“ ve výši ${formatCurrency(newExpense.amount)} byl uložen.`);
    }
  };

  const handleDeleteExpense = (id: string) => {
    const itemToDelete = expenses.find((e) => e.id === id);
    let confirmed = true;
    try {
      confirmed = window.confirm(`Opravdu chcete smazat výdaj „${itemToDelete?.title || 'tento výdaj'}“?`);
    } catch {
      confirmed = true;
    }
    if (!confirmed) return;

    const updatedExpenses = expenses.filter((e) => e.id !== id);
    setExpenses(updatedExpenses);

    const updatedContract = {
      ...contract,
      expenses: updatedExpenses,
    };
    onUpdateContract(updatedContract);

    if (onToast) onToast('info', 'Výdaj byl odstraněn.');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 max-w-4xl w-full my-6 flex flex-col max-h-[92vh] overflow-hidden text-slate-800 dark:text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-800 bg-slate-900 text-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold tracking-tight text-white flex items-center gap-2">
                <span>Ziskovost & Náklady zakázky</span>
                <span className="text-xs px-2 py-0.5 rounded font-mono font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                  {contract.contractNumber}
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Evidence skutečných nákladů na materiál, půjčovny a subdodávky pro přesný výpočet čistého zisku
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {/* KPI Dashboard */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {/* Příjmy celkem */}
            <div className="p-3.5 sm:p-4 rounded-xl bg-blue-50/60 dark:bg-blue-950/40 border border-blue-200/80 dark:border-blue-800/80">
              <span className="text-xs font-semibold text-blue-700 dark:text-blue-300 block mb-1 uppercase tracking-wider">
                Příjmy celkem
              </span>
              <span className="text-lg sm:text-2xl font-bold text-blue-950 dark:text-blue-100 block">
                {formatCurrency(totalIncome)}
              </span>
              <span className="text-[11px] text-blue-600/80 dark:text-blue-300/80 mt-0.5 block">
                Základ {formatCurrency(contract.price)}
                {totalAmendments !== 0 && (
                  <span> {totalAmendments > 0 ? `+${formatCurrency(totalAmendments)}` : formatCurrency(totalAmendments)}</span>
                )}
              </span>
            </div>

            {/* Skutečné náklady */}
            <div className="p-3.5 sm:p-4 rounded-xl bg-rose-50/60 dark:bg-rose-950/40 border border-rose-200/80 dark:border-rose-800/80">
              <span className="text-xs font-semibold text-rose-700 dark:text-rose-300 block mb-1 uppercase tracking-wider">
                Skutečné náklady
              </span>
              <span className="text-lg sm:text-2xl font-bold text-rose-950 dark:text-rose-100 block">
                {formatCurrency(totalExpenses)}
              </span>
              <span className="text-[11px] text-rose-600/80 dark:text-rose-300/80 mt-0.5 block">
                {expenses.length} {expenses.length === 1 ? 'zaznamenaný výdaj' : expenses.length < 5 ? 'zaznamenané výdaje' : 'zaznamenaných výdajů'}
              </span>
            </div>

            {/* Čistý zisk */}
            <div
              className={`p-3.5 sm:p-4 rounded-xl border ${
                netProfit >= 0
                  ? 'bg-emerald-50/70 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800'
                  : 'bg-red-50/70 dark:bg-red-950/40 border-red-300 dark:border-red-800'
              }`}
            >
              <span
                className={`text-xs font-semibold block mb-1 uppercase tracking-wider ${
                  netProfit >= 0 ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-700 dark:text-red-300'
                }`}
              >
                Čistý zisk zakázky
              </span>
              <span
                className={`text-lg sm:text-2xl font-bold block ${
                  netProfit >= 0 ? 'text-emerald-950 dark:text-emerald-100' : 'text-red-950 dark:text-red-100'
                }`}
              >
                {formatCurrency(netProfit)}
              </span>
              <span
                className={`text-[11px] font-medium mt-0.5 block ${
                  netProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
                }`}
              >
                {netProfit >= 0 ? 'Tvůj reálný výdělek' : 'Pozor: zakázka je ve ztrátě!'}
              </span>
            </div>

            {/* Zisková marže */}
            <div className="p-3.5 sm:p-4 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 block mb-1 uppercase tracking-wider">
                Zisková marže
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-lg sm:text-2xl font-bold text-slate-900 dark:text-white">
                  {marginPercent}%
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  z tržeb
                </span>
              </div>
              {/* Progress bar marže */}
              <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1.5 mt-2 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    marginPercent >= 50
                      ? 'bg-emerald-500'
                      : marginPercent >= 25
                      ? 'bg-amber-500'
                      : 'bg-rose-500'
                  }`}
                  style={{ width: `${Math.max(0, Math.min(100, marginPercent))}%` }}
                />
              </div>
            </div>
          </div>

          {/* Form: Přidat nový náklad */}
          <div className="p-4 sm:p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                <Plus className="w-4 h-4 text-emerald-600" />
                <span>Přidat náklad / výdaj k této zakázce</span>
              </h3>
            </div>

            <form onSubmit={handleAddExpense} className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                {/* Název položky */}
                <div className="sm:col-span-5">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Název výdaje / materiálu *
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="např. Nákup lepidla a hydroizolace"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                    required
                  />
                </div>

                {/* Dodavatel / Obchod */}
                <div className="sm:col-span-3">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Dodavatel / Prodejna
                  </label>
                  <input
                    type="text"
                    value={supplier}
                    onChange={(e) => setSupplier(e.target.value)}
                    placeholder="např. DEK, Hornbach, OBI"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                  />
                </div>

                {/* Částka v Kč */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Částka (Kč) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value ? parseFloat(e.target.value) : '')}
                    placeholder="Kč"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                    required
                  />
                </div>

                {/* Datum */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Datum výdaje
                  </label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-2.5 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                  />
                </div>
              </div>

              {/* Kategorie + Foto účtenky */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
                <div className="sm:col-span-4">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Kategorie nákladu
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                  >
                    {(Object.keys(CATEGORY_META) as ExpenseCategory[]).map((catKey) => (
                      <option key={catKey} value={catKey}>
                        {CATEGORY_META[catKey].label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-5">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Fotka účtenky / faktury z nákupu
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="file"
                      ref={fileInputRef}
                      accept="image/*"
                      capture="environment"
                      onChange={handlePhotoUpload}
                      className="hidden"
                      id="expense-receipt-upload"
                    />
                    <label
                      htmlFor="expense-receipt-upload"
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-dashed border-slate-300 dark:border-slate-700 hover:border-emerald-500 bg-white dark:bg-slate-900 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer transition-colors shadow-2xs"
                    >
                      <Camera className="w-3.5 h-3.5 text-emerald-600" />
                      <span>{isUploadingPhoto ? 'Zpracovávám...' : receiptPhotoUrl ? 'Změnit fotku' : 'Vyfotit / nahrát účtenku'}</span>
                    </label>

                    {receiptPhotoUrl && (
                      <div className="flex items-center gap-1.5">
                        <img
                          src={receiptPhotoUrl}
                          alt="Účtenka"
                          onClick={() => setSelectedReceiptPreview(receiptPhotoUrl)}
                          className="w-8 h-8 rounded object-cover border border-slate-300 cursor-pointer hover:opacity-80"
                          title="Kliknutím zvětšit"
                        />
                        <button
                          type="button"
                          onClick={() => setReceiptPhotoUrl(undefined)}
                          className="text-xs text-red-500 hover:underline"
                        >
                          Smazat foto
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="sm:col-span-3 sm:self-end">
                  <button
                    type="submit"
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm transition-colors shadow-xs cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Uložit výdaj</span>
                  </button>
                </div>
              </div>
            </form>
          </div>

          {/* Přehled výdajů podle kategorií */}
          {expenses.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                Rozpad nákladů:
              </span>
              {(Object.keys(CATEGORY_META) as ExpenseCategory[]).map((catKey) => {
                const catSum = expensesByCategory[catKey] || 0;
                if (catSum === 0) return null;
                const meta = CATEGORY_META[catKey];
                return (
                  <span
                    key={catKey}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border ${meta.badgeClass}`}
                  >
                    <span>{meta.label}:</span>
                    <strong className="font-mono tabular-nums font-semibold">{formatCurrency(catSum)}</strong>
                  </span>
                );
              })}
            </div>
          )}

          {/* Tabulka zaznamenaných výdajů */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Položkový seznam výdajů ({expenses.length})
              </h3>
              {expenses.length > 0 && (
                <span className="text-xs font-semibold text-slate-500">
                  Celkem: <strong>{formatCurrency(totalExpenses)}</strong>
                </span>
              )}
            </div>

            {expenses.length === 0 ? (
              <div className="text-center py-8 px-4 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
                <Receipt className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
                  K této zakázce zatím nemáte zadané žádné výdaje.
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Přidejte nákupy materiálu a nářadí výše, abyste okamžitě viděli svůj reálný čistý zisk.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold uppercase text-[11px] tracking-wider">
                    <tr>
                      <th className="py-2.5 px-3">Datum</th>
                      <th className="py-2.5 px-3">Položka / Název výdaje</th>
                      <th className="py-2.5 px-3 hidden sm:table-cell">Dodavatel</th>
                      <th className="py-2.5 px-3 hidden md:table-cell">Kategorie</th>
                      <th className="py-2.5 px-3 text-center">Účtenka</th>
                      <th className="py-2.5 px-3 text-right">Částka</th>
                      <th className="py-2.5 px-3 text-right">Akce</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {expenses.map((exp) => {
                      const meta = CATEGORY_META[exp.category];
                      return (
                        <tr
                          key={exp.id}
                          className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                        >
                          <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap">
                            {formatDateCs(exp.date)}
                          </td>
                          <td className="py-2.5 px-3 font-medium text-slate-900 dark:text-white">
                            <div>{exp.title}</div>
                            {exp.notes && (
                              <div className="text-[11px] text-slate-400 italic">{exp.notes}</div>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300 hidden sm:table-cell">
                            {exp.supplier || '—'}
                          </td>
                          <td className="py-2.5 px-3 hidden md:table-cell">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border ${meta.badgeClass}`}
                            >
                              <span>{meta.label}</span>
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            {exp.receiptPhotoUrl ? (
                              <button
                                type="button"
                                onClick={() => setSelectedReceiptPreview(exp.receiptPhotoUrl || null)}
                                className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                                title="Zobrazit fotku účtenky"
                              >
                                <Camera className="w-3.5 h-3.5" />
                                <span>Foto</span>
                              </button>
                            ) : (
                              <span className="text-slate-300 dark:text-slate-600 text-xs">—</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold text-slate-900 dark:text-white whitespace-nowrap">
                            {formatCurrency(exp.amount)}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <button
                              type="button"
                              onClick={() => handleDeleteExpense(exp.id)}
                              className="p-1 text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-colors cursor-pointer"
                              title="Smazat výdaj"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-slate-50 dark:bg-slate-800/80 font-bold border-t border-slate-200 dark:border-slate-700">
                    <tr>
                      <td colSpan={2} className="py-2.5 px-3 text-slate-700 dark:text-slate-300">
                        Celkem výdaje:
                      </td>
                      <td colSpan={3} className="hidden sm:table-cell"></td>
                      <td className="py-2.5 px-3 text-right text-rose-600 dark:text-rose-400">
                        {formatCurrency(totalExpenses)}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Výdaje jsou automaticky uloženy k zakázce a promítnou se do finančního radaru OSVČ.
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-900 dark:bg-slate-100 hover:bg-slate-800 dark:hover:bg-white text-white dark:text-slate-900 font-semibold text-sm transition-colors cursor-pointer shadow-xs"
          >
            Hotovo
          </button>
        </div>
      </div>

      {/* Lightbox / Zvětšená účtenka */}
      {selectedReceiptPreview && (
        <div
          className="fixed inset-0 z-60 bg-black/80 flex items-center justify-center p-4 animate-in fade-in duration-100"
          onClick={() => setSelectedReceiptPreview(null)}
        >
          <div className="relative max-w-2xl max-h-[90vh] bg-white dark:bg-slate-900 rounded-xl overflow-hidden p-2 shadow-2xl">
            <button
              onClick={() => setSelectedReceiptPreview(null)}
              className="absolute top-3 right-3 p-1.5 rounded-full bg-slate-900/70 text-white hover:bg-black transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <img
              src={selectedReceiptPreview}
              alt="Detail účtenky"
              className="max-h-[82vh] max-w-full object-contain rounded"
            />
          </div>
        </div>
      )}
    </div>
  );
};
