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
  MapPin,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Contract, ContractStatus } from '../types/contract';
import {
  formatContractPriceWithWords,
  formatDateCs,
  formatPlaceWithPreposition,
  formatCurrency,
  formatSignedCurrency,
} from '../utils/numberToWordsCs';
import { exportContractToDocx, exportContractToPdf } from '../utils/lazyExports';
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
import { getJobStage, moveJobStage, JOB_STAGE_LABELS, JobStageKey } from '../utils/jobStage';
import { todayIso } from '../utils/invoiceMath';
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
import { Dialog } from './Dialog';
import { getSiteAddress } from '../utils/siteAddress';
import { isProUser } from '../utils/subscription';

interface ContractPreviewProps {
  contract: Contract;
  onBack: () => void;
  onSaveToHistory: (contract: Contract) => void;
  isSaved?: boolean;
  onToast?: (type: 'success' | 'error' | 'info', text: string) => void;
  initialDocType?: DocumentType;
}

// Prvky lišty nad dokumentem (vzhled „Výkres a metr“)
const tbButton =
  'min-h-11 min-w-11 px-3 inline-flex items-center justify-center gap-1.5 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-medium hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors disabled:opacity-60';
const tbPrimary =
  'min-h-11 px-4 inline-flex items-center justify-center gap-2 rounded-md border-[1.5px] border-blue-600 bg-blue-600 hover:bg-blue-700 text-white font-semibold cursor-pointer transition-colors disabled:opacity-75';
const tbMenu =
  'absolute top-full mt-1.5 z-50 bg-white dark:bg-slate-900 border border-slate-900 dark:border-slate-600 rounded-md shadow-xl divide-y divide-slate-100 dark:divide-slate-800 text-[15px]';
