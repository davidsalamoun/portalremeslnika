import React, { useMemo, useState } from 'react';
import { getSiteAddress } from '../utils/siteAddress';
import { Plus, ArrowRight, ArrowLeft, Phone, MessageSquare, Search, X } from 'lucide-react';
import { matchesSearch } from '../utils/search';
import { getFinalInvoiceNumber, getAdvanceInvoiceNumber } from '../utils/invoiceNumbering';
import { Contract, Client } from '../types/contract';
import { formatCurrency, formatDateCs } from '../utils/numberToWordsCs';
import { getWhatsAppShareUrl } from '../utils/shareUtils';
import { getContractTotal, todayIso } from '../utils/invoiceMath';
import { getJobStage, getStageMoves, moveJobStage, JOB_STAGE_LABELS, JobStageKey } from '../utils/jobStage';
import { Metr } from './Logo';
import { Dialog } from './Dialog';

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

type StageFilter = 'active' | JobStageKey;

const FORWARD_LABEL: Record<JobStageKey, string> = {
  inquiry: 'Poptávka',
  quote: 'Nabídka odeslána',
  contract: 'Smlouva uzavřena',
  realization: 'Zahájit realizaci',
  handover: 'Dílo předáno',
  paid: 'Zaplaceno',
};

const listBox =
  'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md divide-y divide-slate-100 dark:divide-slate-800';
const outlineButton =
  'min-h-11 px-4 inline-flex items-center justify-center gap-2 rounded-md border-[1.5px] border-slate-900 dark:border-slate-500 text-slate-900 dark:text-slate-100 font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors';
const primaryButton =
  'min-h-11 px-4 inline-flex items-center justify-center gap-2 rounded-md border-[1.5px] border-slate-900 bg-amber-400 hover:bg-amber-500 text-slate-900 font-semibold cursor-pointer transition-colors';
const smallAction =
  'min-h-11 min-w-11 px-3 inline-flex items-center justify-center gap-1.5 rounded-md border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-medium hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors';
const textLink = 'min-h-11 inline-flex items-center font-medium text-blue-600 dark:text-blue-300 underline underline-offset-2 cursor-pointer';
const fieldLabel = 'block font-semibold text-slate-900 dark:text-slate-100 mb-1.5';
const fieldInput =
  'w-full min-h-12 px-3.5 py-2 rounded-md border-[1.5px] border-slate-900 dark:border-slate-500 bg-white dark:bg-slate-950 text-slate-900 dark:text-white';

