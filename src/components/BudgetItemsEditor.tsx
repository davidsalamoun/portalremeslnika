import React, { useState } from 'react';
import { Plus, Trash2, Calculator, Wrench, Package, Truck, Copy, TrendingUp, Percent, ChevronDown, ChevronUp, BookOpen } from 'lucide-react';
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
    onToast?.('success', `Přirážka +${marginPercent} % byla rozpuštěna do jednotkových cen položek.`);
  };

  const handleAddMarginAsRow = () => {
    const targetBase = marginScope === 'material' ? totalMaterial : totalBudget;
    const amount = Math.round((targetBase * marginPercent) / 100);
    if (marginPercent <= 0 || amount <= 0) return;
    const title = marginScope === 'material'
      ? `Materiálová přirážka & manipulace (+${marginPercent} %)`
      : `Režie zakázky & technologická rezerva (+${marginPercent} %)`;
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
    onToast?.('info', `Položka „${source.title}“ byla duplikována`);
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

  return (
    <div className="space-y-4">
      {/* Selector: Fixed price vs Itemized budget */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
        <div>
          <span className="text-sm font-semibold text-slate-800 dark:text-slate-200 block">
            Způsob stanovení ceny
          </span>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Zvolte, zda chcete uvést pevnou paušální částku, nebo detailní položkový rozpočet
          </span>
        </div>
        <div className="inline-flex rounded-lg p-1 bg-slate-200/90 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => onPricingTypeChange('fixed')}
            className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${
              pricingType === 'fixed'
                ? 'bg-slate-900 text-white shadow-xs dark:bg-blue-600'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            Pevná cena (paušál)
          </button>
          <button
            type="button"
            onClick={() => {
              onPricingTypeChange('budget');
              if (items.length === 0) {
                // Pre-seed an initial item with the current fixed price if any
                const currentP = typeof fixedPrice === 'number' && fixedPrice > 0 ? fixedPrice : 15000;
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
            className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all flex items-center gap-1.5 ${
              pricingType === 'budget'
                ? 'bg-slate-900 text-white shadow-xs dark:bg-blue-600'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Calculator className="w-3.5 h-3.5" />
            <span>Položkový rozpočet</span>
          </button>
        </div>
      </div>

      {pricingType === 'budget' ? (
        <div className="space-y-3">
          {/* Item list */}
          <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden bg-white dark:bg-slate-900 shadow-sm">
            <div className="hidden sm:grid sm:grid-cols-12 gap-2 px-3 py-2 bg-slate-100/80 dark:bg-slate-800 text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              <span className="col-span-1">Typ</span>
              <span className="col-span-5">Položka (název / popis)</span>
              <span className="col-span-2 text-right">Množství & Jedn.</span>
              <span className="col-span-2 text-right">Cena / jedn.</span>
              <span className="col-span-2 text-right">Celkem</span>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {items.length === 0 ? (
                <div className="p-6 text-center text-slate-400 dark:text-slate-500 text-sm">
                  Zatím jste nepřidali žádné položky rozpočtu.
                </div>
              ) : (
                items.map((it, idx) => (
                  <div
                    key={it.id}
                    className="p-3 sm:p-2 sm:grid sm:grid-cols-12 gap-2 items-center hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    {/* Typ */}
                    <div className="sm:col-span-1 flex items-center justify-between sm:justify-start mb-2 sm:mb-0">
                      <select
                        value={it.type}
                        onChange={(e) =>
                          handleUpdateItem(it.id, {
                            type: e.target.value as 'prace' | 'material' | 'ostatni',
                          })
                        }
                        className="text-xs font-medium py-1 px-1.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        <option value="prace">Práce</option>
                        <option value="material">Materiál</option>
                        <option value="ostatni">Ostatní</option>
                      </select>

                      {/* Mobile actions: duplicate & delete */}
                      <div className="flex items-center gap-1 sm:hidden">
                        <button
                          type="button"
                          onClick={() => handleDuplicateItem(it.id)}
                          className="p-1 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                          title="Duplikovat položku"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(it.id)}
                          className="p-1 text-red-500 hover:text-red-700 transition-colors"
                          title="Smazat položku"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Název položky */}
                    <div className="sm:col-span-5 mb-2 sm:mb-0">
                      <input
                        type="text"
                        value={it.title}
                        onChange={(e) => handleUpdateItem(it.id, { title: e.target.value })}
                        placeholder="Popis položky..."
                        className="w-full text-xs py-1.5 px-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>

                    {/* Množství + Jednotka */}
                    <div className="sm:col-span-2 flex items-center gap-1.5 mb-2 sm:mb-0">
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={it.quantity === 0 ? '' : it.quantity}
                        onChange={(e) => {
                          const v = parseFloat(e.target.value);
                          handleUpdateItem(it.id, { quantity: isNaN(v) ? 0 : v });
                        }}
                        placeholder="1"
                        className="w-16 text-xs text-right py-1.5 px-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                      <select
                        value={it.unit}
                        onChange={(e) => handleUpdateItem(it.id, { unit: e.target.value })}
                        className="text-xs py-1.5 px-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        {COMMON_UNITS.map((u) => (
                          <option key={u.val} value={u.val}>
                            {u.val}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Jednotková cena */}
                    <div className="sm:col-span-2 flex items-center justify-between sm:justify-end gap-1 mb-2 sm:mb-0">
                      <span className="text-xs text-slate-500 sm:hidden">Cena / jedn:</span>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={it.unitPrice === 0 ? '' : it.unitPrice}
                          onChange={(e) => {
                            const v = parseFloat(e.target.value);
                            handleUpdateItem(it.id, { unitPrice: isNaN(v) ? 0 : v });
                          }}
                          placeholder="0"
                          className="w-20 text-xs text-right py-1.5 px-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                        <span className="text-xs text-slate-500">Kč</span>
                      </div>
                    </div>

                    {/* Celkem + Actions (Duplicate & Delete) */}
                    <div className="sm:col-span-2 flex items-center justify-between sm:justify-end gap-1.5">
                      <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        {formatCurrency(it.totalPrice)}
                      </div>
                      <div className="hidden sm:flex items-center gap-0.5">
                        <button
                          type="button"
                          onClick={() => handleDuplicateItem(it.id)}
                          className="p-1 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer"
                          title="Duplikovat položku"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(it.id)}
                          className="p-1 text-slate-400 hover:text-red-500 dark:hover:text-red-400 transition-colors cursor-pointer"
                          title="Smazat položku"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Quick add action bar */}
            <div className="p-3 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsPriceListOpen(true)}
                  className="px-3 py-1.5 text-xs font-black rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 shadow-xs inline-flex items-center gap-1.5 transition-all cursor-pointer"
                  title="Otevřít katalog položek a ceník řemeslníka"
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>Katalog ceníku</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleAddItem('prace')}
                  className="px-2.5 py-1.5 text-xs font-bold rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Wrench className="w-3.5 h-3.5 text-blue-600" />
                  <span>+ Práce</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleAddItem('material')}
                  className="px-2.5 py-1.5 text-xs font-bold rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Package className="w-3.5 h-3.5 text-emerald-600" />
                  <span>+ Materiál</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleAddItem('ostatni')}
                  className="px-2.5 py-1.5 text-xs font-bold rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Truck className="w-3.5 h-3.5 text-amber-600" />
                  <span>+ Doprava</span>
                </button>
              </div>

              {/* Řemeslnická kalkulační rekapitulace zakázky */}
              <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs font-mono">
                {totalWork > 0 && (
                  <div className="px-2.5 py-1 rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                    <span className="text-slate-400 text-[10px] uppercase block font-sans font-bold">Práce</span>
                    <strong className="text-slate-900 dark:text-slate-100 tabular-nums">{formatCurrency(totalWork)}</strong>
                  </div>
                )}
                {totalMaterial > 0 && (
                  <div className="px-2.5 py-1 rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                    <span className="text-slate-400 text-[10px] uppercase block font-sans font-bold">Materiál</span>
                    <strong className="text-slate-900 dark:text-slate-100 tabular-nums">{formatCurrency(totalMaterial)}</strong>
                  </div>
                )}
                {totalOther > 0 && (
                  <div className="px-2.5 py-1 rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                    <span className="text-slate-400 text-[10px] uppercase block font-sans font-bold">Ostatní</span>
                    <strong className="text-slate-900 dark:text-slate-100 tabular-nums">{formatCurrency(totalOther)}</strong>
                  </div>
                )}
                <div className="px-3 py-1.5 bg-slate-900 dark:bg-blue-600 text-white rounded-lg font-bold text-xs shadow-xs font-sans flex flex-col justify-center">
                  <span className="text-[9px] uppercase tracking-wider text-slate-300 dark:text-blue-100 font-semibold leading-none">Celkem rozpočet</span>
                  <span className="text-sm font-mono font-bold leading-tight tabular-nums">{formatCurrency(totalBudget)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Marže & Zisková rezerva díla (Zisk živnostníka) */}
          <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 space-y-3">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setIsMarginOpen(!isMarginOpen)}
                className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 hover:text-amber-600 transition-colors cursor-pointer"
              >
                <TrendingUp className="w-4 h-4 text-amber-500" />
                <span>Nastavení marže & zisku živnostníka</span>
                {marginPercent > 0 && (
                  <span className="px-1.5 py-0.2 rounded bg-amber-400 text-slate-950 text-[10px] font-mono font-bold">
                    +{marginPercent} %
                  </span>
                )}
                {isMarginOpen ? <ChevronUp className="w-3.5 h-3.5 text-slate-400" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />}
              </button>

              <span className="text-[11px] font-mono text-slate-400 hidden sm:inline">
                Přirážka k nákupu materiálu / zisková rezerva
              </span>
            </div>

            {isMarginOpen && (
              <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-3 animate-in fade-in duration-150">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  {/* Preset Buttons */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-slate-600 dark:text-slate-300">Marže:</span>
                    {[0, 10, 15, 20, 25, 30].map((pct) => (
                      <button
                        key={pct}
                        type="button"
                        onClick={() => setMarginPercent(pct)}
                        className={`px-2.5 py-1 text-xs font-mono font-bold rounded-md transition-all cursor-pointer ${
                          marginPercent === pct
                            ? 'bg-amber-500 text-slate-950 shadow-xs'
                            : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                      >
                        {pct === 0 ? '0 % (bez přirážky)' : `+${pct} %`}
                      </button>
                    ))}
                  </div>

                  {/* Scope Selector */}
                  <div className="inline-flex rounded-lg p-0.5 bg-slate-200 dark:bg-slate-800 text-[11px] font-semibold">
                    <button
                      type="button"
                      onClick={() => setMarginScope('all')}
                      className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                        marginScope === 'all'
                          ? 'bg-slate-900 text-white dark:bg-blue-600 shadow-xs'
                          : 'text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      Celý rozpočet
                    </button>
                    <button
                      type="button"
                      onClick={() => setMarginScope('material')}
                      className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                        marginScope === 'material'
                          ? 'bg-slate-900 text-white dark:bg-blue-600 shadow-xs'
                          : 'text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      Jen materiál ({formatCurrency(totalMaterial)})
                    </button>
                  </div>
                </div>

                {marginPercent > 0 && (
                  <div className="p-3 rounded-lg bg-slate-900 dark:bg-slate-950 text-white border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-mono">
                    <div className="space-y-0.5">
                      <div className="text-slate-400">
                        Základ ({marginScope === 'material' ? 'materiál' : 'celkem'}): <strong>{formatCurrency(marginScope === 'material' ? totalMaterial : totalBudget)}</strong>
                      </div>
                      <div className="text-amber-400 font-bold">
                        Váš čistý zisk / rezerva díla (+{marginPercent} %): +{formatCurrency(Math.round(((marginScope === 'material' ? totalMaterial : totalBudget) * marginPercent) / 100))}
                      </div>
                      <div className="text-white font-extrabold text-sm">
                        Koncová cena zakázky: {formatCurrency(totalBudget + Math.round(((marginScope === 'material' ? totalMaterial : totalBudget) * marginPercent) / 100))}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={handleApplyMarginToItems}
                        className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-sans font-black text-xs shadow-xs cursor-pointer active:scale-95 transition-all"
                        title="Přepočte a navýší jednotkové ceny všech položek. Klient uvidí čisté jednotkové ceny bez zmínky o marži."
                      >
                        Rozpustit do cen položek
                      </button>
                      <button
                        type="button"
                        onClick={handleAddMarginAsRow}
                        className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-sans font-bold text-xs border border-slate-700 cursor-pointer transition-all"
                        title="Vloží do rozpočtu samostatný řádek s technologickou rezervou a režií."
                      >
                        + Přidat řádek rozpočtu
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Modal pro výběr z ceníku */}
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
