import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Dialog } from './Dialog';
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
    <Dialog
      title={title}
      subtitle={<>Podepisuje {signerName}</>}
      size="lg"
      bare
      closeOnBackdrop={false}
      onClose={onClose}
    >

        <div className="p-5 space-y-3 overflow-y-auto">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4">
            <span className="text-slate-600 dark:text-slate-400">Podepište se prstem, perem nebo myší.</span>
            {role === 'contractor' && savedContractorSignature && (
              <button
                onClick={handleUseSavedContractorSignature}
                type="button"
                className="min-h-11 inline-flex items-center gap-1.5 font-medium text-blue-600 dark:text-blue-300 underline underline-offset-2 cursor-pointer"
              >
                <FileCheck2 className="w-4 h-4" />
                <span>Použít uložený podpis</span>
              </button>
            )}
          </div>

          {/* Plocha podpisu je vždy bílá, aby byl podpis vidět stejně jako na papíře */}
          <div className="relative border-[1.5px] border-slate-900 dark:border-slate-400 rounded-md bg-white overflow-hidden">
            <canvas
              ref={canvasRef}
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={stopDrawing}
              aria-label="Plocha pro podpis"
              className="w-full h-48 sm:h-56 cursor-crosshair touch-none block"
              style={{ touchAction: 'none' }}
            />
            <div className="pointer-events-none absolute bottom-9 left-6 right-6 border-b border-slate-400 flex justify-between text-[13px] text-slate-600 pb-0.5">
              <span>Podpis</span>
              <span>{new Date().toLocaleDateString('cs-CZ')}</span>
            </div>
            {!hasDrawn && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-slate-500 select-none">
                Sem se podepište
              </div>
            )}
          </div>

          {role === 'contractor' && (
            <label className="min-h-11 flex items-center gap-3 text-slate-900 dark:text-slate-100 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={saveAsDefault}
                onChange={(e) => setSaveAsDefault(e.target.checked)}
                className="w-5 h-5 shrink-0 accent-slate-900 dark:accent-white"
              />
              <span>Uložit jako můj výchozí podpis pro další dokumenty</span>
            </label>
          )}
        </div>

        <div className="px-5 py-4 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2.5 shrink-0">
          <button
            onClick={handleClear}
            type="button"
            className="min-h-11 px-3 inline-flex items-center justify-center gap-1.5 rounded-md border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-medium hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Smazat</span>
          </button>
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={onClose}
              type="button"
              className="min-h-11 px-4 inline-flex items-center justify-center rounded-md border-[1.5px] border-slate-900 dark:border-slate-500 text-slate-900 dark:text-slate-100 font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
            >
              Zrušit
            </button>
            <button
              onClick={handleConfirm}
              disabled={!hasDrawn}
              type="button"
              className="min-h-11 px-4 inline-flex items-center justify-center gap-2 rounded-md border-[1.5px] border-slate-900 bg-amber-400 hover:bg-amber-500 text-slate-900 font-semibold cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Check className="w-[18px] h-[18px]" />
              <span>Vložit podpis</span>
            </button>
          </div>
        </div>
      </Dialog>
  );
};