export const LeadsPipelinePage: React.FC<LeadsPipelinePageProps> = ({
  contracts,
  onUpdateContract,
  onOpenContract,
  onNewContract,
  onAddQuickLead,
  onSwitchView,
}) => {
  const [filter, setFilter] = useState<StageFilter>('active');
  const [searchTerm, setSearchTerm] = useState('');
  const [isQuickLeadModalOpen, setIsQuickLeadModalOpen] = useState(false);

  // Formulář pro rychlou poptávku
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientAddress, setClientAddress] = useState('');
  const [workDescription, setWorkDescription] = useState('');
  const [estimatedPrice, setEstimatedPrice] = useState('');
  const [inspectionDate, setInspectionDate] = useState('');

  // Zakázky s fází, nejdál pokročilé nahoře
  const jobs = useMemo(
    () =>
      contracts
        .map((contract) => ({ contract, stage: getJobStage(contract) }))
        .sort(
          (a, b) =>
            b.stage.percent - a.stage.percent ||
            (a.contract.deliveryDate || '').localeCompare(b.contract.deliveryDate || ''),
        ),
    [contracts],
  );

  const counts = useMemo(() => {
    const map = { active: 0 } as Record<StageFilter, number>;
    JOB_STAGE_LABELS.forEach((s) => (map[s.key] = 0));
    jobs.forEach(({ stage }) => {
      map[stage.key] += 1;
      if (stage.key !== 'paid') map.active += 1;
    });
    return map;
  }, [jobs]);

  // Hledá se ve všech fázích (i v zaplacených), výběr fáze se při hledání neuplatní
  const query = searchTerm.trim();
  const searching = query.length > 0;
  const shown = searching
    ? jobs.filter(({ contract }) =>
        matchesSearch(
          [
            contract.client?.name,
            contract.client?.phone,
            contract.client?.ico,
            getSiteAddress(contract),
            contract.workDescription,
            contract.contractNumber,
            contract.quoteNumber,
            getFinalInvoiceNumber(contract),
            getAdvanceInvoiceNumber(contract),
          ],
          query
        )
      )
    : jobs.filter(({ stage }) => (filter === 'active' ? stage.key !== 'paid' : stage.key === filter));
  const shownSum = shown.reduce((sum, { contract }) => sum + getContractTotal(contract), 0);

  const filters: { key: StageFilter; label: string }[] = [{ key: 'active', label: 'Rozpracované' }, ...JOB_STAGE_LABELS];

  const handleMove = (contract: Contract, target: JobStageKey) => {
    onUpdateContract(moveJobStage(contract, target, todayIso()));
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
    setEstimatedPrice('');
    setInspectionDate('');
    setIsQuickLeadModalOpen(false);
  };

  const countWord = (n: number) => (n === 1 ? 'zakázka' : n >= 2 && n <= 4 ? 'zakázky' : 'zakázek');

  return (
    <div className="max-w-[1180px] mx-auto pb-16 space-y-7 text-[15px] leading-snug">
      {/* Hlavička */}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl sm:text-[44px] font-bold leading-[1.05] text-slate-900 dark:text-white">Zakázky</h1>
          <div className="mt-1 text-slate-600 dark:text-slate-400">Od poptávky po zaplacení. Fázi posunete tlačítkem u zakázky.</div>
        </div>
        <div className="w-full sm:w-auto flex flex-wrap gap-2.5">
          <button type="button" onClick={() => setIsQuickLeadModalOpen(true)} className={`${primaryButton} flex-1 sm:flex-none`}>
            <Plus className="w-[18px] h-[18px]" />
            <span>Nová poptávka</span>
          </button>
          <button type="button" onClick={onNewContract} className={`${outlineButton} flex-1 sm:flex-none`}>
            Nová smlouva
          </button>
        </div>
      </header>

      {/* Hledání ve všech zakázkách */}
      {jobs.length > 1 && (
        <div className="relative w-full sm:max-w-sm">
          <label htmlFor="zakazky-hledat" className="sr-only">
            Hledat zakázku
          </label>
          <Search className="w-[18px] h-[18px] absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-600 dark:text-slate-400 pointer-events-none" />
          <input
            id="zakazky-hledat"
            type="search"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Hledat klienta, adresu, popis, číslo"
            className="w-full min-h-11 pl-10 pr-11 rounded-md border-[1.5px] border-slate-900 dark:border-slate-500 bg-white dark:bg-slate-950 text-slate-900 dark:text-white [&::-webkit-search-cancel-button]:hidden"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              aria-label="Vymazat hledání"
              className="absolute right-0 top-0 w-11 h-11 inline-flex items-center justify-center text-slate-900 dark:text-slate-100 cursor-pointer"
            >
              <X className="w-[18px] h-[18px]" />
            </button>
          )}
        </div>
      )}

      {/* Výběr fáze */}
      <div className="border-b border-slate-900 dark:border-slate-500 overflow-x-auto">
        <div role="tablist" aria-label="Fáze zakázek" className="flex gap-1 min-w-max">
          {filters.map((f) => {
            const active = !searching && filter === f.key;
            return (
              <button
                key={f.key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => {
                  setFilter(f.key);
                  setSearchTerm('');
                }}
                className={`min-h-11 px-3.5 inline-flex items-center gap-2 font-semibold cursor-pointer border-b-[3px] -mb-px transition-colors ${
                  active
                    ? 'border-slate-900 dark:border-white text-slate-900 dark:text-white'
                    : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <span>{f.label}</span>
                <span className="font-display tabular-nums text-[17px]">{counts[f.key]}</span>
              </button>
            );
          })}
        </div>
      </div>

      <section aria-label="Seznam zakázek" className="space-y-2.5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <div className="text-slate-600 dark:text-slate-400">
            <span className="font-display font-semibold tabular-nums text-2xl text-slate-900 dark:text-white">
              {formatCurrency(shownSum)}
            </span>{' '}
            v {shown.length} {shown.length === 1 ? 'zakázce' : 'zakázkách'}
            {searching && <span>, hledáno ve všech fázích</span>}
          </div>
          {onSwitchView && (
            <button type="button" onClick={onSwitchView} className={textLink}>
              Archiv všech dokumentů
            </button>
          )}
        </div>

        <div className={listBox}>
          {shown.length === 0 && (
            <div className="px-5 py-5 flex flex-wrap items-center justify-between gap-3">
              <span className="text-slate-600 dark:text-slate-300">
                {searching
                  ? `Žádná zakázka neodpovídá „${query}“.`
                  : filter === 'active'
                    ? 'Zatím tu není žádná rozpracovaná zakázka.'
                    : 'V této fázi není žádná zakázka.'}
              </span>
              {searching ? (
                <button type="button" onClick={() => setSearchTerm('')} className={smallAction}>
                  Zrušit hledání
                </button>
              ) : (
                <button type="button" onClick={() => setIsQuickLeadModalOpen(true)} className={smallAction}>
                  <Plus className="w-4 h-4" />
                  <span>Nová poptávka</span>
                </button>
              )}
            </div>
          )}
          {shown.map(({ contract, stage }) => {
            const total = getContractTotal(contract);
            const moves = getStageMoves(contract);
            const phone = contract.client?.phone?.replace(/\s+/g, '');
            const backLabel = moves.back ? JOB_STAGE_LABELS.find((s) => s.key === moves.back)!.label : '';
            const term =
              stage.key === 'quote' && contract.quoteValidUntil
                ? `nabídka platí do ${formatDateCs(contract.quoteValidUntil)}`
                : stage.key === 'inquiry'
                  ? contract.nextStepDate
                    ? `obhlídka ${formatDateCs(contract.nextStepDate)}`
                    : ''
                  : contract.deliveryDate
                  ? `předání ${formatDateCs(contract.deliveryDate)}`
                  : '';
            return (
              <div key={contract.id} className="px-5 py-[18px] space-y-3">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <div className="min-w-0 flex-1 basis-56">
                    <button
                      type="button"
                      onClick={() => onOpenContract(contract)}
                      className="text-left text-[17px] font-semibold text-slate-900 dark:text-white hover:underline underline-offset-2 cursor-pointer"
                    >
                      {contract.workDescription || 'Zakázka bez popisu'}
                    </button>
                    <div className="text-slate-600 dark:text-slate-400">
                      {[contract.client?.name, getSiteAddress(contract), `č. ${contract.contractNumber}`].filter(Boolean).join(', ')}
                    </div>
                  </div>
                  <div className="w-full sm:w-auto flex sm:block items-baseline justify-between gap-3 sm:text-right">
                    <div className="text-[22px] text-slate-900 dark:text-white font-display font-semibold tabular-nums">
                      {total > 0 ? formatCurrency(total) : 'bez ceny'}
                    </div>
                    {term && <div className="text-slate-600 dark:text-slate-400">{term}</div>}
                  </div>
                </div>

                <Metr step={stage.index} done={stage.key === 'paid'} label={`Fáze zakázky: ${stage.label}`} />

                <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2.5">
                  <div className="font-medium text-slate-900 dark:text-slate-100">
                    <span className="font-semibold">{stage.label}</span>
                    {stage.next && stage.next !== stage.label ? `: ${stage.next}` : ''}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {phone && (
                      <a href={`tel:${phone}`} className={smallAction} aria-label={`Zavolat: ${contract.client.name}`}>
                        <Phone className="w-4 h-4" />
                        <span className="hidden sm:inline">Zavolat</span>
                      </a>
                    )}
                    <a
                      href={getWhatsAppShareUrl(contract, 'smlouva')}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={smallAction}
                      aria-label={`Napsat zprávu: ${contract.client.name}`}
                    >
                      <MessageSquare className="w-4 h-4" />
                      <span className="hidden sm:inline">Zpráva</span>
                    </a>
                    {moves.back && (
                      <button
                        type="button"
                        onClick={() => handleMove(contract, moves.back!)}
                        className={`${smallAction} !px-0 w-11`}
                        aria-label={`Vrátit do fáze ${backLabel}`}
                        title={`Vrátit do fáze ${backLabel}`}
                      >
                        <ArrowLeft className="w-4 h-4" />
                      </button>
                    )}
                    {moves.forward && (
                      <button
                        type="button"
                        onClick={() => handleMove(contract, moves.forward!)}
                        className={`${smallAction} !border-slate-900 dark:!border-slate-400 font-semibold`}
                      >
                        <span>{FORWARD_LABEL[moves.forward]}</span>
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        {shown.length > 0 && (
          <p className="text-[13px] text-slate-600 dark:text-slate-400">
            Celkem {jobs.length} {countWord(jobs.length)}, z toho {counts.paid} zaplacených.
          </p>
        )}
      </section>

      {/* Okno nové poptávky */}
      {isQuickLeadModalOpen && (
        <Dialog title="Nová poptávka" onClose={() => setIsQuickLeadModalOpen(false)}>
            <form onSubmit={handleCreateLeadSubmit} className="space-y-4">
              <div>
                <label htmlFor="lead-jmeno" className={fieldLabel}>
                  Jméno zákazníka
                </label>
                <input
                  id="lead-jmeno"
                  type="text"
                  required
                  autoFocus
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="např. Jan Novák"
                  className={fieldInput}
                />
              </div>

              <div>
                <label htmlFor="lead-popis" className={fieldLabel}>
                  Co chce udělat
                </label>
                <textarea
                  id="lead-popis"
                  rows={2}
                  required
                  value={workDescription}
                  onChange={(e) => setWorkDescription(e.target.value)}
                  placeholder="např. Rekonstrukce koupelny 6 m², obklady a dlažba"
                  className={fieldInput}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="lead-telefon" className={fieldLabel}>
                    Telefon <span className="font-normal text-slate-600 dark:text-slate-400">(nepovinné)</span>
                  </label>
                  <input
                    id="lead-telefon"
                    type="tel"
                    value={clientPhone}
                    onChange={(e) => setClientPhone(e.target.value)}
                    placeholder="+420 777 123 456"
                    className={fieldInput}
                  />
                </div>
                <div>
                  <label htmlFor="lead-cena" className={fieldLabel}>
                    Odhad v Kč <span className="font-normal text-slate-600 dark:text-slate-400">(nepovinné)</span>
                  </label>
                  <input
                    id="lead-cena"
                    type="number"
                    min="0"
                    inputMode="numeric"
                    value={estimatedPrice}
                    onChange={(e) => setEstimatedPrice(e.target.value)}
                    className={fieldInput}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="lead-adresa" className={fieldLabel}>
                  Adresa stavby <span className="font-normal text-slate-600 dark:text-slate-400">(nepovinné)</span>
                </label>
                <input
                  id="lead-adresa"
                  type="text"
                  value={clientAddress}
                  onChange={(e) => setClientAddress(e.target.value)}
                  placeholder="např. Květinová 14, Brno"
                  className={fieldInput}
                />
              </div>

              <div>
                <label htmlFor="lead-obhlidka" className={fieldLabel}>
                  Termín obhlídky <span className="font-normal text-slate-600 dark:text-slate-400">(nepovinné)</span>
                </label>
                <input
                  id="lead-obhlidka"
                  type="date"
                  value={inspectionDate}
                  onChange={(e) => setInspectionDate(e.target.value)}
                  className={fieldInput}
                />
              </div>

              <div className="pt-1 flex flex-wrap justify-end gap-2.5">
                <button type="button" onClick={() => setIsQuickLeadModalOpen(false)} className={outlineButton}>
                  Zrušit
                </button>
                <button type="submit" className={primaryButton}>
                  Uložit poptávku
                </button>
              </div>
            </form>
        </Dialog>
      )}
    </div>
  );
};
