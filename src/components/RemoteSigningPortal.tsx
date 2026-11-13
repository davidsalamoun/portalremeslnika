import React, { useState, useEffect, useRef } from 'react';
import {
  FileText,
  CheckCircle2,
  PenTool,
  RotateCcw,
  ShieldCheck,
  Calendar,
  Building,
  User,
  CreditCard,
  Download,
  AlertCircle,
  Clock,
  Layers,
} from 'lucide-react';
import { getPublicSignShare, submitRemoteClientSignature } from '../utils/signShares';
import { Contract } from '../types/contract';
import { formatCurrency, formatDateCs } from '../utils/numberToWordsCs';
import { getStoredContracts, addStoredContract } from '../utils/storage';

interface RemoteSigningPortalProps {
  shareId: string;
  onBackToApp?: () => void;
}

export const RemoteSigningPortal: React.FC<RemoteSigningPortalProps> = ({
  shareId,
  onBackToApp,
}) => {
  const [contract, setContract] = useState<Contract | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Signature pad
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [signerName, setSignerName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    async function loadShare() {
      setIsLoading(true);
      setError(null);
      try {
        const share = await getPublicSignShare(shareId);
        if (!share) {
          // Zkusit načíst z lokálního úložiště (pokud byl odkaz otevřen na zařízení řemeslníka)
          const localList = getStoredContracts();
          const found = localList.find((c) => c.signToken === shareId);
          if (found) {
            setContract(found);
            setSignerName(found.client?.name || '');
            if (found.clientSignature) {
              setIsSuccess(true);
            }
            setIsLoading(false);
            return;
          }
          throw new Error('Smlouva k podpisu nebyla nalezena nebo odkaz vypršel.');
        }

        if (share.status === 'signed') {
          setIsSuccess(true);
        }
        setContract(share.contract);
        setSignerName(share.contract.client?.name || share.signerName || '');
      } catch (err: any) {
        console.error(err);
        setError(
          typeof err?.message === 'string' && err.message.startsWith('Smlouva k podpisu')
            ? err.message
            : 'Nepodařilo se načíst smlouvu. Zkontrolujte připojení k internetu a zkuste to znovu.'
        );
      } finally {
        setIsLoading(false);
      }
    }

    loadShare();
  }, [shareId]);

  // Canvas drawing handlers (mouse & touch)
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    ctx.beginPath();
    ctx.moveTo(clientX - rect.left, clientY - rect.top);
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    ctx.lineTo(clientX - rect.left, clientY - rect.top);
    ctx.strokeStyle = '#1E3A78';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
    setHasSignature(true);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  };

  const handleSubmitSignature = async () => {
    setFormError(null);
    const canvas = canvasRef.current;
    if (!canvas || !hasSignature) {
      setFormError('Prosím podepište se do rámečku.');
      return;
    }
    if (!signerName.trim()) {
      setFormError('Zadejte prosím své jméno a příjmení.');
      return;
    }

    setIsSubmitting(true);
    try {
      const signatureDataUrl = canvas.toDataURL('image/png');
      const result = await submitRemoteClientSignature(shareId, signatureDataUrl, signerName);
      if (result === 'already_signed') {
        setIsSuccess(true);
        return;
      }
      if (result !== 'signed') {
        setFormError(
          result === 'invalid'
            ? 'Podpis se nepodařilo zpracovat. Zkuste se prosím podepsat znovu.'
            : 'Smlouva k podpisu nebyla nalezena nebo odkaz vypršel. Požádejte prosím o nový odkaz.'
        );
        return;
      }

      const signDate = new Date().toISOString().split('T')[0];

      // Aktualizovat i v lokálním úložišti zhotovitele (pokud je na stejném zařízení)
      const localList = getStoredContracts();
      const existing = localList.find((c) => c.signToken === shareId);
      if (existing) {
        const updated: Contract = {
          ...existing,
          clientSignature: signatureDataUrl,
          clientSignatureDate: signDate,
          status: 'signed' as const,
        };
        addStoredContract(updated);
      }

      // Aktualizovat stav i v tomto okně
      setContract((prev) =>
        prev
          ? {
              ...prev,
              clientSignature: signatureDataUrl,
              clientSignatureDate: signDate,
              status: 'signed' as const,
            }
          : prev
      );

      // Notifikovat ostatní otevřené záložky v prohlížeči
      try {
        window.dispatchEvent(
          new CustomEvent('contract-signed-locally', {
            detail: { id: existing?.id || contract?.id || shareId, signature: signatureDataUrl, date: signDate, signerName },
          })
        );
        window.dispatchEvent(new Event('storage'));
      } catch (e) {
        console.warn('Dispatch failed', e);
      }

      setIsSuccess(true);
    } catch (err: any) {
      console.error(err);
      setFormError('Podpis se nepodařilo odeslat. Zkontrolujte připojení k internetu a zkuste to prosím znovu.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-slate-600 font-medium">Načítám smlouvu k podpisu...</p>
      </div>
    );
  }

  if (error || !contract) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="bg-white p-6 rounded-xl shadow-xl max-w-md w-full text-center border border-slate-200">
          <div className="w-14 h-14 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-3">
            <AlertCircle className="w-7 h-7" />
          </div>
          <h2 className="text-lg font-bold text-slate-900 mb-2">Odkaz nebyl nalezen</h2>
          <p className="text-sm text-slate-600 mb-6">{error || 'Tato smlouva již není dostupná.'}</p>
          {onBackToApp && (
            <button
              onClick={onBackToApp}
              className="px-5 py-2.5 bg-blue-600 text-white rounded-xl font-semibold text-sm cursor-pointer"
            >
              Přejít do aplikace
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 py-6 px-3 sm:px-6 text-slate-100 font-sans">
      <div className="max-w-2xl mx-auto space-y-4">
        {/* Horní hlavička pro zákazníka s ověřením zhotovitele */}
        <div className="bg-slate-900 rounded-xl p-5 shadow-xl border border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-lg bg-amber-500 text-slate-950 flex items-center justify-center font-black shrink-0">
              <ShieldCheck className="w-6 h-6 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono font-black uppercase tracking-wider text-amber-400">
                  Online ověřený podpis
                </span>
              </div>
              <h1 className="text-base font-black text-white font-mono tracking-tight mt-0.5">
                {contract.docKind === 'quote' ? 'Cenová nabídka' : 'Smlouva o dílo'} #{contract.contractNumber}
              </h1>
            </div>
          </div>
          {onBackToApp && (
            <button
              onClick={onBackToApp}
              className="text-xs font-mono font-bold text-slate-400 hover:text-white px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 transition-colors"
            >
              Do aplikace
            </button>
          )}
        </div>

        {/* Shrnutí zakázky a smluvní strany */}
        <div className="bg-slate-900 rounded-xl p-5 shadow-xl border border-slate-800 space-y-4">
          <h2 className="font-mono font-black text-slate-200 text-xs uppercase tracking-wider flex items-center gap-2 border-b border-slate-800 pb-2.5">
            <Building className="w-4 h-4 text-amber-400" />
            Smluvní strany zakázky
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800">
              <div className="text-slate-400 uppercase font-mono font-bold text-[10px]">Zhotovitel díla:</div>
              <div className="font-bold text-slate-100 text-sm mt-0.5">{contract.contractor.name}</div>
              <div className="text-slate-400 font-mono text-[11px] mt-0.5">IČO: {contract.contractor.ico}</div>
              <div className="text-slate-400 font-mono text-[11px]">{contract.contractor.address}</div>
              <div className="text-slate-400 font-mono text-[11px]">{contract.contractor.phone}</div>
            </div>

            <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800">
              <div className="text-slate-400 uppercase font-mono font-bold text-[10px]">Objednatel (vy):</div>
              <div className="font-bold text-slate-100 text-sm mt-0.5">{contract.client.name}</div>
              <div className="text-slate-400 text-[11px] mt-0.5">{contract.client.address}</div>
              <div className="text-slate-400 font-mono text-[11px]">{contract.client.phone}</div>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-800">
            <div className="text-slate-400 uppercase font-mono font-bold text-[10px]">Předmět a rozsah prováděného díla:</div>
            <p className="text-xs text-slate-300 mt-1 whitespace-pre-line leading-relaxed bg-slate-950 p-3 rounded-lg border border-slate-800 font-mono">
              {contract.workDescription}
            </p>
          </div>

          {/* Položky pokud existují */}
          {contract.items && contract.items.length > 0 && (
            <div className="pt-2 border-t border-slate-800">
              <div className="text-slate-400 uppercase font-mono font-bold text-[10px] mb-2 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-amber-400" /> Položkový rozpis prací:
              </div>
              <div className="divide-y divide-slate-800 text-xs max-h-36 overflow-y-auto pr-1">
                {contract.items.map((it) => (
                  <div key={it.id} className="py-1.5 flex justify-between items-center">
                    <span className="text-slate-300">
                      {it.title} ({it.quantity} {it.unit})
                    </span>
                    <span className="font-mono font-bold text-slate-100">
                      {formatCurrency(it.totalPrice)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Cena a termín */}
          <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-800">
            <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
              <div className="text-[10px] font-mono font-black text-amber-400 uppercase">Cena díla celkem:</div>
              <div className="text-lg font-mono font-black text-white mt-0.5">
                {formatCurrency(contract.price)}
              </div>
              <div className="text-[10px] text-slate-500 font-mono">
                {contract.hasVat ? 'včetně DPH' : 'neplátce DPH'}
              </div>
            </div>

            <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
              <div className="text-[10px] font-mono font-black text-slate-400 uppercase">Termín dokončení:</div>
              <div className="text-sm font-mono font-bold text-white mt-0.5">
                {formatDateCs(contract.deliveryDate)}
              </div>
              {contract.advanceAmount ? (
                <div className="text-[10px] font-mono text-emerald-400 mt-0.5">
                  Záloha: {formatCurrency(contract.advanceAmount)}
                </div>
              ) : (
                <div className="text-[10px] font-mono text-slate-500 mt-0.5">Záruka: 24 měsíců</div>
              )}
            </div>
          </div>
        </div>

        {/* Podpisová sekce */}
        {isSuccess ? (
          <div className="bg-slate-900 border border-emerald-500/50 rounded-xl p-6 text-center space-y-3.5 shadow-2xl">
            <div className="w-14 h-14 bg-emerald-500 text-slate-950 rounded-xl flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/20 font-black">
              <CheckCircle2 className="w-8 h-8 stroke-[2.5]" />
            </div>
            <h3 className="font-black text-lg text-white">Dokument byl úspěšně podepsán!</h3>
            <p className="text-xs text-slate-300 max-w-sm mx-auto leading-relaxed">
              Váš elektronický podpis byl zaznamenán. Zhotovitel obdržel potvrzení a podepsané vyhotovení smlouvy.
            </p>
            <div className="pt-2">
              <button
                onClick={() => window.print()}
                className="h-10 px-5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs inline-flex items-center gap-2 shadow-md cursor-pointer transition-colors"
              >
                <Download className="w-4 h-4 text-slate-950" />
                <span>Vytisknout / Uložit PDF smlouvy</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-slate-900 rounded-xl p-5 shadow-xl border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-mono font-bold text-slate-200 text-xs uppercase tracking-wide flex items-center gap-1.5">
                <PenTool className="w-4 h-4 text-amber-400" />
                Váš podpis (prstem na displeji telefonu nebo myší):
              </h3>
              {hasSignature && (
                <button
                  type="button"
                  onClick={clearSignature}
                  className="text-xs font-mono font-bold text-slate-400 hover:text-rose-400 flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Smazat</span>
                </button>
              )}
            </div>

            {/* Signature Canvas */}
            <div className="border-2 border-slate-700 rounded-lg bg-white overflow-hidden relative touch-none shadow-inner">
              <canvas
                ref={canvasRef}
                width={500}
                height={160}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
                className="w-full h-40 cursor-crosshair block"
              />
              {/* Baseline */}
              <div className="absolute bottom-6 left-6 right-6 border-b border-dashed border-slate-300 pointer-events-none flex justify-between">
                <span className="text-[10px] font-mono text-slate-400 uppercase">Podpisová linka</span>
                <span className="text-[10px] font-mono text-slate-400">✕</span>
              </div>
              {!hasSignature && (
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center text-slate-400 text-xs font-mono font-medium gap-1.5">
                  <PenTool className="w-3.5 h-3.5 opacity-60" />
                  <span>Sem nakreslete svůj podpis (prstem nebo myší)</span>
                </div>
              )}
            </div>

            <div>
              <label className="text-[11px] font-mono uppercase font-bold text-slate-400 block mb-1">
                Jméno a příjmení podepisujícího:
              </label>
              <input
                type="text"
                value={signerName}
                onChange={(e) => setSignerName(e.target.value)}
                placeholder="Jan Novák"
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-700 bg-slate-950 text-white font-mono focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
              />
            </div>

            {formError && (
              <div className="p-3 rounded-lg bg-rose-950/60 border border-rose-800 text-rose-300 text-xs flex items-center gap-2 font-mono">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{formError}</span>
              </div>
            )}

            <div className="pt-2">
              <button
                type="button"
                onClick={handleSubmitSignature}
                disabled={isSubmitting || !hasSignature}
                className="w-full py-3.5 px-4 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-sm shadow-xl disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer transition-all font-mono tracking-wide"
              >
                <ShieldCheck className="w-4 h-4 stroke-[2.5]" />
                <span>{isSubmitting ? 'Ukládám podpis…' : 'PRÁVNĚ ZÁVAZNĚ PODEPSAT SMLOUVU'}</span>
              </button>
            </div>

            <p className="text-[11px] text-slate-500 text-center font-sans">
              Elektronický podpis podle nařízení eIDAS a § 561 odst. 1 občanského zákoníku č. 89/2012 Sb.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
