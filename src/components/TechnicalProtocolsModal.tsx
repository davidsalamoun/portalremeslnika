import React, { useState, useRef } from 'react';
import {
  X,
  FileCheck2,
  Plus,
  Trash2,
  Printer,
  Share2,
  CheckCircle2,
  AlertTriangle,
  PenTool,
  RotateCcw,
  Gauge,
  Thermometer,
  ShieldCheck,
  Check,
  Droplets,
  Flame,
  Zap,
} from 'lucide-react';
import { Contract, TechnicalProtocol, TechnicalProtocolType } from '../types/contract';
import { formatDateCs } from '../utils/numberToWordsCs';
import { triggerHaptic } from '../utils/haptics';
import { safeOpenExternalUrl } from '../utils/shareUtils';

interface TechnicalProtocolsModalProps {
  isOpen: boolean;
  onClose: () => void;
  contract: Contract;
  onUpdateContract: (updated: Contract) => void;
  onToast?: (type: 'success' | 'error' | 'info', text: string) => void;
}

interface TestPreset {
  type: TechnicalProtocolType;
  title: string;
  standard: string;
  pipeMaterial: string;
  testMedium: 'voda' | 'vzduch' | 'plyn';
  operatingPressureBar: number;
  testPressureBar: number;
  testDurationMinutes: number;
  maxAllowedDropBar: number;
  defaultNotes: string;
}

const TEST_PRESETS: TestPreset[] = [
  {
    type: 'water_pressure',
    title: 'Protokol o tlakové zkoušce vnitřního vodovodu',
    standard: 'ČSN 73 6660 (Vnitřní vodovody)',
    pipeMaterial: 'PPR / PEX-AL-PEX',
    testMedium: 'voda',
    operatingPressureBar: 4.0,
    testPressureBar: 15.0,
    testDurationMinutes: 120,
    maxAllowedDropBar: 0.02,
    defaultNotes: 'Potrubí řádně odvzdušněno a napuštěno čistou vodou. Zkušební přetlak 1.5 MPa udržován po dobu 2 hodin. Žádný únik vody, orosení ani deformace spojů nezjištěny.',
  },
  {
    type: 'heating_pressure',
    title: 'Protokol o tlakové zkoušce otopné soustavy',
    standard: 'ČSN EN 14336 (Tepelné soustavy v budovách)',
    pipeMaterial: 'PEX-AL-PEX / Měď',
    testMedium: 'voda',
    operatingPressureBar: 1.8,
    testPressureBar: 4.5,
    testDurationMinutes: 60,
    maxAllowedDropBar: 0.01,
    defaultNotes: 'Provedena zkouška těsnosti otopné soustavy (radiátory / podlahové vytápění) při zkušebním tlaku 4.5 bar za studena. Všechny spoje a armatury těsné.',
  },
  {
    type: 'floor_heating_test',
    title: 'Zápis o provedení topné zkoušky a nátopu podlahového topení',
    standard: 'ČSN EN 1264-4 (Zabudované plošné vytápění)',
    pipeMaterial: 'PEX / PE-RT potrubí s kyslíkovou bariérou',
    testMedium: 'voda',
    operatingPressureBar: 1.5,
    testPressureBar: 2.5,
    testDurationMinutes: 4320, // 3 dny náběh
    maxAllowedDropBar: 0.0,
    defaultNotes: 'Po vyzrání potěrové desky (28 dní cementový potěr / 7 dní anhydrit) zahájen postupný nátop: 3 dny při vstupní teplotě 25 °C, následně postupné zvyšování o 5 °C denně na max. teplotu 45 °C a temperování. Bez vzniku trhlin a deformací.',
  },
  {
    type: 'sewage_tightness',
    title: 'Protokol o zkoušce těsnosti vnitřní kanalizace',
    standard: 'ČSN 75 6760 / ČSN EN 1610 (Vnitřní kanalizace)',
    pipeMaterial: 'HT / KG plastové potrubí s hrdlovými spoji',
    testMedium: 'voda',
    operatingPressureBar: 0.5,
    testPressureBar: 0.5,
    testDurationMinutes: 30,
    maxAllowedDropBar: 0.0,
    defaultNotes: 'Zkouška vodou napuštěním do úrovně nejvýše položeného zařizovacího předmětu. Po 15 minutách ustálení provedena 30minutová kontrola. Zjištěn nulový únik vody.',
  },
  {
    type: 'electrical_initial',
    title: 'Výchozí kontrolní záznam zapojení elektroinstalace a spotřebičů',
    standard: 'ČSN 33 2000-6 ed. 2 (Revize elektrických zařízení)',
    pipeMaterial: 'Kabely CYKY v chráničkách pod omítkou',
    testMedium: 'plyn', // Not applicable
    operatingPressureBar: 0,
    testPressureBar: 0,
    testDurationMinutes: 45,
    maxAllowedDropBar: 0,
    defaultNotes: 'Provedena kontrola správného zapojení fází, ochranného vodiče PE a funkčnosti proudového chrániče (RCD 30 mA vypíná v normovém čase). Měření izolačního stavu vyhovuje.',
  },
];

