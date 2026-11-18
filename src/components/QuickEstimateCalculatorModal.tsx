import React, { useState, useMemo } from 'react';
import { Dialog } from './Dialog';
import { Copy, Check, ArrowRight } from 'lucide-react';
import { formatCurrency } from '../utils/numberToWordsCs';
import { triggerHaptic } from '../utils/haptics';

interface QuickEstimateCalculatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyToContract: (estimate: {
    tradeTitle: string;
    description: string;
    price: number;
    days: number;
    items: {
      type: 'prace' | 'material';
      title: string;
      quantity: number;
      unit: string;
      unitPrice: number;
      totalPrice: number;
    }[];
  }) => void;
  onToast: (type: 'success' | 'error' | 'info', message: string) => void;
}

interface TradeFormula {
  id: string;
  title: string;
  unit: string;
  defaultQty: number;
  laborRatePerUnit: number;
  materialRatePerUnit: number;
  daysPerUnitRatio: number; // e.g. 0.3 days per m2
  materialName: string;
  laborName: string;
}

const TRADES: TradeFormula[] = [
  {
    id: 'tiles',
    title: 'Obklady a dlažba',
    unit: 'm²',
    defaultQty: 30,
    laborRatePerUnit: 700,
    materialRatePerUnit: 350,
    daysPerUnitRatio: 0.25,
    laborName: 'Pokládka obkladů/dlažby včetně spárování a silikonu',
    materialName: 'Flexi lepidlo C2TES1, hydroizolace, spárovačka',
  },
  {
    id: 'drywall',
    title: 'Sádrokartony a příčky',
    unit: 'm²',
    defaultQty: 45,
    laborRatePerUnit: 500,
    materialRatePerUnit: 380,
    daysPerUnitRatio: 0.15,
    laborName: 'Montáž SDK rastru, deskování, tmelení Q3 a přebroušení',
    materialName: 'SDK desky, UD/CD profily, tmel, parozábrana',
  },
  {
    id: 'paint',
    title: 'Malířské práce a stěrky',
    unit: 'm²',
    defaultQty: 100,
    laborRatePerUnit: 140,
    materialRatePerUnit: 65,
    daysPerUnitRatio: 0.05,
    laborName: 'Příprava povrchu, penetrace a 2x krycí nátěr',
    materialName: 'Hloubková penetrace, prémiová otěruvzdorná barva',
  },
  {
    id: 'floor',
    title: 'Vinylové podlahy a stěrka',
    unit: 'm²',
    defaultQty: 50,
    laborRatePerUnit: 380,
    materialRatePerUnit: 260,
    daysPerUnitRatio: 0.1,
    laborName: 'Penetrace, samonivelační stěrka a lepení vinylu',
    materialName: 'Nivelační hmota, lepidlo na vinyl, obvodové lišty',
  },
  {
    id: 'electro',
    title: 'Elektroinstalace bytu',
    unit: 'm² bytu',
    defaultQty: 60,
    laborRatePerUnit: 650,
    materialRatePerUnit: 400,
    daysPerUnitRatio: 0.15,
    laborName: 'Drážkování, tahání kabelů CYKY, osazení rozvaděče',
    materialName: 'Kabely, krabice, jističe, proudový chránič',
  },
];

