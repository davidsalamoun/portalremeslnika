import React, { useState, useRef } from 'react';
import { Dialog } from './Dialog';
import { Trash2, Camera, Check } from 'lucide-react';
import { Contract, ContractExpense, ExpenseCategory } from '../types/contract';
import { formatCurrency, formatDateCs } from '../utils/numberToWordsCs';
import { compressImageFile } from '../utils/imageCompression';
import { EXPENSE_CATEGORY_LABELS } from '../utils/expenseCategories';

interface ExpensesAndProfitModalProps {
  isOpen: boolean;
  onClose: () => void;
  contract: Contract;
  onUpdateContract: (updated: Contract) => void;
  onToast?: (type: 'success' | 'error' | 'info', text: string) => void;
}


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
  const [deleteTarget, setDeleteTarget] = useState<ContractExpense | null>(null);
  const [errors, setErrors] = useState<{ title?: string; amount?: string }>({});

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
    const numAmount = typeof amount === 'number' ? amount : parseFloat(String(amount));
    const nextErrors: { title?: string; amount?: string } = {};
    if (!title.trim()) nextErrors.title = 'Napište, za co výdaj byl.';
    if (isNaN(numAmount) || numAmount <= 0) nextErrors.amount = 'Zadejte částku větší než 0 Kč.';
    setErrors(nextErrors);
    if (nextErrors.title || nextErrors.amount) {
      document.getElementById(nextErrors.title ? 'vydaj-nazev' : 'vydaj-castka')?.focus();
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
    setDeleteTarget(null);

    const updatedExpenses = expenses.filter((e) => e.id !== id);
    setExpenses(updatedExpenses);

    const updatedContract = {
      ...contract,
      expenses: updatedExpenses,
    };
    onUpdateContract(updatedContract);

    if (onToast) onToast('info', 'Výdaj byl odstraněn.');
  };

  const field =
    'min-h-11 w-full px-3 rounded-md border-[1.5px] border-slate-900 dark:border-slate-500 bg-white dark:bg-slate-950 text-slate-900 dark:text-white';
  const label = 'block font-semibold text-slate-900 dark:text-slate-100 mb-1.5';
  const outline =
    'min-h-11 px-4 inline-flex items-center justify-center gap-2 rounded-md border-[1.5px] border-slate-900 dark:border-slate-500 text-slate-900 dark:text-slate-100 font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors disabled:opacity-60';
  const chip = (on: boolean) =>
    `min-h-11 px-3 inline-flex items-center rounded-md border font-medium cursor-pointer transition-colors ${
      on
        ? 'border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-900'
        : 'border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800'
    }`;
  const expenseWord = (n: number) => (n === 1 ? 'výdaj' : n >= 2 && n <= 4 ? 'výdaje' : 'výdajů');

  return (
    <Dialog
      title="Náklady a zisk"
      subtitle={<>smlouva {contract.contractNumber}</>}
      size="3xl"
      bare
      closeOnBackdrop={false}
      onClose={onClose}
    >
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 text-[15px]">
        {/* Souhrn: jeden rámeček s řádky (vzor Přehledu) */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md divide-y divide-slate-100 dark:divide-slate-800">
          <div className="px-5 py-4 flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="text-slate-600 dark:text-slate-400">
                {netProfit >= 0 ? 'Zůstane po odečtení nákladů' : 'Zakázka je ve ztrátě'}
              </div>
              <div
                className={`font-display font-bold text-[40px] leading-none tabular-nums mt-1 ${
                  netProfit >= 0 ? 'text-slate-900 dark:text-white' : 'text-rose-700 dark:text-rose-400'
                }`}
              >
                {formatCurrency(netProfit)}
              </div>
            </div>
            {totalIncome > 0 && (
              <div className="w-full sm:w-56 text-left sm:text-right">
                <div className="text-slate-600 dark:text-slate-400">{marginPercent} % z ceny díla</div>
                <div className="mt-2 h-2 rounded-sm bg-slate-200 dark:bg-slate-700 overflow-hidden" aria-hidden="true">
                  <div className="h-full bg-slate-900 dark:bg-white" style={{ width: `${Math.max(0, Math.min(100, marginPercent))}%` }} />
                </div>
              </div>
            )}
          </div>
          <div className="px-5 py-3 flex items-baseline justify-between gap-4">
            <span className="text-slate-600 dark:text-slate-400">Cena díla{totalAmendments !== 0 ? ' včetně víceprací' : ''}</span>
            <span className="font-display font-semibold text-xl tabular-nums text-slate-900 dark:text-white">{formatCurrency(totalIncome)}</span>
          </div>
          <div className="px-5 py-3 flex items-baseline justify-between gap-4">
            <span className="text-slate-600 dark:text-slate-400">
              Náklady ({expenses.length} {expenseWord(expenses.length)})
            </span>
            <span className="font-display font-semibold text-xl tabular-nums text-slate-900 dark:text-white">
              {totalExpenses > 0 ? `− ${formatCurrency(totalExpenses)}` : formatCurrency(0)}
            </span>
          </div>
        </div>

        {/* Přidat výdaj */}
        <form onSubmit={handleAddExpense} className="space-y-4" noValidate>
          <h3 className="font-display font-semibold text-xl text-slate-900 dark:text-white">Přidat výdaj</h3>
          <div className="grid grid-cols-2 lg:grid-cols-[2fr_1.3fr_1fr_1fr] gap-3">
            <div className="col-span-2 lg:col-span-1">
              <label htmlFor="vydaj-nazev" className={label}>
                Co jste koupili
              </label>
              <input
                id="vydaj-nazev"
                type="text"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  if (errors.title && e.target.value.trim()) setErrors((x) => ({ ...x, title: undefined }));
                }}
                placeholder="např. lepidlo a hydroizolace"
                aria-invalid={!!errors.title}
                aria-describedby={errors.title ? 'vydaj-nazev-chyba' : undefined}
                className={`${field} ${errors.title ? '!border-rose-600' : ''}`}
              />
              {errors.title && (
                <p id="vydaj-nazev-chyba" role="alert" className="mt-1 text-rose-700 dark:text-rose-400">
                  {errors.title}
                </p>
              )}
            </div>
            <div className="col-span-2 lg:col-span-1">
              <label htmlFor="vydaj-dodavatel" className={label}>
                Kde <span className="font-normal text-slate-600 dark:text-slate-400">(nepovinné)</span>
              </label>
              <input id="vydaj-dodavatel" type="text" value={supplier} onChange={(e) => setSupplier(e.target.value)} placeholder="např. DEK, Hornbach" className={field} />
            </div>
            <div>
              <label htmlFor="vydaj-castka" className={label}>
                Částka (Kč)
              </label>
              <input
                id="vydaj-castka"
                type="number"
                inputMode="decimal"
                min="0"
                value={amount}
                onChange={(e) => {
                  const v = e.target.value === '' ? '' : parseFloat(e.target.value);
                  setAmount(v);
                  if (errors.amount && typeof v === 'number' && v > 0) setErrors((x) => ({ ...x, amount: undefined }));
                }}
                aria-invalid={!!errors.amount}
                aria-describedby={errors.amount ? 'vydaj-castka-chyba' : undefined}
                className={`${field} tabular-nums ${errors.amount ? '!border-rose-600' : ''}`}
              />
              {errors.amount && (
                <p id="vydaj-castka-chyba" role="alert" className="mt-1 text-rose-700 dark:text-rose-400">
                  {errors.amount}
                </p>
              )}
            </div>
            <div>
              <label htmlFor="vydaj-datum" className={label}>
                Datum
              </label>
              <input id="vydaj-datum" type="date" value={date} onChange={(e) => setDate(e.target.value)} className={field} />
            </div>
          </div>
          <div role="group" aria-label="Druh výdaje" className="flex flex-wrap gap-2">
            {(Object.keys(EXPENSE_CATEGORY_LABELS) as ExpenseCategory[]).map((key) => (
              <button key={key} type="button" aria-pressed={category === key} onClick={() => setCategory(key)} className={chip(category === key)}>
                {EXPENSE_CATEGORY_LABELS[key]}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <input ref={fileInputRef} type="file" accept="image/*" capture="environment" onChange={handlePhotoUpload} className="hidden" />
            <button type="button" onClick={() => fileInputRef.current?.click()} disabled={isUploadingPhoto} className={outline}>
              <Camera className="w-[18px] h-[18px]" />
              <span>{isUploadingPhoto ? 'Zpracovávám fotku…' : receiptPhotoUrl ? 'Vyfotit znovu' : 'Vyfotit účtenku'}</span>
            </button>
            {receiptPhotoUrl && (
              <span className="inline-flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                <Check className="w-4 h-4" />
                Fotka účtenky je připravená
              </span>
            )}
            <button
              type="submit"
              className="min-h-11 px-5 inline-flex items-center justify-center gap-2 rounded-md border-[1.5px] border-slate-900 bg-amber-400 hover:bg-amber-300 text-slate-900 font-semibold cursor-pointer transition-colors"
            >
              Uložit výdaj
            </button>
          </div>
        </form>

        {/* Výdaje */}
        <section aria-labelledby="vydaje-nadpis" className="space-y-2.5">
          <div className="flex items-baseline justify-between gap-3">
            <h3 id="vydaje-nadpis" className="font-display font-semibold text-xl text-slate-900 dark:text-white">
              Výdaje
            </h3>
            {expenses.length > 0 && <span className="text-slate-600 dark:text-slate-400">celkem {formatCurrency(totalExpenses)}</span>}
          </div>
          {expenses.length === 0 ? (
            <p className="px-5 py-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md text-slate-600 dark:text-slate-300">
              Zatím žádné výdaje. Zapište nákupy materiálu, nářadí nebo dopravu a uvidíte, kolik vám ze zakázky zůstane.
            </p>
          ) : (
            <ul className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md divide-y divide-slate-100 dark:divide-slate-800">
              {expenses.map((exp) => (
                <li key={exp.id} className="px-5 py-3 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-slate-900 dark:text-white">{exp.title}</div>
                    <div className="text-slate-600 dark:text-slate-400">
                      {[formatDateCs(exp.date), exp.supplier, EXPENSE_CATEGORY_LABELS[exp.category]].filter(Boolean).join(' · ')}
                      {exp.receiptPhotoUrl && (
                        <>
                          {' · '}
                          <button
                            type="button"
                            onClick={() => setSelectedReceiptPreview(exp.receiptPhotoUrl || null)}
                            className="text-blue-600 dark:text-blue-300 underline underline-offset-2 cursor-pointer"
                          >
                            účtenka
                          </button>
                        </>
                      )}
                    </div>
                    {exp.notes && <div className="text-slate-600 dark:text-slate-400">{exp.notes}</div>}
                  </div>
                  <span className="font-display font-semibold text-xl tabular-nums text-slate-900 dark:text-white whitespace-nowrap">
                    {formatCurrency(exp.amount)}
                  </span>
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(exp)}
                    aria-label={`Smazat výdaj ${exp.title}`}
                    title="Smazat výdaj"
                    className="min-h-11 min-w-11 -mr-2 inline-flex items-center justify-center rounded-md text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Patička */}
      <div className="px-4 sm:px-6 py-3.5 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 shrink-0">
        <span className="text-slate-600 dark:text-slate-400">Výdaje se ukládají k zakázce a promítnou se do Financí.</span>
        <button type="button" onClick={onClose} className={outline}>
          Hotovo
        </button>
      </div>

      {/* Zvětšená účtenka */}
      {selectedReceiptPreview && (
        <Dialog title="Účtenka" size="2xl" onClose={() => setSelectedReceiptPreview(null)}>
          <img src={selectedReceiptPreview} alt="Fotka účtenky" className="max-h-[75vh] w-full object-contain" />
        </Dialog>
      )}

      {/* Potvrzení smazání */}
      {deleteTarget && (
        <Dialog title="Smazat výdaj?" onClose={() => setDeleteTarget(null)}>
          <div className="space-y-5 text-[15px]">
            <p>
              Výdaj <strong>{deleteTarget.title}</strong> ({formatCurrency(deleteTarget.amount)}) se odstraní ze zakázky.
            </p>
            <div className="flex flex-wrap justify-end gap-2.5">
              <button type="button" onClick={() => setDeleteTarget(null)} className={outline}>
                Zpět
              </button>
              <button
                type="button"
                onClick={() => handleDeleteExpense(deleteTarget.id)}
                className="min-h-11 px-4 inline-flex items-center justify-center rounded-md border-[1.5px] border-rose-700 text-rose-700 dark:border-rose-400 dark:text-rose-300 font-semibold hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
              >
                Smazat výdaj
              </button>
            </div>
          </div>
        </Dialog>
      )}
    </Dialog>
  );
};
