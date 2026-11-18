import React, { useMemo, useState } from 'react';
import { hasIssuedInvoice } from '../utils/invoiceNumbering';
import { FileText, FilePlus, Trash2, Download, Search, MessageSquare, RefreshCw, X } from 'lucide-react';
import { Contract } from '../types/contract';
import { formatCurrency, formatDateCs } from '../utils/numberToWordsCs';
import { exportContractToDocx } from '../utils/lazyExports';
import { getWhatsAppShareUrl } from '../utils/shareUtils';
import { DocumentType } from './ContractPreview';
import { getContractTotal, isContractPaid } from '../utils/invoiceMath';
import { getJobStage, JOB_STAGE_LABELS, JobStageKey } from '../utils/jobStage';
import { Dialog } from './Dialog';
import { matchesSearch } from '../utils/search';
import { getSiteAddress } from '../utils/siteAddress';

interface HistoryPageProps {
  contracts: Contract[];
  onOpenContract: (contract: Contract, docType?: DocumentType) => void;
  onUpdateContract?: (updated: Contract) => void;
  onDeleteContract: (id: string) => void;
  onNewContract: () => void;
  onSyncSignatures?: () => Promise<void> | void;
  onSwitchView?: () => void;
}

type DocFilter = 'all' | 'contract' | 'quote';

const outlineButton =
  'min-h-11 px-4 inline-flex items-center justify-center gap-2 rounded-md border-[1.5px] border-slate-900 dark:border-slate-500 text-slate-900 dark:text-slate-100 font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors disabled:opacity-60 disabled:cursor-default';
const smallAction =
  'min-h-11 min-w-11 px-3 inline-flex items-center justify-center gap-1.5 rounded-md border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-medium hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors disabled:opacity-60';
const textLink = 'min-h-11 inline-flex items-center font-medium text-blue-600 dark:text-blue-300 underline underline-offset-2 cursor-pointer';
const fieldInput =
  'min-h-11 rounded-md border-[1.5px] border-slate-900 dark:border-slate-500 bg-white dark:bg-slate-950 text-slate-900 dark:text-white';

const plural = (n: number, one: string, few: string, many: string) => `${n} ${n === 1 ? one : n >= 2 && n <= 4 ? few : many}`;

