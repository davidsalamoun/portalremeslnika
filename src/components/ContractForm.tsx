import React, { useState, useEffect } from 'react';
import { nextDocumentSequence, NUMBERING_VERSION } from '../utils/invoiceNumbering';
import { Pencil, UserPlus, Eye, Mic, Check, ArrowRight } from 'lucide-react';
import { ContractorProfile, Client, Contract, ContractFormData, BudgetItem } from '../types/contract';
import { formatCurrency, formatDateCs, cleanPlaceName } from '../utils/numberToWordsCs';
import { CRAFT_TEMPLATES, CraftTemplate } from '../data/craftTemplates';
import { BudgetItemsEditor } from './BudgetItemsEditor';
import { triggerHaptic } from '../utils/haptics';
import { getStoredContracts } from '../utils/storage';
import { addDaysIso, todayIso } from '../utils/invoiceMath';

// Pořadí polí ve formuláři a jejich prvky – pro přesun na první chybu
const ERROR_ORDER = ['contractor', 'clientId', 'workDescription', 'price', 'deliveryDate', 'advanceAmount'];
const ERROR_FIELD_ID: Record<string, string> = {
  contractor: 'sekce-strany',
  clientId: 'client-select',
  workDescription: 'work-desc',
  price: 'price-input',
  deliveryDate: 'delivery-date',
  advanceAmount: 'advance-input',
};

const sectionTitle = 'text-2xl font-semibold text-slate-900 dark:text-white';
const fieldLabel = 'block font-semibold text-slate-900 dark:text-slate-100 mb-1.5';
const fieldBase =
  'w-full min-h-12 px-3.5 py-2 rounded-md border-[1.5px] bg-white dark:bg-slate-950 text-slate-900 dark:text-white';
const fieldOk = 'border-slate-900 dark:border-slate-500';
const fieldBad = 'border-rose-700 dark:border-rose-400';
const errorText = 'mt-1.5 font-medium text-rose-700 dark:text-rose-400';
const hintText = 'mt-1.5 text-slate-600 dark:text-slate-400';
const outlineButton =
  'min-h-11 px-4 inline-flex items-center justify-center gap-2 rounded-md border-[1.5px] border-slate-900 dark:border-slate-500 text-slate-900 dark:text-slate-100 font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors';
const primaryButton =
  'min-h-12 px-5 inline-flex items-center justify-center gap-2 rounded-md border-[1.5px] border-slate-900 bg-amber-400 hover:bg-amber-500 text-slate-900 font-semibold cursor-pointer transition-colors';
const chip = (active: boolean) =>
  `min-h-11 px-3 inline-flex items-center justify-center rounded-md border font-medium cursor-pointer transition-colors ${
    active
      ? 'border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-900'
      : 'border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800'
  }`;
const textLink = 'min-h-11 inline-flex items-center gap-1.5 font-medium text-blue-600 dark:text-blue-300 underline underline-offset-2 cursor-pointer';

interface ContractFormProps {
  contractor: ContractorProfile | null;
  clients: Client[];
  initialTemplateId?: string | null;
  /** Předvybraný klient (tlačítko „Nová smlouva“ u klienta) */
  initialClientId?: string | null;
  /** Zakázka, ze které se převezme popis, rozpočet, cena, záloha a DPH (ne klient, termín, adresa stavby ani podpisy) */
  baseContract?: Contract | null;
  /** Rozpočet z kalkulačky na obhlídce (položky z ceníku uživatele) */
  estimate?: { description: string; items: Omit<BudgetItem, 'id'>[] } | null;
  onOpenSettings: () => void;
  onOpenNewClientDialog: () => void;
  onEditClient?: (client: Client) => void;
  onShowPreview: (contract: Contract) => void;
  onPreloadSampleData?: () => void;
  onToast?: (type: 'success' | 'error' | 'info', text: string) => void;
}

