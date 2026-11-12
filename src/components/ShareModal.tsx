import React, { useState, useMemo, useEffect } from 'react';
import QRCode from 'qrcode';
import {
  X,
  MessageSquare,
  Smartphone,
  Mail,
  Copy,
  Check,
  Calendar,
  Clock,
  AlertTriangle,
  BellRing,
  FileText,
  Send,
  Building2,
  HeartHandshake,
  PenTool,
  QrCode,
  ExternalLink,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';
import { Contract } from '../types/contract';
import { formatCurrency, formatDateCs } from '../utils/numberToWordsCs';
import { ShareDocType, sanitizePhoneForWhatsApp, buildShareMessage } from '../utils/shareUtils';
import { auth, createPublicSignShare, subscribePublicSignShare, getPublicSignShare } from '../utils/firebase';

export type MessageTemplateType =
  | 'document'           // Standard document share (smlouva / faktura / zaloha / dodatek / ppd / nabidka)
  | 'online_sign'        // 📱 Odkaz pro podpis klientem na dálku přes mobil
  | 'start_reminder'     // 📅 Připomenutí nástupu na stavbu
  | 'due_soon'           // ⏳ Upozornění na blížící se splatnost
  | 'overdue'            // 🔔 Slušná upomínka po splatnosti
  | 'thanks_review';     // 🤝 Poděkování za spolupráci a žádost o recenzi

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  contract: Contract;
  activeDocType: ShareDocType;
  onToast?: (type: 'success' | 'error' | 'info', text: string) => void;
  onUpdateContract?: (updated: Contract) => void;
}

