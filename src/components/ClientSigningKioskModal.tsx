import React, { useRef, useState, useEffect } from 'react';
import {
  Lock,
  Unlock,
  CheckCircle2,
  RotateCcw,
  ShieldCheck,
  FileText,
  AlertCircle,
  X
} from 'lucide-react';
import { Contract } from '../types/contract';
import { formatCurrency, formatDateCs } from '../utils/numberToWordsCs';
import { triggerHaptic } from '../utils/haptics';

interface ClientSigningKioskModalProps {
  isOpen: boolean;
  onClose: () => void;
  contract: Contract;
  onConfirmSignature: (contractId: string, signatureDataUrl: string) => void;
  onToast: (type: 'success' | 'error' | 'info', message: string) => void;
}

export const ClientSigningKioskModal: React.FC<ClientSigningKioskModalProps> = ({
  isOpen,
  onClose,
  contract,
  onConfirmSignature,
  onToast,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);

  useEffect(() => {
    if (isOpen) {
      // Clear canvas on open
      setTimeout(() => {
        clearCanvas();
      }, 50);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  };

  const getCanvasCoordinates = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    if ('touches' in e) {
      const touch = e.touches[0];
      return {
        x: (touch.clientX - rect.left) * scaleX,
        y: (touch.clientY - rect.top) * scaleY,
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const handleStartDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    setIsDrawing(true);
    setHasSignature(true);
    const { x, y } = getCanvasCoordinates(e);

    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.strokeStyle = '#0F172A';
    ctx.lineWidth = 3.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  };

  const handleDraw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { x, y } = getCanvasCoordinates(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const handleStopDrawing = () => {
    setIsDrawing(false);
  };

  const handleConfirm = () => {
    if (!hasSignature) {
      onToast('error', 'Nejprve se prosím podepište prstem do bílého pole.');
      return;
    }
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dataUrl = canvas.toDataURL('image/png');
    triggerHaptic('success');
    onConfirmSignature(contract.id, dataUrl);
    onToast('success', 'Děkujeme! Podpis objednatele byl úspěšně zaznamenán do smlouvy.');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950 flex flex-col justify-between text-white p-4 sm:p-6 overflow-y-auto animate-in fade-in duration-150">
      {/* Top Security & Kiosk Banner */}
      <div className="max-w-2xl mx-auto w-full flex items-center justify-between pb-3 border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-amber-500 text-slate-950 flex items-center justify-center font-black">
            <Lock className="w-5 h-5 stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono font-black uppercase tracking-wider text-amber-400">
                Klientský podpisový terminál
              </span>
              <span className="text-[10px] font-mono text-slate-500">· Čl. IX § 2586 NOZ</span>
            </div>
            <h2 className="text-sm font-black text-white tracking-tight">
              Předání k podpisu na zařízení zhotovitele
            </h2>
          </div>
        </div>

        <button
          onClick={onClose}
          className="px-3.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 text-xs font-bold font-mono flex items-center gap-1.5 transition-colors cursor-pointer"
          title="Ukončit klientský režim a vrátit se do aplikace"
        >
          <Unlock className="w-3.5 h-3.5 text-amber-400" />
          <span>Zpět k zhotoviteli</span>
        </button>
      </div>

      {/* Contract Summary Box (Safe View) */}
      <div className="max-w-2xl mx-auto w-full my-auto py-4 space-y-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-2xl space-y-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
            <div>
              <span className="text-[10px] font-mono uppercase font-bold text-slate-400 block">Druh dokumentu</span>
              <h3 className="text-base font-black text-white font-mono">
                {contract.docKind === 'quote' ? 'Cenová nabídka' : 'Smlouva o dílo'} #{contract.contractNumber}
              </h3>
            </div>
            <div className="text-right">
              <span className="text-[10px] font-mono uppercase font-bold text-slate-400 block">Cena díla celkem</span>
              <span className="text-xl font-black font-mono tabular-nums text-emerald-400">
                {formatCurrency(contract.price)}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800">
              <span className="text-slate-400 block text-[10px] font-mono uppercase">Objednatel (vy):</span>
              <strong className="text-slate-100 font-bold block mt-0.5">{contract.client.name}</strong>
              {contract.client.address && <p className="text-[11px] text-slate-400 mt-0.5">{contract.client.address}</p>}
            </div>
            <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800">
              <span className="text-slate-400 block text-[10px] font-mono uppercase">Zhotovitel:</span>
              <strong className="text-slate-100 font-bold block mt-0.5">{contract.contractor.name}</strong>
              <p className="text-[11px] font-mono text-slate-400 mt-0.5">IČO: {contract.contractor.ico}</p>
            </div>
          </div>

          <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 text-xs text-slate-300 leading-relaxed max-h-24 overflow-y-auto">
            <span className="text-[10px] font-mono font-bold uppercase text-amber-400 block mb-1">Předmět sjednaného díla:</span>
            {contract.workDescription}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono text-slate-400 pt-1 border-t border-slate-800/80">
            <span>Termín dokončení a předání: <strong className="text-white">{formatDateCs(contract.deliveryDate)}</strong></span>
            <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-bold">Záruka: 24 měsíců dle NOZ</span>
          </div>
        </div>

        {/* Signature Pad Area */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-5 shadow-2xl space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400 stroke-[2.5]" />
              <span className="text-xs font-bold font-mono uppercase tracking-wide text-white">
                Vlastnoruční podpis objednatele:
              </span>
            </div>
            <button
              type="button"
              onClick={clearCanvas}
              className="text-xs font-mono font-bold text-slate-400 hover:text-white px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 transition-colors flex items-center gap-1 cursor-pointer border border-slate-700"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Smazat podpis</span>
            </button>
          </div>

          <div className="relative rounded-lg overflow-hidden border-2 border-slate-700 shadow-inner bg-white touch-none">
            <canvas
              ref={canvasRef}
              width={600}
              height={220}
              className="w-full h-44 sm:h-52 cursor-crosshair block"
              onMouseDown={handleStartDrawing}
              onMouseMove={handleDraw}
              onMouseUp={handleStopDrawing}
              onMouseLeave={handleStopDrawing}
              onTouchStart={handleStartDrawing}
              onTouchMove={handleDraw}
              onTouchEnd={handleStopDrawing}
            />
            {/* Signature baseline guide */}
            <div className="absolute bottom-8 left-6 right-6 border-b border-dashed border-slate-300 pointer-events-none flex justify-between">
              <span className="text-[10px] font-mono text-slate-400 uppercase">Podpisová linka</span>
              <span className="text-[10px] font-mono text-slate-400 uppercase">✕</span>
            </div>

            {!hasSignature && (
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center text-slate-400 text-xs sm:text-sm font-mono font-bold">
                Zde se prosím podepište prstem nebo dotykovým perem…
              </div>
            )}
          </div>

          <p className="text-[11px] font-mono text-slate-400 text-center">
            Svým podpisem potvrzujete převzetí a souhlas se zněním díla v souladu s § 2586 a násl. občanského zákoníku č. 89/2012 Sb.
          </p>
        </div>
      </div>

      {/* Bottom Large Confirm Button */}
      <div className="max-w-2xl mx-auto w-full pt-2 shrink-0">
        <button
          type="button"
          onClick={handleConfirm}
          disabled={!hasSignature}
          className="w-full min-h-[52px] py-3.5 px-6 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 font-black text-sm sm:text-base flex items-center justify-center gap-2 shadow-xl active:scale-98 transition-all cursor-pointer font-mono tracking-wide"
        >
          <CheckCircle2 className="w-5 h-5 stroke-[2.5]" />
          <span>POTVRDIT PODPIS A PŘEDAT ZPĚT ŽIVNOSTNÍKOVI</span>
        </button>
      </div>
    </div>
  );
};
