import React, { useState, useMemo, useEffect } from 'react';
import { Dialog } from './Dialog';
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
import { ensureSignShare, watchSignedShare, getSignedShare, generateSignToken, buildSigningUrl } from '../utils/signShares';

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
  /** Zavolá se, když pro smlouvu vznikne nový tajný kód odkazu k online podpisu */
  onSignTokenCreated?: (token: string) => void;
}

const smallAction =
  'min-h-11 px-3 inline-flex items-center justify-center gap-1.5 rounded-md border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-medium hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors';
const outlineAction =
  'min-h-11 px-4 inline-flex items-center justify-center gap-2 rounded-md border-[1.5px] border-slate-900 dark:border-slate-500 text-slate-900 dark:text-slate-100 font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors';
const fieldInput =
  'w-full min-h-12 px-3.5 py-2 rounded-md border-[1.5px] border-slate-900 dark:border-slate-500 bg-white dark:bg-slate-950 text-slate-900 dark:text-white';

export const ShareModal: React.FC<ShareModalProps> = ({
  isOpen,
  onClose,
  contract,
  activeDocType,
  onToast,
  onUpdateContract,
  onSignTokenCreated,
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

  // Tajný kód odkazu: uložený u smlouvy, nebo nově vygenerovaný (uloží se při prvním sdílení)
  const signToken = useMemo(() => contract.signToken || generateSignToken(), [contract.id, contract.signToken]);
  const signingUrl = useMemo(() => buildSigningUrl(signToken), [signToken]);

  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');

  useEffect(() => {
    if (selectedTemplate === 'online_sign') {
      QRCode.toDataURL(signingUrl, { width: 180, margin: 1 })
        .then(setQrCodeUrl)
        .catch(console.error);

      // Nově vygenerovaný kód si rodič uloží ke smlouvě, aby odkaz zůstal stejný i příště
      if (!contract.signToken) onSignTokenCreated?.(signToken);

      ensureSignShare(contract, signToken).catch((err) => {
        console.warn('Odkaz k podpisu se nepodařilo uložit:', err?.message || err);
        onToast?.('error', 'Odkaz k podpisu se nepodařilo připravit. Zkontrolujte připojení k internetu a zkuste to znovu.');
      });

      if (contract.clientSignature) return;

      // Průběžná kontrola, zda zákazník už podepsal
      const unsub = watchSignedShare(contract.id, (share) => {
        const updated: Contract = {
          ...contract,
          clientSignature: share.clientSignature,
          clientSignatureDate: share.signedDate,
          status: contract.status === 'draft' ? 'signed' : (contract.status || 'signed'),
        };
        onUpdateContract?.(updated);
      });
      return () => unsub();
    }
  }, [selectedTemplate, signingUrl, signToken, contract, onUpdateContract, onSignTokenCreated]);

  const handleManualCheckSign = async () => {
    setIsCheckingSign(true);
    try {
      const share = await getSignedShare(contract.id);
      if (share) {
        const updated: Contract = {
          ...contract,
          clientSignature: share.clientSignature,
          clientSignatureDate: share.signedDate,
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
    <Dialog
      title="Odeslat klientovi"
      subtitle={[clientName, rawPhone].filter(Boolean).join(', ')}
      size="xl"
      bare
      closeOnBackdrop={false}
      onClose={onClose}
    >

        <div className="p-5 space-y-4 overflow-y-auto">
          <div>
            <div className="font-semibold text-slate-900 dark:text-slate-100 mb-1.5">Co posíláte</div>
            <div role="group" aria-label="Druh zprávy" className="flex flex-wrap gap-2">
              {(
                [
                  { key: 'document', label: 'Dokument' },
                  { key: 'online_sign', label: 'Odkaz k podpisu' },
                  { key: 'start_reminder', label: 'Termín nástupu' },
                  { key: 'due_soon', label: 'Blíží se splatnost' },
                  { key: 'overdue', label: 'Upomínka' },
                  { key: 'thanks_review', label: 'Poděkování' },
                ] as const
              ).map((t) => (
                <button
                  key={t.key}
                  type="button"
                  aria-pressed={selectedTemplate === t.key}
                  onClick={() => setSelectedTemplate(t.key)}
                  className={`min-h-11 px-3 inline-flex items-center justify-center rounded-md border font-medium cursor-pointer transition-colors ${
                    selectedTemplate === t.key
                      ? 'border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-900'
                      : 'border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Odkaz k online podpisu */}
          {selectedTemplate === 'online_sign' && (
            <div className="border border-slate-300 dark:border-slate-700 rounded-md p-4 flex flex-col sm:flex-row gap-4">
              {qrCodeUrl && (
                <div className="bg-white p-2 border border-slate-900 rounded-md shrink-0 self-center sm:self-start">
                  <img src={qrCodeUrl} alt="QR kód s odkazem k podpisu" className="w-28 h-28" />
                </div>
              )}
              <div className="space-y-2.5 flex-1 min-w-0">
                <p className="text-slate-600 dark:text-slate-400">
                  Zákazník otevře odkaz na svém telefonu a podepíše se prstem. Podpis se sám propíše do dokumentu.
                </p>
                {contract.clientSignature ? (
                  <div className="inline-flex items-center gap-1.5 font-semibold px-2.5 py-1 rounded-sm bg-emerald-700 text-white">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>Zákazník už podepsal</span>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-slate-900 dark:text-slate-100">
                    <span>Čeká na podpis zákazníka.</span>
                    <button
                      type="button"
                      onClick={handleManualCheckSign}
                      disabled={isCheckingSign}
                      className="min-h-11 inline-flex items-center gap-1.5 font-medium text-blue-600 dark:text-blue-300 underline underline-offset-2 cursor-pointer"
                    >
                      <RefreshCw className={`w-4 h-4 ${isCheckingSign ? 'animate-spin' : ''}`} />
                      <span>{isCheckingSign ? 'Ověřuji…' : 'Ověřit teď'}</span>
                    </button>
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(signingUrl);
                      if (onToast) onToast('success', 'Odkaz k podpisu je zkopírovaný.');
                    }}
                    className={smallAction}
                  >
                    <Copy className="w-4 h-4" />
                    <span>Zkopírovat odkaz</span>
                  </button>
                  <a href={signingUrl} target="_blank" rel="noopener noreferrer" className={smallAction}>
                    <ExternalLink className="w-4 h-4" />
                    <span>Otevřít stránku podpisu</span>
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* Termín nástupu */}
          {selectedTemplate === 'start_reminder' && (
            <div className="grid grid-cols-2 gap-4 max-w-sm">
              <div>
                <label htmlFor="odeslat-datum" className="block font-semibold text-slate-900 dark:text-slate-100 mb-1.5">
                  Den nástupu
                </label>
                <input id="odeslat-datum" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={fieldInput} />
              </div>
              <div>
                <label htmlFor="odeslat-cas" className="block font-semibold text-slate-900 dark:text-slate-100 mb-1.5">
                  Čas
                </label>
                <input id="odeslat-cas" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className={fieldInput} />
              </div>
            </div>
          )}

          {selectedTemplate === 'overdue' && (
            <p className="text-slate-600 dark:text-slate-400">
              Upomínka uvádí částku {formatCurrency(remainingDue > 0 ? remainingDue : totalAdjustedPrice)}, variabilní symbol a číslo účtu.
            </p>
          )}

          <div>
            <div className="flex items-baseline justify-between gap-3 mb-1.5">
              <label htmlFor="odeslat-text" className="font-semibold text-slate-900 dark:text-slate-100">
                Text zprávy
              </label>
              <span className="text-[13px] text-slate-600 dark:text-slate-400 tabular-nums">{editedBody.length} znaků, lze upravit</span>
            </div>
            <textarea id="odeslat-text" rows={7} value={editedBody} onChange={(e) => setEditedBody(e.target.value)} className={`${fieldInput} leading-relaxed`} />
          </div>
        </div>

        <div className="px-5 py-4 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2.5 shrink-0">
          <button type="button" onClick={handleCopy} className={smallAction}>
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            <span>{copied ? 'Zkopírováno' : 'Zkopírovat text'}</span>
          </button>
          <div className="flex flex-wrap gap-2.5">
            <a href={mailtoUrl} onClick={onClose} className={outlineAction}>
              <Mail className="w-[18px] h-[18px] shrink-0" />
              <span>E-mail</span>
            </a>
            <a href={smsUrl} onClick={onClose} className={outlineAction}>
              <Smartphone className="w-[18px] h-[18px] shrink-0" />
              <span>SMS</span>
            </a>
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={onClose}
              className="min-h-11 px-4 inline-flex items-center justify-center gap-2 rounded-md border-[1.5px] border-slate-900 bg-amber-400 hover:bg-amber-500 text-slate-900 font-semibold cursor-pointer transition-colors"
            >
              <MessageSquare className="w-[18px] h-[18px] shrink-0" />
              <span>WhatsApp</span>
            </a>
          </div>
        </div>
      </Dialog>
  );
};
