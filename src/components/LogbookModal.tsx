import React, { useState } from 'react';
import {
  X,
  Plus,
  Trash2,
  Car,
  Navigation,
  MapPin,
  Calendar,
  Printer,
  CheckCircle,
  TrendingUp,
  Share2,
  Zap,
} from 'lucide-react';
import { Contract, LogbookTrip, ContractExpense } from '../types/contract';
import { formatCurrency, formatDateCs } from '../utils/numberToWordsCs';

interface LogbookModalProps {
  isOpen: boolean;
  onClose: () => void;
  contract: Contract;
  onUpdateContract: (updated: Contract) => void;
  onToast?: (type: 'success' | 'error' | 'info', text: string) => void;
}

const COMMON_PURPOSES = [
  'Nástup a zahájení realizace',
  'Montážní práce na stavbě',
  'Zaměření a konzultace na místě',
  'Nákup materiálu a doprava na stavbu',
  'Dokončení prací a protokolární předání',
  'Záruční servis a kontrola',
];

export const LogbookModal: React.FC<LogbookModalProps> = ({
  isOpen,
  onClose,
  contract,
  onUpdateContract,
  onToast,
}) => {
  const [trips, setTrips] = useState<LogbookTrip[]>(contract.trips || []);
  const [activeTab, setActiveTab] = useState<'batch' | 'single' | 'list'>('batch');

  const contractorAddress = contract.contractor.address || 'Sídlo zhotovitele';
  const clientAddress = contract.client.address || contract.executionPlace || 'Adresa stavby';

  // Single trip state
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [origin, setOrigin] = useState(contractorAddress);
  const [destination, setDestination] = useState(clientAddress);
  const [distanceKm, setDistanceKm] = useState<number | ''>(30);
  const [ratePerKm, setRatePerKm] = useState<number | ''>(10);
  const [purpose, setPurpose] = useState(COMMON_PURPOSES[1]);
  const [vehicle, setVehicle] = useState('Firemní dodávka');
  const [billableToClient, setBillableToClient] = useState(false);

  // Batch trip generator state
  const defaultStartDate = contract.conclusionDate || contract.createdAt.split('T')[0];
  const defaultEndDate = contract.deliveryDate || new Date().toISOString().split('T')[0];
  const [batchStartDate, setBatchStartDate] = useState(defaultStartDate);
  const [batchEndDate, setBatchEndDate] = useState(defaultEndDate);
  const [batchWorkdaysOnly, setBatchWorkdaysOnly] = useState(true);
  const [batchOneWayKm, setBatchOneWayKm] = useState<number | ''>(18);
  const [batchRatePerKm, setBatchRatePerKm] = useState<number | ''>(10);
  const [batchVehicle, setBatchVehicle] = useState('Firemní dodávka');
  const [batchPurpose, setBatchPurpose] = useState('Montážní a stavební práce na zakázce');

  if (!isOpen) return null;

  const totalKm = trips.reduce((sum, t) => sum + (t.distanceKm || 0), 0);
  const totalCost = trips.reduce((sum, t) => sum + (t.totalCost || 0), 0);

  // Compute batch days
  const getBatchDays = () => {
    if (!batchStartDate || !batchEndDate) return [];
    const start = new Date(batchStartDate);
    const end = new Date(batchEndDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) return [];

    const days: string[] = [];
    const cur = new Date(start);
    while (cur <= end) {
      const dayOfWeek = cur.getDay(); // 0 is Sunday, 6 is Saturday
      if (!batchWorkdaysOnly || (dayOfWeek !== 0 && dayOfWeek !== 6)) {
        days.push(cur.toISOString().split('T')[0]);
      }
      cur.setDate(cur.getDate() + 1);
    }
    return days;
  };

  const batchDays = getBatchDays();
  const calculatedBatchKm = typeof batchOneWayKm === 'number' ? batchOneWayKm * 2 : 0;
  const calculatedBatchTotalKm = calculatedBatchKm * batchDays.length;
  const calculatedBatchTotalCost = Math.round(
    calculatedBatchTotalKm * (typeof batchRatePerKm === 'number' ? batchRatePerKm : 0)
  );

  const handleGenerateBatchTrips = () => {
    if (batchDays.length === 0) {
      if (onToast) onToast('error', 'Vyberte platný časový rozsah od–do.');
      return;
    }
    const oneWay = typeof batchOneWayKm === 'number' ? batchOneWayKm : parseFloat(String(batchOneWayKm));
    const rate = typeof batchRatePerKm === 'number' ? batchRatePerKm : parseFloat(String(batchRatePerKm));
    if (isNaN(oneWay) || oneWay <= 0) {
      if (onToast) onToast('error', 'Zadejte platnou vzdálenost jedné cesty v km.');
      return;
    }

    const dailyKm = Math.round(oneWay * 2);
    const dailyCost = Math.round(dailyKm * rate);

    const generatedTrips: LogbookTrip[] = batchDays.map((dayDate, idx) => ({
      id: `trip_batch_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 5)}`,
      date: dayDate,
      origin: contractorAddress,
      destination: clientAddress,
      distanceKm: dailyKm,
      ratePerKm: rate,
      totalCost: dailyCost,
      purpose: batchPurpose.trim() || 'Montážní a stavební práce na stavbě',
      vehicle: batchVehicle.trim() || undefined,
      createdAt: new Date().toISOString(),
    }));

    const updatedTrips = [...generatedTrips, ...trips];
    setTrips(updatedTrips);
    onUpdateContract({
      ...contract,
      trips: updatedTrips,
    });
    setActiveTab('list');

    if (onToast) {
      onToast(
        'success',
        `Vygenerováno ${generatedTrips.length} jízd (${generatedTrips.length * dailyKm} km, ${formatCurrency(
          generatedTrips.length * dailyCost
        )}).`
      );
    }
  };

  const handleAddTrip = (e: React.FormEvent) => {
    e.preventDefault();
    const km = typeof distanceKm === 'number' ? distanceKm : parseFloat(String(distanceKm));
    const rate = typeof ratePerKm === 'number' ? ratePerKm : parseFloat(String(ratePerKm));

    if (isNaN(km) || km <= 0) {
      if (onToast) onToast('error', 'Zadejte platný počet ujetých kilometrů.');
      return;
    }
    if (isNaN(rate) || rate < 0) {
      if (onToast) onToast('error', 'Zadejte platnou sazbu za kilometr.');
      return;
    }

    const calculatedCost = Math.round(km * rate);

    const newTrip: LogbookTrip = {
      id: `trip_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      date,
      origin: origin.trim(),
      destination: destination.trim(),
      distanceKm: km,
      ratePerKm: rate,
      totalCost: calculatedCost,
      purpose,
      vehicle: vehicle.trim() || undefined,
      billableToClient,
      createdAt: new Date().toISOString(),
    };

    const updatedTrips = [newTrip, ...trips];
    setTrips(updatedTrips);

    // Automaticky se zeptat / nabídnout zapsat do nákladů
    const updatedContract: Contract = {
      ...contract,
      trips: updatedTrips,
    };
    onUpdateContract(updatedContract);

    if (onToast) {
      onToast('success', `Jízda (${km} km, ${formatCurrency(calculatedCost)}) byla zapsána do Knihy jízd.`);
    }
  };

  const handleDeleteTrip = (id: string) => {
    const updatedTrips = trips.filter((t) => t.id !== id);
    setTrips(updatedTrips);
    onUpdateContract({
      ...contract,
      trips: updatedTrips,
    });
    if (onToast) onToast('info', 'Záznam jízdy byl smazán.');
  };

  // Synchronizace celkových nákladů na dopravu do výdajů zakázky
  const handleSyncToExpenses = () => {
    if (totalCost <= 0) {
      if (onToast) onToast('info', 'Zatím nemáte žádné ujeté kilometry k zaúčtování.');
      return;
    }

    const currentExpenses = contract.expenses || [];
    // Zjistíme, zda už existuje souhrnný náklad na knihu jízd
    const existingIndex = currentExpenses.findIndex(
      (e) => e.title.includes('Doprava k zakázce (Kniha jízd)')
    );

    let updatedExpenses: ContractExpense[];
    if (existingIndex >= 0) {
      updatedExpenses = [...currentExpenses];
      updatedExpenses[existingIndex] = {
        ...updatedExpenses[existingIndex],
        amount: totalCost,
        notes: `Automaticky aktualizováno z Knihy jízd: celkem ${totalKm} km`,
      };
    } else {
      const travelExpense: ContractExpense = {
        id: `exp_travel_${Date.now()}`,
        date: new Date().toISOString().split('T')[0],
        title: `Doprava k zakázce (Kniha jízd - ${totalKm} km)`,
        supplier: vehicle || 'Cestovní náhrady',
        amount: totalCost,
        category: 'travel',
        notes: `Automatický součet ${trips.length} jízd na stavbu`,
        createdAt: new Date().toISOString(),
      };
      updatedExpenses = [travelExpense, ...currentExpenses];
    }

    onUpdateContract({
      ...contract,
      expenses: updatedExpenses,
    });

    if (onToast) {
      onToast('success', `Náklady na dopravu (${formatCurrency(totalCost)}) byly přičteny do Výdajů zakázky.`);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 max-w-4xl w-full my-6 flex flex-col max-h-[92vh] overflow-hidden text-slate-800 dark:text-slate-100">
        {/* Header - Industrial Vehicle Dispatch */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-800 bg-slate-950 text-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/40 text-amber-400 flex items-center justify-center shrink-0">
              <Car className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-400 text-slate-950">
                  Kniha jízd
                </span>
                <span className="text-xs px-2 py-0.5 rounded font-mono font-semibold bg-slate-900 text-slate-300 border border-slate-800">
                  #{contract.contractNumber}
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-black tracking-tight text-white mt-0.5">
                Evidence výjezdů & cestovních náhrad
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

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
            <div className="p-4 rounded-xl bg-blue-50/60 dark:bg-blue-950/40 border border-blue-200/80 dark:border-blue-800/80">
              <span className="text-xs font-semibold text-blue-700 dark:text-blue-300 block mb-1 uppercase tracking-wider">
                Ujeto celkem
              </span>
              <span className="text-2xl font-bold text-blue-950 dark:text-blue-100 block">
                {totalKm} km
              </span>
              <span className="text-[11px] text-blue-600/80 dark:text-blue-300/80 mt-0.5 block">
                {trips.length} {trips.length === 1 ? 'zaznamenaná jízda' : trips.length < 5 ? 'zaznamenané jízdy' : 'zaznamenaných jízd'}
              </span>
            </div>

            <div className="p-4 rounded-xl bg-indigo-50/60 dark:bg-indigo-950/40 border border-indigo-200/80 dark:border-indigo-800/80">
              <span className="text-xs font-semibold text-indigo-700 dark:text-indigo-300 block mb-1 uppercase tracking-wider">
                Cestovní náhrady / Náklady
              </span>
              <span className="text-2xl font-bold text-indigo-950 dark:text-indigo-100 block">
                {formatCurrency(totalCost)}
              </span>
              <span className="text-[11px] text-indigo-600/80 dark:text-indigo-300/80 mt-0.5 block">
                Kalkulováno dle sjednané sazby za km
              </span>
            </div>

            <div className="p-4 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-800/80 flex flex-col justify-between">
              <div>
                <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 block mb-1 uppercase tracking-wider">
                  Započíst do výdajů
                </span>
                <span className="text-xs text-emerald-800/80 dark:text-emerald-300/80 block">
                  Přenést částku {formatCurrency(totalCost)} přímo do nákladů této zakázky.
                </span>
              </div>
              <button
                type="button"
                onClick={handleSyncToExpenses}
                className="mt-2.5 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
              >
                <TrendingUp className="w-3.5 h-3.5" />
                <span>Zaúčtovat do ziskovosti</span>
              </button>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex border-b border-slate-200 dark:border-slate-800 gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('batch')}
              className={`pb-2.5 px-3 text-xs sm:text-sm font-bold flex items-center gap-1.5 border-b-2 cursor-pointer transition-all ${
                activeTab === 'batch'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Zap className="w-4 h-4 text-amber-500" />
              <span>Hromadný generátor (Celá stavba)</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('single')}
              className={`pb-2.5 px-3 text-xs sm:text-sm font-bold flex items-center gap-1.5 border-b-2 cursor-pointer transition-all ${
                activeTab === 'single'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Plus className="w-4 h-4" />
              <span>Jednorázový zápis cesty</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('list')}
              className={`pb-2.5 px-3 text-xs sm:text-sm font-bold flex items-center gap-1.5 border-b-2 cursor-pointer transition-all ${
                activeTab === 'list'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Car className="w-4 h-4" />
              <span>Přehled jízd ({trips.length})</span>
            </button>
          </div>

          {/* TAB 1: BATCH TRIP GENERATOR */}
          {activeTab === 'batch' && (
            <div className="p-4 sm:p-5 rounded-xl border-2 border-blue-200 dark:border-blue-900/60 bg-blue-50/30 dark:bg-blue-950/20 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                    <Zap className="w-5 h-5 text-amber-500" />
                    <span>Automatické vygenerování jízd pro celou dobu realizace</span>
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                    Ušetří ruční vypisování desítek jízd – vytvoří cestovní příkazy za každý den stavby.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Od data (zahájení)
                  </label>
                  <input
                    type="date"
                    value={batchStartDate}
                    onChange={(e) => setBatchStartDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Do data (dokončení)
                  </label>
                  <input
                    type="date"
                    value={batchEndDate}
                    onChange={(e) => setBatchEndDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Vzdálenost 1 cesta (km)
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="0.5"
                    value={batchOneWayKm}
                    onChange={(e) => setBatchOneWayKm(e.target.value ? parseFloat(e.target.value) : '')}
                    placeholder="km"
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-semibold"
                  />
                  <span className="text-3xs text-slate-400 mt-0.5 block">
                    Tam i zpět denně: {calculatedBatchKm} km
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Sazba (Kč/km)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={batchRatePerKm}
                    onChange={(e) => setBatchRatePerKm(e.target.value ? parseFloat(e.target.value) : '')}
                    placeholder="Kč/km"
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-semibold"
                  />
                </div>
              </div>

              {/* Addresses & Vehicles */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Místo výjezdu ➔ Cíl
                  </label>
                  <div className="text-xs font-medium text-slate-700 dark:text-slate-300 p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                    {contractorAddress} ➔ <strong>{clientAddress}</strong>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Vozidlo & Účel
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={batchVehicle}
                      onChange={(e) => setBatchVehicle(e.target.value)}
                      placeholder="Vozidlo"
                      className="px-2.5 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-semibold"
                    />
                    <input
                      type="text"
                      value={batchPurpose}
                      onChange={(e) => setBatchPurpose(e.target.value)}
                      placeholder="Účel"
                      className="px-2.5 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-semibold"
                    />
                  </div>
                </div>
              </div>

              {/* Options */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <label className="flex items-center gap-2 cursor-pointer font-bold text-xs text-slate-700 dark:text-slate-300 select-none">
                  <input
                    type="checkbox"
                    checked={batchWorkdaysOnly}
                    onChange={(e) => setBatchWorkdaysOnly(e.target.checked)}
                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                  />
                  <span>Pouze pracovní dny (vynechat soboty a neděle)</span>
                </label>

                <div className="text-xs font-black text-blue-700 dark:text-blue-300">
                  {batchDays.length} dnů · celkem {calculatedBatchTotalKm} km ·{' '}
                  <span className="text-emerald-600 dark:text-emerald-400 font-black">
                    {formatCurrency(calculatedBatchTotalCost)}
                  </span>
                </div>
              </div>

              {/* Action button */}
              <button
                type="button"
                onClick={handleGenerateBatchTrips}
                disabled={batchDays.length === 0}
                className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-black text-sm flex items-center justify-center gap-2 shadow-md cursor-pointer active:scale-98 transition-all"
              >
                <Zap className="w-5 h-5 text-amber-300" />
                <span>
                  Vygenerovat všech {batchDays.length} jízd ({calculatedBatchTotalKm} km, {formatCurrency(calculatedBatchTotalCost)})
                </span>
              </button>
            </div>
          )}

          {/* TAB 2: SINGLE TRIP FORM */}
          {activeTab === 'single' && (
            <div className="p-4 sm:p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-3 flex items-center gap-2">
                <Plus className="w-4 h-4 text-blue-600" />
                <span>Zapsat novou jízdu na stavbu</span>
              </h3>

            <form onSubmit={handleAddTrip} className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                {/* Datum */}
                <div className="sm:col-span-3">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Datum jízdy
                  </label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-2.5 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                    required
                  />
                </div>

                {/* Účel */}
                <div className="sm:col-span-5">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Účel cesty
                  </label>
                  <select
                    value={purpose}
                    onChange={(e) => setPurpose(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  >
                    {COMMON_PURPOSES.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Vozidlo */}
                <div className="sm:col-span-4">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Vozidlo / SPZ
                  </label>
                  <input
                    type="text"
                    value={vehicle}
                    onChange={(e) => setVehicle(e.target.value)}
                    placeholder="např. Ford Transit / 1AB 1234"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                </div>
              </div>

              {/* Trasa Odkud - Kam */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                <div className="sm:col-span-6">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    <span>Místo výjezdu (odkud)</span>
                  </label>
                  <input
                    type="text"
                    value={origin}
                    onChange={(e) => setOrigin(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                    required
                  />
                </div>

                <div className="sm:col-span-6">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-blue-600" />
                    <span>Cíl cesty (kam / stavba)</span>
                  </label>
                  <input
                    type="text"
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                    required
                  />
                </div>
              </div>

              {/* Km + Sazba + Tlačítko */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                <div className="sm:col-span-3">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Ujeto km (tam i zpět) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="0.5"
                    value={distanceKm}
                    onChange={(e) => setDistanceKm(e.target.value ? parseFloat(e.target.value) : '')}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-bold focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                    required
                  />
                </div>

                <div className="sm:col-span-3">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Sazba (Kč/km) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={ratePerKm}
                    onChange={(e) => setRatePerKm(e.target.value ? parseFloat(e.target.value) : '')}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-bold focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                    required
                  />
                </div>

                <div className="sm:col-span-3">
                  <div className="text-xs font-semibold text-slate-500 mb-1">Náhrada za jízdu:</div>
                  <div className="py-2 text-base font-bold text-blue-700 dark:text-blue-300">
                    {formatCurrency(
                      Math.round(
                        (typeof distanceKm === 'number' ? distanceKm : 0) *
                          (typeof ratePerKm === 'number' ? ratePerKm : 0)
                      )
                    )}
                  </div>
                </div>

                <div className="sm:col-span-3">
                  <button
                    type="submit"
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm transition-colors shadow-xs cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Zapsat jízdu</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        )}

          {/* Tabulka jízd */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Přehled uskutečněných jízd ({trips.length})
              </h3>
              {trips.length > 0 && (
                <button
                  type="button"
                  onClick={handlePrint}
                  className="inline-flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 hover:text-blue-600 font-medium cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Vytisknout knihu jízd</span>
                </button>
              )}
            </div>

            {trips.length === 0 ? (
              <div className="text-center py-8 px-4 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
                <Car className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
                  Zatím jste nezaznamenali žádnou jízdu k této zakázce.
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Po každém výjezdu na stavbu stačí zapsat kilometry výše pro evidenci nákladů.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold uppercase text-[11px] tracking-wider">
                    <tr>
                      <th className="py-2.5 px-3">Datum</th>
                      <th className="py-2.5 px-3">Trasa</th>
                      <th className="py-2.5 px-3 hidden sm:table-cell">Účel jízdy</th>
                      <th className="py-2.5 px-3 text-right">Km</th>
                      <th className="py-2.5 px-3 text-right hidden sm:table-cell">Sazba</th>
                      <th className="py-2.5 px-3 text-right">Náhrada</th>
                      <th className="py-2.5 px-3 text-right">Akce</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {trips.map((tr) => (
                      <tr
                        key={tr.id}
                        className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                      >
                        <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap">
                          {formatDateCs(tr.date)}
                        </td>
                        <td className="py-2.5 px-3 text-slate-800 dark:text-slate-200">
                          <div className="font-medium text-xs sm:text-sm">{tr.destination}</div>
                          <div className="text-[11px] text-slate-400 truncate max-w-xs">
                            z: {tr.origin}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300 hidden sm:table-cell text-xs">
                          {tr.purpose}
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-slate-900 dark:text-white whitespace-nowrap">
                          {tr.distanceKm} km
                        </td>
                        <td className="py-2.5 px-3 text-right text-slate-500 hidden sm:table-cell">
                          {tr.ratePerKm} Kč/km
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-blue-700 dark:text-blue-300 whitespace-nowrap">
                          {formatCurrency(tr.totalCost)}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <button
                            type="button"
                            onClick={() => handleDeleteTrip(tr.id)}
                            className="p-1 text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-colors cursor-pointer"
                            title="Smazat jízdu"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-50 dark:bg-slate-800/80 font-bold border-t border-slate-200 dark:border-slate-700">
                    <tr>
                      <td colSpan={2} className="py-2.5 px-3 text-slate-700 dark:text-slate-300">
                        Celkem kniha jízd:
                      </td>
                      <td className="hidden sm:table-cell"></td>
                      <td className="py-2.5 px-3 text-right text-slate-900 dark:text-white">
                        {totalKm} km
                      </td>
                      <td className="hidden sm:table-cell"></td>
                      <td className="py-2.5 px-3 text-right text-blue-700 dark:text-blue-300">
                        {formatCurrency(totalCost)}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Kniha jízd splňuje náležitosti cestovních náhrad pro daňovou evidenci OSVČ.
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-900 dark:bg-slate-100 hover:bg-slate-800 dark:hover:bg-white text-white dark:text-slate-900 font-semibold text-sm transition-colors cursor-pointer shadow-xs"
          >
            Hotovo
          </button>
        </div>
      </div>
    </div>
  );
};
