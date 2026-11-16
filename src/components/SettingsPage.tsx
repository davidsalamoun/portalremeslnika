import React, { useState, useEffect, useRef } from 'react';
import { Save, Search, Loader2, PenLine, Download, Upload, Trash2, Plus, RotateCcw, Crown } from 'lucide-react';
import { ContractorProfile, AppBackupData, PriceListTemplateItem } from '../types/contract';
import { fetchCompanyByIco, isAresVerified } from '../utils/ares';
import { cleanPlaceName, formatContractConclusionLine, formatCurrency } from '../utils/numberToWordsCs';
import { SignatureModal } from './SignatureModal';
import { CraftsmanStamp } from './CraftsmanStamp';
import { exportAppBackup, parseBackupFile } from '../utils/backup';
import { getStoredPriceList, saveStoredPriceList, DEFAULT_PRICE_LIST_ITEMS } from '../utils/storage';
import { getSubscriptionInfo } from '../utils/subscription';
import { todayIso } from '../utils/invoiceMath';
import { Dialog } from './Dialog';

// Pořadí polí ve formuláři (id prvku = settings-<klíč>) – pro přesun na první chybu
const FIELD_ORDER = ['ico', 'name', 'dic', 'address', 'bankAccount', 'phone', 'email', 'defaultPlace'];

const sectionTitle = 'text-2xl font-semibold text-slate-900 dark:text-white';
const box = 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md';
const fieldLabel = 'block font-semibold text-slate-900 dark:text-slate-100 mb-1.5';
const fieldBase = 'w-full min-h-12 px-3.5 py-2 rounded-md border-[1.5px] bg-white dark:bg-slate-950 text-slate-900 dark:text-white';
const fieldOk = 'border-slate-900 dark:border-slate-500';
const fieldBad = 'border-rose-700 dark:border-rose-400';
const errorText = 'mt-1.5 font-medium text-rose-700 dark:text-rose-400';
const hintText = 'mt-1.5 text-slate-600 dark:text-slate-400';
const optional = <span className="font-normal text-slate-600 dark:text-slate-400">(jen plátce DPH)</span>;
const outlineButton =
  'min-h-11 px-4 inline-flex items-center justify-center gap-2 rounded-md border-[1.5px] border-slate-900 dark:border-slate-500 text-slate-900 dark:text-slate-100 font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-default';
const primaryButton =
  'min-h-12 px-5 inline-flex items-center justify-center gap-2 rounded-md border-[1.5px] border-slate-900 bg-amber-400 hover:bg-amber-500 text-slate-900 font-semibold cursor-pointer transition-colors';
const dangerButton =
  'min-h-11 px-4 inline-flex items-center justify-center gap-2 rounded-md border-[1.5px] border-rose-700 bg-rose-700 hover:bg-rose-800 text-white font-semibold cursor-pointer transition-colors';
const smallAction =
  'min-h-11 min-w-11 px-3 inline-flex items-center justify-center gap-1.5 rounded-md border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-medium hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors';
const chip = (active: boolean) =>
  `min-h-11 px-3 inline-flex items-center justify-center rounded-md border font-medium whitespace-nowrap cursor-pointer transition-colors ${
    active
      ? 'border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-900'
      : 'border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800'
  }`;
