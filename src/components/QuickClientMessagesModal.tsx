import React, { useState, useMemo } from 'react';
import {
  X,
  MessageSquare,
  Send,
  Copy,
  Car,
  Clock,
  Package,
  FileSignature,
  Check
} from 'lucide-react';
import { Contract } from '../types/contract';
import { triggerHaptic } from '../utils/haptics';
import { safeOpenExternalUrl } from '../utils/shareUtils';
import { ensureSignShare, generateSignToken, buildSigningUrl } from '../utils/signShares';

interface QuickClientMessagesModalProps {
  isOpen: boolean;
  onClose: () => void;
  contract: Contract;
  /** Uloží změnu smlouvy (tajný kód odkazu k online podpisu) */
  onUpdateContract?: (updated: Contract) => void;
  onToast: (type: 'success' | 'error' | 'info', message: string) => void;
}

export const QuickClientMessagesModal: React.FC<QuickClientMessagesModalProps> = ({
  isOpen,
  onClose,
  contract,
  onUpdateContract,
  onToast,
}) => {
  const [selectedTemplateIndex, setSelectedTemplateIndex] = useState(0);
  const [customMinutes, setCustomMinutes] = useState('20');
  const [resumeDate, setResumeDate] = useState('zítra v 8:00');
  const [deliveryDate, setDeliveryDate] = useState('zítra ráno');
  const [copied, setCopied] = useState(false);

  // Tajný kód odkazu k online podpisu: uložený u smlouvy, nebo nově vygenerovaný
  const signToken = useMemo(() => contract.signToken || generateSignToken(), [contract.id, contract.signToken]);

  if (!isOpen) return null;

  const clientName = contract.client.name.split(' ')[0] || contract.client.name;
  const contractorName = contract.contractor.name || 'Váš řemeslník';
  const cleanPhone = (contract.client.phone || '').replace(/\s+/g, '').replace(/-/g, '');

  const templates = [
    {
      id: 'on_the_way',
      title: 'Vyrážím na stavbu',
      icon: Car,
      color: 'blue',
      getText: () =>
        `Dobrý den, ${clientName}, právě vyrážím k vám na stavbu (${contract.workDescription.slice(0, 40)}...). Dorazím za cca ${customMinutes} minut. S pozdravem, ${contractorName}.`,
    },
    {
      id: 'pause',
      title: 'Technologická pauza (schnutí)',
      icon: Clock,
      color: 'amber',
      getText: () =>
        `Dobrý den, ${clientName}, dnes proběhly sjednané práce. Nyní musíme dodržet technologickou pauzu na řádné vyschnutí a vyzrání podkladu dle norem. Pokračujeme ${resumeDate}. Přeji hezký den, ${contractorName}.`,
    },
    {
      id: 'material',
      title: 'Materiál objednán / závoz',
      icon: Package,
      color: 'emerald',
      getText: () =>
        `Dobrý den, ${clientName}, stavební materiál pro vaši zakázku č. ${contract.contractNumber} je úspěšně objednán a připraven. Závoz a vykládka na stavbě proběhne ${deliveryDate}. S pozdravem, ${contractorName}.`,
    },
    {
      id: 'signing',
      title: 'Výzva k online podpisu',
      icon: FileSignature,
      color: 'purple',
      getText: () =>
        `Dobrý den, ${clientName}, připravil jsem pro vás k podpisu dokumenty k zakázce "${contract.workDescription.slice(0, 45)}...". Můžete je pohodlně zkontrolovat a podepsat prstem přímo ve vašem mobilu: ${buildSigningUrl(signToken)}. Děkuji, ${contractorName}.`,
    },
  ];

  const currentText = templates[selectedTemplateIndex].getText();

  // U výzvy k podpisu se před odesláním založí odkaz v databázi a kód se uloží ke smlouvě
  const prepareSigningLink = () => {
    if (templates[selectedTemplateIndex].id !== 'signing') return;
    if (!contract.signToken) onUpdateContract?.({ ...contract, signToken });
    ensureSignShare(contract, signToken).catch((err) => {
      console.warn('Odkaz k podpisu se nepodařilo uložit:', err?.message || err);
      onToast('error', 'Odkaz k podpisu se nepodařilo připravit. Zkontrolujte připojení k internetu a zprávu pošlete znovu.');
    });
  };

  const handleSendWhatsApp = () => {
    triggerHaptic('success');
    prepareSigningLink();
    let phone = cleanPhone;
    if (phone.startsWith('00')) phone = phone.substring(2);
    if (!phone.startsWith('+')) {
      if (phone.length === 9) phone = '420' + phone;
      else if (!phone.startsWith('420')) phone = '420' + phone;
    } else {
      phone = phone.substring(1);
    }

    const url = `https://wa.me/${phone}?text=${encodeURIComponent(currentText)}`;
    safeOpenExternalUrl(url);
    onToast('success', 'Otevírám WhatsApp s předvyplněnou zprávou.');
    onClose();
  };

  const handleCopy = () => {
    triggerHaptic('light');
    prepareSigningLink();
    navigator.clipboard.writeText(currentText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    onToast('success', 'Zpráva byla zkopírována do schránky pro SMS.');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-xl max-w-lg w-full p-5 sm:p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
        {/* Header - Industrial Client Dispatch */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                  SMS / WhatsApp
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  #{contract.contractNumber}
                </span>
              </div>
              <h3 className="font-black text-base text-slate-900 dark:text-white mt-0.5">
                Rychlá zpráva investorovi
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 bg-slate-100 dark:bg-slate-800 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Template Selector Grid */}
        <div className="grid grid-cols-2 gap-2">
          {templates.map((tpl, idx) => {
            const Icon = tpl.icon;
            const isSelected = selectedTemplateIndex === idx;
            return (
              <button
                key={tpl.id}
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  setSelectedTemplateIndex(idx);
                }}
                className={`p-3 rounded-xl border text-left flex flex-col items-start gap-1.5 transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-blue-50 dark:bg-blue-950/80 border-blue-500 dark:border-blue-500 shadow-xs ring-2 ring-blue-200 dark:ring-blue-900'
                    : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                }`}
              >
                <div className={`p-1.5 rounded-xl ${
                  isSelected ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                }`}>
                  <Icon className="w-4 h-4" />
                </div>
                <span className={`text-xs font-bold leading-tight ${
                  isSelected ? 'text-blue-900 dark:text-blue-200' : 'text-slate-800 dark:text-slate-200'
                }`}>
                  {tpl.title}
                </span>
              </button>
            );
          })}
        </div>

        {/* Context parameters depending on template */}
        {selectedTemplateIndex === 0 && (
          <div className="flex items-center gap-2 p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl text-xs">
            <span className="font-semibold text-slate-600 dark:text-slate-300">Budu tam za (minut):</span>
            <input
              type="text"
              value={customMinutes}
              onChange={(e) => setCustomMinutes(e.target.value)}
              className="w-16 px-2 py-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-center font-bold"
            />
          </div>
        )}

        {selectedTemplateIndex === 1 && (
          <div className="flex items-center gap-2 p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl text-xs">
            <span className="font-semibold text-slate-600 dark:text-slate-300">Pokračujeme:</span>
            <input
              type="text"
              value={resumeDate}
              onChange={(e) => setResumeDate(e.target.value)}
              className="flex-1 px-2.5 py-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg font-bold"
            />
          </div>
        )}

        {selectedTemplateIndex === 2 && (
          <div className="flex items-center gap-2 p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl text-xs">
            <span className="font-semibold text-slate-600 dark:text-slate-300">Závoz materiálu:</span>
            <input
              type="text"
              value={deliveryDate}
              onChange={(e) => setDeliveryDate(e.target.value)}
              className="flex-1 px-2.5 py-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg font-bold"
            />
          </div>
        )}

        {/* Text Preview */}
        <div>
          <label className="block text-2xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
            Náhled textu pro klienta:
          </label>
          <div className="p-3.5 bg-slate-50 dark:bg-slate-850 rounded-xl border border-slate-200 dark:border-slate-800 text-xs sm:text-sm text-slate-800 dark:text-slate-200 leading-relaxed font-sans select-all whitespace-pre-line">
            {currentText}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-3 pt-2">
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center justify-center gap-2 py-3 px-3 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 font-extrabold text-xs transition-colors cursor-pointer active:scale-95"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
            <span>{copied ? 'Zkopírováno!' : 'Kopírovat pro SMS'}</span>
          </button>

          <button
            type="button"
            onClick={handleSendWhatsApp}
            className="flex items-center justify-center gap-2 py-3 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-md transition-all cursor-pointer active:scale-95"
          >
            <Send className="w-4 h-4" />
            <span>Odeslat WhatsApp</span>
          </button>
        </div>
      </div>
    </div>
  );
};
