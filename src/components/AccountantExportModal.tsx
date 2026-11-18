import { getTripCost } from '../utils/tripCost';
import React, { useState, useMemo } from 'react';
import { buildIsdoc, isdocFileName } from '../utils/isdoc';
import { createZip, downloadFile } from '../utils/zipStore';
import { getFinalInvoiceNumber } from '../utils/invoiceNumbering';
import { Dialog } from './Dialog';
import { expenseCategoryLabel } from '../utils/expenseCategories';
import { FileSpreadsheet, FileCode2, Printer, Mail } from 'lucide-react';
import { Contract, ContractorProfile } from '../types/contract';
import { formatCurrency, formatDateCs } from '../utils/numberToWordsCs';
import { triggerHaptic } from '../utils/haptics';
import { isInvoiceable, getContractTotal, getFinalInvoiceDates, vatIncludedInGross, getVatRate, isReverseCharge, hasAdvanceTaxDoc, getAdvanceTaxBreakdown } from '../utils/invoiceMath';

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
      const monthNames = ['leden', 'únor', 'březen', 'duben', 'květen', 'červen', 'červenec', 'srpen', 'září', 'říjen', 'listopad', 'prosinec'];
      label = `${monthNames[currentMonth]} ${selectedYear}`;
    } else if (period === 'last_month') {
      const targetMonth = currentMonth === 0 ? 11 : currentMonth - 1;
      const targetYear = currentMonth === 0 ? selectedYear - 1 : selectedYear;
      const lastDay = new Date(targetYear, targetMonth + 1, 0).getDate();
      from = `${targetYear}-${pad(targetMonth + 1)}-01`;
      to = `${targetYear}-${pad(targetMonth + 1)}-${pad(lastDay)}`;
      const monthNames = ['leden', 'únor', 'březen', 'duben', 'květen', 'červen', 'červenec', 'srpen', 'září', 'říjen', 'listopad', 'prosinec'];
      label = `${monthNames[targetMonth]} ${targetYear}`;
    } else if (period === 'q1') {
      from = `${selectedYear}-01-01`;
      to = `${selectedYear}-03-31`;
      label = `1. čtvrtletí ${selectedYear}`;
    } else if (period === 'q2') {
      from = `${selectedYear}-04-01`;
      to = `${selectedYear}-06-30`;
      label = `2. čtvrtletí ${selectedYear}`;
    } else if (period === 'q3') {
      from = `${selectedYear}-07-01`;
      to = `${selectedYear}-09-30`;
      label = `3. čtvrtletí ${selectedYear}`;
    } else if (period === 'q4') {
      from = `${selectedYear}-10-01`;
      to = `${selectedYear}-12-31`;
      label = `4. čtvrtletí ${selectedYear}`;
    } else if (period === 'whole_year') {
      from = `${selectedYear}-01-01`;
      to = `${selectedYear}-12-31`;
      label = `rok ${selectedYear}`;
    } else {
      from = customFrom;
      to = customTo;
      label = `období ${formatDateCs(customFrom)} – ${formatDateCs(customTo)}`;
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
      clientDic?: string;
      amount: number;
      vat: number;
      reverseCharge: boolean;
      /** Zakázka a druh dokladu (pro ISDOC): konečná faktura, nebo daňový doklad k přijaté záloze */
      contractId: string;
      kind: 'final' | 'advance_tax';
      note?: string;
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
      // Účetní dostane jen vystavené faktury (s číslem); stornované vylučuje isInvoiceable
      if (isInvoiceable(c) && getFinalInvoiceNumber(c) && baseDate >= dateFrom && baseDate <= dateTo) {
        const totalPrice = getContractTotal(c);
        // Ceny jsou u plátců uvedené včetně DPH, daň je tedy část ceny (21/121, u snížené sazby 12/112), ne přirážka.
        // Při přenesení daňové povinnosti je cena bez DPH a daň přizná odběratel (kontrolní hlášení A.1, kód 4).
        const reverseCharge = isReverseCharge(c);
        // Záloha zdaněná dokladem k přijaté platbě: konečná faktura daní jen zbytek (částka i DPH bez zálohy),
        // aby se příjem a daň ze zálohy nepočítaly dvakrát
        const taxedAdvance = hasAdvanceTaxDoc(c) ? getAdvanceTaxBreakdown(c) : null;
        const vatVal = c.hasVat && !reverseCharge
          ? Math.round((vatIncludedInGross(totalPrice, getVatRate(c)) - (taxedAdvance ? Math.round(taxedAdvance.vat) : 0)))
          : 0;

        invoices.push({
          id: c.id,
          contractId: c.id,
          kind: 'final',
          note: taxedAdvance ? `bez zálohy zdaněné dokladem DP-${c.advanceTaxDocNumber}` : undefined,
          number: `FA-${getFinalInvoiceNumber(c)}`,
          contractNumber: c.contractNumber,
          issueDate: baseDate,
          taxDate: invoiceDates.taxDate,
          dueDate: invoiceDates.dueDate,
          clientName: c.client.name,
          clientIco: c.client.ico,
          clientDic: c.client.dic,
          amount: taxedAdvance ? totalPrice - taxedAdvance.gross : totalPrice,
          vat: vatVal,
          reverseCharge,
          isPaid: c.status === 'paid' || !!c.paidDate,
          paidDate: c.paidDate,
          description: c.workDescription,
        });
      }

      // 1b. Daňové doklady k přijatým zálohám (daň se přiznává ke dni přijetí platby)
      if (hasAdvanceTaxDoc(c) && !c.invoiceCancelledAt && c.advancePaidDate! >= dateFrom && c.advancePaidDate! <= dateTo) {
        const adv = getAdvanceTaxBreakdown(c);
        invoices.push({
          id: `${c.id}_dp`,
          contractId: c.id,
          kind: 'advance_tax',
          note: 'daňový doklad k přijaté záloze',
          number: `DP-${c.advanceTaxDocNumber}`,
          contractNumber: c.contractNumber,
          issueDate: (c.advanceTaxDocIssuedAt || c.advancePaidDate!).slice(0, 10),
          taxDate: c.advancePaidDate!,
          dueDate: c.advancePaidDate!,
          clientName: c.client.name,
          clientIco: c.client.ico,
          clientDic: c.client.dic,
          amount: adv.gross,
          vat: Math.round(adv.vat),
          reverseCharge: false,
          isPaid: true,
          paidDate: c.advancePaidDate,
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
            totalCost: getTripCost(tr),
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
    csv += `Podklady pro účetní – ${periodLabel}\r\n`;
    csv += `Zhotovitel:;${contractor?.name || 'Živnostník'};IČO:;${contractor?.ico || ''}\r\n`;
    csv += `Období od:;${dateFrom};do:;${dateTo}\r\n\r\n`;

    // 1. FAKTURY
    csv += `1. VYDANÉ FAKTURY A ZÁLOHY\r\n`;
    csv += `Číslo faktury;Smlouva;Datum vystavení;Splatnost;Odběratel;IČO;DIČ;Částka (Kč);DPH;Režim DPH;Stav\r\n`;
    filteredData.invoices.forEach((i) => {
      csv += `"${i.number}";"${i.contractNumber}";"${i.issueDate}";"${i.dueDate}";"${i.clientName}";"${i.clientIco || ''}";"${i.clientDic || ''}";${i.amount};${i.vat};"${i.reverseCharge ? 'přenesení daňové povinnosti (kód 4)' : i.note || ''}";"${i.isPaid ? 'Zaplaceno' : 'Neuhrazeno'}"\r\n`;
    });
    csv += `Celkem faktury:;;;;;;;${filteredData.sumInvoices};;;\r\n\r\n`;

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
      csv += `"${e.date}";"${e.contractNumber}";"${e.supplier || ''}";"${e.title}";"${expenseCategoryLabel(e.category)}";${e.amount}\r\n`;
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

  // Faktury za období ve formátu ISDOC (jedna faktura = jeden soubor, dohromady v ZIPu)
  const handleExportIsdoc = () => {
    const files = filteredData.invoices.flatMap((i) => {
      const c = contracts.find((x) => x.id === i.contractId);
      return c ? [{ name: isdocFileName(c, i.kind), content: buildIsdoc(c, i.kind) }] : [];
    });
    if (files.length === 0) {
      onToast?.('info', 'V tomto období není žádná vystavená faktura.');
      return;
    }
    downloadFile(`Faktury_ISDOC_${period}_${selectedYear}.zip`, createZip(files), 'application/zip');
    onToast?.('success', files.length === 1 ? 'Stažena 1 faktura ve formátu ISDOC.' : `Staženo ${files.length} faktur ve formátu ISDOC (ZIP).`);
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

  const outline =
    'min-h-11 px-4 inline-flex items-center justify-center gap-2 rounded-md border-[1.5px] border-slate-900 dark:border-slate-500 text-slate-900 dark:text-slate-100 font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors';
  const chip = (on: boolean) =>
    `min-h-11 px-3 inline-flex items-center justify-center rounded-md border font-medium cursor-pointer transition-colors ${
      on
        ? 'border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-900'
        : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800'
    }`;
  const count = (n: number, one: string, few: string, many: string) => `${n} ${n === 1 ? one : n >= 2 && n <= 4 ? few : many}`;
  const tabs: { id: typeof activeTab; label: string }[] = [
    { id: 'summary', label: 'Souhrn' },
    { id: 'invoices', label: `Faktury (${filteredData.invoices.length})` },
    { id: 'receipts', label: `Hotovost (${filteredData.cashReceipts.length})` },
    { id: 'expenses', label: `Výdaje (${filteredData.expenses.length})` },
    { id: 'trips', label: `Jízdy (${filteredData.trips.length})` },
  ];
  const th = 'px-4 py-2.5 font-semibold text-slate-600 dark:text-slate-400 whitespace-nowrap';
  const td = 'px-4 py-3';
  const tableBox = 'overflow-x-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md';
  const emptyRow = (text: string) => (
    <tr>
      <td colSpan={5} className="px-4 py-5 text-slate-600 dark:text-slate-400">
        {text}
      </td>
    </tr>
  );

  return (
    <Dialog
      title="Podklady pro účetní"
      subtitle="Faktury, doklady a přehledy za zvolené období."
      size="3xl"
      bare
      closeOnBackdrop={false}
      onClose={onClose}
    >
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 text-[15px]">
        {/* Období */}
        <div className="space-y-2.5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h3 className="font-display font-semibold text-xl text-slate-900 dark:text-white">Období</h3>
            <label className="inline-flex items-center gap-2 text-slate-700 dark:text-slate-300">
              Rok
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
                className="min-h-11 px-3 rounded-md border-[1.5px] border-slate-900 dark:border-slate-500 bg-white dark:bg-slate-950 text-slate-900 dark:text-white font-semibold"
              >
                {[currentYear, currentYear - 1, currentYear - 2].map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div role="group" aria-label="Období" className="flex flex-wrap gap-2">
            {[
              { id: 'this_month', label: 'Tento měsíc' },
              { id: 'last_month', label: 'Minulý měsíc' },
              { id: 'q1', label: '1. čtvrtletí' },
              { id: 'q2', label: '2. čtvrtletí' },
              { id: 'q3', label: '3. čtvrtletí' },
              { id: 'q4', label: '4. čtvrtletí' },
              { id: 'whole_year', label: 'Celý rok' },
            ].map((p) => (
              <button
                key={p.id}
                type="button"
                aria-pressed={period === p.id}
                onClick={() => {
                  triggerHaptic('selection');
                  setPeriod(p.id as PeriodType);
                }}
                className={chip(period === p.id)}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Záložky */}
        <div role="tablist" aria-label="Podklady" className="flex gap-1 overflow-x-auto border-b border-slate-200 dark:border-slate-800">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={activeTab === t.id}
              onClick={() => setActiveTab(t.id)}
              className={`min-h-11 px-3 -mb-px border-b-2 font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                activeTab === t.id
                  ? 'border-blue-600 text-blue-600 dark:border-blue-300 dark:text-blue-300'
                  : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Souhrn: jeden rámeček s řádky (vzor Přehledu) */}
        {activeTab === 'summary' && (
          <div className="space-y-5">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md divide-y divide-slate-100 dark:divide-slate-800">
              <div className="px-5 py-4">
                <div className="text-slate-600 dark:text-slate-400">Odhad zisku za {periodLabel}</div>
                <div
                  className={`font-display font-bold text-[40px] leading-none tabular-nums mt-1 ${
                    filteredData.netProfit < 0 ? 'text-rose-700 dark:text-rose-400' : 'text-slate-900 dark:text-white'
                  }`}
                >
                  {formatCurrency(filteredData.netProfit)}
                </div>
              </div>
              {[
                { label: `Vystavené faktury (${count(filteredData.invoices.length, 'faktura', 'faktury', 'faktur')})`, value: formatCurrency(filteredData.sumInvoices) },
                { label: `z toho v hotovosti (${count(filteredData.cashReceipts.length, 'pokladní doklad', 'pokladní doklady', 'pokladních dokladů')})`, value: formatCurrency(filteredData.sumCashReceipts), sub: true },
                { label: `Výdaje (${count(filteredData.expenses.length, 'doklad', 'doklady', 'dokladů')})`, value: `− ${formatCurrency(filteredData.sumExpenses)}` },
                { label: `Kniha jízd (${filteredData.sumTripsKm} km)`, value: `− ${formatCurrency(filteredData.sumTrips)}` },
              ].map((r) => (
                <div key={r.label} className="px-5 py-3 flex items-baseline justify-between gap-4">
                  <span className={`text-slate-600 dark:text-slate-400 ${r.sub ? 'pl-4' : ''}`}>{r.label}</span>
                  <span className="font-display font-semibold text-xl tabular-nums text-slate-900 dark:text-white whitespace-nowrap">{r.value}</span>
                </div>
              ))}
            </div>
            <p className="text-slate-600 dark:text-slate-400">
              Odhad zisku je příjem z faktur po odečtení výdajů a jízd. Je orientační – daňový základ určí účetní.
            </p>

            {/* Předání účetní (podpisy pro vytištěný protokol) */}
            <div className="pt-4 grid grid-cols-1 sm:grid-cols-2 gap-6 border-t border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400">
              <div className="space-y-8">
                <div>
                  Předal: <strong className="text-slate-900 dark:text-white">{contractor?.name || 'Živnostník'}</strong>
                </div>
                <div className="border-b border-slate-400 dark:border-slate-600" />
                <div>Datum a podpis</div>
              </div>
              <div className="space-y-8">
                <div>Převzala účetní</div>
                <div className="border-b border-slate-400 dark:border-slate-600" />
                <div>Datum a podpis</div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'invoices' && (
          <div className={tableBox}>
            <table className="w-full text-left">
              <thead className="border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className={th}>Číslo</th>
                  <th className={th}>Vystaveno</th>
                  <th className={th}>Odběratel</th>
                  <th className={`${th} text-right`}>Částka</th>
                  <th className={th}>Stav</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredData.invoices.length === 0
                  ? emptyRow('V tomto období není žádná faktura.')
                  : filteredData.invoices.map((inv) => (
                      <tr key={inv.id}>
                        <td className={`${td} font-semibold whitespace-nowrap`}>{inv.number}</td>
                        <td className={`${td} whitespace-nowrap`}>{formatDateCs(inv.issueDate)}</td>
                        <td className={td}>
                          {inv.clientName}
                          {(inv.reverseCharge || inv.note) && (
                            <span className="block text-slate-600 dark:text-slate-400">{inv.reverseCharge ? 'daň odvede zákazník' : inv.note}</span>
                          )}
                        </td>
                        <td className={`${td} text-right font-semibold tabular-nums whitespace-nowrap`}>{formatCurrency(inv.amount)}</td>
                        <td className={td}>
                          <span
                            className={`inline-flex px-2.5 py-0.5 rounded-full font-medium whitespace-nowrap ${
                              inv.isPaid
                                ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                : 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200'
                            }`}
                          >
                            {inv.isPaid ? 'Zaplaceno' : 'Neuhrazeno'}
                          </span>
                        </td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'receipts' && (
          <div className={tableBox}>
            <table className="w-full text-left">
              <thead className="border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className={th}>Doklad</th>
                  <th className={th}>Datum</th>
                  <th className={th}>Přijato od</th>
                  <th className={th}>Účel</th>
                  <th className={`${th} text-right`}>Částka</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredData.cashReceipts.length === 0
                  ? emptyRow('V tomto období není žádný pokladní doklad.')
                  : filteredData.cashReceipts.map((r) => (
                      <tr key={r.id}>
                        <td className={`${td} font-semibold whitespace-nowrap`}>{r.receiptNumber}</td>
                        <td className={`${td} whitespace-nowrap`}>{formatDateCs(r.issueDate)}</td>
                        <td className={td}>{r.receivedFrom}</td>
                        <td className={`${td} text-slate-600 dark:text-slate-400 truncate max-w-xs`}>{r.purposeDescription}</td>
                        <td className={`${td} text-right font-semibold tabular-nums whitespace-nowrap`}>{formatCurrency(r.amount)}</td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'expenses' && (
          <div className={tableBox}>
            <table className="w-full text-left">
              <thead className="border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className={th}>Datum</th>
                  <th className={th}>Co</th>
                  <th className={th}>Kde</th>
                  <th className={th}>Druh</th>
                  <th className={`${th} text-right`}>Částka</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredData.expenses.length === 0
                  ? emptyRow('V tomto období není žádný výdaj.')
                  : filteredData.expenses.map((e) => (
                      <tr key={e.id}>
                        <td className={`${td} whitespace-nowrap`}>{formatDateCs(e.date)}</td>
                        <td className={`${td} font-semibold truncate max-w-xs`}>{e.title}</td>
                        <td className={`${td} text-slate-600 dark:text-slate-400`}>{e.supplier || '–'}</td>
                        <td className={`${td} text-slate-600 dark:text-slate-400 whitespace-nowrap`}>{expenseCategoryLabel(e.category)}</td>
                        <td className={`${td} text-right font-semibold tabular-nums whitespace-nowrap`}>{formatCurrency(e.amount)}</td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'trips' && (
          <div className={tableBox}>
            <table className="w-full text-left">
              <thead className="border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className={th}>Datum</th>
                  <th className={th}>Trasa</th>
                  <th className={`${th} text-right`}>Km</th>
                  <th className={`${th} text-right`}>Sazba</th>
                  <th className={`${th} text-right`}>Náhrada</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredData.trips.length === 0
                  ? emptyRow('V tomto období není žádná jízda.')
                  : filteredData.trips.map((t) => (
                      <tr key={t.id}>
                        <td className={`${td} whitespace-nowrap`}>{formatDateCs(t.date)}</td>
                        <td className={td}>
                          {t.origin} → {t.destination}
                        </td>
                        <td className={`${td} text-right tabular-nums whitespace-nowrap`}>{t.distanceKm} km</td>
                        <td className={`${td} text-right tabular-nums text-slate-600 dark:text-slate-400 whitespace-nowrap`}>{t.ratePerKm} Kč</td>
                        <td className={`${td} text-right font-semibold tabular-nums whitespace-nowrap`}>{formatCurrency(t.totalCost)}</td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Patička */}
      <div className="px-4 sm:px-6 py-3.5 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2.5 shrink-0">
        <div className="flex flex-wrap items-center gap-2.5">
          <button type="button" onClick={handleExportCsv} className={outline} title="Tabulka pro Excel nebo účetní program (CSV)">
            <FileSpreadsheet className="w-[18px] h-[18px]" />
            Tabulka CSV
          </button>
          <button
            type="button"
            onClick={handleExportIsdoc}
            className={outline}
            title="Faktury jako elektronické doklady ISDOC – načte je Pohoda, Money, ABRA a další účetní programy"
          >
            <FileCode2 className="w-[18px] h-[18px]" />
            Faktury v ISDOC (ZIP)
          </button>
          <button type="button" onClick={handlePrint} className={outline}>
            <Printer className="w-[18px] h-[18px]" />
            Vytisknout
          </button>
        </div>
        <button
          type="button"
          onClick={handleSendEmail}
          className="min-h-11 px-5 inline-flex items-center justify-center gap-2 rounded-md border-[1.5px] border-slate-900 bg-amber-400 hover:bg-amber-300 text-slate-900 font-semibold cursor-pointer transition-colors"
        >
          <Mail className="w-[18px] h-[18px]" />
          Odeslat účetní
        </button>
      </div>
    </Dialog>
  );
};