export const QuickEstimateCalculatorModal: React.FC<QuickEstimateCalculatorModalProps> = ({
  isOpen,
  onClose,
  onApplyToContract,
  onToast,
}) => {
  const [selectedTradeId, setSelectedTradeId] = useState<string>('tiles');
  const [quantity, setQuantity] = useState<number | ''>('');
  const [qualityTier, setQualityTier] = useState<'standard' | 'premium'>('standard');
  const [includeBuffer, setIncludeBuffer] = useState<boolean>(true); // 10% rezerva na prořez a neočekávané
  const [copied, setCopied] = useState<boolean>(false);

  const selectedTrade = useMemo(() => {
    return TRADES.find((t) => t.id === selectedTradeId) || TRADES[0];
  }, [selectedTradeId]);

  const calculation = useMemo(() => {
    const qty = typeof quantity === 'number' && quantity > 0 ? quantity : 0;
    const qualityMultiplier = qualityTier === 'premium' ? 1.25 : 1.0;
    const bufferMultiplier = includeBuffer ? 1.1 : 1.0;

    const laborPrice = Math.round(qty * selectedTrade.laborRatePerUnit * qualityMultiplier);
    const materialPrice = Math.round(qty * selectedTrade.materialRatePerUnit * qualityMultiplier * bufferMultiplier);
    const totalPrice = laborPrice + materialPrice;
    const estimatedDays = qty > 0 ? Math.max(1, Math.ceil(qty * selectedTrade.daysPerUnitRatio)) : 0;

    return {
      qty,
      laborPrice,
      materialPrice,
      totalPrice,
      estimatedDays,
    };
  }, [selectedTrade, quantity, qualityTier, includeBuffer]);

  if (!isOpen) return null;

  const daysText = (n: number) => `${n} ${n === 1 ? 'pracovní den' : n >= 2 && n <= 4 ? 'pracovní dny' : 'pracovních dnů'}`;
  const hasQty = calculation.qty > 0;

  const estimateText = `Dobrý den, posílám orientační kalkulaci pro "${selectedTrade.title}" v rozsahu cca ${calculation.qty} ${selectedTrade.unit}:
• Práce: ${formatCurrency(calculation.laborPrice)}
• Materiál a stavební chemie (orientačně): ${formatCurrency(calculation.materialPrice)}
• Celkový předběžný odhad: ${formatCurrency(calculation.totalPrice)}
• Předpokládaná doba realizace: cca ${daysText(calculation.estimatedDays)}.
Přesnou cenovou nabídku s položkovým rozpočtem vám rád připravím.`;

  const handleCopyEstimate = async () => {
    triggerHaptic('light');
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
    onApplyToContract({
      tradeTitle: selectedTrade.title,
      description: `${selectedTrade.title}: ${selectedTrade.laborName} v rozsahu ${calculation.qty} ${selectedTrade.unit}.`,
      price: calculation.totalPrice,
      days: calculation.estimatedDays,
      items: [
        {
          type: 'prace',
          title: selectedTrade.laborName,
          quantity: calculation.qty,
          unit: selectedTrade.unit,
          unitPrice: Math.round(calculation.laborPrice / calculation.qty),
          totalPrice: calculation.laborPrice,
        },
        {
          type: 'material',
          title: selectedTrade.materialName,
          quantity: calculation.qty,
          unit: selectedTrade.unit,
          unitPrice: Math.round(calculation.materialPrice / calculation.qty),
          totalPrice: calculation.materialPrice,
        },
      ],
    });
    onClose();
  };

  const chip = (on: boolean) =>
    `min-h-11 px-3 inline-flex items-center rounded-md border font-medium cursor-pointer transition-colors ${
      on
        ? 'border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-900'
        : 'border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800'
    }`;
  const qualityMultiplier = qualityTier === 'premium' ? 1.25 : 1;

  return (
    <Dialog title="Kalkulačka na obhlídce" subtitle="Rychlý odhad ceny na místě." size="xl" closeOnBackdrop={false} onClose={onClose}>
      <div className="space-y-5 text-[15px]">
        <div>
          <div className="font-semibold text-slate-900 dark:text-slate-100 mb-1.5">Druh práce</div>
          <div role="group" aria-label="Druh práce" className="flex flex-wrap gap-2">
            {TRADES.map((t) => (
              <button
                key={t.id}
                type="button"
                aria-pressed={selectedTradeId === t.id}
                onClick={() => {
                  triggerHaptic('light');
                  setSelectedTradeId(t.id);
                }}
                className={chip(selectedTradeId === t.id)}
              >
                {t.title}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="kalk-rozsah" className="block font-semibold text-slate-900 dark:text-slate-100 mb-1.5">
              Rozsah ({selectedTrade.unit})
            </label>
            <input
              id="kalk-rozsah"
              type="number"
              inputMode="decimal"
              min="1"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value === '' ? '' : parseFloat(e.target.value))}
              placeholder={`např. ${selectedTrade.defaultQty}`}
              className="min-h-11 w-full px-3 rounded-md border-[1.5px] border-slate-900 dark:border-slate-500 bg-white dark:bg-slate-950 text-slate-900 dark:text-white tabular-nums"
            />
          </div>
          <div>
            <div className="font-semibold text-slate-900 dark:text-slate-100 mb-1.5">Materiál</div>
            <div role="group" aria-label="Materiál" className="flex flex-wrap gap-2">
              <button type="button" aria-pressed={qualityTier === 'standard'} onClick={() => setQualityTier('standard')} className={chip(qualityTier === 'standard')}>
                Běžný
              </button>
              <button type="button" aria-pressed={qualityTier === 'premium'} onClick={() => setQualityTier('premium')} className={chip(qualityTier === 'premium')}>
                Lepší (+25 %)
              </button>
            </div>
          </div>
        </div>

        <label className="min-h-11 flex items-center gap-2.5 text-slate-900 dark:text-slate-100 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={includeBuffer}
            onChange={(e) => setIncludeBuffer(e.target.checked)}
            className="w-5 h-5 shrink-0 accent-slate-900 dark:accent-white"
          />
          Přidat 10 % na prořez a nečekané práce
        </label>

        {/* Výsledek: bílý rámeček s velkým číslem (vzor Přehledu) */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md divide-y divide-slate-100 dark:divide-slate-800" aria-live="polite">
          <div className="px-5 py-4">
            <div className="text-slate-600 dark:text-slate-400">Orientační cena</div>
            <div className="font-display font-bold text-[40px] leading-none tabular-nums mt-1 text-slate-900 dark:text-white">
              {hasQty ? formatCurrency(calculation.totalPrice) : '–'}
            </div>
            {!hasQty && <div className="mt-1.5 text-slate-600 dark:text-slate-400">Zadejte rozsah práce.</div>}
          </div>
          {hasQty && (
            <>
              <div className="px-5 py-3 flex items-baseline justify-between gap-4">
                <span className="text-slate-600 dark:text-slate-400">Práce</span>
                <span className="font-display font-semibold text-xl tabular-nums text-slate-900 dark:text-white">{formatCurrency(calculation.laborPrice)}</span>
              </div>
              <div className="px-5 py-3 flex items-baseline justify-between gap-4">
                <span className="text-slate-600 dark:text-slate-400">Materiál</span>
                <span className="font-display font-semibold text-xl tabular-nums text-slate-900 dark:text-white">{formatCurrency(calculation.materialPrice)}</span>
              </div>
              <div className="px-5 py-3 flex items-baseline justify-between gap-4">
                <span className="text-slate-600 dark:text-slate-400">Doba práce</span>
                <span className="font-semibold text-slate-900 dark:text-white">cca {daysText(calculation.estimatedDays)}</span>
              </div>
            </>
          )}
        </div>
        <p className="text-slate-600 dark:text-slate-400">
          Počítá se s průměrnými sazbami {formatCurrency(Math.round(selectedTrade.laborRatePerUnit * qualityMultiplier))} za práci a{' '}
          {formatCurrency(Math.round(selectedTrade.materialRatePerUnit * qualityMultiplier))} za materiál na {selectedTrade.unit}, ne s vaším ceníkem. Ve smlouvě
          ceny upravíte.
        </p>

        <div className="flex flex-wrap gap-2.5">
          <button
            type="button"
            onClick={handleApply}
            disabled={!hasQty}
            className="min-h-11 px-5 inline-flex items-center justify-center gap-2 rounded-md border-[1.5px] border-slate-900 bg-amber-400 hover:bg-amber-300 text-slate-900 font-semibold cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ArrowRight className="w-[18px] h-[18px]" />
            Převést do smlouvy
          </button>
          <button
            type="button"
            onClick={handleCopyEstimate}
            disabled={!hasQty}
            className="min-h-11 px-4 inline-flex items-center justify-center gap-2 rounded-md border-[1.5px] border-slate-900 dark:border-slate-500 text-slate-900 dark:text-slate-100 font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {copied ? <Check className="w-[18px] h-[18px]" /> : <Copy className="w-[18px] h-[18px]" />}
            {copied ? 'Zkopírováno' : 'Zkopírovat do zprávy'}
          </button>
        </div>
      </div>
    </Dialog>
  );
};
