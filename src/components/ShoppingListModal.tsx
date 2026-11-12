import React, { useState } from 'react';
import {
  X,
  ShoppingCart,
  Plus,
  Trash2,
  Check,
  Share2,
  Printer,
  Package,
  DollarSign,
  PackageCheck,
  Building2,
  Store,
} from 'lucide-react';
import { Contract, ShoppingListItem, ContractExpense } from '../types/contract';
import { formatCurrency } from '../utils/numberToWordsCs';
import { triggerHaptic } from '../utils/haptics';
import { safeOpenExternalUrl } from '../utils/shareUtils';

interface ShoppingListModalProps {
  isOpen: boolean;
  onClose: () => void;
  contract: Contract;
  onUpdateContract: (updated: Contract) => void;
  onToast?: (type: 'success' | 'error' | 'info', text: string) => void;
}

const TRADE_PRESETS: { name: string; items: { name: string; quantity: number; unit: string; estimatedPrice: number }[] }[] = [
  {
    name: 'Zedník & Obkladač',
    items: [
      { name: 'Flexibilní lepidlo C2TES1 (25 kg)', quantity: 6, unit: 'pyt', estimatedPrice: 380 },
      { name: 'Hloubková penetrace 5 l', quantity: 1, unit: 'kan', estimatedPrice: 420 },
      { name: 'Hydroizolační stěrka jednosložková (14 kg)', quantity: 1, unit: 'kbl', estimatedPrice: 890 },
      { name: 'Těsnicí páska do koutů 120 mm (10 m)', quantity: 1, unit: 'ks', estimatedPrice: 350 },
      { name: 'Spárovací hmota vodoodpudivá (5 kg)', quantity: 2, unit: 'pyt', estimatedPrice: 280 },
      { name: 'Pytle na stavební suť zpevněné', quantity: 10, unit: 'ks', estimatedPrice: 25 },
    ],
  },
  {
    name: 'Malíř & Sádrokartonář',
    items: [
      { name: 'Bílá otěruvzdorná malířská barva (15 kg)', quantity: 2, unit: 'kbl', estimatedPrice: 790 },
      { name: 'Sádrokartonová deska RB 12,5 mm (2000x1250)', quantity: 8, unit: 'ks', estimatedPrice: 210 },
      { name: 'Finální tmel na sádrokartony (20 kg)', quantity: 1, unit: 'kbl', estimatedPrice: 560 },
      { name: 'Zakrývací fólie tlustá 4x5 m', quantity: 3, unit: 'ks', estimatedPrice: 65 },
      { name: 'Papírová maskovací páska 50 mm (50 m)', quantity: 4, unit: 'ks', estimatedPrice: 95 },
      { name: 'Akrylový tmel bílý (kartuše 310 ml)', quantity: 3, unit: 'ks', estimatedPrice: 85 },
    ],
  },
  {
    name: 'Elektro & Voda & Topení',
    items: [
      { name: 'Kabel CYKY-J 3x1.5 (100 m kruh)', quantity: 1, unit: 'bal', estimatedPrice: 1450 },
      { name: 'Kabel CYKY-J 3x2.5 (100 m kruh)', quantity: 1, unit: 'bal', estimatedPrice: 2200 },
      { name: 'WAGO páčkové svorky 221-413 (50 ks)', quantity: 1, unit: 'bal', estimatedPrice: 390 },
      { name: 'Rohový ventil 1/2" x 3/8" s filtrem', quantity: 4, unit: 'ks', estimatedPrice: 145 },
      { name: 'Teflonová těsnicí páska / nit Loctite', quantity: 1, unit: 'ks', estimatedPrice: 180 },
      { name: 'Sádra šedá stavební rychletuhnoucí (5 kg)', quantity: 2, unit: 'pyt', estimatedPrice: 90 },
    ],
  },
];

const POPULAR_SUPPLIERS = ['DEK Stavebniny', 'Prodoma', 'Hornbach', 'OBI', 'Bauhaus', 'Místní stavebniny'];

