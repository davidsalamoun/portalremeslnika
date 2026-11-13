import React, { useState, useEffect, useRef } from 'react';
import {
  Building2,
  Save,
  CheckCircle2,
  Info,
  HelpCircle,
  Search,
  Loader2,
  PenTool,
  Download,
  Upload,
  Database,
  Trash2,
  RefreshCw,
  X,
  FileCheck,
  Tag,
  Plus,
  RotateCcw,
  Crown,
  Receipt,
  Zap,
  ShieldCheck,
  QrCode,
  Phone,
  Mail,
  MapPin,
} from 'lucide-react';
import { ContractorProfile, AppBackupData, PriceListTemplateItem } from '../types/contract';
import { fetchCompanyByIco, isAresVerified } from '../utils/ares';
import {
  cleanPlaceName,
  formatPlaceWithPreposition,
  formatContractConclusionLine,
  formatCurrency,
} from '../utils/numberToWordsCs';
import { SignatureModal } from './SignatureModal';
import { CraftsmanStamp } from './CraftsmanStamp';
import { exportAppBackup, parseBackupFile } from '../utils/backup';
import {
  getStoredPriceList,
  saveStoredPriceList,
  DEFAULT_PRICE_LIST_ITEMS,
} from '../utils/storage';
import { getSubscriptionInfo } from '../utils/subscription';