const tbMenuItem =
  'w-full min-h-11 px-3.5 flex items-center gap-2.5 text-left font-medium text-slate-900 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer disabled:opacity-60';

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
  const [siteAddressDraft, setSiteAddressDraft] = useState<string | null>(null);
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

  // Zálohová faktura dává smysl jen se sjednanou zálohou; jinak se zobrazí konečná faktura
  useEffect(() => {
    if (activeDocType === 'zaloha' && !(currentContract.advanceAmount && currentContract.advanceAmount > 0)) {
      setActiveDocType('faktura');
    }
  }, [activeDocType, currentContract.advanceAmount]);

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
    // Uloží se právě zobrazený dokument (smlouva, dodatek, doklad, protokol, faktura, záruční list, nabídka)
    const paper =
      activeDocType === 'smlouva' && paperRef.current
        ? paperRef.current
        : document.querySelector<HTMLElement>(
            'main .contract-page, main #amendment-printable-paper, main #quote-printable-paper, main .print-content, main [data-pdf-paper]'
          );
    if (!paper) {
      onToast?.('info', 'Nejprve otevřete nebo vystavte dokument, který chcete uložit do PDF.');
      return;
    }
    const pdfDocNames: Record<DocumentType, string> = {
      smlouva: 'Smlouva_o_dilo',
      nabidka: 'Cenova_nabidka',
      dodatek: 'Dodatek',
      pokladni_doklad: 'Prijmovy_doklad',
      protokol: 'Predavaci_protokol',
      faktura: 'Faktura',
      zaloha: 'Zalohova_faktura',
      zaruka: 'Zarucni_list',
    };
    try {
      setIsPdfGenerating(true);
      await exportContractToPdf(
        paper,
        currentContract,
        (status) => {
          setPdfStatusText(status);
        },
        pdfDocNames[activeDocType]
      );
      onToast?.('success', 'PDF bylo úspěšně staženo');
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

  const jobStage = getJobStage(currentContract);
  const hasUnreturnedTools = !!currentContract.toolRentals?.some((t) => !t.isReturned);

  const handleStageChange = (target: JobStageKey) => {
    const updated = moveJobStage(currentContract, target, todayIso());
    setCurrentContract(updated);
    onSaveToHistory(updated);
    onToast?.('info', `Zakázka je ve fázi ${JOB_STAGE_LABELS.find((x) => x.key === target)?.label}.`);
  };

  const docTabs: { key: DocumentType; label: string; count?: number }[] = [
    currentContract.docKind === 'quote' ? { key: 'nabidka', label: 'Cenová nabídka' } : { key: 'smlouva', label: 'Smlouva o dílo' },
    { key: 'dodatek', label: 'Dodatky', count: currentContract.amendments?.length },
    { key: 'pokladni_doklad', label: 'Pokladní doklad', count: currentContract.cashReceipts?.length },
    { key: 'protokol', label: 'Předávací protokol' },
    { key: 'faktura', label: 'Faktura' },
    { key: 'zaruka', label: 'Záruční list' },
  ];

  const siteTools: { label: string; icon: React.ComponentType<{ className?: string }>; open: () => void; note?: string; alert?: boolean }[] = [
    { label: 'Stavební deník', icon: FileText, open: () => setIsSiteLogModalOpen(true), note: currentContract.siteLogs?.length ? String(currentContract.siteLogs.length) : '' },
    { label: 'Zkoušky a protokoly', icon: Gauge, open: () => setIsTechnicalProtocolsModalOpen(true), note: currentContract.technicalProtocols?.length ? String(currentContract.technicalProtocols.length) : '' },
    { label: 'Parťáci a tým', icon: Users, open: () => setIsSubcontractorsModalOpen(true), note: currentContract.subcontractors?.length ? String(currentContract.subcontractors.length) : '' },
    { label: 'Půjčené nářadí', icon: Wrench, open: () => setIsToolRentalModalOpen(true), note: hasUnreturnedTools ? 'nevráceno' : '', alert: hasUnreturnedTools },
    { label: 'Odjezd ze stavby', icon: ShieldCheck, open: () => setIsDepartureChecklistModalOpen(true) },
    { label: 'Kniha jízd', icon: Car, open: () => setIsLogbookModalOpen(true) },
    { label: 'Nákupní seznam', icon: ShoppingCart, open: () => setIsShoppingListModalOpen(true) },
    { label: 'Harmonogram', icon: Calendar, open: () => setIsScheduleModalOpen(true) },
    { label: 'Složka zakázky', icon: FolderArchive, open: () => setIsArchiveModalOpen(true) },
  ];

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 pb-40 sm:pb-16">
      {/* Horní lišta: zpět, název zakázky, hlavní akce a přepínač dokumentů (zůstává nahoře) */}
      <div className="sticky top-[57px] lg:top-0 z-30 bg-white dark:bg-slate-900 border-b border-slate-900 dark:border-slate-600 no-print text-[15px] leading-snug">
        <div className="max-w-6xl mx-auto px-3 sm:px-4">
          <div className="py-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <button type="button" onClick={onBack} className={`${tbButton} shrink-0`} aria-label="Zpět">
                <ArrowLeft className="w-[18px] h-[18px]" />
                <span className="hidden sm:inline">Zpět</span>
              </button>
              <div className="min-w-0">
                <div className="font-display font-semibold text-[20px] leading-tight text-slate-900 dark:text-white truncate">
                  {currentContract.client.name}
                </div>
                <div className="text-[13px] text-slate-600 dark:text-slate-400 truncate">
                  {currentContract.docKind === 'quote' ? `nabídka ${currentContract.quoteNumber || ''}` : `smlouva ${currentContract.contractNumber}`}
                  {isSaved ? ', uloženo' : ', neuloženo'}
                </div>
              </div>
            </div>

            <div className="hidden sm:flex items-center gap-2">
              {!isSaved && (
                <button type="button" onClick={() => onSaveToHistory(currentContract)} className={tbButton}>
                  <Bookmark className="w-[18px] h-[18px]" />
                  <span>Uložit</span>
                </button>
              )}
              <button type="button" onClick={() => setIsShareModalOpen(true)} className={tbButton}>
                <Send className="w-[18px] h-[18px]" />
                <span>Odeslat</span>
              </button>
              <button type="button" onClick={handleDownloadPdf} disabled={isPdfGenerating} className={tbPrimary}>
                {isPdfGenerating ? <Loader2 className="w-[18px] h-[18px] animate-spin" /> : <FileDown className="w-[18px] h-[18px]" />}
                <span>{isPdfGenerating ? pdfStatusText || 'Připravuji…' : 'Uložit PDF'}</span>
              </button>
            </div>

            {/* Další možnosti exportu */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
                aria-expanded={isExportMenuOpen}
                aria-label="Další možnosti"
                className={tbButton}
              >
                <Printer className="w-[18px] h-[18px]" />
                <ChevronDown className="w-4 h-4" />
              </button>
              {isExportMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsExportMenuOpen(false)} />
                  <div className={`${tbMenu} right-0 w-64`}>
                    <button
                      type="button"
                      onClick={() => {
                        setIsExportMenuOpen(false);
                        handleDownloadDocx();
                      }}
                      disabled={isDocxGenerating}
                      className={tbMenuItem}
                    >
                      <FileText className="w-[18px] h-[18px] shrink-0" />
                      <span>{isDocxGenerating ? 'Připravuji Word…' : 'Stáhnout ve Wordu'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsExportMenuOpen(false);
                        handlePrint();
                      }}
                      className={tbMenuItem}
                    >
                      <Printer className="w-[18px] h-[18px] shrink-0" />
                      <span>Vytisknout</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsExportMenuOpen(false);
                        handleCopyPaymentInfo();
                      }}
                      className={tbMenuItem}
                    >
                      <Copy className="w-[18px] h-[18px] shrink-0" />
                      <span>Zkopírovat platební údaje</span>
                    </button>
                    {!isSaved && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsExportMenuOpen(false);
                          onSaveToHistory(currentContract);
                        }}
                        className={`${tbMenuItem} sm:hidden`}
                      >
                        <Bookmark className="w-[18px] h-[18px] shrink-0" />
                        <span>Uložit do archivu</span>
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Přepínač dokumentů: na mobilu výběr, jinak záložky */}
          <div className="md:hidden pb-2">
            <label htmlFor="nahled-dokument" className="sr-only">
              Dokument
            </label>
            <select
              id="nahled-dokument"
              value={activeDocType}
              onChange={(e) => setActiveDocType(e.target.value as DocumentType)}
              className="w-full min-h-11 px-3 rounded-md border-[1.5px] border-slate-900 dark:border-slate-500 bg-white dark:bg-slate-950 text-slate-900 dark:text-white font-semibold cursor-pointer"
            >
              {docTabs.map((t) => (
                <option key={t.key} value={t.key}>
                  {t.label}
                  {t.count ? ` (${t.count})` : ''}
                </option>
              ))}
              {currentContract.advanceAmount ? <option value="zaloha">Zálohová faktura</option> : null}
            </select>
          </div>
          <div role="tablist" aria-label="Dokumenty zakázky" className="hidden md:flex gap-1 overflow-x-auto -mb-px">
            {docTabs.map((t) => {
              const active = activeDocType === t.key || (t.key === 'faktura' && activeDocType === 'zaloha');
              return (
                <button
                  key={t.key}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setActiveDocType(t.key === 'faktura' && activeDocType === 'zaloha' ? 'zaloha' : t.key)}
                  className={`min-h-11 px-3.5 inline-flex items-center gap-2 font-semibold whitespace-nowrap cursor-pointer border-b-[3px] transition-colors ${
                    active
                      ? 'border-slate-900 dark:border-white text-slate-900 dark:text-white'
                      : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <span>
                    {t.label}
                    {t.key === 'faktura' && currentContract.advanceAmount ? (activeDocType === 'zaloha' ? ' (zálohová)' : ' (konečná)') : ''}
                  </span>
                  {!!t.count && <span className="font-display tabular-nums text-[17px]">{t.count}</span>}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Zakázka: fáze, podpis, náklady a nástroje (neposouvá se s lištou) */}
      <div className="no-print max-w-6xl mx-auto px-3 sm:px-4 pt-4 flex flex-wrap items-center gap-2 text-[15px] leading-snug">
        <label htmlFor="nahled-faze" className="text-slate-600 dark:text-slate-400">
          Fáze
        </label>
        <select
          id="nahled-faze"
          value={jobStage.key}
          onChange={(e) => handleStageChange(e.target.value as JobStageKey)}
          className="min-h-11 px-3 rounded-md border-[1.5px] border-slate-900 dark:border-slate-500 bg-white dark:bg-slate-950 text-slate-900 dark:text-white font-semibold cursor-pointer"
        >
          {JOB_STAGE_LABELS.map((st, idx) => (
            <option key={st.key} value={st.key} disabled={!!currentContract.handoverData && idx < 4}>
              {st.label}
            </option>
          ))}
        </select>

        {currentContract.clientSignature ? (
          <span className="min-h-11 px-3 inline-flex items-center gap-1.5 rounded-md border-[1.5px] border-blue-600 text-blue-600 dark:border-blue-300 dark:text-blue-300 font-semibold">
            <Check className="w-4 h-4" />
            <span>Podepsáno {formatDateCs(currentContract.clientSignatureDate || currentContract.conclusionDate)}</span>
          </span>
        ) : (
          <button type="button" onClick={handleManualCheckSignature} disabled={isCheckingSignature} className={tbButton}>
            <RefreshCw className={`w-[18px] h-[18px] ${isCheckingSignature ? 'animate-spin' : ''}`} />
            <span>{isCheckingSignature ? 'Ověřuji…' : 'Ověřit online podpis'}</span>
          </button>
        )}

        <button type="button" onClick={() => setIsExpensesModalOpen(true)} className={tbButton}>
          <TrendingUp className="w-[18px] h-[18px]" />
          <span>Náklady a zisk</span>
        </button>

        <button type="button" onClick={() => setSiteAddressDraft(currentContract.siteAddress || '')} className={tbButton}>
          <MapPin className="w-[18px] h-[18px]" />
          <span>Adresa stavby</span>
        </button>

        {isPro && (
          <div className="relative">
            <button type="button" onClick={() => setIsSiteToolsMenuOpen(!isSiteToolsMenuOpen)} aria-expanded={isSiteToolsMenuOpen} className={tbButton}>
              <Wrench className="w-[18px] h-[18px]" />
              <span>Nástroje stavby</span>
              {hasUnreturnedTools && <span className="w-2 h-2 rounded-full bg-rose-600 shrink-0" title="Nevrácené nářadí" />}
              {isSiteToolsMenuOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            {isSiteToolsMenuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setIsSiteToolsMenuOpen(false)} />
                <div className={`${tbMenu} left-0 w-72 max-w-[calc(100vw-1.5rem)]`}>
                  {siteTools.map((tool) => {
                    const Icon = tool.icon;
                    return (
                      <button
                        key={tool.label}
                        type="button"
                        onClick={() => {
                          setIsSiteToolsMenuOpen(false);
                          tool.open();
                        }}
                        className={tbMenuItem}
                      >
                        <Icon className="w-[18px] h-[18px] shrink-0" />
                        <span className="flex-1">{tool.label}</span>
                        {tool.note && (
                          <span className={tool.alert ? 'font-semibold text-rose-700 dark:text-rose-400' : 'text-slate-600 dark:text-slate-400 tabular-nums'}>
                            {tool.note}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Contract Preview Page Wrapper */}
      <div className="max-w-[850px] mx-auto px-2 sm:px-4 pt-5 sm:pt-6 overflow-x-auto">
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
            onUpdateContract={(updated) => {
              setCurrentContract(updated);
              onSaveToHistory(updated);
            }}
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
                        {formatSignedCurrency(
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
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-colors cursor-pointer shadow-xs font-sans"
                            >
                              <PenTool className="w-3.5 h-3.5 text-amber-400" />
                              <span>Podepsat na tomto zařízení</span>
                            </button>
                            <button
                              type="button"
                              onClick={handleManualCheckSignature}
                              disabled={isCheckingSignature}
                              className="inline-flex items-center gap-1 text-[11px] text-slate-700 hover:text-blue-700 hover:underline font-sans font-semibold cursor-pointer"
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
                        className="no-print text-[11px] text-blue-600 hover:underline mt-1 cursor-pointer font-sans"
                      >
                        Změnit podpis
                      </button>
                    )}
                  </div>

                  {/* Zhotovitel */}
                  <div className="flex flex-col items-center relative">
                    <p className="font-bold text-black mb-2">Zhotovitel:</p>

                    <div className="relative flex flex-col items-center justify-end min-h-20 mb-2 w-full">
                      {/* Razítko zhotovitele: nad podpisem, s vlastním místem */}
                      <div className="mb-1.5 max-w-full opacity-85 pointer-events-none">
                        <CraftsmanStamp contractor={currentContract.contractor} size="sm" />
                      </div>

                      {currentContract.contractorSignature ? (
                        <div className="flex flex-col items-center justify-end min-h-20 z-10">
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
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-colors cursor-pointer shadow-xs font-sans"
                            >
                              <PenTool className="w-3.5 h-3.5 text-amber-400" />
                              <span>Vložit můj podpis</span>
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
                        className="no-print text-[11px] text-blue-600 hover:underline mt-1 cursor-pointer font-sans z-10"
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
                <span>Vyhotoveno v aplikaci Řemeslník PRO</span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Adresa stavby */}
      {siteAddressDraft !== null && (
        <Dialog title="Adresa stavby" size="md" onClose={() => setSiteAddressDraft(null)}>
          <form
            className="space-y-4 text-[15px]"
            onSubmit={(e) => {
              e.preventDefault();
              const updated = { ...currentContract, siteAddress: siteAddressDraft.trim() || undefined };
              setCurrentContract(updated);
              onSaveToHistory(updated);
              setSiteAddressDraft(null);
            }}
          >
            <div>
              <label htmlFor="nahled-adresa-stavby" className="block font-semibold text-slate-900 dark:text-slate-100 mb-1.5">
                Kde se pracuje
              </label>
              <input
                id="nahled-adresa-stavby"
                type="text"
                autoComplete="off"
                autoFocus
                value={siteAddressDraft}
                onChange={(e) => setSiteAddressDraft(e.target.value)}
                placeholder={currentContract.client?.address || 'např. Na Výsluní 12, Říčany'}
                className="w-full min-h-12 px-3 rounded-md border-[1.5px] border-slate-900 dark:border-slate-500 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
              />
              <p className="mt-1.5 text-slate-600 dark:text-slate-400">
                {siteAddressDraft.trim()
                  ? 'Použije se pro navigaci, počasí, kalendář a knihu jízd. Text smlouvy se nemění.'
                  : `Když pole necháte prázdné, platí adresa klienta${currentContract.client?.address ? `: ${currentContract.client.address}` : ''}.`}
              </p>
            </div>
            <div className="flex flex-wrap justify-end gap-2.5">
              <button type="button" onClick={() => setSiteAddressDraft(null)} className={tbButton}>
                Zrušit
              </button>
              <button
                type="submit"
                className="min-h-11 px-4 inline-flex items-center justify-center rounded-md border-[1.5px] border-slate-900 bg-amber-400 hover:bg-amber-500 text-slate-900 font-semibold cursor-pointer transition-colors"
              >
                Uložit
              </button>
            </div>
          </form>
        </Dialog>
      )}

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

      {/* Upozornění ke vzorům dokumentů – jen na obrazovce, do tisku ani PDF se nepromítá */}
      <p className="no-print max-w-3xl mx-auto mt-6 px-4 text-center text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
        Vzory smluv a dokumentů slouží jako pomůcka a nenahrazují právní poradenství. Před použitím si je přizpůsobte
        své situaci, v případě pochybností je nechte zkontrolovat advokátem.
      </p>

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

      {/* Spodní lišta hlavních akcí na mobilu */}
      <div className="sm:hidden fixed bottom-[75px] left-0 right-0 z-30 bg-white dark:bg-slate-900 border-t border-slate-900 dark:border-slate-600 p-1.5 grid grid-cols-3 gap-2 no-print text-[15px]">
        <button
          type="button"
          onClick={() => setSignatureModalRole(currentContract.contractorSignature ? 'client' : 'contractor')}
          className="min-h-11 px-2 rounded-md border-[1.5px] border-slate-900 bg-amber-400 active:bg-amber-500 text-slate-900 font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <PenTool className="w-[18px] h-[18px] shrink-0" />
          <span>Podepsat</span>
        </button>
        <button
          type="button"
          onClick={() => setIsShareModalOpen(true)}
          className="min-h-11 px-2 rounded-md border-[1.5px] border-slate-900 dark:border-slate-500 text-slate-900 dark:text-slate-100 font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <Send className="w-[18px] h-[18px] shrink-0" />
          <span>Odeslat</span>
        </button>
        <button
          type="button"
          onClick={handleDownloadPdf}
          disabled={isPdfGenerating}
          className="min-h-11 px-2 rounded-md border-[1.5px] border-blue-600 bg-blue-600 active:bg-blue-700 text-white font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-75"
        >
          {isPdfGenerating ? <Loader2 className="w-[18px] h-[18px] animate-spin shrink-0" /> : <FileDown className="w-[18px] h-[18px] shrink-0" />}
          <span>PDF</span>
        </button>
      </div>
    </div>
  );
};
