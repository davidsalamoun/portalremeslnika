import React, { useState, useRef } from 'react';
import { Dialog, dialogActionButton } from './Dialog';
import { X, Plus, Trash2, Camera, Printer } from 'lucide-react';
import { Contract, SiteLogEntry, ContractPhoto } from '../types/contract';
import { formatDateCs } from '../utils/numberToWordsCs';
import { compressImageFile } from '../utils/imageCompression';
import { VoiceDictationButton } from './VoiceDictationButton';

interface SiteLogbookModalProps {
  isOpen: boolean;
  onClose: () => void;
  contract: Contract;
  onUpdateContract: (updated: Contract) => void;
  onToast?: (type: 'success' | 'error' | 'info', text: string) => void;
}

// Rychlé doplnění počasí – jen slova, teplotu zapisuje uživatel sám
const WEATHER_WORDS = ['Slunečno', 'Polojasno', 'Zataženo', 'Déšť', 'Sníh', 'Mráz'];

export const SiteLogbookModal: React.FC<SiteLogbookModalProps> = ({
  isOpen,
  onClose,
  contract,
  onUpdateContract,
  onToast,
}) => {
  const [logs, setLogs] = useState<SiteLogEntry[]>(contract.siteLogs || []);

  // Nový zápis: nic se nepředvyplňuje kromě dnešního data
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [weather, setWeather] = useState('');
  const [temperature, setTemperature] = useState<number | ''>('');
  const [workersCount, setWorkersCount] = useState<number | ''>('');
  const [hoursWorked, setHoursWorked] = useState<number | ''>('');
  const [workDescription, setWorkDescription] = useState('');
  const [issues, setIssues] = useState('');
  const [materialsDelivered, setMaterialsDelivered] = useState('');
  const [photos, setPhotos] = useState<ContractPhoto[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [isProcessingPhotos, setIsProcessingPhotos] = useState(false);
  const [descriptionError, setDescriptionError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<SiteLogEntry | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (files.length === 0) return;
    setIsProcessingPhotos(true);
    try {
      const added: ContractPhoto[] = [];
      for (const file of files) {
        added.push({
          id: `photo_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          dataUrl: await compressImageFile(file),
          caption: `Záznam ze stavby ${formatDateCs(date)}`,
          category: 'progress',
          createdAt: new Date().toISOString(),
        });
      }
      setPhotos((prev) => [...prev, ...added]);
    } catch (err) {
      console.error(err);
      onToast?.('error', 'Fotku se nepodařilo zpracovat.');
    } finally {
      setIsProcessingPhotos(false);
    }
  };

  const resetForm = () => {
    setWeather('');
    setTemperature('');
    setWorkersCount('');
    setHoursWorked('');
    setWorkDescription('');
    setIssues('');
    setMaterialsDelivered('');
    setPhotos([]);
    setDescriptionError('');
  };

  const handleAddLog = (e: React.FormEvent) => {
    e.preventDefault();
    if (!workDescription.trim()) {
      setDescriptionError('Napište, co se ten den na stavbě dělalo.');
      document.getElementById('denik-popis')?.focus();
      return;
    }

    const newLog: SiteLogEntry = {
      id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      date,
      weather: weather.trim() || undefined,
      temperature: typeof temperature === 'number' ? temperature : undefined,
      workersCount: typeof workersCount === 'number' ? workersCount : undefined,
      hoursWorked: typeof hoursWorked === 'number' ? hoursWorked : undefined,
      workDescription: workDescription.trim(),
      issues: issues.trim() || undefined,
      materialsDelivered: materialsDelivered.trim() || undefined,
      photos: photos.length > 0 ? photos : undefined,
      createdAt: new Date().toISOString(),
    };

    const updatedLogs = [newLog, ...logs].sort((x, y) => y.date.localeCompare(x.date));
    setLogs(updatedLogs);
    onUpdateContract({
      ...contract,
      siteLogs: updatedLogs,
    });

    resetForm();
    setIsAdding(false);
    onToast?.('success', 'Zápis je uložený ve stavebním deníku.');
  };

  const handleDeleteLog = (id: string) => {
    setDeleteTarget(null);
    const updated = logs.filter((l) => l.id !== id);
    setLogs(updated);
    onUpdateContract({
      ...contract,
      siteLogs: updated,
    });
    if (onToast) onToast('info', 'Zápis byl odstraněn.');
  };

  const handlePrint = () => {
    window.print();
  };

  const totalHours = logs.reduce((sum, l) => sum + (l.hoursWorked || 0), 0);
  const photoDays = logs.filter((l) => l.photos && l.photos.length > 0).length;
  const plural = (n: number, one: string, few: string, many: string) => `${n} ${n === 1 ? one : n >= 2 && n <= 4 ? few : many}`;

  const field =
    'min-h-11 w-full px-3 rounded-md border-[1.5px] border-slate-900 dark:border-slate-500 bg-white dark:bg-slate-950 text-slate-900 dark:text-white';
  const label = 'block font-semibold text-slate-900 dark:text-slate-100 mb-1.5';
  const outline =
    'min-h-11 px-4 inline-flex items-center justify-center gap-2 rounded-md border-[1.5px] border-slate-900 dark:border-slate-500 text-slate-900 dark:text-slate-100 font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors disabled:opacity-60';
  const numberField = (id: string, value: number | '', set: (v: number | '') => void, step = '1', min = '0') => (
    <input
      id={id}
      type="number"
      inputMode="decimal"
      min={min}
      step={step}
      value={value}
      onChange={(e) => set(e.target.value === '' ? '' : Number(e.target.value))}
      className={`${field} tabular-nums`}
    />
  );

  return (
    <Dialog
      title="Stavební deník"
      subtitle={<>smlouva {contract.contractNumber}</>}
      size="2xl"
      actions={
        <button type="button" onClick={handlePrint} aria-label="Vytisknout deník" className={dialogActionButton}>
          <Printer className="w-4 h-4" />
          <span className="hidden sm:inline">Tisk</span>
        </button>
      }
      bare
      closeOnBackdrop={false}
      onClose={onClose}
    >
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 text-[15px]">
        {/* Souhrn v jednom řádku */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md px-5 py-4 flex flex-wrap items-baseline gap-x-6 gap-y-1">
          <span>
            <span className="font-display font-bold text-[32px] leading-none tabular-nums text-slate-900 dark:text-white">{logs.length}</span>{' '}
            <span className="text-slate-600 dark:text-slate-400">{logs.length === 1 ? 'den' : logs.length >= 2 && logs.length <= 4 ? 'dny' : 'dnů'} na stavbě</span>
          </span>
          <span>
            <span className="font-display font-bold text-[32px] leading-none tabular-nums text-slate-900 dark:text-white">{totalHours}</span>{' '}
            <span className="text-slate-600 dark:text-slate-400">h odpracováno</span>
          </span>
          <span>
            <span className="font-display font-bold text-[32px] leading-none tabular-nums text-slate-900 dark:text-white">{photoDays}</span>{' '}
            <span className="text-slate-600 dark:text-slate-400">{photoDays === 1 ? 'den' : photoDays >= 2 && photoDays <= 4 ? 'dny' : 'dnů'} s fotkami</span>
          </span>
        </div>

        {!isAdding && (
          <button type="button" onClick={() => setIsAdding(true)} className={outline}>
            <Plus className="w-[18px] h-[18px]" />
            Zapsat den na stavbě
          </button>
        )}

        {/* Nový zápis */}
        {isAdding && (
          <form onSubmit={handleAddLog} className="space-y-4" noValidate>
            <h3 className="font-display font-semibold text-xl text-slate-900 dark:text-white">Nový zápis</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="col-span-2 sm:col-span-1">
                <label htmlFor="denik-datum" className={label}>
                  Datum
                </label>
                <input id="denik-datum" type="date" value={date} onChange={(e) => setDate(e.target.value)} className={field} />
              </div>
              <div>
                <label htmlFor="denik-pracovnici" className={label}>
                  Pracovníků
                </label>
                {numberField('denik-pracovnici', workersCount, setWorkersCount, '1', '1')}
              </div>
              <div>
                <label htmlFor="denik-hodiny" className={label}>
                  Hodin celkem
                </label>
                {numberField('denik-hodiny', hoursWorked, setHoursWorked, '0.5')}
              </div>
              <div className="col-span-2 sm:col-span-1">
                <label htmlFor="denik-teplota" className={label}>
                  Teplota (°C)
                </label>
                <input
                  id="denik-teplota"
                  type="number"
                  inputMode="numeric"
                  value={temperature}
                  onChange={(e) => setTemperature(e.target.value === '' ? '' : Number(e.target.value))}
                  className={`${field} tabular-nums`}
                />
              </div>
            </div>

            <div>
              <label htmlFor="denik-pocasi" className={label}>
                Počasí <span className="font-normal text-slate-600 dark:text-slate-400">(nepovinné)</span>
              </label>
              <input
                id="denik-pocasi"
                type="text"
                value={weather}
                onChange={(e) => setWeather(e.target.value)}
                placeholder="např. polojasno, sucho"
                className={field}
              />
              <div className="flex flex-wrap gap-2 mt-2">
                {WEATHER_WORDS.map((w) => (
                  <button
                    key={w}
                    type="button"
                    onClick={() => setWeather(w)}
                    className="min-h-11 px-3 rounded-md border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-medium hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    {w}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="flex items-end justify-between gap-2 mb-1.5">
                <label htmlFor="denik-popis" className="font-semibold text-slate-900 dark:text-slate-100">
                  Co se dělalo
                </label>
                <VoiceDictationButton
                  onTranscript={(spokenText) => {
                    setWorkDescription((prev) => (prev ? `${prev} ${spokenText}` : spokenText));
                    setDescriptionError('');
                  }}
                  buttonText="Diktovat"
                />
              </div>
              <textarea
                id="denik-popis"
                value={workDescription}
                onChange={(e) => {
                  setWorkDescription(e.target.value);
                  if (e.target.value.trim()) setDescriptionError('');
                }}
                placeholder="např. hydroizolační stěrka ve dvou vrstvách, bandáže v rozích, penetrace podkladu"
                rows={3}
                aria-invalid={!!descriptionError}
                aria-describedby={descriptionError ? 'denik-popis-chyba' : undefined}
                className={`w-full px-3 py-2.5 rounded-md border-[1.5px] bg-white dark:bg-slate-950 text-slate-900 dark:text-white ${
                  descriptionError ? 'border-rose-600' : 'border-slate-900 dark:border-slate-500'
                }`}
              />
              {descriptionError && (
                <p id="denik-popis-chyba" role="alert" className="mt-1 text-rose-700 dark:text-rose-400">
                  {descriptionError}
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="denik-material" className={label}>
                  Dodaný materiál a technika <span className="font-normal text-slate-600 dark:text-slate-400">(nepovinné)</span>
                </label>
                <input
                  id="denik-material"
                  type="text"
                  value={materialsDelivered}
                  onChange={(e) => setMaterialsDelivered(e.target.value)}
                  placeholder="např. lepidlo C2TE, lešení"
                  className={field}
                />
              </div>
              <div>
                <label htmlFor="denik-prekazky" className={label}>
                  Překážky a zdržení <span className="font-normal text-slate-600 dark:text-slate-400">(nepovinné)</span>
                </label>
                <input
                  id="denik-prekazky"
                  type="text"
                  value={issues}
                  onChange={(e) => setIssues(e.target.value)}
                  placeholder="např. chyběla elektřina na stavbě"
                  className={field}
                />
              </div>
            </div>

            <div className="space-y-2">
              <input ref={photoInputRef} type="file" accept="image/*" multiple onChange={handlePhotoUpload} className="hidden" />
              <button type="button" onClick={() => photoInputRef.current?.click()} disabled={isProcessingPhotos} className={outline}>
                <Camera className="w-[18px] h-[18px]" />
                {isProcessingPhotos ? 'Zpracovávám fotky…' : photos.length > 0 ? `Přidat další fotku (${photos.length})` : 'Přidat fotky ze stavby'}
              </button>
              {photos.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {photos.map((p, idx) => (
                    <div key={p.id} className="relative w-20 h-20 rounded-md overflow-hidden border border-slate-200 dark:border-slate-700">
                      <img src={p.dataUrl} alt={`Fotka ${idx + 1}`} className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => setPhotos((prev) => prev.filter((x) => x.id !== p.id))}
                        aria-label={`Odebrat fotku ${idx + 1}`}
                        className="absolute top-0 right-0 min-h-11 min-w-11 inline-flex items-start justify-end p-1 cursor-pointer"
                      >
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-slate-900/80 text-white">
                          <X className="w-3.5 h-3.5" />
                        </span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-2.5">
              <button
                type="submit"
                className="min-h-11 px-5 inline-flex items-center justify-center rounded-md border-[1.5px] border-slate-900 bg-amber-400 hover:bg-amber-300 text-slate-900 font-semibold cursor-pointer transition-colors"
              >
                Uložit zápis
              </button>
              <button
                type="button"
                onClick={() => {
                  resetForm();
                  setIsAdding(false);
                }}
                className={outline}
              >
                Zrušit
              </button>
            </div>
          </form>
        )}

        {/* Zápisy */}
        <section aria-labelledby="denik-zapisy" className="space-y-2.5">
          <h3 id="denik-zapisy" className="font-display font-semibold text-xl text-slate-900 dark:text-white">
            Zápisy
          </h3>
          {logs.length === 0 ? (
            <p className="px-5 py-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md text-slate-600 dark:text-slate-300">
              Zatím žádné zápisy. Po každém dni na stavbě zapište, co se udělalo – hodí se při předání i při sporu o termín.
            </p>
          ) : (
            <ul className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md divide-y divide-slate-100 dark:divide-slate-800">
              {logs.map((log) => {
                const meta = [
                  log.weather && (log.temperature !== undefined ? `${log.weather}, ${log.temperature} °C` : log.weather),
                  !log.weather && log.temperature !== undefined ? `${log.temperature} °C` : '',
                  log.workersCount ? plural(log.workersCount, 'pracovník', 'pracovníci', 'pracovníků') : '',
                  log.hoursWorked ? `${log.hoursWorked} h` : '',
                ].filter(Boolean);
                return (
                  <li key={log.id} className="px-5 py-3.5 flex gap-4">
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="font-semibold text-slate-900 dark:text-white">
                        {formatDateCs(log.date)}
                        {meta.length > 0 && <span className="font-normal text-slate-600 dark:text-slate-400"> · {meta.join(' · ')}</span>}
                      </div>
                      <p className="text-slate-800 dark:text-slate-200 whitespace-pre-line">{log.workDescription}</p>
                      {log.materialsDelivered && <p className="text-slate-600 dark:text-slate-400">Materiál: {log.materialsDelivered}</p>}
                      {log.issues && <p className="text-slate-900 dark:text-slate-100">Překážka: {log.issues}</p>}
                      {log.photos && log.photos.length > 0 && (
                        <div className="flex flex-wrap gap-2 pt-1">
                          {log.photos.map((p, idx) => (
                            <img
                              key={p.id || idx}
                              src={p.dataUrl}
                              alt={`Fotka ze stavby ${formatDateCs(log.date)}`}
                              className="w-16 h-16 object-cover rounded-md border border-slate-200 dark:border-slate-700"
                            />
                          ))}
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(log)}
                      aria-label={`Smazat zápis ${formatDateCs(log.date)}`}
                      title="Smazat zápis"
                      className="min-h-11 min-w-11 -mr-2 -mt-1.5 inline-flex items-center justify-center rounded-md text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      {/* Patička */}
      <div className="px-4 sm:px-6 py-3.5 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 shrink-0">
        <span className="text-slate-600 dark:text-slate-400">Zápisy se ukládají k zakázce.</span>
        <button type="button" onClick={onClose} className={outline}>
          Hotovo
        </button>
      </div>

      {deleteTarget && (
        <Dialog title="Smazat zápis?" onClose={() => setDeleteTarget(null)}>
          <div className="space-y-5 text-[15px]">
            <p>Zápis ze dne {formatDateCs(deleteTarget.date)} se odstraní ze stavebního deníku i s fotkami.</p>
            <div className="flex flex-wrap justify-end gap-2.5">
              <button type="button" onClick={() => setDeleteTarget(null)} className={outline}>
                Zpět
              </button>
              <button
                type="button"
                onClick={() => handleDeleteLog(deleteTarget.id)}
                className="min-h-11 px-4 inline-flex items-center justify-center rounded-md border-[1.5px] border-rose-700 text-rose-700 dark:border-rose-400 dark:text-rose-300 font-semibold hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
              >
                Smazat zápis
              </button>
            </div>
          </div>
        </Dialog>
      )}
    </Dialog>
  );
};
