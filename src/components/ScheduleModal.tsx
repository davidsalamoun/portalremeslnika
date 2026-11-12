import React, { useState } from 'react';
import {
  X,
  Plus,
  Trash2,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  DollarSign,
  Layers,
  ChevronRight,
} from 'lucide-react';
import { Contract, ScheduleMilestone, MilestoneStatus } from '../types/contract';
import { formatDateCs, formatCurrency } from '../utils/numberToWordsCs';

interface ScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  contract: Contract;
  onUpdateContract: (updated: Contract) => void;
  onToast?: (type: 'success' | 'error' | 'info', text: string) => void;
}

const DEFAULT_MILESTONES: ScheduleMilestone[] = [
  {
    id: 'stage_1',
    title: 'Zahájení a hrubé bourací práce',
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0],
    status: 'completed',
    progressPercent: 100,
    paymentMilestone: 'Záloha 30 % při podpisu',
    isPaymentLinked: true,
  },
  {
    id: 'stage_2',
    title: 'Rozvody instalací (voda, odpad, elektro)',
    startDate: new Date(Date.now() + 4 * 86400000).toISOString().split('T')[0],
    endDate: new Date(Date.now() + 8 * 86400000).toISOString().split('T')[0],
    status: 'in_progress',
    progressPercent: 60,
    paymentMilestone: 'Kontrolní den rozvodů',
  },
  {
    id: 'stage_3',
    title: 'Zednické začištění, penetrace a hydroizolace',
    startDate: new Date(Date.now() + 9 * 86400000).toISOString().split('T')[0],
    endDate: new Date(Date.now() + 12 * 86400000).toISOString().split('T')[0],
    status: 'planned',
    progressPercent: 0,
  },
  {
    id: 'stage_4',
    title: 'Obkladačské práce a spárování',
    startDate: new Date(Date.now() + 13 * 86400000).toISOString().split('T')[0],
    endDate: new Date(Date.now() + 18 * 86400000).toISOString().split('T')[0],
    status: 'planned',
    progressPercent: 0,
    paymentMilestone: '2. Záloha 40 % po obkladech',
    isPaymentLinked: true,
  },
  {
    id: 'stage_5',
    title: 'Kompletace zařizovacích předmětů a předání díla',
    startDate: new Date(Date.now() + 19 * 86400000).toISOString().split('T')[0],
    endDate: new Date(Date.now() + 21 * 86400000).toISOString().split('T')[0],
    status: 'planned',
    progressPercent: 0,
    paymentMilestone: 'Doplatek při předání protokolu',
    isPaymentLinked: true,
  },
];

