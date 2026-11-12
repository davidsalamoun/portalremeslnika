import { ContractorProfile } from '../types/contract';
import { generateSpaydString, generateQrPaymentDataUrl } from './spayd';

export const PRO_CONFIG = {
  monthlyPrice: 199,
  yearlyPrice: 1990, // 2 měsíce zdarma (cca 165 Kč/měs)
  trialDays: 14,
  maxFreeContracts: 3,
  operatorName: 'Řemeslník PRO s.r.o.',
  operatorIco: '21458931',
  operatorDic: 'CZ21458931',
  operatorAddress: 'Václavské náměstí 846/1, 110 00 Praha 1',
  operatorAccount: '2301984562/2010', // Fio banka
} as const;

export interface SubscriptionInfo {
  isPro: boolean;
  plan: 'free' | 'pro_trial' | 'pro_monthly' | 'pro_yearly';
  label: string;
  badgeClass: string;
  daysLeft: number | null;
  expiresAtFormatted: string | null;
  canCreateNewContract: (currentCount: number) => boolean;
}

/**
 * Zjištění, zda má uživatel aktivní PRO verzi (placenou nebo trial)
 */
export function isProUser(profile: ContractorProfile | null): boolean {
  if (!profile) return false;
  const plan = profile.subscriptionPlan;
  if (!plan || plan === 'free') return false;

  if (profile.subscriptionExpiresAt) {
    const expires = new Date(profile.subscriptionExpiresAt).getTime();
    if (isNaN(expires)) return false;
    return expires > Date.now();
  }

  // Pokud je plán nastaven a datum chybí, považujeme za aktivní
  return plan === 'pro_trial' || plan === 'pro_monthly' || plan === 'pro_yearly';
}

/**
 * Počet zbývajících dnů předplatného / zkušební doby
 */
export function getDaysRemainingInPro(profile: ContractorProfile | null): number | null {
  if (!profile || !isProUser(profile) || !profile.subscriptionExpiresAt) {
    return null;
  }
  const expires = new Date(profile.subscriptionExpiresAt).getTime();
  const diffMs = expires - Date.now();
  if (diffMs <= 0) return 0;
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Získání komplexních informací o předplatném pro UI
 */
export function getSubscriptionInfo(profile: ContractorProfile | null): SubscriptionInfo {
  const isPro = isProUser(profile);
  const plan = profile?.subscriptionPlan || 'free';
  const daysLeft = getDaysRemainingInPro(profile);

  let expiresAtFormatted: string | null = null;
  if (profile?.subscriptionExpiresAt) {
    try {
      const d = new Date(profile.subscriptionExpiresAt);
      expiresAtFormatted = d.toLocaleDateString('cs-CZ', {
        day: 'numeric',
        month: 'numeric',
        year: 'numeric',
      });
    } catch {
      expiresAtFormatted = null;
    }
  }

  let label = 'Tarif Zdarma';
  let badgeClass = 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700';

  if (isPro) {
    if (plan === 'pro_trial') {
      label = `Zkušební doba PRO (${daysLeft ?? 14} dní)`;
      badgeClass = 'bg-amber-50 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border-amber-200 dark:border-amber-800';
    } else if (plan === 'pro_monthly') {
      label = 'Mistr PRO (Měsíční)';
      badgeClass = 'bg-blue-50 text-blue-800 dark:bg-blue-950/80 dark:text-blue-300 border-blue-200 dark:border-blue-800';
    } else if (plan === 'pro_yearly') {
      label = 'Mistr PRO (Roční)';
      badgeClass = 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';
    }
  }

  return {
    isPro,
    plan,
    label,
    badgeClass,
    daysLeft,
    expiresAtFormatted,
    canCreateNewContract: (currentCount: number) => {
      if (isPro) return true;
      return currentCount < PRO_CONFIG.maxFreeContracts;
    },
  };
}

/**
 * Aktivace 14denního zkušebního přístupu zdarma (bez karty)
 */
export function activateTrial(profile: ContractorProfile): ContractorProfile {
  const now = new Date();
  const expires = new Date(now.getTime() + PRO_CONFIG.trialDays * 24 * 60 * 60 * 1000);
  
  return {
    ...profile,
    subscriptionPlan: 'pro_trial',
    trialStartedAt: now.toISOString(),
    subscriptionExpiresAt: expires.toISOString(),
  };
}

/**
 * Aktivace placeného předplatného (Měsíční / Roční)
 */
export function activateProSubscription(
  profile: ContractorProfile,
  plan: 'pro_monthly' | 'pro_yearly'
): ContractorProfile {
  const now = new Date();
  const currentExpiry = profile.subscriptionExpiresAt ? new Date(profile.subscriptionExpiresAt).getTime() : 0;
  const baseTime = currentExpiry > Date.now() ? currentExpiry : now.getTime();

  const additionalDays = plan === 'pro_yearly' ? 365 : 31;
  const newExpiry = new Date(baseTime + additionalDays * 24 * 60 * 60 * 1000);

  const year = now.getFullYear();
  const invoiceNum = `PRO-${year}-${Math.floor(10000 + Math.random() * 90000)}`;

  return {
    ...profile,
    subscriptionPlan: plan,
    subscriptionExpiresAt: newExpiry.toISOString(),
    subscriptionInvoiceNumber: invoiceNum,
  };
}

/**
 * Zrušení předplatného zpět na tarif Zdarma
 */
export function cancelSubscription(profile: ContractorProfile): ContractorProfile {
  return {
    ...profile,
    subscriptionPlan: 'free',
    subscriptionExpiresAt: undefined,
  };
}

/**
 * Generování variabilního symbolu pro QR platbu (na základě IČO nebo telefonu živnostníka)
 */
export function getSubscriptionVariableSymbol(profile: ContractorProfile | null): string {
  if (profile?.ico && /^\d{8}$/.test(profile.ico.trim())) {
    return profile.ico.trim();
  }
  if (profile?.phone) {
    const digits = profile.phone.replace(/\D/g, '').slice(-8);
    if (digits.length >= 6) return digits;
  }
  return String(Math.floor(20260000 + Math.random() * 9999));
}

/**
 * Vytvoření SPAYD platby pro nákup předplatného
 */
export async function getSubscriptionQrPayment(
  plan: 'pro_monthly' | 'pro_yearly',
  profile: ContractorProfile | null
): Promise<{ qrDataUrl: string; vs: string; amount: number; message: string }> {
  const amount = plan === 'pro_yearly' ? PRO_CONFIG.yearlyPrice : PRO_CONFIG.monthlyPrice;
  const vs = getSubscriptionVariableSymbol(profile);
  const planName = plan === 'pro_yearly' ? 'Rocni' : 'Mesicni';
  const nameSafe = profile?.name ? profile.name.substring(0, 20) : 'Remeslnik';
  const message = `Remeslnik PRO ${planName} ${nameSafe}`;

  const qrDataUrl = await generateQrPaymentDataUrl({
    account: PRO_CONFIG.operatorAccount,
    amount,
    vs,
    message,
  });

  return {
    qrDataUrl,
    vs,
    amount,
    message,
  };
}
