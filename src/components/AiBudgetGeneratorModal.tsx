import React, { useState, useRef } from 'react';
import {
  X,
  Calculator,
  Mic,
  MicOff,
  Upload,
  Camera,
  Check,
  Plus,
  RefreshCw,
  AlertCircle,
  FileText,
  Layers,
  Info,
} from 'lucide-react';
import { BudgetItem } from '../types/contract';
import { formatCurrency } from '../utils/numberToWordsCs';
import { compressImageFile } from '../utils/imageCompression';

interface AiBudgetGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddItems: (items: BudgetItem[]) => void;
  onToast?: (type: 'success' | 'error' | 'info', text: string) => void;
}

const PRESET_PROMPTS = [
  'Rekonstrukce koupelny 5 m² – vybourání dlažby, penetrace, hydroizolace, obklady 25 m², dlažba, montáž sprchového koutu a umyvadla.',
  'Sádrokartonový podhled 40 m² – montáž CD/UD profilů, minerální vata 160 mm, parozábrana, SDK desky, tmelení Q3 a přebroušení.',
  'Pokládka vinylové podlahy 35 m² – stržení starého PVC, nivelace podlahy 3-5 mm, penetrace, pokládka click vinylu a obvodové lišty.',
  'Malování bytu 75 m² – oškrábání nesoudržné malby, penetrační nátěr, tmelení děr a trhlin, 2x bílý otěruvzdorný nátěr.',
  'Zhotovení zámkové dlažby 50 m² – výkop 30 cm, štěrkový podsyp frakce 16/32 a 4/8, obrubníky do betonu, pokládka dlažby 6 cm a zapískování.',
];

