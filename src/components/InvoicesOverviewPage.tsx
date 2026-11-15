import React, { useMemo, useState } from 'react';
import { Check, Copy, FileText, QrCode, Search, Send, Undo2, X } from 'lucide-react';
import { Contract, ContractorProfile, InvoiceReminder } from '../types/contract';
import { generateQrPaymentDataUrl } from '../utils/spayd';
import { formatCurrency, formatDateCs } from '../utils/numberToWordsCs';
import { isInvoiceable, getFinalBalance, getFinalInvoiceDates, getInvoiceStatus, todayIso } from '../utils/invoiceMath';
import { moveJobStage } from '../utils/jobStage';
import { buildReminderText, daysWordCs, ReminderTone } from '../utils/invoiceReminder';
import { getDirectWhatsAppUrl } from '../utils/shareUtils';
import { Dialog } from './Dialog';

interface InvoicesOverviewPageProps {
  contracts: Contract[];
  contractor: ContractorProfile | null;
  onOpenContract: (contract: Contract, docType?: 'faktura' | 'smlouva') => void;
  onUpdateContract: (contract: Contract) => void;
  onToast: (type: 'success' | 'error' | 'info', message: string) => void;
}

type FilterStatus = 'open' | 'overdue' | 'pending' | 'paid' | 'all';

interface InvoiceItem {
  contract: Contract;
  invoiceNumber: string;
  variableSymbol: string;
  dueDate: string;
  amount: number;
  isPaid: boolean;
  paidDate?: string;
  isOverdue: boolean;
  daysDiff: number; // kladné = dní po splatnosti, záporné = dní do splatnosti
  clientName: string;
  clientPhone: string;
  scope: string;
}

const TONES: { key: ReminderTone; label: string }[] = [
  { key: 'friendly', label: 'Přátelská' },
  { key: 'standard', label: 'Věcná' },
  { key: 'urgent', label: 'Důrazná' },
];

const listBox =
  'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md divide-y divide-slate-100 dark:divide-slate-800';
const outlineButton =
  'min-h-11 px-4 inline-flex items-center justify-center gap-2 rounded-md border-[1.5px] border-slate-900 dark:border-slate-500 text-slate-900 dark:text-slate-100 font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors';
const primaryButton =
  'min-h-11 px-4 inline-flex items-center justify-center gap-2 rounded-md border-[1.5px] border-slate-900 bg-amber-400 hover:bg-amber-500 text-slate-900 font-semibold cursor-pointer transition-colors';
const smallAction =
  'min-h-11 min-w-11 px-3 inline-flex items-center justify-center gap-1.5 rounded-md border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-medium hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors';

