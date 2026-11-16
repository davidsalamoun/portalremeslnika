import React, { useState, useMemo, useEffect } from 'react';
import { Dialog } from './Dialog';
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

const fieldLabel = 'block font-semibold text-slate-900 dark:text-slate-100 mb-1.5';
const fieldInput =
  'w-full min-h-11 px-3.5 py-2 rounded-md border-[1.5px] border-slate-900 dark:border-slate-500 bg-white dark:bg-slate-950 text-slate-900 dark:text-white';
const smallAction =
  'min-h-11 px-3 inline-flex items-center justify-center gap-1.5 rounded-md border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-medium hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors';
const strongAction =
  'min-h-11 px-4 inline-flex items-center justify-center gap-2 rounded-md border-[1.5px] border-slate-900 dark:border-slate-500 text-slate-900 dark:text-slate-100 font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors';

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
  const [newPrice, setNewPrice] = useState<number | ''>('');

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
    <Dialog
      title="Vybrat z ceníku"
      subtitle="Zaškrtněte položky, které chcete vložit do rozpočtu."
      size="2xl"
      bare
      closeOnBackdrop={false}
      onClose={onClose}
    >

        <div className="p-4 space-y-3 border-b border-slate-200 dark:border-slate-800 shrink-0">
          <div className="flex flex-wrap gap-2">
            <div className="relative flex-1 min-w-[12rem]">
              <label htmlFor="cenik-vyber-hledat" className="sr-only">
                Hledat v ceníku
              </label>
              <Search className="w-[18px] h-[18px] text-slate-600 dark:text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="cenik-vyber-hledat"
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Hledat, např. obklad, zásuvka"
                className={`${fieldInput} pl-10`}
              />
            </div>
            <button type="button" onClick={() => setIsAddingNew((v) => !v)} aria-expanded={isAddingNew} className={smallAction}>
              <Plus className="w-4 h-4" />
              <span>{isAddingNew ? 'Zavřít' : 'Nová položka'}</span>
            </button>
          </div>

          {isAddingNew && (
            <form onSubmit={handleAddNewItem} className="border border-slate-300 dark:border-slate-700 rounded-md p-3 space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-12 gap-3">
                <div className="col-span-2 sm:col-span-5">
                  <label htmlFor="cenik-vyber-nazev" className={fieldLabel}>
                    Název
                  </label>
                  <input
                    id="cenik-vyber-nazev"
                    type="text"
                    required
                    autoFocus
                    placeholder="např. Montáž zárubně"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    className={fieldInput}
                  />
                </div>
                <div className="col-span-2 sm:col-span-3">
                  <label htmlFor="cenik-vyber-kategorie" className={fieldLabel}>
                    Kategorie
                  </label>
                  <input id="cenik-vyber-kategorie" type="text" value={newCategory} onChange={(e) => setNewCategory(e.target.value)} className={fieldInput} />
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="cenik-vyber-jednotka" className={fieldLabel}>
                    Jednotka
                  </label>
                  <select id="cenik-vyber-jednotka" value={newUnit} onChange={(e) => setNewUnit(e.target.value)} className={`${fieldInput} cursor-pointer`}>
                    {['m²', 'hod', 'ks', 'bm', 'kpl', 'den', 'km'].map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="cenik-vyber-cena" className={fieldLabel}>
                    Cena v Kč
                  </label>
                  <input
                    id="cenik-vyber-cena"
                    type="number"
                    min="1"
                    required
                    inputMode="numeric"
                    value={newPrice}
                    onChange={(e) => setNewPrice(e.target.value ? parseFloat(e.target.value) : '')}
                    className={`${fieldInput} tabular-nums`}
                  />
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-slate-600 dark:text-slate-400">Položka se uloží do vašeho ceníku a rovnou vybere.</span>
                <button type="submit" className={strongAction}>
                  Uložit a vybrat
                </button>
              </div>
            </form>
          )}

          <div className="flex gap-2 overflow-x-auto pb-1">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                aria-pressed={selectedCategory === cat}
                onClick={() => setSelectedCategory(cat)}
                className={`min-h-11 px-3 inline-flex items-center justify-center rounded-md border font-medium whitespace-nowrap cursor-pointer transition-colors ${
                  selectedCategory === cat
                    ? 'border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-900'
                    : 'border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
          {filteredItems.length === 0 ? (
            <div className="px-5 py-6 text-slate-600 dark:text-slate-400">
              {search ? `Hledání „${search}“ neodpovídá žádná položka.` : 'V této kategorii není žádná položka.'} Přidat ji můžete tlačítkem Nová položka.
            </div>
          ) : (
            filteredItems.map((it) => {
              const isSelected = selectedIds.has(it.id);
              return (
                <button
                  key={it.id}
                  type="button"
                  role="checkbox"
                  aria-checked={isSelected}
                  onClick={() => toggleSelect(it.id)}
                  className={`w-full px-5 py-3 flex items-center gap-3.5 text-left cursor-pointer transition-colors ${
                    isSelected ? 'bg-slate-100 dark:bg-slate-800' : 'hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <span
                    className={`w-6 h-6 rounded-sm border-[1.5px] inline-flex items-center justify-center shrink-0 ${
                      isSelected
                        ? 'bg-slate-900 border-slate-900 text-white dark:bg-white dark:border-white dark:text-slate-900'
                        : 'border-slate-900 dark:border-slate-400 bg-white dark:bg-slate-950'
                    }`}
                  >
                    {isSelected && <Check className="w-4 h-4" strokeWidth={3} />}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block font-semibold text-slate-900 dark:text-white">{it.title}</span>
                    <span className="block text-slate-600 dark:text-slate-400">
                      {[it.category, it.type === 'prace' ? 'práce' : it.type === 'material' ? 'materiál' : 'ostatní', it.description].filter(Boolean).join(', ')}
                    </span>
                  </span>
                  <span className="text-right shrink-0 whitespace-nowrap">
                    <span className="font-display font-semibold tabular-nums text-[19px] text-slate-900 dark:text-white">{formatCurrency(it.unitPrice)}</span>
                    <span className="text-slate-600 dark:text-slate-400"> / {it.unit}</span>
                  </span>
                </button>
              );
            })
          )}
        </div>

        <div className="px-5 py-4 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2.5 shrink-0">
          <span className="text-slate-600 dark:text-slate-400">
            Vybráno: <span className="font-semibold text-slate-900 dark:text-white tabular-nums">{selectedIds.size}</span>
          </span>
          <div className="flex flex-wrap gap-2.5">
            <button type="button" onClick={onClose} className={strongAction}>
              Zrušit
            </button>
            <button
              type="button"
              onClick={handleConfirmSelection}
              disabled={selectedIds.size === 0}
              className="min-h-11 px-4 inline-flex items-center justify-center gap-2 rounded-md border-[1.5px] border-slate-900 bg-amber-400 hover:bg-amber-500 text-slate-900 font-semibold cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus className="w-[18px] h-[18px]" />
              <span>Vložit do rozpočtu</span>
            </button>
          </div>
        </div>
      </Dialog>
  );
};
