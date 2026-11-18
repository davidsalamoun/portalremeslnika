import React, { useState } from 'react';
import { Dialog } from './Dialog';
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
    <Dialog
      title="Odjezd ze stavby"
      subtitle="Kontrola před odjezdem."
      size="xl"
      closeOnBackdrop={false}
      onClose={onClose}
    >

        {/* Content Body */}
        <div className="space-y-4">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-[15px]">
            <span className="font-semibold text-slate-900 dark:text-white">{contract.client.name}</span>
            <span className="text-slate-600 dark:text-slate-400">{contract.contractNumber}</span>
          </div>

          <p className="text-slate-600 dark:text-slate-400">
            Před odjezdem si odškrtněte, že na stavbě nic nezůstalo otevřené, zapnuté ani nezamčené:
          </p>

          {/* 4 Fat-finger checklist buttons */}
          <div className="grid grid-cols-1 gap-2.5">
            {/* 1. Voda */}
            <button
              type="button"
              onClick={() => handleToggle(setWaterClosed, waterClosed)}
              aria-pressed={waterClosed}
              className={`min-h-11 min-w-11 p-3.5 rounded-md border-[1.5px] text-left transition-colors flex items-center justify-between cursor-pointer ${
                waterClosed
                  ? 'bg-white dark:bg-slate-900 border-slate-900 dark:border-slate-300'
                  : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 hover:border-slate-500'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-semibold ${
                  waterClosed ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                }`}>
                  <Droplets className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-semibold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                    Hlavní uzávěr vody uzavřen
                  </div>
                  <div className="text-sm text-slate-600 dark:text-slate-400">
                    Přívody a ventily zastaveny, potrubí bez úniku
                  </div>
                </div>
              </div>
              <div className={`w-6 h-6 rounded flex items-center justify-center border font-semibold text-sm ${
                waterClosed ? 'bg-slate-900 border-slate-900 text-white dark:bg-white dark:border-white dark:text-slate-900' : 'border-slate-400 dark:border-slate-600 bg-white dark:bg-slate-900'
              }`}>
                {waterClosed ? <CheckCircle2 className="w-4 h-4" /> : ''}
              </div>
            </button>

            {/* 2. Elektřina */}
            <button
              type="button"
              onClick={() => handleToggle(setPowerTurnedOff, powerTurnedOff)}
              aria-pressed={powerTurnedOff}
              className={`min-h-11 min-w-11 p-3.5 rounded-md border-[1.5px] text-left transition-colors flex items-center justify-between cursor-pointer ${
                powerTurnedOff
                  ? 'bg-white dark:bg-slate-900 border-slate-900 dark:border-slate-300'
                  : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 hover:border-slate-500'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-semibold ${
                  powerTurnedOff ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                }`}>
                  <Zap className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-semibold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                    Spotřebiče a jističe vypnuty
                  </div>
                  <div className="text-sm text-slate-600 dark:text-slate-400">
                    Přímotopy, nabíječky baterek a stavební světla vypojeny
                  </div>
                </div>
              </div>
              <div className={`w-6 h-6 rounded flex items-center justify-center border font-semibold text-sm ${
                powerTurnedOff ? 'bg-slate-900 border-slate-900 text-white dark:bg-white dark:border-white dark:text-slate-900' : 'border-slate-400 dark:border-slate-600 bg-white dark:bg-slate-900'
              }`}>
                {powerTurnedOff ? <CheckCircle2 className="w-4 h-4" /> : ''}
              </div>
            </button>

            {/* 3. Okna a dveře */}
            <button
              type="button"
              onClick={() => handleToggle(setWindowsAndDoorsLocked, windowsAndDoorsLocked)}
              aria-pressed={windowsAndDoorsLocked}
              className={`min-h-11 min-w-11 p-3.5 rounded-md border-[1.5px] text-left transition-colors flex items-center justify-between cursor-pointer ${
                windowsAndDoorsLocked
                  ? 'bg-white dark:bg-slate-900 border-slate-900 dark:border-slate-300'
                  : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 hover:border-slate-500'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-semibold ${
                  windowsAndDoorsLocked ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                }`}>
                  <Lock className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-semibold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                    Okna zavřena, objekt uzamčen
                  </div>
                  <div className="text-sm text-slate-600 dark:text-slate-400">
                    Všechna okna zaklapnuta, klíč vrácen do schránky / trezorku
                  </div>
                </div>
              </div>
              <div className={`w-6 h-6 rounded flex items-center justify-center border font-semibold text-sm ${
                windowsAndDoorsLocked ? 'bg-slate-900 border-slate-900 text-white dark:bg-white dark:border-white dark:text-slate-900' : 'border-slate-400 dark:border-slate-600 bg-white dark:bg-slate-900'
              }`}>
                {windowsAndDoorsLocked ? <CheckCircle2 className="w-4 h-4" /> : ''}
              </div>
            </button>

            {/* 4. Úklid */}
            <button
              type="button"
              onClick={() => handleToggle(setSiteCleaned, siteCleaned)}
              aria-pressed={siteCleaned}
              className={`min-h-11 min-w-11 p-3.5 rounded-md border-[1.5px] text-left transition-colors flex items-center justify-between cursor-pointer ${
                siteCleaned
                  ? 'bg-white dark:bg-slate-900 border-slate-900 dark:border-slate-300'
                  : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 hover:border-slate-500'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-semibold ${
                  siteCleaned ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                }`}>
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-semibold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                    Nářadí sbaleno a hrubý úklid
                  </div>
                  <div className="text-sm text-slate-600 dark:text-slate-400">
                    Nářadí v autě, materiál zabezpečen proti dešti a větru
                  </div>
                </div>
              </div>
              <div className={`w-6 h-6 rounded flex items-center justify-center border font-semibold text-sm ${
                siteCleaned ? 'bg-slate-900 border-slate-900 text-white dark:bg-white dark:border-white dark:text-slate-900' : 'border-slate-400 dark:border-slate-600 bg-white dark:bg-slate-900'
              }`}>
                {siteCleaned ? <CheckCircle2 className="w-4 h-4" /> : ''}
              </div>
            </button>
          </div>

          {/* Stavový box */}
          {isAllChecked ? (
            <p role="status" className="flex items-center gap-2 font-semibold text-emerald-800 dark:text-emerald-300">
              <CheckCircle2 className="w-5 h-5 shrink-0" />
              Všechny 4 body jsou splněné, stavba je zabezpečená.
            </p>
          ) : (
            <p className="text-slate-600 dark:text-slate-400">Klepnutím odškrtněte body před zamknutím objektu.</p>
          )}

          {/* Rychlá poznámka pro zákazníka */}
          <div>
            <label htmlFor="odjezd-vzkaz" className="font-semibold text-slate-900 dark:text-slate-100 block mb-1.5">
              Vzkaz pro klienta <span className="font-normal text-slate-600 dark:text-slate-400">(nepovinné)</span>
            </label>
            <input
              id="odjezd-vzkaz"
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Např. Zítra přijedeme v 7:30, materiál dorazí odpoledne"
              className="min-h-11 w-full px-3 rounded-md border-[1.5px] border-slate-900 dark:border-slate-500 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
            />
          </div>
        </div>

        {/* Footer actions */}
        <div className="mt-5 pt-4 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2.5">
          <button
            type="button"
            onClick={handleSendWhatsApp}
            className="min-h-11 inline-flex items-center justify-center gap-1.5 px-4 rounded-md border-[1.5px] border-slate-900 dark:border-slate-500 text-slate-900 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold cursor-pointer transition-colors"
            title="Poslat zákazníkovi zprávu o stavu stavby na WhatsApp"
          >
            <Send className="w-4 h-4" />
            <span>Poslat na WhatsApp</span>
          </button>

          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={onClose}
              className="min-h-11 inline-flex items-center justify-center gap-1.5 px-4 rounded-md border-[1.5px] border-slate-900 dark:border-slate-500 text-slate-900 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold cursor-pointer transition-colors"
            >
              Zrušit
            </button>
            <button
              type="button"
              onClick={handleSaveChecklist}
              className="min-h-11 inline-flex items-center justify-center px-5 rounded-md border-[1.5px] border-slate-900 bg-amber-400 hover:bg-amber-300 text-slate-900 font-semibold cursor-pointer transition-colors"
            >
              Uložit kontrolu k zakázce
            </button>
          </div>
        </div>
      </Dialog>
  );
};
