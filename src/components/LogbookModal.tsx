import { getTripCost } from '../utils/tripCost';
import React, { useState } from 'react';
import { getSiteAddress } from '../utils/siteAddress';
import { Dialog } from './Dialog';
import { Printer, Trash2 } from 'lucide-react';
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
  const [activeTab, setActiveTab] = useState<'batch' | 'single'>('single');

  const contractorAddress = contract.contractor.address || 'Sídlo zhotovitele';
  const clientAddress = getSiteAddress(contract) || 'Adresa stavby';

  // Single trip state
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [origin, setOrigin] = useState(contractorAddress);
  const [destination, setDestination] = useState(clientAddress);
  const [distanceKm, setDistanceKm] = useState<number | ''>('');
  const [ratePerKm, setRatePerKm] = useState<number | ''>('');
  const [purpose, setPurpose] = useState(COMMON_PURPOSES[1]);
  const [vehicle, setVehicle] = useState('Firemní dodávka');
  const [billableToClient, setBillableToClient] = useState(false);

  // Batch trip generator state
  const defaultStartDate = contract.conclusionDate || contract.createdAt.split('T')[0];
  const defaultEndDate = contract.deliveryDate || new Date().toISOString().split('T')[0];
  const [batchStartDate, setBatchStartDate] = useState(defaultStartDate);
  const [batchEndDate, setBatchEndDate] = useState(defaultEndDate);
  const [batchWorkdaysOnly, setBatchWorkdaysOnly] = useState(true);
  const [batchOneWayKm, setBatchOneWayKm] = useState<number | ''>('');
  const [batchRatePerKm, setBatchRatePerKm] = useState<number | ''>('');
  // Kniha jízd má odpovídat skutečným cestám: zapíšou se jen dny, které uživatel sám vybere
  const [batchSelected, setBatchSelected] = useState<string[]>([]);
  const [batchVehicle, setBatchVehicle] = useState('Firemní dodávka');
  const [batchPurpose, setBatchPurpose] = useState('Montážní a stavební práce na zakázce');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [deleteTarget, setDeleteTarget] = useState<LogbookTrip | null>(null);
  const showErrors = (next: Record<string, string>) => {
    setErrors(next);
    const first = Object.keys(next)[0];
    if (first) document.getElementById(first)?.focus();
    return !!first;
  };
  const clearError = (id: string) => setErrors((x) => (x[id] ? { ...x, [id]: '' } : x));

  if (!isOpen) return null;

  const totalKm = trips.reduce((sum, t) => sum + (t.distanceKm || 0), 0);
  const totalCost = trips.reduce((sum, t) => sum + getTripCost(t), 0);

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
  const selectedDays = batchDays.filter((d) => batchSelected.includes(d));
  const toggleBatchDay = (day: string) =>
    setBatchSelected((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]));
  const calculatedBatchKm = typeof batchOneWayKm === 'number' ? batchOneWayKm * 2 : 0;
  const calculatedBatchTotalKm = calculatedBatchKm * selectedDays.length;
  const calculatedBatchTotalCost = Math.round(
    calculatedBatchTotalKm * (typeof batchRatePerKm === 'number' ? batchRatePerKm : 0)
  );

  const handleGenerateBatchTrips = () => {
    if (selectedDays.length === 0) {
      if (onToast) onToast('error', 'Vyberte dny, kdy jste na stavbu jeli.');
      return;
    }
    const oneWay = typeof batchOneWayKm === 'number' ? batchOneWayKm : parseFloat(String(batchOneWayKm));
    const rate = typeof batchRatePerKm === 'number' ? batchRatePerKm : parseFloat(String(batchRatePerKm));
    const next: Record<string, string> = {};
    if (isNaN(oneWay) || oneWay <= 0) next['davka-km'] = 'Zadejte vzdálenost jedné cesty.';
    if (isNaN(rate) || rate < 0) next['davka-sazba'] = 'Zadejte sazbu za kilometr.';
    if (showErrors(next)) return;

    const dailyKm = Math.round(oneWay * 2);
    const dailyCost = Math.round(dailyKm * rate);

    const generatedTrips: LogbookTrip[] = selectedDays.map((dayDate, idx) => ({
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
    setBatchSelected([]);

    if (onToast) {
      onToast(
        'success',
        `Zapsáno ${generatedTrips.length} jízd (${generatedTrips.length * dailyKm} km, ${formatCurrency(
          generatedTrips.length * dailyCost
        )}).`
      );
    }
  };

  const handleAddTrip = (e: React.FormEvent) => {
    e.preventDefault();
    const km = typeof distanceKm === 'number' ? distanceKm : parseFloat(String(distanceKm));
    const rate = typeof ratePerKm === 'number' ? ratePerKm : parseFloat(String(ratePerKm));

    const next: Record<string, string> = {};
    if (isNaN(km) || km <= 0) next['jizda-km'] = 'Zadejte ujeté kilometry.';
    if (isNaN(rate) || rate < 0) next['jizda-sazba'] = 'Zadejte sazbu za kilometr.';
    if (showErrors(next)) return;

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
    setDeleteTarget(null);
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

  const field =
    'min-h-11 w-full px-3 rounded-md border-[1.5px] border-slate-900 dark:border-slate-500 bg-white dark:bg-slate-950 text-slate-900 dark:text-white';
  const label = 'block font-semibold text-slate-900 dark:text-slate-100 mb-1.5';
  const outline =
    'min-h-11 px-4 inline-flex items-center justify-center gap-2 rounded-md border-[1.5px] border-slate-900 dark:border-slate-500 text-slate-900 dark:text-slate-100 font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed';
  const primary =
    'min-h-11 px-5 inline-flex items-center justify-center gap-2 rounded-md border-[1.5px] border-slate-900 bg-amber-400 hover:bg-amber-300 text-slate-900 font-semibold cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed';
  const numberInput = (id: string, value: number | '', set: (v: number | '') => void, placeholder: string, min: string) => (
    <>
      <input
        id={id}
        type="number"
        inputMode="decimal"
        min={min}
        step="0.5"
        value={value}
        onChange={(e) => {
          set(e.target.value ? parseFloat(e.target.value) : '');
          if (e.target.value) clearError(id);
        }}
        placeholder={placeholder}
        aria-invalid={!!errors[id]}
        aria-describedby={errors[id] ? `${id}-chyba` : undefined}
        className={`${field} tabular-nums ${errors[id] ? '!border-rose-600' : ''}`}
      />
      {errors[id] && (
        <p id={`${id}-chyba`} role="alert" className="mt-1 text-rose-700 dark:text-rose-400">
          {errors[id]}
        </p>
      )}
    </>
  );
  const tripWord = (n: number) => (n === 1 ? 'jízda' : n >= 2 && n <= 4 ? 'jízdy' : 'jízd');
  const singleCost = Math.round((typeof distanceKm === 'number' ? distanceKm : 0) * (typeof ratePerKm === 'number' ? ratePerKm : 0));

  return (
    <Dialog
      title="Kniha jízd"
      subtitle={<>smlouva {contract.contractNumber}</>}
      size="3xl"
      bare
      closeOnBackdrop={false}
      onClose={onClose}
    >
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 text-[15px]">
        {/* Souhrn: jeden rámeček s řádky (vzor Přehledu) */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md divide-y divide-slate-100 dark:divide-slate-800">
          <div className="px-5 py-4 flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
            <div>
              <div className="text-slate-600 dark:text-slate-400">
                Ujeto ({trips.length} {tripWord(trips.length)})
              </div>
              <div className="font-display font-bold text-[40px] leading-none tabular-nums mt-1 text-slate-900 dark:text-white">{totalKm} km</div>
            </div>
            <div className="sm:text-right">
              <div className="text-slate-600 dark:text-slate-400">Náhrady za jízdy</div>
              <div className="font-display font-bold text-[40px] leading-none tabular-nums mt-1 text-slate-900 dark:text-white">{formatCurrency(totalCost)}</div>
            </div>
          </div>
          <div className="px-5 py-3 flex flex-wrap items-center justify-between gap-3">
            <span className="text-slate-600 dark:text-slate-400">Náhrady můžete přičíst k nákladům zakázky.</span>
            <button type="button" onClick={handleSyncToExpenses} disabled={totalCost <= 0} className={outline}>
              Započíst do nákladů
            </button>
          </div>
        </div>

        {/* Záložky */}
        <div role="tablist" aria-label="Zápis jízdy" className="flex gap-1 overflow-x-auto border-b border-slate-200 dark:border-slate-800">
          {[
            { id: 'single' as const, label: 'Jedna jízda' },
            { id: 'batch' as const, label: 'Více dní najednou' },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={activeTab === t.id}
              onClick={() => {
                setActiveTab(t.id);
                setErrors({});
              }}
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

        {/* Jedna jízda */}
        {activeTab === 'single' && (
          <form onSubmit={handleAddTrip} className="space-y-4" noValidate>
            <div className="grid grid-cols-2 sm:grid-cols-12 gap-3">
              <div className="col-span-2 sm:col-span-3">
                <label htmlFor="jizda-datum" className={label}>
                  Datum
                </label>
                <input id="jizda-datum" type="date" value={date} onChange={(e) => setDate(e.target.value)} className={field} />
              </div>
              <div className="col-span-2 sm:col-span-5">
                <label htmlFor="jizda-ucel" className={label}>
                  Účel cesty
                </label>
                <select id="jizda-ucel" value={purpose} onChange={(e) => setPurpose(e.target.value)} className={field}>
                  {COMMON_PURPOSES.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-span-2 sm:col-span-4">
                <label htmlFor="jizda-vozidlo" className={label}>
                  Vozidlo / SPZ
                </label>
                <input
                  id="jizda-vozidlo"
                  type="text"
                  value={vehicle}
                  onChange={(e) => setVehicle(e.target.value)}
                  placeholder="např. Ford Transit / 1AB 1234"
                  className={field}
                />
              </div>
              <div className="col-span-2 sm:col-span-6">
                <label htmlFor="jizda-odkud" className={label}>
                  Odkud
                </label>
                <input id="jizda-odkud" type="text" value={origin} onChange={(e) => setOrigin(e.target.value)} className={field} />
              </div>
              <div className="col-span-2 sm:col-span-6">
                <label htmlFor="jizda-kam" className={label}>
                  Kam
                </label>
                <input id="jizda-kam" type="text" value={destination} onChange={(e) => setDestination(e.target.value)} className={field} />
              </div>
              <div className="sm:col-span-3">
                <label htmlFor="jizda-km" className={label}>
                  Ujeto km
                </label>
                {numberInput('jizda-km', distanceKm, setDistanceKm, 'tam i zpět', '1')}
              </div>
              <div className="sm:col-span-3">
                <label htmlFor="jizda-sazba" className={label}>
                  Sazba (Kč/km)
                </label>
                {numberInput('jizda-sazba', ratePerKm, setRatePerKm, 'Kč za km', '0')}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
              <button type="submit" className={primary}>
                Zapsat jízdu
              </button>
              <span className="text-slate-600 dark:text-slate-400">
                Náhrada <strong className="font-display font-semibold text-xl text-slate-900 dark:text-white tabular-nums">{formatCurrency(singleCost)}</strong>
              </span>
            </div>
          </form>
        )}

        {/* Více dní najednou: zapíšou se jen vybrané dny */}
        {activeTab === 'batch' && (
          <div className="space-y-4">
            <p className="text-slate-600 dark:text-slate-400">
              Stejná cesta za více dní. Vyberte dny, kdy jste na stavbu opravdu jeli – kniha jízd má odpovídat skutečným cestám.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label htmlFor="davka-od" className={label}>
                  Od
                </label>
                <input id="davka-od" type="date" value={batchStartDate} onChange={(e) => setBatchStartDate(e.target.value)} className={field} />
              </div>
              <div>
                <label htmlFor="davka-do" className={label}>
                  Do
                </label>
                <input id="davka-do" type="date" value={batchEndDate} onChange={(e) => setBatchEndDate(e.target.value)} className={field} />
              </div>
              <div>
                <label htmlFor="davka-km" className={label}>
                  Jedna cesta (km)
                </label>
                {numberInput('davka-km', batchOneWayKm, setBatchOneWayKm, 'km', '1')}
              </div>
              <div>
                <label htmlFor="davka-sazba" className={label}>
                  Sazba (Kč/km)
                </label>
                {numberInput('davka-sazba', batchRatePerKm, setBatchRatePerKm, 'Kč za km', '0')}
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="davka-vozidlo" className={label}>
                  Vozidlo
                </label>
                <input id="davka-vozidlo" type="text" value={batchVehicle} onChange={(e) => setBatchVehicle(e.target.value)} className={field} />
              </div>
              <div>
                <label htmlFor="davka-ucel" className={label}>
                  Účel
                </label>
                <input id="davka-ucel" type="text" value={batchPurpose} onChange={(e) => setBatchPurpose(e.target.value)} className={field} />
              </div>
            </div>
            <p className="text-slate-600 dark:text-slate-400">
              Trasa: {contractorAddress} → {clientAddress}
              {calculatedBatchKm > 0 && <> · tam i zpět {calculatedBatchKm} km denně</>}
            </p>
            <label className="min-h-11 inline-flex items-center gap-2.5 cursor-pointer text-slate-900 dark:text-slate-100 select-none">
              <input
                type="checkbox"
                checked={batchWorkdaysOnly}
                onChange={(e) => setBatchWorkdaysOnly(e.target.checked)}
                className="w-5 h-5 accent-slate-900 dark:accent-white"
              />
              Jen pracovní dny
            </label>
            {batchDays.length > 0 && (
              <div className="space-y-2">
                <div className="font-semibold text-slate-900 dark:text-slate-100">Dny, kdy jste jeli na stavbu</div>
                <div role="group" aria-label="Dny, kdy jste jeli na stavbu" className="flex flex-wrap gap-2">
                  {batchDays.map((day) => {
                    const on = batchSelected.includes(day);
                    return (
                      <button
                        key={day}
                        type="button"
                        aria-pressed={on}
                        onClick={() => toggleBatchDay(day)}
                        className={`min-h-11 px-3 rounded-md border font-medium cursor-pointer transition-colors ${
                          on
                            ? 'border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-900'
                            : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                      >
                        {new Date(`${day}T00:00:00`).toLocaleDateString('cs-CZ', { weekday: 'short', day: 'numeric', month: 'numeric' })}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
              <button type="button" onClick={handleGenerateBatchTrips} disabled={selectedDays.length === 0} className={primary}>
                Zapsat vybrané jízdy ({selectedDays.length})
              </button>
              <span className="text-slate-600 dark:text-slate-400">
                {calculatedBatchTotalKm} km · {formatCurrency(calculatedBatchTotalCost)}
              </span>
            </div>
          </div>
        )}

        {/* Jízdy */}
        <section aria-labelledby="jizdy-nadpis" className="space-y-2.5">
          <div className="flex items-center justify-between gap-3">
            <h3 id="jizdy-nadpis" className="font-display font-semibold text-xl text-slate-900 dark:text-white">
              Jízdy
            </h3>
            {trips.length > 0 && (
              <button
                type="button"
                onClick={handlePrint}
                className="min-h-11 inline-flex items-center gap-1.5 text-blue-600 dark:text-blue-300 font-semibold underline underline-offset-2 cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                Vytisknout knihu jízd
              </button>
            )}
          </div>
          {trips.length === 0 ? (
            <p className="px-5 py-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md text-slate-600 dark:text-slate-300">
              Zatím žádné jízdy. Po každé cestě na stavbu stačí zapsat kilometry.
            </p>
          ) : (
            <ul className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md divide-y divide-slate-100 dark:divide-slate-800">
              {trips.map((tr) => (
                <li key={tr.id} className="px-5 py-3 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-slate-900 dark:text-white">
                      {tr.origin} → {tr.destination}
                    </div>
                    <div className="text-slate-600 dark:text-slate-400">
                      {[formatDateCs(tr.date), tr.purpose, Number.isFinite(Number(tr.ratePerKm)) ? `${tr.distanceKm} km × ${tr.ratePerKm} Kč` : `${tr.distanceKm} km`].filter(Boolean).join(' · ')}
                    </div>
                  </div>
                  <span className="font-display font-semibold text-xl tabular-nums text-slate-900 dark:text-white whitespace-nowrap">
                    {formatCurrency(getTripCost(tr))}
                  </span>
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(tr)}
                    aria-label={`Smazat jízdu ${formatDateCs(tr.date)}`}
                    title="Smazat jízdu"
                    className="min-h-11 min-w-11 -mr-2 inline-flex items-center justify-center rounded-md text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Patička */}
      <div className="px-4 sm:px-6 py-3.5 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 shrink-0">
        <span className="text-slate-600 dark:text-slate-400">Jízdy se ukládají k zakázce a jdou do podkladů pro účetní.</span>
        <button type="button" onClick={onClose} className={outline}>
          Hotovo
        </button>
      </div>

      {deleteTarget && (
        <Dialog title="Smazat jízdu?" onClose={() => setDeleteTarget(null)}>
          <div className="space-y-5 text-[15px]">
            <p>
              Jízda {formatDateCs(deleteTarget.date)} ({deleteTarget.distanceKm} km, {formatCurrency(getTripCost(deleteTarget))}) se odstraní z knihy jízd.
            </p>
            <div className="flex flex-wrap justify-end gap-2.5">
              <button type="button" onClick={() => setDeleteTarget(null)} className={outline}>
                Zpět
              </button>
              <button
                type="button"
                onClick={() => handleDeleteTrip(deleteTarget.id)}
                className="min-h-11 px-4 inline-flex items-center justify-center rounded-md border-[1.5px] border-rose-700 text-rose-700 dark:border-rose-400 dark:text-rose-300 font-semibold hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
              >
                Smazat jízdu
              </button>
            </div>
          </div>
        </Dialog>
      )}
    </Dialog>
  );
};
