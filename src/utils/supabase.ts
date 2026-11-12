import { createClient } from '@supabase/supabase-js';

// Adresa projektu a publishable klíč jsou veřejné údaje (bezpečnost dat zajišťují pravidla v databázi).
// Výchozí hodnoty lze přepsat proměnnými VITE_SUPABASE_URL a VITE_SUPABASE_PUBLISHABLE_KEY.
const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL || 'https://cwfpuuiomgyjeekgyibi.supabase.co';
const SUPABASE_PUBLISHABLE_KEY =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_Wt1KWh7GD7kMjZfOz-QnyQ_LC3dTuQI';

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

/** Přihlášený uživatel v podobě, kterou používá UI (navigace, modál účtu). */
export interface CloudUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

export function toCloudUser(user: { id: string; email?: string | null } | null | undefined): CloudUser | null {
  if (!user) return null;
  return {
    uid: user.id,
    email: user.email ?? null,
    displayName: user.email ? user.email.split('@')[0] : null,
    photoURL: null,
  };
}

/** Převod chyb přihlášení ze Supabase na české hlášky. */
export function authErrorToCzech(err: any): string {
  const code: string = err?.code || '';
  const msg: string = (err?.message || '').toLowerCase();
  if (code === 'invalid_credentials' || msg.includes('invalid login credentials')) {
    return 'Nesprávný e-mail nebo heslo.';
  }
  if (code === 'email_not_confirmed' || msg.includes('email not confirmed')) {
    return 'E-mail ještě není potvrzený. Klikněte na odkaz, který jsme vám poslali.';
  }
  if (code === 'user_already_exists' || msg.includes('already registered')) {
    return 'Účet s tímto e-mailem už existuje. Přihlaste se, nebo si obnovte heslo.';
  }
  if (code === 'weak_password' || msg.includes('password should be')) {
    return 'Heslo je příliš slabé. Zvolte delší heslo (alespoň 8 znaků).';
  }
  if (code === 'same_password') {
    return 'Nové heslo musí být jiné než to původní.';
  }
  if (code.includes('rate_limit') || msg.includes('rate limit') || err?.status === 429) {
    return 'Příliš mnoho pokusů. Zkuste to prosím za chvíli znovu.';
  }
  if (code === 'email_address_invalid' || msg.includes('invalid email') || msg.includes('is invalid')) {
    return 'Zadejte platnou e-mailovou adresu.';
  }
  if (code === 'signup_disabled') {
    return 'Registrace nových účtů je momentálně vypnutá.';
  }
  if (msg.includes('failed to fetch') || msg.includes('network')) {
    return 'Nepodařilo se spojit se serverem. Zkontrolujte připojení k internetu.';
  }
  return 'Něco se nepovedlo. Zkuste to prosím znovu.';
}
