import React, { useRef, useState, useEffect, useCallback } from 'react';
import { PenTool, RotateCcw, Check, X, ShieldCheck, FileCheck2 } from 'lucide-react';

interface SignatureModalProps {
  isOpen: boolean;
  title: string;
  signerName: string;
  role: 'contractor' | 'client';
  initialSignature?: string;
  savedContractorSignature?: string;
  onSave: (signatureDataUrl: string, saveAsDefaultContractor?: boolean) => void;
  onClose: () => void;
}

export const SignatureModal: React.FC<SignatureModalProps> = ({
  isOpen,
  title,
  signerName,
  role,
  initialSignature,
  savedContractorSignature,
  onSave,
  onClose,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [saveAsDefault, setSaveAsDefault] = useState(false);

  // Inicializace a vyčištění canvasu
  const initCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Nastavení reálného rozlišení pro ostré vykreslení (retina)
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 2;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;

    ctx.scale(dpr, dpr);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#0F172A'; // Velmi tmavě modrá / grafitová
    ctx.lineWidth = 2.5;

    // Pokud je k dispozici počáteční podpis, nakreslíme ho
    if (initialSignature) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, rect.width, rect.height);
        setHasDrawn(true);
      };
      img.src = initialSignature;
    } else {
      setHasDrawn(false);
    }
  }, [initialSignature]);

  useEffect(() => {
    if (isOpen) {
      // Malý timeout pro jistotu, že je modal vyrenderován a má reálné rozměry
      const timer = setTimeout(() => {
        initCanvas();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen, initCanvas]);

  if (!isOpen) return null;

  const getCoordinates = (e: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();

    if ('touches' in e && e.touches.length > 0) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      };
    } else if ('clientX' in e) {
      return {
        x: (e as MouseEvent).clientX - rect.left,
        y: (e as MouseEvent).clientY - rect.top,
      };
    }
    return { x: 0, y: 0 };
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { x, y } = getCoordinates(e.nativeEvent);
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
    setHasDrawn(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { x, y } = getCoordinates(e.nativeEvent);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = (e?: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (e) e.preventDefault();
    setIsDrawing(false);
  };

  const handleClear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 2;
    ctx.clearRect(0, 0, rect.width * dpr, rect.height * dpr);
    setHasDrawn(false);
  };

  const handleUseSavedContractorSignature = () => {
    if (!savedContractorSignature) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 2;
    ctx.clearRect(0, 0, rect.width * dpr, rect.height * dpr);

    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0, rect.width, rect.height);
      setHasDrawn(true);
    };
    img.src = savedContractorSignature;
  };

  const handleConfirm = () => {
    const canvas = canvasRef.current;
    if (!canvas || !hasDrawn) return;

    // Export do PNG s průhledným pozadím
    const dataUrl = canvas.toDataURL('image/png');
    onSave(dataUrl, role === 'contractor' ? saveAsDefault : false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 max-w-lg w-full overflow-hidden flex flex-col">
        {/* Hlavička */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/80 text-[#1E3A78] dark:text-blue-300 flex items-center justify-center">
              <PenTool className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-base">
                {title}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Podepisující: <strong className="text-slate-800 dark:text-slate-200">{signerName}</strong>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Instrukce */}
        <div className="px-5 pt-3 pb-1 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <span>Podepište se prstem, stylusem nebo myší do pole níže:</span>
          {role === 'contractor' && savedContractorSignature && (
            <button
              onClick={handleUseSavedContractorSignature}
              type="button"
              className="inline-flex items-center gap-1 text-[#1E3A78] dark:text-blue-400 font-semibold hover:underline cursor-pointer"
            >
              <FileCheck2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span>Použít uložený podpis</span>
            </button>
          )}
        </div>

        {/* Kreslicí plocha (Canvas) */}
        <div className="px-5 py-2">
          <div className="relative border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-blue-400 dark:hover:border-blue-500 rounded-xl bg-slate-50/70 dark:bg-slate-950/80 overflow-hidden transition-colors">
            <canvas
              ref={canvasRef}
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={stopDrawing}
              className="w-full h-44 sm:h-52 cursor-crosshair touch-none block"
              style={{ touchAction: 'none' }}
            />

            {/* Pomocná linka podpisu */}
            <div className="pointer-events-none absolute bottom-9 left-8 right-8 border-b border-slate-300 dark:border-slate-700 flex justify-between text-[10px] text-slate-400 pb-0.5">
              <span>✕ Váš podpis</span>
              <span>Datum: {new Date().toLocaleDateString('cs-CZ')}</span>
            </div>

            {!hasDrawn && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-slate-400 dark:text-slate-600 text-sm select-none">
                Zde nakreslete podpis
              </div>
            )}
          </div>
        </div>

        {/* Možnosti a tlačítka */}
        <div className="px-5 py-4 bg-slate-50/60 dark:bg-slate-950/40 border-t border-slate-100 dark:border-slate-800 space-y-3">
          {role === 'contractor' && (
            <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={saveAsDefault}
                onChange={(e) => setSaveAsDefault(e.target.checked)}
                className="w-4 h-4 rounded text-[#1E3A78] focus:ring-blue-500 border-slate-300 dark:border-slate-700"
              />
              <span>Uložit tento podpis jako můj výchozí (pro budoucí smlouvy a protokoly)</span>
            </label>
          )}

          <div className="flex items-center justify-between gap-3">
            <button
              onClick={handleClear}
              type="button"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Smazat</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                onClick={onClose}
                type="button"
                className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-400 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Zrušit
              </button>

              <button
                onClick={handleConfirm}
                disabled={!hasDrawn}
                type="button"
                className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-[#1E3A78] dark:bg-blue-600 hover:bg-[#162c5c] dark:hover:bg-blue-500 text-white text-xs font-bold shadow-md shadow-blue-900/15 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Check className="w-4 h-4" />
                <span>Vložit podpis do dokumentu</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
