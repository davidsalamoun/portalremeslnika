import React, { useState, useMemo } from 'react';
import {
  Kanban,
  Plus,
  ArrowRight,
  ArrowLeft,
  Calendar,
  Phone,
  MessageSquare,
  DollarSign,
  User,
  Clock,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  ChevronRight,
  FilePlus,
  FileText,
  X,
} from 'lucide-react';
import { Contract, Client, LeadStage } from '../types/contract';
import { formatCurrency, formatDateCs } from '../utils/numberToWordsCs';
import { getWhatsAppShareUrl } from '../utils/shareUtils';

interface LeadsPipelinePageProps {
  contracts: Contract[];
  clients: Client[];
  onUpdateContract: (updated: Contract) => void;
  onOpenContract: (contract: Contract) => void;
  onNewContract: () => void;
  onAddQuickLead: (leadData: {
    clientName: string;
    clientPhone: string;
    clientAddress: string;
    workDescription: string;
    estimatedPrice: number;
    inspectionDate?: string;
  }) => void;
  onSwitchView?: () => void;
}

const STAGES: { id: LeadStage; title: string; color: string; bg: string; border: string; desc: string }[] = [
  {
    id: 'inquiry',
    title: '1. Poptávka & Obhlídka',
    color: 'text-slate-800 dark:text-slate-200',
    bg: 'bg-slate-100 dark:bg-slate-800/80',
    border: 'border-slate-300 dark:border-slate-700',
    desc: 'Zákazník poptává práce, domluva zaměření',
  },
  {
    id: 'quote',
    title: '2. Cenová nabídka',
    color: 'text-blue-700 dark:text-blue-400',
    bg: 'bg-blue-50/70 dark:bg-blue-950/40',
    border: 'border-blue-200 dark:border-blue-800',
    desc: 'Rozpočet zpracován a odeslán klientovi',
  },
  {
    id: 'contract',
    title: '3. Podepsaná smlouva',
    color: 'text-amber-700 dark:text-amber-400',
    bg: 'bg-amber-50/70 dark:bg-amber-950/40',
    border: 'border-amber-200 dark:border-amber-800',
    desc: 'Schváleno, sjednána záloha a termín nástupu',
  },
  {
    id: 'realization',
    title: '4. V realizaci',
    color: 'text-orange-700 dark:text-orange-400',
    bg: 'bg-orange-50/70 dark:bg-orange-950/40',
    border: 'border-orange-200 dark:border-orange-800',
    desc: 'Právě probíhají montážní práce na stavbě',
  },
  {
    id: 'completed',
    title: '5. Předáno & Hotovo',
    color: 'text-emerald-700 dark:text-emerald-400',
    bg: 'bg-emerald-50/70 dark:bg-emerald-950/40',
    border: 'border-emerald-200 dark:border-emerald-800',
    desc: 'Dílo protokolárně předáno, vyfakturováno',
  },
];

