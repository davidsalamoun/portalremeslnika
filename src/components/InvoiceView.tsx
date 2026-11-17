import React, { useState, useEffect, useRef } from 'react';
import { buildIsdoc, isdocFileName } from '../utils/isdoc';
import { downloadFile } from '../utils/zipStore';
import { docBar, docBarTitle, docBarNote, docBarActions, docButton, docButtonPrimary, docButtonDanger, docChip } from './docBar';
import { Dialog } from './Dialog';
import { getStoredContracts } from '../utils/storage';
import {
  getAdvanceInvoiceNumber,
  getFinalInvoiceNumber,
  nextAdvanceInvoiceNumber,
  nextFinalInvoiceNumber,
} from '../utils/invoiceNumbering';
import {
  Download,
  Printer,
  FileDown,
  Loader2,
  QrCode,
  CheckCircle,
  Copy,
  Receipt,
  FileText,
  MessageSquare,
  Send,
  FilePlus2,
  Banknote,
  Ban,
  FileCode2,
  FileCheck2,
} from 'lucide-react';
import { Contract } from '../types/contract';
import {
  formatCurrency,
  formatDateCs,
  formatContractPriceWithWords,
  formatSignedCurrency,
} from '../utils/numberToWordsCs';
import {
  generateQrPaymentDataUrl,
  czAccountToIban,
} from '../utils/spayd';
import { exportContractToPdf } from '../utils/lazyExports';
import { getWhatsAppShareUrl, getMailtoShareUrl } from '../utils/shareUtils';
import { triggerHaptic } from '../utils/haptics';
import { CraftsmanStamp } from './CraftsmanStamp';
import { getAdvanceInvoiceDates, getContractVatBreakdown, getFinalInvoiceDates, getVatRate, isReverseCharge, VatRate } from '../utils/invoiceMath';

const formatHalere = (amount: number) =>
  `${new Intl.NumberFormat('cs-CZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount)} Kč`;

interface InvoiceViewProps {
  contract: Contract;
  invoiceType?: 'final' | 'advance';
  onToast?: (type: 'success' | 'error' | 'info', text: string) => void;
  onOpenAmendments?: () => void;
  onOpenCashReceipt?: (type: 'zaloha' | 'doplatek') => void;
  onChangeInvoiceType?: (type: 'final' | 'advance') => void;
  onUpdateContract?: (updated: Contract) => void;
}