export const ShareModal: React.FC<ShareModalProps> = ({
  isOpen,
  onClose,
  contract,
  activeDocType,
  onToast,
  onUpdateContract,
}) => {
  const [selectedTemplate, setSelectedTemplate] = useState<MessageTemplateType>('document');
  const [copied, setCopied] = useState(false);
  const [isCheckingSign, setIsCheckingSign] = useState(false);

  // Customized inputs for templates
  const defaultStartTime = '08:00';
  const [startDate, setStartDate] = useState(contract.conclusionDate || new Date().toISOString().split('T')[0]);
  const [startTime, setStartTime] = useState(defaultStartTime);

  // Financial calculations
  const totalAmendments = contract.amendments?.reduce((s, a) => s + (a.priceDifference || 0), 0) || 0;
  const totalAdjustedPrice = contract.price + totalAmendments;
  const advanceAmount = contract.advanceAmount || 0;
  const remainingDue = Math.max(0, totalAdjustedPrice - advanceAmount);

  const vs = (contract.variableSymbol || contract.invoiceNumber || '2026001').replace(/\D/g, '');
  const bankAccount = contract.contractor.bankAccount;
  const clientName = contract.client.name;
  const contractorName = contract.contractor.name;
  const contractorPhone = contract.contractor.phone;
  const invoiceNum = `FA-${contract.invoiceNumber || '2026001'}`;

  // Formatted date with weekday in Czech (např. pondělí 18. 5.)
  const formattedStartWithWeekday = useMemo(() => {
    try {
      const d = new Date(startDate);
      if (isNaN(d.getTime())) return formatDateCs(startDate);
      const days = ['neděli', 'pondělí', 'úterý', 'středu', 'čtvrtek', 'pátek', 'sobotu'];
      const weekday = days[d.getDay()];
      return `${weekday} ${d.getDate()}. ${d.getMonth() + 1}.`;
    } catch {
      return formatDateCs(startDate);
    }
  }, [startDate]);

  const signingUrl = useMemo(() => {
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('sign', contract.id);
      return url.toString();
    } catch {
      return `${window.location.origin}?sign=${contract.id}`;
    }
  }, [contract.id]);

  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');

  useEffect(() => {
    if (selectedTemplate === 'online_sign') {
      QRCode.toDataURL(signingUrl, { width: 180, margin: 1 })
        .then(setQrCodeUrl)
        .catch(console.error);

      createPublicSignShare(contract, auth.currentUser?.uid || 'anonymous').catch((err) => {
        console.warn('Upozornění při ukládání odkazu podpisu:', err?.message || err);
      });

      // Realtime posluchač pro okamžité propsání podpisu jakmile zákazník podepíše
      const unsub = subscribePublicSignShare(contract.id, (share) => {
        if (share && share.status === 'signed' && share.clientSignature) {
          const datePart = (share.clientSignedAt || new Date().toISOString()).split('T')[0];
          const updated: Contract = {
            ...contract,
            clientSignature: share.clientSignature,
            clientSignatureDate: datePart,
            status: contract.status === 'draft' ? 'signed' : (contract.status || 'signed'),
          };
          onUpdateContract?.(updated);
        }
      });
      return () => unsub();
    }
  }, [selectedTemplate, signingUrl, contract, onUpdateContract]);

  const handleManualCheckSign = async () => {
    setIsCheckingSign(true);
    try {
      const share = await getPublicSignShare(contract.id);
      if (share && share.status === 'signed' && share.clientSignature) {
        const datePart = (share.clientSignedAt || new Date().toISOString()).split('T')[0];
        const updated: Contract = {
          ...contract,
          clientSignature: share.clientSignature,
          clientSignatureDate: datePart,
          status: contract.status === 'draft' ? 'signed' : (contract.status || 'signed'),
        };
        onUpdateContract?.(updated);
        onToast?.('success', '✓ Klient smlouvu podepsal! Podpis byl zaznamenán.');
      } else {
        onToast?.('info', 'Klient zatím smlouvu nepodepsal.');
      }
    } catch (e: any) {
      onToast?.('error', 'Nepodařilo se ověřit podpis: ' + (e?.message || 'Zkuste to znovu.'));
    } finally {
      setIsCheckingSign(false);
    }
  };

  // Generate dynamic message content based on selected template
  const { subject, body } = useMemo(() => {
    if (selectedTemplate === 'document') {
      const docMsg = buildShareMessage(contract, activeDocType);
      return { subject: docMsg.subject, body: docMsg.body };
    }

    if (selectedTemplate === 'online_sign') {
      const subj = `Odkaz k online podpisu – ${contract.workDescription.substring(0, 30)} – ${contractorName}`;
      const text = `Dobrý den, ${clientName},

zasílám Vám přímý odkaz pro elektronický podpis ${contract.docKind === 'quote' ? 'cenové nabídky' : 'smlouvy o dílo'} k zakázce:
"${contract.workDescription}"

Dokument si můžete zkontrolovat a podepsat prstem přímo na displeji vašeho mobilního telefonu:
${signingUrl}

Po odeslání podpisu bude smlouva platně uzavřena a obě strany obdrží potvrzení.

Děkuji a těším se na spolupráci!
${contractorName}
Tel.: ${contractorPhone}`;
      return { subject: subj, body: text };
    }

    if (selectedTemplate === 'start_reminder') {
      const subj = `Připomenutí nástupu na realizaci – ${contract.workDescription.substring(0, 30)} – ${contractorName}`;
      const text = `Dobrý den, ${clientName},

připomínám náš dohodnutý termín nástupu na realizaci zakázky:
"${contract.workDescription}"

• Nástup: v ${formattedStartWithWeekday} v ${startTime} hod.
• Místo: ${contract.client.address}

Prosím o zajištění přístupu do prostor, případně o uvolnění pracovního prostoru a přístup k vodě a elektřině.

Pokud by nastala jakákoliv změna, dejte mi prosím co nejdříve vědět na tel. ${contractorPhone}.

Těším se na spolupráci!
S pozdravem,
${contractorName}`;
      return { subject: subj, body: text };
    }

    if (selectedTemplate === 'due_soon') {
      const subj = `Připomenutí blížící se splatnosti faktury ${invoiceNum} – ${contractorName}`;
      const amountToPay = remainingDue > 0 ? remainingDue : totalAdjustedPrice;
      const text = `Dobrý den, ${clientName},

dovoluji si jen přátelsky připomenout, že se blíží datum splatnosti faktury č. ${invoiceNum} za realizaci zakázky "${contract.workDescription}".

• Částka k úhradě: ${formatCurrency(amountToPay)}
• Číslo účtu: ${bankAccount}
• Variabilní symbol: ${vs}

Fakturu s QR kódem pro snadnou platbu v mobilním bankovnictví naleznete v předchozí zprávě.

Děkuji a přeji hezký den,
${contractorName}
Tel.: ${contractorPhone}`;
      return { subject: subj, body: text };
    }

    if (selectedTemplate === 'overdue') {
      const subj = `Upozornění na neuhrazenou fakturu ${invoiceNum} po splatnosti – ${contractorName}`;
      const amountToPay = remainingDue > 0 ? remainingDue : totalAdjustedPrice;
      const text = `Dobrý den, ${clientName},

při pravidelné kontrole bankovního účtu jsme bohužel nezaznamenali úhradu faktury č. ${invoiceNum} za provedené práce na zakázce:
"${contract.workDescription}".

• Dlužná částka: ${formatCurrency(amountToPay)}
• Číslo bankovního účtu: ${bankAccount}
• Variabilní symbol: ${vs}

Prosím o kontrolu a bezodkladné odeslání platby na výše uvedený účet. Pokud jste platbu již v posledních hodinách odeslal(a), považujte prosím tuto zprávu za bezpředmětnou.

V případě jakýchkoliv nejasností mi prosím obratem zavolejte na tel. ${contractorPhone}.

Děkuji za pochopení,
${contractorName}`;
      return { subject: subj, body: text };
    }

    // thanks_review
    const subj = `Poděkování za spolupráci – ${contract.workDescription.substring(0, 30)} – ${contractorName}`;
    const text = `Dobrý den, ${clientName},

ještě jednou Vám děkuji za skvělou spolupráci a důvěru při realizaci zakázky:
"${contract.workDescription}".

Dílo bylo úspěšně předáno se sjednanou zárukou 24 měsíců. Pokud byste v budoucnu potřeboval(a) další práce nebo konzultaci, jsem Vám plně k dispozici.

Byl(a) jste se servisem a výsledkem spokojen(a)? Budu velmi rád za Vaše doporučení známým nebo sousedům.

Přeji Vám, ať Vám výsledek dlouho a spolehlivě slouží!
S pozdravem,
${contractorName}
Tel.: ${contractorPhone}`;
    return { subject: subj, body: text };
  }, [
    selectedTemplate,
    contract,
    activeDocType,
    clientName,
    contractorName,
    contractorPhone,
    formattedStartWithWeekday,
    startTime,
    remainingDue,
    totalAdjustedPrice,
    invoiceNum,
    bankAccount,
    vs,
  ]);

  // Local editable text state so craftsman can tweak the text
  const [editedBody, setEditedBody] = useState('');

  // Keep editedBody in sync when template changes
  React.useEffect(() => {
    setEditedBody(body);
  }, [body]);

  if (!isOpen) return null;

  const rawPhone = contract.client.phone || '';
  const cleanedPhoneForWa = sanitizePhoneForWhatsApp(rawPhone);
  const encodedText = encodeURIComponent(editedBody);

  const whatsappUrl = cleanedPhoneForWa
    ? `https://wa.me/${cleanedPhoneForWa}?text=${encodedText}`
    : `https://wa.me/?text=${encodedText}`;

  // SMS link format: sms:+420123456789?body=...
  const smsPhone = rawPhone.replace(/\s+/g, '');
  const smsUrl = smsPhone
    ? `sms:${smsPhone}?body=${encodedText}`
    : `sms:?body=${encodedText}`;

  const clientEmail = contract.client.email || '';
  const mailtoUrl = `mailto:${encodeURIComponent(clientEmail)}?subject=${encodeURIComponent(
    subject
  )}&body=${encodedText}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(editedBody);
    setCopied(true);
    onToast?.('success', 'Text zprávy byl zkopírován do schránky');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in">
      <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[92vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
              <Send className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-base sm:text-lg">
                Komunikace s klientem & Odeslání
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Klient: <strong className="text-slate-800 dark:text-slate-200">{clientName}</strong>
                {rawPhone ? ` · ${rawPhone}` : ''}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content body */}
        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto">
          {/* Quick Template Switcher Tabs */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
              Vyberte šablonu zprávy:
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-6 gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl text-xs font-medium">
              <button
                type="button"
                onClick={() => setSelectedTemplate('document')}
                className={`px-2.5 py-2 rounded-lg text-center transition-all flex flex-col sm:flex-row items-center justify-center gap-1.5 cursor-pointer ${
                  selectedTemplate === 'document'
                    ? 'bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-300 shadow-xs font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <FileText className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">Dokument</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedTemplate('online_sign')}
                className={`px-2.5 py-2 rounded-lg text-center transition-all flex flex-col sm:flex-row items-center justify-center gap-1.5 cursor-pointer ${
                  selectedTemplate === 'online_sign'
                    ? 'bg-white dark:bg-slate-900 text-amber-700 dark:text-amber-300 shadow-xs font-bold ring-1 ring-amber-400/40'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <PenTool className="w-3.5 h-3.5 shrink-0 text-amber-600" />
                <span className="truncate">Online podpis</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedTemplate('start_reminder')}
                className={`px-2.5 py-2 rounded-lg text-center transition-all flex flex-col sm:flex-row items-center justify-center gap-1.5 cursor-pointer ${
                  selectedTemplate === 'start_reminder'
                    ? 'bg-white dark:bg-slate-900 text-amber-700 dark:text-amber-300 shadow-xs font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Calendar className="w-3.5 h-3.5 shrink-0 text-amber-500" />
                <span className="truncate">Nástup</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedTemplate('due_soon')}
                className={`px-2.5 py-2 rounded-lg text-center transition-all flex flex-col sm:flex-row items-center justify-center gap-1.5 cursor-pointer ${
                  selectedTemplate === 'due_soon'
                    ? 'bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-300 shadow-xs font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Clock className="w-3.5 h-3.5 shrink-0 text-blue-500" />
                <span className="truncate">Splatnost</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedTemplate('overdue')}
                className={`px-2.5 py-2 rounded-lg text-center transition-all flex flex-col sm:flex-row items-center justify-center gap-1.5 cursor-pointer ${
                  selectedTemplate === 'overdue'
                    ? 'bg-white dark:bg-slate-900 text-rose-700 dark:text-rose-300 shadow-xs font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <BellRing className="w-3.5 h-3.5 shrink-0 text-rose-500" />
                <span className="truncate">Upomínka</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedTemplate('thanks_review')}
                className={`px-2.5 py-2 rounded-lg text-center transition-all flex flex-col sm:flex-row items-center justify-center gap-1.5 cursor-pointer ${
                  selectedTemplate === 'thanks_review'
                    ? 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-300 shadow-xs font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <HeartHandshake className="w-3.5 h-3.5 shrink-0 text-emerald-500" />
                <span className="truncate">Recenze</span>
              </button>
            </div>
          </div>

          {/* Conditional extra card for Online Signing */}
          {selectedTemplate === 'online_sign' && (
            <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center gap-4 text-xs">
              {qrCodeUrl && (
                <div className="bg-white p-2 rounded-lg shadow-xs border border-slate-200 shrink-0">
                  <img src={qrCodeUrl} alt="QR kód pro podpis" className="w-24 h-24" />
                  <div className="text-[10px] text-center text-slate-500 mt-1 font-mono">
                    Naskenovat mobilem
                  </div>
                </div>
              )}
              <div className="space-y-2 flex-1 text-center sm:text-left">
                <div className="font-bold text-sm text-slate-900 dark:text-white flex items-center justify-center sm:justify-start gap-1.5">
                  <PenTool className="w-4 h-4 text-amber-500" />
                  <span>Odkaz pro online podpis zákazníkem na dálku</span>
                </div>
                <p className="text-slate-600 dark:text-slate-400">
                  Zákazník otevře odkaz na svém telefonu a podepíše smlouvu nebo předávací protokol prstem na displeji.
                </p>

                {/* Živý stav online podpisu */}
                {contract.clientSignature ? (
                  <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/60 rounded-xl border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs flex items-center gap-2 font-medium">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>✓ Smlouva je klientem podepsána! Podpis je propsán ve smlouvě.</span>
                  </div>
                ) : (
                  <div className="p-2.5 bg-amber-50 dark:bg-amber-950/40 rounded-lg border border-amber-200 dark:border-amber-900/50 text-amber-900 dark:text-amber-200 text-xs flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                      <span>Čeká se na podpis klienta (propsání proběhne automaticky)</span>
                    </div>
                    <button
                      type="button"
                      onClick={handleManualCheckSign}
                      disabled={isCheckingSign}
                      className="inline-flex items-center gap-1 font-bold underline hover:text-purple-700 cursor-pointer"
                    >
                      <RefreshCw className={`w-3 h-3 ${isCheckingSign ? 'animate-spin' : ''}`} />
                      <span>Ověřit</span>
                    </button>
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-2 pt-1 justify-center sm:justify-start">
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(signingUrl);
                      if (onToast) onToast('success', 'Odkaz pro podpis byl zkopírován!');
                    }}
                    className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>Zkopírovat odkaz</span>
                  </button>
                  <a
                    href={signingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-100 text-purple-700 dark:text-purple-300 rounded-lg font-semibold border border-purple-300 dark:border-purple-700 flex items-center gap-1.5 cursor-pointer"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Otevřít podpis</span>
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* Conditional extra controls for Start Reminder */}
          {selectedTemplate === 'start_reminder' && (
            <div className="p-3 bg-amber-50/70 dark:bg-amber-950/30 rounded-xl border border-amber-200/80 dark:border-amber-900/40 flex flex-wrap items-center gap-3 text-xs">
              <span className="font-semibold text-amber-900 dark:text-amber-200 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                Termín a čas nástupu:
              </span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-2.5 py-1 rounded-lg border border-amber-300 dark:border-amber-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-medium"
              />
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="px-2.5 py-1 rounded-lg border border-amber-300 dark:border-amber-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-medium"
              />
              <span className="text-[11px] text-amber-700 dark:text-amber-400">
                Text zprávy se automaticky upraví podle zadaného dne.
              </span>
            </div>
          )}

          {/* Conditional notice for Overdue */}
          {selectedTemplate === 'overdue' && (
            <div className="p-3 bg-rose-50/80 dark:bg-rose-950/30 rounded-xl border border-rose-200/80 dark:border-rose-900/40 flex items-center gap-2 text-xs text-rose-900 dark:text-rose-200">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>
                Profesionální a slušná upomínka s přesnou částkou ({formatCurrency(remainingDue > 0 ? remainingDue : totalAdjustedPrice)}), variabilním symbolem a číslem účtu.
              </span>
            </div>
          )}

          {/* Live Editable Text Area */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Náhled zprávy k odeslání (lze upravit):
              </label>
              <span className="text-[11px] text-slate-400">
                {editedBody.length} znaků
              </span>
            </div>
            <textarea
              rows={7}
              value={editedBody}
              onChange={(e) => setEditedBody(e.target.value)}
              className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs sm:text-sm font-sans text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 resize-y leading-relaxed"
            />
          </div>

          {/* 1-Click Action Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
            {/* WhatsApp */}
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={onClose}
              className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs sm:text-sm shadow-xs transition-colors cursor-pointer group"
            >
              <MessageSquare className="w-4 h-4 shrink-0" />
              <span>Odeslat na WhatsApp</span>
            </a>

            {/* SMS */}
            <a
              href={smsUrl}
              onClick={onClose}
              className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs sm:text-sm shadow-xs transition-colors cursor-pointer group"
            >
              <Smartphone className="w-4 h-4 shrink-0" />
              <span>Odeslat jako SMS</span>
            </a>

            {/* Email */}
            <a
              href={mailtoUrl}
              onClick={onClose}
              className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 text-white font-semibold text-xs sm:text-sm shadow-xs transition-colors cursor-pointer group"
            >
              <Mail className="w-4 h-4 shrink-0" />
              <span>Odeslat E-mailem</span>
            </a>
          </div>

          {/* Kopírovat text */}
          <div className="pt-1 flex items-center justify-between border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Zkopírováno!' : 'Zkopírovat text do schránky'}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
            >
              Zavřít
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
