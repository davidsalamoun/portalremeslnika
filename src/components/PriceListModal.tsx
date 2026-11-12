import React, { useState, useMemo, useEffect } from 'react';
import {
  X,
  Search,
  Plus,
  Check,
  Tag,
  Wrench,
  Package,
  Layers,
  CheckCircle,
} from 'lucide-react';
import { PriceListTemplateItem, BudgetItem } from '../types/contract';
import { formatCurrency } from '../utils/numberToWordsCs';
import { getStoredPriceList, saveStoredPriceList } from '../utils/storage';

interface PriceListModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectItems: (items: BudgetItem[]) => void;
  onToast?: (type: 'success' | 'error' | 'info', text: string) => void;
}

export const PriceListModal: React.FC<PriceListModalProps> = ({
  isOpen,
  onClose,
  onSelectItems,
  onToast,
}) => {
  const [priceList, setPriceList] = useState<PriceListTemplateItem[]>(() => getStoredPriceList());
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Vše');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Form pro přidání nové položky do ceníku
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState('Vlastní práce');
  const [newType, setNewType] = useState<'prace' | 'material' | 'ostatni'>('prace');
  const [newUnit, setNewUnit] = useState('m²');
  const [newPrice, setNewPrice] = useState<number | ''>(500);

  // Při otevření modalu načteme čerstvý ceník
  useEffect(() => {
    if (isOpen) {
      setPriceList(getStoredPriceList());
      setSelectedIds(new Set());
      setSearch('');
    }
  }, [isOpen]);

  // Seznam existujících kategorií (voláno VŽDY před jakýmkoliv return - pravidla React hooks)
  const categories = useMemo(() => {
    const set = new Set<string>();
    set.add('Vše');
    priceList.forEach((it) => set.add(it.category));
    return Array.from(set);
  }, [priceList]);

  // Filtrované položky (voláno VŽDY před jakýmkoliv return)
  const filteredItems = useMemo(() => {
    const q = search.toLowerCase().trim();
    return priceList.filter((it) => {
      const matchCat = selectedCategory === 'Vše' || it.category === selectedCategory;
      const matchSearch =
        !q ||
        it.title.toLowerCase().includes(q) ||
        (it.description && it.description.toLowerCase().includes(q)) ||
        it.category.toLowerCase().includes(q);
      return matchCat && matchSearch;
    });
  }, [priceList, search, selectedCategory]);

  if (!isOpen) return null;

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleConfirmSelection = () => {
    if (selectedIds.size === 0) {
      if (onToast) onToast('info', 'Vyberte alespoň jednu položku k přidání.');
      return;
    }

    const itemsToAdd: BudgetItem[] = priceList
      .filter((pl) => selectedIds.has(pl.id))
      .map((pl) => ({
        id: `item_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        type: pl.type,
        title: pl.title,
        quantity: 1,
        unit: pl.unit,
        unitPrice: pl.unitPrice,
        totalPrice: pl.unitPrice,
      }));

    onSelectItems(itemsToAdd);
    if (onToast) {
      onToast('success', `Přidáno ${itemsToAdd.length} položek z vašeho ceníku.`);
    }
    onClose();
  };

  const handleAddNewItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    const numPrice = typeof newPrice === 'number' ? newPrice : parseFloat(String(newPrice));
    if (isNaN(numPrice) || numPrice <= 0) return;

    const newItem: PriceListTemplateItem = {
      id: `pl_custom_${Date.now()}`,
      title: newTitle.trim(),
      category: newCategory.trim() || 'Vlastní',
      type: newType,
      unit: newUnit,
      unitPrice: Math.round(numPrice),
    };

    const updated = [newItem, ...priceList];
    setPriceList(updated);
    saveStoredPriceList(updated);

    // Automaticky položku zaškrtneme
    setSelectedIds((prev) => new Set(prev).add(newItem.id));

    // Reset
    setNewTitle('');
    setIsAddingNew(false);
    if (onToast) onToast('success', `Položka „${newItem.title}“ byla uložena do vašeho ceníku.`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 max-w-3xl w-full my-6 flex flex-col max-h-[90vh] overflow-hidden text-slate-800 dark:text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-800 bg-slate-900 text-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-slate-800 text-amber-400 border border-slate-700 flex items-center justify-center shrink-0 font-bold">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-extrabold tracking-tight text-white flex items-center gap-2">
                <span>Ceník řemeslníka – Rychlý výběr</span>
              </h2>
              <p className="text-xs text-slate-300">
                Zaškrtněte položky prací a materiálů pro okamžité vložení do rozpočtu na 1 klik
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search & Categories Bar */}
        <div className="p-3.5 sm:p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 space-y-3 shrink-0">
          {/* Vyhledávací pole + tlačítko přidat novou */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Hledat v ceníku (např. obklad, sádrokarton, zásuvka, penetrace)..."
                className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
              />
            </div>

            <button
              type="button"
              onClick={() => setIsAddingNew((v) => !v)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-amber-500 text-xs font-semibold text-slate-700 dark:text-slate-300 transition-colors cursor-pointer shrink-0"
            >
              <Plus className="w-3.5 h-3.5 text-amber-600" />
              <span>{isAddingNew ? 'Zavřít' : 'Nová položka'}</span>
            </button>
          </div>

          {/* Form pro přidání nové položky */}
          {isAddingNew && (
            <form
              onSubmit={handleAddNewItem}
              className="p-3 bg-amber-50/60 dark:bg-amber-950/40 rounded-xl border border-amber-200 dark:border-amber-800 space-y-2 animate-in fade-in"
            >
              <div className="text-xs font-bold text-amber-900 dark:text-amber-200 uppercase tracking-wider">
                Vlastní položka do stálého ceníku:
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                <input
                  type="text"
                  placeholder="Název (např. Montáž obložkové zárubně)"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="sm:col-span-5 px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                  required
                />
                <input
                  type="text"
                  placeholder="Kategorie"
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="sm:col-span-3 px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                />
                <select
                  value={newUnit}
                  onChange={(e) => setNewUnit(e.target.value)}
                  className="sm:col-span-2 px-2 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                >
                  <option value="m²">m²</option>
                  <option value="hod">hod</option>
                  <option value="ks">ks</option>
                  <option value="bm">bm</option>
                  <option value="kpl">kpl</option>
                  <option value="den">den</option>
                  <option value="km">km</option>
                </select>
                <input
                  type="number"
                  placeholder="Cena Kč"
                  value={newPrice}
                  onChange={(e) => setNewPrice(e.target.value ? parseFloat(e.target.value) : '')}
                  className="sm:col-span-2 px-2.5 py-1.5 text-xs font-bold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                  required
                />
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsAddingNew(false)}
                  className="px-2.5 py-1 text-xs text-slate-500 hover:text-slate-800"
                >
                  Zrušit
                </button>
                <button
                  type="submit"
                  className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold shadow-2xs cursor-pointer"
                >
                  Uložit a vybrat
                </button>
              </div>
            </form>
          )}

          {/* Kategorie chipy */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-2.5 py-1 rounded-lg text-xs whitespace-nowrap font-medium transition-all cursor-pointer ${
                  selectedCategory === cat
                    ? 'bg-amber-600 text-white font-bold shadow-xs'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* List of items */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {filteredItems.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <Layers className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm font-medium">Nebyly nalezeny žádné položky pro „{search}“.</p>
              <p className="text-xs mt-1">Zkuste upravit hledání nebo přidejte novou položku tlačítkem výše.</p>
            </div>
          ) : (
            filteredItems.map((it) => {
              const isSelected = selectedIds.has(it.id);
              return (
                <div
                  key={it.id}
                  onClick={() => toggleSelect(it.id)}
                  className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                    isSelected
                      ? 'bg-amber-50/80 dark:bg-amber-950/40 border-amber-400 dark:border-amber-600 shadow-xs'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {/* Checkbox */}
                    <div
                      className={`w-5 h-5 rounded-md flex items-center justify-center border transition-colors shrink-0 ${
                        isSelected
                          ? 'bg-amber-600 border-amber-600 text-white'
                          : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800'
                      }`}
                    >
                      {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                    </div>

                    <div>
                      <div className="font-semibold text-xs sm:text-sm text-slate-900 dark:text-white">
                        {it.title}
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                        <span className="font-medium text-slate-500 dark:text-slate-400">
                          {it.category}
                        </span>
                        <span>·</span>
                        <span className="uppercase text-[10px] px-1 py-0.2 rounded bg-slate-100 dark:bg-slate-800 font-semibold">
                          {it.type === 'prace' ? 'Práce' : it.type === 'material' ? 'Materiál' : 'Ostatní'}
                        </span>
                        {it.description && (
                          <>
                            <span>·</span>
                            <span className="truncate max-w-xs">{it.description}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">
                      {formatCurrency(it.unitPrice)}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      za {it.unit}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Vybráno položek: <strong className="text-slate-900 dark:text-white font-bold">{selectedIds.size}</strong>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Zavřít
            </button>
            <button
              type="button"
              onClick={handleConfirmSelection}
              disabled={selectedIds.size === 0}
              className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer ${
                selectedIds.size > 0
                  ? 'bg-amber-600 hover:bg-amber-700 text-white'
                  : 'bg-slate-200 text-slate-400 dark:bg-slate-800 dark:text-slate-600 cursor-not-allowed'
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Vložit do rozpočtu ({selectedIds.size})</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
