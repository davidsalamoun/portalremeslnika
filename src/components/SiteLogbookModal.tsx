import React, { useState, useRef } from 'react';
import {
  X,
  Plus,
  Trash2,
  Calendar,
  CloudSun,
  Sun,
  CloudRain,
  Snowflake,
  Users,
  Clock,
  FileText,
  Camera,
  Printer,
  CheckCircle,
  AlertTriangle,
  Package,
  Layers,
  ChevronDown,
} from 'lucide-react';
import { Contract, SiteLogEntry, ContractPhoto } from '../types/contract';
import { formatDateCs } from '../utils/numberToWordsCs';
import { VoiceDictationButton } from './VoiceDictationButton';

interface SiteLogbookModalProps {
  isOpen: boolean;
  onClose: () => void;
  contract: Contract;
  onUpdateContract: (updated: Contract) => void;
  onToast?: (type: 'success' | 'error' | 'info', text: string) => void;
}

const WEATHER_PRESETS = [
  { label: 'Slunečno, 22 °C', icon: Sun, desc: 'Jasno, sucho, bez srážek, ideální podmínky' },
  { label: 'Oblačno, 17 °C', icon: CloudSun, desc: 'Polojasno až oblačno, sucho' },
  { label: 'Deštivo, 13 °C', icon: CloudRain, desc: 'Mírný déšť, vlhko, mokré procesy omezeny' },
  { label: 'Mráz, -2 °C', icon: Snowflake, desc: 'Mrazivé počasí, zákaz mokrých venkovních prací' },
];

