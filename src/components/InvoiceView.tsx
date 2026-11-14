import React, { useState, useEffect, useRef } from 'react';
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
import { exportContractToPdf } from '../utils/exportPdf';
import { getWhatsAppShareUrl, getMailtoShareUrl } from '../utils/shareUtils';
import { triggerHaptic } from '../utils/haptics';
import { CraftsmanStamp } from './CraftsmanStamp';
import { getAdvanceInvoiceDates, getFinalInvoiceDates } from '../utils/invoiceMath';

interface InvoiceViewProps {
  contract: Contract;
  invoiceType?: 'final' | 'advance';
  onToast?: (type: 'success' | 'error' | 'info', text: string) => void;
  onOpenAmendments?: () => void;
  onOpenCashReceipt?: (type: 'zaloha' | 'doplatek') => void;
  onChangeInvoiceType?: (type: 'final' | 'advance') => void;
}

export const InvoiceView: React.FC<InvoiceViewProps> = ({
  contract,
  invoiceType = 'final',
  onToast,
  onOpenAmendments,
  onOpenCashReceipt,
  onChangeInvoiceType,
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
  const advanceAmount = contract.advanceAmount || (isAdvance ? Math.round(contract.price * 0.4) : 0);

  // Final invoice balance (doplatek k úhradě)
  const finalBalanceToPay = Math.max(0, totalContractPriceWithAmendments - (contract.advanceAmount || 0));

  // The actual payable amount on this specific document
  const rawAmount = isAdvance ? advanceAmount : finalBalanceToPay;

  const invoiceNumber = isAdvance
    ? `ZAL-${contract.invoiceNumber || '2026001'}`
    : `FA-${contract.invoiceNumber || '2026001'}`;

  const variableSymbol = (contract.variableSymbol || contract.invoiceNumber || '2026001').replace(/\D/g, '');

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
      {/* Akční lišta pro fakturu */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200/90 dark:border-slate-800 shadow-xs no-print transition-colors">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/80 text-[#1E3A78] dark:text-blue-300 flex items-center justify-center font-bold text-xs shrink-0">
            <Receipt className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white text-sm">
              {isAdvance ? 'Zálohová faktura k zakázce' : 'Konečná faktura / Daňový doklad'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Doklad č. {invoiceNumber} · Splatnost do {formatDateCs(dueDateIso)}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {onChangeInvoiceType && (
            <div className="inline-flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
              <button
                type="button"
                onClick={() => onChangeInvoiceType('final')}
                className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                  !isAdvance
                    ? 'bg-white dark:bg-slate-900 text-[#1E3A78] dark:text-blue-300 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                Konečná faktura
              </button>
              <button
                type="button"
                onClick={() => onChangeInvoiceType('advance')}
                className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                  isAdvance
                    ? 'bg-white dark:bg-slate-900 text-[#1E3A78] dark:text-blue-300 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                Zálohová faktura
              </button>
            </div>
          )}
          {/* ⚡ Vícepráce tlačítko */}
          {onOpenAmendments && !isAdvance && (
            <button
              onClick={onOpenAmendments}
              className="h-9 inline-flex items-center gap-1.5 px-3 rounded-lg bg-amber-50 dark:bg-amber-950/60 hover:bg-amber-100 dark:hover:bg-amber-900/60 text-amber-800 dark:text-amber-300 text-xs font-semibold border border-amber-200 dark:border-amber-800 transition-colors cursor-pointer"
              title="Přidat vícepráce (Změnový list) a automaticky přepočítat doplatek"
            >
              <FilePlus2 className="w-3.5 h-3.5 text-amber-600" />
              <span>+ Vícepráce</span>
            </button>
          )}

          {/* 💵 Příjmový doklad tlačítko */}
          {onOpenCashReceipt && (
            <button
              onClick={() => onOpenCashReceipt(isAdvance ? 'zaloha' : 'doplatek')}
              className="h-9 inline-flex items-center gap-1.5 px-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 text-xs font-semibold border border-emerald-200 dark:border-emerald-800 transition-colors cursor-pointer"
              title="Vystavit Příjmový pokladní doklad pro platbu v hotovosti"
            >
              <Banknote className="w-3.5 h-3.5 text-emerald-600" />
              <span>Vystavit PPD (hotovost)</span>
            </button>
          )}

          {/* Kopírovat platební údaje */}
          <button
            type="button"
            onClick={handleCopyPaymentInfo}
            className="h-9 inline-flex items-center gap-1.5 px-3 rounded-lg bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-[#1E3A78] dark:text-blue-300 text-xs font-semibold border border-blue-200 dark:border-blue-800 transition-colors cursor-pointer"
            title="Zkopírovat platební údaje do schránky pro rychlé vložení do SMS nebo chatu"
          >
            <Copy className="w-3.5 h-3.5" />
            <span>Kopírovat platbu</span>
          </button>

          {/* WhatsApp share */}
          <a
            href={getWhatsAppShareUrl(contract, isAdvance ? 'zaloha' : 'faktura')}
            target="_blank"
            rel="noopener noreferrer"
            className="h-9 inline-flex items-center gap-1.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            title="Odeslat platební údaje klientovi na WhatsApp"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">WhatsApp</span>
          </a>

          {/* Email share */}
          <a
            href={getMailtoShareUrl(contract, isAdvance ? 'zaloha' : 'faktura')}
            className="h-9 inline-flex items-center gap-1.5 px-3 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
            title="Odeslat e-mailem"
          >
            <Send className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">E-mail</span>
          </a>

          <button
            onClick={handlePrint}
            className="h-9 inline-flex items-center gap-1.5 px-3 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Tisk</span>
          </button>

          <button
            onClick={handleDownloadPdf}
            disabled={isPdfGenerating}
            className="h-9 inline-flex items-center gap-2 px-3.5 rounded-lg bg-slate-900 dark:bg-blue-600 hover:bg-slate-800 dark:hover:bg-blue-500 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer disabled:opacity-75"
          >
            {isPdfGenerating ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
            ) : (
              <FileDown className="w-3.5 h-3.5 text-amber-400" />
            )}
            <span>PDF faktury</span>
          </button>
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
              {isAdvance ? 'ZÁLOHOVÁ FAKTURA' : 'FAKTURA – DAŇOVÝ DOKLAD'}
            </span>
            <h1 className="text-2xl font-black text-slate-950 tracking-tight">
              {invoiceNumber}
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              K smlouvě o dílo: <strong>{contract.contractNumber}</strong>
            </p>
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
              {contract.client.ico && (
                <p>
                  <strong>IČO:</strong> {contract.client.ico}
                </p>
              )}
              <p className="text-[11px]">
                Tel: {contract.client.phone}
              </p>
              <p className="text-[11px]">
                E-mail: {contract.client.email}
              </p>
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
                        Provedení díla dle Smlouvy o dílo č. {contract.contractNumber}
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
                        Celková sjednaná hodnota díla včetně víceprací:
                      </td>
                      <td className="py-2 px-3 text-right font-bold text-slate-900">
                        {formatCurrency(totalContractPriceWithAmendments)}
                      </td>
                    </tr>
                  )}

                  {/* Odpočet sjednané a uhrazené zálohy */}
                  {contract.advanceAmount && contract.advanceAmount > 0 && (
                    <tr className="bg-emerald-50/50 text-emerald-900">
                      <td className="py-2.5 px-3">
                        <strong className="block text-xs">
                          Odpočet uhrazené zálohy
                        </strong>
                        <span className="text-emerald-700 text-[10px] block mt-0.5">
                          Zálohová faktura ZAL-{contract.invoiceNumber}
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
              <h4 className="font-bold text-slate-900 text-xs">Blesková platba mobilem</h4>
              <p className="text-[11px] text-slate-500 leading-tight mt-0.5">
                Naskenujte v bankovní aplikaci v mobilu. Číslo účtu, přesná částka {formatCurrency(rawAmount)} i variabilní symbol se načtou automaticky.
              </p>
            </div>
          </div>

          {/* Celkem k úhradě & Razítko */}
          <div className="space-y-4 text-right">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                {isAdvance ? 'ZÁLOHA K ÚHRADĚ:' : 'DOPLATEK K ÚHRADĚ:'}
              </span>
              <span className="text-2xl font-black text-[#1E3A78] tracking-tight block">
                {formatCurrency(rawAmount)}
              </span>
              <p className="text-[10px] text-slate-500 italic mt-0.5">
                {contract.contractor.dic ? 'Částka je uvedena včetně DPH.' : 'Neplátce DPH.'}
              </p>
            </div>

            <div className="pt-6 relative">
              <div className="absolute -top-10 right-2 opacity-85 pointer-events-none">
                <CraftsmanStamp contractor={contract.contractor} size="sm" />
              </div>
              <div className="border-t-2 border-dotted border-slate-400 w-48 ml-auto pt-1.5 text-center relative z-10">
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
    </div>
  );
};
