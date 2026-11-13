import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft,
  Bookmark,
  FileDown,
  FileText,
  Printer,
  Check,
  Loader2,
  Calendar,
  Building2,
  Receipt,
  FileCheck2,
  Coins,
  PenTool,
  Share2,
  Send,
  MessageSquare,
  Copy,
  X,
  Tag,
  FilePlus2,
  Banknote,
  ShieldCheck,
  TrendingUp,
  Car,
  RefreshCw,
  CheckCircle2,
  ShoppingCart,
  Gauge,
  Users,
  Wrench,
  FolderArchive,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Contract, ContractStatus } from '../types/contract';
import {
  formatContractPriceWithWords,
  formatDateCs,
  formatPlaceWithPreposition,
  formatCurrency,
} from '../utils/numberToWordsCs';
import { exportContractToDocx } from '../utils/exportDocx';
import { exportContractToPdf } from '../utils/exportPdf';
import { InvoiceView } from './InvoiceView';
import { HandoverProtocolView } from './HandoverProtocolView';
import { PriceQuoteView } from './PriceQuoteView';
import { AmendmentView } from './AmendmentView';
import { CashReceiptView } from './CashReceiptView';
import { WarrantyCertificateView } from './WarrantyCertificateView';
import { ExpensesAndProfitModal } from './ExpensesAndProfitModal';
import { LogbookModal } from './LogbookModal';
import { ShoppingListModal } from './ShoppingListModal';
import { TechnicalProtocolsModal } from './TechnicalProtocolsModal';
import { SubcontractorsModal } from './SubcontractorsModal';
import { ToolRentalModal } from './ToolRentalModal';
import { DepartureChecklistModal } from './DepartureChecklistModal';
import { ContractArchiveModal } from './ContractArchiveModal';
import { ShareModal } from './ShareModal';
import { SignatureModal } from './SignatureModal';
import { SiteLogbookModal } from './SiteLogbookModal';
import { ScheduleModal } from './ScheduleModal';
import { getStatusMeta, ALL_STATUSES } from '../utils/contractStatus';
import {
  getWhatsAppShareUrl,
  getMailtoShareUrl,
  buildShareMessage,
} from '../utils/shareUtils';
import { getContractorProfile, saveContractorProfile, addStoredContract } from '../utils/storage';
import { watchSignedShare, getSignedShare } from '../utils/signShares';
import { triggerHaptic } from '../utils/haptics';
import { CraftsmanStamp } from './CraftsmanStamp';
import { isProUser } from '../utils/subscription';

interface ContractPreviewProps {
  contract: Contract;
  onBack: () => void;
  onSaveToHistory: (contract: Contract) => void;
  isSaved?: boolean;
  onToast?: (type: 'success' | 'error' | 'info', text: string) => void;
  initialDocType?: DocumentType;
}

export type DocumentType =
  | 'smlouva'
  | 'nabidka'
  | 'dodatek'
  | 'pokladni_doklad'
  | 'protokol'
  | 'faktura'
  | 'zaloha'
  | 'zaruka';