export const ShoppingListModal: React.FC<ShoppingListModalProps> = ({
  isOpen,
  onClose,
  contract,
  onUpdateContract,
  onToast,
}) => {
  // Initialize from contract.shoppingList, or derive from budget items if not set
  const [items, setItems] = useState<ShoppingListItem[]>(() => {
    if (contract.shoppingList && contract.shoppingList.length > 0) {
      return contract.shoppingList;
    }
    // Extract material items from contract budget
    const materialItems = (contract.items || [])
      .filter((it) => it.type === 'material')
      .map((it) => ({
        id: `shop_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        name: it.title,
        quantity: it.quantity || 1,
        unit: it.unit || 'ks',
        estimatedPrice: Math.round(it.unitPrice * (it.quantity || 1)),
        isBought: false,
        supplier: 'Stavebniny DEK',
      }));

    return materialItems;
  });

  const [newName, setNewName] = useState('');
  const [newQuantity, setNewQuantity] = useState<number | ''>(1);
  const [newUnit, setNewUnit] = useState('ks');
  const [newPrice, setNewPrice] = useState<number | ''>('');
  const [selectedSupplier, setSelectedSupplier] = useState(POPULAR_SUPPLIERS[0]);
  const [filterPendingOnly, setFilterPendingOnly] = useState(false);

  if (!isOpen) return null;

  const saveItems = (updated: ShoppingListItem[]) => {
    setItems(updated);
    onUpdateContract({
      ...contract,
      shoppingList: updated,
    });
  };

  const handleToggleBought = (id: string) => {
    triggerHaptic('selection');
    const updated = items.map((it) => (it.id === id ? { ...it, isBought: !it.isBought } : it));
    saveItems(updated);
  };

  const handleAddItem = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newName.trim()) return;

    triggerHaptic('success');
    const qty = typeof newQuantity === 'number' && newQuantity > 0 ? newQuantity : 1;
    const price = typeof newPrice === 'number' && newPrice > 0 ? newPrice : undefined;

    const newItem: ShoppingListItem = {
      id: `shop_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: newName.trim(),
      quantity: qty,
      unit: newUnit.trim() || 'ks',
      estimatedPrice: price,
      isBought: false,
      supplier: selectedSupplier,
    };

    const updated = [...items, newItem];
    saveItems(updated);
    setNewName('');
    setNewQuantity(1);
    setNewPrice('');
  };

  const handleDeleteItem = (id: string) => {
    triggerHaptic('selection');
    const updated = items.filter((it) => it.id !== id);
    saveItems(updated);
  };

  const handleApplyPreset = (presetIndex: number) => {
    triggerHaptic('selection');
    const preset = TRADE_PRESETS[presetIndex];
    if (!preset) return;

    const newItems: ShoppingListItem[] = preset.items.map((it) => ({
      id: `shop_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: it.name,
      quantity: it.quantity,
      unit: it.unit,
      estimatedPrice: it.estimatedPrice,
      isBought: false,
      supplier: selectedSupplier,
    }));

    const updated = [...items, ...newItems];
    saveItems(updated);
    if (onToast) onToast('success', `Přidán balíček materiálů: ${preset.name}`);
  };

  // WhatsApp share generator
  const handleShareWhatsApp = () => {
    triggerHaptic('success');
    const siteAddress = contract.client.address || contract.executionPlace || 'Místo stavby';
    const clientName = contract.client.name;

    let text = `*NÁKUPNÍ SEZNAM DO STAVEBNIN*\n`;
    text += `• Stavba: ${clientName} (${siteAddress})\n`;
    text += `• Zakázka č.: ${contract.contractNumber}\n`;
    text += `• Stavebniny: ${selectedSupplier}\n\n`;
    text += `*POTŘEBNÝ MATERIÁL:*\n`;

    if (items.length === 0) {
      text += `(Seznam je prázdný)\n`;
    } else {
      items.forEach((it, idx) => {
        const mark = it.isBought ? '[x]' : '[ ]';
        const priceInfo = it.estimatedPrice ? ` (~${formatCurrency(it.estimatedPrice)})` : '';
        text += `${mark} ${idx + 1}. ${it.name} – *${it.quantity} ${it.unit}*${priceInfo}\n`;
      });
    }

    const boughtCount = items.filter((it) => it.isBought).length;
    text += `\nStav: ${boughtCount} z ${items.length} nakoupeno.\nProsím o závoz přímo na stavbu.`;

    const encoded = encodeURIComponent(text);
    const phone = contract.client.phone?.replace(/[^0-9+]/g, '') || '';
    const url = phone ? `https://wa.me/${phone}?text=${encoded}` : `https://wa.me/?text=${encoded}`;
    safeOpenExternalUrl(url);
  };

  // Sync bought items to contract expenses (Náklady a zisk)
  const handleSyncToExpenses = () => {
    triggerHaptic('success');
    const boughtWithPrice = items.filter((it) => it.isBought && it.estimatedPrice && it.estimatedPrice > 0);
    if (boughtWithPrice.length === 0) {
      if (onToast) onToast('info', 'Nejsou označeny žádné nakoupené položky s vyplněnou cenou.');
      return;
    }

    const sumAmount = boughtWithPrice.reduce((sum, it) => sum + (it.estimatedPrice || 0), 0);
    const itemsDescription = boughtWithPrice.map((it) => `${it.name} (${it.quantity} ${it.unit})`).join(', ');

    const newExpense: ContractExpense = {
      id: `exp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      date: new Date().toISOString().split('T')[0],
      title: `Nákup stavebního materiálu (${boughtWithPrice.length} pol.)`,
      supplier: selectedSupplier,
      amount: sumAmount,
      category: 'material',
      notes: `Položky: ${itemsDescription.substring(0, 300)}`,
      createdAt: new Date().toISOString(),
    };

    const existingExpenses = contract.expenses || [];
    onUpdateContract({
      ...contract,
      expenses: [newExpense, ...existingExpenses],
    });

    if (onToast) {
      onToast('success', `Zaúčtováno ${formatCurrency(sumAmount)} do nákladů zakázky.`);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const boughtCount = items.filter((it) => it.isBought).length;
  const totalCost = items.reduce((sum, it) => sum + (it.estimatedPrice || 0), 0);
  const displayedItems = filterPendingOnly ? items.filter((it) => !it.isBought) : items;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-xl max-w-2xl w-full shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[92vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header - Industrial Warehouse Picking Card */}
        <div className="p-4 sm:p-5 border-b border-slate-800 bg-slate-950 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/40 text-amber-400 flex items-center justify-center shrink-0">
              <ShoppingCart className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono font-bold tracking-wider uppercase px-1.5 py-0.5 rounded bg-amber-400 text-slate-950">
                  Pick-List materiálu
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  #{contract.contractNumber}
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-black text-white mt-0.5">
                Nákupní lístek do stavebnin
              </h2>
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
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {/* Supplier Picker & Quick Stats */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <Store className="w-4 h-4 text-amber-600" />
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Stavebniny:</span>
              <select
                value={selectedSupplier}
                onChange={(e) => setSelectedSupplier(e.target.value)}
                className="text-xs font-bold px-2 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
              >
                {POPULAR_SUPPLIERS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-3 text-xs">
              <span className="font-extrabold text-slate-900 dark:text-white">
                {boughtCount} / {items.length} nakoupeno
              </span>
              {totalCost > 0 && (
                <span className="font-bold text-amber-600 dark:text-amber-400">
                  Odhad: {formatCurrency(totalCost)}
                </span>
              )}
            </div>
          </div>

          {/* Quick-add presets when list is sparse */}
          {items.length === 0 && (
            <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 space-y-2">
              <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 font-bold text-xs">
                <Package className="w-4 h-4" />
                <span>Základní balíčky materiálu pro vybraná řemesla:</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                {TRADE_PRESETS.map((p, idx) => (
                  <button
                    key={p.name}
                    type="button"
                    onClick={() => handleApplyPreset(idx)}
                    className="p-2.5 text-left rounded-xl bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-800/80 hover:border-amber-500 text-xs font-extrabold text-slate-900 dark:text-white shadow-2xs cursor-pointer active:scale-95 transition-all"
                  >
                    + {p.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Add item bar (Optimized for mobile touch input) */}
          <form
            onSubmit={handleAddItem}
            className="p-3 rounded-xl border-2 border-dashed border-amber-300 dark:border-amber-800/80 bg-amber-50/50 dark:bg-amber-950/20 space-y-2"
          >
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <input
                type="text"
                placeholder="Přidat materiál (např. Flexi lepidlo C2TES1)..."
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="flex-1 px-3 py-2.5 rounded-xl text-sm font-semibold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 outline-hidden"
              />
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0.1"
                  step="any"
                  placeholder="Množství"
                  value={newQuantity}
                  onChange={(e) => setNewQuantity(e.target.value === '' ? '' : parseFloat(e.target.value))}
                  className="w-20 px-2 py-2.5 rounded-xl text-sm font-semibold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-center focus:ring-2 focus:ring-amber-500 outline-hidden"
                />
                <select
                  value={newUnit}
                  onChange={(e) => setNewUnit(e.target.value)}
                  className="w-20 px-2 py-2.5 rounded-xl text-sm font-semibold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white outline-hidden"
                >
                  <option value="ks">ks</option>
                  <option value="pyt">pyt</option>
                  <option value="bal">bal</option>
                  <option value="kbl">kbl</option>
                  <option value="m²">m²</option>
                  <option value="bm">bm</option>
                  <option value="l">l</option>
                  <option value="kg">kg</option>
                </select>
                <input
                  type="number"
                  placeholder="Kč/odhad"
                  value={newPrice}
                  onChange={(e) => setNewPrice(e.target.value === '' ? '' : parseFloat(e.target.value))}
                  className="w-24 px-2 py-2.5 rounded-xl text-sm font-semibold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-right focus:ring-2 focus:ring-amber-500 outline-hidden"
                />
                <button
                  type="submit"
                  disabled={!newName.trim()}
                  className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-white font-extrabold text-sm flex items-center justify-center gap-1 shadow-sm cursor-pointer active:scale-95 transition-all"
                >
                  <Plus className="w-4 h-4" />
                  <span className="hidden sm:inline">Přidat</span>
                </button>
              </div>
            </div>
          </form>

          {/* Checklist header & Filter */}
          <div className="flex items-center justify-between text-xs pt-1">
            <span className="font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Položky k nákupu ({displayedItems.length})
            </span>
            <label className="flex items-center gap-1.5 cursor-pointer font-bold text-slate-700 dark:text-slate-300 select-none">
              <input
                type="checkbox"
                checked={filterPendingOnly}
                onChange={(e) => setFilterPendingOnly(e.target.checked)}
                className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500"
              />
              <span>Zobrazit jen chybějící</span>
            </label>
          </div>

          {/* Interactive Checklist */}
          {displayedItems.length === 0 ? (
            <div className="p-8 text-center rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 text-slate-500">
              <ShoppingCart className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm font-bold">Žádný materiál na seznamu.</p>
              <p className="text-xs">Zadejte materiál výše nebo klikněte na balíček řemesla.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {displayedItems.map((item) => (
                <div
                  key={item.id}
                  onClick={() => handleToggleBought(item.id)}
                  className={`p-3 rounded-xl border transition-all flex items-center justify-between gap-3 cursor-pointer select-none active:scale-99 ${
                    item.isBought
                      ? 'bg-emerald-50/60 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800/60'
                      : 'bg-white dark:bg-slate-850 border-slate-200 dark:border-slate-800 hover:border-amber-400'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 transition-all ${
                        item.isBought
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'border-2 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900'
                      }`}
                    >
                      {item.isBought && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                    </div>
                    <div className="min-w-0">
                      <p
                        className={`text-sm font-extrabold truncate ${
                          item.isBought
                            ? 'line-through text-slate-400 dark:text-slate-500'
                            : 'text-slate-900 dark:text-white'
                        }`}
                      >
                        {item.name}
                      </p>
                      <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 font-mono">
                        {item.quantity} {item.unit}
                        {item.estimatedPrice ? ` · cca ${formatCurrency(item.estimatedPrice)}` : ''}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                    {item.isBought && (
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                        V KOŠÍKU ✓
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => handleDeleteItem(item.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg cursor-pointer"
                      title="Smazat položku"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Action Footer */}
        <div className="p-4 sm:p-5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/80 flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleShareWhatsApp}
              className="min-h-[44px] px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs sm:text-sm flex items-center gap-2 shadow-sm cursor-pointer active:scale-95 transition-all"
              title="Odeslat nákupní seznam kolegům nebo závozu do WhatsAppu"
            >
              <Share2 className="w-4 h-4" />
              <span>Sdílet WhatsApp</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="min-h-[44px] px-3 py-2 rounded-xl bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-extrabold text-xs flex items-center gap-1.5 cursor-pointer"
              title="Vytisknout papírový lístek do stavebnin"
            >
              <Printer className="w-4 h-4" />
              <span className="hidden sm:inline">Tisk</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            {boughtCount > 0 && (
              <button
                type="button"
                onClick={handleSyncToExpenses}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs sm:text-sm flex items-center gap-1.5 shadow-sm cursor-pointer active:scale-95 transition-all"
                title="Zapsat nakoupené položky do výdajů zakázky"
              >
                <DollarSign className="w-4 h-4" />
                <span>Zaúčtovat do nákladů</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 font-extrabold text-xs sm:text-sm text-slate-800 dark:text-slate-200 cursor-pointer"
            >
              Hotovo
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
