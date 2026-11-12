import React, { useState } from 'react';
import {
  ShieldCheck,
  X,
  Droplets,
  Zap,
  Lock,
  CheckCircle2,
  Clock,
  Send,
  Calendar,
  AlertTriangle,
} from 'lucide-react';
import { Contract, DepartureChecklist } from '../types/contract';
import { formatDateCs } from '../utils/numberToWordsCs';
import { getDirectWhatsAppUrl, safeOpenExternalUrl } from '../utils/shareUtils';
import { triggerHaptic } from '../utils/haptics';

interface DepartureChecklistModalProps {
  isOpen: boolean;
  onClose: () => void;
  contract: Contract;
  onUpdateContract: (updated: Contract) => void;
  onToast?: (type: 'success' | 'error' | 'info', text: string) => void;
}

export const DepartureChecklistModal: React.FC<DepartureChecklistModalProps> = ({
  isOpen,
  onClose,
  contract,
  onUpdateContract,
  onToast,
}) => {
  if (!isOpen) return null;

  const now = new Date();
  const timeStr = now.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' });
  const dateStr = now.toISOString().split('T')[0];

  const [waterClosed, setWaterClosed] = useState(false);
  const [powerTurnedOff, setPowerTurnedOff] = useState(false);
  const [windowsAndDoorsLocked, setWindowsAndDoorsLocked] = useState(false);
  const [siteCleaned, setSiteCleaned] = useState(false);
  const [note, setNote] = useState('');

  const isAllChecked = waterClosed && powerTurnedOff && windowsAndDoorsLocked && siteCleaned;

  const handleToggle = (setter: React.Dispatch<React.SetStateAction<boolean>>, current: boolean) => {
    setter(!current);
    triggerHaptic('selection');
  };

  const handleSaveChecklist = () => {
    const newEntry: DepartureChecklist = {
      id: `chk_${Date.now()}`,
      date: dateStr,
      time: timeStr,
      checkedBy: contract.contractor?.name || 'Zhotovitel',
      waterClosed,
      powerTurnedOff,
      windowsAndDoorsLocked,
      siteCleaned,
      notes: note.trim() || undefined,
    };

    const currentList = contract.departureChecklists || [];
    onUpdateContract({
      ...contract,
      departureChecklists: [newEntry, ...currentList],
    });

    triggerHaptic('success');
    if (onToast) onToast('success', 'Kontrola před odjezdem byla uložena.');
    onClose();
  };

  const handleSendWhatsApp = () => {
    const clientName = contract.client.name.split(' ')[0] || contract.client.name;
    const contractorName = contract.contractor?.name || 'Zhotovitel';

    const msg = [
      `Dobrý den ${clientName},`,
      `dnešní práce na zakázce (${contract.workDescription.substring(0, 60)}...) byly v ${timeStr} ukončeny.`,
      ``,
      `Bezpečnostní kontrola před odjezdem ze stavby:`,
      waterClosed ? `✓ Voda a přívody řádně uzavřeny` : `• Kontrola vody`,
      powerTurnedOff ? `✓ Spotřebiče a hlavní jističe zabezpečeny` : `• Kontrola elektřiny`,
      windowsAndDoorsLocked ? `✓ Všechna okna zavřena a objekt uzamčen` : `• Objekt uzamčen`,
      siteCleaned ? `✓ Pracoviště uklizeno a nářadí sbaleno` : `• Úklid pracoviště`,
      note ? `\nPoznámka pro vás: ${note}` : '',
      ``,
      `Přejeme hezký zbytek dne,\n${contractorName}`,
    ]
      .filter(Boolean)
      .join('\n');

    const url = getDirectWhatsAppUrl(msg, contract.client.phone);
    safeOpenExternalUrl(url);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl w-full max-w-xl shadow-2xl overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900 text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-500 text-slate-950 flex items-center justify-center font-black">
              <ShieldCheck className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono uppercase font-black text-amber-400">Předopouštěcí protokol</span>
                <span className="text-[11px] font-mono text-slate-400">· {timeStr}</span>
              </div>
              <h3 className="font-black text-base text-white tracking-tight">
                Kontrola před odjezdem ze stavby
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
            <div>
              <span className="text-[10px] font-mono uppercase text-slate-400 block font-bold">Stavba & Klient</span>
              <span className="text-sm font-bold text-slate-900 dark:text-white">{contract.client.name}</span>
            </div>
            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
              SOD #{contract.contractNumber}
            </span>
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            Klidná hlava po šichtě. 4 rychlá klepnutí potvrdí, že na stavbě nic nezůstalo otevřené, zapnuté ani neuzamčené:
          </p>

          {/* 4 Fat-finger checklist buttons */}
          <div className="grid grid-cols-1 gap-2.5">
            {/* 1. Voda */}
            <button
              type="button"
              onClick={() => handleToggle(setWaterClosed, waterClosed)}
              className={`p-3.5 rounded-lg border-2 text-left transition-all flex items-center justify-between cursor-pointer active:scale-98 ${
                waterClosed
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 text-emerald-950 dark:text-emerald-100 shadow-xs'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold ${
                  waterClosed ? 'bg-emerald-600 text-white shadow-xs' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                }`}>
                  <Droplets className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-black text-sm text-slate-900 dark:text-white flex items-center gap-2">
                    Hlavní uzávěr vody uzavřen
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    Přívody a ventily zastaveny, potrubí bez úniku
                  </div>
                </div>
              </div>
              <div className={`w-6 h-6 rounded flex items-center justify-center border font-bold text-xs ${
                waterClosed ? 'bg-emerald-600 border-emerald-600 text-white shadow-xs' : 'border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800'
              }`}>
                {waterClosed ? <CheckCircle2 className="w-4 h-4 stroke-[2.5]" /> : ''}
              </div>
            </button>

            {/* 2. Elektřina */}
            <button
              type="button"
              onClick={() => handleToggle(setPowerTurnedOff, powerTurnedOff)}
              className={`p-3.5 rounded-lg border-2 text-left transition-all flex items-center justify-between cursor-pointer active:scale-98 ${
                powerTurnedOff
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 text-emerald-950 dark:text-emerald-100 shadow-xs'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold ${
                  powerTurnedOff ? 'bg-emerald-600 text-white shadow-xs' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                }`}>
                  <Zap className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-black text-sm text-slate-900 dark:text-white flex items-center gap-2">
                    Spotřebiče a jističe vypnuty
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    Přímotopy, nabíječky baterek a stavební světla vypojeny
                  </div>
                </div>
              </div>
              <div className={`w-6 h-6 rounded flex items-center justify-center border font-bold text-xs ${
                powerTurnedOff ? 'bg-emerald-600 border-emerald-600 text-white shadow-xs' : 'border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800'
              }`}>
                {powerTurnedOff ? <CheckCircle2 className="w-4 h-4 stroke-[2.5]" /> : ''}
              </div>
            </button>

            {/* 3. Okna a dveře */}
            <button
              type="button"
              onClick={() => handleToggle(setWindowsAndDoorsLocked, windowsAndDoorsLocked)}
              className={`p-3.5 rounded-lg border-2 text-left transition-all flex items-center justify-between cursor-pointer active:scale-98 ${
                windowsAndDoorsLocked
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 text-emerald-950 dark:text-emerald-100 shadow-xs'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold ${
                  windowsAndDoorsLocked ? 'bg-emerald-600 text-white shadow-xs' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                }`}>
                  <Lock className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-black text-sm text-slate-900 dark:text-white flex items-center gap-2">
                    Okna zavřena, objekt uzamčen
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    Všechna okna zaklapnuta, klíč vrácen do schránky / trezorku
                  </div>
                </div>
              </div>
              <div className={`w-6 h-6 rounded flex items-center justify-center border font-bold text-xs ${
                windowsAndDoorsLocked ? 'bg-emerald-600 border-emerald-600 text-white shadow-xs' : 'border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800'
              }`}>
                {windowsAndDoorsLocked ? <CheckCircle2 className="w-4 h-4 stroke-[2.5]" /> : ''}
              </div>
            </button>

            {/* 4. Úklid */}
            <button
              type="button"
              onClick={() => handleToggle(setSiteCleaned, siteCleaned)}
              className={`p-3.5 rounded-lg border-2 text-left transition-all flex items-center justify-between cursor-pointer active:scale-98 ${
                siteCleaned
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 text-emerald-950 dark:text-emerald-100 shadow-xs'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold ${
                  siteCleaned ? 'bg-emerald-600 text-white shadow-xs' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                }`}>
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-black text-sm text-slate-900 dark:text-white flex items-center gap-2">
                    Nářadí sbaleno a hrubý úklid
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    Nářadí v autě, materiál zabezpečen proti dešti a větru
                  </div>
                </div>
              </div>
              <div className={`w-6 h-6 rounded flex items-center justify-center border font-bold text-xs ${
                siteCleaned ? 'bg-emerald-600 border-emerald-600 text-white shadow-xs' : 'border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800'
              }`}>
                {siteCleaned ? <CheckCircle2 className="w-4 h-4 stroke-[2.5]" /> : ''}
              </div>
            </button>
          </div>

          {/* Stavový box */}
          {isAllChecked ? (
            <div className="p-3 rounded-lg bg-emerald-100 dark:bg-emerald-950/80 border border-emerald-400 dark:border-emerald-700 flex items-center gap-3 text-emerald-950 dark:text-emerald-200">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 stroke-[2.5]" />
              <div className="text-xs font-black font-mono leading-tight">
                VŠECHNY 4 BODY SPLNĚNY! Stavba je řádně zabezpečena pro odjezd.
              </div>
            </div>
          ) : (
            <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800/60 flex items-center gap-2 text-xs text-amber-900 dark:text-amber-300 font-medium">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Klepnutím odškrtněte body před zamknutím objektu.</span>
            </div>
          )}

          {/* Rychlá poznámka pro zákazníka */}
          <div>
            <label className="text-[11px] font-mono uppercase font-bold text-slate-500 block mb-1">
              Poznámka / Vzkaz pro investora:
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Např. Zítra přijedeme v 7:30, materiál dorazí odpoledne"
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
            />
          </div>
        </div>

        {/* Footer actions */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex flex-wrap items-center justify-between gap-2.5">
          <button
            type="button"
            onClick={handleSendWhatsApp}
            className="min-h-[40px] px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs cursor-pointer active:scale-95 transition-all font-mono"
            title="Poslat majiteli uklidňující zprávu na WhatsApp"
          >
            <Send className="w-4 h-4" />
            <span>Poslat na WhatsApp</span>
          </button>

          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 cursor-pointer"
            >
              Zrušit
            </button>
            <button
              type="button"
              onClick={handleSaveChecklist}
              className="px-5 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black cursor-pointer transition-colors shadow-xs font-mono"
            >
              Uložit kontrolu do SOD
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