export const ContractPreview: React.FC<ContractPreviewProps> = ({
  contract,
  onBack,
  onSaveToHistory,
  isSaved = false,
  onToast,
  initialDocType,
}) => {
  const [currentContract, setCurrentContract] = useState<Contract>(contract);
  const isPro = isProUser(getContractorProfile());
  const [activeDocType, setActiveDocType] = useState<DocumentType>(
    initialDocType || (contract.docKind === 'quote' ? 'nabidka' : 'smlouva')
  );
  const [isNewAmendmentTriggered, setIsNewAmendmentTriggered] = useState(false);
  const [isNewReceiptTriggered, setIsNewReceiptTriggered] = useState(false);
  const [receiptPreset, setReceiptPreset] = useState<'zaloha' | 'doplatek'>('doplatek');

  const handleQuickOpenAmendment = () => {
    setActiveDocType('dodatek');
    setIsNewAmendmentTriggered(true);
  };

  const handleQuickOpenReceipt = (preset: 'zaloha' | 'doplatek' = 'doplatek') => {
    setReceiptPreset(preset);
    setActiveDocType('pokladni_doklad');
    setIsNewReceiptTriggered(true);
  };

  const [signatureModalRole, setSignatureModalRole] = useState<'contractor' | 'client' | null>(null);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isExpensesModalOpen, setIsExpensesModalOpen] = useState(false);
  const [isLogbookModalOpen, setIsLogbookModalOpen] = useState(false);
  const [isShoppingListModalOpen, setIsShoppingListModalOpen] = useState(false);
  const [isTechnicalProtocolsModalOpen, setIsTechnicalProtocolsModalOpen] = useState(false);
  const [isSiteLogModalOpen, setIsSiteLogModalOpen] = useState(false);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [isSubcontractorsModalOpen, setIsSubcontractorsModalOpen] = useState(false);
  const [isToolRentalModalOpen, setIsToolRentalModalOpen] = useState(false);
  const [isDepartureChecklistModalOpen, setIsDepartureChecklistModalOpen] = useState(false);
  const [isArchiveModalOpen, setIsArchiveModalOpen] = useState(false);
  const [isSiteToolsMenuOpen, setIsSiteToolsMenuOpen] = useState(false);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);

  const [isCheckingSignature, setIsCheckingSignature] = useState(false);

  // Sync if parent updates contract prop
  useEffect(() => {
    if (contract && contract.id !== currentContract.id) {
      setCurrentContract(contract);
    }
  }, [contract]);

  // Real-time posluchač online podpisu z mobilu zákazníka
  useEffect(() => {
    if (!currentContract.id) return;

    const handleApplySignature = (sigUrl: string, sigDate: string, signer?: string) => {
      setCurrentContract((prev) => {
        if (prev.clientSignature === sigUrl) return prev;
        const updated: Contract = {
          ...prev,
          clientSignature: sigUrl,
          clientSignatureDate: sigDate || new Date().toISOString().split('T')[0],
          status: prev.status === 'draft' ? 'signed' : (prev.status || 'signed'),
        };
        onSaveToHistory(updated);
        onToast?.(
          'success',
          `Klient ${signer ? `(${signer}) ` : ''}právě elektronicky podepsal smlouvu na dálku! Podpis byl automaticky vepsán do dokumentu.`
        );
        return updated;
      });
    };

    // Na online podpis se ptáme jen u smluv, ke kterým byl vytvořen odkaz a ještě nejsou podepsané
    const waitsForRemoteSignature = !!currentContract.signToken && !currentContract.clientSignature;

    // 0. Okamžitá kontrola při otevření náhledu (pokud klient již dříve podepsal na dálku)
    if (waitsForRemoteSignature) {
      getSignedShare(currentContract.id)
        .then((share) => {
          if (share) handleApplySignature(share.clientSignature, share.signedDate, share.signerName);
        })
        .catch(console.warn);
    }

    // 1. Průběžná kontrola, zda klient podepsal
    const unsubscribe = waitsForRemoteSignature
      ? watchSignedShare(currentContract.id, (share) => {
          handleApplySignature(share.clientSignature, share.signedDate, share.signerName);
        })
      : () => {};

    // 2. Sledování lokálního podpisu ze stejného prohlížeče
    const handleLocalSign = (e: any) => {
      const detail = e.detail;
      if (detail && detail.id === currentContract.id && detail.signature) {
        handleApplySignature(detail.signature, detail.date || new Date().toISOString().split('T')[0], detail.signerName);
      }
    };
    window.addEventListener('contract-signed-locally', handleLocalSign as EventListener);

    return () => {
      unsubscribe();
      window.removeEventListener('contract-signed-locally', handleLocalSign as EventListener);
    };
  }, [currentContract.id, currentContract.signToken, currentContract.clientSignature, onSaveToHistory, onToast]);

  // Tajný kód odkazu k online podpisu se uloží ke smlouvě (u uložené smlouvy potichu, bez hlášky)
  const handleSignTokenCreated = useCallback(
    (token: string) => {
      setCurrentContract((prev) => {
        if (prev.signToken) return prev;
        const updated: Contract = { ...prev, signToken: token };
        if (isSaved) {
          addStoredContract(updated);
          window.dispatchEvent(new Event('storage'));
        }
        return updated;
      });
    },
    [isSaved]
  );

  const handleManualCheckSignature = async () => {
    setIsCheckingSignature(true);
    try {
      const share = await getSignedShare(currentContract.id);
      if (share) {
        const datePart = share.signedDate;
        const updated: Contract = {
          ...currentContract,
          clientSignature: share.clientSignature,
          clientSignatureDate: datePart,
          status: currentContract.status === 'draft' ? 'signed' : (currentContract.status || 'signed'),
        };
        setCurrentContract(updated);
        onSaveToHistory(updated);
        onToast?.(
          'success',
          `✓ Nalezen online podpis klienta (${share.signerName || 'Objednatel'}) ze dne ${formatDateCs(datePart)}! Podpis je nyní ve smlouvě.`
        );
      } else {
        onToast?.('info', 'Klient zatím smlouvu přes online odkaz nepodepsal. Jakmile ji podepíše, podpis se zde ihned zobrazí.');
      }
    } catch (e: any) {
      onToast?.('error', 'Nepodařilo se ověřit stav online podpisu: ' + (e?.message || 'Zkuste to prosím znovu.'));
    } finally {
      setIsCheckingSignature(false);
    }
  };

  const paperRef = useRef<HTMLDivElement>(null);
  const [isPdfGenerating, setIsPdfGenerating] = useState(false);
  const [isDocxGenerating, setIsDocxGenerating] = useState(false);
  const [pdfStatusText, setPdfStatusText] = useState<string>('');

  const formattedPrice = formatContractPriceWithWords(currentContract.price);
  const formattedDelivery = formatDateCs(currentContract.deliveryDate);
  const formattedConclusion = formatDateCs(currentContract.conclusionDate);
  const place = currentContract.executionPlace || currentContract.contractor.defaultPlace || 'v místě plnění';

  const handleSaveSignature = (signatureDataUrl: string, saveAsDefaultContractor?: boolean) => {
    const today = new Date().toISOString().split('T')[0];
    const isContr = signatureModalRole === 'contractor';
    const updated: Contract = {
      ...currentContract,
      ...(isContr
        ? {
            contractorSignature: signatureDataUrl,
            contractorSignatureDate: today,
          }
        : {
            clientSignature: signatureDataUrl,
            clientSignatureDate: today,
          }),
      status: currentContract.status === 'draft' ? 'signed' : (currentContract.status || 'signed'),
    };

    setCurrentContract(updated);
    onSaveToHistory(updated);
    onToast?.(
      'success',
      `Podpis ${isContr ? 'zhotovitele' : 'objednatele'} byl úspěšně vložen do smlouvy`
    );

    if (saveAsDefaultContractor && isContr) {
      const prof = getContractorProfile();
      if (prof) {
        saveContractorProfile({ ...prof, signature: signatureDataUrl });
      }
    }
  };

  const handleStatusChange = (newStatus: ContractStatus) => {
    const updated: Contract = { ...currentContract, status: newStatus };
    setCurrentContract(updated);
    onSaveToHistory(updated);
    onToast?.('info', `Stav zakázky změněn na: ${getStatusMeta(newStatus).label}`);
  };

  const handleCopyShareText = () => {
    const { body } = buildShareMessage(currentContract, activeDocType);
    navigator.clipboard.writeText(body);
    onToast?.('success', 'Zpráva pro klienta byla zkopírována do schránky');
  };

  const handleCopyPaymentInfo = () => {
    const bank = currentContract.contractor.bankAccount || 'Neuveden';
    const vs = (currentContract.variableSymbol || currentContract.invoiceNumber || currentContract.contractNumber).replace(/\D/g, '');
    const priceText = formatCurrency(currentContract.price);
    const text = `Platební údaje k zakázce #${currentContract.contractNumber} (${currentContract.workDescription}):\nČíslo účtu: ${bank}\nČástka: ${priceText}${currentContract.advanceAmount ? ` (z toho záloha: ${formatCurrency(currentContract.advanceAmount)})` : ''}\nVariabilní symbol (VS): ${vs}\nPříjemce: ${currentContract.contractor.name}\nDěkuji.`;
    navigator.clipboard.writeText(text);
    triggerHaptic('success');
    onToast?.('success', 'Platební údaje zkopírovány do schránky (připraveno pro SMS/WhatsApp)');
  };

  const handleDownloadDocx = async () => {
    try {
      setIsDocxGenerating(true);
      await exportContractToDocx(currentContract);
      onToast?.('success', 'Word (.docx) dokument byl úspěšně vygenerován');
    } catch (err) {
      console.error('Chyba při stahování DOCX:', err);
      onToast?.('error', 'Nepodařilo se vygenerovat Word dokument.');
    } finally {
      setIsDocxGenerating(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!paperRef.current) return;
    try {
      setIsPdfGenerating(true);
      await exportContractToPdf(paperRef.current, currentContract, (status) => {
        setPdfStatusText(status);
      });
      onToast?.('success', 'PDF smlouvy bylo úspěšně staženo');
    } catch (err) {
      console.error('Chyba při stahování PDF:', err);
      window.print();
    } finally {
      setIsPdfGenerating(false);
      setPdfStatusText('');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-slate-200/70 dark:bg-slate-950 pb-20 transition-colors">
      {/* Sticky Top Action Bar */}
      <div className="sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-300 dark:border-slate-800 shadow-sm no-print transition-colors">
        <div className="max-w-6xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={onBack}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 text-xs sm:text-sm font-semibold transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Zpět</span>
            </button>

            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 text-xs shadow-2xs">
              <span className="font-mono font-bold text-slate-900 dark:text-white">
                #{currentContract.contractNumber}
              </span>
              <span className="text-slate-300 dark:text-slate-600">·</span>
              <span className="font-bold text-slate-700 dark:text-slate-200 max-w-[110px] sm:max-w-[200px] truncate">
                {currentContract.client.name}
              </span>
            </div>
          </div>

          {/* Mobilní přepínač dokumentů (přehledný výběr bez vodorovného rolování) */}
          <div className="md:hidden w-full sm:w-auto">
            <select
              value={activeDocType}
              onChange={(e) => setActiveDocType(e.target.value as DocumentType)}
              className="w-full sm:w-auto text-xs font-bold py-2 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white cursor-pointer shadow-2xs"
            >
              {currentContract.docKind === 'quote' ? (
                <option value="nabidka">Cenová nabídka</option>
              ) : (
                <option value="smlouva">Smlouva o dílo</option>
              )}
              <option value="dodatek">
                Dodatky {currentContract.amendments?.length ? `(${currentContract.amendments.length})` : ''}
              </option>
              <option value="pokladni_doklad">
                Pokladní doklad {currentContract.cashReceipts?.length ? `(${currentContract.cashReceipts.length})` : ''}
              </option>
              <option value="protokol">Předávací protokol</option>
              <option value="faktura">Konečná faktura</option>
              {currentContract.advanceAmount ? (
                <option value="zaloha">Zálohová faktura</option>
              ) : null}
              <option value="zaruka">Záruční list</option>
            </select>
          </div>

          {/* Desktop/Tablet přepínač dokumentů k zakázce: Smlouva/Nabídka, Dodatky, PPD, Protokol, Faktura, Záruka */}
          <div className="hidden md:flex items-center p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 text-xs overflow-x-auto max-w-full">
            {currentContract.docKind === 'quote' ? (
              <button
                onClick={() => setActiveDocType('nabidka')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer whitespace-nowrap ${
                  activeDocType === 'nabidka'
                    ? 'bg-slate-900 text-white dark:bg-blue-600 shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Tag className="w-3.5 h-3.5" />
                <span>Cenová nabídka</span>
              </button>
            ) : (
              <button
                onClick={() => setActiveDocType('smlouva')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer whitespace-nowrap ${
                  activeDocType === 'smlouva'
                    ? 'bg-slate-900 text-white dark:bg-blue-600 shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Smlouva o dílo</span>
              </button>
            )}

            <button
              onClick={() => setActiveDocType('dodatek')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer whitespace-nowrap ${
                activeDocType === 'dodatek'
                  ? 'bg-slate-900 text-white dark:bg-blue-600 shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <FilePlus2 className="w-3.5 h-3.5" />
              <span>
                Dodatky
                {currentContract.amendments && currentContract.amendments.length > 0 && (
                  <span className="ml-1 px-1.5 py-0.2 rounded text-[10px] bg-amber-500 text-slate-950 font-black">
                    {currentContract.amendments.length}
                  </span>
                )}
              </span>
            </button>

            <button
              onClick={() => setActiveDocType('pokladni_doklad')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer whitespace-nowrap ${
                activeDocType === 'pokladni_doklad'
                  ? 'bg-slate-900 text-white dark:bg-blue-600 shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Banknote className="w-3.5 h-3.5" />
              <span>
                Pokladní doklad
                {currentContract.cashReceipts && currentContract.cashReceipts.length > 0 && (
                  <span className="ml-1 px-1.5 py-0.2 rounded text-[10px] bg-emerald-600 text-white font-bold">
                    {currentContract.cashReceipts.length}
                  </span>
                )}
              </span>
            </button>

            <button
              onClick={() => setActiveDocType('protokol')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer whitespace-nowrap ${
                activeDocType === 'protokol'
                  ? 'bg-slate-900 text-white dark:bg-blue-600 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <FileCheck2 className="w-3.5 h-3.5" />
              <span>Předávací protokol</span>
            </button>

            <button
              onClick={() => setActiveDocType(activeDocType === 'zaloha' ? 'zaloha' : 'faktura')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer whitespace-nowrap ${
                activeDocType === 'faktura' || activeDocType === 'zaloha'
                  ? 'bg-slate-900 text-white dark:bg-blue-600 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Receipt className="w-3.5 h-3.5" />
              <span>
                Faktura
                {currentContract.advanceAmount ? (
                  <span className="text-[10px] opacity-80 ml-1">
                    ({activeDocType === 'zaloha' ? 'záloha' : 'konečná'})
                  </span>
                ) : null}
              </span>
            </button>

            <button
              onClick={() => setActiveDocType('zaruka')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer whitespace-nowrap ${
                activeDocType === 'zaruka'
                  ? 'bg-slate-900 text-white dark:bg-blue-600 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
              <span>Záruční list</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Stav zakázky badge & selector */}
            <div className="relative inline-flex items-center h-9">
              <select
                value={currentContract.status || 'draft'}
                onChange={(e) => handleStatusChange(e.target.value as ContractStatus)}
                className={`h-9 text-xs font-bold px-3 rounded-lg border appearance-none pr-7 cursor-pointer transition-colors ${
                  getStatusMeta(currentContract.status).badgeBg
                } ${getStatusMeta(currentContract.status).badgeText} ${
                  getStatusMeta(currentContract.status).badgeBorder
                }`}
                title="Změnit stav zakázky"
              >
                {ALL_STATUSES.map((st) => (
                  <option key={st} value={st}>
                    ● {getStatusMeta(st).label}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] opacity-70">
                ▼
              </div>
            </div>

            {/* Náklady & Ziskovost */}
            <button
              onClick={() => setIsExpensesModalOpen(true)}
              className="h-9 inline-flex items-center gap-1.5 px-3 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold border border-slate-200 dark:border-slate-700 shadow-2xs transition-colors cursor-pointer"
              title="Evidence nákladů na materiál a čistý zisk zakázky"
            >
              <TrendingUp className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" />
              <span>Náklady a zisk</span>
            </button>

            {/* 🛠️ Nástroje stavby Dropdown menu (Mistr PRO) */}
            {isPro && (
              <div className="relative">
              <button
                type="button"
                onClick={() => setIsSiteToolsMenuOpen(!isSiteToolsMenuOpen)}
                className={`h-9 inline-flex items-center gap-1.5 px-3 rounded-lg text-xs font-semibold border shadow-xs transition-colors cursor-pointer ${
                  isSiteToolsMenuOpen
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700'
                }`}
                title="Otevřít nástroje stavby (deník, zkoušky ČSN, parťáci, půjčovna, odjezd)"
              >
                <Wrench className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                <span>Nástroje stavby</span>
                {currentContract.toolRentals?.some((t) => !t.isReturned) && (
                  <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" title="Nevrácené nářadí z půjčovny" />
                )}
                {isSiteToolsMenuOpen ? (
                  <ChevronUp className="w-3.5 h-3.5" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5 opacity-70" />
                )}
              </button>

              {isSiteToolsMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setIsSiteToolsMenuOpen(false)}
                  />
                  <div className="absolute left-0 sm:right-auto top-full mt-1.5 w-64 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xl z-50 p-2 space-y-1">
                    <div className="px-2 py-1 text-3xs font-bold text-slate-400 uppercase tracking-wider">
                      Stavba & Realizace
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setIsSiteToolsMenuOpen(false);
                        setIsSiteLogModalOpen(true);
                      }}
                      className="w-full flex items-center justify-between px-2.5 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-slate-200 transition-colors text-left cursor-pointer"
                    >
                      <span className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                        <span>Stavební deník</span>
                      </span>
                      {currentContract.siteLogs && currentContract.siteLogs.length > 0 && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                          {currentContract.siteLogs.length}
                        </span>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setIsSiteToolsMenuOpen(false);
                        setIsTechnicalProtocolsModalOpen(true);
                      }}
                      className="w-full flex items-center justify-between px-2.5 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-slate-200 transition-colors text-left cursor-pointer"
                    >
                      <span className="flex items-center gap-2">
                        <Gauge className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        <span>Zkoušky ČSN (tlakovky)</span>
                      </span>
                      {currentContract.technicalProtocols && currentContract.technicalProtocols.length > 0 && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                          {currentContract.technicalProtocols.length}
                        </span>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setIsSiteToolsMenuOpen(false);
                        setIsSubcontractorsModalOpen(true);
                      }}
                      className="w-full flex items-center justify-between px-2.5 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-slate-200 transition-colors text-left cursor-pointer"
                    >
                      <span className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                        <span>Parťáci & tým</span>
                      </span>
                      {currentContract.subcontractors && currentContract.subcontractors.length > 0 && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                          {currentContract.subcontractors.length}
                        </span>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setIsSiteToolsMenuOpen(false);
                        setIsToolRentalModalOpen(true);
                      }}
                      className="w-full flex items-center justify-between px-2.5 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-slate-200 transition-colors text-left cursor-pointer"
                    >
                      <span className="flex items-center gap-2">
                        <Wrench className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                        <span>Půjčovna nářadí</span>
                      </span>
                      {currentContract.toolRentals && currentContract.toolRentals.some((t) => !t.isReturned) && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-500 text-white">
                          Nevráceno
                        </span>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setIsSiteToolsMenuOpen(false);
                        setIsDepartureChecklistModalOpen(true);
                      }}
                      className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-slate-200 transition-colors text-left cursor-pointer"
                    >
                      <ShieldCheck className="w-4 h-4 text-emerald-600" />
                      <span>Odjezd ze stavby (checklist)</span>
                    </button>

                    <div className="pt-1 mt-1 border-t border-slate-100 dark:border-slate-800 px-2 py-0.5 text-3xs font-bold text-slate-400 uppercase tracking-wider">
                      Logistika & Plánování
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setIsSiteToolsMenuOpen(false);
                        setIsLogbookModalOpen(true);
                      }}
                      className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-slate-200 transition-colors text-left cursor-pointer"
                    >
                      <Car className="w-4 h-4 text-blue-600" />
                      <span>Kniha jízd (cesťák)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setIsSiteToolsMenuOpen(false);
                        setIsShoppingListModalOpen(true);
                      }}
                      className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-slate-200 transition-colors text-left cursor-pointer"
                    >
                      <ShoppingCart className="w-4 h-4 text-amber-600" />
                      <span>Nákupní lístek (materiál)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setIsSiteToolsMenuOpen(false);
                        setIsScheduleModalOpen(true);
                      }}
                      className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-slate-200 transition-colors text-left cursor-pointer"
                    >
                      <Calendar className="w-4 h-4 text-purple-600" />
                      <span>Harmonogram etap</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setIsSiteToolsMenuOpen(false);
                        setIsArchiveModalOpen(true);
                      }}
                      className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-slate-200 transition-colors text-left cursor-pointer pt-2 border-t border-slate-100 dark:border-slate-800"
                    >
                      <FolderArchive className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      <span>Složka zakázky (digitální šanon)</span>
                    </button>
                  </div>
                </>
              )}
              </div>
            )}

            {/* Kopírovat platební údaje */}
            <button
              onClick={handleCopyPaymentInfo}
              className="h-9 inline-flex items-center gap-1.5 px-3 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold border border-slate-200 dark:border-slate-700 shadow-2xs transition-colors cursor-pointer"
              title="Zkopírovat číslo účtu, částku a VS do schránky (vhodné pro SMS nebo WhatsApp)"
            >
              <Copy className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span className="hidden sm:inline">Kopírovat platbu</span>
            </button>

            {/* Odeslat klientovi (SMS / WhatsApp / E-mail s automatickými šablonami) */}
            <button
              onClick={() => setIsShareModalOpen(true)}
              className="h-9 inline-flex items-center gap-1.5 px-3.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shadow-2xs transition-colors cursor-pointer"
              title="Odeslat podklady nebo automatické SMS/zprávy (připomenutí nástupu, upomínka splatnosti)"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Odeslat</span>
            </button>

            {/* Hlavní akce: Uložit PDF */}
            <button
              onClick={handleDownloadPdf}
              disabled={isPdfGenerating}
              className="h-9 inline-flex items-center gap-2 px-3.5 rounded-lg bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer disabled:opacity-75"
              title="Stáhnout smlouvu jako PDF"
            >
              {isPdfGenerating ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
              ) : (
                <FileDown className="w-3.5 h-3.5 text-amber-400" />
              )}
              <span>{isPdfGenerating ? (pdfStatusText || 'Generuji…') : 'Uložit PDF'}</span>
            </button>

            {/* Menu dalších formátů exportu (Word, Tisk) */}
            <div className="relative inline-block">
              <button
                type="button"
                onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
                className="h-9 px-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 flex items-center gap-1 text-xs font-bold transition-colors cursor-pointer"
                title="Další formáty exportu (Word, Tisk)"
              >
                <Printer className="w-3.5 h-3.5" />
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </button>

              {isExportMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setIsExportMenuOpen(false)}
                  />
                  <div className="absolute right-0 top-full mt-1.5 w-48 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xl z-50 p-1.5 space-y-1 animate-in fade-in zoom-in-95 duration-100">
                    <button
                      onClick={() => {
                        setIsExportMenuOpen(false);
                        handleDownloadDocx();
                      }}
                      disabled={isDocxGenerating}
                      className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-semibold text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-left cursor-pointer"
                    >
                      <FileText className="w-4 h-4 text-blue-600" />
                      <span>{isDocxGenerating ? 'Generuji...' : 'Word (.docx)'}</span>
                    </button>
                    <button
                      onClick={() => {
                        setIsExportMenuOpen(false);
                        handlePrint();
                      }}
                      className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-semibold text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-left cursor-pointer"
                    >
                      <Printer className="w-4 h-4 text-slate-500" />
                      <span>Vytisknout</span>
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Ověření online podpisu klienta */}
            {currentContract.clientSignature ? (
              <span
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-xs font-semibold shadow-2xs"
                title={`Klient podepsal smlouvu (${formatDateCs(currentContract.clientSignatureDate || currentContract.conclusionDate)})`}
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span className="hidden sm:inline">Podpis klienta</span>
              </span>
            ) : (
              <button
                type="button"
                onClick={handleManualCheckSignature}
                disabled={isCheckingSignature}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-800 dark:text-blue-300 text-xs font-semibold border border-blue-200 dark:border-blue-800 shadow-2xs transition-colors cursor-pointer"
                title="Zkontrolovat, zda klient již podepsal přes online odkaz na mobilu"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-blue-600 ${isCheckingSignature ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">{isCheckingSignature ? 'Ověřuji...' : 'Ověřit online podpis'}</span>
              </button>
            )}

            <button
              onClick={() => onSaveToHistory(currentContract)}
              disabled={isSaved}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer border ${
                isSaved
                  ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 cursor-default'
                  : 'bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700 shadow-xs'
              }`}
              title="Uložit aktuální stav dokumentu do historie"
            >
              {isSaved ? <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> : <Bookmark className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">{isSaved ? 'Uloženo' : 'Uložit'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Contract Preview Page Wrapper */}
      <div className="max-w-[850px] mx-auto px-2 sm:px-4 pt-6 sm:pt-8">
        {activeDocType === 'nabidka' ? (
          <PriceQuoteView
            contract={currentContract}
            onConvertToContract={(converted) => {
              setCurrentContract(converted);
              onSaveToHistory(converted);
              setActiveDocType('smlouva');
            }}
            onToast={onToast}
          />
        ) : activeDocType === 'dodatek' ? (
          <AmendmentView
            contract={currentContract}
            onUpdateContract={(updated) => {
              setCurrentContract(updated);
              onSaveToHistory(updated);
            }}
            onToast={onToast}
            initialOpenNew={isNewAmendmentTriggered}
          />
        ) : activeDocType === 'pokladni_doklad' ? (
          <CashReceiptView
            contract={currentContract}
            onUpdateContract={(updated) => {
              setCurrentContract(updated);
              onSaveToHistory(updated);
            }}
            onToast={onToast}
            initialOpenNew={isNewReceiptTriggered}
            initialPaymentFor={receiptPreset}
          />
        ) : activeDocType === 'protokol' ? (
          <HandoverProtocolView
            contract={currentContract}
            onUpdateContract={(updated) => {
              setCurrentContract(updated);
              onSaveToHistory(updated);
            }}
            onToast={onToast}
          />
        ) : activeDocType === 'faktura' || activeDocType === 'zaloha' ? (
          <InvoiceView
            contract={currentContract}
            invoiceType={activeDocType === 'zaloha' ? 'advance' : 'final'}
            onToast={onToast}
            onOpenAmendments={handleQuickOpenAmendment}
            onOpenCashReceipt={handleQuickOpenReceipt}
            onChangeInvoiceType={(type) => setActiveDocType(type === 'advance' ? 'zaloha' : 'faktura')}
          />
        ) : activeDocType === 'zaruka' ? (
          <WarrantyCertificateView
            contract={currentContract}
            onUpdateContract={(updated) => {
              setCurrentContract(updated);
              onSaveToHistory(updated);
            }}
            onToast={onToast}
          />
        ) : (
          <>
            {/* A4 Document Status Ribbon */}
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400 no-print px-1">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 font-mono font-bold text-[11px] px-2.5 py-0.5 rounded bg-slate-900 text-amber-400 dark:bg-white dark:text-slate-900 shadow-2xs">
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-400 dark:text-slate-900" />
                  § 2586 NOZ · PRÁVNĚ ZÁVAZNÉ DÍLO
                </span>
                <span className="font-mono text-[11px] text-slate-500">Formát A4 (210 × 297 mm)</span>
              </div>
              <div className="flex items-center gap-2 text-[11px] font-mono text-slate-500 dark:text-slate-400">
                <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
                <span>Připraveno k tisku, podpisu a PDF archivaci</span>
              </div>
            </div>

            {/* The Paper Sheet */}
            <div
              ref={paperRef}
              className="contract-page bg-white shadow-2xl rounded-sm p-8 sm:p-14 md:p-16 border border-slate-300/80 font-serif-contract text-slate-900 leading-relaxed text-[15px] select-text relative"
              style={{
                minHeight: '297mm',
                width: '100%',
                maxWidth: '210mm',
                margin: '0 auto',
                boxSizing: 'border-box',
              }}
            >
              {/* Header & Title */}
              <div className="text-center mb-8 pb-4 border-b border-slate-200">
                <h1 className="text-2xl sm:text-3xl font-bold tracking-normal uppercase text-black mb-1">
                  SMLOUVA O DÍLO
                </h1>
                <p className="text-xs sm:text-sm text-slate-700 italic">
                  uzavřená podle § 2586 a násl. zákona č. 89/2012 Sb., občanský zákoník
                </p>
                <p className="text-xs font-sans font-bold text-slate-500 mt-1">
                  Evidenční číslo: {contract.contractNumber}
                </p>
              </div>

              {/* Smluvní strany */}
              <div className="mb-8 space-y-4">
                <h2 className="text-base font-bold uppercase tracking-wide text-black">
                  Smluvní strany:
                </h2>

                {/* Objednatel */}
                <div className="pl-4 border-l-2 border-slate-400">
                  <p className="font-bold text-black mb-1">1. Objednatel:</p>
                  <table className="w-full text-sm">
                    <tbody>
                      <tr>
                        <td className="w-44 font-semibold text-slate-800 py-0.5">Jméno a příjmení / Firma:</td>
                        <td className="font-bold text-black">{contract.client.name}</td>
                      </tr>
                      <tr>
                        <td className="font-semibold text-slate-800 py-0.5">Bydliště / Sídlo:</td>
                        <td>{contract.client.address}</td>
                      </tr>
                      {contract.client.ico && (
                        <tr>
                          <td className="font-semibold text-slate-800 py-0.5">IČO:</td>
                          <td>{contract.client.ico}</td>
                        </tr>
                      )}
                      <tr>
                        <td className="font-semibold text-slate-800 py-0.5">Telefon:</td>
                        <td>{contract.client.phone}</td>
                      </tr>
                      <tr>
                        <td className="font-semibold text-slate-800 py-0.5">E-mail:</td>
                        <td>{contract.client.email}</td>
                      </tr>
                    </tbody>
                  </table>
                  <p className="text-xs italic text-slate-600 mt-1">
                    (dále jen jako „Objednatel“)
                  </p>
                </div>

                <p className="text-center font-semibold italic text-slate-700 py-1">a</p>

                {/* Zhotovitel */}
                <div className="pl-4 border-l-2 border-slate-400">
                  <p className="font-bold text-black mb-1">2. Zhotovitel:</p>
                  <table className="w-full text-sm">
                    <tbody>
                      <tr>
                        <td className="w-44 font-semibold text-slate-800 py-0.5">Obchodní jméno / Jméno:</td>
                        <td className="font-bold text-black">{contract.contractor.name}</td>
                      </tr>
                      <tr>
                        <td className="font-semibold text-slate-800 py-0.5">Sídlo / Místo podnikání:</td>
                        <td>{contract.contractor.address}</td>
                      </tr>
                      <tr>
                        <td className="font-semibold text-slate-800 py-0.5">IČO:</td>
                        <td>
                          {contract.contractor.ico}
                          {contract.contractor.dic ? ` · DIČ: ${contract.contractor.dic}` : ' (není plátce DPH)'}
                        </td>
                      </tr>
                      <tr>
                        <td className="font-semibold text-slate-800 py-0.5">Bankovní účet:</td>
                        <td className="font-bold text-black">{contract.contractor.bankAccount}</td>
                      </tr>
                      <tr>
                        <td className="font-semibold text-slate-800 py-0.5">Telefon a E-mail:</td>
                        <td>{contract.contractor.phone} · {contract.contractor.email}</td>
                      </tr>
                      <tr>
                        <td className="font-semibold text-slate-800 py-0.5">Zápis v evidenci:</td>
                        <td className="italic text-xs text-slate-700">fyzická osoba podnikající zapsaná v živnostenském rejstříku</td>
                      </tr>
                    </tbody>
                  </table>
                  <p className="text-xs italic text-slate-600 mt-1">
                    (dále jen jako „Zhotovitel“)
                  </p>
                </div>
              </div>

              <p className="text-sm italic text-slate-700 mb-6">
                uzavírají níže uvedeného dne, měsíce a roku tuto smlouvu o dílo:
              </p>

              {/* Články smlouvy */}
              <div className="space-y-6 text-justify">
                {/* Čl. I */}
                <div>
                  <h3 className="font-bold text-black mb-2 uppercase text-sm border-b border-slate-200 pb-1">
                    Článek I – Předmět smlouvy
                  </h3>
                  <p className="mb-2">
                    <strong>1.1</strong> Zhotovitel se zavazuje provést pro objednatele na svůj náklad a nebezpečí dílo, kterým je:
                  </p>
                  <div className="bg-slate-50/80 p-3 rounded-sm border border-slate-200 font-sans text-sm my-2 text-slate-900 leading-relaxed whitespace-pre-line">
                    {contract.workDescription}
                  </div>
                  <p>
                    <strong>1.2</strong> Objednatel se zavazuje řádně a včas provedené dílo převzít a zaplatit zhotoviteli sjednanou cenu za jeho provedení způsobem a ve lhůtě dohodnuté v této smlouvě.
                  </p>
                </div>

                {/* Čl. II */}
                <div>
                  <h3 className="font-bold text-black mb-2 uppercase text-sm border-b border-slate-200 pb-1">
                    Článek II – Místo a doba plnění
                  </h3>
                  <p className="mb-2">
                    <strong>2.1</strong> Místem provedení díla je adresa objednatele uvedená v záhlaví této smlouvy, nedohodnou-li se smluvní strany výslovně písemně jinak.
                  </p>
                  <p>
                    <strong>2.2</strong> Zhotovitel se zavazuje zahájit provádění díla bez zbytečného odkladu a celé dílo dokončit a předat objednateli nejpozději do: <strong>{formattedDelivery}</strong>.
                  </p>
                </div>

                {/* Čl. III */}
                <div>
                  <h3 className="font-bold text-black mb-2 uppercase text-sm border-b border-slate-200 pb-1">
                    Článek III – Cena a platební podmínky
                  </h3>
                  <p className="mb-2">
                    <strong>3.1</strong> Celková cena za provedení díla byla stanovena dohodou smluvních stran a činí:{' '}
                    <strong>{formattedPrice}</strong>.{' '}
                    {contract.contractor.dic ? 'Uvedená cena je včetně DPH.' : 'Zhotovitel není plátcem DPH.'}
                  </p>

                  {currentContract.items && currentContract.items.length > 0 && (
                    <div className="my-2.5 p-2 bg-slate-50 border border-slate-200 rounded-sm font-sans text-xs">
                      <div className="font-bold text-[11px] uppercase tracking-wider text-slate-700 mb-1">
                        Položkový soupis prací a materiálu tvořící součást ceny díla:
                      </div>
                      <table className="w-full text-left border-collapse text-[11px]">
                        <thead>
                          <tr className="border-b border-slate-200 text-slate-500 font-bold">
                            <th className="py-1">Položka</th>
                            <th className="py-1 text-right">Množství</th>
                            <th className="py-1 text-right">Cena / jedn.</th>
                            <th className="py-1 text-right">Celkem</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {currentContract.items.map((it) => (
                            <tr key={it.id}>
                              <td className="py-1 font-medium">{it.title}</td>
                              <td className="py-1 text-right">{it.quantity} {it.unit}</td>
                              <td className="py-1 text-right">{formatCurrency(it.unitPrice)}</td>
                              <td className="py-1 text-right font-bold">{formatCurrency(it.totalPrice)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {currentContract.amendments && currentContract.amendments.length > 0 && (
                    <div className="my-2 p-2 bg-amber-50/60 border border-amber-200 rounded-sm font-sans text-xs text-amber-900">
                      <strong>Upozornění o dodatcích:</strong> K této smlouvě byly sjednány{' '}
                      <strong>{currentContract.amendments.length} písemné dodatky</strong> na vícepráce v celkové výši{' '}
                      <strong>
                        +{formatCurrency(
                          currentContract.amendments.reduce((s, a) => s + (a.priceDifference || 0), 0)
                        )}
                      </strong>.
                    </div>
                  )}

                  {contract.advanceAmount && contract.advanceAmount > 0 ? (
                    <p className="mb-2">
                      <strong>3.2</strong> Smluvní strany sjednávají zálohu na materiál a přípravné práce ve výši{' '}
                      <strong>{formatContractPriceWithWords(contract.advanceAmount)}</strong>, splatnou před zahájením prací na základě zálohové faktury. Doplatek ceny ve výši{' '}
                      <strong>{formatContractPriceWithWords(contract.price - contract.advanceAmount)}</strong> je splatný po protokolárním předání a převzetí díla se splatností 14 dnů.
                    </p>
                  ) : (
                    <p className="mb-2">
                      <strong>3.2</strong> Cena za dílo je splatná na základě konečné faktury vystavené zhotovitelem po protokolárním předání a převzetí díla, se splatností <strong>14 kalendářních dnů</strong> ode dne jejího vystavení, a to bezhotovostním převodem na bankovní účet zhotovitele č. <strong>{contract.contractor.bankAccount}</strong>.
                    </p>
                  )}
                  <p className="mb-2">
                    <strong>3.3 Výhrada vlastnického práva k materiálu:</strong> Zhotovitel zůstává výlučným vlastníkem veškerého dodaného a zabudovaného stavebního materiálu, dílů, komponent a zařízení až do okamžiku úplného zaplacení dohodnuté ceny díla objednatelem (výhrada vlastnictví dle § 2132 ve spojení s § 2599 občanského zákoníku č. 89/2012 Sb.). Nebezpečí škody na zhotovované věci přechází na objednatele okamžikem převzetí díla či staveniště.
                  </p>
                  <p className="mb-2">
                    <strong>3.4 Pravidla pro vícepráce a změny díla:</strong> Jakékoliv práce nad rámec položkového rozpočtu či zadání této smlouvy (vícepráce), stejně jako záměny materiálů nebo redukce prací (méněpráce), vyžadují předchozí prokazatelné písemné odsouhlasení obou smluvních stran (formou číslovaného dodatku k této smlouvě nebo zápisem v montážním/stavebním deníku) včetně výslovného určení vlivu na cenu díla a termín dokončení. Bez předchozího písemného odsouhlasení nevzniká zhotoviteli povinnost vícepráce provést ani objednateli povinnost je uhradit.
                  </p>
                  <p>
                    <strong>3.5</strong> Zhotovitel je po vzájemné dohodě oprávněn požadovat přiměřenou zálohu na nákup materiálu a vybavení před zahájením prací.
                  </p>

                  {/* Živnostenské rychlé akce (viditelné jen na obrazovce, skryté při tisku) */}
                  <div className="no-print mt-3 pt-2 border-t border-slate-200 flex flex-wrap items-center gap-2 font-sans text-xs">
                    <button
                      type="button"
                      onClick={handleQuickOpenAmendment}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 font-semibold cursor-pointer transition-colors shadow-2xs"
                      title="Přidat vícepráce nebo změnu rozsahu (Změnový list s podpisem na mobilu)"
                    >
                      <FilePlus2 className="w-3.5 h-3.5 text-amber-600" />
                      <span>+ Přidat vícepráce (Změnový list)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleQuickOpenReceipt(contract.advanceAmount ? 'zaloha' : 'doplatek')}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200 font-semibold cursor-pointer transition-colors shadow-2xs"
                      title="Vystavit Příjmový pokladní doklad pro platbu v hotovosti na ruku"
                    >
                      <Banknote className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Vystavit příjmový doklad (hotovost)</span>
                    </button>
                  </div>
                </div>

                {/* Čl. IV */}
                <div>
                  <h3 className="font-bold text-black mb-2 uppercase text-sm border-b border-slate-200 pb-1">
                    Článek IV – Práva a povinnosti zhotovitele
                  </h3>
                  <p className="mb-2">
                    <strong>4.1</strong> Zhotovitel se zavazuje provést dílo s odbornou péčí, řádně, včas a v souladu s příslušnými technickými normami (ČSN), technologickými předpisy výrobců materiálů a právními předpisy.
                  </p>
                  <p className="mb-2">
                    <strong>4.2</strong> Zhotovitel postupuje při provádění díla samostatně, je však vázán případnými oprávněnými pokyny objednatele týkajícími se způsobu realizace. Na nevhodnost pokynů je zhotovitel povinen objednatele bezodkladně upozornit.
                  </p>
                  <p className="mb-2">
                    <strong>4.3</strong> Zhotovitel je povinen udržovat na staveništi přiměřený pořádek a čistotu, dodržovat platné předpisy BOZP a požární ochrany. Po dokončení denních prací zabezpečí staveniště a po dokončení díla zajistí hrubý úklid pracoviště a soustředění stavebního odpadu na určené místo.
                  </p>
                  <p className="mb-2">
                    <strong>4.4</strong> Zhotovitel prověří stavební připravenost podkladu před zahájením montážních prací a bez zbytečného odkladu upozorní objednatele na zjevné vady či skryté překážky zjištěné při provádění díla.
                  </p>
                </div>

                {/* Čl. V */}
                <div>
                  <h3 className="font-bold text-black mb-2 uppercase text-sm border-b border-slate-200 pb-1">
                    Článek V – Práva a povinnosti objednatele a součinnost
                  </h3>
                  <p className="mb-2">
                    <strong>5.1</strong> Objednatel se zavazuje předat zhotoviteli staveniště/místo plnění ve stavu plně způsobilém k řádnému provádění prací (vyklizené a zabezpečené) nejpozději v den zahájení realizace.
                  </p>
                  <p className="mb-2">
                    <strong>5.2</strong> Objednatel se zavazuje poskytnout zhotoviteli veškerou nezbytnou součinnost potřebnou k řádnému provedení díla, zejména zajistit bezpečný přístup na místo plnění, bezplatný odběr vody a elektrické energie po celou dobu provádění díla a uzamykatelné místo pro uložení nářadí a materiálu zhotovitele.
                  </p>
                  <p className="mb-2">
                    <strong>5.3</strong> Objednatel je povinen dokončené dílo bez zbytečného odkladu prohlédnout, protokolárně převzít a uhradit dohodnutou cenu za podmínek stanovených touto smlouvou.
                  </p>
                  <p className="mb-2">
                    <strong>5.4</strong> V případě prodlení objednatele s předáním staveniště, poskytnutím součinnosti či úhradou sjednané zálohy se termín dokončení díla automaticky prodlužuje o dobu trvání tohoto prodlení a zhotovitel není po tuto dobu v prodlení.
                  </p>
                </div>

                {/* Čl. VI */}
                <div>
                  <h3 className="font-bold text-black mb-2 uppercase text-sm border-b border-slate-200 pb-1">
                    Článek VI – Předání a převzetí díla
                  </h3>
                  <p className="mb-2">
                    <strong>6.1</strong> O předání a převzetí díla sepíší smluvní strany písemný <strong>předávací protokol</strong>, který bude obsahovat zhodnocení jakosti provedeného díla a případný soupis drobných ojedinělých vad či nedodělků, které samy o sobě nebrání užívání díla, včetně závazného termínu jejich odstranění.
                  </p>
                  <p className="mb-2">
                    <strong>6.2</strong> Dílo se považuje za řádně dokončené a předané okamžikem podpisu předávacího protokolu oběma smluvními stranami.
                  </p>
                </div>

                {/* Čl. VII */}
                <div>
                  <h3 className="font-bold text-black mb-2 uppercase text-sm border-b border-slate-200 pb-1">
                    Článek VII – Odpovědnost za vady a záruka
                  </h3>
                  <p className="mb-2">
                    <strong>7.1</strong> Zhotovitel poskytuje objednateli na provedené dílo záruku za jakost v délce <strong>24 měsíců</strong>. Záruční doba počíná běžet dnem protokolárního předání a převzetí díla.
                  </p>
                  <p className="mb-2">
                    <strong>7.2</strong> Objednatel je povinen zjištěné vady uplatnit u zhotovitele písemně (případně prokazatelně elektronickou poštou) bez zbytečného odkladu po jejich zjištění. Zhotovitel se zavazuje započít s odstraňováním oprávněně reklamované vady do 10 pracovních dnů od doručení reklamace.
                  </p>
                </div>

                {/* Čl. VIII */}
                <div>
                  <h3 className="font-bold text-black mb-2 uppercase text-sm border-b border-slate-200 pb-1">
                    Článek VIII – Smluvní pokuta
                  </h3>
                  <p className="mb-2">
                    <strong>8.1</strong> V případě prodlení zhotovitele s dokončením a předáním díla v dohodnutém termínu má objednatel právo požadovat smluvní pokutu ve výši <strong>0,05 %</strong> z celkové ceny díla za každý i započatý den prodlení.
                  </p>
                  <p className="mb-2">
                    <strong>8.2</strong> V případě prodlení objednatele s úhradou ceny díla je zhotovitel oprávněn požadovat po objednateli smluvní pokutu ve výši <strong>0,05 %</strong> z dlužné částky za každý den prodlení.
                  </p>
                </div>

                {/* Čl. IX */}
                <div>
                  <h3 className="font-bold text-black mb-2 uppercase text-sm border-b border-slate-200 pb-1">
                    Článek IX – Závěrečná ustanovení
                  </h3>
                  <p className="mb-2">
                    <strong>9.1</strong> Veškeré změny, doplňky a odchylky od této smlouvy lze sjednat výhradně písemnou formou, a to číslovanými dodatky podepsanými oběma smluvními stranami.
                  </p>
                  <p className="mb-2">
                    <strong>9.2</strong> Práva a povinnosti touto smlouvou výslovně neupravené se řídí příslušnými ustanoveními zákona č. 89/2012 Sb., občanský zákoník, ve znění pozdějších předpisů.
                  </p>
                  <p className="mb-2">
                    <strong>9.3</strong> Tato smlouva je vyhotovena ve dvou stejnopisech s platností originálu, přičemž každá smluvní strana obdrží po jednom vyhotovení.
                  </p>
                  <p>
                    <strong>9.4</strong> Smluvní strany shodně prohlašují, že si tuto smlouvu před jejím podpisem řádně přečetly, jejímu obsahu porozuměly a s tímto obsahem bez výhrad souhlasí, což stvrzují svými vlastnoručními podpisy.
                  </p>
                </div>
              </div>

              {/* Datum a Podpisy */}
              <div className="mt-12 pt-4">
                <p className="font-semibold text-black mb-10">
                  {formatPlaceWithPreposition(place)} dne {formattedConclusion}
                </p>

                <div className="grid grid-cols-2 gap-8 text-center pt-6">
                  {/* Objednatel */}
                  <div className="flex flex-col items-center">
                    <p className="font-bold text-black mb-2">Objednatel:</p>

                    <div className="w-full flex flex-col items-center justify-end min-h-20 mb-2">
                      {currentContract.clientSignature ? (
                        <div className="flex flex-col items-center justify-end h-20">
                          <img
                            src={currentContract.clientSignature}
                            alt="Podpis objednatele"
                            className="max-h-16 max-w-44 object-contain"
                          />
                          <span className="text-[10px] text-slate-500 font-sans mt-0.5">
                            ✓ Podepsáno digitálně {formatDateCs(currentContract.clientSignatureDate || currentContract.conclusionDate)}
                          </span>
                        </div>
                      ) : (
                        <>
                          <div className="hidden print:flex h-16 w-full items-end justify-center">
                            <span className="text-[9px] text-slate-400 font-sans italic pb-1">
                              (vlastnoruční podpis objednatele perem)
                            </span>
                          </div>
                          <div className="no-print min-h-20 flex flex-col items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setSignatureModalRole('client')}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-colors cursor-pointer shadow-xs font-mono"
                            >
                              <PenTool className="w-3.5 h-3.5 text-amber-400" />
                              <span>Podepsat na tomto zařízení</span>
                            </button>
                            <button
                              type="button"
                              onClick={handleManualCheckSignature}
                              disabled={isCheckingSignature}
                              className="inline-flex items-center gap-1 text-[11px] text-slate-700 dark:text-slate-300 hover:text-amber-500 font-mono font-bold cursor-pointer"
                            >
                              <RefreshCw className={`w-3 h-3 ${isCheckingSignature ? 'animate-spin' : ''}`} />
                              <span>Ověřit podpis z mobilu</span>
                            </button>
                          </div>
                        </>
                      )}
                    </div>

                    <div className="border-t-2 border-dotted border-slate-400 w-48 sm:w-56 mx-auto pt-1.5">
                      <p className="text-xs font-bold text-slate-900">{currentContract.client.name}</p>
                      <p className="text-[10px] text-slate-500 tracking-wide font-sans">(podpis objednatele)</p>
                    </div>

                    {currentContract.clientSignature && (
                      <button
                        type="button"
                        onClick={() => setSignatureModalRole('client')}
                        className="no-print text-[11px] text-amber-600 hover:underline mt-1 cursor-pointer font-mono"
                      >
                        Změnit podpis
                      </button>
                    )}
                  </div>

                  {/* Zhotovitel */}
                  <div className="flex flex-col items-center relative">
                    <p className="font-bold text-black mb-2">Zhotovitel:</p>

                    <div className="relative flex flex-col items-center justify-end min-h-20 mb-2 w-full">
                      {/* Úřední otisk razítka zhotovitele */}
                      <div className="absolute -top-7 -right-2 sm:-right-8 opacity-85 pointer-events-none">
                        <CraftsmanStamp contractor={currentContract.contractor} size="sm" />
                      </div>

                      {currentContract.contractorSignature ? (
                        <div className="flex flex-col items-center justify-end h-20 z-10">
                          <img
                            src={currentContract.contractorSignature}
                            alt="Podpis zhotovitele"
                            className="max-h-16 max-w-44 object-contain"
                          />
                          <span className="text-[10px] text-slate-500 font-sans mt-0.5">
                            ✓ Podepsáno digitálně {formatDateCs(currentContract.contractorSignatureDate || currentContract.conclusionDate)}
                          </span>
                        </div>
                      ) : (
                        <>
                          <div className="hidden print:flex h-16 w-full items-end justify-center z-10">
                            <span className="text-[9px] text-slate-400 font-sans italic pb-1">
                              (vlastnoruční podpis zhotovitele / otisk razítka)
                            </span>
                          </div>
                          <div className="h-20 flex flex-col items-center justify-center z-10 no-print">
                            <button
                              type="button"
                              onClick={() => setSignatureModalRole('contractor')}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black transition-colors cursor-pointer shadow-xs font-mono"
                            >
                              <PenTool className="w-3.5 h-3.5 text-slate-950" />
                              <span>Vložit podpis mistra</span>
                            </button>
                          </div>
                        </>
                      )}
                    </div>

                    <div className="border-t-2 border-dotted border-slate-400 w-48 sm:w-56 mx-auto pt-1.5 z-10">
                      <p className="text-xs font-bold text-slate-900">{currentContract.contractor.name}</p>
                      <p className="text-[10px] text-slate-500 tracking-wide font-sans">(podpis a razítko zhotovitele)</p>
                    </div>

                    {currentContract.contractorSignature && (
                      <button
                        type="button"
                        onClick={() => setSignatureModalRole('contractor')}
                        className="no-print text-[11px] text-blue-600 hover:underline mt-1 cursor-pointer z-10"
                      >
                        Změnit podpis
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Document Page Footer */}
              <div className="mt-14 pt-4 border-t border-slate-200 flex items-center justify-between text-[11px] font-sans text-slate-400">
                <span>Evidenční číslo: {contract.contractNumber}</span>
                <span>Strana 1 z 1</span>
                <span>Vyhotoveno v aplikaci Smlouvy pro živnostníky</span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Signature Modal */}
      <SignatureModal
        isOpen={signatureModalRole !== null}
        title={
          signatureModalRole === 'contractor'
            ? 'Digitální podpis zhotovitele (řemeslník)'
            : 'Digitální podpis objednatele (klient)'
        }
        signerName={
          signatureModalRole === 'contractor'
            ? currentContract.contractor.name
            : currentContract.client.name
        }
        role={signatureModalRole || 'client'}
        initialSignature={
          signatureModalRole === 'contractor'
            ? currentContract.contractorSignature
            : currentContract.clientSignature
        }
        savedContractorSignature={getContractorProfile()?.signature}
        onSave={handleSaveSignature}
        onClose={() => setSignatureModalRole(null)}
      />

      {/* Komunikační & Odesílací dialog se šablonami SMS a WhatsApp */}
      <ShareModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        contract={currentContract}
        activeDocType={activeDocType}
        onToast={onToast}
        onSignTokenCreated={handleSignTokenCreated}
      />

      {/* Modal pro Ziskovost & Náklady zakázky */}
      {isExpensesModalOpen && (
        <ExpensesAndProfitModal
          isOpen={isExpensesModalOpen}
          onClose={() => setIsExpensesModalOpen(false)}
          contract={currentContract}
          onUpdateContract={(updated) => {
            setCurrentContract(updated);
            onSaveToHistory(updated);
          }}
          onToast={onToast}
        />
      )}

      {/* Modal pro Knihu jízd na stavbu */}
      {isLogbookModalOpen && (
        <LogbookModal
          isOpen={isLogbookModalOpen}
          onClose={() => setIsLogbookModalOpen(false)}
          contract={currentContract}
          onUpdateContract={(updated) => {
            setCurrentContract(updated);
            onSaveToHistory(updated);
          }}
          onToast={onToast}
        />
      )}

      {/* Modal pro Nákupní lístek do stavebnin */}
      {isShoppingListModalOpen && (
        <ShoppingListModal
          isOpen={isShoppingListModalOpen}
          onClose={() => setIsShoppingListModalOpen(false)}
          contract={currentContract}
          onUpdateContract={(updated) => {
            setCurrentContract(updated);
            onSaveToHistory(updated);
          }}
          onToast={onToast}
        />
      )}

      {/* Modal pro Technické zkušební protokoly (ČSN) */}
      {isTechnicalProtocolsModalOpen && (
        <TechnicalProtocolsModal
          isOpen={isTechnicalProtocolsModalOpen}
          onClose={() => setIsTechnicalProtocolsModalOpen(false)}
          contract={currentContract}
          onUpdateContract={(updated) => {
            setCurrentContract(updated);
            onSaveToHistory(updated);
          }}
          onToast={onToast}
        />
      )}

      {/* Modal pro Digitální stavební deník */}
      {isSiteLogModalOpen && (
        <SiteLogbookModal
          isOpen={isSiteLogModalOpen}
          onClose={() => setIsSiteLogModalOpen(false)}
          contract={currentContract}
          onUpdateContract={(updated) => {
            setCurrentContract(updated);
            onSaveToHistory(updated);
          }}
          onToast={onToast}
        />
      )}

      {/* Modal pro Harmonogram a kalendář etap */}
      {isScheduleModalOpen && (
        <ScheduleModal
          isOpen={isScheduleModalOpen}
          onClose={() => setIsScheduleModalOpen(false)}
          contract={currentContract}
          onUpdateContract={(updated) => {
            setCurrentContract(updated);
            onSaveToHistory(updated);
          }}
          onToast={onToast}
        />
      )}

      {/* 👥 Modal pro Tým & Parťáky na stavbě */}
      {isSubcontractorsModalOpen && (
        <SubcontractorsModal
          isOpen={isSubcontractorsModalOpen}
          onClose={() => setIsSubcontractorsModalOpen(false)}
          contract={currentContract}
          onUpdateContract={(updated) => {
            setCurrentContract(updated);
            onSaveToHistory(updated);
          }}
          onToast={onToast}
        />
      )}

      {/* 🛠️ Modal pro Půjčovnu nářadí a techniky */}
      {isToolRentalModalOpen && (
        <ToolRentalModal
          isOpen={isToolRentalModalOpen}
          onClose={() => setIsToolRentalModalOpen(false)}
          contract={currentContract}
          onUpdateContract={(updated) => {
            setCurrentContract(updated);
            onSaveToHistory(updated);
          }}
          onToast={onToast}
        />
      )}

      {/* 🔒 Modal pro Kontrolu před odjezdem ze stavby */}
      {isDepartureChecklistModalOpen && (
        <DepartureChecklistModal
          isOpen={isDepartureChecklistModalOpen}
          onClose={() => setIsDepartureChecklistModalOpen(false)}
          contract={currentContract}
          onUpdateContract={(updated) => {
            setCurrentContract(updated);
            onSaveToHistory(updated);
          }}
          onToast={onToast}
        />
      )}

      {/* 🗂️ Modal pro Kompletní složku zakázky (archiv/PDF) */}
      {isArchiveModalOpen && (
        <ContractArchiveModal
          isOpen={isArchiveModalOpen}
          onClose={() => setIsArchiveModalOpen(false)}
          contract={currentContract}
          onToast={onToast}
        />
      )}

      {/* Plovoucí mobilní lišta rychlých akcí při scrollování */}
      <div className="sm:hidden fixed bottom-3 left-3 right-3 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-xl border border-slate-300 dark:border-slate-800 shadow-xl p-2 flex items-center justify-between gap-2 max-w-md mx-auto no-print">
        <button
          onClick={() => setSignatureModalRole(currentContract.contractorSignature ? 'client' : 'contractor')}
          className="flex-1 h-10 px-3 rounded-lg bg-amber-500 active:bg-amber-600 text-slate-950 font-black text-xs flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
        >
          <PenTool className="w-3.5 h-3.5" />
          <span>Podepsat</span>
        </button>

        <button
          onClick={() => setIsShareModalOpen(true)}
          className="flex-1 h-10 px-3 rounded-lg bg-emerald-600 active:bg-emerald-700 text-white font-black text-xs flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
        >
          <Send className="w-3.5 h-3.5" />
          <span>Odeslat</span>
        </button>

        <button
          onClick={handleDownloadPdf}
          disabled={isPdfGenerating}
          className="flex-1 h-10 px-2 rounded-lg bg-slate-900 active:bg-slate-800 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-75"
        >
          {isPdfGenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400 shrink-0" /> : <FileDown className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
          <span className="truncate">Uložit PDF</span>
        </button>
      </div>
    </div>
  );
};