export const InvoicesOverviewPage: React.FC<InvoicesOverviewPageProps> = ({
  contracts,
  contractor,
  onOpenContract,
  onUpdateContract,
  onToast,
}) => {
  const [filter, setFilter] = useState<FilterStatus>('open');
  const [searchQuery, setSearchQuery] = useState('');
  const [reminderItem, setReminderItem] = useState<InvoiceItem | null>(null);
  const [reminderTone, setReminderTone] = useState<ReminderTone>('friendly');
  const [qrModalItem, setQrModalItem] = useState<{ item: InvoiceItem; qrUrl: string } | null>(null);

  // Faktury odvozené ze zakázek; částky a data podle jednotných pravidel (utils/invoiceMath)
  const invoiceItems: InvoiceItem[] = useMemo(() => {
    return contracts
      .filter(isInvoiceable)
      .map((c) => {
        const { dueDate } = getFinalInvoiceDates(c);
        const { isPaid, isOverdue, daysPastDue } = getInvoiceStatus(c);
        return {
          contract: c,
          invoiceNumber: c.invoiceNumber || (c.contractNumber ? `FV-${c.contractNumber}` : `FV-${c.id.slice(-6)}`),
          variableSymbol:
            c.variableSymbol || c.contractNumber.replace(/\D/g, '') || c.id.replace(/\D/g, '').slice(0, 10) || '2026001',
          dueDate,
          amount: getFinalBalance(c),
          isPaid,
          paidDate: c.paidDate,
          isOverdue,
          daysDiff: daysPastDue,
          clientName: c.client?.name || 'Klient bez jména',
          clientPhone: c.client?.phone || '',
          scope: c.workDescription || 'Stavební a řemeslné práce',
        };
      })
      .sort((a, b) => {
        if (a.isPaid !== b.isPaid) return a.isPaid ? 1 : -1;
        if (a.isOverdue !== b.isOverdue) return a.isOverdue ? -1 : 1;
        if (a.isPaid) return (b.paidDate || b.dueDate).localeCompare(a.paidDate || a.dueDate);
        return a.dueDate.localeCompare(b.dueDate);
      });
  }, [contracts]);

  const stats = useMemo(() => {
    const s = { totalUnpaid: 0, totalOverdue: 0, totalPaid: 0, open: 0, overdue: 0, pending: 0, paid: 0, all: invoiceItems.length };
    invoiceItems.forEach((inv) => {
      if (inv.isPaid) {
        s.totalPaid += inv.amount;
        s.paid += 1;
      } else {
        s.totalUnpaid += inv.amount;
        s.open += 1;
        if (inv.isOverdue) {
          s.totalOverdue += inv.amount;
          s.overdue += 1;
        } else s.pending += 1;
      }
    });
    return s;
  }, [invoiceItems]);

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return invoiceItems.filter((item) => {
      if (filter === 'open' && item.isPaid) return false;
      if (filter === 'overdue' && !item.isOverdue) return false;
      if (filter === 'pending' && (item.isPaid || item.isOverdue)) return false;
      if (filter === 'paid' && !item.isPaid) return false;
      if (!q) return true;
      return [item.clientName, item.invoiceNumber, item.variableSymbol, item.clientPhone, item.scope].some((v) =>
        v.toLowerCase().includes(q),
      );
    });
  }, [invoiceItems, filter, searchQuery]);

  const filters: { key: FilterStatus; label: string }[] = [
    { key: 'open', label: 'Nezaplacené' },
    { key: 'overdue', label: 'Po splatnosti' },
    { key: 'pending', label: 'Před splatností' },
    { key: 'paid', label: 'Zaplacené' },
    { key: 'all', label: 'Všechny' },
  ];

  const handleMarkAsPaid = (item: InvoiceItem) => {
    onUpdateContract(moveJobStage(item.contract, 'paid', todayIso()));
    onToast('success', `Faktura ${item.invoiceNumber} je označená jako zaplacená (${formatCurrency(item.amount)}).`);
  };

  const handleMarkAsUnpaid = (item: InvoiceItem) => {
    const { paidDate, ...rest } = item.contract;
    onUpdateContract({ ...rest, status: item.contract.handoverData ? 'handover_done' : 'signed' });
    onToast('info', `Faktura ${item.invoiceNumber} je zpět mezi nezaplacenými.`);
  };

  const reminderText = (item: InvoiceItem, tone: ReminderTone) =>
    buildReminderText(
      {
        invoiceNumber: item.invoiceNumber,
        amount: item.amount,
        dueDate: item.dueDate,
        daysPastDue: item.daysDiff,
        variableSymbol: item.variableSymbol,
        scope: item.scope.length > 70 ? `${item.scope.slice(0, 70)}…` : item.scope,
        contractorName: contractor?.name,
        bankAccount: contractor?.bankAccount,
      },
      tone,
    );

  const openReminder = (item: InvoiceItem) => {
    setReminderTone(item.isOverdue ? 'standard' : 'friendly');
    setReminderItem(item);
  };

  const saveReminder = (item: InvoiceItem, channel: InvoiceReminder['channel'], text: string) => {
    const reminder: InvoiceReminder = {
      id: `rem_${Date.now()}`,
      sentAt: new Date().toISOString(),
      channel,
      recipientPhone: item.clientPhone,
      text,
    };
    onUpdateContract({ ...item.contract, reminderHistory: [...(item.contract.reminderHistory || []), reminder] });
  };

  const handleSendWhatsAppReminder = (item: InvoiceItem) => {
    const text = reminderText(item, reminderTone);
    saveReminder(item, 'whatsapp', text);
    const a = document.createElement('a');
    a.href = getDirectWhatsAppUrl(text, item.clientPhone);
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.click();
    setReminderItem(null);
    onToast('success', 'Upomínka se otevírá ve WhatsAppu a je zapsaná u faktury.');
  };

  const handleCopySms = async (item: InvoiceItem) => {
    const text = reminderText(item, reminderTone);
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      onToast('error', 'Text se nepodařilo zkopírovat. Označte ho a zkopírujte ručně.');
      return;
    }
    saveReminder(item, 'sms', text);
    setReminderItem(null);
    onToast('success', 'Text upomínky je zkopírovaný, vložte ho do SMS.');
  };

  const handleShowQrModal = async (item: InvoiceItem) => {
    if (!contractor?.bankAccount) {
      onToast('error', 'Pro QR platbu nejprve vyplňte číslo bankovního účtu v Nastavení.');
      return;
    }
    const qrUrl = await generateQrPaymentDataUrl({
      account: contractor.bankAccount,
      amount: item.amount,
      vs: item.variableSymbol,
      message: `Faktura ${item.invoiceNumber}`,
    });
    if (!qrUrl) {
      onToast('error', 'QR platbu se nepodařilo vytvořit. Zkontrolujte číslo účtu v Nastavení.');
      return;
    }
    setQrModalItem({ item, qrUrl });
  };

  const invoicesWord = (n: number) => (n === 1 ? 'jedné faktuře' : `${n} fakturách`);

  return (
    <div className="max-w-[1180px] mx-auto pb-16 space-y-7 text-[15px] leading-snug">
      <header>
        <h1 className="text-4xl sm:text-[44px] font-bold leading-[1.05] text-slate-900 dark:text-white">Faktury</h1>
        <div className="mt-1 text-slate-600 dark:text-slate-400">
          Konečné faktury k zakázkám, hlídání splatnosti a upomínky.
        </div>
      </header>

      {/* Souhrn */}
      <section aria-label="Souhrn pohledávek" className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md">
        <div className="px-5 py-[18px] flex flex-wrap items-end justify-between gap-x-10 gap-y-4">
          <div>
            <div className="text-slate-600 dark:text-slate-400">Čeká na zaplacení</div>
            <div className="text-[40px] leading-none text-slate-900 dark:text-white font-display font-bold tabular-nums mt-1">
              {formatCurrency(stats.totalUnpaid)}
            </div>
            <div className="mt-1.5 text-slate-600 dark:text-slate-400">
              {stats.open === 0 ? 'Všechny faktury jsou zaplacené.' : `v${stats.open >= 2 && stats.open <= 4 ? 'e' : ''} ${invoicesWord(stats.open)}`}
            </div>
          </div>
          <div className="flex flex-wrap gap-x-10 gap-y-3">
            <div>
              <div className="text-slate-600 dark:text-slate-400">Po splatnosti</div>
              <div
                className={`text-[26px] leading-tight font-display font-semibold tabular-nums ${
                  stats.overdue > 0 ? 'text-rose-700 dark:text-rose-400' : 'text-slate-900 dark:text-white'
                }`}
              >
                {formatCurrency(stats.totalOverdue)}
              </div>
            </div>
            <div>
              <div className="text-slate-600 dark:text-slate-400">Zaplaceno celkem</div>
              <div className="text-[26px] leading-tight font-display font-semibold tabular-nums text-slate-900 dark:text-white">
                {formatCurrency(stats.totalPaid)}
              </div>
            </div>
          </div>
        </div>
        <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-400">
          {contractor?.bankAccount ? (
            <>
              QR platby a upomínky uvádějí účet{' '}
              <span className="font-semibold text-slate-900 dark:text-white tabular-nums whitespace-nowrap">{contractor.bankAccount}</span>.
            </>
          ) : (
            <span className="font-medium text-rose-700 dark:text-rose-400">
              V Nastavení chybí číslo bankovního účtu. Bez něj nejde vytvořit QR platba.
            </span>
          )}
        </div>
      </section>

      {/* Výběr a hledání */}
      <div className="space-y-4">
        <div className="border-b border-slate-900 dark:border-slate-500 overflow-x-auto">
          <div role="tablist" aria-label="Stav faktur" className="flex gap-1 min-w-max">
            {filters.map((f) => {
              const active = filter === f.key;
              return (
                <button
                  key={f.key}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setFilter(f.key)}
                  className={`min-h-11 px-3.5 inline-flex items-center gap-2 font-semibold cursor-pointer border-b-[3px] -mb-px transition-colors ${
                    active
                      ? 'border-slate-900 dark:border-white text-slate-900 dark:text-white'
                      : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <span>{f.label}</span>
                  <span className="font-display tabular-nums text-[17px]">{stats[f.key]}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="relative w-full sm:max-w-sm">
          <label htmlFor="faktury-hledat" className="sr-only">
            Hledat fakturu
          </label>
          <Search className="w-[18px] h-[18px] absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-600 dark:text-slate-400 pointer-events-none" />
          <input
            id="faktury-hledat"
            type="search"
            placeholder="Hledat zákazníka, číslo faktury, VS"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full min-h-11 pl-10 pr-11 rounded-md border-[1.5px] border-slate-900 dark:border-slate-500 bg-white dark:bg-slate-950 text-slate-900 dark:text-white [&::-webkit-search-cancel-button]:hidden"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              aria-label="Vymazat hledání"
              className="absolute right-0 top-0 w-11 h-11 inline-flex items-center justify-center text-slate-900 dark:text-slate-100 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Seznam faktur */}
      <section aria-label="Seznam faktur" className={listBox}>
        {filteredItems.length === 0 && (
          <div className="px-5 py-5 text-slate-600 dark:text-slate-300">
            {searchQuery.trim()
              ? 'Hledání neodpovídá žádná faktura.'
              : invoiceItems.length === 0
                ? 'Zatím tu není žádná faktura. Vznikne ze smlouvy s cenou díla.'
                : filter === 'paid'
                  ? 'Zatím není zaplacená žádná faktura.'
                  : 'V tomto výběru není žádná faktura.'}
          </div>
        )}
        {filteredItems.map((item) => {
          const reminderCount = item.contract.reminderHistory?.length || 0;
          return (
            <div key={item.contract.id} className="px-5 py-[18px] space-y-3">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <div className="min-w-0 flex-1 basis-56">
                  <button
                    type="button"
                    onClick={() => onOpenContract(item.contract, 'faktura')}
                    className="text-left text-[17px] font-semibold text-slate-900 dark:text-white hover:underline underline-offset-2 cursor-pointer"
                  >
                    {item.clientName}
                  </button>
                  <div className="text-slate-600 dark:text-slate-400">
                    Faktura {item.invoiceNumber}, VS {item.variableSymbol}, {item.scope}
                  </div>
                </div>
                <div className="text-[22px] whitespace-nowrap text-slate-900 dark:text-white font-display font-semibold tabular-nums">
                  {formatCurrency(item.amount)}
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2.5">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                  <span
                    className={`font-semibold px-2.5 py-0.5 rounded-sm ${
                      item.isPaid
                        ? 'bg-emerald-700 text-white'
                        : item.isOverdue
                          ? 'bg-rose-700 text-white'
                          : 'border border-slate-500 text-slate-900 dark:text-slate-100'
                    }`}
                  >
                    {item.isPaid
                      ? `Zaplaceno${item.paidDate ? ` ${formatDateCs(item.paidDate)}` : ''}`
                      : item.isOverdue
                        ? `${item.daysDiff} ${daysWordCs(item.daysDiff)} po splatnosti`
                        : `splatná ${formatDateCs(item.dueDate)}`}
                  </span>
                  {!item.isPaid && item.isOverdue && (
                    <span className="text-slate-600 dark:text-slate-400">splatná {formatDateCs(item.dueDate)}</span>
                  )}
                  {reminderCount > 0 && (
                    <span className="text-slate-600 dark:text-slate-400">
                      {reminderCount === 1 ? 'upomínka odeslána jednou' : `upomínka odeslána ${reminderCount}×`}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onOpenContract(item.contract, 'faktura')}
                    className={smallAction}
                    aria-label={`Otevřít fakturu ${item.invoiceNumber}`}
                  >
                    <FileText className="w-4 h-4" />
                    <span className="hidden sm:inline">Doklad</span>
                  </button>
                  {!item.isPaid && (
                    <button
                      type="button"
                      onClick={() => handleShowQrModal(item)}
                      className={smallAction}
                      aria-label={`QR platba faktury ${item.invoiceNumber}`}
                    >
                      <QrCode className="w-4 h-4" />
                      <span className="hidden sm:inline">QR platba</span>
                    </button>
                  )}
                  {!item.isPaid && (
                    <button type="button" onClick={() => openReminder(item)} className={smallAction}>
                      <Send className="w-4 h-4" />
                      <span>Upomínka</span>
                    </button>
                  )}
                  {item.isPaid ? (
                    <button type="button" onClick={() => handleMarkAsUnpaid(item)} className={smallAction}>
                      <Undo2 className="w-4 h-4" />
                      <span>Vrátit mezi nezaplacené</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleMarkAsPaid(item)}
                      className={`${smallAction} !border-slate-900 dark:!border-slate-400 font-semibold`}
                    >
                      <Check className="w-4 h-4" />
                      <span>Zaplaceno</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </section>

      {/* Upomínka */}
      {reminderItem && (
        <Dialog
          title="Upomínka"
          subtitle={`${reminderItem.clientName}, faktura ${reminderItem.invoiceNumber}`}
          size="lg"
          onClose={() => setReminderItem(null)}
        >
          <div className="space-y-4">
            {reminderItem.isOverdue ? (
              <div>
                <div className="font-semibold text-slate-900 dark:text-slate-100 mb-1.5">Tón zprávy</div>
                <div className="grid grid-cols-3 gap-2">
                  {TONES.map((t) => (
                    <button
                      key={t.key}
                      type="button"
                      aria-pressed={reminderTone === t.key}
                      onClick={() => setReminderTone(t.key)}
                      className={`min-h-11 px-2 rounded-md border-[1.5px] font-semibold cursor-pointer transition-colors ${
                        reminderTone === t.key
                          ? 'border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-900'
                          : 'border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-slate-600 dark:text-slate-400">
                Faktura ještě není po splatnosti, zpráva je proto jen zdvořilé připomenutí.
              </p>
            )}

            <div>
              <div className="font-semibold text-slate-900 dark:text-slate-100 mb-1.5">Text zprávy</div>
              <div className="p-3.5 rounded-md border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 leading-relaxed select-all whitespace-pre-line">
                {reminderText(reminderItem, reminderTone)}
              </div>
            </div>

            {!!reminderItem.contract.reminderHistory?.length && (
              <div className="text-slate-600 dark:text-slate-400">
                <div className="font-semibold text-slate-900 dark:text-slate-100">Dříve odesláno</div>
                {reminderItem.contract.reminderHistory.slice(-3).map((r) => (
                  <div key={r.id} className="flex justify-between gap-3">
                    <span>{r.channel === 'whatsapp' ? 'WhatsApp' : r.channel === 'sms' ? 'SMS' : 'E-mail'}</span>
                    <span className="tabular-nums">{new Date(r.sentAt).toLocaleString('cs-CZ')}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="pt-1 flex flex-wrap justify-end gap-2.5">
              <button type="button" onClick={() => handleCopySms(reminderItem)} className={`${outlineButton} flex-1 sm:flex-none`}>
                <Copy className="w-[18px] h-[18px]" />
                <span>Zkopírovat pro SMS</span>
              </button>
              <button
                type="button"
                onClick={() => handleSendWhatsAppReminder(reminderItem)}
                className={`${primaryButton} flex-1 sm:flex-none`}
              >
                <Send className="w-[18px] h-[18px]" />
                <span>Odeslat přes WhatsApp</span>
              </button>
            </div>
          </div>
        </Dialog>
      )}

      {/* QR platba */}
      {qrModalItem && (
        <Dialog
          title="QR platba"
          subtitle={`${qrModalItem.item.clientName}, faktura ${qrModalItem.item.invoiceNumber}`}
          size="sm"
          onClose={() => setQrModalItem(null)}
        >
          <div className="space-y-4 text-center">
            <div>
              <div className="text-[34px] leading-none font-display font-bold tabular-nums text-slate-900 dark:text-white">
                {formatCurrency(qrModalItem.item.amount)}
              </div>
              <div className="mt-1.5 text-slate-600 dark:text-slate-400 tabular-nums">
                VS {qrModalItem.item.variableSymbol}
              </div>
            </div>
            <div className="inline-block p-3 bg-white border border-slate-900 rounded-md">
              <img src={qrModalItem.qrUrl} alt="QR kód platby" className="w-52 h-52" />
            </div>
            <p className="text-slate-600 dark:text-slate-400 text-left">
              Zákazník kód naskenuje v bankovní aplikaci a má vyplněný účet, částku i variabilní symbol.
            </p>
            <button type="button" onClick={() => setQrModalItem(null)} className={`${outlineButton} w-full`}>
              Zavřít
            </button>
          </div>
        </Dialog>
      )}
    </div>
  );
};