interface SettingsPageProps {
  initialProfile: ContractorProfile | null;
  onSave: (profile: ContractorProfile) => void;
  onPreloadSample?: () => void;
  onRestoreBackup?: (backup: AppBackupData, mode: 'replace' | 'merge') => void;
  onToast?: (type: 'success' | 'error' | 'info', text: string) => void;
  onOpenPaywall?: () => void;
  onOpenInvoiceModal?: () => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({
  initialProfile,
  onSave,
  onPreloadSample,
  onRestoreBackup,
  onToast,
  onOpenPaywall,
  onOpenInvoiceModal,
}) => {
  const [name, setName] = useState('');
  const [ico, setIco] = useState('');
  const [dic, setDic] = useState('');
  const [address, setAddress] = useState('');
  const [bankAccount, setBankAccount] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [defaultPlace, setDefaultPlace] = useState('');
  const [signature, setSignature] = useState<string>('');
  // Otisk údajů naposledy načtených z ARES (štítek „ověřeno“ platí, jen dokud se údaje shodují)
  const [aresVerified, setAresVerified] = useState<ContractorProfile['aresVerified']>(undefined);
  const [isAresLoading, setIsAresLoading] = useState(false);
  const [aresMessage, setAresMessage] = useState<string | null>(null);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const lastAutoIco = useRef('');

  // Modal pro podpis
  const [isSignatureModalOpen, setIsSignatureModalOpen] = useState(false);

  // Backup file input a potvrzovací dialog
  const backupInputRef = useRef<HTMLInputElement>(null);
  const [pendingBackup, setPendingBackup] = useState<{
    data: AppBackupData;
    fileName: string;
  } | null>(null);

  useEffect(() => {
    if (initialProfile) {
      setName(initialProfile.name || '');
      setIco(initialProfile.ico || '');
      setDic(initialProfile.dic || '');
      setAddress(initialProfile.address || '');
      setBankAccount(initialProfile.bankAccount || '');
      setPhone(initialProfile.phone || '');
      setEmail(initialProfile.email || '');
      setDefaultPlace(cleanPlaceName(initialProfile.defaultPlace || ''));
      setSignature(initialProfile.signature || '');
      setAresVerified(initialProfile.aresVerified);
    }
  }, [initialProfile]);

  const handleAresLookup = async (targetIco?: string) => {
    const icoToQuery = (typeof targetIco === 'string' ? targetIco : ico).trim();
    if (!icoToQuery || icoToQuery.length !== 8) {
      setErrors((prev) => ({ ...prev, ico: 'Zadejte platné 8místné IČO.' }));
      return;
    }

    try {
      setIsAresLoading(true);
      setAresMessage(null);
      const data = await fetchCompanyByIco(icoToQuery);
      if (data.name) setName(data.name);
      if (data.address) setAddress(data.address);
      if (data.dic) setDic(data.dic);
      if (data.name && data.address) {
        setIco(data.ico);
        setAresVerified({
          ico: data.ico,
          name: data.name.trim(),
          address: data.address.trim(),
          verifiedAt: new Date().toISOString(),
        });
      }
      if (data.city && !defaultPlace) {
        const cityLocative =
          data.city === 'Praha'
            ? 'Praze'
            : data.city === 'Brno'
            ? 'Brně'
            : data.city === 'Ostrava'
            ? 'Ostravě'
            : cleanPlaceName(data.city);
        setDefaultPlace(cityLocative);
      }
      setAresMessage(`Údaje načteny z ARES: ${data.name}`);
      onToast?.('info', `Údaje firmy načteny z registru ARES`);
      setErrors((prev) => {
        const next = { ...prev };
        delete next.ico;
        delete next.name;
        delete next.address;
        return next;
      });
    } catch (err: any) {
      setAresMessage(err.message || 'Nepodařilo se načíst z ARES');
    } finally {
      setIsAresLoading(false);
    }
  };

  const validate = (): boolean => {
    const newErrors: { [key: string]: string } = {};

    if (!name.trim()) {
      newErrors.name = 'Zadejte své jméno nebo obchodní název.';
    }

    if (!ico.trim()) {
      newErrors.ico = 'Zadejte IČO.';
    } else if (!/^\d{8}$/.test(ico.trim())) {
      newErrors.ico = 'IČO musí mít přesně 8 číslic.';
    }

    if (dic.trim() && !/^(CZ)?\d{8,10}$/i.test(dic.trim())) {
      newErrors.dic = 'DIČ má obvykle formát CZ následovaný 8-10 číslicemi.';
    }

    if (!address.trim()) {
      newErrors.address = 'Zadejte sídlo nebo místo podnikání.';
    }

    if (!bankAccount.trim()) {
      newErrors.bankAccount = 'Zadejte číslo bankovního účtu.';
    } else if (!/^(\d{1,6}-)?\d{2,10}\/\d{4}$/.test(bankAccount.trim())) {
      newErrors.bankAccount = 'Zadejte platný formát účtu (např. 123456789/0100 nebo 19-2345670237/0100).';
    }

    if (!phone.trim()) {
      newErrors.phone = 'Zadejte kontaktní telefon.';
    }

    if (!email.trim()) {
      newErrors.email = 'Zadejte kontaktní e-mail.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      newErrors.email = 'Zadejte platný e-mail.';
    }

    if (!cleanPlaceName(defaultPlace)) {
      newErrors.defaultPlace = 'Zadejte město uzavření smlouvy (např. Praze, Brně, Ostravě – předložka V/Ve se doplní sama).';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const cleanedPlace = cleanPlaceName(defaultPlace);

    const profile: ContractorProfile = {
      name: name.trim(),
      ico: ico.trim(),
      dic: dic.trim() || undefined,
      address: address.trim(),
      bankAccount: bankAccount.trim(),
      phone: phone.trim(),
      email: email.trim(),
      defaultPlace: cleanedPlace,
      signature: signature || undefined,
      aresVerified: isAresVerified({ ico, name, address, aresVerified }) ? aresVerified : undefined,
      subscriptionPlan: initialProfile?.subscriptionPlan,
      subscriptionExpiresAt: initialProfile?.subscriptionExpiresAt,
      trialStartedAt: initialProfile?.trialStartedAt,
      subscriptionInvoiceNumber: initialProfile?.subscriptionInvoiceNumber,
    };

    onSave(profile);
  };

  // Obsluha nahrání zálohy
  const handleBackupFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = parseBackupFile(text);
        setPendingBackup({ data: parsed, fileName: file.name });
      } catch (err: any) {
        onToast?.('error', err.message || 'Neplatný soubor zálohy');
      } finally {
        if (e.target) e.target.value = '';
      }
    };
    reader.readAsText(file);
  };

  const handleApplyPendingBackup = (mode: 'replace' | 'merge') => {
    if (!pendingBackup) return;
    onRestoreBackup?.(pendingBackup.data, mode);
    onToast?.(
      'success',
      mode === 'replace'
        ? 'Data byla kompletně obnovena ze záložního souboru'
        : 'Záloha byla úspěšně sloučena se stávajícími daty'
    );
    setPendingBackup(null);
  };

  const subInfo = getSubscriptionInfo(initialProfile);

  return (
    <div className="max-w-[900px] mx-auto pb-16 space-y-8">
      {/* Předplatné a licence Mistr PRO */}
      <div className="bg-white dark:bg-slate-900 rounded-xl p-6 shadow-xs border border-slate-200/90 dark:border-slate-800 transition-colors">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-400 flex items-center justify-center shrink-0">
              <Crown className="w-5 h-5 fill-current" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Předplatné a licence aplikace
                </h2>
                <span className={`text-3xs font-extrabold px-2 py-0.5 rounded-md uppercase tracking-wider border ${subInfo.badgeClass}`}>
                  {subInfo.label}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {subInfo.isPro
                  ? subInfo.expiresAtFormatted
                    ? `Licence aktivní do ${subInfo.expiresAtFormatted} (${subInfo.daysLeft ?? 0} dní zbývá) • 100% daňově uznatelný náklad`
                    : 'Neomezená plná verze Mistr PRO'
                  : 'V tarifu Zdarma máte k dispozici až 3 zakázky. Přejděte na PRO pro neomezené smlouvy a razítko.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
            {subInfo.isPro && onOpenInvoiceModal && (
              <button
                type="button"
                onClick={onOpenInvoiceModal}
                className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-2xs"
              >
                <Receipt className="w-3.5 h-3.5" />
                <span>Daňový doklad</span>
              </button>
            )}

            {onOpenPaywall && (
              <button
                type="button"
                onClick={onOpenPaywall}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-2xs transition-all ${
                  subInfo.isPro
                    ? 'bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 hover:bg-blue-100'
                    : 'bg-amber-500 hover:bg-amber-600 text-slate-950 font-black shadow-amber-500/20'
                }`}
              >
                <Crown className="w-3.5 h-3.5 fill-current" />
                <span>{subInfo.isPro ? 'Spravovat licenci' : 'Přejít na Mistr PRO'}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Hlavní profil zhotovitele a živnostenský workbench */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Formulářová část (8 sloupců) */}
        <div className="lg:col-span-8 bg-white dark:bg-slate-900 rounded-xl p-5 sm:p-7 shadow-xs border border-slate-200 dark:border-slate-800 transition-colors">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-slate-900 text-amber-400 flex items-center justify-center font-bold">
                  <Building2 className="w-5 h-5" />
                </div>
                <span>Profil mistra & zhotovitele</span>
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
                Oficiální identifikační údaje pro smlouvy o dílo (§ 2586 NOZ), předávací protokoly a daňové doklady.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 self-start sm:self-center shrink-0">
              {onPreloadSample && !initialProfile && (
                <button
                  type="button"
                  onClick={onPreloadSample}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold border border-slate-300 dark:border-slate-700 transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                  <span className="hidden sm:inline">Vzorové údaje</span>
                </button>
              )}

              <button
                type="button"
                onClick={(e) => handleSubmit(e as any)}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs sm:text-sm font-black shadow-xs transition-all cursor-pointer active:scale-95"
                title="Uložit změny v profilu zhotovitele"
              >
                <Save className="w-4 h-4" />
                <span>Uložit údaje</span>
              </button>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="pt-6 space-y-6">
          {/* IČO + ARES načtení */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="settings-ico" className="block text-sm font-bold text-slate-800 dark:text-slate-200">
                IČO <span className="text-rose-500">*</span>
              </label>
              <span className="text-xs text-slate-400 dark:text-slate-500">8 číslic</span>
            </div>
            <div className="flex gap-2">
              <input
                id="settings-ico"
                type="text"
                inputMode="numeric"
                maxLength={8}
                value={ico}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '').slice(0, 8);
                  setIco(val);
                  if (val.length === 8 && val !== lastAutoIco.current) {
                    lastAutoIco.current = val;
                    handleAresLookup(val);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (ico.length === 8) {
                      handleAresLookup(ico);
                    }
                  }
                }}
                placeholder="např. 12345678"
                className={`w-full px-3.5 py-2.5 rounded-xl border text-sm font-mono tracking-wider bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-all focus:outline-hidden focus:ring-2 ${
                  errors.ico
                    ? 'border-rose-300 ring-rose-200 bg-rose-50/20'
                    : 'border-slate-300 dark:border-slate-700 focus:border-[#1E3A78] dark:focus:border-blue-500 focus:ring-blue-100 dark:focus:ring-blue-950'
                }`}
              />
              <button
                type="button"
                onClick={() => handleAresLookup()}
                disabled={isAresLoading || ico.length !== 8}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold border border-slate-200 dark:border-slate-700 transition-colors shrink-0 disabled:opacity-50 cursor-pointer"
                title="Automaticky načte název a sídlo firmy ze státního registru ARES (nebo stiskněte Enter)"
              >
                {isAresLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin text-[#1E3A78] dark:text-blue-400" />
                ) : (
                  <Search className="w-4 h-4 text-[#1E3A78] dark:text-blue-400" />
                )}
                <span>{isAresLoading ? 'Hledám…' : 'Načíst z ARES'}</span>
              </button>
            </div>
            {errors.ico && <p className="text-xs text-rose-600 mt-1">{errors.ico}</p>}
            {aresMessage && (
              <p className="text-xs text-blue-600 dark:text-blue-400 mt-1 font-medium">{aresMessage}</p>
            )}
          </div>

          {/* Jméno / Obchodní firma */}
          <div>
            <label htmlFor="settings-name" className="block text-sm font-bold text-slate-800 dark:text-slate-200 mb-1.5">
              Jméno a příjmení / Název firmy <span className="text-rose-500">*</span>
            </label>
            <input
              id="settings-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="např. Jan Novák – Řemeslné a obkladačské práce"
              className={`w-full px-3.5 py-2.5 rounded-xl border text-sm bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-all focus:outline-hidden focus:ring-2 ${
                errors.name
                  ? 'border-rose-300 ring-rose-200 bg-rose-50/20'
                  : 'border-slate-300 dark:border-slate-700 focus:border-[#1E3A78] dark:focus:border-blue-500 focus:ring-blue-100 dark:focus:ring-blue-950'
              }`}
            />
            {errors.name && <p className="text-xs text-rose-600 mt-1">{errors.name}</p>}
          </div>

          {/* DIČ */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="settings-dic" className="block text-sm font-bold text-slate-800 dark:text-slate-200">
                DIČ <span className="text-xs font-normal text-slate-500">(nepovinné – pouze pokud jste plátce DPH)</span>
              </label>
              <span className="text-xs text-slate-400 dark:text-slate-500">např. CZ12345678</span>
            </div>
            <input
              id="settings-dic"
              type="text"
              value={dic}
              onChange={(e) => setDic(e.target.value.toUpperCase())}
              placeholder="např. CZ8503120000"
              className={`w-full px-3.5 py-2.5 rounded-xl border text-sm uppercase bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-all focus:outline-hidden focus:ring-2 ${
                errors.dic
                  ? 'border-rose-300 ring-rose-200 bg-rose-50/20'
                  : 'border-slate-300 dark:border-slate-700 focus:border-[#1E3A78] dark:focus:border-blue-500 focus:ring-blue-100 dark:focus:ring-blue-950'
              }`}
            />
            {errors.dic && <p className="text-xs text-rose-600 mt-1">{errors.dic}</p>}
          </div>

          {/* Sídlo / Místo podnikání */}
          <div>
            <label htmlFor="settings-address" className="block text-sm font-bold text-slate-800 dark:text-slate-200 mb-1.5">
              Sídlo / Místo podnikání <span className="text-rose-500">*</span>
            </label>
            <input
              id="settings-address"
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="např. Květinová 124/8, 140 00 Praha 4"
              className={`w-full px-3.5 py-2.5 rounded-xl border text-sm bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-all focus:outline-hidden focus:ring-2 ${
                errors.address
                  ? 'border-rose-300 ring-rose-200 bg-rose-50/20'
                  : 'border-slate-300 dark:border-slate-700 focus:border-[#1E3A78] dark:focus:border-blue-500 focus:ring-blue-100 dark:focus:ring-blue-950'
              }`}
            />
            {errors.address && <p className="text-xs text-rose-600 mt-1">{errors.address}</p>}
          </div>

          {/* Bankovní účet */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="settings-bank" className="block text-sm font-bold text-slate-800 dark:text-slate-200">
                Bankovní účet <span className="text-rose-500">*</span>
              </label>
              <span className="text-xs text-slate-400 dark:text-slate-500">Včetně kódu banky</span>
            </div>
            <input
              id="settings-bank"
              type="text"
              value={bankAccount}
              onChange={(e) => setBankAccount(e.target.value)}
              placeholder="např. 19-2345670237/0100"
              className={`w-full px-3.5 py-2.5 rounded-xl border text-sm font-mono bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-all focus:outline-hidden focus:ring-2 ${
                errors.bankAccount
                  ? 'border-rose-300 ring-rose-200 bg-rose-50/20'
                  : 'border-slate-300 dark:border-slate-700 focus:border-[#1E3A78] dark:focus:border-blue-500 focus:ring-blue-100 dark:focus:ring-blue-950'
              }`}
            />
            {errors.bankAccount && <p className="text-xs text-rose-600 mt-1">{errors.bankAccount}</p>}
          </div>

          {/* Telefon a E-mail */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label htmlFor="settings-phone" className="block text-sm font-bold text-slate-800 dark:text-slate-200 mb-1.5">
                Telefon <span className="text-rose-500">*</span>
              </label>
              <input
                id="settings-phone"
                type="tel"
                inputMode="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="např. +420 777 123 456"
                className={`w-full px-3.5 py-2.5 rounded-xl border text-sm bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-all focus:outline-hidden focus:ring-2 ${
                  errors.phone
                    ? 'border-rose-300 ring-rose-200 bg-rose-50/20'
                    : 'border-slate-300 dark:border-slate-700 focus:border-[#1E3A78] dark:focus:border-blue-500 focus:ring-blue-100 dark:focus:ring-blue-950'
                }`}
              />
              {errors.phone && <p className="text-xs text-rose-600 mt-1">{errors.phone}</p>}
            </div>

            <div>
              <label htmlFor="settings-email" className="block text-sm font-bold text-slate-800 dark:text-slate-200 mb-1.5">
                E-mail <span className="text-rose-500">*</span>
              </label>
              <input
                id="settings-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="např. novak.remesla@email.cz"
                className={`w-full px-3.5 py-2.5 rounded-xl border text-sm bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-all focus:outline-hidden focus:ring-2 ${
                  errors.email
                    ? 'border-rose-300 ring-rose-200 bg-rose-50/20'
                    : 'border-slate-300 dark:border-slate-700 focus:border-[#1E3A78] dark:focus:border-blue-500 focus:ring-blue-100 dark:focus:ring-blue-950'
                }`}
              />
              {errors.email && <p className="text-xs text-rose-600 mt-1">{errors.email}</p>}
            </div>
          </div>

          {/* Místo uzavření smlouvy */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="settings-place" className="block text-sm font-bold text-slate-800 dark:text-slate-200">
                Obvyklé místo uzavření smluv <span className="text-rose-500">*</span>
              </label>
              <span className="text-xs text-slate-400 dark:text-slate-500">Město v 6. pádě</span>
            </div>

            <div className="flex items-stretch rounded-xl border border-slate-300 dark:border-slate-700 overflow-hidden focus-within:border-[#1E3A78] dark:focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100 dark:focus-within:ring-blue-950 transition-all">
              <span className="inline-flex items-center px-3.5 bg-slate-100 dark:bg-slate-800 border-r border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 select-none">
                V / Ve
              </span>
              <input
                id="settings-place"
                type="text"
                value={defaultPlace}
                onChange={(e) => {
                  const val = e.target.value;
                  const cleaned = cleanPlaceName(val);
                  setDefaultPlace(cleaned || val);
                }}
                onBlur={() => {
                  setDefaultPlace(cleanPlaceName(defaultPlace));
                }}
                placeholder="Praze, Brně, Ostravě… (pouze město v 6. pádě)"
                className="flex-1 px-3.5 py-2.5 text-sm bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-hidden"
              />
            </div>

            {/* Rychlá tlačítka pro nejčastější města */}
            <div className="flex flex-wrap items-center gap-1.5 mt-2">
              <span className="text-[11px] text-slate-500 dark:text-slate-400 mr-1">Rychlý výběr:</span>
              {[
                { label: 'Praze', value: 'Praze' },
                { label: 'Brně', value: 'Brně' },
                { label: 'Ostravě', value: 'Ostravě' },
                { label: 'Plzni', value: 'Plzni' },
                { label: 'Liberci', value: 'Liberci' },
                { label: 'Olomouci', value: 'Olomouci' },
                { label: 'místě plnění', value: 'místě plnění' },
              ].map((city) => (
                <button
                  key={city.value}
                  type="button"
                  onClick={() => setDefaultPlace(city.value)}
                  className={`px-2 py-0.5 rounded-md text-[11px] font-medium transition-colors cursor-pointer border ${
                    defaultPlace === city.value
                      ? 'bg-blue-100 dark:bg-blue-950/80 text-[#1E3A78] dark:text-blue-300 border-blue-300 dark:border-blue-800 font-semibold'
                      : 'bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                  }`}
                >
                  {city.label}
                </button>
              ))}
            </div>

            {/* Náhled bez zdvojení V */}
            <div className="mt-2.5 p-2.5 rounded-lg bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-900/60 flex items-start gap-2 text-xs text-emerald-900 dark:text-emerald-200">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <span>Jak bude vypadat podpisový řádek ve smlouvě: </span>
                <strong className="font-semibold underline decoration-emerald-400 decoration-2">
                  {formatContractConclusionLine(defaultPlace || 'Praze', new Date().toISOString().split('T')[0])}
                </strong>
              </div>
            </div>

            {errors.defaultPlace && (
              <p className="text-xs text-rose-600 mt-1">{errors.defaultPlace}</p>
            )}
          </div>

          {/* ✍️ Digitální podpis zhotovitele */}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <div>
                <label className="block text-sm font-bold text-slate-800 dark:text-slate-200">
                  Výchozí digitální podpis zhotovitele
                </label>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Pokud si podpis uložíte, automaticky se předvyplní do všech nových smluv a předávacích protokolů.
                </p>
              </div>

              {signature && (
                <button
                  type="button"
                  onClick={() => setSignature('')}
                  className="inline-flex items-center gap-1 text-xs text-rose-600 hover:underline cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Smazat podpis</span>
                </button>
              )}
            </div>

            {signature ? (
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-4">
                  <div className="h-16 w-44 bg-white border border-slate-300 rounded-lg p-1 flex items-center justify-center">
                    <img src={signature} alt="Uložený podpis" className="max-h-14 max-w-full object-contain" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Podpis je uložen a aktivní</span>
                    </span>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Bude použit při generování smluv
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsSignatureModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer self-start sm:self-auto"
                >
                  <PenTool className="w-3.5 h-3.5" />
                  <span>Překreslit podpis</span>
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setIsSignatureModalOpen(true)}
                className="w-full py-4 border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-blue-400 dark:hover:border-blue-500 rounded-xl flex items-center justify-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300 hover:text-[#1E3A78] dark:hover:text-blue-400 hover:bg-blue-50/30 transition-all cursor-pointer"
              >
                <PenTool className="w-4 h-4 text-[#1E3A78] dark:text-blue-400" />
                <span>+ Nakreslit a uložit můj podpis prstem nebo myší</span>
              </button>
            )}
          </div>

          {/* Tlačítko Uložit */}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              type="submit"
              className="inline-flex items-center gap-2 px-8 py-3 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 text-sm font-black shadow-xs transition-colors cursor-pointer active:scale-95"
            >
              <Save className="w-4 h-4" />
              <span>Uložit profil zhotovitele</span>
            </button>
          </div>
        </form>
      </div>

      {/* Pravý sloupec (4 sloupce): Živá úřední licence a razítko */}
      <div className="hidden lg:block lg:col-span-4 sticky top-20 space-y-4">
        <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-amber-500" />
              <span className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
                Otisk razítka & certifikát
              </span>
            </div>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
              § 2586 NOZ
            </span>
          </div>

          {/* Vizuální otisk razítka */}
          <div className="p-6 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-center min-h-[170px]">
            {name && ico ? (
              <CraftsmanStamp
                contractor={{
                  name: name,
                  ico: ico,
                  dic: dic || undefined,
                  address: address || 'Sídlo zhotovitele',
                  defaultPlace: defaultPlace || 'místě plnění',
                  signature: signature,
                  bankAccount: bankAccount,
                  phone: phone,
                  email: email,
                }}
                size="lg"
              />
            ) : (
              <div className="text-center text-slate-400 text-xs py-4">
                <Building2 className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <span>Vyplňte jméno a IČO pro vygenerování úředního razítka</span>
              </div>
            )}
          </div>

          {/* ARES certifikační štítek – jen pokud údaje opravdu odpovídají načtení z ARES */}
          {isAresVerified({ ico, name, address, aresVerified }) ? (
            <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 flex items-start gap-2.5 text-xs text-emerald-900 dark:text-emerald-200">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-extrabold block">Ověřený subjekt v ARES</span>
                <span className="text-[11px] text-emerald-700 dark:text-emerald-300">
                  Jméno, IČO a sídlo odpovídají údajům načteným z registru ARES
                  {aresVerified?.verifiedAt ? ` dne ${new Date(aresVerified.verifiedAt).toLocaleDateString('cs-CZ')}` : ''}.
                </span>
              </div>
            </div>
          ) : (
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 flex items-start gap-2.5 text-xs text-slate-700 dark:text-slate-300">
              <Building2 className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-extrabold block">Údaje nejsou ověřené v ARES</span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  Zadejte IČO a klikněte na „Načíst z ARES“. Po ruční úpravě jména, IČO nebo sídla ověření přestává platit.
                </span>
              </div>
            </div>
          )}

          {/* Bankovní účet QR ověření */}
          <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500 font-medium flex items-center gap-1.5">
                <QrCode className="w-3.5 h-3.5 text-slate-400" />
                <span>QR Platba na fakturách:</span>
              </span>
              <span className={`font-mono text-[11px] font-bold ${bankAccount ? 'text-emerald-600' : 'text-amber-600'}`}>
                {bankAccount ? 'Aktivní' : 'Nezadáno'}
              </span>
            </div>
            {bankAccount ? (
              <p className="text-xs font-mono font-bold text-slate-900 dark:text-white truncate">
                {bankAccount}
              </p>
            ) : (
              <p className="text-[11px] text-slate-400">
                Doplňte číslo účtu výše, aby klienti mohli platit mobilem z QR kódu.
              </p>
            )}
          </div>

          {/* Tlačítko pro rychlé uložení */}
          <button
            type="button"
            onClick={(e) => handleSubmit(e as any)}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs shadow-xs transition-all cursor-pointer active:scale-95"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Uložit změny do profilu</span>
          </button>
        </div>
      </div>
    </div>

      {/* 🏷️ Sekce Můj ceník prací a materiálu */}
      <PriceListSettingsSection onToast={onToast} />

      {/* 💾 Sekce Záloha a obnova databáze */}
      <div className="bg-white dark:bg-slate-900 rounded-xl p-6 sm:p-8 shadow-xs border border-slate-200/90 dark:border-slate-800 transition-colors">
        <div className="flex items-center gap-2.5 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="w-9 h-9 rounded-xl bg-purple-50 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300 flex items-center justify-center font-bold">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
              Záloha a obnova dat (Export / Import)
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Všechna data se ukládají v tomto zařízení. Zálohujte si je pro případ výměny telefonu nebo promazání historie.
            </p>
          </div>
        </div>

        <div className="pt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Export */}
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 flex flex-col justify-between space-y-3">
            <div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                <Download className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                <span>Exportovat kompletní zálohu</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Stáhne jeden soubor <code className="text-purple-600 font-mono">.json</code> se všemi vašimi údaji, klienty, smlouvami i fotkami.
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                exportAppBackup();
                onToast?.('success', 'Záložní soubor JSON byl vygenerován a stažen');
              }}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Stáhnout zálohu (.json)</span>
            </button>
          </div>

          {/* Import */}
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 flex flex-col justify-between space-y-3">
            <div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                <Upload className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span>Obnovit data ze zálohy</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Nahrajte dříve stažený soubor zálohy a obnovte své klienty a smlouvy na tomto zařízení.
              </p>
            </div>

            {/* Skrytý file input */}
            <input
              ref={backupInputRef}
              type="file"
              accept=".json,application/json"
              onChange={handleBackupFileSelect}
              className="hidden"
            />

            <button
              type="button"
              onClick={() => backupInputRef.current?.click()}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 dark:bg-slate-700 hover:bg-slate-900 dark:hover:bg-slate-600 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Vybrat záložní soubor (.json)</span>
            </button>
          </div>
        </div>
      </div>

      {/* Signature Modal */}
      <SignatureModal
        isOpen={isSignatureModalOpen}
        title="Výchozí digitální podpis zhotovitele"
        signerName={name || 'Zhotovitel'}
        role="contractor"
        initialSignature={signature}
        onSave={(dataUrl) => {
          setSignature(dataUrl);
          onToast?.('success', 'Výchozí podpis zhotovitele byl uložen');
        }}
        onClose={() => setIsSignatureModalOpen(false)}
      />

      {/* Potvrzovací dialog pro obnovu dat */}
      {pendingBackup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl max-w-md w-full p-6 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
              <h3 className="font-bold text-slate-900 dark:text-white text-base">
                Obnovit data ze souboru?
              </h3>
              <button
                onClick={() => setPendingBackup(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-blue-50 dark:bg-blue-950/60 rounded-xl border border-blue-200 dark:border-blue-800 text-xs text-blue-900 dark:text-blue-200 space-y-1 mb-5">
              <p>
                <strong>Soubor:</strong> {pendingBackup.fileName}
              </p>
              <p>
                <strong>Počet klientů:</strong> {pendingBackup.data.clients.length}
              </p>
              <p>
                <strong>Počet smluv:</strong> {pendingBackup.data.contracts.length}
              </p>
              <p>
                <strong>Datum zálohy:</strong> {new Date(pendingBackup.data.exportedAt).toLocaleString('cs-CZ')}
              </p>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 mb-5">
              Zvolte, jak chcete data zpracovat:
            </p>

            <div className="space-y-2">
              <button
                type="button"
                onClick={() => handleApplyPendingBackup('merge')}
                className="w-full text-left p-3 rounded-xl border border-blue-200 dark:border-blue-800 hover:bg-blue-50 dark:hover:bg-blue-950/50 transition-colors cursor-pointer"
              >
                <p className="text-xs font-bold text-blue-900 dark:text-blue-200">
                  Sloučit s existujícími daty (Doporučeno)
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Zachová vaše stávající smlouvy a přidá pouze chybějící položky.
                </p>
              </button>

              <button
                type="button"
                onClick={() => handleApplyPendingBackup('replace')}
                className="w-full text-left p-3 rounded-xl border border-rose-200 dark:border-rose-900 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors cursor-pointer"
              >
                <p className="text-xs font-bold text-rose-800 dark:text-rose-300">
                  Nahradit všechna data
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Přepíše stávající klienty a smlouvy verzí ze zálohy.
                </p>
              </button>
            </div>

            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setPendingBackup(null)}
                className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-400 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Zrušit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Sekce pro správu ceníku řemeslníka
const PriceListSettingsSection: React.FC<{
  onToast?: (type: 'success' | 'error' | 'info', text: string) => void;
}> = ({ onToast }) => {
  const [items, setItems] = useState<PriceListTemplateItem[]>(() => getStoredPriceList());
  const [filterCat, setFilterCat] = useState('Vše');
  const [isAdding, setIsAdding] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState('Zednické práce');
  const [newType, setNewType] = useState<'prace' | 'material' | 'ostatni'>('prace');
  const [newUnit, setNewUnit] = useState('m²');
  const [newPrice, setNewPrice] = useState<number | ''>(500);

  const categories = Array.from(new Set(['Vše', ...items.map((it) => it.category)]));

  const filtered = items.filter((it) => filterCat === 'Vše' || it.category === filterCat);

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    const numPrice = typeof newPrice === 'number' ? newPrice : parseFloat(String(newPrice));
    if (isNaN(numPrice) || numPrice <= 0) return;

    const newItem: PriceListTemplateItem = {
      id: `pl_custom_${Date.now()}`,
      title: newTitle.trim(),
      category: newCategory.trim() || 'Vlastní práce',
      type: newType,
      unit: newUnit,
      unitPrice: Math.round(numPrice),
    };

    const updated = [newItem, ...items];
    setItems(updated);
    saveStoredPriceList(updated);

    setNewTitle('');
    setIsAdding(false);
    onToast?.('success', `Položka „${newItem.title}“ byla přidána do ceníku.`);
  };

  const handleDeleteItem = (id: string) => {
    const it = items.find((x) => x.id === id);
    if (!window.confirm(`Opravdu chcete smazat položku „${it?.title || 'tuto položku'}“ z ceníku?`)) return;

    const updated = items.filter((x) => x.id !== id);
    setItems(updated);
    saveStoredPriceList(updated);
    onToast?.('info', 'Položka byla odstraněna.');
  };

  const handleResetDefaults = () => {
    if (!window.confirm('Opravdu chcete obnovit výchozí ceník běžných řemeslných prací a materiálů?')) return;

    const defaults: PriceListTemplateItem[] = DEFAULT_PRICE_LIST_ITEMS.map((item, idx) => ({
      ...item,
      id: `pl_def_${idx + 1}_${Date.now()}`,
    }));
    setItems(defaults);
    saveStoredPriceList(defaults);
    onToast?.('success', 'Výchozí ceník prací a materiálu byl obnoven.');
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl p-6 sm:p-8 shadow-xs border border-slate-200/90 dark:border-slate-800 transition-colors">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 flex items-center justify-center font-bold">
            <Tag className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span>Můj ceník prací a materiálu</span>
              <span className="text-xs px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200 font-semibold font-mono">
                {items.length} položek
              </span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Přednastavené jednotkové sazby pro bleskové vkládání do rozpočtů smluv i dodatků víceprací na 1 klik
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <button
            type="button"
            onClick={handleResetDefaults}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-slate-600 dark:text-slate-400 hover:text-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-medium transition-colors cursor-pointer"
            title="Obnovit výchozí šablony ceníku"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Obnovit výchozí</span>
          </button>

          <button
            type="button"
            onClick={() => setIsAdding((v) => !v)}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{isAdding ? 'Zavřít' : 'Přidat položku'}</span>
          </button>
        </div>
      </div>

      {/* Form pro novou položku */}
      {isAdding && (
        <form
          onSubmit={handleAddItem}
          className="mt-4 p-4 bg-amber-50/50 dark:bg-amber-950/30 rounded-xl border border-amber-200 dark:border-amber-800/80 space-y-3 animate-in fade-in"
        >
          <div className="text-xs font-bold text-amber-900 dark:text-amber-200 uppercase tracking-wider">
            Nová položka ceníku:
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
            <div className="sm:col-span-5">
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Název práce / materiálu *
              </label>
              <input
                type="text"
                placeholder="např. Montáž podlahových lišt"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                required
              />
            </div>
            <div className="sm:col-span-3">
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Kategorie
              </label>
              <input
                type="text"
                placeholder="Kategorie"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Jednotka
              </label>
              <select
                value={newUnit}
                onChange={(e) => setNewUnit(e.target.value)}
                className="w-full px-2 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
              >
                <option value="m²">m²</option>
                <option value="hod">hod</option>
                <option value="ks">ks</option>
                <option value="bm">bm</option>
                <option value="kpl">kpl</option>
                <option value="den">den</option>
                <option value="km">km</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Cena (Kč) *
              </label>
              <input
                type="number"
                value={newPrice}
                onChange={(e) => setNewPrice(e.target.value ? parseFloat(e.target.value) : '')}
                className="w-full px-3 py-1.5 text-xs font-bold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                required
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setIsAdding(false)}
              className="px-3 py-1 text-xs text-slate-500 hover:text-slate-800"
            >
              Zrušit
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold shadow-2xs cursor-pointer"
            >
              Uložit položku
            </button>
          </div>
        </form>
      )}

      {/* Kategorie filtr */}
      <div className="flex items-center gap-1.5 overflow-x-auto py-3 scrollbar-none">
        {categories.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setFilterCat(cat)}
            className={`px-3 py-1 rounded-lg text-xs whitespace-nowrap font-medium transition-all cursor-pointer ${
              filterCat === cat
                ? 'bg-amber-500 text-white font-bold shadow-2xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Tabulka položek ceníku */}
      <div className="mt-2 overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 font-semibold uppercase text-[10px] tracking-wider">
            <tr>
              <th className="py-2.5 px-3">Položka</th>
              <th className="py-2.5 px-3 hidden sm:table-cell">Kategorie</th>
              <th className="py-2.5 px-3 text-center">Typ</th>
              <th className="py-2.5 px-3 text-right">Jednotka</th>
              <th className="py-2.5 px-3 text-right">Sazba (Kč)</th>
              <th className="py-2.5 px-3 text-right">Akce</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {filtered.map((it) => (
              <tr key={it.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-white">
                  {it.title}
                </td>
                <td className="py-2.5 px-3 text-slate-500 hidden sm:table-cell">
                  {it.category}
                </td>
                <td className="py-2.5 px-3 text-center">
                  <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                    {it.type === 'prace' ? 'Práce' : it.type === 'material' ? 'Materiál' : 'Ostatní'}
                  </span>
                </td>
                <td className="py-2.5 px-3 text-right text-slate-600 dark:text-slate-400">
                  {it.unit}
                </td>
                <td className="py-2.5 px-3 text-right font-bold text-slate-900 dark:text-white">
                  {formatCurrency(it.unitPrice)}
                </td>
                <td className="py-2.5 px-3 text-right">
                  <button
                    type="button"
                    onClick={() => handleDeleteItem(it.id)}
                    className="p-1 text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-colors cursor-pointer"
                    title="Smazat položku"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