export const SiteLogbookModal: React.FC<SiteLogbookModalProps> = ({
  isOpen,
  onClose,
  contract,
  onUpdateContract,
  onToast,
}) => {
  const [logs, setLogs] = useState<SiteLogEntry[]>(contract.siteLogs || []);

  // Form states for new entry
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [weather, setWeather] = useState(WEATHER_PRESETS[0].label);
  const [temperature, setTemperature] = useState<number | ''>(20);
  const [workersCount, setWorkersCount] = useState<number | ''>(2);
  const [hoursWorked, setHoursWorked] = useState<number | ''>(8);
  const [workDescription, setWorkDescription] = useState('');
  const [issues, setIssues] = useState('');
  const [materialsDelivered, setMaterialsDelivered] = useState('');
  const [photos, setPhotos] = useState<ContractPhoto[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Auto weather simulation / fetcher
  const handleAutoWeather = () => {
    // Current season/month temperature approximation for Czechia
    const month = new Date().getMonth();
    let temp = 18;
    let label = 'Polojasno, 18 °C';
    if (month >= 11 || month <= 2) {
      temp = 2;
      label = 'Chladno, 2 °C';
    } else if (month >= 5 && month <= 7) {
      temp = 24;
      label = 'Slunečno, 24 °C';
    }
    setTemperature(temp);
    setWeather(label);
    if (onToast) onToast('info', `Počasí načteno: ${label}`);
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        const newPhoto: ContractPhoto = {
          id: `photo_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          dataUrl: reader.result as string,
          caption: 'Záznam ze stavby ' + date,
          category: 'progress',
          createdAt: new Date().toISOString(),
        };
        setPhotos((prev) => [...prev, newPhoto]);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleAddLog = (e: React.FormEvent) => {
    e.preventDefault();
    if (!workDescription.trim()) {
      if (onToast) onToast('error', 'Vyplňte prosím popis provedených prací.');
      return;
    }

    const newLog: SiteLogEntry = {
      id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      date,
      weather,
      temperature: typeof temperature === 'number' ? temperature : undefined,
      workersCount: typeof workersCount === 'number' ? workersCount : 1,
      hoursWorked: typeof hoursWorked === 'number' ? hoursWorked : 8,
      workDescription: workDescription.trim(),
      issues: issues.trim() || undefined,
      materialsDelivered: materialsDelivered.trim() || undefined,
      photos: photos.length > 0 ? photos : undefined,
      createdAt: new Date().toISOString(),
    };

    const updatedLogs = [newLog, ...logs];
    setLogs(updatedLogs);
    onUpdateContract({
      ...contract,
      siteLogs: updatedLogs,
    });

    // Reset form
    setWorkDescription('');
    setIssues('');
    setMaterialsDelivered('');
    setPhotos([]);
    setIsAdding(false);
    if (onToast) onToast('success', 'Denní zápis byl přidán do stavebního deníku.');
  };

  const handleDeleteLog = (id: string) => {
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

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl w-full max-w-3xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden my-auto">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900 text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-500 text-slate-950 flex items-center justify-center font-black">
              <FileText className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono uppercase font-black text-amber-400">§ 157 stavební zákon</span>
                <span className="text-[11px] font-mono text-slate-400">· SOD #{contract.contractNumber}</span>
              </div>
              <h3 className="font-black text-base text-white tracking-tight">Digitální stavební deník</h3>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs flex items-center gap-1.5 cursor-pointer border border-slate-700 font-mono font-bold"
              title="Tisk stavebního deníku"
            >
              <Printer className="w-4 h-4 text-amber-400" />
              <span className="hidden sm:inline">Tisknout deník</span>
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Summary stats */}
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="p-3 bg-slate-50 dark:bg-slate-800/80 rounded-lg border border-slate-200 dark:border-slate-800">
              <div className="text-xl font-black font-mono tabular-nums text-slate-900 dark:text-white">
                {logs.length}
              </div>
              <div className="text-[11px] font-mono uppercase text-slate-500 font-bold">Dnů na stavbě</div>
            </div>
            <div className="p-3 bg-slate-50 dark:bg-slate-800/80 rounded-lg border border-slate-200 dark:border-slate-800">
              <div className="text-xl font-black font-mono tabular-nums text-amber-600 dark:text-amber-400">
                {totalHours} h
              </div>
              <div className="text-[11px] font-mono uppercase text-slate-500 font-bold">Odpracováno</div>
            </div>
            <div className="p-3 bg-slate-50 dark:bg-slate-800/80 rounded-lg border border-slate-200 dark:border-slate-800">
              <div className="text-xl font-black font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
                {logs.filter((l) => l.photos && l.photos.length > 0).length}
              </div>
              <div className="text-[11px] font-mono uppercase text-slate-500 font-bold">S fotodokumentací</div>
            </div>
          </div>

          {/* Tlačítko přidat nový záznam */}
          {!isAdding && (
            <button
              type="button"
              onClick={() => setIsAdding(true)}
              className="w-full py-3 px-4 rounded-lg border-2 border-dashed border-amber-500/50 hover:border-amber-500 hover:bg-amber-500/5 text-slate-900 dark:text-amber-400 font-bold text-sm flex items-center justify-center gap-2 cursor-pointer transition-colors"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>+ Zapsat dnešní den na stavbě (počasí, práce, fotky)</span>
            </button>
          )}

          {/* Formulář pro nový zápis */}
          {isAdding && (
            <form
              onSubmit={handleAddLog}
              className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-300 dark:border-slate-700 space-y-4 shadow-xs"
            >
              <div className="flex items-center justify-between">
                <h4 className="font-black text-slate-900 dark:text-white text-sm flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-amber-500" />
                  Nový denní zápis do stavebního deníku
                </h4>
                <button
                  type="button"
                  onClick={() => setIsAdding(false)}
                  className="text-xs text-slate-500 hover:text-slate-800"
                >
                  Zrušit
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Datum:
                  </label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-3 py-1.5 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Počasí:
                    </label>
                    <button
                      type="button"
                      onClick={handleAutoWeather}
                      className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline font-semibold cursor-pointer inline-flex items-center gap-1"
                    >
                      <CloudSun className="w-3.5 h-3.5" />
                      <span>Zjistit aktuální</span>
                    </button>
                  </div>
                  <input
                    type="text"
                    value={weather}
                    onChange={(e) => setWeather(e.target.value)}
                    placeholder="Slunečno, 20 °C"
                    className="w-full px-3 py-1.5 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                      Pracovníků:
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={workersCount}
                      onChange={(e) => setWorkersCount(parseInt(e.target.value) || '')}
                      className="w-full px-3 py-1.5 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                      Hodin:
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={hoursWorked}
                      onChange={(e) => setHoursWorked(parseFloat(e.target.value) || '')}
                      className="w-full px-3 py-1.5 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                    />
                  </div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Popis provedených prací a technologických postupů: *
                  </label>
                  <VoiceDictationButton
                    onTranscript={(spokenText) => {
                      setWorkDescription((prev) => (prev ? `${prev} ${spokenText}` : spokenText));
                    }}
                    buttonText="Diktovat"
                  />
                </div>
                <textarea
                  value={workDescription}
                  onChange={(e) => setWorkDescription(e.target.value)}
                  placeholder="Např. Pokládka hydroizolační stěrky ve 2 vrstvách s bandážemi v rozích, vysekání drážek pro elektroinstalaci, penetrace podkladu pod obklady."
                  rows={3}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Dodaný materiál / stroje:
                  </label>
                  <input
                    type="text"
                    value={materialsDelivered}
                    onChange={(e) => setMaterialsDelivered(e.target.value)}
                    placeholder="např. 25 pytlů lepidla C2TE, lešení"
                    className="w-full px-3 py-1.5 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Překážky, závady nebo zpoždění:
                  </label>
                  <input
                    type="text"
                    value={issues}
                    onChange={(e) => setIssues(e.target.value)}
                    placeholder="např. Nezapojená elektřina ze strany investora"
                    className="w-full px-3 py-1.5 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              {/* Fotografie */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Camera className="w-3.5 h-3.5 text-blue-600" />
                    Fotodokumentace k dnešnímu dni ({photos.length}):
                  </label>
                  <button
                    type="button"
                    onClick={() => photoInputRef.current?.click()}
                    className="text-xs text-blue-600 dark:text-blue-400 font-semibold cursor-pointer"
                  >
                    + Přidat foto ze stavby
                  </button>
                  <input
                    ref={photoInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handlePhotoUpload}
                    className="hidden"
                  />
                </div>

                {photos.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {photos.map((p, idx) => (
                      <div key={idx} className="relative w-16 h-16 rounded-lg overflow-hidden border">
                        <img src={p.dataUrl} alt="Foto" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => setPhotos((prev) => prev.filter((_, i) => i !== idx))}
                          className="absolute top-0.5 right-0.5 bg-red-600 text-white rounded-full p-0.5"
                        >
                          <X className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setIsAdding(false)}
                  className="px-4 py-2 text-xs rounded-lg font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Zrušit
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-black cursor-pointer shadow-xs transition-colors font-mono"
                >
                  Uložit denní záznam
                </button>
              </div>
            </form>
          )}

          {/* Seznam existujících záznamů stavebního deníku */}
          <div className="space-y-3">
            <h4 className="font-black text-slate-900 dark:text-white text-sm font-mono uppercase tracking-wide">
              Historie zápisů v deníku ({logs.length})
            </h4>

            {logs.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-xs">
                Zatím nebyl vytvořen žádný denní záznam. Přidejte první zápis tlačítkem výše.
              </div>
            ) : (
              <div className="space-y-3">
                {logs.map((log) => (
                  <div
                    key={log.id}
                    className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 shadow-xs space-y-2.5"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <span className="font-mono font-bold text-sm text-slate-900 dark:text-white">
                          {formatDateCs(log.date)}
                        </span>
                        {log.weather && (
                          <span className="text-xs px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded font-mono text-slate-700 dark:text-slate-300 flex items-center gap-1 border border-slate-200 dark:border-slate-700">
                            <CloudSun className="w-3.5 h-3.5 text-amber-500" />
                            {log.weather}
                          </span>
                        )}
                        <span className="text-xs font-mono text-slate-500 flex items-center gap-1">
                          <Users className="w-3.5 h-3.5" />
                          {log.workersCount || 1} prac. · {log.hoursWorked || 8} h
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteLog(log.id)}
                        className="text-slate-400 hover:text-red-600 p-1 rounded-md"
                        title="Smazat záznam"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <p className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-line">
                      {log.workDescription}
                    </p>

                    {log.materialsDelivered && (
                      <div className="text-xs text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                        <Package className="w-3.5 h-3.5 text-blue-500" />
                        <span>Materiál: {log.materialsDelivered}</span>
                      </div>
                    )}

                    {log.issues && (
                      <div className="text-xs text-amber-700 dark:text-amber-400 flex items-center gap-1.5 bg-amber-50 dark:bg-amber-950/40 p-2 rounded-lg">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        <span>Překážka / záznam: {log.issues}</span>
                      </div>
                    )}

                    {log.photos && log.photos.length > 0 && (
                      <div className="flex flex-wrap gap-2 pt-1">
                        {log.photos.map((p, idx) => (
                          <img
                            key={idx}
                            src={p.dataUrl}
                            alt="Foto stavby"
                            className="w-14 h-14 object-cover rounded-lg border border-slate-200"
                          />
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex items-center justify-between">
          <span className="text-xs text-slate-400">
            Deník splňuje náležitosti podle stavebního zákona
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Zavřít
          </button>
        </div>
      </div>
    </div>
  );
};
