import React, { useState, useRef } from 'react';
import {
  X,
  Banknote,
  Check,
  Share2,
  FileText,
  Printer,
  ShieldCheck,
  PenTool,
  RotateCcw,
} from 'lucide-react';
import { Contract, CashReceipt } from '../types/contract';
import { formatCurrency, formatDateCs } from '../utils/numberToWordsCs';
import { triggerHaptic } from '../utils/haptics';
import { safeOpenExternalUrl } from '../utils/shareUtils';

interface QuickCashReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  contract: Contract;
  onUpdateContract: (updated: Contract) => void;
  onOpenFullReceiptView?: (contract: Contract) => void;
  onToast?: (type: 'success' | 'error' | 'info', text: string) => void;
}

export const QuickCashReceiptModal: React.FC<QuickCashReceiptModalProps> = ({
  isOpen,
  onClose,
  contract,
  onUpdateContract,
  onOpenFullReceiptView,
  onToast,
}) => {
  const existingReceipts = contract.cashReceipts || [];
  const nextNumber = `PPD-${new Date().getFullYear()}-${String(existingReceipts.length + 1).padStart(3, '0')}`;

  const totalPaidSoFar = existingReceipts.reduce((sum, r) => sum + (r.amount || 0), 0);
  const remaining = Math.max(0, contract.price - totalPaidSoFar);

  const defaultType = contract.advanceAmount && totalPaidSoFar === 0 ? 'zaloha' : 'doplatek';
  const defaultAmount = defaultType === 'zaloha'
    ? (contract.advanceAmount || Math.round(contract.price * 0.4))
    : (remaining > 0 ? remaining : contract.price);

  const [amount, setAmount] = useState<number | ''>(defaultAmount);
  const [paymentFor, setPaymentFor] = useState<'zaloha' | 'doplatek' | 'plna_castka' | 'viceprace' | 'jine'>(defaultType);
  const [purpose, setPurpose] = useState(
    defaultType === 'zaloha'
      ? `Záloha na materiál a zahájení prací ke smlouvě #${contract.contractNumber}`
      : `Doplatek ceny díla ke smlouvě #${contract.contractNumber}`
  );
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);

  // Signatures on mobile touch
  const [contractorSignature, setContractorSignature] = useState<string | null>(
    contract.contractorSignature || null
  );
  const [clientSignature, setClientSignature] = useState<string | null>(null);
  const [activeSigner, setActiveSigner] = useState<'client' | 'contractor' | null>(null);

  // Success view state after saving
  const [createdReceipt, setCreatedReceipt] = useState<CashReceipt | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawing = useRef(false);

  if (!isOpen) return null;

  const handleSelectPreset = (
    type: 'zaloha' | 'doplatek' | 'plna_castka' | 'viceprace',
    presetAmount: number,
    presetPurpose: string
  ) => {
    triggerHaptic('selection');
    setPaymentFor(type);
    setAmount(presetAmount);
    setPurpose(presetPurpose);
  };

  // Canvas drawing handlers for on-screen touch signature
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    isDrawing.current = true;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    ctx.beginPath();
    ctx.moveTo(clientX - rect.left, clientY - rect.top);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    ctx.lineTo(clientX - rect.left, clientY - rect.top);
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.stroke();
  };

  const stopDrawing = () => {
    isDrawing.current = false;
  };

  const saveCanvasSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    if (activeSigner === 'client') {
      setClientSignature(dataUrl);
    } else if (activeSigner === 'contractor') {
      setContractorSignature(dataUrl);
    }
    setActiveSigner(null);
    triggerHaptic('success');
  };

  const handleClearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const handleCreateReceipt = () => {
    const finalAmount = typeof amount === 'number' ? amount : parseFloat(String(amount));
    if (isNaN(finalAmount) || finalAmount <= 0) {
      if (onToast) onToast('error', 'Zadejte platnou částku v Kč.');
      return;
    }

    triggerHaptic('success');

    const newReceipt: CashReceipt = {
      id: `ppd_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      receiptNumber: nextNumber,
      issueDate: date,
      amount: finalAmount,
      paymentFor,
      purposeDescription: purpose.trim() || `Přijata platba v hotovosti k zakázce #${contract.contractNumber}`,
      receivedFrom: `${contract.client.name}, ${contract.client.address || ''}`.trim(),
      receivedBy: `${contract.contractor.name}, IČO: ${contract.contractor.ico || 'Neuvedeno'}`,
      contractorSignature: contractorSignature || undefined,
      clientSignature: clientSignature || undefined,
      createdAt: new Date().toISOString(),
    };

    const updatedReceipts = [newReceipt, ...existingReceipts];

    // If payment covers the whole contract price, optionally update contract status
    const newTotalPaid = updatedReceipts.reduce((sum, r) => sum + (r.amount || 0), 0);
    const isFullyPaid = newTotalPaid >= contract.price;

    const updatedContract: Contract = {
      ...contract,
      cashReceipts: updatedReceipts,
      status: isFullyPaid ? 'paid' : (contract.status || 'in_progress'),
      paidDate: isFullyPaid ? date : contract.paidDate,
    };

    onUpdateContract(updatedContract);
    setCreatedReceipt(newReceipt);

    if (onToast) {
      onToast('success', `Vystaven doklad ${nextNumber} na částku ${formatCurrency(finalAmount)}.`);
    }
  };

  // WhatsApp confirmation
  const handleShareWhatsApp = (receipt: CashReceipt) => {
    triggerHaptic('success');
    const text =
      `*POTVRZENÍ O PŘEVZETÍ HOTOVOSTI (PPD)*\n` +
      `Doklad č.: *${receipt.receiptNumber}*\n` +
      `Zakázka: #${contract.contractNumber} (${contract.workDescription})\n` +
      `Datum: ${formatDateCs(receipt.issueDate)}\n` +
      `Částka: *${formatCurrency(receipt.amount)}*\n` +
      `Účel: ${receipt.purposeDescription}\n` +
      `Příjemce: ${contract.contractor.name}\n\n` +
      `Příjmový pokladní doklad (PPD) byl řádně vystaven a podepsán. Děkujeme.`;

    const encoded = encodeURIComponent(text);
    const phone = contract.client.phone?.replace(/[^0-9+]/g, '') || '';
    const url = phone ? `https://wa.me/${phone}?text=${encoded}` : `https://wa.me/?text=${encoded}`;
    safeOpenExternalUrl(url);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-xl max-w-xl w-full shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[92vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header - Industrial Cash Receipt */}
        <div className="p-4 sm:p-5 border-b border-slate-800 bg-slate-950 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/40 text-amber-400 flex items-center justify-center shrink-0">
              <Banknote className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-400 text-slate-950">
                  Pokladna
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  #{contract.contractNumber}
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-black text-white mt-0.5">
                Příjmový pokladní doklad (PPD)
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

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {createdReceipt ? (
            /* Confirmation Screen after issuing receipt */
            <div className="space-y-4 text-center py-4">
              <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-950/60 border-2 border-emerald-500 text-emerald-600 mx-auto flex items-center justify-center">
                <Check className="w-8 h-8 stroke-[3]" />
              </div>
              <div>
                <h3 className="text-xl font-black text-slate-900 dark:text-white">
                  PPD vystaven a zaevidován!
                </h3>
                <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 mt-1">
                  Číslo dokladu: <strong className="text-slate-900 dark:text-white">{createdReceipt.receiptNumber}</strong>
                </p>
                <div className="mt-3 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/80 inline-block text-left min-w-[280px]">
                  <p className="text-xs text-emerald-800 dark:text-emerald-300 font-bold uppercase tracking-wider">
                    Přijatá částka
                  </p>
                  <p className="text-2xl font-black text-emerald-700 dark:text-emerald-400">
                    {formatCurrency(createdReceipt.amount)}
                  </p>
                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 font-medium">
                    {createdReceipt.purposeDescription}
                  </p>
                </div>
              </div>

              {/* Instant Actions for Craftsman */}
              <div className="pt-2 flex flex-col sm:flex-row gap-2.5 justify-center max-w-md mx-auto">
                <button
                  type="button"
                  onClick={() => handleShareWhatsApp(createdReceipt)}
                  className="min-h-[46px] px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-sm cursor-pointer active:scale-95 transition-all"
                >
                  <Share2 className="w-4 h-4" />
                  <span>Odeslat potvrzení (WhatsApp)</span>
                </button>

                {onOpenFullReceiptView && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenFullReceiptView(contract);
                    }}
                    className="min-h-[46px] px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-800 dark:text-slate-200 font-extrabold text-sm flex items-center justify-center gap-2 cursor-pointer transition-colors"
                  >
                    <FileText className="w-4 h-4" />
                    <span>Zobrazit / Tisk PPD</span>
                  </button>
                )}
              </div>
            </div>
          ) : (
            /* Creation Form */
            <div className="space-y-4">
              {/* Context bar */}
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
                <div>
                  <span className="text-slate-500 font-medium block">Cena zakázky celkem:</span>
                  <span className="font-extrabold text-slate-900 dark:text-white text-sm">
                    {formatCurrency(contract.price)}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-slate-500 font-medium block">Dosud zaplaceno v hotovosti:</span>
                  <span className="font-extrabold text-emerald-600 dark:text-emerald-400 text-sm">
                    {formatCurrency(totalPaidSoFar)}
                  </span>
                </div>
              </div>

              {/* Fast 1-tap Amount presets */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                  Rychlá volba částky:
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      handleSelectPreset(
                        'zaloha',
                        contract.advanceAmount || Math.round(contract.price * 0.4),
                        `Záloha na materiál a zahájení prací ke smlouvě #${contract.contractNumber}`
                      )
                    }
                    className={`p-2.5 rounded-xl border text-left font-extrabold text-xs cursor-pointer active:scale-95 transition-all ${
                      paymentFor === 'zaloha'
                        ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-850 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <div className="text-2xs text-slate-400 uppercase">Záloha</div>
                    <div className="text-sm font-black">
                      {formatCurrency(contract.advanceAmount || Math.round(contract.price * 0.4))}
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      handleSelectPreset(
                        'doplatek',
                        remaining > 0 ? remaining : contract.price,
                        `Doplatek ceny díla ke smlouvě #${contract.contractNumber}`
                      )
                    }
                    className={`p-2.5 rounded-xl border text-left font-extrabold text-xs cursor-pointer active:scale-95 transition-all ${
                      paymentFor === 'doplatek'
                        ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-850 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <div className="text-2xs text-slate-400 uppercase">Doplatek</div>
                    <div className="text-sm font-black">
                      {formatCurrency(remaining > 0 ? remaining : contract.price)}
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      handleSelectPreset(
                        'viceprace',
                        5000,
                        `Úhrada víceprací a doplňkového materiálu ke smlouvě #${contract.contractNumber}`
                      )
                    }
                    className={`p-2.5 rounded-xl border text-left font-extrabold text-xs cursor-pointer active:scale-95 transition-all col-span-2 sm:col-span-1 ${
                      paymentFor === 'viceprace'
                        ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-850 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <div className="text-2xs text-slate-400 uppercase">Vícepráce</div>
                    <div className="text-sm font-black">5 000 Kč</div>
                  </button>
                </div>
              </div>

              {/* Amount input & Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Přijatá částka (Kč) *
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value === '' ? '' : parseFloat(e.target.value))}
                      className="w-full text-xl font-black px-3.5 py-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-hidden font-mono"
                      placeholder="0"
                    />
                    <span className="absolute right-3.5 top-3.5 text-sm font-bold text-slate-400">
                      Kč
                    </span>
                  </div>

                  {/* 1-klik rychlé předvolby částky */}
                  <div className="flex flex-wrap items-center gap-1.5 mt-2">
                    {remaining > 0 && remaining !== contract.price && (
                      <button
                        type="button"
                        onClick={() => {
                          setAmount(remaining);
                          triggerHaptic('selection');
                        }}
                        className="px-2 py-1 rounded-lg text-xs font-bold bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 transition-colors cursor-pointer"
                        title="Vyplnit přesný zbývající doplatek do plné ceny"
                      >
                        Celý doplatek: {formatCurrency(remaining)}
                      </button>
                    )}
                    {contract.advanceAmount && (
                      <button
                        type="button"
                        onClick={() => {
                          setAmount(contract.advanceAmount!);
                          triggerHaptic('selection');
                        }}
                        className="px-2 py-1 rounded-lg text-xs font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
                        title="Vyplnit dohodnutou zálohu"
                      >
                        Záloha: {formatCurrency(contract.advanceAmount)}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setAmount(Math.round(contract.price * 0.5));
                        triggerHaptic('selection');
                      }}
                      className="px-2 py-1 rounded-lg text-xs font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
                      title="Vyplnit polovinu ceny zakázky"
                    >
                      50 % ({formatCurrency(Math.round(contract.price * 0.5))})
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAmount(contract.price);
                        triggerHaptic('selection');
                      }}
                      className="px-2 py-1 rounded-lg text-xs font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
                      title="Vyplnit celkovou cenu zakázky"
                    >
                      100 % ({formatCurrency(contract.price)})
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Datum převzetí hotovosti
                  </label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full text-sm font-bold px-3.5 py-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white outline-hidden"
                  />
                </div>
              </div>

              {/* Purpose */}
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Účel platby
                </label>
                <input
                  type="text"
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  className="w-full text-xs font-medium px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white outline-hidden"
                />
              </div>

              {/* Direct Touch Signature on Screen */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                    <PenTool className="w-3.5 h-3.5 text-emerald-600" />
                    Podpisy na mobilu (volitelné)
                  </span>
                  <span className="text-2xs text-slate-400 font-medium">
                    Dotykem prstem na displeji
                  </span>
                </div>

                {activeSigner ? (
                  <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span>Podpis: {activeSigner === 'client' ? 'Zákazník (Plátce)' : 'Řemeslník (Příjemce)'}</span>
                      <button
                        type="button"
                        onClick={handleClearSignature}
                        className="text-2xs text-rose-600 hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <RotateCcw className="w-3 h-3" /> Vymazat
                      </button>
                    </div>
                    <canvas
                      ref={canvasRef}
                      width={380}
                      height={120}
                      onMouseDown={startDrawing}
                      onMouseMove={draw}
                      onMouseUp={stopDrawing}
                      onMouseLeave={stopDrawing}
                      onTouchStart={startDrawing}
                      onTouchMove={draw}
                      onTouchEnd={stopDrawing}
                      className="w-full h-28 bg-white rounded-xl border border-dashed border-slate-400 touch-none cursor-crosshair"
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setActiveSigner(null)}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-600 bg-white border border-slate-300 cursor-pointer"
                      >
                        Zrušit
                      </button>
                      <button
                        type="button"
                        onClick={saveCanvasSignature}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 cursor-pointer"
                      >
                        Uložit podpis
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setActiveSigner('contractor')}
                      className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 text-left text-xs font-bold cursor-pointer"
                    >
                      <span className="text-2xs text-slate-400 block">Příjemce (Řemeslník)</span>
                      <span className="text-slate-800 dark:text-slate-200">
                        {contractorSignature ? '✓ Podepsáno' : '+ Podepsat prstem'}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveSigner('client')}
                      className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 text-left text-xs font-bold cursor-pointer"
                    >
                      <span className="text-2xs text-slate-400 block">Plátce (Zákazník)</span>
                      <span className="text-slate-800 dark:text-slate-200">
                        {clientSignature ? '✓ Podepsáno' : '+ Podepsat prstem'}
                      </span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {!createdReceipt && (
          <div className="p-4 sm:p-5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/80 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] px-4 py-2 rounded-xl text-xs sm:text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer"
            >
              Zrušit
            </button>

            <button
              type="button"
              onClick={handleCreateReceipt}
              className="min-h-[44px] px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs sm:text-sm flex items-center gap-2 shadow-md cursor-pointer active:scale-95 transition-all"
            >
              <Check className="w-4 h-4 stroke-[3]" />
              <span>Vystavit a uložit PPD ({nextNumber})</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