export const AiBudgetGeneratorModal: React.FC<AiBudgetGeneratorModalProps> = ({
  isOpen,
  onClose,
  onAddItems,
  onToast,
}) => {
  const [prompt, setPrompt] = useState('');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [generatedItems, setGeneratedItems] = useState<BudgetItem[]>([]);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [summary, setSummary] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);

  if (!isOpen) return null;

  // Hlasové zadávání pomocí Web Speech API
  const toggleRecording = () => {
    if (isRecording) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsRecording(false);
      return;
    }

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      if (onToast) onToast('error', 'Váš prohlížeč nepodporuje hlasové zadávání.');
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'cs-CZ';
      recognition.continuous = true;
      recognition.interimResults = true;

      recognition.onstart = () => {
        setIsRecording(true);
        if (onToast) onToast('info', 'Mluvte, poslouchám vaše zadání...');
      };

      recognition.onresult = (event: any) => {
        let transcript = '';
        for (let i = 0; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript + ' ';
        }
        setPrompt((prev) => {
          const base = prev.trim() ? prev + ' ' : '';
          return (base + transcript).trim();
        });
      };

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error', event);
        setIsRecording(false);
        if (onToast) onToast('error', 'Chyba rozpoznávání hlasu.');
      };

      recognition.onend = () => {
        setIsRecording(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.error(err);
      setIsRecording(false);
    }
  };

  // Zpracování obrázku (fotka náčrtku)
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      if (onToast) onToast('error', 'Vyberte platný obrázek (JPG, PNG).');
      return;
    }

    // Zmenšení fotky před odesláním (limit velikosti požadavku na serveru)
    compressImageFile(file, 1600, 1600, 0.8)
      .then((base64) => setImagePreview(base64))
      .catch(() => {
        if (onToast) onToast('error', 'Fotku se nepodařilo načíst. Zkuste to prosím znovu.');
      });
  };

  // Volání AI na serveru
  const handleGenerate = async () => {
    if (!prompt.trim() && !imagePreview) {
      if (onToast) onToast('error', 'Zadejte popis prací nebo nahrajte fotku náčrtku.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch('/api/ai/budget-from-input', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          textPrompt: prompt.trim(),
          imageBase64: imagePreview || undefined,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Generování rozpočtu selhalo');
      }

      const data = await res.json();
      if (!data.items || !Array.isArray(data.items)) {
        throw new Error('Server vrátil neplatný formát položek.');
      }

      const formatted: BudgetItem[] = data.items.map((it: any, idx: number) => ({
        id: `ai_item_${Date.now()}_${idx}`,
        type: it.type === 'material' ? 'material' : it.type === 'ostatni' ? 'ostatni' : 'prace',
        title: it.title || 'Položka rozpočtu',
        quantity: Math.max(0.1, Number(it.quantity) || 1),
        unit: it.unit || 'ks',
        unitPrice: Math.round(Number(it.unitPrice) || 0),
        totalPrice: Math.round((Number(it.quantity) || 1) * (Number(it.unitPrice) || 0)),
      }));

      setGeneratedItems(formatted);
      setSelectedIndices(new Set(formatted.map((_, i) => i)));
      setSummary(data.summary || '');
      if (onToast) onToast('success', `Rozpočet byl úspěšně sestaven (${formatted.length} položek)`);
    } catch (err: any) {
      console.error(err);
      if (onToast) onToast('error', err?.message || 'Nastala chyba při zpracování zadání.');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleSelectIndex = (idx: number) => {
    setSelectedIndices((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedIndices.size === generatedItems.length) {
      setSelectedIndices(new Set());
    } else {
      setSelectedIndices(new Set(generatedItems.map((_, i) => i)));
    }
  };

  const handleImport = () => {
    const itemsToImport = generatedItems.filter((_, idx) => selectedIndices.has(idx));
    if (itemsToImport.length === 0) {
      if (onToast) onToast('error', 'Vyberte alespoň jednu položku k vložení.');
      return;
    }
    onAddItems(itemsToImport);
    if (onToast) onToast('success', `Do rozpočtu bylo vloženo ${itemsToImport.length} položek.`);
    onClose();
  };

  const totalSelectedSum = generatedItems
    .filter((_, i) => selectedIndices.has(i))
    .reduce((sum, it) => sum + it.totalPrice, 0);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl w-full max-w-3xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden my-auto">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-900 text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-amber-400">
              <Calculator className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base leading-tight">Automatický rozpočtář zakázky</h3>
              <p className="text-xs text-slate-300">
                Položkový rozpočet z hlasového popisu, fotky náčrtku nebo textu zadání
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
          {/* Zadávací sekce */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                Popište zakázku nebo nadiktujte hlasem:
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={toggleRecording}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                    isRecording
                      ? 'bg-red-600 text-white animate-pulse shadow-md shadow-red-500/30'
                      : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  {isRecording ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5 text-blue-600" />}
                  <span>{isRecording ? 'Zastavit nahrávání' : 'Diktovat hlasem'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 cursor-pointer"
                >
                  <Camera className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Přidat náčrtek</span>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
              </div>
            </div>

            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Např.: Koupelna 2,5 × 3 m, vybourat staré obklady a dlažbu, nová hydroizolace a penetrace, položit velkoformátové obklady 60x60 do výšky 2,2 m, usadit vanu a podomítkovou baterii, úklid a odvoz suti..."
              rows={4}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder-slate-400 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
            />

            {/* Náhled přiloženého obrázku */}
            {imagePreview && (
              <div className="relative inline-block border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden shadow-xs">
                <img
                  src={imagePreview}
                  alt="Náčrtek stavby"
                  className="h-28 w-auto object-cover max-w-full"
                />
                <button
                  type="button"
                  onClick={() => setImagePreview(null)}
                  className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-1 hover:bg-red-700 shadow-md cursor-pointer"
                  title="Odstranit obrázek"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
                <span className="absolute bottom-1 left-1 bg-black/70 text-white text-[10px] px-1.5 py-0.5 rounded-sm">
                  Přiložený náčrtek
                </span>
              </div>
            )}

            {/* Rychlé předvolby */}
            <div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mb-1.5 font-medium">
                Nebo vyberte vzorový projekt:
              </div>
              <div className="flex flex-wrap gap-1.5">
                {PRESET_PROMPTS.map((p, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setPrompt(p)}
                    className="text-xs bg-slate-100 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-950/60 hover:text-blue-700 dark:hover:text-blue-300 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-left transition-colors cursor-pointer"
                  >
                    {p.split('–')[0]?.trim()}
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={handleGenerate}
                disabled={isLoading || (!prompt.trim() && !imagePreview)}
                className="w-full py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-slate-950 font-black text-sm shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer transition-all"
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Rozpočtář počítá výměry a kalkuluje položky...</span>
                  </>
                ) : (
                  <>
                    <Calculator className="w-4 h-4" />
                    <span>Spočítat položkový rozpočet ze zadání</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Výsledky vygenerovaného rozpočtu */}
          {generatedItems.length > 0 && (
            <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Layers className="w-4 h-4 text-blue-600" />
                    Navržené položky ({generatedItems.length})
                  </h4>
                  {summary && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{summary}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium cursor-pointer"
                >
                  {selectedIndices.size === generatedItems.length ? 'Zrušit výběr' : 'Vybrat vše'}
                </button>
              </div>

              {/* Seznam položek */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-800 bg-slate-50/50 dark:bg-slate-950/50 max-h-72 overflow-y-auto">
                {generatedItems.map((item, idx) => {
                  const isChecked = selectedIndices.has(idx);
                  return (
                    <div
                      key={item.id}
                      onClick={() => toggleSelectIndex(idx)}
                      className={`p-3 flex items-center gap-3 transition-colors cursor-pointer select-none ${
                        isChecked
                          ? 'bg-blue-50/70 dark:bg-blue-950/30'
                          : 'hover:bg-slate-100 dark:hover:bg-slate-900'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {}}
                        className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded-sm ${
                              item.type === 'prace'
                                ? 'bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300'
                                : item.type === 'material'
                                ? 'bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300'
                                : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                            }`}
                          >
                            {item.type === 'prace' ? 'Práce' : item.type === 'material' ? 'Materiál' : 'Ostatní'}
                          </span>
                          <span className="font-semibold text-sm text-slate-900 dark:text-slate-100 truncate">
                            {item.title}
                          </span>
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          {item.quantity} {item.unit} × {formatCurrency(item.unitPrice)}
                        </div>
                      </div>
                      <div className="text-right font-bold text-sm text-slate-900 dark:text-white whitespace-nowrap">
                        {formatCurrency(item.totalPrice)}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Spodní součet vybraných položek */}
              <div className="flex items-center justify-between p-3 bg-slate-100 dark:bg-slate-800 rounded-xl">
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Vybráno k vložení ({selectedIndices.size} položek):
                </span>
                <span className="text-base font-bold text-[#1E3A78] dark:text-blue-400">
                  {formatCurrency(totalSelectedSum)}
                </span>
              </div>
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
            Zavřít
          </button>
          {generatedItems.length > 0 && (
            <button
              type="button"
              onClick={handleImport}
              disabled={selectedIndices.size === 0}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm shadow-md shadow-blue-600/20 disabled:opacity-50 cursor-pointer transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Vložit vybrané položky do rozpočtu</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