export const InvoiceView: React.FC<InvoiceViewProps> = ({
  contract,
  invoiceType = 'final',
  onToast,
  onOpenAmendments,
  onOpenCashReceipt,
  onChangeInvoiceType,
  onUpdateContract,
}) => {
  const invoicePaperRef = useRef<HTMLDivElement>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [isPdfGenerating, setIsPdfGenerating] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const isAdvance = invoiceType === 'advance';

  // Calculations for amendments and advance
  const amendments = contract.amendments || [];
  const totalAmendmentsPrice = amendments.reduce((sum, a) => sum + (a.priceDifference || 0), 0);
  const totalContractPriceWithAmendments = contract.price + totalAmendmentsPrice;
  // Zálohová faktura se vystavuje jen na zálohu sjednanou ve smlouvě – žádná částka se nedomýšlí
  const advanceAmount = contract.advanceAmount || 0;
  const hasAdvance = advanceAmount > 0;

  // Final invoice balance (doplatek k úhradě)
  const finalBalanceToPay = Math.max(0, totalContractPriceWithAmendments - (contract.advanceAmount || 0));

  // The actual payable amount on this specific document
  const rawAmount = isAdvance ? advanceAmount : finalBalanceToPay;

  // Plátce DPH: konečná faktura rozepisuje základ, sazbu a daň (ceny jsou včetně DPH; při přenesení daňové
  // povinnosti bez DPH a daň odvede zákazník)
  const isVatPayer = !!contract.contractor.dic;
  const reverseCharge = isReverseCharge(contract);
  const vatRate = getVatRate(contract);
  // Konečná faktura zdaňuje celou cenu díla; sjednaná záloha se odečítá jako nedaňová (stejně jako v exportu ISDOC)
  const vat = getContractVatBreakdown(contract, isAdvance ? rawAmount : totalContractPriceWithAmendments);
  const setVatRate = (rate: VatRate) => {
    if (rate === vatRate || !onUpdateContract) return;
    onUpdateContract({ ...contract, vatRate: rate });
  };
  const setReverseCharge = (on: boolean) => {
    if (on === reverseCharge || !onUpdateContract) return;
    onUpdateContract({ ...contract, reverseCharge: on });
  };

  // Číslo vzniká až při vystavení (utils/invoiceNumbering.ts); do té doby je doklad jen návrh
  const issuedNumber = isAdvance ? getAdvanceInvoiceNumber(contract) : getFinalInvoiceNumber(contract);
  const isIssued = !!issuedNumber;
  const isCancelled = !isAdvance && !!contract.invoiceCancelledAt;
  const isInvoiceOnly = contract.docKind === 'invoice';
  const invoiceNumber = isIssued ? `${isAdvance ? 'ZAL' : 'FA'}-${issuedNumber}` : '';
  const advanceNumberForDeduction = getAdvanceInvoiceNumber(contract);
  const [confirm, setConfirm] = useState<'issue' | 'cancel' | null>(null);
  const pendingNumber = confirm === 'issue'
    ? (isAdvance ? nextAdvanceInvoiceNumber : nextFinalInvoiceNumber)(getStoredContracts(), new Date().getFullYear())
    : '';

  const handleIssue = () => {
    if (!onUpdateContract) return;
    const number = (isAdvance ? nextAdvanceInvoiceNumber : nextFinalInvoiceNumber)(getStoredContracts(), new Date().getFullYear());
    const now = new Date().toISOString();
    onUpdateContract(
      isAdvance
        ? { ...contract, advanceInvoiceNumber: number, advanceInvoiceIssuedAt: now }
        : { ...contract, invoiceNumber: number, invoiceIssuedAt: now, variableSymbol: contract.variableSymbol || number }
    );
    setConfirm(null);
    onToast?.('success', `Faktura ${isAdvance ? 'ZAL' : 'FA'}-${number} je vystavená.`);
  };

  const handleCancel = () => {
    if (!onUpdateContract) return;
    onUpdateContract({ ...contract, invoiceCancelledAt: new Date().toISOString() });
    setConfirm(null);
    onToast?.('info', `Faktura ${invoiceNumber} je stornovaná. Zakázka už se nepočítá do pohledávek ani tržeb.`);
  };

  const variableSymbol = (contract.variableSymbol || contract.invoiceNumber || '').replace(/\D/g, '');

  // Data dokladu podle jednotných pravidel (utils/invoiceMath): zálohová faktura při uzavření smlouvy,
  // konečná faktura k předání díla; splatnost 14 dnů
  const invoiceDates = isAdvance ? getAdvanceInvoiceDates(contract) : getFinalInvoiceDates(contract);
  const issueDate = invoiceDates.issueDate;
  const dueDateIso = invoiceDates.dueDate;

  const iban = czAccountToIban(contract.contractor.bankAccount);

  // Generování QR kódu
  useEffect(() => {
    let isMounted = true;
    const loadQr = async () => {
      const url = await generateQrPaymentDataUrl({
        account: contract.contractor.bankAccount,
        amount: rawAmount,
        vs: variableSymbol,
        message: `Faktura ${invoiceNumber} ${contract.client.name.substring(0, 20)}`,
      });
      if (isMounted) setQrDataUrl(url);
    };
    loadQr();
    return () => {
      isMounted = false;
    };
  }, [contract, rawAmount, invoiceNumber, variableSymbol]);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(label);
    onToast?.('info', `Zkopírováno: ${label}`);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleCopyPaymentInfo = () => {
    const bank = contract.contractor.bankAccount || 'Neuveden';
    const vs = variableSymbol;
    const castka = formatCurrency(rawAmount);
    const text = `Platba faktury ${invoiceNumber} (${contract.workDescription}):\nČíslo účtu: ${bank}\nČástka: ${castka}\nVariabilní symbol (VS): ${vs}\nSplatnost do: ${formatDateCs(dueDateIso)}\nPříjemce: ${contract.contractor.name}\nDěkuji.`;
    navigator.clipboard.writeText(text);
    triggerHaptic('success');
    onToast?.('success', 'Platební údaje zkopírovány do schránky (připraveno pro SMS/WhatsApp)');
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = async () => {
    if (!invoicePaperRef.current) return;
    try {
      setIsPdfGenerating(true);
      const fakeContract = {
        ...contract,
        id: `inv_${contract.id}`,
        client: {
          ...contract.client,
          name: `${contract.client.name}_${isAdvance ? 'Zalohova_faktura' : 'Faktura'}`,
        },
      };
      await exportContractToPdf(invoicePaperRef.current, fakeContract);
      onToast?.('success', 'Faktura byla stažena jako PDF');
    } catch (e) {
      console.error(e);
      window.print();
    } finally {
      setIsPdfGenerating(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Lišta faktury (jen na obrazovce) */}
      <div className={docBar}>
        <div className="min-w-0">
          <div className={docBarTitle}>{isAdvance ? 'Zálohová faktura' : isInvoiceOnly ? 'Faktura' : 'Konečná faktura'}</div>
          <div className={docBarNote}>
            {isCancelled
              ? `č. ${invoiceNumber}, stornovaná`
              : isIssued
                ? `č. ${invoiceNumber}, splatná ${formatDateCs(dueDateIso)}`
                : 'Návrh – číslo dostane při vystavení'}
          </div>
        </div>

        <div className={docBarActions}>
          {!isIssued && onUpdateContract && (
            <button type="button" onClick={() => setConfirm('issue')} className={docButtonPrimary}>
              <FileCheck2 className="w-4 h-4" />
              <span>Vystavit fakturu</span>
            </button>
          )}
          {onChangeInvoiceType && hasAdvance && (
            <div role="group" aria-label="Druh faktury" className="flex gap-2">
              <button type="button" aria-pressed={!isAdvance} onClick={() => onChangeInvoiceType('final')} className={docChip(!isAdvance)}>
                Konečná
              </button>
              <button type="button" aria-pressed={isAdvance} onClick={() => onChangeInvoiceType('advance')} className={docChip(isAdvance)}>
                Zálohová
              </button>
            </div>
          )}
          {isVatPayer && !isAdvance && onUpdateContract && (
            <div role="group" aria-label="Sazba DPH" className="flex items-center gap-2">
              <span className={docBarNote}>Sazba DPH</span>
              <button type="button" aria-pressed={vatRate === 21} onClick={() => setVatRate(21)} className={docChip(vatRate === 21)}>
                21 %
              </button>
              <button
                type="button"
                aria-pressed={vatRate === 12}
                onClick={() => setVatRate(12)}
                className={docChip(vatRate === 12)}
                title="Stavební a montážní práce na dokončené stavbě pro bydlení"
              >
                12 %
              </button>
            </div>
          )}
          {isVatPayer && !isAdvance && onUpdateContract && !isIssued && (
            <div role="group" aria-label="Kdo odvede daň" className="flex items-center gap-2">
              <span className={docBarNote}>Daň odvede</span>
              <button type="button" aria-pressed={!reverseCharge} onClick={() => setReverseCharge(false)} className={docChip(!reverseCharge)}>
                Já
              </button>
              <button
                type="button"
                aria-pressed={reverseCharge}
                onClick={() => setReverseCharge(true)}
                className={docChip(reverseCharge)}
                title="Přenesení daňové povinnosti: stavební a montážní práce pro plátce DPH"
              >
                Zákazník
              </button>
            </div>
          )}
          {onOpenAmendments && !isAdvance && (
            <button type="button" onClick={onOpenAmendments} className={docButton}>
              <FilePlus2 className="w-4 h-4" />
              <span>Vícepráce</span>
            </button>
          )}
          {onOpenCashReceipt && (
            <button type="button" onClick={() => onOpenCashReceipt(isAdvance ? 'zaloha' : 'doplatek')} className={docButton}>
              <Banknote className="w-4 h-4" />
              <span>Platba v hotovosti</span>
            </button>
          )}
          {/* Posílat a sdílet jde jen vystavenou fakturu */}
          {isIssued && !isCancelled && (
            <>
              <button type="button" onClick={handleCopyPaymentInfo} className={docButton}>
                <Copy className="w-4 h-4" />
                <span>Zkopírovat platební údaje</span>
              </button>
              <a
                href={getWhatsAppShareUrl(contract, isAdvance ? 'zaloha' : 'faktura')}
                target="_blank"
                rel="noopener noreferrer"
                className={docButton}
              >
                <MessageSquare className="w-4 h-4" />
                <span>WhatsApp</span>
              </a>
              <a href={getMailtoShareUrl(contract, isAdvance ? 'zaloha' : 'faktura')} className={docButton}>
                <Send className="w-4 h-4" />
                <span>E-mail</span>
              </a>
            </>
          )}
          {isIssued && !isCancelled && (
            <button
              type="button"
              onClick={() => {
                downloadFile(isdocFileName(contract, isAdvance ? 'advance' : 'final'), buildIsdoc(contract, isAdvance ? 'advance' : 'final'), 'application/xml');
                onToast?.('success', 'Faktura je stažená ve formátu ISDOC pro účetní program.');
              }}
              className={docButton}
              title="Elektronická faktura, kterou načtou účetní programy (Pohoda, Money, ABRA…)"
            >
              <FileCode2 className="w-4 h-4" />
              <span>ISDOC</span>
            </button>
          )}
          {isIssued && !isAdvance && !isCancelled && onUpdateContract && (
            <button type="button" onClick={() => setConfirm('cancel')} className={docButtonDanger}>
              <Ban className="w-4 h-4" />
              <span>Stornovat</span>
            </button>
          )}
        </div>
      </div>

      {/* Papír faktury (A4 rozložení) */}
      <div
        ref={invoicePaperRef}
        className="contract-page bg-white shadow-xl rounded-sm p-8 sm:p-12 border border-slate-200 text-slate-900 font-sans text-xs leading-normal select-text"
        style={{
          minHeight: '297mm',
          width: '100%',
          maxWidth: '210mm',
          margin: '0 auto',
          boxSizing: 'border-box',
        }}
      >
        {/* Hlavička faktury */}
        <div className="flex justify-between items-start border-b-2 border-slate-900 pb-4 mb-6">
          <div>
            <span className="text-[10px] font-bold tracking-widest uppercase text-slate-500 block mb-0.5">
              {!isIssued ? 'NÁVRH FAKTURY' : isAdvance ? 'ZÁLOHOVÁ FAKTURA' : isVatPayer ? 'FAKTURA – DAŇOVÝ DOKLAD' : 'FAKTURA'}
            </span>
            <h1 className="text-2xl font-black text-slate-950 tracking-tight">
              {isIssued ? invoiceNumber : 'Bez čísla'}
            </h1>
            {isCancelled && (
              <p className="text-sm font-bold text-slate-900 mt-1">STORNO ze dne {formatDateCs(contract.invoiceCancelledAt!.slice(0, 10))}</p>
            )}
            {!isInvoiceOnly && contract.contractNumber && (
              <p className="text-xs text-slate-500 mt-1">
                K smlouvě o dílo: <strong>{contract.contractNumber}</strong>
              </p>
            )}
          </div>

          <div className="text-right">
            <span className="inline-block px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider bg-slate-100 text-slate-800 mb-1">
              {contract.contractor.dic ? 'Plátce DPH' : 'Neplátce DPH'}
            </span>
            <p className="text-[11px] text-slate-500">
              Variabilní symbol: <strong className="text-slate-900 font-mono text-sm">{variableSymbol}</strong>
            </p>
          </div>
        </div>

        {/* Dodavatel a Odběratel (2 sloupce) */}
        <div className="grid grid-cols-2 gap-8 mb-8 pb-6 border-b border-slate-200">
          {/* Dodavatel */}
          <div className="space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
              DODAVATEL:
            </span>
            <h3 className="font-bold text-sm text-slate-900">{contract.contractor.name}</h3>
            <p className="text-slate-600">{contract.contractor.address}</p>
            <div className="pt-2 text-slate-700 space-y-0.5">
              <p>
                <strong>IČO:</strong> {contract.contractor.ico}
                {contract.contractor.dic && <span> · <strong>DIČ:</strong> {contract.contractor.dic}</span>}
              </p>
              <p className="text-[10px] text-slate-500 italic">
                Fyzická osoba zapsaná v živnostenském rejstříku.
              </p>
              <p className="text-[11px] pt-1">
                Tel: {contract.contractor.phone} · E-mail: {contract.contractor.email}
              </p>
            </div>
          </div>

          {/* Odběratel */}
          <div className="space-y-1 bg-slate-50/70 p-4 rounded-xl border border-slate-200/80">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
              ODBĚRATEL:
            </span>
            <h3 className="font-bold text-sm text-slate-900">{contract.client.name}</h3>
            <p className="text-slate-600">{contract.client.address}</p>
            <div className="pt-2 text-slate-700 space-y-0.5">
              {(contract.client.ico || contract.client.dic) && (
                <p>
                  {contract.client.ico && (
                    <>
                      <strong>IČO:</strong> {contract.client.ico}
                    </>
                  )}
                  {contract.client.ico && contract.client.dic && ' · '}
                  {contract.client.dic && (
                    <>
                      <strong>DIČ:</strong> {contract.client.dic}
                    </>
                  )}
                </p>
              )}
              <p className="text-[11px]">
                Tel: {contract.client.phone}
              </p>
              {contract.client.email && (
                <p className="text-[11px]">
                  E-mail: {contract.client.email}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Platební údaje a data (4 boxy vedle sebe) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200 mb-8">
          <div>
            <span className="text-[10px] font-semibold text-slate-500 uppercase block">Způsob úhrady</span>
            <span className="font-bold text-slate-900 text-xs">Bankovní převod</span>
          </div>

          <div>
            <span className="text-[10px] font-semibold text-slate-500 uppercase block">Datum vystavení</span>
            <span className="font-bold text-slate-900 text-xs">{formatDateCs(issueDate)}</span>
          </div>

          <div>
            <span className="text-[10px] font-semibold text-slate-500 uppercase block">DUZP</span>
            <span className="font-bold text-slate-900 text-xs">{formatDateCs(invoiceDates.taxDate)}</span>
          </div>

          <div>
            <span className="text-[10px] font-semibold text-rose-700 uppercase block">Datum splatnosti</span>
            <span className="font-bold text-rose-900 text-xs">{formatDateCs(dueDateIso)}</span>
          </div>
        </div>

        {/* Bankovní účet & IBAN */}
        <div className="bg-blue-50/50 p-3.5 rounded-xl border border-blue-100 flex flex-wrap items-center justify-between gap-4 mb-8">
          <div>
            <span className="text-[10px] uppercase font-bold text-blue-900 block">Bankovní účet:</span>
            <span className="font-mono font-bold text-slate-900 text-sm">{contract.contractor.bankAccount}</span>
          </div>

          {iban && (
            <div>
              <span className="text-[10px] uppercase font-bold text-blue-900 block">IBAN:</span>
              <span className="font-mono text-slate-700 text-xs">{iban}</span>
            </div>
          )}

          <div>
            <span className="text-[10px] uppercase font-bold text-blue-900 block">Variabilní symbol:</span>
            <span className="font-mono font-bold text-slate-900 text-sm">{variableSymbol}</span>
          </div>
        </div>

        {/* Tabulka položek faktury */}
        <div className="mb-8 overflow-hidden rounded-xl border border-slate-200">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 text-slate-700 uppercase font-bold text-[10px] border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-3">Položka / Popis plnění</th>
                <th className="py-2.5 px-3 text-center w-16">Počet</th>
                <th className="py-2.5 px-3 text-right w-24">Cena/jedn.</th>
                <th className="py-2.5 px-3 text-right w-28">Celkem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isAdvance ? (
                <tr>
                  <td className="py-3 px-3">
                    <strong className="text-slate-900 block text-xs">
                      Záloha na materiál a zahájení prací
                    </strong>
                    <span className="text-slate-600 text-[11px] block mt-0.5">
                      {contract.workDescription}
                    </span>
                    <span className="text-slate-400 text-[10px] block mt-0.5">
                      Dle Smlouvy o dílo č. {contract.contractNumber} (čl. III)
                    </span>
                  </td>
                  <td className="py-3 px-3 text-center font-medium">1 kpl.</td>
                  <td className="py-3 px-3 text-right font-medium">{formatCurrency(rawAmount)}</td>
                  <td className="py-3 px-3 text-right font-bold text-slate-900">
                    {formatCurrency(rawAmount)}
                  </td>
                </tr>
              ) : (
                <>
                  {/* Původní rozsah dle SOD */}
                  <tr>
                    <td className="py-3 px-3">
                      <strong className="text-slate-900 block text-xs">
                        {isInvoiceOnly ? 'Provedení prací' : `Provedení díla dle Smlouvy o dílo č. ${contract.contractNumber}`}
                      </strong>
                      <span className="text-slate-600 text-[11px] block mt-0.5">
                        {contract.workDescription}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center font-medium">1 kpl.</td>
                    <td className="py-3 px-3 text-right font-medium">{formatCurrency(contract.price)}</td>
                    <td className="py-3 px-3 text-right font-bold text-slate-900">
                      {formatCurrency(contract.price)}
                    </td>
                  </tr>

                  {/* Vícepráce - Dodatky ke smlouvě rozepsané */}
                  {amendments.map((amend) => (
                    <tr key={amend.id} className="bg-amber-50/40">
                      <td className="py-2.5 px-3">
                        <strong className="text-amber-900 block text-xs">
                          Dodatek č. {amend.amendmentNumber} (Změnový list víceprací)
                        </strong>
                        <span className="text-slate-700 text-[11px] block mt-0.5">
                          {amend.title}
                          {amend.description ? ` – ${amend.description}` : ''}
                        </span>
                        <span className="text-amber-700 text-[10px] block mt-0.5">
                          Sjednáno dne {formatDateCs(amend.issueDate)}
                          {amend.additionalDays ? ` · Prodloužení termínu o +${amend.additionalDays} dní` : ''}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center font-medium text-amber-900">1 kpl.</td>
                      <td className="py-2.5 px-3 text-right font-medium text-amber-900">
                        {formatSignedCurrency(amend.priceDifference)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-amber-900">
                        {formatSignedCurrency(amend.priceDifference)}
                      </td>
                    </tr>
                  ))}

                  {/* Mezisoučet celkového díla pokud jsou vícepráce */}
                  {amendments.length > 0 && (
                    <tr className="bg-slate-50 font-semibold text-slate-800">
                      <td colSpan={3} className="py-2 px-3 text-right text-[11px]">
                        Celková sjednaná hodnota díla včetně víceprací{reverseCharge ? ', bez DPH' : ''}:
                      </td>
                      <td className="py-2 px-3 text-right font-bold text-slate-900">
                        {formatCurrency(totalContractPriceWithAmendments)}
                      </td>
                    </tr>
                  )}

                  {/* Odpočet sjednané a uhrazené zálohy */}
                  {!!contract.advanceAmount && contract.advanceAmount > 0 && (
                    <tr className="bg-emerald-50/50 text-emerald-900">
                      <td className="py-2.5 px-3">
                        <strong className="block text-xs">
                          Odpočet uhrazené zálohy
                        </strong>
                        <span className="text-emerald-700 text-[10px] block mt-0.5">
                          {advanceNumberForDeduction ? `Zálohová faktura ZAL-${advanceNumberForDeduction}` : 'Záloha podle smlouvy'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center font-medium">-1 kpl.</td>
                      <td className="py-2.5 px-3 text-right font-medium">
                        -{formatCurrency(contract.advanceAmount)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-emerald-800">
                        -{formatCurrency(contract.advanceAmount)}
                      </td>
                    </tr>
                  )}
                </>
              )}
            </tbody>
          </table>
        </div>

        {/* Rozpis DPH (jen konečná faktura plátce) */}
        {isVatPayer && !isAdvance && (
          <div className="mb-8 ml-auto w-full sm:w-2/3 overflow-hidden rounded-xl border border-slate-200">
            <table className="w-full text-xs">
              <thead className="bg-slate-100 text-slate-700 uppercase font-bold text-[10px] border-b border-slate-200">
                <tr>
                  <th className="py-2 px-3 text-left">Sazba DPH</th>
                  <th className="py-2 px-3 text-right">Základ daně</th>
                  <th className="py-2 px-3 text-right">DPH</th>
                  <th className="py-2 px-3 text-right">{reverseCharge ? 'Celkem' : 'Celkem s DPH'}</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="py-2.5 px-3 font-medium">{vat.rate} %</td>
                  <td className="py-2.5 px-3 text-right font-medium">{formatHalere(vat.base)}</td>
                  <td className="py-2.5 px-3 text-right font-medium">{reverseCharge ? 'daň odvede zákazník' : formatHalere(vat.vat)}</td>
                  <td className="py-2.5 px-3 text-right font-bold text-slate-900">{formatHalere(vat.gross)}</td>
                </tr>
              </tbody>
            </table>
            {reverseCharge && (
              <p className="px-3 py-2.5 border-t border-slate-200 text-xs text-slate-800">
                Daň odvede zákazník. Plnění v režimu přenesení daňové povinnosti podle § 92e zákona č. 235/2004 Sb., o dani z přidané hodnoty.
              </p>
            )}
          </div>
        )}

        {/* Spodní blok: Rekapitulace + QR Platba + Podpis */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4 border-t-2 border-slate-900 items-end">
          {/* QR Platba */}
          <div className="flex items-center gap-4 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt="QR Platba"
                className="w-24 h-24 rounded-lg bg-white p-1 border border-slate-300 shrink-0"
              />
            ) : (
              <div className="w-24 h-24 rounded-lg bg-slate-200 flex items-center justify-center shrink-0">
                <QrCode className="w-8 h-8 text-slate-400" />
              </div>
            )}
            <div>
              <div className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-sm uppercase tracking-wider mb-1">
                <CheckCircle className="w-3 h-3" />
                <span>QR Platba</span>
              </div>
              <h4 className="font-bold text-slate-900 text-xs">Platba QR kódem</h4>
              <p className="text-[11px] text-slate-500 leading-tight mt-0.5">
                Naskenujte v bankovní aplikaci v mobilu. Číslo účtu, přesná částka {formatCurrency(rawAmount)} i variabilní symbol se načtou automaticky.
              </p>
            </div>
          </div>

          {/* Celkem k úhradě & Razítko */}
          <div className="space-y-2 text-right">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                {isAdvance ? 'ZÁLOHA K ÚHRADĚ:' : 'DOPLATEK K ÚHRADĚ:'}
              </span>
              <span className="text-2xl font-black text-[#1E3A78] tracking-tight block">
                {formatCurrency(rawAmount)}
              </span>
              <p className="text-[10px] text-slate-500 italic mt-0.5">
                {!contract.contractor.dic ? 'Neplátce DPH.' : reverseCharge ? 'Částka je bez DPH, daň odvede zákazník.' : 'Částka je uvedena včetně DPH.'}
              </p>
            </div>

            <div className="relative flex flex-wrap items-end justify-end gap-x-3 gap-y-2">
              <div className="max-w-full opacity-85 pointer-events-none">
                <CraftsmanStamp contractor={contract.contractor} size="sm" />
              </div>
              <div className="border-t-2 border-dotted border-slate-400 w-36 pt-1.5 text-center relative z-10">
                <span className="text-xs font-bold text-slate-900 block">
                  {contract.contractor.name}
                </span>
                <span className="text-[10px] text-slate-500 font-sans tracking-wide block">
                  (vystavil, podpis a razítko)
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
      {confirm && (
        <Dialog
          title={confirm === 'issue' ? 'Vystavit fakturu?' : 'Stornovat fakturu?'}
          onClose={() => setConfirm(null)}
        >
          <div className="space-y-5 text-[15px]">
            {confirm === 'issue' ? (
              <p>
                Faktura dostane číslo <strong>{isAdvance ? 'ZAL' : 'FA'}-{pendingNumber}</strong>. Číslo se pak už nemění
                a zakázku nepůjde smazat, fakturu půjde jen stornovat.
              </p>
            ) : (
              <p>
                Faktura <strong>{invoiceNumber}</strong> zůstane v evidenci s označením storno, její číslo se znovu nepoužije
                a zakázka se přestane počítat do pohledávek a tržeb. Pokud už jste ji zákazníkovi poslali, dejte mu vědět.
              </p>
            )}
            <div className="flex flex-wrap justify-end gap-2.5">
              <button type="button" onClick={() => setConfirm(null)} className={docButton}>
                Zpět
              </button>
              <button
                type="button"
                onClick={confirm === 'issue' ? handleIssue : handleCancel}
                className={confirm === 'issue' ? docButtonPrimary : docButtonDanger}
              >
                {confirm === 'issue' ? 'Vystavit' : 'Stornovat fakturu'}
              </button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
};