export const HistoryPage: React.FC<HistoryPageProps> = ({
  contracts,
  onOpenContract,
  onDeleteContract,
  onNewContract,
  onSyncSignatures,
  onSwitchView,
}) => {
  const [isSyncing, setIsSyncing] = useState(false);
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [exportError, setExportError] = useState(false);
  const [contractToDelete, setContractToDelete] = useState<Contract | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [stageFilter, setStageFilter] = useState<'all' | JobStageKey>('all');
  const [docFilter, setDocFilter] = useState<DocFilter>('all');

  const docs = useMemo(
    () =>
      contracts
        .map((contract) => ({ contract, stage: getJobStage(contract), isQuote: contract.docKind === 'quote' }))
        .sort((a, b) => (b.contract.createdAt || '').localeCompare(a.contract.createdAt || '')),
    [contracts],
  );

  const counts = { all: docs.length, contract: docs.filter((d) => !d.isQuote).length, quote: docs.filter((d) => d.isQuote).length };
  const contractsVolume = docs.filter((d) => !d.isQuote).reduce((sum, d) => sum + getContractTotal(d.contract), 0);
  const paidVolume = docs
    .filter((d) => !d.isQuote && isContractPaid(d.contract))
    .reduce((sum, d) => sum + getContractTotal(d.contract), 0);

  const q = searchTerm.trim();
  const filtered = docs.filter(({ contract, stage, isQuote }) => {
    if (docFilter !== 'all' && (docFilter === 'quote') !== isQuote) return false;
    if (stageFilter !== 'all' && stage.key !== stageFilter) return false;
    if (!q) return true;
    return matchesSearch(
      [contract.client?.name, contract.workDescription, contract.contractNumber, contract.quoteNumber, contract.invoiceNumber, getSiteAddress(contract)],
      q,
    );
  });

  const handleDownloadDocx = async (contract: Contract) => {
    setExportingId(contract.id);
    setExportError(false);
    try {
      await exportContractToDocx(contract);
    } catch (err) {
      console.error(err);
      setExportError(true);
    } finally {
      setExportingId(null);
    }
  };

  const handleManualSync = async () => {
    if (!onSyncSignatures) return;
    setIsSyncing(true);
    try {
      await onSyncSignatures();
    } finally {
      setIsSyncing(false);
    }
  };

  const tabs: { key: DocFilter; label: string }[] = [
    { key: 'all', label: 'Vše' },
    { key: 'contract', label: 'Smlouvy' },
    { key: 'quote', label: 'Nabídky' },
  ];

  return (
    <div className="max-w-[1180px] mx-auto pb-16 space-y-7 text-[15px] leading-snug">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl sm:text-[44px] font-bold leading-[1.05] text-slate-900 dark:text-white">Archiv</h1>
          <div className="mt-1 text-slate-600 dark:text-slate-400">
            {docs.length === 0
              ? 'Všechny uložené smlouvy a cenové nabídky.'
              : `${plural(counts.contract, 'smlouva', 'smlouvy', 'smluv')} za ${formatCurrency(contractsVolume)}, z toho zaplaceno ${formatCurrency(paidVolume)}${
                  counts.quote ? `; ${plural(counts.quote, 'nabídka', 'nabídky', 'nabídek')}` : ''
                }.`}
          </div>
        </div>
        {onSyncSignatures && docs.length > 0 && (
          <button type="button" onClick={handleManualSync} disabled={isSyncing} className={`${outlineButton} w-full sm:w-auto`}>
            <RefreshCw className={`w-[18px] h-[18px] ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Ověřuji podpisy…' : 'Ověřit online podpisy'}</span>
          </button>
        )}
      </header>

      {docs.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md px-5 py-5 flex flex-wrap items-center justify-between gap-3">
          <span className="text-slate-600 dark:text-slate-300">
            Zatím tu nic není. Smlouva se sem uloží z náhledu dokumentů.
          </span>
          <button type="button" onClick={onNewContract} className={outlineButton}>
            <FilePlus className="w-[18px] h-[18px]" />
            <span>Nová smlouva</span>
          </button>
        </div>
      ) : (
        <>
          <div className="space-y-4">
            <div className="border-b border-slate-900 dark:border-slate-500 overflow-x-auto">
              <div role="tablist" aria-label="Druh dokumentu" className="flex gap-1 min-w-max">
                {tabs.map((t) => {
                  const active = docFilter === t.key;
                  return (
                    <button
                      key={t.key}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => setDocFilter(t.key)}
                      className={`min-h-11 px-3.5 inline-flex items-center gap-2 font-semibold cursor-pointer border-b-[3px] -mb-px transition-colors ${
                        active
                          ? 'border-slate-900 dark:border-white text-slate-900 dark:text-white'
                          : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      <span>{t.label}</span>
                      <span className="font-display tabular-nums text-[17px]">{counts[t.key]}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <div className="relative w-full sm:w-80">
                <label htmlFor="archiv-hledat" className="sr-only">
                  Hledat v archivu
                </label>
                <Search className="w-[18px] h-[18px] absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-600 dark:text-slate-400 pointer-events-none" />
                <input
                  id="archiv-hledat"
                  type="search"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Hledat klienta, dílo, číslo dokladu"
                  className={`${fieldInput} w-full pl-10 pr-11 [&::-webkit-search-cancel-button]:hidden`}
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm('')}
                    aria-label="Vymazat hledání"
                    className="absolute right-0 top-0 w-11 h-11 inline-flex items-center justify-center text-slate-900 dark:text-slate-100 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              <label htmlFor="archiv-faze" className="sr-only">
                Fáze zakázky
              </label>
              <select
                id="archiv-faze"
                value={stageFilter}
                onChange={(e) => setStageFilter(e.target.value as 'all' | JobStageKey)}
                className={`${fieldInput} px-3 cursor-pointer flex-1 sm:flex-none`}
              >
                <option value="all">Všechny fáze</option>
                {JOB_STAGE_LABELS.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.label}
                  </option>
                ))}
              </select>
              {onSwitchView && (
                <button type="button" onClick={onSwitchView} className={`${textLink} sm:ml-auto`}>
                  Zakázky podle fází
                </button>
              )}
            </div>
          </div>

          {exportError && (
            <p role="alert" className="font-medium text-rose-700 dark:text-rose-400">
              Soubor pro Word se nepodařilo vytvořit. Zkuste to znovu.
            </p>
          )}

          <section
            aria-label="Dokumenty"
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md divide-y divide-slate-100 dark:divide-slate-800"
          >
            {filtered.length === 0 && (
              <div className="px-5 py-5 text-slate-600 dark:text-slate-300">Výběru neodpovídá žádný dokument.</div>
            )}
            {filtered.map(({ contract, stage, isQuote }) => {
              const total = getContractTotal(contract);
              const hasContractorSign = !!contract.contractorSignature;
              const hasClientSign = !!contract.clientSignature;
              const isInvoiceOnly = contract.docKind === 'invoice';
              const signText = isQuote || isInvoiceOnly || stage.key === 'inquiry'
                ? ''
                : hasContractorSign && hasClientSign
                  ? 'podepsáno oběma stranami'
                  : hasClientSign
                    ? 'podepsal klient'
                    : hasContractorSign
                      ? 'čeká na podpis klienta'
                      : 'bez podpisu';
              const extras = [
                contract.amendments?.length ? plural(contract.amendments.length, 'dodatek', 'dodatky', 'dodatků') : '',
                contract.cashReceipts?.length ? plural(contract.cashReceipts.length, 'pokladní doklad', 'pokladní doklady', 'pokladních dokladů') : '',
                contract.photos?.length ? plural(contract.photos.length, 'fotka', 'fotky', 'fotek') : '',
                contract.siteLogs?.length ? plural(contract.siteLogs.length, 'zápis v deníku', 'zápisy v deníku', 'zápisů v deníku') : '',
                contract.warranty ? `záruka ${contract.warranty.warrantyPeriodMonths} měsíců` : '',
              ].filter(Boolean);
              const number = isQuote
                ? contract.quoteNumber || 'nabídka'
                : isInvoiceOnly
                  ? contract.invoiceNumber ? `FA-${contract.invoiceNumber}` : 'zatím nevystavená'
                  : contract.contractNumber;
              return (
                <div key={contract.id} className="px-5 py-[18px] space-y-2.5">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <div className="min-w-0 flex-1 basis-56">
                      <button
                        type="button"
                        onClick={() => onOpenContract(contract)}
                        className="text-left text-[17px] font-semibold text-slate-900 dark:text-white hover:underline underline-offset-2 cursor-pointer"
                      >
                        {contract.client?.name || 'Klient bez jména'}
                      </button>
                      <div className="text-slate-600 dark:text-slate-400 line-clamp-2">
                        {stage.key === 'inquiry' ? 'Poptávka' : isQuote ? 'Nabídka' : isInvoiceOnly ? 'Faktura' : 'Smlouva'} {number}, {contract.workDescription}
                        {contract.invoiceCancelledAt ? ', faktura stornovaná' : ''}
                      </div>
                    </div>
                    <div className="w-full sm:w-auto flex sm:block items-baseline justify-between gap-3 sm:text-right">
                      <div className="text-[22px] whitespace-nowrap text-slate-900 dark:text-white font-display font-semibold tabular-nums">
                        {total > 0 ? formatCurrency(total) : 'bez ceny'}
                      </div>
                      {contract.deliveryDate && stage.key !== 'inquiry' && (
                        <div className="text-slate-600 dark:text-slate-400">termín {formatDateCs(contract.deliveryDate)}</div>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2.5">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-slate-600 dark:text-slate-400">
                      <span
                        className={`font-semibold px-2.5 py-0.5 rounded-sm ${
                          stage.key === 'paid' ? 'bg-emerald-700 text-white' : 'border border-slate-500 text-slate-900 dark:text-slate-100'
                        }`}
                      >
                        {stage.label}
                      </span>
                      {[signText, ...extras].filter(Boolean).join(', ')}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button type="button" onClick={() => onOpenContract(contract)} className={`${smallAction} !border-slate-900 dark:!border-slate-400 font-semibold`}>
                        <FileText className="w-4 h-4" />
                        <span>Otevřít</span>
                      </button>
                      {!isInvoiceOnly && (
                      <button
                        type="button"
                        onClick={() => handleDownloadDocx(contract)}
                        disabled={exportingId === contract.id}
                        className={smallAction}
                        aria-label={`Stáhnout ${isQuote ? 'nabídku' : 'smlouvu'} ${number} ve Wordu`}
                      >
                        <Download className="w-4 h-4" />
                        <span className="hidden sm:inline">{exportingId === contract.id ? 'Připravuji…' : 'Word'}</span>
                      </button>
                      )}
                      <a
                        href={getWhatsAppShareUrl(contract, 'smlouva')}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={smallAction}
                        aria-label={`Napsat zprávu: ${contract.client?.name}`}
                        title="Napsat zprávu"
                      >
                        <MessageSquare className="w-4 h-4" />
                      </a>
                      <button
                        type="button"
                        onClick={() => setContractToDelete(contract)}
                        className={smallAction}
                        aria-label={`Smazat ${isQuote ? 'nabídku' : 'smlouvu'} ${number}`}
                        title="Smazat"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </section>
        </>
      )}

      {contractToDelete && (
        <Dialog
          title={hasIssuedInvoice(contractToDelete) ? 'Zakázku nejde smazat' : contractToDelete.docKind === 'quote' ? 'Smazat nabídku?' : 'Smazat zakázku?'}
          onClose={() => setContractToDelete(null)}
        >
          {hasIssuedInvoice(contractToDelete) ? (
          <div className="space-y-5">
            <p className="text-slate-900 dark:text-slate-100">
              K zakázce pro klienta <span className="font-semibold">{contractToDelete.client?.name}</span> je vystavená faktura.
              Vystavené faktury musí zůstat v evidenci, aby řada čísel neměla díry. Pokud se zakázka nekoná, otevřete fakturu
              a zvolte Stornovat.
            </p>
            <div className="flex flex-wrap justify-end gap-2.5">
              <button type="button" onClick={() => setContractToDelete(null)} className={outlineButton}>
                Rozumím
              </button>
            </div>
          </div>
          ) : (
          <div className="space-y-5">
            <p className="text-slate-900 dark:text-slate-100">
              Zakázka pro klienta <span className="font-semibold">{contractToDelete.client?.name}</span> zmizí i se vším, co k ní
              patří: s fakturou, dodatky, protokoly, náklady a fotkami. Smazání nejde vrátit.
            </p>
            <div className="flex flex-wrap justify-end gap-2.5">
              <button type="button" onClick={() => setContractToDelete(null)} className={outlineButton}>
                Ponechat
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteContract(contractToDelete.id);
                  setContractToDelete(null);
                }}
                className="min-h-11 px-4 inline-flex items-center justify-center gap-2 rounded-md border-[1.5px] border-rose-700 bg-rose-700 hover:bg-rose-800 text-white font-semibold cursor-pointer transition-colors"
              >
                <Trash2 className="w-[18px] h-[18px]" />
                <span>Smazat</span>
              </button>
            </div>
          </div>
          )}
        </Dialog>
      )}
    </div>
  );
};
