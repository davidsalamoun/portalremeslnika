import React, { useState } from 'react';
import { docBar, docBarTitle, docBarNote, docBarActions, docButton, docButtonStrong, docButtonPrimary, docChip } from './docBar';
import { Dialog } from './Dialog';
import {
  FilePlus2,
  Calendar,
  DollarSign,
  Clock,
  Printer,
  FileDown,
  Share2,
  Check,
  PenTool,
  X,
  Trash2,
  FileText,
  AlertCircle,
  TrendingUp,
  BookOpen,
} from 'lucide-react';
import { Contract, ContractAmendment, BudgetItem } from '../types/contract';
import { PriceListModal } from './PriceListModal';
import {
  formatCurrency,
  formatDateCs,
  formatContractPriceWithWords,
  formatPlaceWithPreposition,
  amountInWordsCzk,
  formatSignedCurrency,
} from '../utils/numberToWordsCs';
import { SignatureModal } from './SignatureModal';
import { getWhatsAppShareUrl, getMailtoShareUrl } from '../utils/shareUtils';

interface AmendmentViewProps {
  contract: Contract;
  onUpdateContract: (updated: Contract) => void;
  onToast?: (type: 'success' | 'error' | 'info', text: string) => void;
  initialOpenNew?: boolean;
}

export const AmendmentView: React.FC<AmendmentViewProps> = ({
  contract,
  onUpdateContract,
  onToast,
  initialOpenNew = false,
}) => {
  const amendments = contract.amendments || [];
  const [selectedAmendmentId, setSelectedAmendmentId] = useState<string | null>(
    amendments.length > 0 ? amendments[amendments.length - 1].id : null
  );
  const [isNewModalOpen, setIsNewModalOpen] = useState(initialOpenNew);
  const [signModalRole, setSignModalRole] = useState<'contractor' | 'client' | null>(null);

  // New amendment form state
  const nextNumber = amendments.length + 1;
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formPriceDiff, setFormPriceDiff] = useState<number | ''>('');
  const [formAdditionalDays, setFormAdditionalDays] = useState<number | ''>('');
  const [formIssueDate, setFormIssueDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [isPriceListOpen, setIsPriceListOpen] = useState(false);

  const handleSelectFromPriceList = (pickedItems: BudgetItem[]) => {
    if (pickedItems.length === 0) return;
    const names = pickedItems.map((p) => p.title).join(', ');
    const desc = pickedItems
      .map((p) => `• ${p.title} (${p.quantity} ${p.unit} á ${formatCurrency(p.unitPrice)})`)
      .join('\n');
    const sumPrice = pickedItems.reduce((acc, p) => acc + p.totalPrice, 0);

    setFormTitle((prev) => (prev ? `${prev}, ${names}` : names));
    setFormDescription((prev) => (prev ? `${prev}\n${desc}` : desc));
    setFormPriceDiff((prev) => (typeof prev === 'number' ? prev + sumPrice : sumPrice));
  };

  const selectedAmendment = amendments.find((a) => a.id === selectedAmendmentId) || amendments[0];

  // Calculate cumulative prices
  const totalAmendmentsPrice = amendments.reduce((sum, a) => sum + (a.priceDifference || 0), 0);
  const totalAdjustedPrice = contract.price + totalAmendmentsPrice;

  const handleCreateAmendment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      onToast?.('error', 'Vyplňte název víceprací');
      return;
    }
    const diff = typeof formPriceDiff === 'number' ? formPriceDiff : 0;

    let newDate = contract.deliveryDate;
    if (typeof formAdditionalDays === 'number' && formAdditionalDays > 0) {
      const base = new Date(contract.deliveryDate);
      if (!isNaN(base.getTime())) {
        base.setDate(base.getDate() + formAdditionalDays);
        newDate = base.toISOString().split('T')[0];
      }
    }

    const newAmend: ContractAmendment = {
      id: `amend_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      amendmentNumber: nextNumber,
      issueDate: formIssueDate || new Date().toISOString().split('T')[0],
      title: formTitle.trim(),
      description: formDescription.trim(),
      priceDifference: diff,
      additionalDays: typeof formAdditionalDays === 'number' ? formAdditionalDays : undefined,
      newDeliveryDate: newDate !== contract.deliveryDate ? newDate : undefined,
      contractorSignature: contract.contractor.signature || contract.contractorSignature,
      contractorSignatureDate: new Date().toISOString().split('T')[0],
      createdAt: new Date().toISOString(),
    };

    const updatedAmendments = [...amendments, newAmend];
    const updatedContract: Contract = {
      ...contract,
      amendments: updatedAmendments,
    };

    onUpdateContract(updatedContract);
    setSelectedAmendmentId(newAmend.id);
    setIsNewModalOpen(false);
    setFormTitle('');
    setFormDescription('');
    setFormPriceDiff('');
    setFormAdditionalDays('');
    onToast?.('success', `Dodatek č. ${newAmend.amendmentNumber} byl úspěšně vytvořen`);
  };

  const [amendmentToDelete, setAmendmentToDelete] = useState<string | null>(null);

  const handleDeleteAmendment = (id: string) => {
    const updated = amendments.filter((a) => a.id !== id);
    onUpdateContract({ ...contract, amendments: updated });
    if (selectedAmendmentId === id) {
      setSelectedAmendmentId(updated.length > 0 ? updated[0].id : null);
    }
    setAmendmentToDelete(null);
    onToast?.('info', 'Dodatek je smazaný.');
  };

  const handleSaveSignature = (sigUrl: string) => {
    if (!selectedAmendment) return;
    const today = new Date().toISOString().split('T')[0];
    const isContr = signModalRole === 'contractor';

    const updatedList = amendments.map((a) => {
      if (a.id !== selectedAmendment.id) return a;
      return {
        ...a,
        ...(isContr
          ? { contractorSignature: sigUrl, contractorSignatureDate: today }
          : { clientSignature: sigUrl, clientSignatureDate: today }),
      };
    });

    onUpdateContract({ ...contract, amendments: updatedList });
    setSignModalRole(null);
    onToast?.('success', `Podpis na Dodatku č. ${selectedAmendment.amendmentNumber} byl uložen`);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Lišta dodatků (jen na obrazovce) */}
      <div className={docBar}>
        <div className="min-w-0">
          <div className={docBarTitle}>Dodatky ke smlouvě</div>
          <div className={docBarNote}>
            {amendments.length === 0
              ? 'Vícepráce, méněpráce a změny zadání sjednané po podpisu smlouvy.'
              : `Původní cena ${formatCurrency(contract.price)}, dodatky ${totalAmendmentsPrice >= 0 ? '+' : '−'}${formatCurrency(Math.abs(totalAmendmentsPrice))}, nová cena díla ${formatCurrency(totalAdjustedPrice)}.`}
          </div>
        </div>
        <div className={docBarActions}>
          {selectedAmendment && (
            <button type="button" onClick={() => setAmendmentToDelete(selectedAmendment.id)} className={docButton} aria-label={`Smazat dodatek č. ${selectedAmendment.amendmentNumber}`}>
              <Trash2 className="w-4 h-4" />
              <span>Smazat dodatek</span>
            </button>
          )}
          <button type="button" onClick={() => setIsNewModalOpen(true)} className={docButtonPrimary}>
            <FilePlus2 className="w-[18px] h-[18px]" />
            <span>Nový dodatek</span>
          </button>
        </div>
      </div>

      {amendments.length > 1 && (
        <div role="group" aria-label="Výběr dodatku" className="no-print flex gap-2 overflow-x-auto pb-1 text-[15px]">
          {amendments.map((a) => (
            <button
              key={a.id}
              type="button"
              aria-pressed={selectedAmendment?.id === a.id}
              onClick={() => setSelectedAmendmentId(a.id)}
              className={`${docChip(selectedAmendment?.id === a.id)} whitespace-nowrap`}
            >
              č. {a.amendmentNumber}: {a.title || 'Vícepráce'}
            </button>
          ))}
        </div>
      )}

      {amendmentToDelete && (
        <Dialog title="Smazat dodatek?" onClose={() => setAmendmentToDelete(null)}>
          <div className="space-y-5">
            <p className="text-slate-900 dark:text-slate-100">
              Dodatek zmizí i s podpisy a cena díla se přepočítá bez něj. Smazání nejde vrátit.
            </p>
            <div className="flex flex-wrap justify-end gap-2.5">
              <button type="button" onClick={() => setAmendmentToDelete(null)} className={docButtonStrong}>
                Ponechat
              </button>
              <button
                type="button"
                onClick={() => handleDeleteAmendment(amendmentToDelete)}
                className="min-h-11 px-4 inline-flex items-center justify-center gap-2 rounded-md border-[1.5px] border-rose-700 bg-rose-700 hover:bg-rose-800 text-white font-semibold cursor-pointer transition-colors"
              >
                <Trash2 className="w-[18px] h-[18px]" />
                <span>Smazat</span>
              </button>
            </div>
          </div>
        </Dialog>
      )}

      {/* Dokument, nebo prázdný stav */}
      {amendments.length === 0 ? (
        <div className="no-print bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md px-5 py-5 text-[15px] text-slate-600 dark:text-slate-300">
          Zatím tu není žádný dodatek. Když si klient objedná práce navíc nebo změnu zadání, sepište ji tlačítkem Nový dodatek.
        </div>
      ) : selectedAmendment ? (
        <div className="space-y-4">
          {/* Printable A4 Paper of the Amendment */}
          <div
            id="amendment-printable-paper"
            className="bg-white text-slate-900 p-8 sm:p-12 rounded-xl shadow-lg border border-slate-200 max-w-4xl mx-auto font-sans leading-relaxed text-sm"
          >
            {/* Header */}
            <div className="text-center pb-6 border-b-2 border-slate-800 mb-8">
              <div className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-1">
                Změnový list / Dodatek ke smlouvě
              </div>
              <h1 className="text-2xl font-black uppercase text-slate-900 tracking-wide">
                DODATEK Č. {selectedAmendment.amendmentNumber}
              </h1>
              <div className="text-base font-semibold text-slate-700 mt-1">
                ke Smlouvě o dílo č. {contract.contractNumber}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                uzavřené podle § 2586 a násl. zákona č. 89/2012 Sb., občanský zákoník
              </div>
            </div>

            {/* Parties */}
            <div className="mb-8">
              <div className="font-bold text-xs uppercase tracking-wider text-slate-600 mb-2">
                Smluvní strany:
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 bg-slate-50 p-4 rounded-lg border border-slate-200">
                <div>
                  <div className="text-xs font-bold text-slate-500 uppercase">1. Zhotovitel:</div>
                  <div className="font-bold text-base text-slate-900">{contract.contractor.name}</div>
                  <div className="text-xs text-slate-600 mt-1">IČO: {contract.contractor.ico}</div>
                  {contract.contractor.dic && (
                    <div className="text-xs text-slate-600">DIČ: {contract.contractor.dic}</div>
                  )}
                  <div className="text-xs text-slate-600">Sídlo: {contract.contractor.address}</div>
                  <div className="text-xs text-slate-600">Tel: {contract.contractor.phone}</div>
                </div>

                <div>
                  <div className="text-xs font-bold text-slate-500 uppercase">2. Objednatel:</div>
                  <div className="font-bold text-base text-slate-900">{contract.client.name}</div>
                  {contract.client.ico && (
                    <div className="text-xs text-slate-600">IČO: {contract.client.ico}</div>
                  )}
                  <div className="text-xs text-slate-600">Bydliště/Sídlo: {contract.client.address}</div>
                  <div className="text-xs text-slate-600">Tel: {contract.client.phone}</div>
                </div>
              </div>
            </div>

            {/* Preamble */}
            <div className="mb-6 text-xs text-slate-600 italic">
              Smluvní strany se dne {formatDateCs(selectedAmendment.issueDate)} v souladu s příslušnými ustanoveními původní Smlouvy o dílo č. {contract.contractNumber} ze dne {formatDateCs(contract.conclusionDate)} dohodly na uzavření tohoto Dodatku č. {selectedAmendment.amendmentNumber} v následujícím znění:
            </div>

            {/* Article I: Subject of amendment */}
            <div className="mb-6">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800 border-b border-slate-300 pb-1 mb-2">
                Článek I. Předmět dodatku (vícepráce / změna rozsahu díla)
              </h2>
              <p className="text-sm text-slate-800 mb-2 font-medium">
                Předmět původního díla se rozšiřuje o následující práce, činnosti a dodávky materiálu:
              </p>
              <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200 text-sm text-slate-900 font-medium whitespace-pre-wrap">
                {selectedAmendment.description || selectedAmendment.title}
              </div>
            </div>

            {/* Article II: Price adjustment */}
            <div className="mb-6">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800 border-b border-slate-300 pb-1 mb-2">
                Článek II. Úprava ceny díla
              </h2>
              <div className="space-y-2 text-sm text-slate-800">
                <p>
                  1. Sjednaná cena víceprací podle tohoto dodatku činí{' '}
                  <strong className="text-amber-800">
                    {formatCurrency(selectedAmendment.priceDifference)}
                  </strong>{' '}
                  (slovy:{' '}
                  <em>
                    {amountInWordsCzk(selectedAmendment.priceDifference)}
                  </em>
                  ).
                </p>
                <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-lg text-xs space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-600">Původní sjednaná cena díla:</span>
                    <span className="font-semibold">{formatCurrency(contract.price)}</span>
                  </div>
                  <div className="flex justify-between text-amber-900 font-semibold">
                    <span>Cena víceprací (Dodatek č. {selectedAmendment.amendmentNumber}):</span>
                    <span>{formatSignedCurrency(selectedAmendment.priceDifference)}</span>
                  </div>
                  <div className="flex justify-between text-sm font-bold text-slate-900 pt-1 border-t border-amber-200">
                    <span>Nová celková cena díla po započtení tohoto dodatku:</span>
                    <span>{formatCurrency(contract.price + selectedAmendment.priceDifference)}</span>
                  </div>
                </div>
                <p className="text-xs text-slate-600">
                  2. Způsob úhrady této částky: Cena za vícepráce bude vyúčtována ve finální konečné faktuře po řádném dokončení a předání díla.
                </p>
              </div>
            </div>

            {/* Article III: Delivery date */}
            <div className="mb-6">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800 border-b border-slate-300 pb-1 mb-2">
                Článek III. Termín dokončení díla
              </h2>
              <p className="text-sm text-slate-800">
                {selectedAmendment.newDeliveryDate ? (
                  <>
                    V důsledku sjednaných víceprací se původní termín dokončení díla prodlužuje o{' '}
                    <strong>{selectedAmendment.additionalDays || 'sjednaný počet'} dní</strong>. Nový
                    závazný termín dokončení celého díla je stanoven na den:{' '}
                    <strong className="text-blue-900">
                      {formatDateCs(selectedAmendment.newDeliveryDate)}
                    </strong>
                    .
                  </>
                ) : (
                  <>
                    Smluvní strany potvrzují, že provedení víceprací nemá vliv na původně sjednaný
                    termín dokončení díla, kterým zůstává{' '}
                    <strong>{formatDateCs(contract.deliveryDate)}</strong>.
                  </>
                )}
              </p>
            </div>

            {/* Article IV: Final provisions */}
            <div className="mb-8">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800 border-b border-slate-300 pb-1 mb-2">
                Článek IV. Závěrečná ustanovení
              </h2>
              <p className="text-xs text-slate-600 leading-relaxed">
                1. Ostatní ustanovení původní Smlouvy o dílo č. {contract.contractNumber}, která nejsou tímto dodatkem výslovně dotčena, zůstávají v platnosti v původním znění.
                <br />
                2. Tento dodatek je vyhotoven ve dvou stejnopisech s platností originálu, přičemž každá smluvní strana obdrží po jednom vyhotovení.
                <br />
                3. Smluvní strany prohlašují, že si tento dodatek před jeho podpisem přečetly a s jeho obsahem bez výhrad souhlasí.
              </p>
            </div>

            {/* Signatures */}
            <div className="pt-6 border-t border-slate-300">
              <div className="text-xs text-slate-500 mb-6">
                V {contract.executionPlace || contract.contractor.defaultPlace || 'místě plnění'} dne{' '}
                {formatDateCs(selectedAmendment.issueDate)}
              </div>

              <div className="grid grid-cols-2 gap-8">
                {/* Contractor signature */}
                <div className="text-center">
                  <div className="text-xs font-bold text-slate-600 mb-2 uppercase">Zhotovitel</div>
                  <div className="h-28 border border-dashed border-slate-300 rounded-lg flex flex-col items-center justify-center p-2 bg-slate-50 relative group">
                    {selectedAmendment.contractorSignature ? (
                      <div className="flex flex-col items-center">
                        <img
                          src={selectedAmendment.contractorSignature}
                          alt="Podpis zhotovitele"
                          className="max-h-16 object-contain"
                        />
                        <span className="text-[10px] text-emerald-700 mt-1 font-semibold flex items-center gap-1">
                          <Check className="w-3 h-3" /> Digitálně podepsáno
                        </span>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setSignModalRole('contractor')}
                        className="no-print px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-100 flex items-center gap-1 shadow-sm"
                      >
                        <PenTool className="w-3.5 h-3.5" /> Podepsat (zhotovitel)
                      </button>
                    )}
                  </div>
                  <div className="text-xs font-semibold text-slate-900 mt-2">
                    {contract.contractor.name}
                  </div>
                </div>

                {/* Client signature */}
                <div className="text-center">
                  <div className="text-xs font-bold text-slate-600 mb-2 uppercase">Objednatel</div>
                  <div className="h-28 border border-dashed border-slate-300 rounded-lg flex flex-col items-center justify-center p-2 bg-slate-50 relative group">
                    {selectedAmendment.clientSignature ? (
                      <div className="flex flex-col items-center">
                        <img
                          src={selectedAmendment.clientSignature}
                          alt="Podpis objednatele"
                          className="max-h-16 object-contain"
                        />
                        <span className="text-[10px] text-emerald-700 mt-1 font-semibold flex items-center gap-1">
                          <Check className="w-3 h-3" /> Digitálně podepsáno
                        </span>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setSignModalRole('client')}
                        className="no-print px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 flex items-center gap-1 shadow-sm"
                      >
                        <PenTool className="w-3.5 h-3.5" /> Podepsat (objednatel)
                      </button>
                    )}
                  </div>
                  <div className="text-xs font-semibold text-slate-900 mt-2">
                    {contract.client.name}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Modal: New Amendment */}
      {isNewModalOpen && (
        <Dialog
          title={<>Nový dodatek č. {nextNumber}</>}
          subtitle={<>ke smlouvě č. {contract.contractNumber}</>}
          size="lg"
          bare
          closeOnBackdrop={false}
          onClose={() => setIsNewModalOpen(false)}
        >

            <form onSubmit={handleCreateAmendment} className="mt-4 space-y-4">
              {/* Rychlý výběr z ceníku */}
              <div className="p-2.5 rounded-xl bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/80 flex items-center justify-between">
                <span className="text-xs text-amber-900 dark:text-amber-200 font-medium">
                  Máte předpřipravený ceník řemeslných prací?
                </span>
                <button
                  type="button"
                  onClick={() => setIsPriceListOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-all shadow-xs cursor-pointer"
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>Vybrat z ceníku</span>
                </button>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Stručný název víceprací *
                </label>
                <input
                  type="text"
                  required
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="např. Přeložka odpadu a 5 zásuvek navíc"
                  className="w-full text-xs py-2 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Detailní popis prováděných víceprací
                </label>
                <textarea
                  rows={3}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Popište, co přesně bude děláno navíc oproti původní smlouvě, včetně materiálu..."
                  className="w-full text-xs py-2 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Cena víceprací (v Kč) *
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="100"
                    value={formPriceDiff}
                    onChange={(e) =>
                      setFormPriceDiff(e.target.value === '' ? '' : parseFloat(e.target.value))
                    }
                    placeholder="12000"
                    className="w-full text-xs py-2 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Prodloužení termínu (dny)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={formAdditionalDays}
                    onChange={(e) =>
                      setFormAdditionalDays(
                        e.target.value === '' ? '' : parseInt(e.target.value, 10)
                      )
                    }
                    placeholder="např. 3"
                    className="w-full text-xs py-2 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Datum sjednání dodatku
                </label>
                <input
                  type="date"
                  value={formIssueDate}
                  onChange={(e) => setFormIssueDate(e.target.value)}
                  className="w-full text-xs py-2 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
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
                  className="px-4 py-2 text-xs font-bold rounded-lg bg-amber-600 hover:bg-amber-700 text-white shadow-sm flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  Vystavit a podepsat dodatek
                </button>
              </div>
            </form>
          </Dialog>
      )}

      {/* Signature Modal */}
      {signModalRole && (
        <SignatureModal
          isOpen={true}
          title={`Podpis Dodatku č. ${selectedAmendment?.amendmentNumber} - ${
            signModalRole === 'contractor' ? 'Zhotovitel' : 'Objednatel'
          }`}
          signerName={
            signModalRole === 'contractor' ? contract.contractor.name : contract.client.name
          }
          role={signModalRole}
          onSave={handleSaveSignature}
          onClose={() => setSignModalRole(null)}
        />
      )}

      {/* Modal pro výběr z ceníku do víceprací */}
      {isPriceListOpen && (
        <PriceListModal
          isOpen={isPriceListOpen}
          onClose={() => setIsPriceListOpen(false)}
          onSelectItems={handleSelectFromPriceList}
          onToast={onToast}
        />
      )}
    </div>
  );
};
