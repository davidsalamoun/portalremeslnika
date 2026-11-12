import React, { useState, useEffect } from 'react';
import {
  Pencil,
  AlertTriangle,
  UserPlus,
  Eye,
  Calendar,
  Wrench,
  ArrowRight,
  ShieldCheck,
  Coins,
  Receipt,
  FileCheck2,
  Mic,
  MicOff,
  MapPin,
  Phone,
  Mail,
  FileText,
  FileSpreadsheet,
  Tag,
  Briefcase,
  Clock,
  Check,
  Zap,
  Hammer,
  Paintbrush,
  Grid,
  Home,
  Droplet,
  Boxes,
  Layers,
} from 'lucide-react';
import { ContractorProfile, Client, Contract, ContractFormData, BudgetItem } from '../types/contract';
import { formatCurrency, formatDateCs, formatPlaceWithPreposition, cleanPlaceName } from '../utils/numberToWordsCs';
import { CRAFT_TEMPLATES, CraftTemplate } from '../data/craftTemplates';
import { BudgetItemsEditor } from './BudgetItemsEditor';
import { triggerHaptic } from '../utils/haptics';
import { getStoredContracts } from '../utils/storage';

const getCraftIcon = (id: string, className: string = 'w-4 h-4') => {
  switch (id) {
    case 'tiles-bath':
      return <Grid className={className} />;
    case 'drywall-ceilings':
      return <Layers className={className} />;
    case 'electrical-house':
      return <Zap className={className} />;
    case 'plumbing-hvac':
      return <Droplet className={className} />;
    case 'painting-interior':
      return <Paintbrush className={className} />;
    case 'flooring-vinyl':
      return <Boxes className={className} />;
    case 'kitchen-assembly':
      return <Hammer className={className} />;
    case 'roofing-renovation':
      return <Home className={className} />;
    case 'paving-garden':
      return <Grid className={className} />;
    default:
      return <Wrench className={className} />;
  }
};