export const LeadsPipelinePage: React.FC<LeadsPipelinePageProps> = ({
  contracts,
  clients,
  onUpdateContract,
  onOpenContract,
  onNewContract,
  onAddQuickLead,
  onSwitchView,
}) => {
  const [isQuickLeadModalOpen, setIsQuickLeadModalOpen] = useState(false);

  // Formulář pro rychlou poptávku
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientAddress, setClientAddress] = useState('');
  const [workDescription, setWorkDescription] = useState('');
  const [estimatedPrice, setEstimatedPrice] = useState<number>(35000);
  const [inspectionDate, setInspectionDate] = useState<string>('');

  // Rozřazení zakázek do fází pipeline
  const contractsByStage = useMemo(() => {
    const map: Record<LeadStage, Contract[]> = {
      inquiry: [],
      quote: [],
      contract: [],
      realization: [],
      completed: [],
    };

    contracts.forEach((c) => {
      let stage: LeadStage = 'contract';
      if (c.leadStage) {
        stage = c.leadStage;
      } else if (c.docKind === 'quote') {
        stage = 'quote';
      } else if (c.status === 'in_progress') {
        stage = 'realization';
      } else if (c.status === 'paid' || c.status === 'handover_done') {
        stage = 'completed';
      }

      if (map[stage]) {
        map[stage].push(c);
      } else {
        map.contract.push(c);
      }
    });

    return map;
  }, [contracts]);

  const handleMoveStage = (contract: Contract, direction: 'forward' | 'backward') => {
    const stageOrder: LeadStage[] = ['inquiry', 'quote', 'contract', 'realization', 'completed'];
    const currentStage = contract.leadStage || (contract.docKind === 'quote' ? 'quote' : contract.status === 'in_progress' ? 'realization' : contract.status === 'paid' ? 'completed' : 'contract');
    const currentIndex = stageOrder.indexOf(currentStage);

    let nextIndex = currentIndex;
    if (direction === 'forward' && currentIndex < stageOrder.length - 1) {
      nextIndex = currentIndex + 1;
    } else if (direction === 'backward' && currentIndex > 0) {
      nextIndex = currentIndex - 1;
    }

    if (nextIndex !== currentIndex) {
      const nextStage = stageOrder[nextIndex];
      const updated: Contract = {
        ...contract,
        leadStage: nextStage,
        status:
          nextStage === 'realization'
            ? 'in_progress'
            : nextStage === 'completed'
            ? 'paid'
            : nextStage === 'contract'
            ? 'signed'
            : 'draft',
      };
      onUpdateContract(updated);
    }
  };

  const handleCreateLeadSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName.trim() || !workDescription.trim()) return;

    onAddQuickLead({
      clientName: clientName.trim(),
      clientPhone: clientPhone.trim(),
      clientAddress: clientAddress.trim(),
      workDescription: workDescription.trim(),
      estimatedPrice: Number(estimatedPrice) || 0,
      inspectionDate: inspectionDate || undefined,
    });

    setClientName('');
    setClientPhone('');
    setClientAddress('');
    setWorkDescription('');
    setInspectionDate('');
    setIsQuickLeadModalOpen(false);
  };

  const totalPipelineValue = useMemo(() => {
    return contracts
      .filter((c) => (c.leadStage || '') !== 'completed')
      .reduce((sum, c) => sum + (c.price || 0), 0);
  }, [contracts]);

  return (
    <div className="max-w-[1400px] mx-auto pb-16 space-y-6">
      {/* Hlavička */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2.5 mb-1.5">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-slate-900 text-amber-400 flex items-center justify-center font-bold">
                <Kanban className="w-5 h-5" />
              </div>
              <span>Zakázky & Fáze staveb</span>
            </h1>
            {onSwitchView && (
              <div className="inline-flex p-1 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 text-xs">
                <button
                  type="button"
                  className="px-2.5 py-1 rounded-md font-bold bg-slate-900 text-white dark:bg-blue-600 shadow-xs flex items-center gap-1.5"
                >
                  <Kanban className="w-3.5 h-3.5" />
                  <span>Nástěnka fází</span>
                </button>
                <button
                  type="button"
                  onClick={onSwitchView}
                  className="px-2.5 py-1 rounded-md font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="Přepnout na tabulkový seznam všech smluv"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Seznam smluv</span>
                </button>
              </div>
            )}
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Přehled zakázek řemeslníka: od prvotní poptávky a obhlídky přes rozpočet a smlouvu až po předání díla.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsQuickLeadModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs sm:text-sm shadow-xs transition-all cursor-pointer active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>+ Nová poptávka</span>
          </button>
          <button
            onClick={onNewContract}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600 text-white font-bold text-xs sm:text-sm shadow-xs transition-all cursor-pointer"
          >
            <FilePlus className="w-4 h-4" />
            <span>Vytvořit smlouvu</span>
          </button>
        </div>
      </div>

      {/* Finanční lišta pipeline */}
      <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400 tracking-wider">
            Objem rozpracovaných zakázek v terénu:
          </span>
          <span className="text-xl font-black font-mono tabular-nums text-slate-900 dark:text-white">
            {formatCurrency(totalPipelineValue)}
          </span>
          <span className="text-xs font-medium text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
            {contracts.filter((c) => (c.leadStage || '') !== 'completed').length} aktivních zakázek
          </span>
        </div>

        <span className="text-xs text-slate-400 hidden md:inline">
          Posun zakázky do další fáze provedete šipkou na kartě.
        </span>
      </div>

      {/* Kanban sloupce (5 fází) */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3.5 items-start overflow-x-auto pb-4">
        {STAGES.map((stage, sIdx) => {
          const stageContracts = contractsByStage[stage.id] || [];
          const stageSum = stageContracts.reduce((s, c) => s + (c.price || 0), 0);

          return (
            <div
              key={stage.id}
              className="bg-slate-50/80 dark:bg-slate-900/60 rounded-xl p-3 border border-slate-200 dark:border-slate-800 min-w-[240px] space-y-3"
            >
              {/* Hlavička sloupce */}
              <div className="p-1 space-y-1">
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-black uppercase tracking-wider ${stage.color}`}>
                    {stage.title}
                  </span>
                  <span className="px-1.5 py-0.5 rounded text-[11px] font-mono font-bold bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                    {stageContracts.length}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs font-mono font-bold text-slate-900 dark:text-white tabular-nums pt-0.5">
                  <span>{formatCurrency(stageSum)}</span>
                </div>
              </div>

              {/* Seznam karet v dané fázi */}
              <div className="space-y-2.5">
                {stageContracts.length === 0 ? (
                  <div className="p-4 rounded-lg border border-dashed border-slate-200 dark:border-slate-800 text-center text-slate-400 text-xs py-7">
                    Žádná zakázka v této fázi
                  </div>
                ) : (
                  stageContracts.map((contract) => {
                    const whatsappUrl = getWhatsAppShareUrl(contract, 'smlouva');
                    return (
                      <div
                        key={contract.id}
                        className="bg-white dark:bg-slate-800 p-3 rounded-lg border border-slate-200 dark:border-slate-700 shadow-2xs hover:border-slate-400 dark:hover:border-slate-500 transition-all space-y-2.5"
                      >
                        <div className="flex items-start justify-between gap-1">
                          <h4
                            onClick={() => onOpenContract(contract)}
                            className="font-bold text-sm text-slate-900 dark:text-white hover:text-amber-600 dark:hover:text-amber-400 cursor-pointer truncate max-w-[170px]"
                            title={contract.client.name}
                          >
                            {contract.client.name}
                          </h4>
                          <span className="text-[10px] font-mono font-semibold px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 shrink-0">
                            #{contract.contractNumber.slice(-4)}
                          </span>
                        </div>

                        <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 leading-relaxed">
                          {contract.workDescription}
                        </p>

                        <div className="flex items-center justify-between text-xs font-bold text-slate-900 dark:text-white pt-1.5 border-t border-slate-100 dark:border-slate-700">
                          <span className="font-mono tabular-nums text-sm font-black">{formatCurrency(contract.price)}</span>
                          {contract.deliveryDate && (
                            <span className="text-[11px] font-mono text-slate-500">
                              {formatDateCs(contract.deliveryDate)}
                            </span>
                          )}
                        </div>

                        {/* Rychlý kontakt a akce */}
                        <div className="flex items-center justify-between pt-1 text-slate-500">
                          <div className="flex items-center gap-1.5">
                            {contract.client.phone && (
                              <a
                                href={`tel:${contract.client.phone}`}
                                className="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors"
                                title={`Zavolat: ${contract.client.phone}`}
                              >
                                <Phone className="w-3.5 h-3.5" />
                              </a>
                            )}
                            <a
                              href={whatsappUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 rounded-md hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-emerald-600 transition-colors"
                              title="Odeslat zprávu na WhatsApp"
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
                            </a>
                          </div>

                          {/* Šipky pro posun v pipeline */}
                          <div className="flex items-center gap-1">
                            {sIdx > 0 && (
                              <button
                                type="button"
                                onClick={() => handleMoveStage(contract, 'backward')}
                                className="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
                                title="Posunout do předchozí fáze"
                              >
                                <ArrowLeft className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {sIdx < STAGES.length - 1 && (
                              <button
                                type="button"
                                onClick={() => handleMoveStage(contract, 'forward')}
                                className="p-1.5 rounded-md bg-slate-100 dark:bg-slate-700 hover:bg-amber-500 hover:text-slate-950 text-slate-700 dark:text-slate-200 font-bold transition-colors cursor-pointer"
                                title="Posunout do další fáze"
                              >
                                <ArrowRight className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal pro rychlý lead */}
      {isQuickLeadModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in-95">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900 text-white">
              <h3 className="font-extrabold text-sm flex items-center gap-2">
                <Kanban className="w-4 h-4 text-amber-400" />
                <span>Nová poptávka / Zaměření</span>
              </h3>
              <button
                onClick={() => setIsQuickLeadModalOpen(false)}
                className="w-7 h-7 rounded-lg hover:bg-slate-800 flex items-center justify-center transition-colors cursor-pointer text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateLeadSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Jméno zákazníka *
                </label>
                <input
                  type="text"
                  required
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="např. Jan Novák"
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    Telefon
                  </label>
                  <input
                    type="tel"
                    value={clientPhone}
                    onChange={(e) => setClientPhone(e.target.value)}
                    placeholder="+420 777 123 456"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    Odhadovaná cena (Kč)
                  </label>
                  <input
                    type="number"
                    value={estimatedPrice}
                    onChange={(e) => setEstimatedPrice(Number(e.target.value))}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Adresa stavby / realizace
                </label>
                <input
                  type="text"
                  value={clientAddress}
                  onChange={(e) => setClientAddress(e.target.value)}
                  placeholder="např. Květinová 14, Brno"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Předmět prací a popis *
                </label>
                <textarea
                  rows={2}
                  required
                  value={workDescription}
                  onChange={(e) => setWorkDescription(e.target.value)}
                  placeholder="např. Rekonstrukce koupelny 6m², obklady a dlažba"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Termín obhlídky / zaměření
                </label>
                <input
                  type="date"
                  value={inspectionDate}
                  onChange={(e) => setInspectionDate(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsQuickLeadModalOpen(false)}
                  className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Zrušit
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-sm shadow-xs transition-colors cursor-pointer"
                >
                  Uložit do poptávek
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
