import React, { useState, useMemo } from 'react';
import {
  X,
  FileSpreadsheet,
  Download,
  Printer,
  Mail,
  Calendar,
  CheckCircle2,
  DollarSign,
  Receipt,
  Banknote,
  Car,
  Package,
  Share2,
  Building2,
  Filter,
} from 'lucide-react';
import { Contract, ContractorProfile } from '../types/contract';
import { formatCurrency, formatDateCs } from '../utils/numberToWordsCs';
import { triggerHaptic } from '../utils/haptics';
import { isInvoiceable, getContractTotal, getFinalInvoiceDates, vatIncludedInGross } from '../utils/invoiceMath';

interface AccountantExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  contracts: Contract[];
  contractor: ContractorProfile | null;
  onToast?: (type: 'success' | 'error' | 'info', text: string) => void;
}

type PeriodType = 'this_month' | 'last_month' | 'q1' | 'q2' | 'q3' | 'q4' | 'whole_year' | 'custom';

export const AccountantExportModal: React.FC<AccountantExportModalProps> = ({
  isOpen,
  onClose,
  contracts,
  contractor,
  onToast,
}) => {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth(); // 0-11

  const [period, setPeriod] = useState<PeriodType>('this_month');
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [accountantEmail, setAccountantEmail] = useState('');
  const [activeTab, setActiveTab] = useState<'summary' | 'invoices' | 'receipts' | 'expenses' | 'trips'>('summary');

  // Custom date range if needed
  const [customFrom, setCustomFrom] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split('T')[0];
  });
  const [customTo, setCustomTo] = useState(() => new Date().toISOString().split('T')[0]);

  // Compute date range based on period
  const { dateFrom, dateTo, periodLabel } = useMemo(() => {
    let from = '';
    let to = '';
    let label = '';

    const pad = (n: number) => String(n).padStart(2, '0');

    if (period === 'this_month') {
      const monthNum = currentMonth + 1;
      const lastDay = new Date(selectedYear, currentMonth + 1, 0).getDate();
      from = `${selectedYear}-${pad(monthNum)}-01`;
      to = `${selectedYear}-${pad(monthNum)}-${pad(lastDay)}`;
      const monthNames = ['Leden', 'Únor', 'Březen', 'Duben', 'Květen', 'Červen', 'Červenec', 'Srpen', 'Září', 'Říjen', 'Listopad', 'Prosinec'];
      label = `${monthNames[currentMonth]} ${selectedYear}`;
    } else if (period === 'last_month') {
      const targetMonth = currentMonth === 0 ? 11 : currentMonth - 1;
      const targetYear = currentMonth === 0 ? selectedYear - 1 : selectedYear;
      const lastDay = new Date(targetYear, targetMonth + 1, 0).getDate();
      from = `${targetYear}-${pad(targetMonth + 1)}-01`;
      to = `${targetYear}-${pad(targetMonth + 1)}-${pad(lastDay)}`;
      const monthNames = ['Leden', 'Únor', 'Březen', 'Duben', 'Květen', 'Červen', 'Červenec', 'Srpen', 'Září', 'Říjen', 'Listopad', 'Prosinec'];
      label = `${monthNames[targetMonth]} ${targetYear}`;
    } else if (period === 'q1') {
      from = `${selectedYear}-01-01`;
      to = `${selectedYear}-03-31`;
      label = `1. Kvartál (Q1) ${selectedYear}`;
    } else if (period === 'q2') {
      from = `${selectedYear}-04-01`;
      to = `${selectedYear}-06-30`;
      label = `2. Kvartál (Q2) ${selectedYear}`;
    } else if (period === 'q3') {
      from = `${selectedYear}-07-01`;
      to = `${selectedYear}-09-30`;
      label = `3. Kvartál (Q3) ${selectedYear}`;
    } else if (period === 'q4') {
      from = `${selectedYear}-10-01`;
      to = `${selectedYear}-12-31`;
      label = `4. Kvartál (Q4) ${selectedYear}`;
    } else if (period === 'whole_year') {
      from = `${selectedYear}-01-01`;
      to = `${selectedYear}-12-31`;
      label = `Celý rok ${selectedYear}`;
    } else {
      from = customFrom;
      to = customTo;
      label = `Období ${formatDateCs(customFrom)} – ${formatDateCs(customTo)}`;
    }

    return { dateFrom: from, dateTo: to, periodLabel: label };
  }, [period, selectedYear, currentMonth, customFrom, customTo]);

  // Aggregate items in date range
  const filteredData = useMemo(() => {
    const invoices: Array<{
      id: string;
      number: string;
      contractNumber: string;
      issueDate: string;
      taxDate: string;
      dueDate: string;
      clientName: string;
      clientIco?: string;
      amount: number;
      vat: number;
      isPaid: boolean;
      paidDate?: string;
      description: string;
    }> = [];

    const cashReceipts: Array<{
      id: string;
      receiptNumber: string;
      contractNumber: string;
      issueDate: string;
      amount: number;
      receivedFrom: string;
      purposeDescription: string;
    }> = [];

    const expenses: Array<{
      id: string;
      contractNumber: string;
      date: string;
      title: string;
      supplier?: string;
      amount: number;
      category: string;
    }> = [];

    const trips: Array<{
      id: string;
      contractNumber: string;
      date: string;
      origin: string;
      destination: string;
      distanceKm: number;
      ratePerKm: number;
      totalCost: number;
      purpose: string;
    }> = [];

    contracts.forEach((c) => {
      // 1. Faktury
      // Jen skutečné smlouvy (ne nabídky); data a částky podle jednotných pravidel (utils/invoiceMath)
      const invoiceDates = getFinalInvoiceDates(c);
      const baseDate = invoiceDates.issueDate;
      if (isInvoiceable(c) && baseDate >= dateFrom && baseDate <= dateTo) {
        const totalPrice = getContractTotal(c);
        // Ceny jsou u plátců uvedené včetně DPH, daň je tedy část ceny (21/121), ne přirážka
        const vatVal = c.hasVat ? vatIncludedInGross(totalPrice) : 0;

        invoices.push({
          id: c.id,
          number: c.invoiceNumber || `FV-${c.contractNumber}`,
          contractNumber: c.contractNumber,
          issueDate: baseDate,
          taxDate: invoiceDates.taxDate,
          dueDate: invoiceDates.dueDate,
          clientName: c.client.name,
          clientIco: c.client.ico,
          amount: totalPrice,
          vat: vatVal,
          isPaid: c.status === 'paid' || !!c.paidDate,
          paidDate: c.paidDate,
          description: c.workDescription,
        });
      }

      // 2. PPD Hotovost
      (c.cashReceipts || []).forEach((r) => {
        if (r.issueDate >= dateFrom && r.issueDate <= dateTo) {
          cashReceipts.push({
            id: r.id,
            receiptNumber: r.receiptNumber,
            contractNumber: c.contractNumber,
            issueDate: r.issueDate,
            amount: r.amount,
            receivedFrom: r.receivedFrom,
            purposeDescription: r.purposeDescription,
          });
        }
      });

      // 3. Výdaje / Nákup materiálu
      (c.expenses || []).forEach((exp) => {
        if (exp.date >= dateFrom && exp.date <= dateTo) {
          expenses.push({
            id: exp.id,
            contractNumber: c.contractNumber,
            date: exp.date,
            title: exp.title,
            supplier: exp.supplier,
            amount: exp.amount,
            category: exp.category,
          });
        }
      });

      // 4. Kniha jízd / Cesty
      (c.trips || []).forEach((tr) => {
        if (tr.date >= dateFrom && tr.date <= dateTo) {
          trips.push({
            id: tr.id,
            contractNumber: c.contractNumber,
            date: tr.date,
            origin: tr.origin,
            destination: tr.destination,
            distanceKm: tr.distanceKm,
            ratePerKm: tr.ratePerKm,
            totalCost: tr.totalCost,
            purpose: tr.purpose,
          });
        }
      });
    });

    const sumInvoices = invoices.reduce((s, i) => s + i.amount, 0);
    const sumCashReceipts = cashReceipts.reduce((s, r) => s + r.amount, 0);
    const sumExpenses = expenses.reduce((s, e) => s + e.amount, 0);
    const sumTrips = trips.reduce((s, t) => s + t.totalCost, 0);
    const sumTripsKm = trips.reduce((s, t) => s + t.distanceKm, 0);

    return {
      invoices,
      cashReceipts,
      expenses,
      trips,
      sumInvoices,
      sumCashReceipts,
      sumExpenses,
      sumTrips,
      sumTripsKm,
      netProfit: sumInvoices - (sumExpenses + sumTrips),
    };
  }, [contracts, dateFrom, dateTo]);

  if (!isOpen) return null;

  // Print Handover Sheet for Accountant
  const handlePrint = () => {
    triggerHaptic('success');
    window.print();
  };

  // Export to CSV for Pohoda / Excel / Money S3
  const handleExportCsv = () => {
    triggerHaptic('success');

    let csv = '\uFEFF'; // UTF-8 BOM for Excel
    csv += `PŘEDÁVACÍ PROTOKOL PRO ÚČETNÍ – ${periodLabel.toUpperCase()}\r\n`;
    csv += `Zhotovitel:;${contractor?.name || 'Živnostník'};IČO:;${contractor?.ico || ''}\r\n`;
    csv += `Období od:;${dateFrom};do:;${dateTo}\r\n\r\n`;

    // 1. FAKTURY
    csv += `1. VYDANÉ FAKTURY A ZÁLOHY\r\n`;
    csv += `Číslo faktury;Smlouva;Datum vystavení;Splatnost;Odběratel;IČO;Částka (Kč);DPH;Stav\r\n`;
    filteredData.invoices.forEach((i) => {
      csv += `"${i.number}";"${i.contractNumber}";"${i.issueDate}";"${i.dueDate}";"${i.clientName}";"${i.clientIco || ''}";${i.amount};${i.vat};"${i.isPaid ? 'Zaplaceno' : 'Neuhrazeno'}"\r\n`;
    });
    csv += `Celkem faktury:;;;;;;${filteredData.sumInvoices};;\r\n\r\n`;

    // 2. PPD HOTOVOST
    csv += `2. PŘÍJMOVÉ POKLADNÍ DOKLADY (HOTOVOST)\r\n`;
    csv += `Číslo dokladu;Smlouva;Datum;Přijato od;Částka (Kč);Účel platby\r\n`;
    filteredData.cashReceipts.forEach((r) => {
      csv += `"${r.receiptNumber}";"${r.contractNumber}";"${r.issueDate}";"${r.receivedFrom}";${r.amount};"${r.purposeDescription}"\r\n`;
    });
    csv += `Celkem hotovost PPD:;;;;${filteredData.sumCashReceipts};\r\n\r\n`;

    // 3. VÝDAJE A MATERIÁL
    csv += `3. NÁKUPY MATERIÁLU A PROVOZNÍ VÝDAJE\r\n`;
    csv += `Datum;Smlouva;Dodavatel;Popis;Kategorie;Částka (Kč)\r\n`;
    filteredData.expenses.forEach((e) => {
      csv += `"${e.date}";"${e.contractNumber}";"${e.supplier || ''}";"${e.title}";"${e.category}";${e.amount}\r\n`;
    });
    csv += `Celkem výdaje:;;;;;${filteredData.sumExpenses}\r\n\r\n`;

    // 4. KNIHA JÍZD
    csv += `4. KNIHA JÍZD A CESTOVNÍ NÁHRADY\r\n`;
    csv += `Datum;Smlouva;Trasa;Ujeto km;Sazba Kč/km;Náhrada celkem (Kč);Účel cesty\r\n`;
    filteredData.trips.forEach((t) => {
      csv += `"${t.date}";"${t.contractNumber}";"${t.origin} -> ${t.destination}";${t.distanceKm};${t.ratePerKm};${t.totalCost};"${t.purpose}"\r\n`;
    });
    csv += `Celkem cesty:;;;${filteredData.sumTripsKm} km;;${filteredData.sumTrips};\r\n\r\n`;

    // SOUHRN
    csv += `REKAPITULACE HOSPODAŘENÍ ZA OBDOBÍ\r\n`;
    csv += `Celkové zdanitelné příjmy (Faktury):;${filteredData.sumInvoices} Kč\r\n`;
    csv += `Z toho přijato v hotovosti (PPD):;${filteredData.sumCashReceipts} Kč\r\n`;
    csv += `Daňově uznatelné výdaje (Materiál + Doprava):;${filteredData.sumExpenses + filteredData.sumTrips} Kč\r\n`;
    csv += `Čistý hospodářský výsledek (Zisk před zdaněním):;${filteredData.netProfit} Kč\r\n`;

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Podklady_ucetni_${period}_${selectedYear}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    if (onToast) {
      onToast('success', `Export pro účetní za ${periodLabel} byl stažen do CSV.`);
    }
  };

  // Mailto generator for Accountant
  const handleSendEmail = () => {
    triggerHaptic('success');
    const subject = encodeURIComponent(
      `Podklady pro účetnictví – ${periodLabel} (${contractor?.name || 'Živnostník'})`
    );
    const bodyText =
      `Dobrý den,\n\n` +
      `zasílám souhrnné podklady pro daňovou evidenci a účetnictví za období: ${periodLabel}.\n\n` +
      `SOUHRN HOSPODAŘENÍ:\n` +
      `• Vystavené faktury celkem: ${formatCurrency(filteredData.sumInvoices)} (${filteredData.invoices.length} ks)\n` +
      `• Příjmové pokladní doklady (hotovost): ${formatCurrency(filteredData.sumCashReceipts)} (${filteredData.cashReceipts.length} ks)\n` +
      `• Nákupy materiálu a provozní výdaje: ${formatCurrency(filteredData.sumExpenses)} (${filteredData.expenses.length} dokladů)\n` +
      `• Kniha jízd (cestovní náhrady): ${formatCurrency(filteredData.sumTrips)} (${filteredData.sumTripsKm} km)\n` +
      `-----------------------------------------\n` +
      `• Odhadovaný čistý zisk za období: ${formatCurrency(filteredData.netProfit)}\n\n` +
      `Detailní CSV export i vytištěné doklady jsou k dispozici.\n\n` +
      `S pozdravem,\n` +
      `${contractor?.name || 'Živnostník'}\n` +
      `IČO: ${contractor?.ico || ''}\n` +
      `Tel: ${contractor?.phone || ''}`;

    const url = `mailto:${accountantEmail}?subject=${subject}&body=${encodeURIComponent(bodyText)}`;
    window.location.href = url;
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-xl max-w-4xl w-full shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[92vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150 text-slate-800 dark:text-slate-100">
        {/* Header - Industrial Tax Export Desk */}
        <div className="p-4 sm:p-5 border-b border-slate-800 bg-slate-950 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/40 text-amber-400 flex items-center justify-center shrink-0">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-400 text-slate-950">
                  Účetní archiv
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  DPH & Paušál OSVČ
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-black tracking-tight text-white mt-0.5">
                Podklady a daňová uzávěrka pro účetní
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="px-2.5 py-1.5 rounded-lg border border-slate-800 bg-slate-900 hover:bg-slate-800 text-xs font-mono font-bold text-slate-400 hover:text-white cursor-pointer active:scale-95 transition-all flex items-center gap-1.5"
          >
            <X className="w-4 h-4" />
            <span className="hidden sm:inline">ESC</span>
          </button>
        </div>

        {/* Content body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {/* Period Selector Bar */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5 text-blue-600" />
                Zvolte účetní období:
              </span>

              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-500">Rok:</span>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
                  className="text-xs font-bold px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
                >
                  {[currentYear, currentYear - 1, currentYear - 2].map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
              {[
                { id: 'this_month', label: 'Tento měsíc' },
                { id: 'last_month', label: 'Minulý měsíc' },
                { id: 'q1', label: '1. Kvartál (Q1)' },
                { id: 'q2', label: '2. Kvartál (Q2)' },
                { id: 'q3', label: '3. Kvartál (Q3)' },
                { id: 'q4', label: '4. Kvartál (Q4)' },
                { id: 'whole_year', label: 'Celý rok' },
              ].map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    triggerHaptic('selection');
                    setPeriod(p.id as PeriodType);
                  }}
                  className={`p-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer text-center ${
                    period === p.id
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-blue-400'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Big KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <span className="text-2xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1">
                Faktury (Příjmy)
              </span>
              <span className="text-lg sm:text-xl font-black text-slate-900 dark:text-white font-mono block">
                {formatCurrency(filteredData.sumInvoices)}
              </span>
              <span className="text-3xs font-semibold text-slate-500 mt-0.5 block">
                {filteredData.invoices.length} vystavených faktur
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <span className="text-2xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1">
                PPD v hotovosti
              </span>
              <span className="text-lg sm:text-xl font-black text-emerald-600 dark:text-emerald-400 font-mono block">
                {formatCurrency(filteredData.sumCashReceipts)}
              </span>
              <span className="text-3xs font-semibold text-slate-500 mt-0.5 block">
                {filteredData.cashReceipts.length} pokladních dokladů
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <span className="text-2xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1">
                Výdaje & Materiál
              </span>
              <span className="text-lg sm:text-xl font-black text-rose-600 dark:text-rose-400 font-mono block">
                {formatCurrency(filteredData.sumExpenses)}
              </span>
              <span className="text-3xs font-semibold text-slate-500 mt-0.5 block">
                {filteredData.expenses.length} nákupních účtenek
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <span className="text-2xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1">
                Kniha jízd (PHM)
              </span>
              <span className="text-lg sm:text-xl font-black text-amber-600 dark:text-amber-400 font-mono block">
                {formatCurrency(filteredData.sumTrips)}
              </span>
              <span className="text-3xs font-semibold text-slate-500 mt-0.5 block">
                {filteredData.sumTripsKm} km ujeto na stavby
              </span>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-slate-200 dark:border-slate-800 gap-1 overflow-x-auto pb-1">
            <button
              type="button"
              onClick={() => setActiveTab('summary')}
              className={`pb-2 px-3 text-xs sm:text-sm font-bold flex items-center gap-1.5 border-b-2 cursor-pointer transition-all ${
                activeTab === 'summary'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Souhrnný protokol ({periodLabel})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('invoices')}
              className={`pb-2 px-3 text-xs sm:text-sm font-bold flex items-center gap-1.5 border-b-2 cursor-pointer transition-all ${
                activeTab === 'invoices'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Receipt className="w-4 h-4" />
              <span>Faktury ({filteredData.invoices.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('receipts')}
              className={`pb-2 px-3 text-xs sm:text-sm font-bold flex items-center gap-1.5 border-b-2 cursor-pointer transition-all ${
                activeTab === 'receipts'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Banknote className="w-4 h-4" />
              <span>PPD Hotovost ({filteredData.cashReceipts.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('expenses')}
              className={`pb-2 px-3 text-xs sm:text-sm font-bold flex items-center gap-1.5 border-b-2 cursor-pointer transition-all ${
                activeTab === 'expenses'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <DollarSign className="w-4 h-4" />
              <span>Materiál ({filteredData.expenses.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('trips')}
              className={`pb-2 px-3 text-xs sm:text-sm font-bold flex items-center gap-1.5 border-b-2 cursor-pointer transition-all ${
                activeTab === 'trips'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Car className="w-4 h-4" />
              <span>Jízdy ({filteredData.trips.length})</span>
            </button>
          </div>

          {/* TAB 1: SUMMARY PROTOCOL */}
          {activeTab === 'summary' && (
            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                <div>
                  <h3 className="font-black text-base">Předávací protokol pro účetnictví</h3>
                  <p className="text-xs text-slate-500">
                    Podklad pro přiznání k DPH, daň z příjmů a kontrolní hlášení
                  </p>
                </div>
                <div className="text-xs font-semibold text-slate-500 text-right">
                  Vygenerováno: {formatDateCs(new Date().toISOString().split('T')[0])}
                </div>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                  <span className="font-semibold text-slate-600 dark:text-slate-400">1. Celkové vystavené faktury za dílo:</span>
                  <span className="font-black text-slate-900 dark:text-white">{formatCurrency(filteredData.sumInvoices)}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                  <span className="font-semibold text-slate-600 dark:text-slate-400">2. Z toho přijato v hotovosti (PPD):</span>
                  <span className="font-black text-emerald-600 dark:text-emerald-400">{formatCurrency(filteredData.sumCashReceipts)}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                  <span className="font-semibold text-slate-600 dark:text-slate-400">3. Skutečné nákupy materiálu a subdodávky:</span>
                  <span className="font-black text-rose-600 dark:text-rose-400">- {formatCurrency(filteredData.sumExpenses)}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                  <span className="font-semibold text-slate-600 dark:text-slate-400">4. Cestovní náhrady dle Knihy jízd ({filteredData.sumTripsKm} km):</span>
                  <span className="font-black text-rose-600 dark:text-rose-400">- {formatCurrency(filteredData.sumTrips)}</span>
                </div>
                <div className="flex justify-between py-2.5 bg-slate-50 dark:bg-slate-800/60 px-3 rounded-xl">
                  <span className="font-black text-sm text-slate-900 dark:text-white">Odhadovaný čistý zisk za období:</span>
                  <span className="font-black text-base text-blue-700 dark:text-blue-400">{formatCurrency(filteredData.netProfit)}</span>
                </div>
              </div>

              {/* Handover signatures for accountant */}
              <div className="pt-4 grid grid-cols-2 gap-6 border-t border-slate-100 dark:border-slate-800 text-2xs text-slate-500">
                <div className="space-y-8">
                  <span>Předal zhotovitel: <strong>{contractor?.name || 'Živnostník'}</strong></span>
                  <div className="border-b border-slate-300 dark:border-slate-700"></div>
                  <span>Datum a podpis živnostníka</span>
                </div>

                <div className="space-y-8">
                  <span>Převzala k zaúčtování účetní / poradce:</span>
                  <div className="border-b border-slate-300 dark:border-slate-700"></div>
                  <span>Datum a podpis účetní</span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: INVOICES TABLE */}
          {activeTab === 'invoices' && (
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 dark:bg-slate-800 uppercase text-3xs font-black text-slate-600 dark:text-slate-300">
                  <tr>
                    <th className="p-2.5">Číslo</th>
                    <th className="p-2.5">Vystaveno</th>
                    <th className="p-2.5">Odběratel</th>
                    <th className="p-2.5 text-right">Částka</th>
                    <th className="p-2.5 text-center">Stav</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredData.invoices.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-4 text-center text-slate-400">
                        Žádné faktury v tomto období.
                      </td>
                    </tr>
                  ) : (
                    filteredData.invoices.map((inv) => (
                      <tr key={inv.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="p-2.5 font-bold font-mono text-blue-600">{inv.number}</td>
                        <td className="p-2.5">{formatDateCs(inv.issueDate)}</td>
                        <td className="p-2.5 font-medium">{inv.clientName}</td>
                        <td className="p-2.5 text-right font-black">{formatCurrency(inv.amount)}</td>
                        <td className="p-2.5 text-center">
                          <span
                            className={`px-2 py-0.5 rounded-md text-3xs font-extrabold uppercase tracking-wider ${
                              inv.isPaid
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                            }`}
                          >
                            {inv.isPaid ? 'ZAPLACENO' : 'NEUHRASENO'}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB 3: CASH RECEIPTS */}
          {activeTab === 'receipts' && (
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 dark:bg-slate-800 uppercase text-3xs font-black text-slate-600 dark:text-slate-300">
                  <tr>
                    <th className="p-2.5">Číslo PPD</th>
                    <th className="p-2.5">Datum</th>
                    <th className="p-2.5">Přijato od</th>
                    <th className="p-2.5">Účel</th>
                    <th className="p-2.5 text-right">Částka</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredData.cashReceipts.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-4 text-center text-slate-400">
                        Žádné hotovostní pokladní doklady v tomto období.
                      </td>
                    </tr>
                  ) : (
                    filteredData.cashReceipts.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="p-2.5 font-bold font-mono text-emerald-600">{r.receiptNumber}</td>
                        <td className="p-2.5">{formatDateCs(r.issueDate)}</td>
                        <td className="p-2.5 font-medium">{r.receivedFrom}</td>
                        <td className="p-2.5 text-slate-500 truncate max-w-xs">{r.purposeDescription}</td>
                        <td className="p-2.5 text-right font-black text-emerald-600">{formatCurrency(r.amount)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB 4: EXPENSES */}
          {activeTab === 'expenses' && (
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 dark:bg-slate-800 uppercase text-3xs font-black text-slate-600 dark:text-slate-300">
                  <tr>
                    <th className="p-2.5">Datum</th>
                    <th className="p-2.5">Dodavatel</th>
                    <th className="p-2.5">Popis nákupu</th>
                    <th className="p-2.5">Kategorie</th>
                    <th className="p-2.5 text-right">Částka</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredData.expenses.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-4 text-center text-slate-400">
                        Žádné výdaje v tomto období.
                      </td>
                    </tr>
                  ) : (
                    filteredData.expenses.map((e) => (
                      <tr key={e.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="p-2.5">{formatDateCs(e.date)}</td>
                        <td className="p-2.5 font-bold">{e.supplier || 'Neznámý'}</td>
                        <td className="p-2.5 text-slate-700 dark:text-slate-300 truncate max-w-xs">{e.title}</td>
                        <td className="p-2.5 text-3xs uppercase font-extrabold text-slate-500">{e.category}</td>
                        <td className="p-2.5 text-right font-black text-rose-600">{formatCurrency(e.amount)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB 5: TRIPS */}
          {activeTab === 'trips' && (
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 dark:bg-slate-800 uppercase text-3xs font-black text-slate-600 dark:text-slate-300">
                  <tr>
                    <th className="p-2.5">Datum</th>
                    <th className="p-2.5">Trasa</th>
                    <th className="p-2.5 text-right">Km</th>
                    <th className="p-2.5 text-right">Sazba</th>
                    <th className="p-2.5 text-right">Náhrada</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredData.trips.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-4 text-center text-slate-400">
                        Žádné jízdy v tomto období.
                      </td>
                    </tr>
                  ) : (
                    filteredData.trips.map((t) => (
                      <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="p-2.5">{formatDateCs(t.date)}</td>
                        <td className="p-2.5 font-medium">{t.origin} ➔ {t.destination}</td>
                        <td className="p-2.5 text-right font-bold">{t.distanceKm} km</td>
                        <td className="p-2.5 text-right text-slate-500">{t.ratePerKm} Kč</td>
                        <td className="p-2.5 text-right font-black text-amber-700 dark:text-amber-400">{formatCurrency(t.totalCost)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Action Footer */}
        <div className="p-4 sm:p-5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/80 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleExportCsv}
              className="min-h-[44px] px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs sm:text-sm flex items-center gap-2 shadow-sm cursor-pointer active:scale-95 transition-all"
              title="Exportovat tabulku do CSV (Pohoda / Excel)"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Export do Excel / CSV</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="min-h-[44px] px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-extrabold text-xs sm:text-sm flex items-center gap-2 cursor-pointer active:scale-95 transition-all"
              title="Vytisknout předávací protokol pro účetní"
            >
              <Printer className="w-4 h-4" />
              <span>Tisk protokolu</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSendEmail}
              className="min-h-[44px] px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs sm:text-sm flex items-center gap-2 shadow-sm cursor-pointer active:scale-95 transition-all"
              title="Odeslat souhrn účetní e-mailem"
            >
              <Mail className="w-4 h-4" />
              <span>Odeslat účetní</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 text-slate-800 dark:text-slate-200 font-extrabold text-xs sm:text-sm cursor-pointer"
            >
              Zavřít
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