interface ContractFormProps {
  contractor: ContractorProfile | null;
  clients: Client[];
  initialTemplateId?: string | null;
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
  onOpenSettings,
  onOpenNewClientDialog,
  onEditClient,
  onShowPreview,
  onPreloadSampleData,
  onToast,
}) => {
  const [docKind, setDocKind] = useState<'contract' | 'quote'>('contract');
  const [pricingType, setPricingType] = useState<'fixed' | 'budget'>('fixed');
  const [budgetItems, setBudgetItems] = useState<BudgetItem[]>([]);
  const [isListening, setIsListening] = useState(false);

  const [formData, setFormData] = useState<ContractFormData>({
    clientId: clients.length > 0 ? clients[0].id : '',
    docKind: 'contract',
    workDescription: '',
    price: '',
    deliveryDate: '',
    advanceAmount: '',
  });

  const [rawPriceInput, setRawPriceInput] = useState<string>('');
  const [rawAdvanceInput, setRawAdvanceInput] = useState<string>('');
  const [advancePreset, setAdvancePreset] = useState<'none' | '30' | '50' | 'custom'>('none');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  const startVoiceDictation = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      onToast?.(
        'info',
        'Váš prohlížeč nepodporuje přímé diktování. Na klávesnici telefonu (Gboard/iOS) klepněte přímo na ikonu mikrofonu.'
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
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + tpl.suggestedDays);
    const targetDateIso = targetDate.toISOString().split('T')[0];

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
    if (clients.length > 0 && !formData.clientId) {
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
    const d = new Date();
    d.setDate(d.getDate() + days);
    const iso = d.toISOString().split('T')[0];
    setFormData((prev) => ({ ...prev, deliveryDate: iso }));
    if (errors.deliveryDate) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next.deliveryDate;
        return next;
      });
    }
  };

  const validate = (): boolean => {
    const newErrors: { [key: string]: string } = {};

    if (!contractor || !contractor.name || !contractor.ico || !contractor.address) {
      newErrors.contractor = 'Před vytvořením smlouvy musíte v Nastavení vyplnit své údaje.';
    }

    if (!formData.clientId) {
      newErrors.clientId = 'Vyberte klienta ze seznamu nebo přidejte nového.';
    }

    if (!formData.workDescription.trim()) {
      newErrors.workDescription = 'Vyplňte předmět díla (specifikaci prací).';
    } else if (formData.workDescription.trim().length < 5) {
      newErrors.workDescription = 'Popis předmětu díla je příliš krátký.';
    }

    if (formData.price === '' || typeof formData.price !== 'number' || formData.price <= 0) {
      newErrors.price = 'Zadejte platnou cenu za dílo v Kč.';
    }

    if (
      formData.advanceAmount !== '' &&
      typeof formData.advanceAmount === 'number' &&
      typeof formData.price === 'number' &&
      formData.advanceAmount >= formData.price
    ) {
      newErrors.advanceAmount = 'Záloha nemůže být vyšší nebo rovna celkové ceně díla.';
    }

    if (!formData.deliveryDate) {
      newErrors.deliveryDate = 'Zadejte termín dokončení a předání díla.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate() || !contractor) return;

    const selectedClient = clients.find((c) => c.id === formData.clientId);
    if (!selectedClient) {
      setErrors((prev) => ({ ...prev, clientId: 'Vybraný klient nebyl nalezen.' }));
      return;
    }

    const todayIso = new Date().toISOString().split('T')[0];
    const thisYear = new Date().getFullYear();
    const storedContracts = getStoredContracts();
    const thisYearContracts = storedContracts.filter(
      (c) => c.contractNumber?.includes(`${thisYear}`) || c.createdAt?.startsWith(`${thisYear}`)
    );
    const nextSeqNum = thisYearContracts.length + 1;
    const paddedSeq = String(nextSeqNum).padStart(3, '0');

    const quoteNum = `CN-${thisYear}-${paddedSeq}`;
    const contractNum = `SOD-${thisYear}-${paddedSeq}`;
    const invoiceNum = `${thisYear}${paddedSeq}`;
    const vsNum = `${thisYear}${paddedSeq}`;

    const validUntilDate = (() => {
      const d = new Date(todayIso);
      d.setDate(d.getDate() + 30);
      return d.toISOString().split('T')[0];
    })();

    const newContract: Contract = {
      id: `contract_${Date.now()}`,
      docKind: docKind,
      quoteNumber: docKind === 'quote' ? quoteNum : undefined,
      quoteValidUntil: docKind === 'quote' ? validUntilDate : undefined,
      pricingType: pricingType,
      items: pricingType === 'budget' && budgetItems.length > 0 ? budgetItems : undefined,
      contractNumber: contractNum,
      invoiceNumber: invoiceNum,
      variableSymbol: vsNum,
      contractor: contractor,
      client: selectedClient,
      workDescription: formData.workDescription.trim(),
      price: Number(formData.price),
      advanceAmount:
        typeof formData.advanceAmount === 'number' && formData.advanceAmount > 0
          ? formData.advanceAmount
          : undefined,
      deliveryDate: formData.deliveryDate,
      conclusionDate: todayIso,
      executionPlace: cleanPlaceName(contractor.defaultPlace) || 'místě plnění',
      hasVat: !!contractor.dic,
      status: 'draft',
      contractorSignature: contractor.signature,
      contractorSignatureDate: contractor.signature ? todayIso : undefined,
      createdAt: new Date().toISOString(),
    };

    onShowPreview(newContract);
  };

  const selectedClientObj = clients.find((c) => c.id === formData.clientId);
  const totalPriceNum = typeof formData.price === 'number' ? formData.price : 0;
  const advancePriceNum = typeof formData.advanceAmount === 'number' ? formData.advanceAmount : 0;
  const remainingPriceNum = Math.max(0, totalPriceNum - advancePriceNum);

  return (
    <div className="max-w-[1360px] mx-auto pb-16">
      {/* Document Kind Switcher */}
      <div className="mb-4 inline-flex p-1 bg-slate-100 dark:bg-slate-800/90 rounded-lg border border-slate-200 dark:border-slate-700">
        <button
          type="button"
          onClick={() => setDocKind('contract')}
          className={`px-4 py-2 text-xs sm:text-sm font-bold rounded-md transition-all flex items-center gap-2 ${
            docKind === 'contract'
              ? 'bg-slate-900 text-white shadow-xs dark:bg-blue-600'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Smlouva o dílo (§ 2586 NOZ)</span>
        </button>
        <button
          type="button"
          onClick={() => setDocKind('quote')}
          className={`px-4 py-2 text-xs sm:text-sm font-bold rounded-md transition-all flex items-center gap-2 ${
            docKind === 'quote'
              ? 'bg-slate-900 text-white shadow-xs dark:bg-blue-600'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <Tag className="w-4 h-4" />
          <span>Cenová nabídka / Kalkulace</span>
        </button>
      </div>

      {/* Intro Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            {docKind === 'contract' ? 'Pracovní stůl: Nová smlouva o dílo' : 'Pracovní stůl: Cenová nabídka & kalkulace'}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {docKind === 'contract'
              ? 'Vyplňte zakázkový list. V dalším kroku si zkontrolujete vygenerovanou smlouvu, předávací protokol a fakturu s QR kódem.'
              : 'Vytvořte položkový rozpočet prací a materiálu. Po odsouhlasení zákazníkem nabídku jedním kliknutím převedete na ostrou smlouvu.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start sm:self-center shrink-0">
          {(!contractor || clients.length === 0) && onPreloadSampleData && (
            <button
              type="button"
              onClick={onPreloadSampleData}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg border border-slate-300 dark:border-slate-700 transition-colors cursor-pointer"
              title="Předvyplní ukázková testovací data zhotovitele a klienta"
            >
              <FileText className="w-3.5 h-3.5 text-slate-500" />
              <span className="hidden sm:inline">Ukázková data</span>
            </button>
          )}

          <button
            type="button"
            onClick={(e) => handleSubmit(e as any)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs sm:text-sm font-black shadow-xs transition-all cursor-pointer group active:scale-95"
            title="Okamžitě zobrazit náhled vygenerovaných dokumentů"
          >
            <Eye className="w-4 h-4 group-hover:scale-110 transition-transform" />
            <span>Zobrazit náhled dokumentů</span>
          </button>
        </div>
      </div>

      {/* Technický krokoměr zakázky (01 Smluvní strany → 02 Dílo & Rozpočet → 03 Termíny & Záruka → 04 Platba & Podmínky) */}
      <div className="mb-6 bg-white dark:bg-slate-900 rounded-xl p-3 border border-slate-200 dark:border-slate-800 shadow-2xs">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {[
            {
              id: 'sekce-strany',
              step: '01',
              title: 'Smluvní strany',
              desc: contractor?.name && formData.clientId ? 'Vyplněno' : 'Zhotovitel & Klient',
              isDone: Boolean(contractor?.name && formData.clientId),
            },
            {
              id: 'sekce-predmet',
              step: '02',
              title: 'Dílo & Rozpočet',
              desc: formData.workDescription.trim() ? (formData.price ? 'Oceněno' : 'Popis zadán') : 'Položky prací',
              isDone: Boolean(formData.workDescription.trim() && (formData.price || budgetItems.length > 0)),
            },
            {
              id: 'sekce-terminy',
              step: '03',
              title: 'Termíny & Záruka',
              desc: formData.deliveryDate ? formatDateCs(formData.deliveryDate) : 'Harmonogram předání',
              isDone: Boolean(formData.deliveryDate),
            },
            {
              id: 'sekce-platba',
              step: '04',
              title: 'Platba & Podmínky',
              desc: formData.advanceAmount ? `Záloha ${formatCurrency(formData.advanceAmount)}` : 'Splatnost & vyúčtování',
              isDone: true,
            },
          ].map((st) => (
            <button
              key={st.id}
              type="button"
              onClick={() => {
                const el = document.getElementById(st.id);
                if (el) {
                  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
              }}
              className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer flex items-start gap-2.5 ${
                st.isDone
                  ? 'bg-slate-50 dark:bg-slate-850/60 border-slate-200 dark:border-slate-800 hover:border-amber-400 dark:hover:border-amber-500'
                  : 'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              <span
                className={`w-6 h-6 rounded-md font-mono text-xs font-bold flex items-center justify-center shrink-0 ${
                  st.isDone
                    ? 'bg-slate-900 dark:bg-amber-500 text-white dark:text-slate-950'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                }`}
              >
                {st.step}
              </span>
              <div className="min-w-0">
                <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                  {st.title}
                </div>
                <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 truncate">
                  {st.desc}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Split Workbench: Form on Left (lg:col-span-8), Live Sheet on Right (lg:col-span-4) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Formulářová část */}
        <div className="lg:col-span-8 bg-white dark:bg-slate-900 rounded-xl p-5 sm:p-7 shadow-xs border border-slate-200 dark:border-slate-800 transition-colors">
          <form onSubmit={handleSubmit} className="space-y-6">
          {/* 1. Smluvní strany (Zhotovitel & Objednatel) */}
          <div id="sekce-strany" className="scroll-mt-24 space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  1. Smluvní strana
                </span>
              <span className="text-xs text-slate-400 dark:text-slate-500">Podle § 2586 občanského zákoníku</span>
            </div>

            {contractor && contractor.name ? (
              <div className="bg-slate-50/80 dark:bg-slate-800/40 rounded-xl px-3.5 py-2.5 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-2.5 text-xs">
                <div className="flex items-center gap-2 truncate">
                  <span className="font-bold text-blue-900 dark:text-blue-300 bg-blue-100/70 dark:bg-blue-950/70 px-2 py-0.5 rounded text-[11px] shrink-0">
                    Zhotovitel
                  </span>
                  <span className="font-extrabold text-slate-900 dark:text-white truncate">
                    {contractor.name}
                  </span>
                  <span className="text-slate-400 hidden sm:inline">·</span>
                  <span className="text-slate-500 dark:text-slate-400 truncate hidden sm:inline">
                    IČO {contractor.ico} {contractor.dic ? `· DIČ ${contractor.dic}` : '· neplátce DPH'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={onOpenSettings}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#1E3A78] dark:text-blue-300 hover:underline shrink-0 cursor-pointer ml-auto"
                  title="Upravit profil zhotovitele v Nastavení"
                >
                  <Pencil className="w-3 h-3" />
                  <span>Změnit</span>
                </button>
              </div>
            ) : (
              <div className="bg-amber-50/80 dark:bg-amber-950/30 rounded-xl p-4 border border-amber-200 dark:border-amber-800/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-bold text-amber-900 dark:text-amber-200">Vyplňte své údaje v profilu</h4>
                    <p className="text-[11px] text-amber-700 dark:text-amber-300/80">
                      Pro generování platné smlouvy je potřeba mít vyplněné IČO, sídlo a účet.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onOpenSettings}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1E3A78] text-white text-xs font-semibold hover:bg-[#162c5c] transition-colors shrink-0 cursor-pointer self-start sm:self-auto"
                >
                  <span>Přejít do Nastavení</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            )}
            {errors.contractor && (
              <p className="text-xs text-rose-600 mt-1 font-medium">{errors.contractor}</p>
            )}
          </div>

          {/* 2. Klient (objednatel) */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label htmlFor="client-select" className="block text-sm font-bold text-slate-800 dark:text-slate-200">
                Klient (objednatel) <span className="text-rose-500">*</span>
              </label>
              {clients.length > 0 && (
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  Uloženo {clients.length} {clients.length === 1 ? 'klient' : clients.length < 5 ? 'klienti' : 'klientů'}
                </span>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5">
              <div className="flex-1">
                <select
                  id="client-select"
                  value={formData.clientId}
                  onChange={(e) => setFormData((prev) => ({ ...prev, clientId: e.target.value }))}
                  className={`w-full px-3.5 py-2.5 rounded-xl border text-sm bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-all focus:outline-hidden focus:ring-2 cursor-pointer ${
                    errors.clientId
                      ? 'border-rose-300 ring-rose-200 bg-rose-50/20'
                      : 'border-slate-300 dark:border-slate-700 focus:border-[#1E3A78] dark:focus:border-blue-500 focus:ring-blue-100 dark:focus:ring-blue-950'
                  }`}
                >
                  {clients.length === 0 ? (
                    <option value="">Zatím nemáte žádného klienta – klikněte na „+ Nový klient“</option>
                  ) : (
                    clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.ico ? `(IČO: ${c.ico})` : ''} · {c.address}
                      </option>
                    ))
                  )}
                </select>
              </div>

              <button
                type="button"
                onClick={onOpenNewClientDialog}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-sm font-semibold border border-slate-200 dark:border-slate-700 transition-colors shrink-0 cursor-pointer"
              >
                <UserPlus className="w-4 h-4 text-[#1E3A78] dark:text-blue-400" />
                <span>+ Nový klient</span>
              </button>
            </div>
            {errors.clientId && (
              <p className="text-xs text-rose-600 mt-1.5 font-medium">{errors.clientId}</p>
            )}

            {/* Kompaktní vizitka vybraného klienta */}
            {(() => {
              const selectedClient = clients.find((c) => c.id === formData.clientId);
              if (!selectedClient) return null;
              return (
                <div className="mt-2.5 p-3 rounded-xl bg-slate-50/90 dark:bg-slate-800/40 border border-slate-200/90 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-extrabold text-slate-900 dark:text-white text-sm truncate">
                        {selectedClient.name}
                      </span>
                      {selectedClient.ico && (
                        <span className="px-1.5 py-0.5 rounded-md bg-slate-200 dark:bg-slate-700 font-mono text-[11px] text-slate-700 dark:text-slate-300">
                          IČO: {selectedClient.ico}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1 text-slate-500 dark:text-slate-400 text-xs">
                      {selectedClient.address && (
                        <span className="flex items-center gap-1 truncate">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate">{selectedClient.address}</span>
                        </span>
                      )}
                      {selectedClient.phone && (
                        <a
                          href={`tel:${selectedClient.phone}`}
                          className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-semibold hover:underline"
                          title="Zavolat klientovi"
                        >
                          <Phone className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span>{selectedClient.phone}</span>
                        </a>
                      )}
                      {selectedClient.email && (
                        <a
                          href={`mailto:${selectedClient.email}`}
                          className="inline-flex items-center gap-1 text-[#1E3A78] dark:text-blue-400 hover:underline truncate"
                          title="Napsat e-mail"
                        >
                          <Mail className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">{selectedClient.email}</span>
                        </a>
                      )}
                    </div>
                  </div>

                  {onEditClient && (
                    <button
                      type="button"
                      onClick={() => onEditClient(selectedClient)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 font-semibold transition-colors cursor-pointer self-start sm:self-center shrink-0 shadow-2xs"
                      title="Upravit údaje klienta (telefon, adresu, IČO)"
                    >
                      <Pencil className="w-3.5 h-3.5 text-[#1E3A78] dark:text-blue-400" />
                      <span>Upravit klienta</span>
                    </button>
                  )}
                </div>
              );
            })()}
          </div>
          </div>

          {/* 2. Předmět díla & Rozpočet */}
          <div id="sekce-predmet" className="scroll-mt-24 space-y-4">
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <label htmlFor="work-desc" className="block text-sm font-black text-slate-900 dark:text-white">
                  Předmět díla <span className="text-rose-500">*</span>
                </label>

              {/* Tlačítko hlasového diktování pro řemeslníka */}
              <button
                type="button"
                onClick={startVoiceDictation}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-xs ${
                  isListening
                    ? 'bg-rose-600 text-white animate-pulse ring-2 ring-rose-400'
                    : 'bg-blue-50 dark:bg-blue-950/80 text-[#1E3A78] dark:text-blue-300 border border-blue-200 dark:border-blue-800 hover:bg-blue-100'
                }`}
                title="Máte plné ruce? Stiskněte a nadiktujte předmět díla hlasem do mobilu"
              >
                {isListening ? (
                  <>
                    <MicOff className="w-4 h-4 animate-spin" />
                    <span>Poslouchám, diktujte...</span>
                  </>
                ) : (
                  <>
                    <Mic className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    <span>Diktovat hlasem (mikrofon)</span>
                  </>
                )}
              </button>
            </div>

            {/* Rychlé šablony popisu díla */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 mb-2 text-xs">
              <span className="text-slate-400 dark:text-slate-500 font-semibold text-3xs whitespace-nowrap uppercase tracking-wider">
                Vzorové obory:
              </span>
              {CRAFT_TEMPLATES.slice(0, 6).map((tpl) => (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() => {
                    applyTemplate(tpl);
                    triggerHaptic('selection');
                    onToast?.('info', `Vložen vzor: ${tpl.title}`);
                  }}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap transition-colors cursor-pointer border shrink-0 flex items-center gap-1.5 ${
                    selectedTemplateId === tpl.id
                      ? 'bg-slate-900 dark:bg-slate-800 text-white border-slate-900 dark:border-slate-700 font-semibold'
                      : 'bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700'
                  }`}
                  title={`Vložit vzorový popis a rozpočet: ${tpl.title}`}
                >
                  <span className="opacity-75">{getCraftIcon(tpl.id, 'w-3 h-3')}</span>
                  <span>{tpl.title.split(' ')[0]} {tpl.title.split(' ')[1] || ''}</span>
                </button>
              ))}
            </div>

            <textarea
              id="work-desc"
              rows={4}
              value={formData.workDescription}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, workDescription: e.target.value }))
              }
              placeholder="např. Obklad koupelny včetně přípravy podkladu, penetrace, hydroizolace a spárování flexibilní spárovací hmotou dle dohodnutého kladečského plánu."
              className={`w-full px-3.5 py-3 rounded-xl border text-sm leading-relaxed bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-all focus:outline-hidden focus:ring-2 ${
                errors.workDescription
                  ? 'border-rose-400 ring-rose-200 bg-rose-50/20'
                  : 'border-slate-300 dark:border-slate-700 focus:border-[#1E3A78] dark:focus:border-blue-500 focus:ring-blue-100 dark:focus:ring-blue-950'
              }`}
            />
            {errors.workDescription && (
              <p className="text-xs text-rose-600 mt-1 font-bold">{errors.workDescription}</p>
            )}

            {/* Quick craft templates - Big Touch Targets */}
            <div className="mt-3.5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <Wrench className="w-4 h-4 text-amber-500" />
                  <span>Rychlé šablony řemesel (vyplní popis díla, cenu i záruku na 1 klik):</span>
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                {CRAFT_TEMPLATES.map((tpl) => {
                  const isSelected = selectedTemplateId === tpl.id;
                  return (
                    <button
                      key={tpl.id}
                      type="button"
                      onClick={() => applyTemplate(tpl)}
                      className={`min-h-[52px] p-2 rounded-lg border font-bold text-xs transition-all flex flex-col items-center justify-center text-center gap-1 cursor-pointer active:scale-95 shadow-2xs ${
                        isSelected
                          ? 'bg-[#1E3A78] dark:bg-blue-600 text-white border-[#1E3A78] dark:border-blue-600 shadow-sm ring-2 ring-blue-300 dark:ring-blue-900'
                          : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 hover:border-blue-300 dark:hover:border-blue-700 hover:bg-slate-50 dark:hover:bg-slate-850'
                      }`}
                      title={`${tpl.title} (${tpl.subtitle})`}
                    >
                      <span className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 ${isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-slate-800 text-[#1E3A78] dark:text-blue-400'}`}>
                        {getCraftIcon(tpl.id, 'w-3.5 h-3.5')}
                      </span>
                      <span className="line-clamp-1 leading-tight text-[11px]">{tpl.title.split(' ')[0]} {tpl.title.split(' ')[1] || ''}</span>
                    </button>
                  );
                })}
              </div>

              {/* Informační lišta vybrané šablony */}
              {selectedTemplateId && (
                (() => {
                  const activeTpl = CRAFT_TEMPLATES.find((t) => t.id === selectedTemplateId);
                  if (!activeTpl) return null;
                  return (
                    <div className="mt-2.5 p-2.5 rounded-xl bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200/80 dark:border-blue-800/60 flex flex-wrap items-center justify-between gap-2 text-xs text-blue-900 dark:text-blue-200">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/60 text-[#1E3A78] dark:text-blue-300 flex items-center justify-center shrink-0">
                          {getCraftIcon(activeTpl.id, 'w-4 h-4')}
                        </div>
                        <div>
                          <p className="font-bold">{activeTpl.title}</p>
                          <p className="text-[11px] text-blue-700 dark:text-blue-300">{activeTpl.subtitle}</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-[11px] text-blue-800 dark:text-blue-300">
                        <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" /> Realizace: <strong>cca {activeTpl.suggestedDays} dní</strong></span>
                        <span className="flex items-center gap-1"><Coins className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" /> Záloha: <strong>{activeTpl.suggestedAdvancePercent} %</strong></span>
                        <span className="flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" /> Záruka: <strong>{activeTpl.warrantyMonths} měsíců</strong></span>
                      </div>
                    </div>
                  );
                })()
              )}
            </div>
          </div>

          {/* 4. Položkový rozpočet a stanovení ceny */}
          <div className="pt-1 space-y-4">
            <BudgetItemsEditor
              items={budgetItems}
              onChange={handleBudgetItemsChange}
              pricingType={pricingType}
              onPricingTypeChange={(t) => {
                setPricingType(t);
                if (t === 'fixed' && budgetItems.length > 0) {
                  const s = budgetItems.reduce((acc, it) => acc + (it.totalPrice || 0), 0);
                  setRawPriceInput(s.toString());
                  setFormData((prev) => ({ ...prev, price: s }));
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
          </div>
          </div>

          {/* 3. Termíny realizace & Záruka */}
          <div id="sekce-terminy" className="scroll-mt-24 space-y-4">
            {/* Dvě pole vedle sebe: Cena (pokud je paušál) a Termín dodání */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-1">
              {/* Cena (pokud paušál) */}
              {pricingType === 'fixed' ? (
                <div>
                  <label htmlFor="price-input" className="block text-sm font-bold text-slate-800 dark:text-slate-200 mb-1.5">
                    Paušální cena za dílo <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      id="price-input"
                      type="text"
                      inputMode="numeric"
                      value={formattedDisplayPrice}
                      onChange={handlePriceChange}
                      placeholder="např. 25 000"
                      className={`w-full pl-3.5 pr-12 py-2.5 rounded-xl border text-sm font-medium bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-all focus:outline-hidden focus:ring-2 ${
                        errors.price
                          ? 'border-rose-300 ring-rose-200 bg-rose-50/20'
                          : 'border-slate-300 dark:border-slate-700 focus:border-[#1E3A78] dark:focus:border-blue-500 focus:ring-blue-100 dark:focus:ring-blue-950'
                      }`}
                    />
                    <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400 pointer-events-none">
                      Kč
                    </span>
                  </div>

                  {/* Rychlá kalkulace marže / ziskové přirážky */}
                  <div className="flex flex-wrap items-center gap-1.5 mt-2">
                    <span className="text-[11px] font-mono font-bold text-slate-500 dark:text-slate-400">
                      Marže / rezerva:
                    </span>
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
                            onToast?.('info', `Cena přepočtena s +${pct} % marží: ${formatCurrency(newP)}`);
                          }
                        }}
                        className="px-2 py-0.5 text-xs font-mono font-bold rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 cursor-pointer transition-colors"
                        title={`Přičíst k zadané ceně +${pct} % marži`}
                      >
                        +{pct} %
                      </button>
                    ))}
                  </div>

                  {formData.price !== '' && typeof formData.price === 'number' && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Cena bez DPH: <strong className="font-mono text-slate-900 dark:text-white">{formatCurrency(formData.price)}</strong>
                    </p>
                  )}
                  {errors.price && <p className="text-xs text-rose-600 mt-1 font-medium">{errors.price}</p>}
                </div>
              ) : (
                <div className="p-3 bg-blue-50/60 dark:bg-blue-950/40 rounded-xl border border-blue-200 dark:border-blue-900/60 flex flex-col justify-center">
                  <span className="text-xs text-blue-700 dark:text-blue-300 font-medium">Celková cena z rozpočtu:</span>
                  <span className="text-xl font-bold text-blue-950 dark:text-blue-100">
                    {typeof formData.price === 'number' ? formatCurrency(formData.price) : '0 Kč'}
                  </span>
                  <span className="text-[11px] text-slate-500">
                    {budgetItems.length} položek rozpočtu
                  </span>
                </div>
              )}

              {/* Termín dodání */}
              <div>
                <label htmlFor="delivery-date" className="block text-sm font-bold text-slate-800 dark:text-slate-200 mb-1.5">
                  Termín dokončení a předání <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    id="delivery-date"
                    type="date"
                    value={formData.deliveryDate}
                    onChange={(e) => setFormData((prev) => ({ ...prev, deliveryDate: e.target.value }))}
                    className={`w-full px-3.5 py-2.5 rounded-xl border text-sm bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-all focus:outline-hidden focus:ring-2 ${
                      errors.deliveryDate
                        ? 'border-rose-300 ring-rose-200 bg-rose-50/20'
                        : 'border-slate-300 dark:border-slate-700 focus:border-[#1E3A78] dark:focus:border-blue-500 focus:ring-blue-100 dark:focus:ring-blue-950'
                    }`}
                  />
                </div>
                
                {/* 1-klikové rychlé termíny dokončení */}
                <div className="flex flex-wrap items-center gap-1.5 mt-2">
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Rychle:</span>
                  <button
                    type="button"
                    onClick={() => setDeliveryDateOffset(3)}
                    className="px-2 py-0.5 text-xs font-semibold rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-950/60 text-slate-700 dark:text-slate-300 hover:text-blue-700 dark:hover:text-blue-300 border border-slate-200 dark:border-slate-700 cursor-pointer transition-colors"
                  >
                    +3 dny
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeliveryDateOffset(7)}
                    className="px-2 py-0.5 text-xs font-semibold rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-950/60 text-slate-700 dark:text-slate-300 hover:text-blue-700 dark:hover:text-blue-300 border border-slate-200 dark:border-slate-700 cursor-pointer transition-colors"
                  >
                    +1 týden
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeliveryDateOffset(14)}
                    className="px-2 py-0.5 text-xs font-semibold rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-950/60 text-slate-700 dark:text-slate-300 hover:text-blue-700 dark:hover:text-blue-300 border border-slate-200 dark:border-slate-700 cursor-pointer transition-colors"
                  >
                    +14 dní
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeliveryDateOffset(30)}
                    className="px-2 py-0.5 text-xs font-semibold rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-950/60 text-slate-700 dark:text-slate-300 hover:text-blue-700 dark:hover:text-blue-300 border border-slate-200 dark:border-slate-700 cursor-pointer transition-colors"
                  >
                    +1 měsíc
                  </button>
                </div>

                {formData.deliveryDate && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span>Dílo bude dokončeno do: <strong>{formatDateCs(formData.deliveryDate)}</strong></span>
                  </p>
                )}
                {errors.deliveryDate && (
                  <p className="text-xs text-rose-600 mt-1 font-medium">{errors.deliveryDate}</p>
                )}
              </div>
            </div>
          </div>

          {/* 4. Platba, Záloha & Podmínky */}
          <div id="sekce-platba" className="scroll-mt-24 space-y-4">
            {/* CHYTRÁ FUNKCE: Záloha na materiál */}
          <div className="bg-slate-50/80 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-200 dark:border-slate-700/80">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-1.5">
                <Coins className="w-4 h-4 text-[#1E3A78] dark:text-blue-400" />
                <label className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  Záloha na materiál / zahájení prací (nepovinné)
                </label>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setAdvanceRatio('none')}
                  className={`px-2 py-0.5 text-xs rounded-md font-medium cursor-pointer ${
                    advancePreset === 'none'
                      ? 'bg-[#1E3A78] dark:bg-blue-600 text-white'
                      : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                  }`}
                >
                  Bez zálohy
                </button>
                <button
                  type="button"
                  onClick={() => setAdvanceRatio('30')}
                  className={`px-2 py-0.5 text-xs rounded-md font-medium cursor-pointer ${
                    advancePreset === '30'
                      ? 'bg-[#1E3A78] dark:bg-blue-600 text-white'
                      : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                  }`}
                >
                  30 % záloha
                </button>
                <button
                  type="button"
                  onClick={() => setAdvanceRatio('50')}
                  className={`px-2 py-0.5 text-xs rounded-md font-medium cursor-pointer ${
                    advancePreset === '50'
                      ? 'bg-[#1E3A78] dark:bg-blue-600 text-white'
                      : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                  }`}
                >
                  50 % záloha
                </button>
              </div>
            </div>

            <div className="relative max-w-xs">
              <input
                type="text"
                inputMode="numeric"
                value={formattedDisplayAdvance}
                onChange={handleAdvanceChange}
                placeholder="0 (bez zálohy)"
                className="w-full pl-3.5 pr-12 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-950 focus:border-[#1E3A78] dark:focus:border-blue-500"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 pointer-events-none">
                Kč
              </span>
            </div>
            {formData.advanceAmount !== '' && typeof formData.advanceAmount === 'number' && formData.advanceAmount > 0 && (
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-1.5">
                Předem bude vystavena zálohová faktura na <strong>{formatCurrency(formData.advanceAmount)}</strong>.
                Doplatek po předání díla bude činit <strong>{formatCurrency(Number(formData.price || 0) - formData.advanceAmount)}</strong>.
              </p>
            )}
            {errors.advanceAmount && (
              <p className="text-xs text-rose-600 mt-1 font-medium">{errors.advanceAmount}</p>
            )}
          </div>

          {/* Shrnutí balíčku: Smlouva + Protokol + Faktura s QR kódem */}
          <div className="rounded-lg bg-slate-50 dark:bg-slate-800/80 p-4 border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
              <div className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                <strong className="text-slate-900 dark:text-white font-bold">Kompletní právní balíček pro řemeslníka na 1 klik:</strong>
                <span className="block text-slate-500 dark:text-slate-400 mt-0.5">
                  1. Smlouva o dílo (§ 2586 NOZ) · 2. Předávací protokol o převzetí s vadami a nedodělky · 3. Finální faktura s QR kódem pro okamžitou platbu.
                </span>
              </div>
            </div>
          </div>

          {/* 5. Tlačítko Zobrazit náhled */}
          <div className="pt-2">
            <button
              type="submit"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-8 py-3.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 text-base font-black shadow-xs transition-all duration-150 cursor-pointer group active:scale-95"
            >
              <Eye className="w-5 h-5 group-hover:scale-110 transition-transform" />
              <span>Zobrazit hotové dokumenty</span>
            </button>
          </div>
          </div>
        </form>
      </div>

      {/* Pravý sloupec (Desktop Desk): Živý stavební zakázkový list a kalkulace */}
      <div className="hidden lg:block lg:col-span-4 sticky top-20 space-y-4">
        {/* Clipboard Top Clip */}
        <div className="w-24 h-3.5 bg-slate-800 dark:bg-slate-700 mx-auto rounded-t-md border-t border-x border-slate-600 shadow-sm flex items-center justify-center">
          <div className="w-12 h-1 bg-slate-900 dark:bg-slate-900 rounded-full opacity-60" />
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-300 dark:border-slate-800 shadow-md space-y-4 relative -mt-1.5">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-amber-500 shrink-0" />
              <span className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
                Stavební zakázkový list
              </span>
            </div>
            <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-slate-950 text-amber-400 border border-slate-800">
              {docKind === 'contract' ? 'SOD § 2586' : 'NABÍDKA'}
            </span>
          </div>

          {/* Celková částka - Technický displej */}
          <div className="p-4 rounded-lg bg-slate-950 text-white border border-slate-800 shadow-inner">
            <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400 font-bold block">
              Celková cena za dílo:
            </span>
            <div className="text-3xl font-black font-mono tabular-nums tracking-tight text-amber-400 mt-1">
              {totalPriceNum > 0 ? formatCurrency(totalPriceNum) : '0 Kč'}
            </div>
            {totalPriceNum > 0 && advancePriceNum > 0 && (
              <div className="mt-3 pt-3 border-t border-slate-800/80 grid grid-cols-2 gap-2 text-xs font-mono">
                <div>
                  <span className="text-slate-400 text-[10px] uppercase block">Záloha předem:</span>
                  <span className="font-bold tabular-nums text-amber-300">
                    {formatCurrency(advancePriceNum)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] uppercase block">Doplatek na stavbě:</span>
                  <span className="font-bold tabular-nums text-emerald-400">
                    {formatCurrency(remainingPriceNum)}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Detaily zakázky v tabulkovém monospace stylu */}
          <div className="space-y-2 text-xs text-slate-700 dark:text-slate-300">
            <div className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
              <span className="text-slate-400 font-medium">Objednatel:</span>
              <span className="font-bold text-slate-900 dark:text-white truncate max-w-[190px] text-right">
                {selectedClientObj ? selectedClientObj.name : 'Nevybrán'}
              </span>
            </div>

            <div className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
              <span className="text-slate-400 font-medium">Termín dokončení:</span>
              <span className="font-bold font-mono tabular-nums text-slate-900 dark:text-white">
                {formData.deliveryDate ? formatDateCs(formData.deliveryDate) : 'Není nastaven'}
              </span>
            </div>

            <div className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
              <span className="text-slate-400 font-medium">Rozpad rozpočtu:</span>
              <span className="font-bold font-mono text-slate-900 dark:text-white">
                {pricingType === 'budget' ? `${budgetItems.length} položek prací` : 'Paušální položka'}
              </span>
            </div>

            <div className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
              <span className="text-slate-400 font-medium">Zhotovitel:</span>
              <span className="font-bold text-slate-900 dark:text-white truncate max-w-[190px] text-right">
                {contractor?.name || 'Nevyplněn profil'}
              </span>
            </div>
          </div>

          {/* Kontrolní soupiska generovaných listin */}
          <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-2">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
              Generovaný balíček dokumentů:
            </span>
            <div className="space-y-1.5 text-xs">
              <div className="flex items-center gap-2 text-slate-800 dark:text-slate-200">
                <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 stroke-[2.5]" />
                <span className="font-bold">1. {docKind === 'contract' ? 'Smlouva o dílo (§ 2586 NOZ)' : 'Cenová nabídka'}</span>
              </div>
              <div className="flex items-center gap-2 text-slate-800 dark:text-slate-200">
                <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 stroke-[2.5]" />
                <span className="font-bold">2. Předávací protokol (§ 2605 NOZ)</span>
              </div>
              <div className="flex items-center gap-2 text-slate-800 dark:text-slate-200">
                <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 stroke-[2.5]" />
                <span className="font-bold">3. Faktura s SPAYD QR kódem</span>
              </div>
            </div>
          </div>

          {/* Rychlé spuštění náhledu */}
          <button
            type="button"
            onClick={(e) => handleSubmit(e as any)}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-sm shadow-xs transition-all cursor-pointer active:scale-95"
          >
            <Eye className="w-4 h-4" />
            <span>Zobrazit hotový náhled listin</span>
          </button>
        </div>
      </div>
    </div>
  </div>
);
};
