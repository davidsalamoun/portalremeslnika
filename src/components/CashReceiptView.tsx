import React, { useState } from 'react';
import {
  Banknote,
  Calendar,
  Printer,
  FileDown,
  Share2,
  Check,
  PenTool,
  Plus,
  Trash2,
  FileText,
  User,
  ShieldCheck,
  X,
} from 'lucide-react';
import { Contract, CashReceipt } from '../types/contract';
import {
  formatCurrency,
  formatDateCs,
  formatContractPriceWithWords,
  formatPlaceWithPreposition,
  amountInWordsCzk,
} from '../utils/numberToWordsCs';
import { SignatureModal } from './SignatureModal';
import { CraftsmanStamp } from './CraftsmanStamp';

interface CashReceiptViewProps {
  contract: Contract;
  onUpdateContract: (updated: Contract) => void;
  onToast?: (type: 'success' | 'error' | 'info', text: string) => void;
  initialOpenNew?: boolean;
  initialPaymentFor?: 'zaloha' | 'doplatek' | 'plna_castka' | 'viceprace';
}

export const CashReceiptView: React.FC<CashReceiptViewProps> = ({
  contract,
  onUpdateContract,
  onToast,
  initialOpenNew = false,
  initialPaymentFor,
}) => {
  const receipts = contract.cashReceipts || [];
  const [selectedReceiptId, setSelectedReceiptId] = useState<string | null>(
    receipts.length > 0 ? receipts[receipts.length - 1].id : null
  );
  const [isNewModalOpen, setIsNewModalOpen] = useState(initialOpenNew);
  const [signModalRole, setSignModalRole] = useState<'contractor' | 'client' | null>(null);

  // New receipt form state
  const nextNumber = `PPD-${contract.contractNumber.replace(/[^0-9]/g, '') || new Date().getFullYear()}-${String(
    receipts.length + 1
  ).padStart(2, '0')}`;

  const totalAmendments = contract.amendments?.reduce((s, a) => s + (a.priceDifference || 0), 0) || 0;
  const totalAdjustedPrice = contract.price + totalAmendments;
  const remainingToPay = Math.max(
    0,
    totalAdjustedPrice - (contract.advanceAmount || 0)
  );

  const initialFor = initialPaymentFor || (contract.advanceAmount ? 'zaloha' : 'plna_castka');
  const initialAmt = initialFor === 'zaloha'
    ? (contract.advanceAmount || Math.round(contract.price * 0.4))
    : initialFor === 'doplatek'
    ? (remainingToPay > 0 ? remainingToPay : totalAdjustedPrice)
    : totalAdjustedPrice;

  const [formNumber, setFormNumber] = useState(nextNumber);
  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0]);
  const [formAmount, setFormAmount] = useState<number | ''>(initialAmt);
  const [formPaymentFor, setFormPaymentFor] = useState<
    'zaloha' | 'doplatek' | 'plna_castka' | 'viceprace' | 'jine'
  >(initialFor);
  const [formPurpose, setFormPurpose] = useState(
    initialFor === 'zaloha'
      ? `Záloha na materiál ke smlouvě o dílo č. ${contract.contractNumber}`
      : initialFor === 'doplatek'
      ? `Doplatek ceny díla dle vyúčtovací faktury ke smlouvě č. ${contract.contractNumber}`
      : `Úhrada ceny díla ke smlouvě o dílo č. ${contract.contractNumber}`
  );

  const selectedReceipt = receipts.find((r) => r.id === selectedReceiptId) || receipts[0];

  const handleSelectPreset = (preset: 'zaloha' | 'doplatek' | 'plna' | 'viceprace') => {
    if (preset === 'zaloha') {
      setFormPaymentFor('zaloha');
      setFormAmount(contract.advanceAmount || Math.round(contract.price * 0.4));
      setFormPurpose(`Záloha na materiál a zahájení prací ke smlouvě č. ${contract.contractNumber}`);
    } else if (preset === 'doplatek') {
      setFormPaymentFor('doplatek');
      setFormAmount(remainingToPay > 0 ? remainingToPay : contract.price);
      setFormPurpose(`Doplatek ceny díla dle vyúčtovací faktury ke smlouvě č. ${contract.contractNumber}`);
    } else if (preset === 'plna') {
      setFormPaymentFor('plna_castka');
      setFormAmount(contract.price);
      setFormPurpose(`Kompletní úhrada díla ke smlouvě č. ${contract.contractNumber}`);
    } else if (preset === 'viceprace') {
      setFormPaymentFor('viceprace');
      const extra = contract.amendments?.reduce((s, a) => s + (a.priceDifference || 0), 0) || 0;
      setFormAmount(extra > 0 ? extra : 5000);
      setFormPurpose(`Úhrada víceprací dle dodatku ke smlouvě č. ${contract.contractNumber}`);
    }
  };

  const handleCreateReceipt = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = typeof formAmount === 'number' ? formAmount : 0;
    if (amt <= 0) {
      onToast?.('error', 'Zadejte platnou částku v Kč');
      return;
    }

    const newReceipt: CashReceipt = {
      id: `ppd_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      receiptNumber: formNumber.trim() || nextNumber,
      issueDate: formDate || new Date().toISOString().split('T')[0],
      amount: amt,
      paymentFor: formPaymentFor,
      purposeDescription: formPurpose.trim(),
      receivedFrom: contract.client.name,
      receivedBy: contract.contractor.name,
      contractorSignature: contract.contractor.signature || contract.contractorSignature,
      createdAt: new Date().toISOString(),
    };

    const updatedList = [...receipts, newReceipt];
    onUpdateContract({ ...contract, cashReceipts: updatedList });
    setSelectedReceiptId(newReceipt.id);
    setIsNewModalOpen(false);
    onToast?.('success', `Příjmový pokladní doklad ${newReceipt.receiptNumber} byl vystaven`);
  };

  const handleDeleteReceipt = (id: string) => {
    let confirmed = true;
    try {
      confirmed = window.confirm('Opravdu chcete tento pokladní doklad smazat?');
    } catch {
      confirmed = true;
    }
    if (confirmed) {
      const updated = receipts.filter((r) => r.id !== id);
      onUpdateContract({ ...contract, cashReceipts: updated });
      if (selectedReceiptId === id) {
        setSelectedReceiptId(updated.length > 0 ? updated[0].id : null);
      }
      onToast?.('info', 'Pokladní doklad byl smazán');
    }
  };

  const handleSaveSignature = (sigUrl: string) => {
    if (!selectedReceipt) return;
    const isContr = signModalRole === 'contractor';
    const updatedList = receipts.map((r) => {
      if (r.id !== selectedReceipt.id) return r;
      return {
        ...r,
        ...(isContr ? { contractorSignature: sigUrl } : { clientSignature: sigUrl }),
      };
    });

    onUpdateContract({ ...contract, cashReceipts: updatedList });
    setSignModalRole(null);
    onToast?.('success', `Podpis na pokladním dokladu byl uložen`);
  };

  const totalCashCollected = receipts.reduce((sum, r) => sum + (r.amount || 0), 0);

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="p-5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-mono text-slate-500 dark:text-slate-400">
            <span>Příjmové pokladní doklady (PPD)</span>
            <span aria-hidden="true">·</span>
            <span>Hotovostní platby</span>
          </div>
          <h2 className="text-xl font-extrabold text-slate-900 dark:text-slate-100">
            Platby v hotovosti ke smlouvě č. {contract.contractNumber}
          </h2>
          <p className="text-xs text-slate-600 dark:text-slate-300 max-w-2xl">
            Přebíráte od klienta zálohu nebo doplatek v hotovosti na stavbě? Vystavte oficiální příjmový pokladní doklad s částkou vypsanou slovy a podpisy obou stran.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => {
              setFormNumber(`PPD-${contract.contractNumber.replace(/[^0-9]/g, '') || new Date().getFullYear()}-${String(receipts.length + 1).padStart(2, '0')}`);
              setIsNewModalOpen(true);
            }}
            className="h-10 px-4 text-xs font-bold rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-xs inline-flex items-center gap-2 transition-colors cursor-pointer"
          >
            <Banknote className="w-4 h-4 text-slate-950" />
            <span>+ Vystavit pokladní doklad</span>
          </button>
        </div>
      </div>

      {/* Stats summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-3.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="text-xs text-slate-500 dark:text-slate-400">Celková cena zakázky</div>
          <div className="text-lg font-bold text-slate-900 dark:text-slate-100 mt-0.5">
            {formatCurrency(contract.price)}
          </div>
          <div className="text-[11px] text-slate-400">Ze smlouvy o dílo</div>
        </div>

        <div className="p-3.5 bg-emerald-50/60 dark:bg-emerald-950/40 rounded-xl border border-emerald-200 dark:border-emerald-900/60 shadow-sm">
          <div className="text-xs text-emerald-700 dark:text-emerald-300 font-semibold flex items-center gap-1">
            <Banknote className="w-3.5 h-3.5" />
            Přijato v hotovosti ({receipts.length} dokladů)
          </div>
          <div className="text-lg font-bold text-emerald-700 dark:text-emerald-300 mt-0.5">
            {formatCurrency(totalCashCollected)}
          </div>
          <div className="text-[11px] text-emerald-600 dark:text-emerald-400">Podložené pokladními doklady</div>
        </div>

        <div className="p-3.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="text-xs text-slate-500 dark:text-slate-400">Zbývá doplatit</div>
          <div className="text-lg font-bold text-slate-900 dark:text-slate-100 mt-0.5">
            {formatCurrency(Math.max(0, contract.price - totalCashCollected))}
          </div>
          <div className="text-[11px] text-slate-400">Před vyúčtováním</div>
        </div>
      </div>

      {/* Receipt switcher */}
      {receipts.length > 1 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {receipts.map((r) => (
            <button
              key={r.id}
              onClick={() => setSelectedReceiptId(r.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                selectedReceipt?.id === r.id
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              {r.receiptNumber} ({formatCurrency(r.amount)})
            </button>
          ))}
        </div>
      )}

      {/* Empty state or Document paper */}
      {receipts.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-800">
          <Banknote className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
            Zatím jste nevystavili žádný pokladní doklad
          </h3>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto mt-1 mb-5">
            Při převzetí peněz v hotovosti na ruku (např. záloha na nákup dlažby, oken či materiálu) vystavte klientovi stvrzenku.
          </p>
          <button
            type="button"
            onClick={() => setIsNewModalOpen(true)}
            className="px-4 py-2 text-xs sm:text-sm font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm inline-flex items-center gap-2"
          >
            <Banknote className="w-4 h-4" />
            Vystavit první pokladní doklad
          </button>
        </div>
      ) : selectedReceipt ? (
        <div className="space-y-4">
          {/* Action bar */}
          <div className="no-print flex flex-wrap items-center justify-between gap-2 p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
            <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Doklad: <strong>{selectedReceipt.receiptNumber}</strong>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="h-9 px-3.5 text-xs font-bold rounded-lg bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-700 dark:hover:bg-slate-600 inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Printer className="w-3.5 h-3.5 text-amber-400" />
                Tisk / PDF
              </button>
              <button
                type="button"
                onClick={() => handleDeleteReceipt(selectedReceipt.id)}
                className="h-9 px-3 text-xs font-semibold rounded-lg bg-red-50 hover:bg-red-100 text-red-600 dark:bg-red-950/40 dark:text-red-400 border border-red-200 dark:border-red-900/40 inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Smazat doklad
              </button>
            </div>
          </div>

          {/* Printable Czech Cash Receipt Box (Classic official SEVT style) */}
          <div
            id="cash-receipt-printable"
            data-pdf-paper
            className="bg-white text-slate-900 p-8 sm:p-10 rounded-xl shadow-lg border-2 border-slate-300 max-w-3xl mx-auto font-sans leading-normal text-xs"
          >
            {/* Header top bar */}
            <div className="flex items-center justify-between pb-4 border-b-2 border-slate-800 mb-6">
              <div>
                <h1 className="text-xl sm:text-2xl font-black uppercase tracking-wide text-slate-900">
                  PŘÍJMOVÝ POKLADNÍ DOKLAD
                </h1>
                <div className="text-xs font-semibold text-slate-600 mt-0.5">
                  Potvrzení o převzetí hotovosti
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-slate-500 font-bold uppercase">Číslo dokladu</div>
                <div className="text-lg font-mono font-black text-emerald-800">
                  {selectedReceipt.receiptNumber}
                </div>
              </div>
            </div>

            {/* Contractor & Payer info grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              {/* Prijemce */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Příjemce (živnostník / firma):
                </div>
                <div className="font-bold text-sm text-slate-900">{contract.contractor.name}</div>
                <div className="text-slate-600 text-xs mt-0.5">IČO: {contract.contractor.ico}</div>
                {contract.contractor.dic && (
                  <div className="text-slate-600 text-xs">DIČ: {contract.contractor.dic}</div>
                )}
                <div className="text-slate-600 text-xs">{contract.contractor.address}</div>
                <div className="text-slate-600 text-xs">Tel: {contract.contractor.phone}</div>
              </div>

              {/* Platce */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Přijato od (plátce):
                </div>
                <div className="font-bold text-sm text-slate-900">{selectedReceipt.receivedFrom}</div>
                {contract.client.ico && (
                  <div className="text-slate-600 text-xs mt-0.5">IČO: {contract.client.ico}</div>
                )}
                <div className="text-slate-600 text-xs">{contract.client.address}</div>
                <div className="text-slate-600 text-xs">Tel: {contract.client.phone}</div>
              </div>
            </div>

            {/* Amount Box */}
            <div className="p-4 bg-emerald-50/80 border-2 border-emerald-500/50 rounded-xl mb-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <span className="text-xs font-bold text-emerald-900 uppercase tracking-wider">
                    Přijatá částka v hotovosti:
                  </span>
                  <div className="text-2xl sm:text-3xl font-black text-emerald-950 font-mono mt-0.5">
                    {formatCurrency(selectedReceipt.amount)}
                  </div>
                </div>
                <div className="text-left sm:text-right">
                  <span className="text-[11px] text-slate-500 uppercase font-semibold">Datum přijetí</span>
                  <div className="text-sm font-bold text-slate-800">
                    {formatDateCs(selectedReceipt.issueDate)}
                  </div>
                </div>
              </div>

              <div className="mt-3 pt-3 border-t border-emerald-200 text-xs text-emerald-900">
                <span className="font-bold">Slovy: </span>
                <span className="italic font-medium">
                  {amountInWordsCzk(selectedReceipt.amount)}
                </span>
              </div>
            </div>

            {/* Purpose */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg mb-6">
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Účel platby:
              </div>
              <div className="font-semibold text-sm text-slate-900">
                {selectedReceipt.purposeDescription}
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                Vztahuje se ke smlouvě o dílo č. {contract.contractNumber}
              </div>
            </div>

            {/* Signatures */}
            <div className="pt-4 border-t border-slate-300">
              <div className="grid grid-cols-2 gap-6">
                {/* Contractor signature */}
                <div className="text-center">
                  <div className="text-[11px] font-bold text-slate-600 mb-1 uppercase">
                    Předal (podpis plátce):
                  </div>
                  <div className="h-24 border border-dashed border-slate-300 rounded-lg flex flex-col items-center justify-center p-2 bg-slate-50">
                    {selectedReceipt.clientSignature ? (
                      <div className="flex flex-col items-center">
                        <img
                          src={selectedReceipt.clientSignature}
                          alt="Podpis plátce"
                          className="max-h-14 object-contain"
                        />
                        <span className="text-[10px] text-emerald-700 mt-0.5 font-semibold flex items-center gap-1">
                          <Check className="w-3 h-3" /> Podepsáno
                        </span>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setSignModalRole('client')}
                        className="no-print px-2.5 py-1 rounded bg-blue-600 text-white text-[11px] font-semibold hover:bg-blue-700 flex items-center gap-1"
                      >
                        <PenTool className="w-3 h-3" /> Podepsat
                      </button>
                    )}
                  </div>
                  <div className="text-xs font-semibold text-slate-800 mt-1">
                    {selectedReceipt.receivedFrom}
                  </div>
                </div>

                {/* Receiver signature */}
                <div className="text-center relative">
                  <div className="text-[11px] font-bold text-slate-600 mb-1 uppercase">
                    Přijal / Vystavil (podpis příjemce):
                  </div>
                  <div className="h-24 border border-dashed border-slate-300 rounded-lg flex flex-col items-center justify-center p-2 bg-slate-50 relative overflow-hidden">
                    <div className="absolute -top-3 -right-2 opacity-80 pointer-events-none">
                      <CraftsmanStamp contractor={contract.contractor} size="sm" />
                    </div>
                    {selectedReceipt.contractorSignature ? (
                      <div className="flex flex-col items-center z-10">
                        <img
                          src={selectedReceipt.contractorSignature}
                          alt="Podpis příjemce"
                          className="max-h-14 object-contain"
                        />
                        <span className="text-[10px] text-emerald-700 mt-0.5 font-semibold flex items-center gap-1">
                          <Check className="w-3 h-3" /> Podepsáno
                        </span>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setSignModalRole('contractor')}
                        className="no-print px-2.5 py-1 rounded bg-slate-700 text-white text-[11px] font-semibold hover:bg-slate-800 flex items-center gap-1 z-10"
                      >
                        <PenTool className="w-3 h-3" /> Podepsat
                      </button>
                    )}
                  </div>
                  <div className="text-xs font-semibold text-slate-800 mt-1">
                    {selectedReceipt.receivedBy}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* New Receipt Modal */}
      {isNewModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 rounded-lg">
                  <Banknote className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                    Vystavit příjmový pokladní doklad
                  </h3>
                  <p className="text-xs text-slate-500">
                    ke smlouvě č. {contract.contractNumber}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsNewModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick presets */}
            <div className="mt-4">
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1.5">
                Rychlá předvolba účelu a částky:
              </span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleSelectPreset('zaloha')}
                  className={`p-2 rounded-lg text-left border text-xs transition-colors ${
                    formPaymentFor === 'zaloha'
                      ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 font-semibold'
                      : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <div className="font-bold">Záloha na materiál</div>
                  <div className="text-[11px] text-slate-500">
                    {contract.advanceAmount ? formatCurrency(contract.advanceAmount) : 'Ze smlouvy'}
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => handleSelectPreset('doplatek')}
                  className={`p-2 rounded-lg text-left border text-xs transition-colors ${
                    formPaymentFor === 'doplatek'
                      ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 font-semibold'
                      : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <div className="font-bold">Doplatek díla</div>
                  <div className="text-[11px] text-slate-500">
                    {formatCurrency(remainingToPay)}
                  </div>
                </button>
              </div>
            </div>

            <form onSubmit={handleCreateReceipt} className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Číslo dokladu *
                  </label>
                  <input
                    type="text"
                    required
                    value={formNumber}
                    onChange={(e) => setFormNumber(e.target.value)}
                    className="w-full text-xs py-2 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Datum přijetí hotovosti *
                  </label>
                  <input
                    type="date"
                    required
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full text-xs py-2 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Přijatá částka (v Kč) *
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  step="1"
                  value={formAmount}
                  onChange={(e) =>
                    setFormAmount(e.target.value === '' ? '' : parseFloat(e.target.value))
                  }
                  placeholder="20000"
                  className="w-full text-xs py-2 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Účel platby *
                </label>
                <input
                  type="text"
                  required
                  value={formPurpose}
                  onChange={(e) => setFormPurpose(e.target.value)}
                  placeholder="např. Záloha na materiál..."
                  className="w-full text-xs py-2 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsNewModalOpen(false)}
                  className="px-3.5 py-2 text-xs font-medium rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Zrušit
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  Vystavit pokladní doklad
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Signature Modal */}
      {signModalRole && (
        <SignatureModal
          isOpen={true}
          title={`Podpis pokladního dokladu - ${
            signModalRole === 'contractor' ? 'Příjemce (živnostník)' : 'Plátce (klient)'
          }`}
          signerName={
            signModalRole === 'contractor' ? contract.contractor.name : contract.client.name
          }
          role={signModalRole}
          onSave={handleSaveSignature}
          onClose={() => setSignModalRole(null)}
        />
      )}
    </div>
  );
};