export const TechnicalProtocolsModal: React.FC<TechnicalProtocolsModalProps> = ({
  isOpen,
  onClose,
  contract,
  onUpdateContract,
  onToast,
}) => {
  const existingProtocols = contract.technicalProtocols || [];
  const [protocols, setProtocols] = useState<TechnicalProtocol[]>(existingProtocols);
  const [selectedProtocolId, setSelectedProtocolId] = useState<string | null>(
    existingProtocols.length > 0 ? existingProtocols[0].id : null
  );
  const [isCreatingNew, setIsCreatingNew] = useState(existingProtocols.length === 0);

  // New protocol form state
  const [selectedPresetIdx, setSelectedPresetIdx] = useState<number>(0);
  const currentPreset = TEST_PRESETS[selectedPresetIdx] || TEST_PRESETS[0];

  const nextNumber = `TZ-${contract.contractNumber.replace(/\D/g, '') || new Date().getFullYear()}-${String(
    protocols.length + 1
  ).padStart(2, '0')}`;

  const [protocolNumber, setProtocolNumber] = useState(nextNumber);
  const [testDate, setTestDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [standard, setStandard] = useState(currentPreset.standard);
  const [title, setTitle] = useState(currentPreset.title);
  const [pipeMaterial, setPipeMaterial] = useState(currentPreset.pipeMaterial);
  const [testMedium, setTestMedium] = useState<'voda' | 'vzduch' | 'plyn'>(currentPreset.testMedium);
  const [operatingPressure, setOperatingPressure] = useState<number | ''>(currentPreset.operatingPressureBar);
  const [testPressure, setTestPressure] = useState<number | ''>(currentPreset.testPressureBar);
  const [durationMinutes, setDurationMinutes] = useState<number | ''>(currentPreset.testDurationMinutes);
  const [pressureDrop, setPressureDrop] = useState<number | ''>(0.0);
  const [result, setResult] = useState<'vyhovuje' | 'nevyhovuje'>('vyhovuje');
  const [testedBy, setTestedBy] = useState(contract.contractor.name || 'Zhotovitel');
  const [witnessedBy, setWitnessedBy] = useState(contract.client.name || 'Objednatel');
  const [notes, setNotes] = useState(currentPreset.defaultNotes);

  // Signature state
  const [contractorSignature, setContractorSignature] = useState<string | null>(
    contract.contractorSignature || null
  );
  const [clientSignature, setClientSignature] = useState<string | null>(
    contract.clientSignature || null
  );
  const [activeSigner, setActiveSigner] = useState<'contractor' | 'client' | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawing = useRef(false);

  if (!isOpen) return null;

  const handleApplyPreset = (idx: number) => {
    triggerHaptic('selection');
    setSelectedPresetIdx(idx);
    const p = TEST_PRESETS[idx];
    setTitle(p.title);
    setStandard(p.standard);
    setPipeMaterial(p.pipeMaterial);
    setTestMedium(p.testMedium);
    setOperatingPressure(p.operatingPressureBar);
    setTestPressure(p.testPressureBar);
    setDurationMinutes(p.testDurationMinutes);
    setNotes(p.defaultNotes);
    setPressureDrop(0.0);
    setResult('vyhovuje');
  };

  // Canvas drawing handlers
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    isDrawing.current = true;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    ctx.beginPath();
    ctx.moveTo(clientX - rect.left, clientY - rect.top);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    ctx.lineTo(clientX - rect.left, clientY - rect.top);
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.stroke();
  };

  const stopDrawing = () => {
    isDrawing.current = false;
  };

  const saveSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    if (activeSigner === 'contractor') {
      setContractorSignature(dataUrl);
    } else if (activeSigner === 'client') {
      setClientSignature(dataUrl);
    }
    setActiveSigner(null);
    triggerHaptic('success');
  };

  const handleCreateProtocol = (e: React.FormEvent) => {
    e.preventDefault();
    triggerHaptic('success');

    const newProtocol: TechnicalProtocol = {
      id: `protocol_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      protocolNumber,
      type: currentPreset.type,
      title,
      date: testDate,
      standard,
      pipeMaterial,
      testMedium,
      operatingPressureBar: typeof operatingPressure === 'number' ? operatingPressure : undefined,
      testPressureBar: typeof testPressure === 'number' ? testPressure : 0,
      testDurationMinutes: typeof durationMinutes === 'number' ? durationMinutes : 60,
      pressureDropBar: typeof pressureDrop === 'number' ? pressureDrop : 0,
      result,
      testedBy: testedBy.trim() || contract.contractor.name,
      witnessedBy: witnessedBy.trim() || contract.client.name,
      notes: notes.trim(),
      contractorSignature: contractorSignature || undefined,
      clientSignature: clientSignature || undefined,
      createdAt: new Date().toISOString(),
    };

    const updated = [newProtocol, ...protocols];
    setProtocols(updated);
    setSelectedProtocolId(newProtocol.id);
    setIsCreatingNew(false);

    onUpdateContract({
      ...contract,
      technicalProtocols: updated,
    });

    if (onToast) {
      onToast('success', `Technický protokol ${protocolNumber} byl vystaven a uložen.`);
    }
  };

  const handleDeleteProtocol = (id: string) => {
    triggerHaptic('selection');
    const updated = protocols.filter((p) => p.id !== id);
    setProtocols(updated);
    if (selectedProtocolId === id) {
      setSelectedProtocolId(updated.length > 0 ? updated[0].id : null);
    }
    onUpdateContract({
      ...contract,
      technicalProtocols: updated,
    });
    if (onToast) onToast('info', 'Zkušební protokol byl smazán.');
  };

  const selectedProtocol = protocols.find((p) => p.id === selectedProtocolId) || protocols[0];

  const handleShareWhatsApp = (prot: TechnicalProtocol) => {
    triggerHaptic('success');
    const text =
      `*${prot.title.toUpperCase()}*\n` +
      `Číslo protokolu: *${prot.protocolNumber}*\n` +
      `Norma: ${prot.standard}\n` +
      `Stavba: ${contract.client.name} (${contract.executionPlace || contract.client.address})\n` +
      `Datum zkoušky: ${formatDateCs(prot.date)}\n` +
      `Zkušební přetlak: *${prot.testPressureBar} bar* (doba ${prot.testDurationMinutes} min)\n` +
      `Naměřený pokles: *${prot.pressureDropBar} bar*\n` +
      `Výsledek zkoušky: *${prot.result.toUpperCase()}*\n` +
      `Zkoušku provedl: ${prot.testedBy}\n\n` +
      `Zkouška proběhla v plném souladu s příslušnou ČSN. Protokol podepsán a zaevidován.`;

    const encoded = encodeURIComponent(text);
    const phone = contract.client.phone?.replace(/[^0-9+]/g, '') || '';
    const url = phone ? `https://wa.me/${phone}?text=${encoded}` : `https://wa.me/?text=${encoded}`;
    safeOpenExternalUrl(url);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-xl max-w-4xl w-full shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[92vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150 text-slate-800 dark:text-slate-100">
        {/* Header - Industrial Technical Protocol Desk */}
        <div className="p-4 sm:p-5 border-b border-slate-800 bg-slate-950 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/40 text-amber-400 flex items-center justify-center shrink-0">
              <Gauge className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-400 text-slate-950">
                  Normy ČSN
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  #{contract.contractNumber}
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-black text-white mt-0.5">
                Protokoly technických zkoušek
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

        {/* Top Control Bar: List existing or Create New */}
        <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2 overflow-x-auto">
            {protocols.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  triggerHaptic('selection');
                  setSelectedProtocolId(p.id);
                  setIsCreatingNew(false);
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  !isCreatingNew && selectedProtocolId === p.id
                    ? 'bg-teal-600 text-white shadow-xs'
                    : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                }`}
              >
                {p.protocolNumber} ({p.title.split(' ')[2] || 'Zkouška'})
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => {
              triggerHaptic('selection');
              setIsCreatingNew(true);
            }}
            className="px-3.5 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-extrabold text-xs flex items-center gap-1.5 shadow-xs cursor-pointer active:scale-95 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>+ Vystavit nový protokol</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {isCreatingNew ? (
            /* Creation Form */
            <form onSubmit={handleCreateProtocol} className="space-y-4">
              {/* Preset buttons */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-2">
                  Zvolte typ technické zkoušky:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {TEST_PRESETS.map((preset, idx) => (
                    <button
                      key={preset.type}
                      type="button"
                      onClick={() => handleApplyPreset(idx)}
                      className={`p-3 rounded-xl border text-left font-bold text-xs transition-all cursor-pointer ${
                        selectedPresetIdx === idx
                          ? 'border-teal-500 bg-teal-50 dark:bg-teal-950/60 text-teal-900 dark:text-teal-200 ring-2 ring-teal-500/30'
                          : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-850 text-slate-700 dark:text-slate-300 hover:border-teal-300'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        {preset.type === 'water_pressure' ? (
                          <Droplets className="w-4 h-4 text-cyan-500" />
                        ) : preset.type === 'heating_pressure' || preset.type === 'floor_heating_test' ? (
                          <Flame className="w-4 h-4 text-amber-500" />
                        ) : (
                          <ShieldCheck className="w-4 h-4 text-teal-500" />
                        )}
                        <span className="font-extrabold text-slate-900 dark:text-white truncate">
                          {preset.title.replace('Protokol o ', '')}
                        </span>
                      </div>
                      <span className="text-3xs text-slate-400 font-medium block">
                        {preset.standard}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Number, Date, Standard */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Číslo protokolu *
                  </label>
                  <input
                    type="text"
                    value={protocolNumber}
                    onChange={(e) => setProtocolNumber(e.target.value)}
                    className="w-full text-xs font-mono font-bold px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Datum provedení zkoušky *
                  </label>
                  <input
                    type="date"
                    value={testDate}
                    onChange={(e) => setTestDate(e.target.value)}
                    className="w-full text-xs font-bold px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    ČSN norma
                  </label>
                  <input
                    type="text"
                    value={standard}
                    onChange={(e) => setStandard(e.target.value)}
                    className="w-full text-xs font-medium px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700"
                  />
                </div>
              </div>

              {/* Pressures and parameters */}
              <div className="p-4 rounded-xl bg-teal-50/50 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-900/60 space-y-3">
                <span className="text-xs font-extrabold text-teal-900 dark:text-teal-200 uppercase tracking-wider block">
                  Parametry zkoušky a naměřené hodnoty:
                </span>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="text-2xs font-bold text-slate-600 dark:text-slate-400 block mb-1">
                      Materiál potrubí
                    </label>
                    <input
                      type="text"
                      value={pipeMaterial}
                      onChange={(e) => setPipeMaterial(e.target.value)}
                      className="w-full text-xs font-bold px-2.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
                      placeholder="PPR, Alpex..."
                    />
                  </div>

                  <div>
                    <label className="text-2xs font-bold text-slate-600 dark:text-slate-400 block mb-1">
                      Zkušební přetlak (bar) *
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={testPressure}
                      onChange={(e) => setTestPressure(e.target.value === '' ? '' : parseFloat(e.target.value))}
                      className="w-full text-xs font-black px-2.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-teal-700 dark:text-teal-300"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-2xs font-bold text-slate-600 dark:text-slate-400 block mb-1">
                      Doba trvání (minut) *
                    </label>
                    <input
                      type="number"
                      value={durationMinutes}
                      onChange={(e) => setDurationMinutes(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                      className="w-full text-xs font-bold px-2.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-2xs font-bold text-slate-600 dark:text-slate-400 block mb-1">
                      Pokles tlaku (bar) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={pressureDrop}
                      onChange={(e) => setPressureDrop(e.target.value === '' ? '' : parseFloat(e.target.value))}
                      className="w-full text-xs font-black px-2.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
                      required
                    />
                  </div>
                </div>

                {/* Result toggle */}
                <div className="flex items-center justify-between pt-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Celkový výsledek zkoušky:
                    </span>
                    <button
                      type="button"
                      onClick={() => setResult('vyhovuje')}
                      className={`px-3 py-1 rounded-xl text-xs font-extrabold cursor-pointer transition-all ${
                        result === 'vyhovuje'
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'bg-white dark:bg-slate-800 text-slate-600'
                      }`}
                    >
                      ✓ VYHOVUJE
                    </button>
                    <button
                      type="button"
                      onClick={() => setResult('nevyhovuje')}
                      className={`px-3 py-1 rounded-xl text-xs font-extrabold cursor-pointer transition-all ${
                        result === 'nevyhovuje'
                          ? 'bg-rose-600 text-white shadow-xs'
                          : 'bg-white dark:bg-slate-800 text-slate-600'
                      }`}
                    >
                      ✗ NEVYHOVUJE
                    </button>
                  </div>

                  <span className="text-3xs text-slate-500 font-semibold">
                    Dle ČSN nesmí dojít k orosení ani zjevnému poklesu
                  </span>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Zkušební protokol – podrobnosti a průběh zkoušky:
                </label>
                <textarea
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full text-xs font-medium p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 outline-hidden"
                />
              </div>

              {/* Signatures */}
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 space-y-2">
                <span className="text-xs font-extrabold uppercase tracking-wider text-slate-600 dark:text-slate-400 block">
                  Podpisy na mobilu (volitelné):
                </span>

                {activeSigner ? (
                  <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span>Podpis: {activeSigner === 'contractor' ? 'Zkušební technik' : 'Objednatel / TDI'}</span>
                      <button
                        type="button"
                        onClick={() => {
                          const canvas = canvasRef.current;
                          if (canvas) {
                            const ctx = canvas.getContext('2d');
                            ctx?.clearRect(0, 0, canvas.width, canvas.height);
                          }
                        }}
                        className="text-2xs text-rose-600 hover:underline flex items-center gap-1"
                      >
                        <RotateCcw className="w-3 h-3" /> Vymazat
                      </button>
                    </div>
                    <canvas
                      ref={canvasRef}
                      width={380}
                      height={110}
                      onMouseDown={startDrawing}
                      onMouseMove={draw}
                      onMouseUp={stopDrawing}
                      onMouseLeave={stopDrawing}
                      onTouchStart={startDrawing}
                      onTouchMove={draw}
                      onTouchEnd={stopDrawing}
                      className="w-full h-24 bg-slate-50 dark:bg-slate-800 rounded-xl border border-dashed border-slate-400 touch-none"
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setActiveSigner(null)}
                        className="px-3 py-1 rounded-lg text-xs font-bold bg-slate-200 text-slate-700"
                      >
                        Zrušit
                      </button>
                      <button
                        type="button"
                        onClick={saveSignature}
                        className="px-3 py-1 rounded-lg text-xs font-bold bg-teal-600 text-white"
                      >
                        Uložit podpis
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => setActiveSigner('contractor')}
                      className="p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-left font-bold cursor-pointer"
                    >
                      <span className="text-3xs text-slate-400 block">Zkoušku provedl (Technik)</span>
                      <span>{contractorSignature ? '✓ Podepsáno' : '+ Podepsat prstem'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveSigner('client')}
                      className="p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-left font-bold cursor-pointer"
                    >
                      <span className="text-3xs text-slate-400 block">Za objednatele / TDI</span>
                      <span>{clientSignature ? '✓ Podepsáno' : '+ Podepsat prstem'}</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Submit */}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreatingNew(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
                >
                  Zrušit
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-black text-xs sm:text-sm flex items-center gap-2 shadow-md cursor-pointer active:scale-95 transition-all"
                >
                  <Check className="w-4 h-4 stroke-[3]" />
                  <span>Vystavit a uložit protokol ({protocolNumber})</span>
                </button>
              </div>
            </form>
          ) : selectedProtocol ? (
            /* Printable Protocol View */
            <div className="space-y-4">
              <div className="p-6 rounded-xl bg-white dark:bg-slate-950 border-2 border-slate-200 dark:border-slate-800 shadow-sm space-y-4 text-xs font-serif print:border-none print:shadow-none">
                {/* Header of document */}
                <div className="border-b-2 border-slate-900 dark:border-white pb-3 flex items-start justify-between">
                  <div>
                    <h3 className="text-base sm:text-lg font-black font-sans uppercase tracking-tight text-slate-900 dark:text-white">
                      {selectedProtocol.title}
                    </h3>
                    <p className="text-xs text-slate-600 dark:text-slate-400 font-sans font-bold">
                      Dle normy: {selectedProtocol.standard}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="font-mono font-bold text-sm text-teal-600 block">
                      {selectedProtocol.protocolNumber}
                    </span>
                    <span className="text-2xs text-slate-500 font-sans">
                      Datum zkoušky: {formatDateCs(selectedProtocol.date)}
                    </span>
                  </div>
                </div>

                {/* Building / Contract parties */}
                <div className="grid grid-cols-2 gap-4 py-2 border-b border-slate-200 dark:border-slate-800 font-sans">
                  <div>
                    <span className="text-3xs uppercase font-extrabold text-slate-400 block">Zhotovitel díla:</span>
                    <span className="font-bold text-slate-900 dark:text-white block">{contract.contractor.name}</span>
                    <span className="text-2xs text-slate-600 dark:text-slate-400">IČO: {contract.contractor.ico || 'Neuvedeno'}</span>
                  </div>

                  <div>
                    <span className="text-3xs uppercase font-extrabold text-slate-400 block">Objednatel & Místo stavby:</span>
                    <span className="font-bold text-slate-900 dark:text-white block">{contract.client.name}</span>
                    <span className="text-2xs text-slate-600 dark:text-slate-400">{contract.executionPlace || contract.client.address}</span>
                  </div>
                </div>

                {/* Test Parameters Table */}
                <div className="font-sans space-y-2">
                  <h4 className="text-xs font-black uppercase text-slate-700 dark:text-slate-300">
                    Protokolované hodnoty zkoušky:
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                      <span className="text-3xs text-slate-400 block">Materiál rozvodů</span>
                      <span className="font-bold">{selectedProtocol.pipeMaterial || 'Normovaný'}</span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                      <span className="text-3xs text-slate-400 block">Zkušební tlak</span>
                      <span className="font-black text-teal-600">{selectedProtocol.testPressureBar} bar</span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                      <span className="text-3xs text-slate-400 block">Doba trvání</span>
                      <span className="font-bold">{selectedProtocol.testDurationMinutes} minut</span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                      <span className="text-3xs text-slate-400 block">Naměřený únik</span>
                      <span className="font-black">{selectedProtocol.pressureDropBar} bar</span>
                    </div>
                  </div>
                </div>

                {/* Outcome Banner */}
                <div
                  className={`p-3.5 rounded-xl border flex items-center justify-between font-sans ${
                    selectedProtocol.result === 'vyhovuje'
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 text-emerald-900 dark:text-emerald-200'
                      : 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 text-rose-900 dark:text-rose-200'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    <div>
                      <span className="font-black text-sm block">VÝSLEDEK ZKOUŠKY: {selectedProtocol.result.toUpperCase()}</span>
                      <span className="text-2xs opacity-80">Rozvody splňují požadavky příslušných technických norem ČR.</span>
                    </div>
                  </div>
                </div>

                {/* Protocol notes */}
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-sans">
                  <span className="text-3xs uppercase font-extrabold text-slate-400 block mb-1">Záznam o průběhu:</span>
                  <p className="text-xs leading-relaxed text-slate-700 dark:text-slate-300">{selectedProtocol.notes}</p>
                </div>

                {/* Signatures */}
                <div className="pt-6 grid grid-cols-2 gap-8 font-sans border-t border-slate-200 dark:border-slate-800">
                  <div className="text-center space-y-2">
                    {selectedProtocol.contractorSignature ? (
                      <img src={selectedProtocol.contractorSignature} alt="Podpis technika" className="h-12 mx-auto" />
                    ) : (
                      <div className="h-12 border-b border-dashed border-slate-300"></div>
                    )}
                    <span className="text-2xs font-bold block">{selectedProtocol.testedBy}</span>
                    <span className="text-3xs text-slate-400 block">Zkoušku provedl (Technik zhotovitele)</span>
                  </div>

                  <div className="text-center space-y-2">
                    {selectedProtocol.clientSignature ? (
                      <img src={selectedProtocol.clientSignature} alt="Podpis objednatele" className="h-12 mx-auto" />
                    ) : (
                      <div className="h-12 border-b border-dashed border-slate-300"></div>
                    )}
                    <span className="text-2xs font-bold block">{selectedProtocol.witnessedBy}</span>
                    <span className="text-3xs text-slate-400 block">Zkoušce přítomen (Objednatel / TDI)</span>
                  </div>
                </div>
              </div>

              {/* Action Bar for selected protocol */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleShareWhatsApp(selectedProtocol)}
                    className="min-h-[42px] px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs flex items-center gap-1.5 shadow-xs cursor-pointer active:scale-95 transition-all"
                  >
                    <Share2 className="w-4 h-4" />
                    <span>Sdílet protokol (WhatsApp)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="min-h-[42px] px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-extrabold text-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <Printer className="w-4 h-4" />
                    <span>Tisk protokolu</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => handleDeleteProtocol(selectedProtocol.id)}
                  className="min-h-[42px] px-3 py-2 rounded-xl text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Smazat</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="p-8 text-center text-slate-400">
              <Gauge className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="font-bold text-sm">Žádný technický protokol zatím nebyl vystaven.</p>
              <p className="text-xs mt-1">Klikněte na „Vystavit nový protokol“ pro tlakovou zkoušku vody nebo topení.</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/80 flex items-center justify-between shrink-0">
          <div className="text-2xs text-slate-500 font-medium">
            Protokoly splňují náležitosti pro kolaudaci a předání stavby dle norem ČSN.
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 text-slate-800 dark:text-slate-200 font-bold text-xs"
          >
            Zavřít
          </button>
        </div>
      </div>
    </div>
  );
};
