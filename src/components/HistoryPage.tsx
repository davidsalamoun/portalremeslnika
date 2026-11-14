import React, { useState, useRef } from 'react';
import {
  FileText,
  FilePlus,
  Trash2,
  Calendar,
  ExternalLink,
  DollarSign,
  Download,
  Search,
  PenTool,
  MessageSquare,
  TrendingUp,
  CheckCircle2,
  Clock,
  Briefcase,
  AlertCircle,
  Filter,
  ShieldCheck,
  FilePlus2,
  Banknote,
  RefreshCw,
  Kanban,
  X,
  ArrowRight,
  LayoutGrid,
  List,
} from 'lucide-react';
import { Contract, ContractStatus } from '../types/contract';
import { formatCurrency, formatDateCs } from '../utils/numberToWordsCs';
import { exportContractToDocx } from '../utils/lazyExports';
import { getStatusMeta, ALL_STATUSES } from '../utils/contractStatus';
import { getWhatsAppShareUrl } from '../utils/shareUtils';
import { DocumentType } from './ContractPreview';
import { triggerHaptic } from '../utils/haptics';

interface HistoryPageProps {
  contracts: Contract[];
  onOpenContract: (contract: Contract, docType?: DocumentType) => void;
  onUpdateContract?: (updated: Contract) => void;
  onDeleteContract: (id: string) => void;
  onNewContract: () => void;
  onSyncSignatures?: () => Promise<void> | void;
  onSwitchView?: () => void;
}