export const ContractForm: React.FC<ContractFormProps> = ({
  contractor,
  clients,
  initialTemplateId,
  initialClientId,
  baseContract,
  estimate,
  onOpenSettings,
  onOpenNewClientDialog,
  onEditClient,
  onShowPreview,
  onPreloadSampleData,
  onToast,
}) => {
  // Nová zakázka podle jiné: převzaté údaje (jen při založení formuláře)
  const base = baseContract || null;
  const est = !base && estimate && estimate.items.length > 0 ? estimate : null;
  const estTotal = est ? est.items.reduce((sum, it) => sum + (it.totalPrice || 0), 0) : 0;
  const basePrice = base && base.price > 0 ? base.price : estTotal;
  const baseAdvance = base && !!base.advanceAmount && base.advanceAmount > 0 ? base.advanceAmount : 0;
  // U nové zakázky podle jiné musí uživatel klienta vybrat sám (nepředvybírat prvního ze seznamu)
  const [requireClientChoice] = useState((!!base || !!est) && !initialClientId);

  const [docKind, setDocKind] = useState<'contract' | 'quote' | 'invoice'>(base?.docKind === 'quote' || base?.docKind === 'invoice' ? base.docKind : 'contract');
  const isInvoiceOnly = docKind === 'invoice';
  const [pricingType, setPricingType] = useState<'fixed' | 'budget'>(
    est || (base?.pricingType === 'budget' && base.items && base.items.length > 0) ? 'budget' : 'fixed'
  );
  const [budgetItems, setBudgetItems] = useState<BudgetItem[]>(() =>
    (base?.items || est?.items || []).map((it, i) => ({ ...it, id: `item_${Date.now()}_${i}` }))
  );
  const [isListening, setIsListening] = useState(false);

  const [formData, setFormData] = useState<ContractFormData>({
    clientId:
      initialClientId && clients.some((c) => c.id === initialClientId)
        ? initialClientId
        : !requireClientChoice && clients.length > 0
          ? clients[0].id
          : '',
    docKind: 'contract',
    workDescription: base?.workDescription || est?.description || '',
    price: basePrice || '',
    deliveryDate: '',
    advanceAmount: baseAdvance || '',
    siteAddress: '',
  });

  const [rawPriceInput, setRawPriceInput] = useState<string>(basePrice ? String(basePrice) : '');
  // DPH u plátce: sazba a přenesení daňové povinnosti (cena se pak zadává bez DPH)
  const [vatRate, setVatRate] = useState<21 | 12>(base?.vatRate === 12 ? 12 : 21);
  const [reverseCharge, setReverseCharge] = useState(!!base?.reverseCharge);
  const [rawAdvanceInput, setRawAdvanceInput] = useState<string>(baseAdvance ? String(baseAdvance) : '');
  const [advancePreset, setAdvancePreset] = useState<'none' | '30' | '50' | 'custom'>(() => {
    if (!baseAdvance) return 'none';
    if (basePrice && baseAdvance === Math.round(basePrice * 0.3)) return '30';
    if (basePrice && baseAdvance === Math.round(basePrice * 0.5)) return '50';
    return 'custom';
  });
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  const startVoiceDictation = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      onToast?.(
        'info',
        'Tento prohlížeč diktování neumí. Na telefonu použijte mikrofon na klávesnici.'
      );
      return;
    }
    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'cs-CZ';
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => setIsListening(true);
      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setFormData((prev) => ({
          ...prev,
          workDescription: prev.workDescription ? `${prev.workDescription} ${transcript}` : transcript,
        }));
        setIsListening(false);
      };
      recognition.onerror = () => setIsListening(false);
      recognition.onend = () => setIsListening(false);
      recognition.start();
    } catch (e) {
      console.error('Speech recognition error:', e);
      setIsListening(false);
    }
  };

  const applyTemplate = (tpl: CraftTemplate) => {
    setSelectedTemplateId(tpl.id);
    const targetDateIso = addDaysIso(todayIso(), tpl.suggestedDays);

    // If template has suggested items, load them
    let nextPrice = formData.price;
    let nextItems = budgetItems;
    if (tpl.suggestedItems && tpl.suggestedItems.length > 0) {
      nextItems = tpl.suggestedItems;
      setBudgetItems(nextItems);
      const itemsSum = nextItems.reduce((s, it) => s + (it.totalPrice || 0), 0);
      nextPrice = itemsSum;
      setRawPriceInput(itemsSum.toString());
      setPricingType('budget');
    }

    let nextAdvance = formData.advanceAmount;
    if (typeof nextPrice === 'number' && nextPrice > 0) {
      const ratio = tpl.suggestedAdvancePercent / 100;
      nextAdvance = Math.round(nextPrice * ratio);
      setRawAdvanceInput(nextAdvance.toString());
      setAdvancePreset(tpl.suggestedAdvancePercent >= 45 ? '50' : '30');
    }

    setFormData((prev) => ({
      ...prev,
      workDescription: tpl.workDescription,
      deliveryDate: prev.deliveryDate || targetDateIso,
      price: nextPrice,
      advanceAmount: nextAdvance,
    }));
  };

  useEffect(() => {
    if (initialTemplateId) {
      const found = CRAFT_TEMPLATES.find((t) => t.id === initialTemplateId);
      if (found) {
        applyTemplate(found);
      }
    }
  }, [initialTemplateId]);

  const handleBudgetItemsChange = (newItems: BudgetItem[]) => {
    setBudgetItems(newItems);
    const sum = newItems.reduce((acc, it) => acc + (it.totalPrice || 0), 0);
    setRawPriceInput(sum > 0 ? sum.toString() : '');
    setFormData((prev) => {
      let nextAdv = prev.advanceAmount;
      if (advancePreset === '30') nextAdv = Math.round(sum * 0.3);
      if (advancePreset === '50') nextAdv = Math.round(sum * 0.5);
      return {
        ...prev,
        price: sum > 0 ? sum : '',
        advanceAmount: nextAdv,
      };
    });
    if (sum > 0 && (advancePreset === '30' || advancePreset === '50')) {
      const p = advancePreset === '30' ? 0.3 : 0.5;
      setRawAdvanceInput(Math.round(sum * p).toString());
    }
  };


  // Sync client ID if client list updates and none selected
  React.useEffect(() => {
    if (clients.length > 0 && !formData.clientId && !requireClientChoice) {
      setFormData((prev) => ({ ...prev, clientId: clients[0].id }));
    }
  }, [clients, formData.clientId]);

  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value.replace(/\D/g, '');
    setRawPriceInput(rawVal);
    const parsed = rawVal ? parseInt(rawVal, 10) : '';
    setFormData((prev) => {
      let nextAdvance = prev.advanceAmount;
      if (typeof parsed === 'number') {
        if (advancePreset === '30') nextAdvance = Math.round(parsed * 0.3);
        if (advancePreset === '50') nextAdvance = Math.round(parsed * 0.5);
      }
      return { ...prev, price: parsed, advanceAmount: nextAdvance };
    });
    if (parsed && (advancePreset === '30' || advancePreset === '50')) {
      const perc = advancePreset === '30' ? 0.3 : 0.5;
      setRawAdvanceInput(Math.round(parsed * perc).toString());
    }
  };

  const setAdvanceRatio = (type: 'none' | '30' | '50') => {
    setAdvancePreset(type);
    if (type === 'none') {
      setRawAdvanceInput('');
      setFormData((prev) => ({ ...prev, advanceAmount: '' }));
    } else {
      const p = typeof formData.price === 'number' ? formData.price : 0;
      const ratio = type === '30' ? 0.3 : 0.5;
      const calculated = Math.round(p * ratio);
      setRawAdvanceInput(calculated > 0 ? calculated.toString() : '');
      setFormData((prev) => ({ ...prev, advanceAmount: calculated > 0 ? calculated : '' }));
    }
  };

  const handleAdvanceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAdvancePreset('custom');
    const rawVal = e.target.value.replace(/\D/g, '');
    setRawAdvanceInput(rawVal);
    const parsed = rawVal ? parseInt(rawVal, 10) : '';
    setFormData((prev) => ({ ...prev, advanceAmount: parsed }));
  };

  const formattedDisplayPrice = rawPriceInput
    ? new Intl.NumberFormat('cs-CZ').format(parseInt(rawPriceInput, 10))
    : '';

  const formattedDisplayAdvance = rawAdvanceInput
    ? new Intl.NumberFormat('cs-CZ').format(parseInt(rawAdvanceInput, 10))
    : '';

  const setDeliveryDateOffset = (days: number) => {
    const iso = addDaysIso(todayIso(), days);
    setFormData((prev) => ({ ...prev, deliveryDate: iso }));
    if (errors.deliveryDate) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next.deliveryDate;
        return next;
      });
    }
  };

  const validate = (): string[] => {
    const newErrors: { [key: string]: string } = {};

    if (!contractor || !contractor.name || !contractor.ico || !contractor.address) {
      newErrors.contractor = 'Nejdřív v Nastavení vyplňte své jméno, IČO a sídlo.';
    }

    if (!formData.clientId) {
      newErrors.clientId = 'Vyberte klienta ze seznamu nebo přidejte nového.';
    }

    if (!formData.workDescription.trim()) {
      newErrors.workDescription = 'Popište, co budete dělat.';
    } else if (formData.workDescription.trim().length < 5) {
      newErrors.workDescription = 'Popis díla je příliš krátký.';
    }

    if (formData.price === '' || typeof formData.price !== 'number' || formData.price <= 0) {
      newErrors.price = 'Zadejte cenu díla v Kč.';
    }

    if (
      docKind !== 'invoice' &&
      formData.advanceAmount !== '' &&
      typeof formData.advanceAmount === 'number' &&
      typeof formData.price === 'number' &&
      formData.advanceAmount >= formData.price
    ) {
      newErrors.advanceAmount = 'Záloha musí být nižší než cena díla.';
    }

    if (!formData.deliveryDate) {
      newErrors.deliveryDate = docKind === 'invoice' ? 'Zadejte, kdy byla práce dokončena.' : 'Zadejte termín dokončení a předání.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const failed = validate();
    if (failed.length > 0 || !contractor) {
      // Přesun na první chybu v pořadí formuláře
      const first = ERROR_ORDER.find((key) => failed.includes(key));
      if (first) {
        const el = document.getElementById(ERROR_FIELD_ID[first]);
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        if (el instanceof HTMLElement) el.focus({ preventScroll: true });
      }
      onToast?.('error', failed.length === 1 ? 'Ve formuláři chybí jeden údaj.' : `Ve formuláři chybí ${failed.length} údaje nebo jsou chybně.`);
      return;
    }

    const selectedClient = clients.find((c) => c.id === formData.clientId);
    if (!selectedClient) {
      setErrors((prev) => ({ ...prev, clientId: 'Vybraný klient nebyl nalezen.' }));
      return;
    }

    const today = todayIso();
    const thisYear = new Date().getFullYear();
    const storedContracts = getStoredContracts();
    // Pořadí: nejvyšší použité v roce + 1 (po smazání zakázky se číslo neopakuje). Číslo faktury vznikne až
    // při jejím vystavení (utils/invoiceNumbering.ts).
    const paddedSeq = nextDocumentSequence(storedContracts, thisYear);

    const quoteNum = `CN-${thisYear}-${paddedSeq}`;
    const contractNum = docKind === 'invoice' ? '' : `SOD-${thisYear}-${paddedSeq}`;
    const vsNum = `${thisYear}${paddedSeq}`;

    const validUntilDate = addDaysIso(today, 30);

    const newContract: Contract = {
      id: `contract_${Date.now()}`,
      docKind: docKind,
      quoteNumber: docKind === 'quote' ? quoteNum : undefined,
      quoteValidUntil: docKind === 'quote' ? validUntilDate : undefined,
      pricingType: pricingType,
      items: pricingType === 'budget' && budgetItems.length > 0 ? budgetItems : undefined,
      contractNumber: contractNum,
      invoiceNumber: '',
      numbering: NUMBERING_VERSION,
      advanceInvoiceNumber: '',
      variableSymbol: vsNum,
      contractor: contractor,
      client: selectedClient,
      workDescription: formData.workDescription.trim(),
      price: Number(formData.price),
      advanceAmount:
        !isInvoiceOnly && typeof formData.advanceAmount === 'number' && formData.advanceAmount > 0
          ? formData.advanceAmount
          : undefined,
      deliveryDate: formData.deliveryDate,
      conclusionDate: today,
      executionPlace: cleanPlaceName(contractor.defaultPlace) || 'místě plnění',
      siteAddress: formData.siteAddress?.trim() || undefined,
      hasVat: !!contractor.dic,
      vatRate: contractor.dic && vatRate === 12 ? 12 : undefined,
      reverseCharge: contractor.dic && reverseCharge ? true : undefined,
      // Faktura bez smlouvy je za hotovou práci: zakázka je rovnou předaná a čeká na zaplacení
      status: isInvoiceOnly ? 'handover_done' : 'draft',
      leadStage: isInvoiceOnly ? 'completed' : undefined,
      contractorSignature: contractor.signature,
      contractorSignatureDate: contractor.signature ? today : undefined,
      createdAt: new Date().toISOString(),
    };

    onShowPreview(newContract);
  };

  const selectedClientObj = clients.find((c) => c.id === formData.clientId);
  const priceVatSuffix = !contractor?.dic ? '' : reverseCharge ? ' bez DPH' : ' včetně DPH';
  const totalPriceNum = typeof formData.price === 'number' ? formData.price : 0;
  const advancePriceNum = typeof formData.advanceAmount === 'number' ? formData.advanceAmount : 0;
  const remainingPriceNum = Math.max(0, totalPriceNum - advancePriceNum);

  const itemsWord = (n: number) => `${n} ${n === 1 ? 'položka' : n >= 2 && n <= 4 ? 'položky' : 'položek'}`;

  // Chyba zmizí, jakmile je údaj opravený (i šablonou nebo rozpočtem)
  useEffect(() => {
    setErrors((prev) => {
      if (Object.keys(prev).length === 0) return prev;
      const next = { ...prev };
      const price = typeof formData.price === 'number' ? formData.price : 0;
      const advance = typeof formData.advanceAmount === 'number' ? formData.advanceAmount : 0;
      if (contractor?.name && contractor.ico && contractor.address) delete next.contractor;
      if (formData.clientId) delete next.clientId;
      if (formData.workDescription.trim().length >= 5) delete next.workDescription;
      if (price > 0) delete next.price;
      if (formData.deliveryDate) delete next.deliveryDate;
      if (advance < price || advance === 0) delete next.advanceAmount;
      return Object.keys(next).length === Object.keys(prev).length ? prev : next;
    });
  }, [formData, contractor]);

  const activeTpl = selectedTemplateId ? CRAFT_TEMPLATES.find((t) => t.id === selectedTemplateId) : undefined;
  const isQuote = docKind === 'quote';
  const documents = isInvoiceOnly
    ? ['Faktura s QR platbou', 'Pokladní doklad při platbě v hotovosti']
    : [isQuote ? 'Cenová nabídka' : 'Smlouva o dílo', 'Předávací protokol', 'Faktura s QR platbou'];

  return (
    <div className="max-w-[1180px] mx-auto pb-16 space-y-7 text-[15px] leading-snug">
      {/* Hlavička */}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl sm:text-[44px] font-bold leading-[1.05] text-slate-900 dark:text-white">
            {isInvoiceOnly ? 'Nová faktura' : isQuote ? 'Nová cenová nabídka' : 'Nová smlouva o dílo'}
          </h1>
          <div className="mt-1 text-slate-600 dark:text-slate-400 max-w-2xl">
            {isInvoiceOnly
              ? 'Faktura za drobnou práci bez smlouvy. Číslo dostane, až ji v dalším kroku vystavíte.'
              : isQuote
              ? 'Sestavte rozpočet prací a materiálu. Po odsouhlasení nabídku převedete na smlouvu.'
              : 'Vyplňte zakázku. V dalším kroku zkontrolujete smlouvu, předávací protokol a fakturu.'}
          </div>
        </div>
        {(!contractor || clients.length === 0) && onPreloadSampleData && (
          <button type="button" onClick={onPreloadSampleData} className={outlineButton}>
            Vyplnit ukázková data
          </button>
        )}
      </header>

      {/* Nová zakázka podle jiné */}
      {base && (
        <div role="status" className="max-w-3xl px-4 py-3 border-l-[3px] border-blue-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200">
          <span className="font-semibold text-slate-900 dark:text-white">
            Podle zakázky {[base.contractNumber || base.quoteNumber, base.client?.name].filter(Boolean).join(' – ')}.
          </span>{' '}
          Převzali jsme popis díla,
          {base.items && base.items.length > 0 ? ' rozpočet,' : ''} cenu{baseAdvance ? ', zálohu' : ''} a DPH. Vyberte klienta a doplňte termín.
        </div>
      )}

      {/* Rozpočet z kalkulačky na obhlídce */}
      {est && (
        <div role="status" className="max-w-3xl px-4 py-3 border-l-[3px] border-blue-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200">
          <span className="font-semibold text-slate-900 dark:text-white">Rozpočet z kalkulačky na obhlídce.</span> Položky a ceny jsou z vašeho
          ceníku – zkontrolujte množství, vyberte klienta a doplňte termín.
        </div>
      )}

      {/* Druh dokumentu */}
      <div role="group" aria-label="Druh dokumentu" className="grid grid-cols-3 gap-2 max-w-xl">
        <button type="button" aria-pressed={docKind === 'contract'} onClick={() => setDocKind('contract')} className={chip(docKind === 'contract')}>
          Smlouva o dílo
        </button>
        <button type="button" aria-pressed={isQuote} onClick={() => setDocKind('quote')} className={chip(isQuote)}>
          Cenová nabídka
        </button>
        <button type="button" aria-pressed={isInvoiceOnly} onClick={() => setDocKind('invoice')} className={chip(isInvoiceOnly)}>
          Jen faktura
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-x-10 gap-y-7 items-start">
        {/* Formulář */}
        <form
          onSubmit={handleSubmit}
          noValidate
          className="lg:col-span-8 min-w-0 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md divide-y divide-slate-200 dark:divide-slate-800"
        >
          {/* 1. Strany */}
          <section id="sekce-strany" tabIndex={-1} aria-labelledby="nadpis-strany" className="p-5 sm:p-6 space-y-5 scroll-mt-24 outline-none">
            <h2 id="nadpis-strany" className={sectionTitle}>
              1. Zhotovitel a klient
            </h2>

            <div>
              <div className={fieldLabel}>Zhotovitel</div>
              {contractor && contractor.name ? (
                <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                  <div className="min-w-0">
                    <span className="font-semibold text-slate-900 dark:text-white">{contractor.name}</span>
                    <span className="text-slate-600 dark:text-slate-400">
                      , IČO {contractor.ico}, {contractor.dic ? `DIČ ${contractor.dic}` : 'neplátce DPH'}
                    </span>
                  </div>
                  <button type="button" onClick={onOpenSettings} className={textLink}>
                    <Pencil className="w-4 h-4" />
                    <span>Změnit v Nastavení</span>
                  </button>
                </div>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-[1.5px] border-rose-700 dark:border-rose-400 rounded-md">
                  <span className="text-slate-900 dark:text-slate-100">
                    Chybí vaše údaje. Smlouva potřebuje jméno, IČO, sídlo a číslo účtu.
                  </span>
                  <button type="button" onClick={onOpenSettings} className={outlineButton}>
                    <span>Vyplnit v Nastavení</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              )}
              {errors.contractor && contractor?.name && (
                <p role="alert" className={errorText}>
                  {errors.contractor}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="client-select" className={fieldLabel}>
                Klient (objednatel)
              </label>
              <div className="flex flex-col sm:flex-row gap-2.5">
                <select
                  id="client-select"
                  value={formData.clientId}
                  onChange={(e) => setFormData((prev) => ({ ...prev, clientId: e.target.value }))}
                  aria-invalid={!!errors.clientId}
                  className={`${fieldBase} flex-1 min-w-0 cursor-pointer ${errors.clientId ? fieldBad : fieldOk}`}
                >
                  {clients.length === 0 ? (
                    <option value="">Zatím nemáte žádného klienta</option>
                  ) : (
                    [
                      !formData.clientId && (
                        <option key="" value="" disabled>
                          Vyberte klienta
                        </option>
                      ),
                    ...clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                        {c.ico ? ` (IČO ${c.ico})` : ''}
                        {c.address ? `, ${c.address}` : ''}
                      </option>
                    )),
                    ]
                  )}
                </select>
                <button type="button" onClick={onOpenNewClientDialog} className={`${outlineButton} !min-h-12 shrink-0`}>
                  <UserPlus className="w-[18px] h-[18px]" />
                  <span>Nový klient</span>
                </button>
              </div>
              {errors.clientId && (
                <p role="alert" className={errorText}>
                  {errors.clientId}
                </p>
              )}

              {selectedClientObj && (
                <div className="mt-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-slate-600 dark:text-slate-400">
                  <div className="min-w-0">
                    {[selectedClientObj.address, selectedClientObj.phone, selectedClientObj.email].filter(Boolean).join(', ') ||
                      'Klient nemá vyplněnou adresu ani kontakt.'}
                  </div>
                  {onEditClient && (
                    <button type="button" onClick={() => onEditClient(selectedClientObj)} className={textLink}>
                      <Pencil className="w-4 h-4" />
                      <span>Upravit klienta</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </section>

          {/* 2. Dílo a cena */}
          <section id="sekce-predmet" aria-labelledby="nadpis-predmet" className="p-5 sm:p-6 space-y-5 scroll-mt-24">
            <h2 id="nadpis-predmet" className={sectionTitle}>
              2. Dílo a cena
            </h2>

            <div>
              <div className={fieldLabel}>Začít ze šablony řemesla</div>
              <div className="flex flex-wrap gap-2">
                {CRAFT_TEMPLATES.map((tpl) => (
                  <button
                    key={tpl.id}
                    type="button"
                    aria-pressed={selectedTemplateId === tpl.id}
                    onClick={() => {
                      applyTemplate(tpl);
                      triggerHaptic('selection');
                    }}
                    title={tpl.subtitle}
                    className={chip(selectedTemplateId === tpl.id)}
                  >
                    {tpl.title}
                  </button>
                ))}
              </div>
              <p className={hintText}>
                {activeTpl
                  ? `Šablona vyplnila popis díla${activeTpl.suggestedItems?.length ? ', položky rozpočtu' : ''}, termín za ${activeTpl.suggestedDays} dní a zálohu ${activeTpl.suggestedAdvancePercent} %. Vše můžete upravit.`
                  : 'Šablona vyplní popis díla, položky rozpočtu, termín a zálohu. Vše pak můžete upravit.'}
              </p>
            </div>

            <div>
              <div className="flex flex-wrap items-end justify-between gap-x-4">
                <label htmlFor="work-desc" className={fieldLabel}>
                  Popis díla
                </label>
                <button type="button" onClick={startVoiceDictation} aria-pressed={isListening} className={`${textLink} mb-0.5`}>
                  <Mic className="w-4 h-4" />
                  <span>{isListening ? 'Poslouchám, mluvte…' : 'Nadiktovat'}</span>
                </button>
              </div>
              <textarea
                id="work-desc"
                rows={4}
                value={formData.workDescription}
                onChange={(e) => setFormData((prev) => ({ ...prev, workDescription: e.target.value }))}
                placeholder="např. Obklad koupelny včetně přípravy podkladu, penetrace, hydroizolace a spárování dle dohodnutého kladečského plánu."
                aria-invalid={!!errors.workDescription}
                className={`${fieldBase} leading-relaxed ${errors.workDescription ? fieldBad : fieldOk}`}
              />
              {errors.workDescription && (
                <p role="alert" className={errorText}>
                  {errors.workDescription}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="site-address" className={fieldLabel}>
                Adresa stavby <span className="font-normal text-slate-600 dark:text-slate-400">(nepovinné)</span>
              </label>
              <input
                id="site-address"
                type="text"
                autoComplete="off"
                value={formData.siteAddress || ''}
                onChange={(e) => setFormData((prev) => ({ ...prev, siteAddress: e.target.value }))}
                placeholder="např. Na Výsluní 12, Říčany"
                className={`${fieldBase} ${fieldOk}`}
              />
              <p className={hintText}>
                Vyplňte, jen když se pracuje jinde, než klient bydlí. Uvede se ve smlouvě jako místo provedení díla a použije se pro navigaci, počasí, kalendář a knihu jízd.
              </p>
            </div>

            {/* DPH (jen plátce): sazba a kdo daň odvede */}
            {contractor?.dic && (
              <div className="space-y-3">
                <div>
                  <div className={fieldLabel}>Sazba DPH</div>
                  <div role="group" aria-label="Sazba DPH" className="flex flex-wrap gap-2">
                    <button type="button" aria-pressed={vatRate === 21} onClick={() => setVatRate(21)} className={chip(vatRate === 21)}>
                      21 %
                    </button>
                    <button
                      type="button"
                      aria-pressed={vatRate === 12}
                      onClick={() => setVatRate(12)}
                      className={chip(vatRate === 12)}
                      title="Stavební a montážní práce na dokončené stavbě pro bydlení"
                    >
                      12 % (bydlení)
                    </button>
                  </div>
                </div>
                <div>
                  <div className={fieldLabel}>Kdo odvede daň</div>
                  <div role="group" aria-label="Kdo odvede daň" className="flex flex-wrap gap-2">
                    <button type="button" aria-pressed={!reverseCharge} onClick={() => setReverseCharge(false)} className={chip(!reverseCharge)}>
                      Já (běžná faktura)
                    </button>
                    <button type="button" aria-pressed={reverseCharge} onClick={() => setReverseCharge(true)} className={chip(reverseCharge)}>
                      Zákazník (přenesení)
                    </button>
                  </div>
                  {reverseCharge ? (
                    <p className={hintText}>
                      Cena se zadává bez DPH. Faktura bude bez daně s textem „daň odvede zákazník“ – jen u stavebních a montážních prací pro plátce DPH.
                    </p>
                  ) : (
                    selectedClientObj?.dic && (
                      <p className="mt-2 px-3 py-2.5 border-l-[3px] border-blue-600 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200">
                        Klient má DIČ. Když pro něj děláte stavební nebo montážní práce, fakturuje se bez DPH a daň odvede on.{' '}
                        <button
                          type="button"
                          onClick={() => setReverseCharge(true)}
                          className="min-h-11 inline-flex items-center font-semibold text-blue-600 dark:text-blue-300 underline underline-offset-2 cursor-pointer"
                        >
                          Použít
                        </button>
                      </p>
                    )
                  )}
                </div>
              </div>
            )}

            <BudgetItemsEditor
              items={budgetItems}
              onChange={handleBudgetItemsChange}
              pricingType={pricingType}
              onPricingTypeChange={(t) => {
                setPricingType(t);
                if (t === 'fixed' && budgetItems.length > 0) {
                  const sum = budgetItems.reduce((acc, it) => acc + (it.totalPrice || 0), 0);
                  setRawPriceInput(sum.toString());
                  setFormData((prev) => ({ ...prev, price: sum }));
                }
              }}
              fixedPrice={formData.price}
              onFixedPriceChange={(val) => {
                setFormData((prev) => ({ ...prev, price: val }));
                setRawPriceInput(val ? val.toString() : '');
              }}
              hasVat={!!contractor?.dic}
              onToast={onToast}
            />

            {pricingType === 'fixed' ? (
              <div>
                <label htmlFor="price-input" className={fieldLabel}>
                  Cena díla{priceVatSuffix}
                </label>
                <div className="relative max-w-sm">
                  <input
                    id="price-input"
                    type="text"
                    inputMode="numeric"
                    value={formattedDisplayPrice}
                    onChange={handlePriceChange}
                    placeholder="např. 25 000"
                    aria-invalid={!!errors.price}
                    className={`${fieldBase} pr-12 font-display font-semibold text-[20px] tabular-nums ${errors.price ? fieldBad : fieldOk}`}
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 font-semibold text-slate-600 dark:text-slate-400 pointer-events-none">
                    Kč
                  </span>
                </div>
                {errors.price && (
                  <p role="alert" className={errorText}>
                    {errors.price}
                  </p>
                )}
                <div className="mt-2.5 flex flex-wrap items-center gap-2">
                  <span className="text-slate-600 dark:text-slate-400">Přičíst rezervu:</span>
                  {[10, 15, 20, 25].map((pct) => (
                    <button
                      key={pct}
                      type="button"
                      onClick={() => {
                        if (typeof formData.price === 'number' && formData.price > 0) {
                          const newP = Math.round(formData.price * (1 + pct / 100));
                          setFormData((prev) => ({ ...prev, price: newP }));
                          setRawPriceInput(String(newP));
                          triggerHaptic('selection');
                          onToast?.('info', `Cena zvýšena o ${pct} % na ${formatCurrency(newP)}.`);
                        } else {
                          onToast?.('info', 'Nejdřív zadejte cenu díla.');
                        }
                      }}
                      className={chip(false)}
                    >
                      +{pct} %
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div id="price-input" tabIndex={-1} className="outline-none">
                <div className="text-slate-600 dark:text-slate-400">Cena díla z rozpočtu ({itemsWord(budgetItems.length)})</div>
                <div className="text-[34px] leading-tight font-display font-bold tabular-nums text-slate-900 dark:text-white">
                  {formatCurrency(totalPriceNum)}
                </div>
                {errors.price && (
                  <p role="alert" className={errorText}>
                    Přidejte do rozpočtu aspoň jednu položku s cenou.
                  </p>
                )}
              </div>
            )}
          </section>

          {/* 3. Termín */}
          <section id="sekce-terminy" aria-labelledby="nadpis-terminy" className="p-5 sm:p-6 space-y-4 scroll-mt-24">
            <h2 id="nadpis-terminy" className={sectionTitle}>
              3. Termín
            </h2>
            <div>
              <label htmlFor="delivery-date" className={fieldLabel}>
                {isInvoiceOnly ? 'Práce dokončena dne' : 'Dokončení a předání díla'}
              </label>
              <input
                id="delivery-date"
                type="date"
                value={formData.deliveryDate}
                onChange={(e) => setFormData((prev) => ({ ...prev, deliveryDate: e.target.value }))}
                aria-invalid={!!errors.deliveryDate}
                className={`${fieldBase} max-w-sm ${errors.deliveryDate ? fieldBad : fieldOk}`}
              />
              {errors.deliveryDate && (
                <p role="alert" className={errorText}>
                  {errors.deliveryDate}
                </p>
              )}
              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                <span className="text-slate-600 dark:text-slate-400">Ode dneška za:</span>
                {[
                  { days: 3, label: '3 dny' },
                  { days: 7, label: 'týden' },
                  { days: 14, label: '14 dní' },
                  { days: 30, label: 'měsíc' },
                ].map((o) => (
                  <button key={o.days} type="button" onClick={() => setDeliveryDateOffset(o.days)} className={chip(false)}>
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* 4. Záloha (faktura bez smlouvy zálohu nemá) */}
          {!isInvoiceOnly && (
          <section id="sekce-platba" aria-labelledby="nadpis-platba" className="p-5 sm:p-6 space-y-4 scroll-mt-24">
            <h2 id="nadpis-platba" className={sectionTitle}>
              4. Záloha
            </h2>
            <div>
              <div role="group" aria-label="Výše zálohy" className="flex flex-wrap gap-2">
                {(
                  [
                    { key: 'none', label: 'Bez zálohy' },
                    { key: '30', label: '30 % ceny' },
                    { key: '50', label: '50 % ceny' },
                  ] as const
                ).map((o) => (
                  <button
                    key={o.key}
                    type="button"
                    aria-pressed={advancePreset === o.key}
                    onClick={() => setAdvanceRatio(o.key)}
                    className={chip(advancePreset === o.key)}
                  >
                    {o.label}
                  </button>
                ))}
              </div>

              <label htmlFor="advance-input" className={`${fieldLabel} mt-4`}>
                Záloha na materiál a zahájení prací <span className="font-normal text-slate-600 dark:text-slate-400">(nepovinné)</span>
              </label>
              <div className="relative max-w-sm">
                <input
                  id="advance-input"
                  type="text"
                  inputMode="numeric"
                  value={formattedDisplayAdvance}
                  onChange={handleAdvanceChange}
                  placeholder="0"
                  aria-invalid={!!errors.advanceAmount}
                  className={`${fieldBase} pr-12 font-display font-semibold text-[20px] tabular-nums ${errors.advanceAmount ? fieldBad : fieldOk}`}
                />
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 font-semibold text-slate-600 dark:text-slate-400 pointer-events-none">
                  Kč
                </span>
              </div>
              {errors.advanceAmount && (
                <p role="alert" className={errorText}>
                  {errors.advanceAmount}
                </p>
              )}
              {advancePriceNum > 0 && !errors.advanceAmount && (
                <p className={hintText}>
                  Na zálohu {formatCurrency(advancePriceNum)} půjde vystavit zálohová faktura. Doplatek po předání díla bude{' '}
                  {formatCurrency(remainingPriceNum)}.
                </p>
              )}
            </div>
          </section>

          )}

          <div className="p-5 sm:p-6">
            <button type="submit" className={`${primaryButton} w-full sm:w-auto`}>
              <Eye className="w-5 h-5" />
              <span>Zobrazit dokumenty</span>
            </button>
          </div>
        </form>

        {/* Souhrn */}
        <aside aria-labelledby="nadpis-souhrn" className="lg:col-span-4 lg:sticky lg:top-6 space-y-2.5 min-w-0">
          <h2 id="nadpis-souhrn" className={sectionTitle}>
            Souhrn
          </h2>
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md divide-y divide-slate-100 dark:divide-slate-800">
            <div className="px-5 py-[18px] !border-b !border-slate-900 dark:!border-slate-500">
              <div className="text-slate-600 dark:text-slate-400">Cena díla{priceVatSuffix}</div>
              <div className="text-[40px] leading-none font-display font-bold tabular-nums text-slate-900 dark:text-white mt-1">
                {formatCurrency(totalPriceNum)}
              </div>
              {totalPriceNum > 0 && advancePriceNum > 0 && (
                <div className="mt-2 text-slate-600 dark:text-slate-400">
                  záloha {formatCurrency(advancePriceNum)}, doplatek {formatCurrency(remainingPriceNum)}
                </div>
              )}
            </div>
            {[
              { label: 'Klient', value: selectedClientObj?.name, missing: 'nevybrán' },
              { label: isInvoiceOnly ? 'Práce dokončena' : 'Termín předání', value: formData.deliveryDate ? formatDateCs(formData.deliveryDate) : '', missing: 'nezadán' },
              {
                label: 'Cena',
                value: pricingType === 'budget' ? `rozpočet, ${itemsWord(budgetItems.length)}` : 'pevná částka',
                missing: '',
              },
              { label: 'Zhotovitel', value: contractor?.name, missing: 'chybí údaje' },
            ].map((row) => (
              <div key={row.label} className="px-5 py-3 flex items-baseline justify-between gap-4">
                <span className="text-slate-600 dark:text-slate-400 shrink-0">{row.label}</span>
                <span
                  className={`text-right min-w-0 ${
                    row.value ? 'font-semibold text-slate-900 dark:text-white' : 'text-rose-700 dark:text-rose-400 font-medium'
                  }`}
                >
                  {row.value || row.missing}
                </span>
              </div>
            ))}
            <div className="px-5 py-3.5">
              <div className="text-slate-600 dark:text-slate-400 mb-1.5">Vzniknou dokumenty</div>
              <ul className="space-y-1">
                {documents.map((doc) => (
                  <li key={doc} className="flex items-center gap-2 text-slate-900 dark:text-slate-100">
                    <Check className="w-4 h-4 shrink-0" />
                    <span>{doc}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <button type="button" onClick={(e) => handleSubmit(e as any)} className={`${primaryButton} w-full !hidden lg:!inline-flex`}>
            <Eye className="w-5 h-5" />
            <span>Zobrazit dokumenty</span>
          </button>
        </aside>
      </div>
    </div>
  );
};
