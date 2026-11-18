import React, { useMemo, useState } from 'react';
import { Dialog } from './Dialog';
import { Copy, Check, ArrowRight, Plus, Trash2 } from 'lucide-react';
import { BudgetItem, PriceListTemplateItem } from '../types/contract';
import { formatCurrency } from '../utils/numberToWordsCs';
import { getStoredPriceList } from '../utils/storage';
import { triggerHaptic } from '../utils/haptics';
import { isSamplePriceItem } from '../data/defaultPriceList';

export type EstimateForContract = { description: string; items: Omit<BudgetItem, 'id'>[] };

interface QuickEstimateCalculatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyToContract: (estimate: EstimateForContract) => void;
  onOpenPriceList?: () => void;
  onToast: (type: 'success' | 'error' | 'info', message: string) => void;
}

interface Row {
  key: string;
  item: PriceListTemplateItem;
  quantity: number | '';
}

const RESERVE_TITLE = 'Rezerva na prořez materiálu (10 %)';

/** Kalkulačka na obhlídce: odhad z položek a cen uživatelova ceníku (nic se nedomýšlí). */
export const QuickEstimateCalculatorModal: React.FC<QuickEstimateCalculatorModalProps> = ({
  isOpen,
  onClose,
  onApplyToContract,
  onOpenPriceList,
  onToast,
}) => {
  const [priceList] = useState<PriceListTemplateItem[]>(() => getStoredPriceList());
  const categories = useMemo(() => Array.from(new Set(priceList.map((i) => i.category).filter(Boolean))), [priceList]);
  const [category, setCategory] = useState<string>(() => categories[0] || '');
  const [rows, setRows] = useState<Row[]>([]);
  const [includeReserve, setIncludeReserve] = useState(false);
  const [copied, setCopied] = useState(false);

  const lines = rows
    .map((r) => {
      const qty = typeof r.quantity === 'number' && r.quantity > 0 ? r.quantity : 0;
      return { ...r, qty, total: Math.round(qty * (r.item.unitPrice || 0)) };
    })
    .filter((l) => l.qty > 0);
  const sumOf = (types: PriceListTemplateItem['type'][]) =>
    lines.filter((l) => types.includes(l.item.type)).reduce((sum, l) => sum + l.total, 0);
  const labor = sumOf(['prace', 'ostatni']);
  const material = sumOf(['material']);
  const reserve = includeReserve ? Math.round(material * 0.1) : 0;
  const total = labor + material + reserve;
  const hasEstimate = total > 0;
  // Položky odhadu, které mají pořád ukázkovou cenu z výchozího ceníku (ne cenu uživatele)
  const sampleCount = new Set(lines.filter((l) => isSamplePriceItem(l.item)).map((l) => l.item.id)).size;

  if (!isOpen) return null;

  const visibleItems = priceList.filter((i) => i.category === category);
  const addItem = (item: PriceListTemplateItem) => {
    triggerHaptic('light');
    setRows((prev) => [...prev, { key: `${item.id}_${Date.now()}`, item, quantity: '' }]);
    // Fokus na množství nově přidané položky
    setTimeout(() => {
      const inputs = document.querySelectorAll<HTMLInputElement>('[data-odhad-mnozstvi]');
      inputs[inputs.length - 1]?.focus();
    }, 0);
  };

  const estimateText = [
    'Dobrý den, posílám orientační odhad ceny:',
    ...lines.map((l) => `• ${l.item.title}: ${l.qty} ${l.item.unit} – ${formatCurrency(l.total)}`),
    ...(reserve > 0 ? [`• ${RESERVE_TITLE}: ${formatCurrency(reserve)}`] : []),
    `Celkem orientačně: ${formatCurrency(total)}`,
    'Přesnou cenovou nabídku vám rád připravím.',
  ].join('\n');

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(estimateText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      onToast('success', 'Odhad je zkopírovaný – vložte ho do zprávy zákazníkovi.');
    } catch {
      onToast('error', 'Odhad se nepodařilo zkopírovat.');
    }
  };

  const handleApply = () => {
    triggerHaptic('success');
    const items: Omit<BudgetItem, 'id'>[] = lines.map((l) => ({
      type: l.item.type,
      title: l.item.title,
      quantity: l.qty,
      unit: l.item.unit,
      unitPrice: l.item.unitPrice,
      totalPrice: l.total,
    }));
    if (reserve > 0) items.push({ type: 'material', title: RESERVE_TITLE, quantity: 1, unit: 'kpl', unitPrice: reserve, totalPrice: reserve });
    onApplyToContract({ description: lines.map((l) => l.item.title).join(', '), items });
    onClose();
  };

  const chip = (on: boolean) =>
    `min-h-11 px-3 inline-flex items-center rounded-md border font-medium cursor-pointer transition-colors ${
      on
        ? 'border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-900'
        : 'border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800'
    }`;
  const outline =
    'min-h-11 px-4 inline-flex items-center justify-center gap-2 rounded-md border-[1.5px] border-slate-900 dark:border-slate-500 text-slate-900 dark:text-slate-100 font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed';
  const box = 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md';

  return (
    <Dialog title="Kalkulačka na obhlídce" subtitle="Rychlý odhad ceny z vašeho ceníku." size="xl" closeOnBackdrop={false} onClose={onClose}>
      <div className="space-y-5 text-[15px]">
        {priceList.length === 0 ? (
          <p className={`${box} px-5 py-5 text-slate-700 dark:text-slate-300`}>
            Ceník je prázdný. Doplňte do něj své ceny práce a materiálu a kalkulačka z nich bude počítat.
          </p>
        ) : (
          <>
            {/* Výběr položek z ceníku */}
            <div className="space-y-2.5">
              <div className="font-semibold text-slate-900 dark:text-slate-100">Druh práce</div>
              <div role="group" aria-label="Druh práce" className="flex flex-wrap gap-2">
                {categories.map((c) => (
                  <button key={c} type="button" aria-pressed={category === c} onClick={() => setCategory(c)} className={chip(category === c)}>
                    {c}
                  </button>
                ))}
              </div>
              <ul aria-label={`Položky ceníku: ${category}`} className={`${box} divide-y divide-slate-100 dark:divide-slate-800`}>
                {visibleItems.map((item) => (
                  <li key={item.id} className="pl-4 pr-2 py-1.5 flex items-center gap-3">
                    <div className="flex-1 min-w-0 py-1">
                      <div className="text-slate-900 dark:text-white">{item.title}</div>
                      <div className="text-slate-600 dark:text-slate-400 tabular-nums">
                        {formatCurrency(item.unitPrice)} / {item.unit}
                        {item.type === 'material' ? ' · materiál' : ''}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => addItem(item)}
                      aria-label={`Přidat do odhadu: ${item.title}`}
                      className="min-h-11 min-w-11 inline-flex items-center justify-center gap-1.5 px-3 rounded-md text-blue-600 dark:text-blue-300 font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                    >
                      <Plus className="w-[18px] h-[18px]" />
                      <span className="hidden sm:inline">Přidat</span>
                    </button>
                  </li>
                ))}
              </ul>
              {onOpenPriceList && (
                <button
                  type="button"
                  onClick={onOpenPriceList}
                  className="min-h-11 inline-flex items-center text-blue-600 dark:text-blue-300 font-medium underline underline-offset-2 cursor-pointer"
                >
                  Upravit ceník
                </button>
              )}
            </div>

            {/* Odhad */}
            <section aria-labelledby="odhad-nadpis" className="space-y-2.5">
              <h3 id="odhad-nadpis" className="font-display font-semibold text-xl text-slate-900 dark:text-white">
                Odhad
              </h3>
              {rows.length === 0 ? (
                <p className={`${box} px-5 py-4 text-slate-600 dark:text-slate-400`}>Přidejte položky z ceníku a zadejte množství.</p>
              ) : (
                <ul className={`${box} divide-y divide-slate-100 dark:divide-slate-800`}>
                  {rows.map((r) => {
                    const qty = typeof r.quantity === 'number' && r.quantity > 0 ? r.quantity : 0;
                    const inputId = `odhad-${r.key}`;
                    return (
                      <li key={r.key} className="px-4 py-3 flex flex-wrap items-center gap-x-3 gap-y-2">
                        <label htmlFor={inputId} className="flex-1 min-w-[12rem] text-slate-900 dark:text-white">
                          {r.item.title}
                          <span className="block text-slate-600 dark:text-slate-400 tabular-nums">
                            {formatCurrency(r.item.unitPrice)} / {r.item.unit}
                          </span>
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            id={inputId}
                            data-odhad-mnozstvi
                            type="number"
                            inputMode="decimal"
                            min="0"
                            step="any"
                            value={r.quantity}
                            onChange={(e) =>
                              setRows((prev) =>
                                prev.map((x) => (x.key === r.key ? { ...x, quantity: e.target.value === '' ? '' : Number(e.target.value) } : x))
                              )
                            }
                            placeholder="množství"
                            className="min-h-11 w-28 px-3 rounded-md border-[1.5px] border-slate-900 dark:border-slate-500 bg-white dark:bg-slate-950 text-slate-900 dark:text-white tabular-nums"
                          />
                          <span className="w-8 text-slate-600 dark:text-slate-400">{r.item.unit}</span>
                          <span className="w-24 text-right font-semibold tabular-nums text-slate-900 dark:text-white">
                            {qty > 0 ? formatCurrency(Math.round(qty * r.item.unitPrice)) : '–'}
                          </span>
                          <button
                            type="button"
                            onClick={() => setRows((prev) => prev.filter((x) => x.key !== r.key))}
                            aria-label={`Odebrat z odhadu: ${r.item.title}`}
                            className="min-h-11 min-w-11 -mr-2 inline-flex items-center justify-center rounded-md text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
              {material > 0 && (
                <label className="min-h-11 flex items-center gap-2.5 text-slate-900 dark:text-slate-100 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={includeReserve}
                    onChange={(e) => setIncludeReserve(e.target.checked)}
                    className="w-5 h-5 shrink-0 accent-slate-900 dark:accent-white"
                  />
                  Přidat 10 % k materiálu na prořez
                </label>
              )}
            </section>

            {/* Výsledek: bílý rámeček s velkým číslem (vzor Přehledu) */}
            <div className={`${box} divide-y divide-slate-100 dark:divide-slate-800`} aria-live="polite">
              <div className="px-5 py-4">
                <div className="text-slate-600 dark:text-slate-400">Orientační cena</div>
                <div className="font-display font-bold text-[40px] leading-none tabular-nums mt-1 text-slate-900 dark:text-white">
                  {hasEstimate ? formatCurrency(total) : '–'}
                </div>
              </div>
              {hasEstimate && (
                <>
                  <div className="px-5 py-3 flex items-baseline justify-between gap-4">
                    <span className="text-slate-600 dark:text-slate-400">Práce</span>
                    <span className="font-display font-semibold text-xl tabular-nums text-slate-900 dark:text-white">{formatCurrency(labor)}</span>
                  </div>
                  {material > 0 && (
                    <div className="px-5 py-3 flex items-baseline justify-between gap-4">
                      <span className="text-slate-600 dark:text-slate-400">Materiál{reserve > 0 ? ' včetně rezervy' : ''}</span>
                      <span className="font-display font-semibold text-xl tabular-nums text-slate-900 dark:text-white">{formatCurrency(material + reserve)}</span>
                    </div>
                  )}
                </>
              )}
            </div>
            {hasEstimate && sampleCount > 0 && (
              <p className="px-4 py-3 border-l-[3px] border-blue-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200">
                {sampleCount === 1 ? '1 položka má' : `${sampleCount} ${sampleCount <= 4 ? 'položky mají' : 'položek má'}`} ukázkovou cenu z aplikace, ne
                vaši.{' '}
                {onOpenPriceList && (
                  <button
                    type="button"
                    onClick={onOpenPriceList}
                    className="min-h-11 inline-flex items-center text-blue-600 dark:text-blue-300 font-medium underline underline-offset-2 cursor-pointer"
                  >
                    Upravit ceník
                  </button>
                )}
              </p>
            )}

            <div className="flex flex-wrap gap-2.5">
              <button
                type="button"
                onClick={handleApply}
                disabled={!hasEstimate}
                className="min-h-11 px-5 inline-flex items-center justify-center gap-2 rounded-md border-[1.5px] border-slate-900 bg-amber-400 hover:bg-amber-300 text-slate-900 font-semibold cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ArrowRight className="w-[18px] h-[18px]" />
                Převést do smlouvy
              </button>
              <button type="button" onClick={handleCopy} disabled={!hasEstimate} className={outline}>
                {copied ? <Check className="w-[18px] h-[18px]" /> : <Copy className="w-[18px] h-[18px]" />}
                {copied ? 'Zkopírováno' : 'Zkopírovat do zprávy'}
              </button>
            </div>
          </>
        )}
      </div>
    </Dialog>
  );
};
