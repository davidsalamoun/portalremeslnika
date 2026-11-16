import React, { useState } from 'react';
import { docBar, docBarTitle, docBarNote, docBarActions, docButton, docButtonStrong, docButtonPrimary, docChip } from './docBar';
import { Dialog } from './Dialog';
import { getContractTotal } from '../utils/invoiceMath';
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

const formLabel = 'block font-semibold text-slate-900 dark:text-slate-100 mb-1.5';
const formInput =
  'w-full min-h-12 px-3.5 py-2 rounded-md border-[1.5px] border-slate-900 dark:border-slate-500 bg-white dark:bg-slate-950 text-slate-900 dark:text-white';

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

  const [receiptToDelete, setReceiptToDelete] = useState<string | null>(null);

  const handleDeleteReceipt = (id: string) => {
    const updated = receipts.filter((r) => r.id !== id);
    onUpdateContract({ ...contract, cashReceipts: updated });
    if (selectedReceiptId === id) {
      setSelectedReceiptId(updated.length > 0 ? updated[0].id : null);
    }
    setReceiptToDelete(null);
    onToast?.('info', 'Pokladní doklad je smazaný.');
  };

  const openNewReceipt = () => {
    setFormNumber(`PPD-${contract.contractNumber.replace(/[^0-9]/g, '') || new Date().getFullYear()}-${String(receipts.length + 1).padStart(2, '0')}`);
    setIsNewModalOpen(true);
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

  const jobTotal = getContractTotal(contract);

  return (
    <div className="space-y-6">
      {/* Lišta pokladních dokladů (jen na obrazovce) */}
      <div className={docBar}>
        <div className="min-w-0">
          <div className={docBarTitle}>Platby v hotovosti</div>
          <div className={docBarNote}>
            {receipts.length === 0
              ? 'Příjmový pokladní doklad pro zálohu nebo doplatek převzatý na ruku.'
              : `Přijato ${formatCurrency(totalCashCollected)} z ${formatCurrency(jobTotal)}, zbývá ${formatCurrency(Math.max(0, jobTotal - totalCashCollected))}.`}
          </div>
        </div>
        <div className={docBarActions}>
          {selectedReceipt && (
            <button type="button" onClick={() => setReceiptToDelete(selectedReceipt.id)} className={docButton} aria-label={`Smazat doklad ${selectedReceipt.receiptNumber}`}>
              <Trash2 className="w-4 h-4" />
              <span>Smazat doklad</span>
            </button>
          )}
          <button type="button" onClick={openNewReceipt} className={docButtonPrimary}>
            <Banknote className="w-[18px] h-[18px]" />
            <span>Nový pokladní doklad</span>
          </button>
        </div>
      </div>

      {receipts.length > 1 && (
        <div role="group" aria-label="Výběr dokladu" className="no-print flex gap-2 overflow-x-auto pb-1 text-[15px]">
          {receipts.map((r) => (
            <button
              key={r.id}
              type="button"
              aria-pressed={selectedReceipt?.id === r.id}
              onClick={() => setSelectedReceiptId(r.id)}
              className={`${docChip(selectedReceipt?.id === r.id)} whitespace-nowrap tabular-nums`}
            >
              {r.receiptNumber}, {formatCurrency(r.amount)}
            </button>
          ))}
        </div>
      )}

      {receiptToDelete && (
        <Dialog title="Smazat pokladní doklad?" onClose={() => setReceiptToDelete(null)}>
          <div className="space-y-5">
            <p className="text-slate-900 dark:text-slate-100">
              Doklad zmizí i s podpisy a přijatá hotovost se u zakázky sníží. Smazání nejde vrátit.
            </p>
            <div className="flex flex-wrap justify-end gap-2.5">
              <button type="button" onClick={() => setReceiptToDelete(null)} className={docButtonStrong}>
                Ponechat
              </button>
              <button
                type="button"
                onClick={() => handleDeleteReceipt(receiptToDelete)}
                className="min-h-11 px-4 inline-flex items-center justify-center gap-2 rounded-md border-[1.5px] border-rose-700 bg-rose-700 hover:bg-rose-800 text-white font-semibold cursor-pointer transition-colors"
              >
                <Trash2 className="w-[18px] h-[18px]" />
                <span>Smazat</span>
              </button>
            </div>
          </div>
        </Dialog>
      )}

      {/* Doklad, nebo prázdný stav */}
      {receipts.length === 0 ? (
        <div className="no-print bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md px-5 py-5 text-[15px] text-slate-600 dark:text-slate-300">
          Zatím tu není žádný pokladní doklad. Když převezmete peníze v hotovosti, vystavte klientovi doklad tlačítkem Nový pokladní doklad.
        </div>
      ) : selectedReceipt ? (
        <div className="space-y-4">
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
        <Dialog
          title="Nový pokladní doklad"
          subtitle={<>ke smlouvě č. {contract.contractNumber}</>}
          size="lg"
          closeOnBackdrop={false}
          onClose={() => setIsNewModalOpen(false)}
        >
          <div className="space-y-4">
            <div>
              <div className={formLabel}>Za co platí</div>
              <div role="group" aria-label="Za co platí" className="flex flex-wrap gap-2">
                <button type="button" aria-pressed={formPaymentFor === 'zaloha'} onClick={() => handleSelectPreset('zaloha')} className={docChip(formPaymentFor === 'zaloha')}>
                  Záloha{contract.advanceAmount ? ` ${formatCurrency(contract.advanceAmount)}` : ''}
                </button>
                <button type="button" aria-pressed={formPaymentFor === 'doplatek'} onClick={() => handleSelectPreset('doplatek')} className={docChip(formPaymentFor === 'doplatek')}>
                  Doplatek {formatCurrency(remainingToPay)}
                </button>
              </div>
            </div>

            <form onSubmit={handleCreateReceipt} className="space-y-4">
              <div>
                <label htmlFor="ppd-castka" className={formLabel}>
                  Přijatá částka v Kč
                </label>
                <input
                  id="ppd-castka"
                  type="number"
                  required
                  min="1"
                  step="1"
                  inputMode="numeric"
                  value={formAmount}
                  onChange={(e) => setFormAmount(e.target.value === '' ? '' : parseFloat(e.target.value))}
                  className={`${formInput} font-display font-semibold text-[20px] tabular-nums max-w-[14rem]`}
                />
              </div>

              <div>
                <label htmlFor="ppd-ucel" className={formLabel}>
                  Účel platby
                </label>
                <input
                  id="ppd-ucel"
                  type="text"
                  required
                  value={formPurpose}
                  onChange={(e) => setFormPurpose(e.target.value)}
                  placeholder="např. Záloha na materiál"
                  className={formInput}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="ppd-cislo" className={formLabel}>
                    Číslo dokladu
                  </label>
                  <input id="ppd-cislo" type="text" required value={formNumber} onChange={(e) => setFormNumber(e.target.value)} className={`${formInput} tabular-nums`} />
                </div>
                <div>
                  <label htmlFor="ppd-datum" className={formLabel}>
                    Datum přijetí
                  </label>
                  <input id="ppd-datum" type="date" required value={formDate} onChange={(e) => setFormDate(e.target.value)} className={formInput} />
                </div>
              </div>

              <div className="pt-1 flex flex-wrap justify-end gap-2.5">
                <button type="button" onClick={() => setIsNewModalOpen(false)} className={docButtonStrong}>
                  Zrušit
                </button>
                <button type="submit" className={docButtonPrimary}>
                  <Check className="w-[18px] h-[18px]" />
                  <span>Vystavit doklad</span>
                </button>
              </div>
            </form>
          </div>
        </Dialog>
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
