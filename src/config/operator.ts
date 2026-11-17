/**
 * Provozovatel aplikace – údaje pro zásady ochrany osobních údajů a kontakt na úvodní stránce.
 *
 * POZOR: zatím provizorní údaje pro zkušební provoz (společnost ani adresa zatím neexistují). Před spuštěním pro
 * skutečné uživatele doplnit skutečného provozovatele, IČO a doručovací adresu a zkontrolovat zásady
 * (components/PrivacyPolicy.tsx).
 */
export const OPERATOR = {
  name: 'Řemeslník PRO s.r.o.',
  email: 'info@portalremeslnika.cz',
  /** Doručovací adresa – zatím neuvedena */
  address: '',
  /** IČO – zatím neuvedeno */
  ico: '',
};

/** Datum, od kterého platí současné znění zásad (YYYY-MM-DD). Při změně textu zásad posunout. */
export const PRIVACY_POLICY_DATE = '2026-11-17';

/** Odkaz, který odkudkoli v aplikaci otevře zásady (hash v adrese, funguje i bez přihlášení). */
export const PRIVACY_HASH = '#ochrana-osobnich-udaju';
