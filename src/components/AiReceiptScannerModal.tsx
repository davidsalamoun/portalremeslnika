import React, { useState, useRef } from 'react';
import {
  X,
  Camera,
  Upload,
  Receipt,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Plus,
  Building,
  Calendar,
  CreditCard,
  Tag,
  FileText,
} from 'lucide-react';
import { ContractExpense, ExpenseCategory } from '../types/contract';
import { formatCurrency } from '../utils/numberToWordsCs';

interface AiReceiptScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddExpense: (expense: ContractExpense) => void;
  onToast?: (type: 'success' | 'error' | 'info', text: string) => void;
}

export const AiReceiptScannerModal: React.FC<AiReceiptScannerModalProps> = ({
  isOpen,
  onClose,
  onAddExpense,
  onToast,
}) => {
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [extractedData, setExtractedData] = useState<{
    supplier: string;
    ico: string;
    date: string;
    totalAmount: number;
    vatAmount: number;
    category: ExpenseCategory;
    note: string;
    items?: { title: string; quantity: number; totalPrice: number }[];
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      if (onToast) onToast('error', 'Nahrajte prosím obrázek nebo fotku účtenky (JPG, PNG).');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      setImagePreview(base64);
      processReceiptWithAi(base64);
    };
    reader.readAsDataURL(file);
  };

  const processReceiptWithAi = async (base64: string) => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/ai/extract-receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: base64,
          mimeType: 'image/jpeg',
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Vytěžení účtenky se nezdařilo.');
      }

      const data = await res.json();
      setExtractedData({
        supplier: data.supplier || 'Neznámý dodavatel',
        ico: data.ico || '',
        date: data.date || new Date().toISOString().split('T')[0],
        totalAmount: Number(data.totalAmount) || 0,
        vatAmount: Number(data.vatAmount) || 0,
        category: (['material', 'tools', 'subcontractor', 'travel', 'other'].includes(data.category)
          ? data.category
          : 'material') as ExpenseCategory,
        note: data.note || '',
        items: data.items || [],
      });
      if (onToast) onToast('success', 'Účtenka byla úspěšně načtena.');
    } catch (err: any) {
      console.error(err);
      if (onToast) onToast('error', err?.message || 'Chyba při čtení dokladu.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveToExpenses = () => {
    if (!extractedData || extractedData.totalAmount <= 0) {
      if (onToast) onToast('error', 'Zadejte platnou částku výdaje.');
      return;
    }

    const expense: ContractExpense = {
      id: `exp_ai_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      date: extractedData.date,
      title: extractedData.note || `${extractedData.supplier} – nákup`,
      supplier: extractedData.supplier,
      amount: Math.round(extractedData.totalAmount),
      category: extractedData.category,
      receiptPhotoUrl: imagePreview || undefined,
      notes: extractedData.ico ? `IČO: ${extractedData.ico}` : undefined,
      createdAt: new Date().toISOString(),
    };

    onAddExpense(expense);
    if (onToast) onToast('success', 'Náklad byl úspěšně zaevidován do zakázky.');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden my-auto">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-900 text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-amber-400">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base leading-tight">Vytěžování účtenek a faktur</h3>
              <p className="text-xs text-slate-300">
                Vyfoťte paragon ze stavebnin a aplikace automaticky načte položky a částku
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {!imagePreview && (
            <div className="flex flex-col items-center justify-center border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-8 text-center bg-slate-50 dark:bg-slate-950">
              <div className="w-16 h-16 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center mb-4">
                <Camera className="w-8 h-8" />
              </div>
              <h4 className="font-bold text-slate-800 dark:text-white mb-1">
                Vyfoťte nebo nahrajte účtenku / fakturu
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mb-6">
                Např. paragon z DEK, OBI, Hornbach, Bauhaus nebo fakturu za beton, kontejner a materiál.
              </p>

              <div className="flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm shadow-md shadow-emerald-600/20 cursor-pointer transition-all"
                >
                  <Camera className="w-4 h-4" />
                  <span>Vyfotit foťákem</span>
                </button>
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleFileChange}
                  className="hidden"
                />

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold text-sm cursor-pointer transition-all"
                >
                  <Upload className="w-4 h-4" />
                  <span>Nahrát ze souboru</span>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>
            </div>
          )}

          {/* Loading stav */}
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-10 space-y-3">
              <RefreshCw className="w-8 h-8 animate-spin text-emerald-600" />
              <div className="text-sm font-bold text-slate-800 dark:text-slate-200">
                Probíhá čtení dokladu a rozpoznávání částek...
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Automatická kontrola dodavatele, jednotlivých položek a DPH
              </div>
            </div>
          )}

          {/* Výsledky po vytěžení */}
          {imagePreview && !isLoading && extractedData && (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-semibold text-sm">
                  <CheckCircle className="w-5 h-5" />
                  <span>Účtenka úspěšně rozpoznána</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setImagePreview(null);
                    setExtractedData(null);
                  }}
                  className="text-xs text-slate-500 hover:text-red-600 font-medium cursor-pointer"
                >
                  Vyfotit jinou
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Náhled dokladu */}
                <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-950 flex items-center justify-center max-h-56">
                  <img
                    src={imagePreview}
                    alt="Účtenka"
                    className="max-h-56 w-auto object-contain"
                  />
                </div>

                {/* Extrahované údaje v editovatelných polích */}
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1 mb-1">
                      <Building className="w-3.5 h-3.5 text-slate-400" /> Dodavatel / Prodejna:
                    </label>
                    <input
                      type="text"
                      value={extractedData.supplier}
                      onChange={(e) =>
                        setExtractedData({ ...extractedData, supplier: e.target.value })
                      }
                      className="w-full px-3 py-1.5 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1 mb-1">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" /> Datum nákupu:
                      </label>
                      <input
                        type="date"
                        value={extractedData.date}
                        onChange={(e) =>
                          setExtractedData({ ...extractedData, date: e.target.value })
                        }
                        className="w-full px-3 py-1.5 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1 mb-1">
                        <CreditCard className="w-3.5 h-3.5 text-slate-400" /> Částka s DPH:
                      </label>
                      <input
                        type="number"
                        value={extractedData.totalAmount}
                        onChange={(e) =>
                          setExtractedData({
                            ...extractedData,
                            totalAmount: parseFloat(e.target.value) || 0,
                          })
                        }
                        className="w-full px-3 py-1.5 text-sm font-bold text-emerald-600 dark:text-emerald-400 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1 mb-1">
                      <Tag className="w-3.5 h-3.5 text-slate-400" /> Druh nákladu:
                    </label>
                    <select
                      value={extractedData.category}
                      onChange={(e) =>
                        setExtractedData({
                          ...extractedData,
                          category: e.target.value as ExpenseCategory,
                        })
                      }
                      className="w-full px-3 py-1.5 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                    >
                      <option value="material">Materiál na stavbu</option>
                      <option value="tools">Nářadí a spotřební materiál</option>
                      <option value="subcontractor">Subdodávka / pomocník</option>
                      <option value="travel">Doprava a PHM</option>
                      <option value="other">Ostatní provozní</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1 mb-1">
                      <FileText className="w-3.5 h-3.5 text-slate-400" /> Popis / Účel:
                    </label>
                    <input
                      type="text"
                      value={extractedData.note}
                      onChange={(e) =>
                        setExtractedData({ ...extractedData, note: e.target.value })
                      }
                      placeholder="např. Nákup obkladů a lepidla"
                      className="w-full px-3 py-1.5 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                    />
                  </div>
                </div>
              </div>

              {/* Položky z účtenky */}
              {extractedData.items && extractedData.items.length > 0 && (
                <div className="mt-3 p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800">
                  <div className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2">
                    Rozpoznané položky z dokladu ({extractedData.items.length}):
                  </div>
                  <div className="space-y-1 max-h-36 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-900">
                    {extractedData.items.map((it, idx) => (
                      <div key={idx} className="flex justify-between items-center text-xs py-1">
                        <span className="text-slate-800 dark:text-slate-200 truncate pr-2">
                          {it.title}
                        </span>
                        <span className="font-semibold text-slate-900 dark:text-white whitespace-nowrap">
                          {formatCurrency(it.totalPrice)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Zrušit
          </button>
          {extractedData && (
            <button
              type="button"
              onClick={handleSaveToExpenses}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm shadow-md shadow-emerald-600/20 cursor-pointer transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Zaevidovat do nákladů zakázky ({formatCurrency(extractedData.totalAmount)})</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
