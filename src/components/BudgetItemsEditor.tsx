import React, { useState } from 'react';
import { Plus, Trash2, Copy, ChevronDown, ChevronUp, BookOpen } from 'lucide-react';
import { BudgetItem } from '../types/contract';
import { formatCurrency } from '../utils/numberToWordsCs';
import { PriceListModal } from './PriceListModal';

interface BudgetItemsEditorProps {
  items: BudgetItem[];
  onChange: (items: BudgetItem[]) => void;
  pricingType: 'fixed' | 'budget';
  onPricingTypeChange: (type: 'fixed' | 'budget') => void;
  fixedPrice: number | '';
  onFixedPriceChange: (val: number | '') => void;
  hasVat?: boolean;
  onToast?: (type: 'success' | 'error' | 'info', text: string) => void;
}

const COMMON_UNITS = [
  { val: 'hod', label: 'hod (hodin)' },
  { val: 'm²', label: 'm² (metrů čtv.)' },
  { val: 'ks', label: 'ks (kusů)' },
  { val: 'bm', label: 'bm (běžných m)' },
  { val: 'kpl', label: 'kpl (komplet)' },
  { val: 'den', label: 'den (dní)' },
  { val: 'bal', label: 'bal (balení)' },
];

const fieldLabel = 'block font-semibold text-slate-900 dark:text-slate-100 mb-1.5';
const cell =
  'min-h-11 px-2.5 rounded-md border border-slate-400 dark:border-slate-600 bg-white dark:bg-slate-950 text-slate-900 dark:text-white';
const iconButton =
  'w-11 h-11 shrink-0 inline-flex items-center justify-center rounded-md text-slate-900 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors';
const smallAction =
  'min-h-11 px-3 inline-flex items-center justify-center gap-1.5 rounded-md border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-medium hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors';
const chip = (active: boolean) =>
  `min-h-11 px-3 inline-flex items-center justify-center rounded-md border font-medium cursor-pointer transition-colors ${
    active
      ? 'border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-900'
      : 'border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800'
  }`;

