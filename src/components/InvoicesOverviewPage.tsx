import React, { useState, useMemo, useRef } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Search,
  MessageCircle,
  FileText,
  DollarSign,
  Send,
  Copy,
  ExternalLink,
  QrCode,
  Calendar,
  X,
  Phone,
  Mail,
  Receipt
} from 'lucide-react';
import { Contract, ContractorProfile, InvoiceReminder } from '../types/contract';
import { generateQrPaymentDataUrl } from '../utils/spayd';
import { formatCurrency } from '../utils/numberToWordsCs';
import { isInvoiceable, getFinalBalance, getFinalInvoiceDates, getInvoiceStatus } from '../utils/invoiceMath';

interface InvoicesOverviewPageProps {
  contracts: Contract[];
  contractor: ContractorProfile | null;
  onOpenContract: (contract: Contract, docType?: 'faktura' | 'smlouva') => void;
  onUpdateContract: (contract: Contract) => void;
  onToast: (type: 'success' | 'error' | 'info', message: string) => void;
}

type FilterStatus = 'all' | 'overdue' | 'pending' | 'paid';

interface InvoiceItem {
  contract: Contract;
  invoiceNumber: string;
  variableSymbol: string;
  issueDate: string;
  dueDate: string;
  amount: number;
  isPaid: boolean;
  paidDate?: string;
  isOverdue: boolean;
  daysDiff: number; // positive = overdue by N days, negative = due in N days
  clientName: string;
  clientPhone: string;
  clientEmail: string;
  scopeSummary: string;
}

