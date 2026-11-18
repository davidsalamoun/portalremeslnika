import React, { useState, useMemo } from 'react';
import { Dialog } from './Dialog';
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
    <Dialog
      title="Zpráva zákazníkovi"
      subtitle={<>smlouva {contract.contractNumber}</>}
      size="lg"
      closeOnBackdrop={false}
      onClose={onClose}
    >

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
                aria-pressed={isSelected}
                className={`min-h-11 min-w-11 p-3 rounded-md border text-left flex flex-col items-start gap-1.5 transition-colors cursor-pointer ${
                  isSelected
                    ? 'border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-900'
                    : 'border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <div className="p-0.5">
                  <Icon className="w-4 h-4" />
                </div>
                <span className="font-semibold leading-tight">
                  {tpl.title}
                </span>
              </button>
            );
          })}
        </div>

        {/* Context parameters depending on template */}
        {selectedTemplateIndex === 0 && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <label htmlFor="zprava-minuty" className="font-semibold text-slate-900 dark:text-slate-100">Budu tam za (minut)</label>
            <input
              id="zprava-minuty"
              type="text"
              value={customMinutes}
              onChange={(e) => setCustomMinutes(e.target.value)}
              className="min-h-11 px-3 bg-white dark:bg-slate-950 border-[1.5px] border-slate-900 dark:border-slate-500 rounded-md text-slate-900 dark:text-white w-24 tabular-nums"
            />
          </div>
        )}

        {selectedTemplateIndex === 1 && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <label htmlFor="zprava-pokracujeme" className="font-semibold text-slate-900 dark:text-slate-100">Pokračujeme</label>
            <input
              id="zprava-pokracujeme"
              type="text"
              value={resumeDate}
              onChange={(e) => setResumeDate(e.target.value)}
              className="min-h-11 px-3 bg-white dark:bg-slate-950 border-[1.5px] border-slate-900 dark:border-slate-500 rounded-md text-slate-900 dark:text-white flex-1 min-w-0"
            />
          </div>
        )}

        {selectedTemplateIndex === 2 && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <label htmlFor="zprava-zavoz" className="font-semibold text-slate-900 dark:text-slate-100">Závoz materiálu</label>
            <input
              id="zprava-zavoz"
              type="text"
              value={deliveryDate}
              onChange={(e) => setDeliveryDate(e.target.value)}
              className="min-h-11 px-3 bg-white dark:bg-slate-950 border-[1.5px] border-slate-900 dark:border-slate-500 rounded-md text-slate-900 dark:text-white flex-1 min-w-0"
            />
          </div>
        )}

        {/* Text Preview */}
        <div>
          <div className="font-semibold text-slate-900 dark:text-slate-100 mb-1.5">Text zprávy</div>
          <div className="px-4 py-3.5 bg-white dark:bg-slate-900 rounded-md border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 leading-relaxed select-all whitespace-pre-line">
            {currentText}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-3 pt-2">
          <button
            type="button"
            onClick={handleCopy}
            className="min-h-11 flex items-center justify-center gap-2 px-3 rounded-md border-[1.5px] border-slate-900 dark:border-slate-500 text-slate-900 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold transition-colors cursor-pointer"
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            <span>{copied ? 'Zkopírováno' : 'Kopírovat pro SMS'}</span>
          </button>

          <button
            type="button"
            onClick={handleSendWhatsApp}
            className="min-h-11 flex items-center justify-center gap-2 px-3 rounded-md border-[1.5px] border-slate-900 dark:border-slate-500 text-slate-900 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold transition-colors cursor-pointer"
          >
            <Send className="w-4 h-4" />
            <span>Odeslat WhatsApp</span>
          </button>
        </div>
      </Dialog>
  );
};