export const BudgetItemsEditor: React.FC<BudgetItemsEditorProps> = ({
  items,
  onChange,
  pricingType,
  onPricingTypeChange,
  fixedPrice,
  onFixedPriceChange,
  hasVat = false,
  onToast,
}) => {
  const [isPriceListOpen, setIsPriceListOpen] = useState(false);
  const [marginPercent, setMarginPercent] = useState<number>(0);
  const [marginScope, setMarginScope] = useState<'all' | 'material'>('all');
  const [isMarginOpen, setIsMarginOpen] = useState(false);

  const handleAddFromPriceList = (newItems: BudgetItem[]) => {
    onChange([...items, ...newItems]);
  };

  const handleApplyMarginToItems = () => {
    if (marginPercent <= 0 || items.length === 0) return;
    const factor = 1 + marginPercent / 100;
    const updated = items.map((it) => {
      if (marginScope === 'material' && it.type !== 'material') return it;
      const newUnitPrice = Math.round(it.unitPrice * factor);
      const q = typeof it.quantity === 'number' ? it.quantity : 1;
      return {
        ...it,
        unitPrice: newUnitPrice,
        totalPrice: Math.round(newUnitPrice * q),
      };
    });
    onChange(updated);
    setMarginPercent(0);
    onToast?.('success', `Přirážka ${marginPercent} % je započtená do jednotkových cen.`);
  };

  const handleAddMarginAsRow = () => {
    const targetBase = marginScope === 'material' ? totalMaterial : totalBudget;
    const amount = Math.round((targetBase * marginPercent) / 100);
    if (marginPercent <= 0 || amount <= 0) return;
    const title = marginScope === 'material'
      ? `Materiálová přirážka a manipulace (+${marginPercent} %)`
      : `Režie zakázky a rezerva (+${marginPercent} %)`;
    const newItem: BudgetItem = {
      id: `item_margin_${Date.now()}`,
      type: 'ostatni',
      title,
      quantity: 1,
      unit: 'kpl',
      unitPrice: amount,
      totalPrice: amount,
    };
    onChange([...items, newItem]);
    setMarginPercent(0);
    onToast?.('success', `Vložena položka „${title}“ (${formatCurrency(amount)}).`);
  };

  const handleAddItem = (type: 'prace' | 'material' | 'ostatni' = 'prace') => {
    const newItem: BudgetItem = {
      id: `item_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      type,
      title: type === 'prace' ? 'Montážní práce' : type === 'material' ? 'Materiál' : 'Doprava a přesun hmot',
      quantity: 1,
      unit: type === 'prace' ? 'hod' : type === 'material' ? 'ks' : 'kpl',
      unitPrice: 0,
      totalPrice: 0,
    };
    const updated = [...items, newItem];
    onChange(updated);
  };

  const handleDuplicateItem = (id: string) => {
    const targetIdx = items.findIndex((it) => it.id === id);
    if (targetIdx === -1) return;
    const source = items[targetIdx];
    const clone: BudgetItem = {
      ...source,
      id: `item_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      title: `${source.title} (kopie)`,
    };
    const next = [...items];
    next.splice(targetIdx + 1, 0, clone);
    onChange(next);
    onToast?.('info', `Položka „${source.title}“ je zkopírovaná.`);
  };

  const handleUpdateItem = (id: string, patch: Partial<BudgetItem>) => {
    const updated = items.map((it) => {
      if (it.id !== id) return it;
      const next = { ...it, ...patch };
      const q = typeof next.quantity === 'number' && !isNaN(next.quantity) ? next.quantity : 0;
      const p = typeof next.unitPrice === 'number' && !isNaN(next.unitPrice) ? next.unitPrice : 0;
      next.totalPrice = Math.round(q * p);
      return next;
    });
    onChange(updated);
  };

  const handleRemoveItem = (id: string) => {
    onChange(items.filter((it) => it.id !== id));
  };

  // Calculations
  const totalWork = items
    .filter((it) => it.type === 'prace')
    .reduce((sum, it) => sum + (it.totalPrice || 0), 0);

  const totalMaterial = items
    .filter((it) => it.type === 'material')
    .reduce((sum, it) => sum + (it.totalPrice || 0), 0);

  const totalOther = items
    .filter((it) => it.type === 'ostatni')
    .reduce((sum, it) => sum + (it.totalPrice || 0), 0);

  const totalBudget = totalWork + totalMaterial + totalOther;

  const marginBase = marginScope === 'material' ? totalMaterial : totalBudget;
  const marginAmount = Math.round((marginBase * marginPercent) / 100);
  const parts = [
    totalWork > 0 ? `práce ${formatCurrency(totalWork)}` : '',
    totalMaterial > 0 ? `materiál ${formatCurrency(totalMaterial)}` : '',
    totalOther > 0 ? `ostatní ${formatCurrency(totalOther)}` : '',
  ].filter(Boolean);

  return (
    <div className="space-y-4">
      {/* Pevná cena, nebo rozpočet */}
      <div>
        <div className={fieldLabel}>Jak určíte cenu</div>
        <div role="group" aria-label="Jak určíte cenu" className="flex flex-wrap gap-2">
          <button type="button" aria-pressed={pricingType === 'fixed'} onClick={() => onPricingTypeChange('fixed')} className={chip(pricingType === 'fixed')}>
            Pevná cena
          </button>
          <button
            type="button"
            aria-pressed={pricingType === 'budget'}
            onClick={() => {
              onPricingTypeChange('budget');
              if (items.length === 0) {
                // První položka převezme dosud zadanou pevnou cenu
                const currentP = typeof fixedPrice === 'number' && fixedPrice > 0 ? fixedPrice : 0;
                onChange([
                  {
                    id: `item_${Date.now()}_1`,
                    type: 'prace',
                    title: 'Provedení sjednaných prací',
                    quantity: 1,
                    unit: 'kpl',
                    unitPrice: currentP,
                    totalPrice: currentP,
                  },
                ]);
              }
            }}
            className={chip(pricingType === 'budget')}
          >
            Položkový rozpočet
          </button>
        </div>
      </div>

      {pricingType === 'budget' ? (
        <div className="space-y-3">
          <div className="border border-slate-300 dark:border-slate-700 rounded-md divide-y divide-slate-200 dark:divide-slate-800">
            {items.length === 0 && (
              <div className="px-4 py-4 text-slate-600 dark:text-slate-400">Rozpočet zatím nemá žádnou položku.</div>
            )}
            {items.map((it, idx) => (
              <div key={it.id} className="p-3 space-y-2">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={it.title}
                    onChange={(e) => handleUpdateItem(it.id, { title: e.target.value })}
                    placeholder="Název položky"
                    aria-label={`Název položky ${idx + 1}`}
                    className={`${cell} flex-1 min-w-0`}
                  />
                  <select
                    value={it.type}
                    onChange={(e) => handleUpdateItem(it.id, { type: e.target.value as 'prace' | 'material' | 'ostatni' })}
                    aria-label={`Druh položky ${idx + 1}`}
                    className={`${cell} shrink-0 cursor-pointer`}
                  >
                    <option value="prace">Práce</option>
                    <option value="material">Materiál</option>
                    <option value="ostatni">Ostatní</option>
                  </select>
                </div>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-2">
                  <input
                    type="number"
                    min="0"
                    step="any"
                    inputMode="decimal"
                    value={it.quantity === 0 ? '' : it.quantity}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      handleUpdateItem(it.id, { quantity: isNaN(v) ? 0 : v });
                    }}
                    placeholder="1"
                    aria-label={`Množství položky ${idx + 1}`}
                    className={`${cell} w-16 sm:w-20 text-right tabular-nums`}
                  />
                  <select
                    value={it.unit}
                    onChange={(e) => handleUpdateItem(it.id, { unit: e.target.value })}
                    aria-label={`Jednotka položky ${idx + 1}`}
                    className={`${cell} cursor-pointer`}
                  >
                    {COMMON_UNITS.map((u) => (
                      <option key={u.val} value={u.val}>
                        {u.val}
                      </option>
                    ))}
                  </select>
                  <span className="text-slate-600 dark:text-slate-400" aria-hidden="true">
                    ×
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    inputMode="numeric"
                    value={it.unitPrice === 0 ? '' : it.unitPrice}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      handleUpdateItem(it.id, { unitPrice: isNaN(v) ? 0 : v });
                    }}
                    placeholder="0"
                    aria-label={`Cena za jednotku položky ${idx + 1} v Kč`}
                    className={`${cell} w-[5.5rem] sm:w-28 text-right tabular-nums`}
                  />
                  <span className="text-slate-600 dark:text-slate-400">Kč</span>
                  <div className="ml-auto flex items-center gap-1">
                    <span className="font-display font-semibold tabular-nums text-[19px] text-slate-900 dark:text-white whitespace-nowrap mr-1">
                      {formatCurrency(it.totalPrice)}
                    </span>
                    <button type="button" onClick={() => handleDuplicateItem(it.id)} aria-label={`Zkopírovat položku ${it.title}`} title="Zkopírovat položku" className={iconButton}>
                      <Copy className="w-4 h-4" />
                    </button>
                    <button type="button" onClick={() => handleRemoveItem(it.id)} aria-label={`Smazat položku ${it.title}`} title="Smazat položku" className={iconButton}>
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}

            <div className="p-3 flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => setIsPriceListOpen(true)} className={`${smallAction} !border-slate-900 dark:!border-slate-400 font-semibold`}>
                <BookOpen className="w-4 h-4" />
                <span>Vybrat z ceníku</span>
              </button>
              <button type="button" onClick={() => handleAddItem('prace')} className={smallAction}>
                <Plus className="w-4 h-4" />
                <span>Práce</span>
              </button>
              <button type="button" onClick={() => handleAddItem('material')} className={smallAction}>
                <Plus className="w-4 h-4" />
                <span>Materiál</span>
              </button>
              <button type="button" onClick={() => handleAddItem('ostatni')} className={smallAction}>
                <Plus className="w-4 h-4" />
                <span>Doprava</span>
              </button>
            </div>
          </div>

          {parts.length > 1 && <p className="text-slate-600 dark:text-slate-400">Z toho {parts.join(', ')}.</p>}

          {/* Přirážka a rezerva */}
          <div className="border border-slate-300 dark:border-slate-700 rounded-md">
            <button
              type="button"
              onClick={() => setIsMarginOpen(!isMarginOpen)}
              aria-expanded={isMarginOpen}
              className="w-full min-h-11 px-3 flex items-center justify-between gap-3 text-left cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors"
            >
              <span className="font-semibold text-slate-900 dark:text-slate-100">
                Přirážka a rezerva{marginPercent > 0 ? `: ${marginPercent} %` : ''}
              </span>
              {isMarginOpen ? <ChevronUp className="w-4 h-4 shrink-0" /> : <ChevronDown className="w-4 h-4 shrink-0" />}
            </button>

            {isMarginOpen && (
              <div className="p-3 border-t border-slate-200 dark:border-slate-800 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  {[10, 15, 20, 25, 30].map((pct) => (
                    <button
                      key={pct}
                      type="button"
                      aria-pressed={marginPercent === pct}
                      onClick={() => setMarginPercent(marginPercent === pct ? 0 : pct)}
                      className={chip(marginPercent === pct)}
                    >
                      {pct} %
                    </button>
                  ))}
                </div>
                <div role="group" aria-label="Z čeho se přirážka počítá" className="flex flex-wrap items-center gap-2">
                  <button type="button" aria-pressed={marginScope === 'all'} onClick={() => setMarginScope('all')} className={chip(marginScope === 'all')}>
                    Z celého rozpočtu
                  </button>
                  <button type="button" aria-pressed={marginScope === 'material'} onClick={() => setMarginScope('material')} className={chip(marginScope === 'material')}>
                    Jen z materiálu
                  </button>
                </div>

                {marginPercent > 0 ? (
                  <>
                    <p className="text-slate-900 dark:text-slate-100">
                      {marginPercent} % z {formatCurrency(marginBase)} je{' '}
                      <span className="font-semibold">{formatCurrency(marginAmount)}</span>. Cena díla pak bude{' '}
                      <span className="font-semibold">{formatCurrency(totalBudget + marginAmount)}</span>.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={handleApplyMarginToItems} className={`${smallAction} !border-slate-900 dark:!border-slate-400 font-semibold`}>
                        Započítat do cen položek
                      </button>
                      <button type="button" onClick={handleAddMarginAsRow} className={smallAction}>
                        Přidat jako samostatnou položku
                      </button>
                    </div>
                    <p className="text-[13px] text-slate-600 dark:text-slate-400">
                      Při započtení do cen zákazník přirážku v rozpočtu neuvidí, samostatná položka je v něm vidět.
                    </p>
                  </>
                ) : (
                  <p className="text-slate-600 dark:text-slate-400">Vyberte, kolik procent chcete k rozpočtu přičíst.</p>
                )}
              </div>
            )}
          </div>

          {isPriceListOpen && (
            <PriceListModal
              isOpen={isPriceListOpen}
              onClose={() => setIsPriceListOpen(false)}
              onSelectItems={handleAddFromPriceList}
              onToast={onToast}
            />
          )}
        </div>
      ) : null}
    </div>
  );
};
