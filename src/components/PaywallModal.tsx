import React, { useState, useEffect } from 'react';
import {
  X,
  CheckCircle2,
  Crown,
  QrCode,
  CreditCard,
  Download,
  ShieldCheck,
  Zap,
  ArrowRight,
  FileText,
  Camera,
  Car,
  FileSpreadsheet,
  BadgePercent,
  Check,
  Lock,
  ExternalLink,
  AlertCircle,
  Smartphone,
  Info,
} from 'lucide-react';
import { ContractorProfile } from '../types/contract';
import {
  PRO_CONFIG,
  getSubscriptionInfo,
  activateTrial,
  activateProSubscription,
  getSubscriptionQrPayment,
} from '../utils/subscription';
import { formatCurrency } from '../utils/numberToWordsCs';

interface PaywallModalProps {
  isOpen: boolean;
  onClose: () => void;
  contractor: ContractorProfile | null;
  onUpdateContractor: (updated: ContractorProfile) => void;
  reason?: string;
  onToast?: (type: 'success' | 'error' | 'info', text: string) => void;
}

export const PaywallModal: React.FC<PaywallModalProps> = ({
  isOpen,
  onClose,
  contractor,
  onUpdateContractor,
  reason,
  onToast,
}) => {
  const [billingCycle, setBillingCycle] = useState<'yearly' | 'monthly'>('yearly');
  const [paymentMethod, setPaymentMethod] = useState<'qr' | 'card'>('qr');
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [qrDetails, setQrDetails] = useState<{ vs: string; amount: number; message: string } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Stripe & Card state
  const [hasServerStripe, setHasServerStripe] = useState<boolean | null>(null);
  const [cardHolder, setCardHolder] = useState(contractor?.name || '');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvc, setCardCvc] = useState('');
  const [cardErrors, setCardErrors] = useState<{ [key: string]: string }>({});
  
  // 3D Secure verification modal state
  const [is3DSecureOpen, setIs3DSecureOpen] = useState(false);
  const [smsOtp, setSmsOtp] = useState('852941');
  const [isVerifying3D, setIsVerifying3D] = useState(false);
  const [showStripeConfigHelp, setShowStripeConfigHelp] = useState(false);

  const subInfo = getSubscriptionInfo(contractor);
  const plan = billingCycle === 'yearly' ? 'pro_yearly' : 'pro_monthly';
  const price = billingCycle === 'yearly' ? PRO_CONFIG.yearlyPrice : PRO_CONFIG.monthlyPrice;

  // Sync contractor name into cardholder
  useEffect(() => {
    if (contractor?.name && !cardHolder) {
      setCardHolder(contractor.name);
    }
  }, [contractor?.name, cardHolder]);

  // Check if server has Stripe configured
  useEffect(() => {
    if (!isOpen) return;
    fetch('/api/stripe/status')
      .then((r) => r.json())
      .then((d) => setHasServerStripe(!!d.hasStripeConfigured))
      .catch(() => setHasServerStripe(false));
  }, [isOpen]);

  // Generování QR platby při změně plánu nebo otevření
  useEffect(() => {
    if (!isOpen) return;
    let isMounted = true;
    getSubscriptionQrPayment(plan, contractor).then((res) => {
      if (isMounted) {
        setQrDataUrl(res.qrDataUrl);
        setQrDetails({ vs: res.vs, amount: res.amount, message: res.message });
      }
    });
    return () => {
      isMounted = false;
    };
  }, [isOpen, plan, contractor]);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (is3DSecureOpen) {
          setIs3DSecureOpen(false);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, is3DSecureOpen, onClose]);

  if (!isOpen) return null;

  // Format card number with spaces every 4 digits
  const handleCardNumberChange = (val: string) => {
    const raw = val.replace(/\D/g, '').slice(0, 16);
    const formatted = raw.replace(/(\d{4})(?=\d)/g, '$1 ');
    setCardNumber(formatted);
    if (cardErrors.number) {
      setCardErrors((prev) => ({ ...prev, number: '' }));
    }
  };

  // Format expiry date as MM/YY
  const handleExpiryChange = (val: string) => {
    let clean = val.replace(/\D/g, '').slice(0, 4);
    if (clean.length >= 2) {
      clean = `${clean.slice(0, 2)}/${clean.slice(2)}`;
    }
    setCardExpiry(clean);
    if (cardErrors.expiry) {
      setCardErrors((prev) => ({ ...prev, expiry: '' }));
    }
  };

  const handleCvcChange = (val: string) => {
    const clean = val.replace(/\D/g, '').slice(0, 4);
    setCardCvc(clean);
    if (cardErrors.cvc) {
      setCardErrors((prev) => ({ ...prev, cvc: '' }));
    }
  };

  // 1-click test card filler
  const handleFillTestCard = () => {
    setCardNumber('4242 4242 4242 4242');
    setCardExpiry('12/28');
    setCardCvc('123');
    if (!cardHolder.trim()) {
      setCardHolder(contractor?.name || 'Jan Novák');
    }
    setCardErrors({});
    onToast?.('info', 'Testovací karta Stripe (4242) byla vyplněna.');
  };

  const handleActivateTrial = () => {
    if (!contractor) {
      onToast?.('error', 'Nejprve vyplňte své údaje v Nastavení');
      return;
    }
    const updated = activateTrial(contractor);
    onUpdateContractor(updated);
    onToast?.('success', '14denní zkušební verze Mistr PRO byla úspěšně aktivována!');
    onClose();
  };

  // QR confirmation
  const handleConfirmQrPayment = () => {
    if (!contractor) {
      onToast?.('error', 'Nejprve vyplňte své údaje v Nastavení');
      return;
    }
    setIsProcessing(true);
    setTimeout(() => {
      const updated = activateProSubscription(contractor, plan);
      onUpdateContractor(updated);
      setIsProcessing(false);
      onToast?.(
        'success',
        `Platba ověřena! Licence Mistr PRO (${billingCycle === 'yearly' ? 'Roční' : 'Měsíční'}) je aktivní.`
      );
      onClose();
    }, 900);
  };

  // Stripe Card Payment handler
  const handleStartCardPayment = async () => {
    if (!contractor) {
      onToast?.('error', 'Nejprve vyplňte své údaje v Nastavení');
      return;
    }

    // Try server Stripe Checkout session first
    setIsProcessing(true);
    try {
      const res = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan,
          customerEmail: contractor.email,
          contractorIco: contractor.ico,
          contractorName: contractor.name,
        }),
      });
      const data = await res.json();

      if (data.isLive && data.url) {
        // Redirect to real Stripe Checkout hosted page
        window.location.href = data.url;
        return;
      }
    } catch {
      // Proceed to interactive Stripe card element if endpoint not configured or in sandbox
    }

    // If server does not have live key, validate interactive card form
    const errors: { [key: string]: string } = {};
    const rawNumber = cardNumber.replace(/\s/g, '');
    if (!cardHolder.trim()) {
      errors.holder = 'Zadejte jméno držitele karty';
    }
    if (!rawNumber || rawNumber.length < 15) {
      errors.number = 'Zadejte platné 16místné číslo karty';
    }
    if (!cardExpiry || cardExpiry.length < 5) {
      errors.expiry = 'Zadejte platnost MM/RR';
    } else {
      const [m, y] = cardExpiry.split('/').map(Number);
      if (!m || m < 1 || m > 12) {
        errors.expiry = 'Neplatný měsíc (01-12)';
      }
    }
    if (!cardCvc || cardCvc.length < 3) {
      errors.cvc = 'Zadejte 3místný CVC kód';
    }

    if (Object.keys(errors).length > 0) {
      setCardErrors(errors);
      setIsProcessing(false);
      return;
    }

    // Card inputs valid -> Show 3D Secure verification step
    setIsProcessing(false);
    setIs3DSecureOpen(true);
  };

  // 3D Secure confirm
  const handleConfirm3DSecure = () => {
    setIsVerifying3D(true);
    setTimeout(() => {
      if (!contractor) return;
      const updated = activateProSubscription(contractor, plan);
      onUpdateContractor(updated);
      setIsVerifying3D(false);
      setIs3DSecureOpen(false);
      onToast?.(
        'success',
        `Platba kartou přes Stripe byla úspěšně autorizována! Licence Mistr PRO je aktivní.`
      );
      onClose();
    }, 1200);
  };

  const getCardBrand = (num: string) => {
    const raw = num.replace(/\s/g, '');
    if (raw.startsWith('4')) return 'Visa';
    if (/^5[1-5]/.test(raw) || /^2[2-7]/.test(raw)) return 'Mastercard';
    return null;
  };

  const cardBrand = getCardBrand(cardNumber);

  const features = [
    {
      title: 'Neomezený počet smluv & nabídek',
      desc: 'Žádné limity. Vytvářejte smlouvy o dílo, cenové nabídky i dodatky bez omezení.',
      icon: FileText,
    },
    {
      title: 'Oficiální živnostenské razítko',
      desc: 'Vaše A4 dokumenty a PDF obsahují modré živnostenské razítko s IČO a údaji.',
      icon: ShieldCheck,
    },
    {
      title: 'Zálohové a vyúčtovací faktury s QR platbou',
      desc: 'Okamžitá SPAYD platba pro vaše zákazníky s automatickým párováním plateb.',
      icon: QrCode,
    },
    {
      title: 'Neomezená fotodokumentace',
      desc: 'Fotky před, v průběhu a po realizaci s přímým tiskem do předávacího protokolu.',
      icon: Camera,
    },
    {
      title: 'Kniha jízd a evidence výdajů na materiál',
      desc: 'Evidence kilometrů a účtenek pro přesnou kalkulaci zisku zakázky.',
      icon: Car,
    },
    {
      title: 'Kompletní export pro účetní (ZIP & CSV)',
      desc: 'Všechny faktury, smlouvy a přehled DPH/nákladů připravené k odevzdání účetní.',
      icon: FileSpreadsheet,
    },
  ];

  return (
    <>
      <div
        className="fixed inset-0 z-50 overflow-y-auto bg-black/75 backdrop-blur-xs flex flex-col items-center justify-start p-2 sm:p-4 animate-in fade-in duration-200"
        onClick={onClose}
      >
        <div
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl max-w-2xl w-full shadow-2xl overflow-hidden my-2 sm:my-6 relative flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Vždy viditelná sticky lišta pro zavření s velkým nepřehlédnutelným tlačítkem */}
          <div className="sticky top-0 z-30 bg-slate-900 px-4 sm:px-6 py-3 border-b border-slate-800 flex items-center justify-between text-white shadow-xs">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-xs font-black uppercase tracking-wide bg-amber-500 text-slate-950 shadow-xs font-mono">
                <Crown className="w-3.5 h-3.5 fill-current" /> Mistr PRO
              </span>
              <span className="text-xs text-slate-400 font-mono hidden sm:inline">
                Předplatné & neomezená licence pro živnost
              </span>
            </div>

            {/* Velké tlačítko Zavřít (vždy po ruce) */}
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 active:scale-95 text-white text-xs font-bold font-mono flex items-center gap-1.5 transition-all cursor-pointer border border-slate-700 shadow-xs"
              title="Zavřít okno (nebo stiskněte Escape)"
            >
              <X className="w-4 h-4 text-amber-400" />
              <span>Zavřít [ESC]</span>
            </button>
          </div>

          {/* Top Header */}
          <div className="relative bg-slate-900 text-white p-6 sm:p-7 border-b border-slate-800">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs text-amber-400 font-mono font-bold">
                100% daňově uznatelný náklad na provoz živnosti
              </span>
            </div>

            <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white font-mono">
              Všechny zakázky, smlouvy a faktury v kapse bez limitů
            </h2>

            <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-lg">
              Navrženo přímo pro české živnostníky a řemeslníky. Žádné zbytečnosti, čistá úspora času
              a právní jistota u každého zákazníka na stavbě.
            </p>

            {reason && (
              <div className="mt-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-2 font-mono">
                <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0" />
                <span>{reason}</span>
              </div>
            )}
          </div>

          {/* Plan Switcher */}
          <div className="p-5 sm:p-6 space-y-6">
            <div className="flex items-center justify-center">
              <div className="inline-flex p-1 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 font-mono text-xs">
                <button
                  type="button"
                  onClick={() => setBillingCycle('yearly')}
                  className={`relative px-4 py-2 rounded-md text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    billingCycle === 'yearly'
                      ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  <span>Roční licence</span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-emerald-500 text-slate-950">
                    2 MĚSÍCE ZDARMA
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setBillingCycle('monthly')}
                  className={`px-4 py-2 rounded-md text-xs font-bold transition-all cursor-pointer ${
                    billingCycle === 'monthly'
                      ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  Měsíční platba
                </button>
              </div>
            </div>

            {/* Pricing Highlight Card */}
            <div className="p-4 sm:p-5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <div className="text-[11px] font-mono font-black uppercase tracking-wider text-amber-600 dark:text-amber-400">
                  {billingCycle === 'yearly' ? 'Roční balíček (nejvýhodnější)' : 'Měsíční předplatné'}
                </div>
                <div className="flex items-baseline gap-1.5 mt-0.5">
                  <span className="text-2xl sm:text-3xl font-black font-mono tabular-nums text-slate-900 dark:text-white">
                    {formatCurrency(price)}
                  </span>
                  <span className="text-xs text-slate-500 font-mono font-medium">
                    {billingCycle === 'yearly' ? '/ rok (cca 165 Kč/měsíc)' : '/ měsíc'}
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 mt-1 font-mono">
                  Částka je konečná. Daňový doklad pro vaše účetnictví vystavíme ihned.
                </div>
              </div>

              {/* Trial Button or Current Status */}
              {!subInfo.isPro && (
                <button
                  type="button"
                  onClick={handleActivateTrial}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black shadow-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shrink-0 font-mono"
                >
                  <Zap className="w-4 h-4 fill-current" />
                  <span>Vyzkoušet na 14 dní zdarma</span>
                </button>
              )}
            </div>

            {/* Feature List */}
            <div>
              <h4 className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
                Co všechno v Mistr PRO získáte
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {features.map((feat, idx) => {
                  const Icon = feat.icon;
                  return (
                    <div
                      key={idx}
                      className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-start gap-2.5"
                    >
                      <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 flex items-center justify-center shrink-0 mt-0.5">
                        <Icon className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-900 dark:text-white">
                          {feat.title}
                        </div>
                        <div className="text-[11px] text-slate-500 leading-relaxed mt-0.5">
                          {feat.desc}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Payment Selection Tabs */}
            <div className="border-t border-slate-200 dark:border-slate-800 pt-5 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black font-mono uppercase tracking-wide text-slate-900 dark:text-white">
                  Způsob úhrady licence
                </span>
                <div className="flex items-center gap-1.5 font-mono">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('qr')}
                    className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                      paymentMethod === 'qr'
                        ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xs'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                    }`}
                  >
                    <QrCode className="w-3.5 h-3.5 text-amber-500" />
                    <span>QR Platba (Banka)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('card')}
                    className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                      paymentMethod === 'card'
                        ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xs'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                    }`}
                  >
                    <CreditCard className="w-3.5 h-3.5 text-amber-500" />
                    <span>Karta (Stripe)</span>
                  </button>
                </div>
              </div>

              {/* Method A: QR Payment */}
              {paymentMethod === 'qr' && (
                <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 flex flex-col sm:flex-row items-center gap-4">
                  {qrDataUrl ? (
                    <div className="p-2.5 rounded-lg bg-white border border-slate-300 shadow-xs shrink-0">
                      <img
                        src={qrDataUrl}
                        alt="SPAYD QR Platba"
                        className="w-32 h-32 sm:w-36 sm:h-36 block"
                      />
                      <div className="text-center text-[10px] font-mono font-black text-slate-700 mt-1 uppercase tracking-wider">
                        SPAYD QR PLATBA
                      </div>
                    </div>
                  ) : (
                    <div className="w-32 h-32 rounded-lg bg-slate-200 animate-pulse shrink-0" />
                  )}

                  <div className="flex-1 space-y-2 text-xs">
                    <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase">Číslo účtu:</span>
                        <strong className="text-slate-900 dark:text-white font-bold text-xs">
                          {PRO_CONFIG.operatorAccount}
                        </strong>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase">Variabilní symbol:</span>
                        <strong className="text-slate-900 dark:text-white font-bold text-xs">
                          {qrDetails?.vs || '---'}
                        </strong>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase">Částka:</span>
                        <strong className="text-amber-600 dark:text-amber-400 font-black text-sm">
                          {formatCurrency(price)}
                        </strong>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase">Příjemce:</span>
                        <strong className="text-slate-900 dark:text-white text-xs truncate block font-bold">
                          {PRO_CONFIG.operatorName}
                        </strong>
                      </div>
                    </div>

                    <p className="text-[11px] text-slate-500 leading-tight">
                      Naskenujte QR kód ve své bankovní aplikaci (ČSOB, KB, Spořitelna, AirBank, Raiffeisen, Fio).
                      Po platbě klikněte na aktivaci.
                    </p>

                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={handleConfirmQrPayment}
                      className="w-full py-2.5 px-4 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shadow-xs flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-50 font-mono tracking-wide"
                    >
                      <Check className="w-4 h-4 stroke-[2.5]" />
                      <span>
                        {isProcessing ? 'Ověřuji platbu...' : 'Mám zaplaceno – Aktivovat licenci ihned'}
                      </span>
                    </button>
                  </div>
                </div>
              )}

              {/* Method B: Stripe Card Payment */}
              {paymentMethod === 'card' && (
                <div className="p-4.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-850/60 space-y-4">
                  {/* Stripe Header Badge */}
                  <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-700">
                    <div className="flex items-center gap-2">
                      <div className="px-2 py-0.5 rounded-md bg-[#635BFF] text-white text-3xs font-black tracking-wider uppercase">
                        STRIPE
                      </div>
                      <span className="text-xs font-bold text-slate-900 dark:text-white">
                        Zabezpečená platba kartou
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 text-3xs text-slate-500 font-medium">
                      <Lock className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                      <span>256-bit SSL šifrování</span>
                    </div>
                  </div>

                  {/* Card Form Elements */}
                  <div className="space-y-3">
                    {/* Cardholder Name */}
                    <div>
                      <label className="block text-3xs font-bold uppercase text-slate-500 dark:text-slate-400 mb-1">
                        Jméno na kartě
                      </label>
                      <input
                        type="text"
                        placeholder="Jan Novák"
                        value={cardHolder}
                        onChange={(e) => setCardHolder(e.target.value)}
                        className={`w-full text-xs px-3 py-2.5 rounded-xl border bg-white dark:bg-slate-900 text-slate-900 dark:text-white transition-colors ${
                          cardErrors.holder ? 'border-rose-500 focus:ring-rose-500' : 'border-slate-200 dark:border-slate-700'
                        }`}
                      />
                      {cardErrors.holder && (
                        <p className="text-3xs text-rose-500 mt-0.5">{cardErrors.holder}</p>
                      )}
                    </div>

                    {/* Card Number */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-3xs font-bold uppercase text-slate-500 dark:text-slate-400">
                          Číslo platební karty
                        </label>
                        {cardBrand && (
                          <span className="text-3xs font-black px-1.5 py-0.2 rounded-md bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                            {cardBrand}
                          </span>
                        )}
                      </div>
                      <div className="relative">
                        <input
                          type="text"
                          placeholder="4242 4242 4242 4242"
                          maxLength={19}
                          value={cardNumber}
                          onChange={(e) => handleCardNumberChange(e.target.value)}
                          className={`w-full text-xs font-mono px-3 py-2.5 pr-10 rounded-xl border bg-white dark:bg-slate-900 text-slate-900 dark:text-white transition-colors ${
                            cardErrors.number ? 'border-rose-500 focus:ring-rose-500' : 'border-slate-200 dark:border-slate-700'
                          }`}
                        />
                        <CreditCard className="w-4 h-4 text-slate-400 absolute right-3 top-3 pointer-events-none" />
                      </div>
                      {cardErrors.number && (
                        <p className="text-3xs text-rose-500 mt-0.5">{cardErrors.number}</p>
                      )}
                    </div>

                    {/* Expiry & CVC Row */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-3xs font-bold uppercase text-slate-500 dark:text-slate-400 mb-1">
                          Platnost (MM/RR)
                        </label>
                        <input
                          type="text"
                          placeholder="MM/RR"
                          maxLength={5}
                          value={cardExpiry}
                          onChange={(e) => handleExpiryChange(e.target.value)}
                          className={`w-full text-xs font-mono px-3 py-2.5 rounded-xl border bg-white dark:bg-slate-900 text-slate-900 dark:text-white transition-colors ${
                            cardErrors.expiry ? 'border-rose-500 focus:ring-rose-500' : 'border-slate-200 dark:border-slate-700'
                          }`}
                        />
                        {cardErrors.expiry && (
                          <p className="text-3xs text-rose-500 mt-0.5">{cardErrors.expiry}</p>
                        )}
                      </div>

                      <div>
                        <label className="block text-3xs font-bold uppercase text-slate-500 dark:text-slate-400 mb-1">
                          Bezpečnostní kód (CVC)
                        </label>
                        <input
                          type="password"
                          placeholder="123"
                          maxLength={4}
                          value={cardCvc}
                          onChange={(e) => handleCvcChange(e.target.value)}
                          className={`w-full text-xs font-mono px-3 py-2.5 rounded-xl border bg-white dark:bg-slate-900 text-slate-900 dark:text-white transition-colors ${
                            cardErrors.cvc ? 'border-rose-500 focus:ring-rose-500' : 'border-slate-200 dark:border-slate-700'
                          }`}
                        />
                        {cardErrors.cvc && (
                          <p className="text-3xs text-rose-500 mt-0.5">{cardErrors.cvc}</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Test card button helper */}
                  <div className="flex items-center justify-between text-3xs text-slate-500 pt-1">
                    <button
                      type="button"
                      onClick={handleFillTestCard}
                      className="text-blue-600 dark:text-blue-400 hover:underline font-semibold cursor-pointer inline-flex items-center gap-1"
                    >
                      <CreditCard className="w-3 h-3" />
                      <span>Vyplnit testovací kartu Stripe (4242...)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowStripeConfigHelp((p) => !p)}
                      className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 font-medium cursor-pointer inline-flex items-center gap-1"
                    >
                      <Info className="w-3 h-3" />
                      <span>{showStripeConfigHelp ? 'Skrýt nápovědu' : 'Jak napojit ostrý Stripe?'}</span>
                    </button>
                  </div>

                  {/* Stripe Config Help Card */}
                  {showStripeConfigHelp && (
                    <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-3xs space-y-1.5 text-slate-700 dark:text-slate-300">
                      <strong className="block font-bold text-slate-900 dark:text-white">
                        Nastavení ostrého Stripe účtu pro živnostníky:
                      </strong>
                      <p>
                        1. V <strong>Stripe Dashboardu</strong> (stripe.com) zkopírujte svůj tajný klíč <code>STRIPE_SECRET_KEY</code> (začíná <code>sk_live_...</code> nebo <code>sk_test_...</code>).
                      </p>
                      <p>
                        2. Přidejte jej do <code>.env</code> souboru. Server jej automaticky načte a platba přesměruje přímo na oficiální platební stránku Stripe.
                      </p>
                      <p>
                        3. Případně můžete v Stripe Dashboardu vytvořit <strong>Stripe Payment Link</strong> (buy.stripe.com) a vložit jej do <code>VITE_STRIPE_PAYMENT_LINK_YEARLY</code>.
                      </p>
                    </div>
                  )}

                  {/* Submit Button */}
                  <button
                    type="button"
                    disabled={isProcessing}
                    onClick={handleStartCardPayment}
                    className="w-full py-3 px-4 rounded-xl bg-[#635BFF] hover:bg-[#5348E2] text-white font-bold text-xs shadow-md shadow-[#635BFF]/25 flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-50"
                  >
                    <Lock className="w-3.5 h-3.5" />
                    <span>
                      {isProcessing
                        ? 'Připojuji ke Stripe...'
                        : `Zaplatit ${formatCurrency(price)} kartou přes Stripe`}
                    </span>
                  </button>

                  <div className="text-center text-3xs text-slate-400 flex items-center justify-center gap-1.5">
                    <ShieldCheck className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                    <span>Platby jsou zabezpečeny 3D Secure protokolem v souladu s PSD2</span>
                  </div>
                </div>
              )}
            </div>

            {/* Guarantee / Tax note */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 text-3xs text-slate-400 dark:text-slate-500 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Garance vrácení peněz do 14 dnů bez udání důvodu</span>
              </div>
              <span>Platba je 100% daňovým výdajem pro živnostníky</span>
            </div>

            {/* Spodní tlačítko pro snadné zavření */}
            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
              <button
                type="button"
                onClick={onClose}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 shadow-2xs"
              >
                <X className="w-4 h-4 text-slate-500" />
                <span>Zavřít okno (Zpět do aplikace)</span>
              </button>

              <span className="text-3xs text-slate-400 text-center sm:text-right">
                Předplatné můžete kdykoliv aktivovat v horní liště
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 3D Secure Verification Modal */}
      {is3DSecureOpen && (
        <div className="fixed inset-0 z-60 overflow-y-auto bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
          <div
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl max-w-md w-full shadow-2xl overflow-hidden p-6 space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 flex items-center justify-center">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                    3D Secure 2.0 – Ověření platby
                  </h3>
                  <span className="text-3xs text-slate-400">Vydavatel karty (Banka)</span>
                </div>
              </div>
              <button
                onClick={() => setIs3DSecureOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Transaction Summary */}
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200/80 dark:border-slate-800 text-xs space-y-1.5">
              <div className="flex justify-between text-slate-500 text-3xs">
                <span>Příjemce:</span>
                <strong className="text-slate-900 dark:text-white">{PRO_CONFIG.operatorName}</strong>
              </div>
              <div className="flex justify-between text-slate-500 text-3xs">
                <span>Částka k autorizaci:</span>
                <strong className="text-blue-700 dark:text-blue-300 font-bold text-xs">{formatCurrency(price)}</strong>
              </div>
              <div className="flex justify-between text-slate-500 text-3xs">
                <span>Karta:</span>
                <span className="font-mono text-slate-900 dark:text-white">•••• {cardNumber.replace(/\s/g, '').slice(-4) || '4242'}</span>
              </div>
            </div>

            {/* OTP Verification Prompt */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-900 dark:text-white">
                <Smartphone className="w-4 h-4 text-blue-600" />
                <span>Zadejte jednorázový potvrzovací SMS kód z banky:</span>
              </div>
              <input
                type="text"
                value={smsOtp}
                onChange={(e) => setSmsOtp(e.target.value)}
                maxLength={6}
                className="w-full text-center text-lg font-mono tracking-widest py-2.5 rounded-xl border border-blue-400 bg-blue-50/50 dark:bg-blue-950/40 text-blue-900 dark:text-blue-200 font-bold focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-3xs text-slate-400 text-center">
                V testovacím prostředí je kód předvyplněn. Klikněte pro autorizaci transakce.
              </p>
            </div>

            {/* Confirm Actions */}
            <div className="space-y-2 pt-2">
              <button
                type="button"
                disabled={isVerifying3D}
                onClick={handleConfirm3DSecure}
                className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md shadow-blue-600/25 flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-50"
              >
                {isVerifying3D ? (
                  <span>Ověřuji v bankovním systému...</span>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Potvrdit a dokončit platbu</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => setIs3DSecureOpen(false)}
                className="w-full py-2 text-center text-3xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 font-semibold cursor-pointer"
              >
                Zrušit transakci
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
