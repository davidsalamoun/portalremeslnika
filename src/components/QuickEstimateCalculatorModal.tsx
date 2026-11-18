import React, { useState, useMemo } from 'react';
import { Dialog } from './Dialog';
import {
  X,
  Calculator,
  ArrowRight,
  Send,
  Copy,
  Clock,
  Layers,
  SquareSplitVertical,
  Paintbrush,
  Hammer,
  Zap,
  ShieldCheck,
  Check
} from 'lucide-react';
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
  iconName: 'layers' | 'squareSplit' | 'brush' | 'hammer' | 'zap';
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
    iconName: 'layers',
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
    iconName: 'squareSplit',
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
    iconName: 'brush',
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
    iconName: 'hammer',
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
    iconName: 'zap',
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
  const [quantity, setQuantity] = useState<number>(30);
  const [qualityTier, setQualityTier] = useState<'standard' | 'premium'>('standard');
  const [includeBuffer, setIncludeBuffer] = useState<boolean>(true); // 10% rezerva na prořez a neočekávané
  const [copied, setCopied] = useState<boolean>(false);

  const selectedTrade = useMemo(() => {
    return TRADES.find((t) => t.id === selectedTradeId) || TRADES[0];
  }, [selectedTradeId]);

  const calculation = useMemo(() => {
    const qty = Math.max(1, quantity || 1);
    const qualityMultiplier = qualityTier === 'premium' ? 1.25 : 1.0;
    const bufferMultiplier = includeBuffer ? 1.1 : 1.0;

    const laborPrice = Math.round(qty * selectedTrade.laborRatePerUnit * qualityMultiplier);
    const materialPrice = Math.round(qty * selectedTrade.materialRatePerUnit * qualityMultiplier * bufferMultiplier);
    const totalPrice = laborPrice + materialPrice;
    const estimatedDays = Math.max(1, Math.ceil(qty * selectedTrade.daysPerUnitRatio));

    return {
      qty,
      laborPrice,
      materialPrice,
      totalPrice,
      estimatedDays,
    };
  }, [selectedTrade, quantity, qualityTier, includeBuffer]);

  if (!isOpen) return null;

  const estimateText = `Dobrý den, posílám orientační kalkulaci pro "${selectedTrade.title}" v rozsahu cca ${calculation.qty} ${selectedTrade.unit}:
• Práce: ${formatCurrency(calculation.laborPrice)}
• Materiál a stavební chemie (orientačně): ${formatCurrency(calculation.materialPrice)}
• Celkový předběžný odhad: ${formatCurrency(calculation.totalPrice)}
• Předpokládaná doba realizace: cca ${calculation.estimatedDays} ${calculation.estimatedDays === 1 ? 'pracovní den' : calculation.estimatedDays < 5 ? 'pracovní dny' : 'pracovních dní'}.
Přesnou cenovou nabídku s položkovým rozpočtem vám rád připravím.`;

  const handleCopyEstimate = () => {
    triggerHaptic('light');
    navigator.clipboard.writeText(estimateText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    onToast('success', 'Orientační kalkulace byla zkopírována do schránky.');
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

  const renderTradeIcon = (iconName: TradeFormula['iconName'], isSelected: boolean) => {
    const iconClass = isSelected ? 'w-4 h-4 text-white' : 'w-4 h-4 text-slate-600 dark:text-slate-400';
    switch (iconName) {
      case 'layers': return <Layers className={iconClass} />;
      case 'squareSplit': return <SquareSplitVertical className={iconClass} />;
      case 'brush': return <Paintbrush className={iconClass} />;
      case 'hammer': return <Hammer className={iconClass} />;
      case 'zap': return <Zap className={isSelected ? 'w-4 h-4 text-amber-300' : 'w-4 h-4 text-amber-500'} />;
      default: return <Layers className={iconClass} />;
    }
  };

  return (
    <Dialog
      title="Kalkulačka na obhlídce"
      subtitle="Rychlý odhad ceny na místě."
      size="xl"
      closeOnBackdrop={false}
      onClose={onClose}
    >

        {/* Trade Selector */}
        <div>
          <label className="block text-[13px] font-semibold text-slate-500 dark:text-slate-400 mb-1.5">
            Zvolte řemeslný obor:
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {TRADES.map((t) => {
              const isSelected = selectedTradeId === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    triggerHaptic('light');
                    setSelectedTradeId(t.id);
                    setQuantity(t.defaultQty);
                  }}
                  className={`min-h-11 min-w-11 p-2.5 rounded-lg border text-left flex items-center gap-2 transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-slate-900 text-amber-400 dark:bg-slate-800 border-slate-900 dark:border-slate-700 font-semibold shadow-xs'
                      : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <span>{renderTradeIcon(t.iconName, isSelected)}</span>
                  <span className="text-sm truncate font-medium">{t.title}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Quantity & Quality Inputs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-700">
          <div>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1 text-[13px]">
              Rozsah díla ({selectedTrade.unit}):
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="1"
                value={quantity || ''}
                onChange={(e) => setQuantity(parseFloat(e.target.value) || 0)}
                className="min-h-11 w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-lg font-semibold tabular-nums text-slate-900 dark:text-white text-center focus:ring-2 focus:ring-amber-500"
              />
              <span className="text-sm font-semibold text-slate-500 shrink-0">
                {selectedTrade.unit}
              </span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1 text-[13px]">
              Třída materiálu a chemie:
            </label>
            <div className="grid grid-cols-2 gap-1.5 h-10">
              <button
                type="button"
                onClick={() => setQualityTier('standard')}
                className={`min-h-11 min-w-11 inline-flex items-center justify-center rounded-lg text-sm font-semibold transition-colors cursor-pointer ${
                  qualityTier === 'standard'
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs'
                    : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700'
                }`}
              >
                Standard
              </button>
              <button
                type="button"
                onClick={() => setQualityTier('premium')}
                className={`min-h-11 min-w-11 inline-flex items-center justify-center rounded-lg text-sm font-semibold transition-colors cursor-pointer ${
                  qualityTier === 'premium'
                    ? 'bg-amber-500 text-slate-950 shadow-xs'
                    : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700'
                }`}
              >
                Prémiový (+25 %)
              </button>
            </div>
          </div>
        </div>

        {/* 10% Reserve Checkbox */}
        <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={includeBuffer}
            onChange={(e) => setIncludeBuffer(e.target.checked)}
            className="w-4 h-4 rounded text-amber-500 focus:ring-amber-500"
          />
          <span>Zahrnout +10 % technologickou rezervu na prořez materiálu a nečekané vícepráce</span>
        </label>

        {/* Calculation Result Card */}
        <div className="p-4 rounded-lg bg-slate-900 dark:bg-slate-950 text-white border border-slate-800 space-y-3 shadow-md">
          <div className="flex items-baseline justify-between">
            <span className="text-[13px] font-semibold text-amber-400">
              Doporučená cena zakázky bez DPH
            </span>
            <div className="flex items-center gap-1.5 text-sm text-slate-300">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              <span>cca {calculation.estimatedDays} {calculation.estimatedDays === 1 ? 'pracovní den' : 'pracovní dny'}</span>
            </div>
          </div>

          <div className="text-3xl sm:text-4xl font-semibold tabular-nums text-white">
            {formatCurrency(calculation.totalPrice)}
          </div>

          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800 text-sm">
            <div className="bg-slate-800/60 p-2 rounded border border-slate-700/60">
              <span className="text-slate-400 text-[13px] block">Odměna za práci:</span>
              <strong className="text-sm tabular-nums font-semibold text-white">{formatCurrency(calculation.laborPrice)}</strong>
            </div>
            <div className="bg-slate-800/60 p-2 rounded border border-slate-700/60">
              <span className="text-slate-400 text-[13px] block">Materiál a chemie:</span>
              <strong className="text-sm tabular-nums font-semibold text-amber-400">{formatCurrency(calculation.materialPrice)}</strong>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-3 pt-1">
          <button
            type="button"
            onClick={handleCopyEstimate}
            className="min-h-11 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 font-semibold text-sm transition-colors cursor-pointer"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
            <span>{copied ? 'Zkopírováno!' : 'Zkopírovat pro SMS / WhatsApp'}</span>
          </button>

          <button
            type="button"
            onClick={handleApply}
            className="min-h-11 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-sm transition-colors cursor-pointer shadow-xs"
          >
            <ArrowRight className="w-4 h-4" />
            <span>Převést do Smlouvy o dílo</span>
          </button>
        </div>
      </Dialog>
  );
};