const countWord = (n: number, one: string, few: string, many: string) => `${n} ${n === 1 ? one : n >= 2 && n <= 4 ? few : many}`;
const textLink = 'min-h-11 inline-flex items-center gap-1.5 font-medium text-blue-600 dark:text-blue-300 underline underline-offset-2 cursor-pointer';

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
      setErrors((prev) => ({ ...prev, ico: 'IČO má 8 číslic.' }));
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
      setAresMessage(`Načteno z ARES: ${data.name}`);
      setErrors((prev) => {
        const next = { ...prev };
        delete next.ico;
        delete next.name;
        delete next.address;
        return next;
      });
    } catch (err: any) {
      setAresMessage(err.message || 'Údaje se z ARES nepodařilo načíst.');
    } finally {
      setIsAresLoading(false);
    }
  };

  const validate = (): string[] => {
    const newErrors: { [key: string]: string } = {};

    if (!name.trim()) {
      newErrors.name = 'Zadejte své jméno nebo obchodní název.';
    }

    if (!ico.trim()) {
      newErrors.ico = 'Zadejte IČO.';
    } else if (!/^\d{8}$/.test(ico.trim())) {
      newErrors.ico = 'IČO má 8 číslic.';
    }

    if (dic.trim() && !/^(CZ)?\d{8,10}$/i.test(dic.trim())) {
      newErrors.dic = 'DIČ má tvar CZ a 8 až 10 číslic.';
    }

    if (!address.trim()) {
      newErrors.address = 'Zadejte sídlo nebo místo podnikání.';
    }

    if (!bankAccount.trim()) {
      newErrors.bankAccount = 'Zadejte číslo bankovního účtu.';
    } else if (!/^(\d{1,6}-)?\d{2,10}\/\d{4}$/.test(bankAccount.trim())) {
      newErrors.bankAccount = 'Účet zadejte s kódem banky, například 123456789/0100.';
    }

    if (!phone.trim()) {
      newErrors.phone = 'Zadejte kontaktní telefon.';
    }

    if (!email.trim()) {
      newErrors.email = 'Zadejte kontaktní e-mail.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      newErrors.email = 'E-mail nemá správný tvar.';
    }

    if (!cleanPlaceName(defaultPlace)) {
      newErrors.defaultPlace = 'Zadejte město v 6. pádě, například Praze nebo Brně.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const failed = validate();
    if (failed.length > 0) {
      const first = FIELD_ORDER.find((key) => failed.includes(key));
      const el = first ? document.getElementById(`settings-${first}`) : null;
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el?.focus({ preventScroll: true });
      onToast?.('error', failed.length === 1 ? 'V údajích chybí jedna položka.' : `V údajích je ${failed.length}× chyba nebo chybějící položka.`);
      return;
    }

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
      expenseFlatRate: initialProfile?.expenseFlatRate,
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
        onToast?.('error', err.message || 'Soubor není platná záloha.');
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
        ? 'Data jsou nahrazená obsahem zálohy.'
        : 'Záloha je sloučená se stávajícími daty.'
    );
    setPendingBackup(null);
  };

  const subInfo = getSubscriptionInfo(initialProfile);

  const verified = isAresVerified({ ico, name, address, aresVerified });

  const textField = (
    key: string,
    label: React.ReactNode,
    value: string,
    onChange: (v: string) => void,
    props: React.InputHTMLAttributes<HTMLInputElement> = {},
  ) => (
    <div>
      <label htmlFor={`settings-${key}`} className={fieldLabel}>
        {label}
      </label>
      <input
        id={`settings-${key}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={!!errors[key]}
        className={`${fieldBase} ${errors[key] ? fieldBad : fieldOk}`}
        {...props}
      />
      {errors[key] && (
        <p role="alert" className={errorText}>
          {errors[key]}
        </p>
      )}
    </div>
  );

  return (
    <div className="max-w-[1180px] mx-auto pb-16 space-y-9 text-[15px] leading-snug">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl sm:text-[44px] font-bold leading-[1.05] text-slate-900 dark:text-white">Nastavení</h1>
          <div className="mt-1 text-slate-600 dark:text-slate-400">Vaše údaje na dokumentech, podpis, ceník a záloha dat.</div>
        </div>
        {onPreloadSample && !initialProfile && (
          <button type="button" onClick={onPreloadSample} className={outlineButton}>
            Vyplnit ukázková data
          </button>
        )}
      </header>

      {/* Licence – jen se zapnutým placením */}
      {onOpenPaywall && (
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-[1.5px] border-blue-600 dark:border-blue-400 rounded-md">
          <div className="flex items-center gap-3 text-slate-900 dark:text-slate-100">
            <Crown className="w-5 h-5 shrink-0" />
            <span>
              <span className="font-semibold">{subInfo.label}</span>
              {subInfo.isPro && subInfo.expiresAtFormatted ? `, platí do ${subInfo.expiresAtFormatted}` : ''}
            </span>
          </div>
          <div className="flex flex-wrap gap-2.5">
            {subInfo.isPro && onOpenInvoiceModal && (
              <button type="button" onClick={onOpenInvoiceModal} className={outlineButton}>
                Doklad k licenci
              </button>
            )}
            <button type="button" onClick={onOpenPaywall} className={outlineButton}>
              {subInfo.isPro ? 'Spravovat licenci' : 'Mistr PRO'}
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-x-10 gap-y-9 items-start">
        {/* Údaje zhotovitele */}
        <section aria-labelledby="nastaveni-udaje" className="lg:col-span-8 space-y-2.5 min-w-0">
          <h2 id="nastaveni-udaje" className={sectionTitle}>
            Vaše údaje
          </h2>
          <form onSubmit={handleSubmit} noValidate className={`${box} divide-y divide-slate-200 dark:divide-slate-800`}>
            <div className="p-5 sm:p-6 space-y-5">
              <div>
                <label htmlFor="settings-ico" className={fieldLabel}>
                  IČO
                </label>
                <div className="flex flex-col sm:flex-row gap-2">
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
                        if (ico.length === 8) handleAresLookup(ico);
                      }
                    }}
                    placeholder="8 číslic"
                    aria-invalid={!!errors.ico}
                    className={`${fieldBase} flex-1 min-w-0 tabular-nums ${errors.ico ? fieldBad : fieldOk}`}
                  />
                  <button type="button" onClick={() => handleAresLookup()} disabled={isAresLoading || ico.length !== 8} className={`${outlineButton} !min-h-12 shrink-0`}>
                    {isAresLoading ? <Loader2 className="w-[18px] h-[18px] animate-spin" /> : <Search className="w-[18px] h-[18px]" />}
                    <span>{isAresLoading ? 'Hledám…' : 'Načíst z ARES'}</span>
                  </button>
                </div>
                {errors.ico && (
                  <p role="alert" className={errorText}>
                    {errors.ico}
                  </p>
                )}
                {aresMessage && !errors.ico && (
                  <p role="status" className={hintText}>
                    {aresMessage}
                  </p>
                )}
              </div>

              {textField('name', 'Jméno a příjmení nebo název firmy', name, setName, {
                type: 'text',
                placeholder: 'např. Jan Novák – obkladačské práce',
              })}
              {textField('address', 'Sídlo nebo místo podnikání', address, setAddress, {
                type: 'text',
                placeholder: 'např. Květinová 124/8, 140 00 Praha 4',
              })}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {textField('dic', <>DIČ {optional}</>, dic, (v) => setDic(v.toUpperCase()), { type: 'text', placeholder: 'CZ12345678' })}
                {textField('bankAccount', 'Bankovní účet s kódem banky', bankAccount, setBankAccount, {
                  type: 'text',
                  placeholder: '19-2345670237/0100',
                })}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {textField('phone', 'Telefon', phone, setPhone, { type: 'tel', inputMode: 'tel', placeholder: '+420 777 123 456' })}
                {textField('email', 'E-mail', email, setEmail, { type: 'email', placeholder: 'novak@email.cz' })}
              </div>
            </div>

            <div className="p-5 sm:p-6 space-y-3">
              <label htmlFor="settings-defaultPlace" className={`${fieldLabel} !mb-0`}>
                Kde obvykle uzavíráte smlouvy
              </label>
              <div className="flex items-stretch max-w-md">
                <span className="inline-flex items-center px-3.5 rounded-l-md border-[1.5px] border-r-0 border-slate-900 dark:border-slate-500 text-slate-600 dark:text-slate-400 select-none">
                  V / Ve
                </span>
                <input
                  id="settings-defaultPlace"
                  type="text"
                  value={defaultPlace}
                  onChange={(e) => {
                    const val = e.target.value;
                    setDefaultPlace(cleanPlaceName(val) || val);
                  }}
                  onBlur={() => setDefaultPlace(cleanPlaceName(defaultPlace))}
                  placeholder="Praze"
                  aria-invalid={!!errors.defaultPlace}
                  className={`${fieldBase} !rounded-l-none flex-1 min-w-0 ${errors.defaultPlace ? fieldBad : fieldOk}`}
                />
              </div>
              {errors.defaultPlace && (
                <p role="alert" className={`${errorText} !mt-0`}>
                  {errors.defaultPlace}
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                {['Praze', 'Brně', 'Ostravě', 'Plzni', 'Liberci', 'Olomouci', 'místě plnění'].map((city) => (
                  <button key={city} type="button" aria-pressed={defaultPlace === city} onClick={() => setDefaultPlace(city)} className={chip(defaultPlace === city)}>
                    {city}
                  </button>
                ))}
              </div>
              <p className="text-slate-600 dark:text-slate-400">
                Město pište v 6. pádě. Ve smlouvě bude:{' '}
                <span className="font-semibold text-slate-900 dark:text-white">
                  {formatContractConclusionLine(defaultPlace || 'Praze', todayIso())}
                </span>
              </p>
            </div>

            <div className="p-5 sm:p-6 space-y-3">
              <div id="nastaveni-podpis" className={`${fieldLabel} !mb-0 scroll-mt-24`}>Váš podpis</div>
              <p className="text-slate-600 dark:text-slate-400">Uložený podpis se vloží do každé nové smlouvy a předávacího protokolu.</p>
              {signature ? (
                <div className="flex flex-wrap items-center gap-3">
                  <div className="h-16 w-44 bg-white border border-slate-900 rounded-md p-1 flex items-center justify-center">
                    <img src={signature} alt="Uložený podpis" className="max-h-14 max-w-full object-contain" />
                  </div>
                  <button type="button" onClick={() => setIsSignatureModalOpen(true)} className={smallAction}>
                    <PenLine className="w-4 h-4" />
                    <span>Podepsat znovu</span>
                  </button>
                  <button type="button" onClick={() => setSignature('')} className={smallAction}>
                    <Trash2 className="w-4 h-4" />
                    <span>Odebrat</span>
                  </button>
                </div>
              ) : (
                <button type="button" onClick={() => setIsSignatureModalOpen(true)} className={outlineButton}>
                  <PenLine className="w-[18px] h-[18px]" />
                  <span>Nakreslit podpis</span>
                </button>
              )}
            </div>

            <div className="p-5 sm:p-6">
              <button type="submit" className={`${primaryButton} w-full sm:w-auto`}>
                <Save className="w-5 h-5" />
                <span>Uložit údaje</span>
              </button>
            </div>
          </form>
        </section>

        {/* Razítko a stav údajů */}
        <aside aria-labelledby="nastaveni-razitko" className="lg:col-span-4 lg:sticky lg:top-6 space-y-2.5 min-w-0">
          <h2 id="nastaveni-razitko" className={sectionTitle}>
            Razítko na dokumentech
          </h2>
          <div className={`${box} divide-y divide-slate-100 dark:divide-slate-800`}>
            <div className="px-5 py-6 flex items-center justify-center min-h-[170px] bg-white rounded-t-md">
              {name && ico ? (
                <CraftsmanStamp
                  contractor={{
                    name,
                    ico,
                    dic: dic || undefined,
                    address: address || 'Sídlo zhotovitele',
                    defaultPlace: defaultPlace || 'místě plnění',
                    signature,
                    bankAccount,
                    phone,
                    email,
                  }}
                  size="lg"
                />
              ) : (
                <span className="text-slate-600 text-center">Razítko se ukáže po vyplnění jména a IČO.</span>
              )}
            </div>
            <div className="px-5 py-3.5">
              <div className="font-semibold text-slate-900 dark:text-white">
                {verified ? 'Údaje odpovídají registru ARES' : 'Údaje nejsou ověřené v ARES'}
              </div>
              <div className="text-slate-600 dark:text-slate-400">
                {verified
                  ? `Jméno, IČO a sídlo se shodují s tím, co bylo načteno z ARES${
                      aresVerified?.verifiedAt ? ` ${new Date(aresVerified.verifiedAt).toLocaleDateString('cs-CZ')}` : ''
                    }.`
                  : 'Zadejte IČO a načtěte údaje z ARES. Po ruční úpravě jména, IČO nebo sídla ověření přestane platit.'}
              </div>
            </div>
            <div className="px-5 py-3.5">
              <div className="font-semibold text-slate-900 dark:text-white">QR platba na fakturách</div>
              <div className={bankAccount ? 'text-slate-600 dark:text-slate-400 tabular-nums' : 'font-medium text-rose-700 dark:text-rose-400'}>
                {bankAccount ? `na účet ${bankAccount}` : 'Chybí číslo účtu, faktury budou bez QR platby.'}
              </div>
            </div>
          </div>
        </aside>
      </div>

      <PriceListSettingsSection onToast={onToast} />

      {/* Záloha a obnova */}
      <section aria-labelledby="nastaveni-zaloha" className="space-y-2.5">
        <h2 id="nastaveni-zaloha" className={sectionTitle}>
          Záloha dat
        </h2>
        <div className={`${box} divide-y divide-slate-100 dark:divide-slate-800`}>
          <div className="px-5 py-4 flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0 flex-1 basis-64">
              <div className="font-semibold text-slate-900 dark:text-white">Stáhnout zálohu</div>
              <div className="text-slate-600 dark:text-slate-400">
                Jeden soubor s údaji, klienty, zakázkami, ceníkem, kalendářem i fotkami. Data máte i ve svém účtu, soubor je pojistka navíc.
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                exportAppBackup();
                onToast?.('success', 'Záloha se stahuje.');
              }}
              className={outlineButton}
            >
              <Download className="w-[18px] h-[18px]" />
              <span>Stáhnout zálohu</span>
            </button>
          </div>
          <div className="px-5 py-4 flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0 flex-1 basis-64">
              <div className="font-semibold text-slate-900 dark:text-white">Obnovit ze zálohy</div>
              <div className="text-slate-600 dark:text-slate-400">Nahrajte dříve stažený soubor. Před obnovou uvidíte, co obsahuje.</div>
            </div>
            <input ref={backupInputRef} type="file" accept=".json,application/json" onChange={handleBackupFileSelect} className="hidden" />
            <button type="button" onClick={() => backupInputRef.current?.click()} className={outlineButton}>
              <Upload className="w-[18px] h-[18px]" />
              <span>Vybrat soubor</span>
            </button>
          </div>
        </div>
      </section>

      <SignatureModal
        isOpen={isSignatureModalOpen}
        title="Výchozí digitální podpis zhotovitele"
        signerName={name || 'Zhotovitel'}
        role="contractor"
        initialSignature={signature}
        onSave={(dataUrl) => {
          setSignature(dataUrl);
          onToast?.('info', 'Podpis je připravený. Uložte údaje, aby se začal používat.');
        }}
        onClose={() => setIsSignatureModalOpen(false)}
      />

      {pendingBackup && (
        <Dialog title="Obnovit ze zálohy?" subtitle={pendingBackup.fileName} onClose={() => setPendingBackup(null)}>
          <div className="space-y-4">
            <p className="text-slate-900 dark:text-slate-100">
              Záloha z {new Date(pendingBackup.data.exportedAt).toLocaleString('cs-CZ')} obsahuje{' '}
              <span className="font-semibold">{countWord(pendingBackup.data.clients.length, 'klienta', 'klienty', 'klientů')}</span> a{' '}
              <span className="font-semibold">{countWord(pendingBackup.data.contracts.length, 'zakázku', 'zakázky', 'zakázek')}</span>.
            </p>
            <div className="space-y-2.5">
              <button type="button" onClick={() => handleApplyPendingBackup('merge')} className={`${outlineButton} w-full !justify-start text-left !py-2.5 !h-auto`}>
                <span>
                  <span className="block">Sloučit se stávajícími daty</span>
                  <span className="block font-normal text-slate-600 dark:text-slate-400">Nic se nesmaže, přidá se jen to, co chybí.</span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => handleApplyPendingBackup('replace')}
                className="w-full min-h-11 px-4 py-2.5 rounded-md border-[1.5px] border-rose-700 dark:border-rose-400 text-left cursor-pointer hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
              >
                <span className="block font-semibold text-rose-700 dark:text-rose-400">Nahradit všechna data</span>
                <span className="block text-slate-600 dark:text-slate-400">Současní klienti a zakázky se přepíšou obsahem zálohy.</span>
              </button>
            </div>
            <div className="flex justify-end">
              <button type="button" onClick={() => setPendingBackup(null)} className={outlineButton}>
                Zrušit
              </button>
            </div>
          </div>
        </Dialog>
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
  const [itemToDelete, setItemToDelete] = useState<PriceListTemplateItem | null>(null);
  const [isResetOpen, setIsResetOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState('Zednické práce');
  const [newType, setNewType] = useState<'prace' | 'material' | 'ostatni'>('prace');
  const [newUnit, setNewUnit] = useState('m²');
  const [newPrice, setNewPrice] = useState<number | ''>('');

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
    const updated = items.filter((x) => x.id !== id);
    setItems(updated);
    saveStoredPriceList(updated);
    setItemToDelete(null);
    onToast?.('info', 'Položka je z ceníku smazaná.');
  };

  const handleResetDefaults = () => {
    const defaults: PriceListTemplateItem[] = DEFAULT_PRICE_LIST_ITEMS.map((item, idx) => ({
      ...item,
      id: `pl_def_${idx + 1}_${Date.now()}`,
    }));
    setItems(defaults);
    saveStoredPriceList(defaults);
    setIsResetOpen(false);
    onToast?.('success', 'Ceník je obnovený na výchozí položky.');
  };

  const typeLabel = (t: PriceListTemplateItem['type']) => (t === 'prace' ? 'práce' : t === 'material' ? 'materiál' : 'ostatní');

  return (
    <section aria-labelledby="nastaveni-cenik" className="space-y-2.5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="nastaveni-cenik" className={sectionTitle}>
          Ceník prací a materiálu
        </h2>
        <button type="button" onClick={() => setIsResetOpen(true)} className={textLink}>
          <RotateCcw className="w-4 h-4" />
          <span>Obnovit výchozí ceník</span>
        </button>
      </div>
      <p className="text-slate-600 dark:text-slate-400">
        Položky z ceníku vložíte jedním klepnutím do rozpočtu smlouvy i do dodatku. V ceníku je jich {items.length}.
      </p>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {categories.map((cat) => (
          <button key={cat} type="button" aria-pressed={filterCat === cat} onClick={() => setFilterCat(cat)} className={chip(filterCat === cat)}>
            {cat}
          </button>
        ))}
      </div>

      <div className={`${box} divide-y divide-slate-100 dark:divide-slate-800`}>
        {isAdding ? (
          <form onSubmit={handleAddItem} className="p-5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
              <div className="sm:col-span-5">
                <label htmlFor="cenik-nazev" className={fieldLabel}>
                  Název
                </label>
                <input
                  id="cenik-nazev"
                  type="text"
                  required
                  autoFocus
                  placeholder="např. Montáž podlahových lišt"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className={`${fieldBase} ${fieldOk}`}
                />
              </div>
              <div className="sm:col-span-3">
                <label htmlFor="cenik-kategorie" className={fieldLabel}>
                  Kategorie
                </label>
                <input id="cenik-kategorie" type="text" value={newCategory} onChange={(e) => setNewCategory(e.target.value)} className={`${fieldBase} ${fieldOk}`} />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="cenik-jednotka" className={fieldLabel}>
                  Jednotka
                </label>
                <select id="cenik-jednotka" value={newUnit} onChange={(e) => setNewUnit(e.target.value)} className={`${fieldBase} ${fieldOk} cursor-pointer`}>
                  {['m²', 'hod', 'ks', 'bm', 'kpl', 'den', 'km'].map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="cenik-cena" className={fieldLabel}>
                  Cena v Kč
                </label>
                <input
                  id="cenik-cena"
                  type="number"
                  min="1"
                  required
                  inputMode="numeric"
                  value={newPrice}
                  onChange={(e) => setNewPrice(e.target.value ? parseFloat(e.target.value) : '')}
                  className={`${fieldBase} ${fieldOk} tabular-nums`}
                />
              </div>
            </div>
            <div role="group" aria-label="Druh položky" className="flex flex-wrap gap-2">
              {(['prace', 'material', 'ostatni'] as const).map((t) => (
                <button key={t} type="button" aria-pressed={newType === t} onClick={() => setNewType(t)} className={chip(newType === t)}>
                  {t === 'prace' ? 'Práce' : t === 'material' ? 'Materiál' : 'Ostatní'}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap justify-end gap-2.5">
              <button type="button" onClick={() => setIsAdding(false)} className={outlineButton}>
                Zrušit
              </button>
              <button type="submit" className={`${primaryButton} !min-h-11`}>
                Přidat do ceníku
              </button>
            </div>
          </form>
        ) : (
          <div className="p-3">
            <button type="button" onClick={() => setIsAdding(true)} className={`${smallAction} !border-slate-900 dark:!border-slate-400 font-semibold`}>
              <Plus className="w-4 h-4" />
              <span>Přidat položku</span>
            </button>
          </div>
        )}

        {filtered.length === 0 && <div className="px-5 py-4 text-slate-600 dark:text-slate-400">V této kategorii není žádná položka.</div>}
        {filtered.map((it) => (
          <div key={it.id} className="pl-5 pr-2.5 py-1.5 flex items-center gap-3">
            <div className="flex-1 min-w-0 py-1.5">
              <div className="font-semibold text-slate-900 dark:text-white">{it.title}</div>
              <div className="text-slate-600 dark:text-slate-400">
                {it.category}, {typeLabel(it.type)}
              </div>
            </div>
            <div className="text-right whitespace-nowrap">
              <span className="font-display font-semibold tabular-nums text-[19px] text-slate-900 dark:text-white">{formatCurrency(it.unitPrice)}</span>
              <span className="text-slate-600 dark:text-slate-400"> / {it.unit}</span>
            </div>
            <button
              type="button"
              onClick={() => setItemToDelete(it)}
              aria-label={`Smazat položku ${it.title}`}
              title="Smazat"
              className="w-11 h-11 shrink-0 inline-flex items-center justify-center rounded-md text-slate-900 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      {itemToDelete && (
        <Dialog title="Smazat položku ceníku?" onClose={() => setItemToDelete(null)}>
          <div className="space-y-5">
            <p className="text-slate-900 dark:text-slate-100">
              Položka <span className="font-semibold">{itemToDelete.title}</span> zmizí z ceníku. V už vytvořených rozpočtech zůstane.
            </p>
            <div className="flex flex-wrap justify-end gap-2.5">
              <button type="button" onClick={() => setItemToDelete(null)} className={outlineButton}>
                Ponechat
              </button>
              <button type="button" onClick={() => handleDeleteItem(itemToDelete.id)} className={dangerButton}>
                <Trash2 className="w-[18px] h-[18px]" />
                <span>Smazat</span>
              </button>
            </div>
          </div>
        </Dialog>
      )}

      {isResetOpen && (
        <Dialog title="Obnovit výchozí ceník?" onClose={() => setIsResetOpen(false)}>
          <div className="space-y-5">
            <p className="text-slate-900 dark:text-slate-100">
              Současných {items.length} položek včetně vašich vlastních se nahradí výchozím ceníkem běžných prací a materiálu.
            </p>
            <div className="flex flex-wrap justify-end gap-2.5">
              <button type="button" onClick={() => setIsResetOpen(false)} className={outlineButton}>
                Ponechat můj ceník
              </button>
              <button type="button" onClick={handleResetDefaults} className={dangerButton}>
                <RotateCcw className="w-[18px] h-[18px]" />
                <span>Obnovit výchozí</span>
              </button>
            </div>
          </div>
        </Dialog>
      )}
    </section>
  );
};