export const HistoryPage: React.FC<HistoryPageProps> = ({
  contracts,
  onOpenContract,
  onUpdateContract,
  onDeleteContract,
  onNewContract,
  onSyncSignatures,
  onSwitchView,
}) => {
  const [isSyncing, setIsSyncing] = useState(false);
  const [contractToDelete, setContractToDelete] = useState<Contract | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | ContractStatus>('all');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [docFilter, setDocFilter] = useState<'all' | 'contract' | 'quote'>('all');

  // Finanční metriky
  const totalVolume = contracts.reduce((acc, c) => acc + (c.price || 0), 0);
  const paidContracts = contracts.filter((c) => c.status === 'paid');
  const paidVolume = paidContracts.reduce((acc, c) => acc + (c.price || 0), 0);
  const pendingVolume = totalVolume - paidVolume;
  const inProgressCount = contracts.filter((c) => c.status === 'in_progress').length;

  const filteredContracts = contracts.filter((c) => {
    const matchesSearch =
      c.client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.workDescription.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.contractNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.quoteNumber && c.quoteNumber.toLowerCase().includes(searchTerm.toLowerCase()));

    if (!matchesSearch) return false;
    if (docFilter !== 'all') {
      const kind = c.docKind || 'contract';
      if (kind !== docFilter) return false;
    }
    if (statusFilter === 'all') return true;
    return (c.status || 'draft') === statusFilter;
  });

  const confirmDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (contractToDelete) {
      onDeleteContract(contractToDelete.id);
      setContractToDelete(null);
    }
  };

  const handleDownloadDocxDirect = async (e: React.MouseEvent, contract: Contract) => {
    e.stopPropagation();
    try {
      await exportContractToDocx(contract);
    } catch (err) {
      console.error(err);
    }
  };

  const handleQuickStatusChange = (e: React.ChangeEvent<HTMLSelectElement>, contract: Contract) => {
    e.stopPropagation();
    const nextStatus = e.target.value as ContractStatus;
    const updated = { ...contract, status: nextStatus };
    onUpdateContract?.(updated);
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

  return (
    <div className="max-w-[900px] mx-auto pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <div className="flex flex-wrap items-center gap-2.5 mb-1.5">
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
              Zakázky & Smlouvy
            </h1>
            {onSwitchView && (
              <div className="inline-flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
                <button
                  type="button"
                  onClick={onSwitchView}
                  className="px-2.5 py-1 rounded-lg font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="Přepnout na přehlednou nástěnku (Kanban pipeline)"
                >
                  <Kanban className="w-3.5 h-3.5" />
                  <span>Nástěnka fází</span>
                </button>
                <button
                  type="button"
                  className="px-2.5 py-1 rounded-lg font-bold bg-white dark:bg-slate-900 text-[#1E3A78] dark:text-blue-300 shadow-xs flex items-center gap-1.5"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Seznam smluv</span>
                </button>
              </div>
            )}
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Přehled smluv, stavů rozpracovanosti, digitálních podpisů a fakturace.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {onSyncSignatures && (
            <button
              type="button"
              onClick={handleManualSync}
              disabled={isSyncing}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/80 text-slate-700 dark:text-slate-200 text-xs sm:text-sm font-semibold border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer shadow-xs"
              title="Zkontrolovat v cloudu, zda klienti podepsali smlouvy na dálku"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-blue-600' : 'text-slate-500'}`} />
              <span>{isSyncing ? 'Ověřuji...' : 'Ověřit podpisy'}</span>
            </button>
          )}

          <button
            onClick={onNewContract}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 text-sm font-black shadow-xs transition-colors cursor-pointer active:scale-95"
          >
            <FilePlus className="w-4 h-4" />
            <span>+ Nová smlouva</span>
          </button>
        </div>
      </div>

      {/* Finanční přehled (Metrics Dashboard) */}
      {contracts.length > 0 && (
        <>
          {/* Mobilní kompaktní lišta (1 řádek, 3 statistiky bez plýtvání místem) */}
          <div className="sm:hidden grid grid-cols-3 gap-2 bg-white dark:bg-slate-900 rounded-xl p-3 border border-slate-200 dark:border-slate-800 shadow-xs mb-4">
            <div className="text-center border-r border-slate-200 dark:border-slate-800 pr-1">
              <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">Celkem</p>
              <p className="text-xs font-mono font-bold tabular-nums text-slate-900 dark:text-white mt-0.5 truncate">
                {formatCurrency(totalVolume)}
              </p>
              <p className="text-[10px] text-slate-400">{contracts.length} zakázek</p>
            </div>
            <div className="text-center border-r border-slate-200 dark:border-slate-800 px-1">
              <p className="text-[10px] text-amber-600 dark:text-amber-400 font-bold uppercase tracking-wider">K úhradě</p>
              <p className="text-xs font-mono font-bold tabular-nums text-amber-700 dark:text-amber-300 mt-0.5 truncate">
                {formatCurrency(pendingVolume)}
              </p>
              <p className="text-[10px] text-slate-400">{inProgressCount} v běhu</p>
            </div>
            <div className="text-center pl-1">
              <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold uppercase tracking-wider">Zaplaceno</p>
              <p className="text-xs font-mono font-bold tabular-nums text-emerald-700 dark:text-emerald-300 mt-0.5 truncate">
                {formatCurrency(paidVolume)}
              </p>
              <p className="text-[10px] text-slate-400">{paidContracts.length} uhrazeno</p>
            </div>
          </div>

          {/* Desktop/Tablet 3 plnohodnotné karty */}
          <div className="hidden sm:grid sm:grid-cols-3 gap-3.5 mb-6">
            <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">Celkový objem zakázek</p>
                <h3 className="text-xl font-mono font-black tabular-nums text-slate-900 dark:text-white mt-1">
                  {formatCurrency(totalVolume)}
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">{contracts.length} zakázek celkem</p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center font-bold">
                <Briefcase className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between">
              <div>
                <p className="text-xs text-amber-600 dark:text-amber-400 font-bold uppercase tracking-wider">K dokončení / úhradě</p>
                <h3 className="text-xl font-mono font-black tabular-nums text-slate-900 dark:text-white mt-1">
                  {formatCurrency(pendingVolume)}
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">{inProgressCount} zakázek v realizaci</p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-amber-50 dark:bg-amber-950/80 text-amber-700 dark:text-amber-400 flex items-center justify-center font-bold">
                <Clock className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between">
              <div>
                <p className="text-xs text-emerald-600 dark:text-emerald-400 font-bold uppercase tracking-wider">Zaplaceno na účet</p>
                <h3 className="text-xl font-mono font-black tabular-nums text-emerald-600 dark:text-emerald-400 mt-1">
                  {formatCurrency(paidVolume)}
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">{paidContracts.length} uhrazených smluv</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 flex items-center justify-center font-bold">
                <CheckCircle2 className="w-5 h-5" />
              </div>
            </div>
          </div>
        </>
      )}

      {/* Prázdný stav */}
      {contracts.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-xl p-10 sm:p-14 border-2 border-dashed border-slate-300 dark:border-slate-700 text-center flex flex-col items-center justify-center">
          <div className="w-16 h-16 rounded-full bg-blue-50 dark:bg-blue-950/80 text-[#1E3A78] dark:text-blue-300 flex items-center justify-center mb-4">
            <FileText className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">Zatím žádné uložené smlouvy</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mb-6">
            Vytvořte smlouvu a v náhledu klikněte na „Uložit do historie“. Smlouvy zůstanou uložené ve vašem účtu.
          </p>
          <button
            onClick={onNewContract}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#1E3A78] dark:bg-blue-600 hover:bg-[#162c5c] dark:hover:bg-blue-500 text-white text-sm font-semibold shadow-md shadow-blue-900/10 transition-colors cursor-pointer"
          >
            <FilePlus className="w-4 h-4" />
            <span>Vytvořit první smlouvu</span>
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Filtry podle typu dokumentu, workflow stavu a vyhledávání */}
          <div className="space-y-2.5">
            {/* Document Kind Tabs */}
            <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl w-fit text-xs">
              <button
                onClick={() => setDocFilter('all')}
                className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                  docFilter === 'all'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                Všechny dokumenty ({contracts.length})
              </button>
              <button
                onClick={() => setDocFilter('contract')}
                className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                  docFilter === 'contract'
                    ? 'bg-white dark:bg-slate-900 text-[#1E3A78] dark:text-blue-300 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                Smlouvy o dílo ({contracts.filter((c) => (c.docKind || 'contract') === 'contract').length})
              </button>
              <button
                onClick={() => setDocFilter('quote')}
                className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                  docFilter === 'quote'
                    ? 'bg-white dark:bg-slate-900 text-purple-700 dark:text-purple-300 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                Cenové nabídky ({contracts.filter((c) => c.docKind === 'quote').length})
              </button>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              {/* Status Filter Tabs */}
              <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 text-xs">
                <button
                  onClick={() => setStatusFilter('all')}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition-colors shrink-0 cursor-pointer ${
                    statusFilter === 'all'
                      ? 'bg-[#1E3A78] dark:bg-blue-600 text-white shadow-xs'
                      : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:bg-slate-50'
                  }`}
                >
                  Všechny stavy
                </button>
                {ALL_STATUSES.map((st) => {
                  const count = contracts.filter((c) => (c.status || 'draft') === st).length;
                  const meta = getStatusMeta(st);
                  return (
                    <button
                      key={st}
                      onClick={() => setStatusFilter(st)}
                      className={`px-3 py-1.5 rounded-lg font-semibold transition-colors shrink-0 cursor-pointer flex items-center gap-1.5 ${
                        statusFilter === st
                          ? 'bg-[#1E3A78] dark:bg-blue-600 text-white shadow-xs'
                          : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:bg-slate-50'
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full ${meta.dotColor}`} />
                      <span>{meta.shortLabel}</span>
                      <span className="opacity-75">({count})</span>
                    </button>
                  );
                })}
              </div>

              {/* Density toggle & Search Input */}
              <div className="flex items-center gap-2">
                <div className="flex items-center p-0.5 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 shrink-0">
                  <button
                    type="button"
                    onClick={() => setViewMode('cards')}
                    className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                      viewMode === 'cards'
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                        : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
                    }`}
                    title="Karty zakázek (dotykový pohled)"
                  >
                    <LayoutGrid className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('table')}
                    className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                      viewMode === 'table'
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                        : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
                    }`}
                    title="Kompaktní tabulka (vysoká hustota dat)"
                  >
                    <List className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="relative sm:w-60 shrink-0">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Hledat zakázku..."
                    className="w-full pl-9 pr-8 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-950"
                  />
                  {searchTerm && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchTerm('');
                        searchInputRef.current?.blur();
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg cursor-pointer"
                      title="Vymazat hledání"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Seznam zakázek: Tabulka nebo Karty */}
          {viewMode === 'table' ? (
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 uppercase font-semibold text-[11px] border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3">Doklad</th>
                    <th className="py-2.5 px-3">Klient</th>
                    <th className="py-2.5 px-3 hidden md:table-cell">Předmět díla</th>
                    <th className="py-2.5 px-3 hidden sm:table-cell">Termín</th>
                    <th className="py-2.5 px-3 text-right">Cena bez DPH</th>
                    <th className="py-2.5 px-3">Stav</th>
                    <th className="py-2.5 px-3 text-right">Akce</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredContracts.map((contract) => {
                    const isQuote = contract.docKind === 'quote';
                    const statusMeta = getStatusMeta(contract.status);
                    return (
                      <tr
                        key={contract.id}
                        onClick={() => onOpenContract(contract)}
                        className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 cursor-pointer transition-colors"
                      >
                        <td className="py-2.5 px-3 whitespace-nowrap font-mono font-semibold text-slate-900 dark:text-white">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] ${isQuote ? 'bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300' : 'bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300'}`}>
                            {isQuote ? (contract.quoteNumber || 'Nabídka') : (contract.contractNumber || 'SOD')}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-medium text-slate-900 dark:text-white whitespace-nowrap">
                          {contract.client.name}
                        </td>
                        <td className="py-2.5 px-3 text-slate-500 dark:text-slate-400 hidden md:table-cell max-w-xs truncate">
                          {contract.workDescription}
                        </td>
                        <td className="py-2.5 px-3 text-slate-500 dark:text-slate-400 hidden sm:table-cell whitespace-nowrap">
                          {contract.deliveryDate ? formatDateCs(contract.deliveryDate) : '—'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold tabular-nums text-slate-900 dark:text-white whitespace-nowrap">
                          {formatCurrency(contract.price)}
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium border ${statusMeta.badgeBg} ${statusMeta.badgeText} ${statusMeta.badgeBorder}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${statusMeta.dotColor}`} />
                            <span>{statusMeta.shortLabel}</span>
                          </span>
                        </td>
                        <td
                          onClick={(e) => e.stopPropagation()}
                          className="py-2.5 px-3 text-right whitespace-nowrap"
                        >
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={(e) => handleDownloadDocxDirect(e, contract)}
                              className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer"
                              title="Stáhnout Word (.docx)"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setContractToDelete(contract)}
                              className="p-1 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                              title="Smazat"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => onOpenContract(contract, 'smlouva')}
                              className="p-1 text-blue-600 dark:text-blue-400 hover:underline text-xs font-semibold cursor-pointer"
                            >
                              Detail
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3.5">
              {filteredContracts.map((contract) => {
                const isQuote = contract.docKind === 'quote';
                const statusMeta = getStatusMeta(contract.status);
                const hasContractorSign = !!contract.contractorSignature;
                const hasClientSign = !!contract.clientSignature;
                const photoCount = contract.photos?.length || 0;
                const amendCount = contract.amendments?.length || 0;
                const receiptCount = contract.cashReceipts?.length || 0;
                const itemCount = contract.items?.length || 0;
                const expenseCount = contract.expenses?.length || 0;
                const totalExpenses = (contract.expenses || []).reduce((s, e) => s + (e.amount || 0), 0);
                const amendDiffSum = (contract.amendments || []).reduce((s, a) => s + (a.priceDifference || 0), 0);
                const netProfit = contract.price + amendDiffSum - totalExpenses;
                const tripCount = contract.trips?.length || 0;
                const totalTripsKm = (contract.trips || []).reduce((s, t) => s + (t.distanceKm || 0), 0);

                return (
                  <div
                    key={contract.id}
                    onClick={() => onOpenContract(contract)}
                    className="bg-white dark:bg-slate-900 rounded-xl p-4 sm:p-5 shadow-xs border border-slate-200 dark:border-slate-800 hover:border-slate-400 dark:hover:border-slate-600 hover:shadow-xs transition-all cursor-pointer group flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    <div className="space-y-2 flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        {isQuote ? (
                          <span className="text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700 flex items-center gap-1 font-mono">
                            {contract.quoteNumber || 'Nabídka'}
                          </span>
                        ) : (
                          <span className="text-xs font-bold text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md font-mono border border-slate-200 dark:border-slate-700">
                            {contract.contractNumber || 'SOD'}
                          </span>
                        )}

                      {/* Status badge & selector */}
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="relative inline-flex items-center"
                      >
                        <select
                          value={contract.status || 'draft'}
                          onChange={(e) => handleQuickStatusChange(e, contract)}
                          className={`text-[11px] font-bold px-2 py-0.5 rounded-md border appearance-none pr-5 cursor-pointer ${statusMeta.badgeBg} ${statusMeta.badgeText} ${statusMeta.badgeBorder}`}
                          title="Změnit stav workflow"
                        >
                          {ALL_STATUSES.map((st) => (
                            <option key={st} value={st}>
                              {getStatusMeta(st).label}
                            </option>
                          ))}
                        </select>
                        <div className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-[9px] opacity-70">
                          ▼
                        </div>
                      </div>

                      {/* 1-klik rychlý posun na další stav zakázky */}
                      {(() => {
                        const currentSt = contract.status || 'draft';
                        let nextConfig: { label: string; next: ContractStatus; className: string } | null = null;
                        if (currentSt === 'draft') {
                          nextConfig = {
                            label: 'Označit podepsáno',
                            next: 'signed',
                            className: 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 dark:bg-blue-950/70 dark:text-blue-300 dark:border-blue-800',
                          };
                        } else if (currentSt === 'signed') {
                          nextConfig = {
                            label: 'Zahájit realizaci',
                            next: 'in_progress',
                            className: 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100 dark:bg-amber-950/70 dark:text-amber-300 dark:border-amber-800',
                          };
                        } else if (currentSt === 'handover_done') {
                          nextConfig = {
                            label: 'Označit zaplaceno',
                            next: 'paid',
                            className: 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-950/70 dark:text-emerald-300 dark:border-emerald-800',
                          };
                        }
                        if (!nextConfig) return null;
                        return (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              triggerHaptic('success');
                              const todayIso = new Date().toISOString().split('T')[0];
                              const isPaid = nextConfig!.next === 'paid';
                              const updated: Contract = {
                                ...contract,
                                status: nextConfig!.next,
                                paidDate: isPaid ? todayIso : contract.paidDate,
                              };
                              onUpdateContract?.(updated);
                            }}
                            className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md border shadow-2xs transition-all cursor-pointer active:scale-95 ${nextConfig.className}`}
                            title={`Posunout zakázku na: ${nextConfig.label}`}
                          >
                            <span>{nextConfig.label}</span>
                            <ArrowRight className="w-2.5 h-2.5 opacity-60" />
                          </button>
                        );
                      })()}

                      <h3 className="font-extrabold text-slate-900 dark:text-white text-base group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors truncate">
                        {contract.client.name}
                      </h3>
                    </div>

                    <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 pr-2">
                      {contract.workDescription}
                    </p>

                    {/* Základní údaje: Cena, Termín a Stav podpisu */}
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400 pt-1">
                      <span className="font-black font-mono tabular-nums text-slate-900 dark:text-white text-sm sm:text-base">
                        {formatCurrency(contract.price)}
                      </span>
                      <span>·</span>
                      <span className="inline-flex items-center gap-1 font-mono">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        Termín: <strong className="text-slate-800 dark:text-slate-200">{formatDateCs(contract.deliveryDate)}</strong>
                      </span>
                      <span>·</span>

                      {/* Digitální podpisy */}
                      <span className="inline-flex items-center gap-1 text-[11px]">
                        <PenTool className="w-3 h-3 text-slate-400" />
                        {hasContractorSign && hasClientSign ? (
                          <span className="text-emerald-700 dark:text-emerald-300 font-bold bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-300/80 dark:border-emerald-700/80">
                            ✓ Podepsáno oběma
                          </span>
                        ) : hasClientSign ? (
                          <span className="text-emerald-700 dark:text-emerald-300 font-bold bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-300/80 dark:border-emerald-700/80">
                            ✓ Podepsal klient
                          </span>
                        ) : hasContractorSign ? (
                          <span className="text-slate-600 dark:text-slate-400 font-medium">
                            Čeká na podpis klienta
                          </span>
                        ) : (
                          <span className="text-slate-400">Bez podpisu</span>
                        )}
                      </span>
                    </div>

                    {/* Sjednocený štítek souhrnu příslušenství zakázky */}
                    {(() => {
                      const tags: string[] = [];
                      if (amendCount > 0) tags.push(`${amendCount} ${amendCount === 1 ? 'dodatek' : 'dodatky'}`);
                      if (receiptCount > 0) tags.push(`${receiptCount} PPD hotovost`);
                      if (photoCount > 0) tags.push(`${photoCount} fotek`);
                      if (contract.siteLogs?.length) tags.push(`${contract.siteLogs.length} deník`);
                      if (contract.warranty) tags.push(`záruka ${contract.warranty.warrantyPeriodMonths}m`);
                      if (tripCount > 0) tags.push(`${totalTripsKm} km`);
                      if (tags.length === 0) return null;

                      return (
                        <div className="pt-0.5 text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5 font-medium">
                          <span className="opacity-60">Stavba:</span>
                          <span className="bg-slate-100 dark:bg-slate-800/80 px-2 py-0.5 rounded-md text-slate-700 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700/60 font-mono">
                            {tags.join(' · ')}
                          </span>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Čistá lišta akcí */}
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="flex items-center gap-1.5 shrink-0 self-end md:self-center border-t md:border-t-0 border-slate-100 dark:border-slate-800 pt-3 md:pt-0 w-full md:w-auto justify-end"
                  >
                    {/* WhatsApp přímé odeslání */}
                    <a
                      href={getWhatsAppShareUrl(contract, 'smlouva')}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 rounded-lg text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/60 border border-slate-200 dark:border-slate-800 transition-colors cursor-pointer"
                      title="Odeslat zprávu na WhatsApp klienta"
                    >
                      <MessageSquare className="w-4 h-4" />
                    </a>

                    {/* Export Word */}
                    <button
                      onClick={(e) => handleDownloadDocxDirect(e, contract)}
                      className="p-2 rounded-lg text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 transition-colors cursor-pointer"
                      title="Rychlé stažení do Wordu (.docx)"
                    >
                      <Download className="w-4 h-4" />
                    </button>

                    {/* Smazat */}
                    <button
                      onClick={() => setContractToDelete(contract)}
                      className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-slate-200 dark:border-slate-800 transition-colors cursor-pointer"
                      title="Smazat smlouvu z historie"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>

                    {/* Primární tlačítko Otevřít */}
                    <button
                      onClick={() => onOpenContract(contract, 'smlouva')}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600 text-white text-xs font-bold transition-all cursor-pointer shadow-2xs"
                    >
                      <span>Detail</span>
                      <ExternalLink className="w-3.5 h-3.5 text-amber-400" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    )}

      {/* Modal pro potvrzení smazání smlouvy */}
      {contractToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl max-w-md w-full p-6 border border-slate-200 dark:border-slate-800">
            <h3 className="font-bold text-slate-900 dark:text-white text-lg mb-2">Smazat smlouvu z historie?</h3>
            <p className="text-sm text-slate-600 dark:text-slate-300 mb-6">
              Opravdu chcete smazat smlouvu pro klienta <strong>{contractToDelete.client.name}</strong>?
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setContractToDelete(null)}
                className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Zrušit
              </button>
              <button
                onClick={confirmDelete}
                className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold transition-colors cursor-pointer"
              >
                Smazat smlouvu
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