export const InvoicesOverviewPage: React.FC<InvoicesOverviewPageProps> = ({
  contracts,
  contractor,
  onOpenContract,
  onUpdateContract,
  onToast,
}) => {
  const [filter, setFilter] = useState<FilterStatus>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [selectedReminderItem, setSelectedReminderItem] = useState<InvoiceItem | null>(null);
  const [reminderTone, setReminderTone] = useState<'friendly' | 'standard' | 'urgent'>('friendly');
  const [qrModalItem, setQrModalItem] = useState<{ item: InvoiceItem; qrUrl: string } | null>(null);

  // Parse contracts into invoice representations
  const invoiceItems: InvoiceItem[] = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return contracts
      .filter(isInvoiceable)
      .map((c) => {
        // Částka i data podle jednotných pravidel (utils/invoiceMath) – stejná jako na dokladu faktury
        const totalInvoicePrice = getFinalBalance(c);
        const { issueDate, dueDate } = getFinalInvoiceDates(c);
        const { isPaid, isOverdue, daysPastDue: daysDiff } = getInvoiceStatus(c);

        const invNum = c.invoiceNumber || (c.contractNumber ? `FV-${c.contractNumber}` : `FV-${c.id.slice(-6)}`);
        const vs = c.variableSymbol || c.contractNumber.replace(/\D/g, '') || c.id.replace(/\D/g, '').slice(0, 10) || '2026001';

        const description = c.workDescription || 'Stavební a řemeslné práce';

        return {
          contract: c,
          invoiceNumber: invNum,
          variableSymbol: vs,
          issueDate,
          dueDate,
          amount: totalInvoicePrice,
          isPaid,
          paidDate: c.paidDate,
          isOverdue,
          daysDiff,
          clientName: c.client?.name || 'Klient bez jména',
          clientPhone: c.client?.phone || '',
          clientEmail: c.client?.email || '',
          scopeSummary: description.length > 70 ? description.slice(0, 70) + '...' : description,
        };
      })
      .sort((a, b) => {
        if (a.isOverdue && !b.isOverdue) return -1;
        if (!a.isOverdue && b.isOverdue) return 1;
        if (a.isOverdue && b.isOverdue) return b.daysDiff - a.daysDiff;
        if (!a.isPaid && b.isPaid) return -1;
        if (a.isPaid && !b.isPaid) return 1;
        return new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime();
      });
  }, [contracts]);

  // Statistics
  const stats = useMemo(() => {
    let totalUnpaid = 0;
    let totalOverdue = 0;
    let overdueCount = 0;
    let pendingCount = 0;
    let totalPaid = 0;

    invoiceItems.forEach((inv) => {
      if (inv.isPaid) {
        totalPaid += inv.amount;
      } else {
        totalUnpaid += inv.amount;
        if (inv.isOverdue) {
          totalOverdue += inv.amount;
          overdueCount++;
        } else {
          pendingCount++;
        }
      }
    });

    return { totalUnpaid, totalOverdue, overdueCount, pendingCount, totalPaid };
  }, [invoiceItems]);

  // Filtered items
  const filteredItems = useMemo(() => {
    return invoiceItems.filter((item) => {
      if (filter === 'overdue' && !item.isOverdue) return false;
      if (filter === 'pending' && (item.isPaid || item.isOverdue)) return false;
      if (filter === 'paid' && !item.isPaid) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = item.clientName.toLowerCase().includes(q);
        const matchNum = item.invoiceNumber.toLowerCase().includes(q);
        const matchVs = item.variableSymbol.toLowerCase().includes(q);
        const matchPhone = item.clientPhone.toLowerCase().includes(q);
        return matchName || matchNum || matchVs || matchPhone;
      }

      return true;
    });
  }, [invoiceItems, filter, searchQuery]);

  // Mark as paid
  const handleMarkAsPaid = (item: InvoiceItem) => {
    const today = new Date().toISOString().slice(0, 10);
    const updated: Contract = {
      ...item.contract,
      status: 'paid',
      paidDate: today,
      leadStage: 'completed',
    };
    onUpdateContract(updated);
    onToast('success', `Faktura ${item.invoiceNumber} byla označena jako zaplacená! Částka: ${formatCurrency(item.amount)}`);
  };

  // Mark as unpaid
  const handleMarkAsUnpaid = (item: InvoiceItem) => {
    const updated: Contract = {
      ...item.contract,
      status: 'signed',
      paidDate: undefined,
    };
    onUpdateContract(updated);
    onToast('info', `Faktura ${item.invoiceNumber} byla vrácena do nezaplacených.`);
  };

  // Generate reminder message
  const getReminderText = (item: InvoiceItem, tone: 'friendly' | 'standard' | 'urgent') => {
    const contractorName = contractor?.name || 'Váš dodavatel';
    const bankAccount = contractor?.bankAccount || 'dle faktury';
    const vs = item.variableSymbol;
    const amountStr = formatCurrency(item.amount);

    if (tone === 'friendly') {
      return `Dobrý den, posílám jen přátelské připomenutí faktury ${item.invoiceNumber} na částku ${amountStr} za dílo "${item.scopeSummary}". Splatnost byla ${new Date(item.dueDate).toLocaleDateString('cs-CZ')}. Číslo účtu: ${bankAccount}, VS: ${vs}. Děkuji a přeji hezký den, ${contractorName}.`;
    }
    if (tone === 'standard') {
      return `Dobrý den, dovoluji si Vás upozornit, že faktura ${item.invoiceNumber} na částku ${amountStr} je již ${item.daysDiff > 0 ? `${item.daysDiff} dní ` : ''}po splatnosti (termín byl ${new Date(item.dueDate).toLocaleDateString('cs-CZ')}). Prosím o kontrolu a úhradu na účet ${bankAccount}, VS: ${vs}. V případě nejasností mě neváhejte kontaktovat. S pozdravem, ${contractorName}.`;
    }
    return `VÁŽENÉ UPOZORNĚNÍ: K dnešnímu dni evidujeme neuhrazenou pohledávku k faktuře ${item.invoiceNumber} ve výši ${amountStr}, splatnou dne ${new Date(item.dueDate).toLocaleDateString('cs-CZ')} (${item.daysDiff} dní po splatnosti). Žádám o okamžitou úhradu na účet ${bankAccount}, VS: ${vs}. V opačném případě bude pohledávka postoupena k vymáhání. ${contractorName}.`;
  };

  // Send WhatsApp reminder
  const handleSendWhatsAppReminder = (item: InvoiceItem) => {
    const text = getReminderText(item, reminderTone);
    let phone = item.clientPhone.replace(/\s+/g, '').replace(/-/g, '');
    if (phone.startsWith('00')) phone = phone.substring(2);
    if (!phone.startsWith('+')) {
      if (phone.length === 9) phone = '420' + phone;
      else if (!phone.startsWith('420')) phone = '420' + phone;
    } else {
      phone = phone.substring(1);
    }

    const newReminder: InvoiceReminder = {
      id: `rem_${Date.now()}`,
      sentAt: new Date().toISOString(),
      channel: 'whatsapp',
      recipientPhone: phone,
      text: text,
    };
    const updatedContract: Contract = {
      ...item.contract,
      reminderHistory: [...(item.contract.reminderHistory || []), newReminder],
    };
    onUpdateContract(updatedContract);

    const url = `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.click();
    setSelectedReminderItem(null);
    onToast('success', 'Odesílám upomínku na WhatsApp a zaznamenávám do historie.');
  };

  // Copy SMS
  const handleCopySms = (item: InvoiceItem) => {
    const text = getReminderText(item, reminderTone);
    navigator.clipboard.writeText(text);

    const newReminder: InvoiceReminder = {
      id: `rem_${Date.now()}`,
      sentAt: new Date().toISOString(),
      channel: 'sms',
      recipientPhone: item.clientPhone,
      text: text,
    };
    const updatedContract: Contract = {
      ...item.contract,
      reminderHistory: [...(item.contract.reminderHistory || []), newReminder],
    };
    onUpdateContract(updatedContract);

    onToast('success', 'Text upomínky byl zkopírován do schránky pro odeslání přes SMS.');
  };

  // Show QR code
  const handleShowQrModal = async (item: InvoiceItem) => {
    if (!contractor?.bankAccount) {
      onToast('error', 'Pro QR kód nejprve vyplňte číslo bankovního účtu v Nastavení.');
      return;
    }
    const qrUrl = await generateQrPaymentDataUrl({
      account: contractor.bankAccount,
      amount: item.amount,
      vs: item.variableSymbol,
      message: `Faktura ${item.invoiceNumber}`,
    });
    setQrModalItem({ item, qrUrl });
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-900 text-amber-400 border border-slate-800 text-xs font-bold mb-2">
            <Receipt className="w-3.5 h-3.5" />
            <span>Kniha pohledávek & Hlídač splatností</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Evidence vystavených faktur
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Přehled splatností a neuhrazených faktur za provedené řemeslné práce. Okamžité odeslání upomínky na WhatsApp nebo SMS.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 dark:text-slate-400 hidden sm:inline">
            Celkem evidováno: <strong className="font-mono tabular-nums text-slate-800 dark:text-slate-200">{invoiceItems.length} faktur</strong>
          </span>
        </div>
      </div>

      {/* Mobile Compact KPI Strip */}
      <div className="grid grid-cols-3 gap-2 sm:hidden bg-white dark:bg-slate-900 rounded-xl p-3 border border-slate-200 dark:border-slate-800 shadow-xs">
        <button
          onClick={() => setFilter('overdue')}
          className={`text-center p-1.5 rounded-lg transition-colors cursor-pointer ${
            filter === 'overdue' ? 'bg-rose-50 dark:bg-rose-950/60 ring-1 ring-rose-400' : ''
          }`}
        >
          <div className="text-3xs font-bold uppercase text-rose-600 dark:text-rose-400 truncate">
            Po splatnosti
          </div>
          <div className="text-sm font-black font-mono tabular-nums text-rose-600 dark:text-rose-400 mt-0.5">
            {formatCurrency(stats.totalOverdue)}
          </div>
          <div className="text-3xs text-slate-400 font-medium">
            {stats.overdueCount > 0 ? `${stats.overdueCount} čeká` : '0 Kč'}
          </div>
        </button>

        <button
          onClick={() => setFilter('pending')}
          className={`text-center p-1.5 rounded-lg border-x border-slate-200 dark:border-slate-800 transition-colors cursor-pointer ${
            filter === 'pending' ? 'bg-amber-50 dark:bg-amber-950/60 ring-1 ring-amber-400' : ''
          }`}
        >
          <div className="text-3xs font-bold uppercase text-amber-600 dark:text-amber-400 truncate">
            K úhradě
          </div>
          <div className="text-sm font-black font-mono tabular-nums text-slate-900 dark:text-white mt-0.5">
            {formatCurrency(stats.totalUnpaid)}
          </div>
          <div className="text-3xs text-slate-400 font-medium">
            {stats.pendingCount} před splatností
          </div>
        </button>

        <button
          onClick={() => setFilter('paid')}
          className={`text-center p-1.5 rounded-lg transition-colors cursor-pointer ${
            filter === 'paid' ? 'bg-emerald-50 dark:bg-emerald-950/60 ring-1 ring-emerald-400' : ''
          }`}
        >
          <div className="text-3xs font-bold uppercase text-emerald-600 dark:text-emerald-400 truncate">
            Uhrazeno
          </div>
          <div className="text-sm font-black font-mono tabular-nums text-emerald-600 dark:text-emerald-400 mt-0.5">
            {formatCurrency(stats.totalPaid)}
          </div>
          <div className="text-3xs text-emerald-500 font-semibold">
            Zaplaceno
          </div>
        </button>
      </div>

      {/* KPI Cards (Desktop & Tablet) */}
      <div className="hidden sm:grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Overdue */}
        <div className="bg-white dark:bg-slate-900 rounded-xl p-4 sm:p-5 border border-rose-200 dark:border-rose-900/60 shadow-xs relative">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">
              Po splatnosti (urgentní)
            </span>
            <div className="w-8 h-8 rounded-lg bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-400 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black font-mono tabular-nums text-rose-600 dark:text-rose-400">
            {formatCurrency(stats.totalOverdue)}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {stats.overdueCount > 0 ? (
              <span className="font-semibold text-rose-600 dark:text-rose-400">
                {stats.overdueCount} {stats.overdueCount === 1 ? 'faktura vyžaduje' : 'faktury vyžadují'} upomínku!
              </span>
            ) : (
              'Žádná faktura není po splatnosti'
            )}
          </div>
        </div>

        {/* Total Unpaid (Pending + Overdue) */}
        <div className="bg-white dark:bg-slate-900 rounded-xl p-4 sm:p-5 border border-slate-200 dark:border-slate-800 shadow-xs relative">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
              K úhradě celkem
            </span>
            <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-950 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black font-mono tabular-nums text-slate-900 dark:text-white">
            {formatCurrency(stats.totalUnpaid)}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {stats.pendingCount} {stats.pendingCount === 1 ? 'faktura běží v termínu' : 'faktur běží v termínu'}
          </div>
        </div>

        {/* Paid */}
        <div className="bg-white dark:bg-slate-900 rounded-xl p-4 sm:p-5 border border-slate-200 dark:border-slate-800 shadow-xs relative">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              Uhrazeno
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
            {formatCurrency(stats.totalPaid)}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Uhrazeno na bankovní účet
          </div>
        </div>

        {/* Bank Account Status */}
        <div className="bg-white dark:bg-slate-900 rounded-xl p-4 sm:p-5 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Bankovní účet řemeslníka
            </span>
            <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center">
              <QrCode className="w-4 h-4" />
            </div>
          </div>
          <div className="text-sm font-bold text-slate-900 dark:text-white font-mono truncate">
            {contractor?.bankAccount || 'Není nastaven'}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {contractor?.bankAccount ? 'Aktivní pro QR Platby' : 'Doplňte v Nastavení pro QR kód'}
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Status Filters */}
        <div className="flex items-center gap-1.5 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
              filter === 'all'
                ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            Všechny ({invoiceItems.length})
          </button>
          <button
            onClick={() => setFilter('overdue')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1.5 ${
              filter === 'overdue'
                ? 'bg-rose-600 text-white'
                : 'text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40'
            }`}
          >
            <AlertTriangle className="w-3 h-3" />
            Po splatnosti ({stats.overdueCount})
          </button>
          <button
            onClick={() => setFilter('pending')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
              filter === 'pending'
                ? 'bg-amber-600 text-white'
                : 'text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40'
            }`}
          >
            Před splatností ({stats.pendingCount})
          </button>
          <button
            onClick={() => setFilter('paid')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
              filter === 'paid'
                ? 'bg-emerald-600 text-white'
                : 'text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40'
            }`}
          >
            Zaplacené ({invoiceItems.filter((i) => i.isPaid).length})
          </button>
        </div>

        {/* Search Input */}
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Hledat klienta, VS, fakturu..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-8 py-1.5 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                searchInputRef.current?.blur();
              }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg cursor-pointer"
              title="Vymazat hledání"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Invoice List */}
      <div className="space-y-3">
        {filteredItems.length === 0 ? (
          <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-8">
            <div className="w-12 h-12 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto mb-3">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">
              Žádné faktury v tomto výběru
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
              Všechny faktury odpovídající filtru jsou uhrazeny nebo nemáte žádné záznamy.
            </p>
          </div>
        ) : (
          filteredItems.map((item) => {
            const reminderCount = item.contract.reminderHistory?.length || 0;

            return (
              <div
                key={item.contract.id}
                className={`bg-white dark:bg-slate-900 rounded-xl p-4 sm:p-5 border transition-all ${
                  item.isOverdue
                    ? 'border-rose-300 dark:border-rose-900 shadow-xs bg-rose-50/20 dark:bg-rose-950/15'
                    : item.isPaid
                    ? 'border-slate-200 dark:border-slate-800 opacity-90 hover:opacity-100'
                    : 'border-slate-200 dark:border-slate-800 hover:border-slate-400 dark:hover:border-slate-600 shadow-xs'
                }`}
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Left Column: Details */}
                  <div className="space-y-2 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-bold text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700">
                        {item.invoiceNumber}
                      </span>
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        VS: <strong className="font-mono text-slate-700 dark:text-slate-300">{item.variableSymbol}</strong>
                      </span>

                      {/* Status Badges - Industrial zero-pill */}
                      {item.isPaid ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-bold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Uhrazeno {item.paidDate ? `(${new Date(item.paidDate).toLocaleDateString('cs-CZ')})` : ''}</span>
                        </span>
                      ) : item.isOverdue ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-black bg-rose-600 text-white shadow-xs">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          <span>{item.daysDiff} {item.daysDiff === 1 ? 'den' : item.daysDiff < 5 ? 'dny' : 'dní'} po splatnosti!</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-bold bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                          <Clock className="w-3.5 h-3.5" />
                          <span>Splatnost za {Math.abs(item.daysDiff)} {Math.abs(item.daysDiff) === 1 ? 'den' : 'dní'}</span>
                        </span>
                      )}

                      {reminderCount > 0 && (
                        <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold border border-slate-200 dark:border-slate-700">
                          {reminderCount}x upomínka
                        </span>
                      )}
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-4">
                      <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                        {item.clientName}
                      </h3>
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        {item.scopeSummary}
                      </span>
                    </div>

                    {/* Metadata line */}
                    <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-xs text-slate-500 dark:text-slate-400">
                      <span className="flex items-center gap-1 font-mono">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        Splatnost: <strong className={item.isOverdue ? 'text-rose-600 dark:text-rose-400 font-bold' : 'text-slate-700 dark:text-slate-300'}>
                          {new Date(item.dueDate).toLocaleDateString('cs-CZ')}
                        </strong>
                      </span>

                      {item.clientPhone && (
                        <span className="flex items-center gap-1 font-mono">
                          <Phone className="w-3.5 h-3.5 text-slate-400" />
                          {item.clientPhone}
                        </span>
                      )}

                      {item.clientEmail && (
                        <span className="flex items-center gap-1 truncate max-w-[200px]">
                          <Mail className="w-3.5 h-3.5 text-slate-400" />
                          {item.clientEmail}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Middle: Amount */}
                  <div className="flex items-center lg:flex-col lg:items-end justify-between border-t lg:border-t-0 pt-3 lg:pt-0 border-slate-100 dark:border-slate-800">
                    <span className="text-xs text-slate-400 lg:hidden">Částka:</span>
                    <div className="text-right">
                      <div className="text-xl sm:text-2xl font-black font-mono tabular-nums text-slate-900 dark:text-white">
                        {formatCurrency(item.amount)}
                      </div>
                      <span className="text-[11px] text-slate-400">Včetně DPH / celkem</span>
                    </div>
                  </div>

                  {/* Right Column: Actions */}
                  <div className="flex flex-wrap items-center gap-2 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-100 dark:border-slate-800">
                    {/* QR Code Action */}
                    <button
                      onClick={() => handleShowQrModal(item)}
                      className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                      title="Zobrazit SPAYD QR kód platby"
                    >
                      <QrCode className="w-4 h-4" />
                    </button>

                    {/* Open Full Invoice */}
                    <button
                      onClick={() => onOpenContract(item.contract, 'faktura')}
                      className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                      title="Otevřít celou fakturu"
                    >
                      <FileText className="w-4 h-4" />
                    </button>

                    {/* Quick Reminder Modal Trigger */}
                    {!item.isPaid && (
                      <button
                        onClick={() => setSelectedReminderItem(item)}
                        className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-black transition-colors cursor-pointer shadow-xs ${
                          item.isOverdue
                            ? 'bg-rose-600 hover:bg-rose-700 text-white'
                            : 'bg-amber-500 hover:bg-amber-600 text-slate-950'
                        }`}
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        <span>Upomínka</span>
                      </button>
                    )}

                    {/* Mark as paid / unpaid toggle */}
                    {item.isPaid ? (
                      <button
                        onClick={() => handleMarkAsUnpaid(item)}
                        className="px-3 py-2 rounded-lg text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                      >
                        Vrátit do nezaplacených
                      </button>
                    ) : (
                      <button
                        onClick={() => handleMarkAsPaid(item)}
                        className="inline-flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-bold bg-slate-900 hover:bg-slate-800 dark:bg-emerald-600 dark:hover:bg-emerald-700 text-white shadow-xs transition-colors cursor-pointer"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Označit zaplaceno</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Reminder Modal */}
      {selectedReminderItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-lg bg-slate-900 text-amber-400 flex items-center justify-center font-bold">
                  <MessageCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 dark:text-white text-base">
                    Upomínka platby faktury
                  </h3>
                  <p className="text-xs text-slate-500 font-mono">
                    {selectedReminderItem.clientName} · {selectedReminderItem.invoiceNumber}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedReminderItem(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Tone selector */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Tón upomínky:
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setReminderTone('friendly')}
                  className={`py-2 px-2.5 rounded-xl text-xs font-semibold text-center border transition-all cursor-pointer ${
                    reminderTone === 'friendly'
                      ? 'bg-blue-50 dark:bg-blue-950/80 border-blue-500 text-blue-700 dark:text-blue-300 shadow-2xs'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50'
                  }`}
                >
                  Přátelská
                </button>
                <button
                  type="button"
                  onClick={() => setReminderTone('standard')}
                  className={`py-2 px-2.5 rounded-xl text-xs font-semibold text-center border transition-all cursor-pointer ${
                    reminderTone === 'standard'
                      ? 'bg-amber-50 dark:bg-amber-950/80 border-amber-500 text-amber-700 dark:text-amber-300 shadow-2xs'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50'
                  }`}
                >
                  Standardní
                </button>
                <button
                  type="button"
                  onClick={() => setReminderTone('urgent')}
                  className={`py-2 px-2.5 rounded-xl text-xs font-semibold text-center border transition-all cursor-pointer ${
                    reminderTone === 'urgent'
                      ? 'bg-rose-50 dark:bg-rose-950/80 border-rose-500 text-rose-700 dark:text-rose-300 shadow-2xs'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50'
                  }`}
                >
                  Důrazná výzva
                </button>
              </div>
            </div>

            {/* Message Preview */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Náhled zprávy pro klienta:
              </label>
              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-200 leading-relaxed font-sans select-all whitespace-pre-line">
                {getReminderText(selectedReminderItem, reminderTone)}
              </div>
            </div>

            {/* Reminder History info */}
            {selectedReminderItem.contract.reminderHistory && selectedReminderItem.contract.reminderHistory.length > 0 && (
              <div className="text-2xs text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 p-2.5 rounded-xl space-y-1">
                <span className="font-semibold block">Předchozí upomínky:</span>
                {selectedReminderItem.contract.reminderHistory.slice(-2).map((r) => (
                  <div key={r.id} className="flex justify-between">
                    <span>{r.channel.toUpperCase()}</span>
                    <span>{new Date(r.sentAt).toLocaleString('cs-CZ')}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => handleCopySms(selectedReminderItem)}
                className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold transition-colors cursor-pointer"
              >
                <Copy className="w-4 h-4" />
                <span>Kopírovat pro SMS</span>
              </button>

              <button
                type="button"
                onClick={() => handleSendWhatsAppReminder(selectedReminderItem)}
                className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md transition-colors cursor-pointer"
              >
                <MessageCircle className="w-4 h-4" />
                <span>Odeslat WhatsApp</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QR Code Modal */}
      {qrModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-xl max-w-sm w-full p-5 text-center shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-400 text-slate-950">
                QR Platba SPAYD
              </span>
              <button
                onClick={() => setQrModalItem(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <h4 className="font-extrabold text-base text-slate-900 dark:text-white">
                {qrModalItem.item.clientName}
              </h4>
              <p className="text-2xl font-black font-mono tabular-nums text-slate-900 dark:text-white mt-1">
                {formatCurrency(qrModalItem.item.amount)}
              </p>
              <p className="text-xs font-mono text-slate-500 mt-0.5">
                VS: {qrModalItem.item.variableSymbol} · {qrModalItem.item.invoiceNumber}
              </p>
            </div>

            <div className="p-3 bg-white rounded-xl border border-slate-200 inline-block shadow-inner mx-auto">
              <img src={qrModalItem.qrUrl} alt="QR Platba" className="w-48 h-48 mx-auto" />
            </div>

            <p className="text-2xs text-slate-500 dark:text-slate-400">
              Klient naskenuje fotoaparátem v mobilním bankovnictví a má okamžitě předvyplněný účet, částku i variabilní symbol.
            </p>

            <button
              onClick={() => setQrModalItem(null)}
              className="w-full py-2.5 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-bold cursor-pointer"
            >
              Zavřít
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