export const ScheduleModal: React.FC<ScheduleModalProps> = ({
  isOpen,
  onClose,
  contract,
  onUpdateContract,
  onToast,
}) => {
  const [milestones, setMilestones] = useState<ScheduleMilestone[]>(
    contract.schedule && contract.schedule.length > 0 ? contract.schedule : DEFAULT_MILESTONES
  );

  // New milestone inputs
  const [newTitle, setNewTitle] = useState('');
  const [newStart, setNewStart] = useState(() => new Date().toISOString().split('T')[0]);
  const [newEnd, setNewEnd] = useState(() => new Date(Date.now() + 5 * 86400000).toISOString().split('T')[0]);
  const [newPayment, setNewPayment] = useState('');

  if (!isOpen) return null;

  const handleAddMilestone = () => {
    if (!newTitle.trim()) {
      if (onToast) onToast('error', 'Zadejte název etapy.');
      return;
    }

    const item: ScheduleMilestone = {
      id: `ms_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      title: newTitle.trim(),
      startDate: newStart,
      endDate: newEnd,
      status: 'planned',
      progressPercent: 0,
      paymentMilestone: newPayment.trim() || undefined,
      isPaymentLinked: Boolean(newPayment.trim()),
    };

    const updated = [...milestones, item];
    setMilestones(updated);
    onUpdateContract({
      ...contract,
      schedule: updated,
    });
    setNewTitle('');
    setNewPayment('');
    if (onToast) onToast('success', 'Nová etapa byla přidána do harmonogramu.');
  };

  const handleUpdateStatus = (id: string, status: MilestoneStatus, progress: number) => {
    const updated = milestones.map((m) =>
      m.id === id ? { ...m, status, progressPercent: progress } : m
    );
    setMilestones(updated);
    onUpdateContract({
      ...contract,
      schedule: updated,
    });
  };

  const handleDeleteMilestone = (id: string) => {
    const updated = milestones.filter((m) => m.id !== id);
    setMilestones(updated);
    onUpdateContract({
      ...contract,
      schedule: updated,
    });
  };

  const totalProgress =
    milestones.length > 0
      ? Math.round(milestones.reduce((sum, m) => sum + m.progressPercent, 0) / milestones.length)
      : 0;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl w-full max-w-3xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden my-auto">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-900 text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-amber-400">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base leading-tight">Harmonogram a kalendář etap</h3>
              <p className="text-xs text-slate-300">
                Gantt časová osa, termíny realizace a navázané zálohové platby
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Progress bar */}
          <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Celkový postup stavby
              </span>
              <span className="font-mono font-bold text-sm text-slate-900 dark:text-white">
                {totalProgress} %
              </span>
            </div>
            <div className="w-full bg-slate-200 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden">
              <div
                className="bg-amber-500 h-full transition-all duration-300 rounded-full"
                style={{ width: `${totalProgress}%` }}
              />
            </div>
          </div>

          {/* Vizuální časová osa etap */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
                <Layers className="w-4 h-4 text-amber-500" />
                Etapy realizace ({milestones.length})
              </h4>
            </div>

            <div className="space-y-3">
              {milestones.map((m, idx) => (
                <div
                  key={m.id}
                  className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 shadow-xs space-y-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 font-bold text-xs flex items-center justify-center shrink-0">
                        {idx + 1}
                      </div>
                      <div>
                        <div className="font-bold text-sm text-slate-900 dark:text-white">
                          {m.title}
                        </div>
                        <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span>
                            {formatDateCs(m.startDate)} – {formatDateCs(m.endDate)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <select
                        value={m.status}
                        onChange={(e) => {
                          const val = e.target.value as MilestoneStatus;
                          const progress = val === 'completed' ? 100 : val === 'planned' ? 0 : 50;
                          handleUpdateStatus(m.id, val, progress);
                        }}
                        className={`text-xs font-semibold px-2.5 py-1 rounded-lg border cursor-pointer ${
                          m.status === 'completed'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : m.status === 'in_progress'
                            ? 'bg-blue-50 text-blue-700 border-blue-200'
                            : m.status === 'delayed'
                            ? 'bg-red-50 text-red-700 border-red-200'
                            : 'bg-slate-100 text-slate-700 border-slate-200'
                        }`}
                      >
                        <option value="planned">Naplánováno</option>
                        <option value="in_progress">Probíhá</option>
                        <option value="completed">Dokončeno</option>
                        <option value="delayed">Zpožděno</option>
                      </select>

                      <button
                        type="button"
                        onClick={() => handleDeleteMilestone(m.id)}
                        className="text-slate-400 hover:text-red-600 p-1 rounded-md"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Progress bar per milestone */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] text-slate-500">
                      <span>Dokončeno:</span>
                      <span className="font-semibold">{m.progressPercent} %</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={5}
                      value={m.progressPercent}
                      onChange={(e) => {
                        const val = parseInt(e.target.value);
                        const stat: MilestoneStatus =
                          val === 100 ? 'completed' : val > 0 ? 'in_progress' : 'planned';
                        handleUpdateStatus(m.id, stat, val);
                      }}
                      className="w-full accent-indigo-600 cursor-pointer"
                    />
                  </div>

                  {/* Navázaná platba / záloha */}
                  {m.paymentMilestone && (
                    <div className="flex items-center gap-1.5 text-xs text-indigo-700 dark:text-indigo-300 bg-indigo-50/70 dark:bg-indigo-950/40 p-2 rounded-lg">
                      <DollarSign className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                      <span>Platba: {m.paymentMilestone}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Přidání nové etapy */}
          <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
            <h5 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Přidat novou etapu do harmonogramu:
            </h5>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-500 block mb-1">Název etapy:</label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="např. Montáž sádrokartonů a tmelení"
                  className="w-full px-3 py-1.5 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                />
              </div>

              <div>
                <label className="text-xs text-slate-500 block mb-1">Navázaná záloha / platba:</label>
                <input
                  type="text"
                  value={newPayment}
                  onChange={(e) => setNewPayment(e.target.value)}
                  placeholder="např. Záloha 25 000 Kč po dokončení"
                  className="w-full px-3 py-1.5 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                />
              </div>

              <div>
                <label className="text-xs text-slate-500 block mb-1">Datum zahájení:</label>
                <input
                  type="date"
                  value={newStart}
                  onChange={(e) => setNewStart(e.target.value)}
                  className="w-full px-3 py-1.5 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                />
              </div>

              <div>
                <label className="text-xs text-slate-500 block mb-1">Datum dokončení:</label>
                <input
                  type="date"
                  value={newEnd}
                  onChange={(e) => setNewEnd(e.target.value)}
                  className="w-full px-3 py-1.5 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                />
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={handleAddMilestone}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Přidat etapu</span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex items-center justify-between">
          <span className="text-xs text-slate-500">
            Termíny etap jsou synchronizovány s termínem dokončení smlouvy
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
