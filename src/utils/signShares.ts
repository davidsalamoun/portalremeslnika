import { supabase } from './supabase';
import { Contract } from '../types/contract';

/**
 * Online podpis smlouvy zákazníkem.
 *
 * Řemeslník vytvoří odkaz `?sign=<token>` s náhodným tajným kódem. Zákazník se nepřihlašuje a ke smlouvě
 * se dostane jen přes databázové funkce `get_sign_share` / `submit_sign_share` (viz supabase/schema.sql).
 */

export interface SignedShare {
  contractId: string;
  clientSignature: string;
  /** Datum podpisu YYYY-MM-DD */
  signedDate: string;
  signerName: string;
}

export interface PublicSignShare {
  status: 'pending' | 'signed';
  contract: Contract;
  signerName?: string | null;
  signedAt?: string | null;
  clientSignature?: string | null;
}

/** Náhodný tajný kód odkazu (192 bitů, bezpečný do URL). */
export function generateSignToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function buildSigningUrl(token: string): string {
  try {
    const url = new URL(window.location.href);
    url.search = '';
    url.hash = '';
    url.searchParams.set('sign', token);
    return url.toString();
  } catch {
    return `${window.location.origin}?sign=${token}`;
  }
}

/**
 * Zákazník dostane jen to, co portál k podpisu zobrazuje – ne náklady, fotky, deník ani další interní
 * údaje řemeslníka.
 */
export function toSharedContract(contract: Contract): Partial<Contract> {
  return {
    id: contract.id,
    docKind: contract.docKind,
    contractNumber: contract.contractNumber,
    quoteNumber: contract.quoteNumber,
    workDescription: contract.workDescription,
    price: contract.price,
    hasVat: contract.hasVat,
    advanceAmount: contract.advanceAmount,
    deliveryDate: contract.deliveryDate,
    conclusionDate: contract.conclusionDate,
    executionPlace: contract.executionPlace,
    items: contract.items,
    contractor: {
      name: contract.contractor?.name,
      ico: contract.contractor?.ico,
      address: contract.contractor?.address,
      phone: contract.contractor?.phone,
    } as Contract['contractor'],
    client: {
      name: contract.client?.name,
      address: contract.client?.address,
      phone: contract.client?.phone,
    } as Contract['client'],
  };
}

const toDatePart = (iso?: string | null) => (iso || new Date().toISOString()).split('T')[0];

/**
 * Založí (nebo aktualizuje) odkaz k podpisu pro danou smlouvu. Podepsaný odkaz se už nemění.
 * Vyžaduje přihlášeného řemeslníka.
 */
const pendingEnsures = new Map<string, Promise<void>>();

export function ensureSignShare(contract: Contract, token: string): Promise<void> {
  // Souběžná volání pro tentýž odkaz (např. opakované vykreslení) sdílejí jeden požadavek
  const running = pendingEnsures.get(token);
  if (running) return running;
  const promise = saveSignShare(contract, token).finally(() => pendingEnsures.delete(token));
  pendingEnsures.set(token, promise);
  return promise;
}

async function saveSignShare(contract: Contract, token: string): Promise<void> {
  const { data: existing, error: readError } = await supabase
    .from('sign_shares')
    .select('status')
    .eq('token', token)
    .maybeSingle();
  if (readError) throw readError;
  if (existing?.status === 'signed') return;

  const row = { token, contract_id: contract.id, contract_data: toSharedContract(contract) };
  if (!existing) {
    const { error } = await supabase.from('sign_shares').insert(row);
    if (!error) return;
    // 23505 = odkaz mezitím založilo jiné okno nebo zařízení; pokračujeme aktualizací
    if (error.code !== '23505') throw error;
  }
  const { error } = await supabase.from('sign_shares').update(row).eq('token', token).eq('status', 'pending');
  if (error) throw error;
}

/** Podepsané odkazy přihlášeného řemeslníka pro zadané smlouvy (jedním dotazem). */
export async function getSignedShares(contractIds: string[]): Promise<SignedShare[]> {
  if (contractIds.length === 0) return [];
  const { data, error } = await supabase
    .from('sign_shares')
    .select('contract_id,client_signature,signer_name,signed_at')
    .eq('status', 'signed')
    .in('contract_id', contractIds)
    .order('signed_at', { ascending: true });
  if (error) throw error;
  return (data || [])
    .filter((r) => r.client_signature)
    .map((r) => ({
      contractId: r.contract_id as string,
      clientSignature: r.client_signature as string,
      signedDate: toDatePart(r.signed_at as string | null),
      signerName: (r.signer_name as string | null) || 'Zákazník',
    }));
}

export async function getSignedShare(contractId: string): Promise<SignedShare | null> {
  const list = await getSignedShares([contractId]);
  return list[0] || null;
}

/**
 * Průběžně kontroluje, zda zákazník smlouvu podepsal. Po prvním nalezeném podpisu se sledování ukončí.
 * Vrací funkci pro zrušení.
 */
export function watchSignedShare(
  contractId: string,
  onSigned: (share: SignedShare) => void,
  intervalMs = 5000
): () => void {
  let stopped = false;
  let timer: number | undefined;
  const tick = async () => {
    if (stopped) return;
    try {
      if (document.visibilityState !== 'hidden' && navigator.onLine) {
        const share = await getSignedShare(contractId);
        if (share && !stopped) {
          stopped = true;
          onSigned(share);
          return;
        }
      }
    } catch (err) {
      console.warn('Kontrola online podpisu se nezdařila:', err);
    }
    if (!stopped) timer = window.setTimeout(tick, intervalMs);
  };
  timer = window.setTimeout(tick, intervalMs);
  return () => {
    stopped = true;
    window.clearTimeout(timer);
  };
}

/** Doplní do smluv podpisy, které zákazníci mezitím odeslali přes odkaz. */
export async function checkAndSyncRemoteSignatures(
  contracts: Contract[]
): Promise<{ updatedContracts: Contract[]; hasChanges: boolean }> {
  // Ptáme se jen na smlouvy, ke kterým byl někdy vytvořen odkaz a ještě nejsou podepsané
  const waiting = contracts.filter((c) => !c.clientSignature && c.signToken);
  if (waiting.length === 0) return { updatedContracts: contracts, hasChanges: false };

  const signed = await getSignedShares(waiting.map((c) => c.id));
  if (signed.length === 0) return { updatedContracts: contracts, hasChanges: false };

  const byContract = new Map(signed.map((s) => [s.contractId, s]));
  const updatedContracts = contracts.map((contract) => {
    const share = byContract.get(contract.id);
    if (!share || contract.clientSignature) return contract;
    return {
      ...contract,
      clientSignature: share.clientSignature,
      clientSignatureDate: share.signedDate,
      status: contract.status === 'draft' ? ('signed' as const) : contract.status,
    };
  });
  return { updatedContracts, hasChanges: true };
}

// --- Strana zákazníka (bez přihlášení) ---

export async function getPublicSignShare(token: string): Promise<PublicSignShare | null> {
  const { data, error } = await supabase.rpc('get_sign_share', { p_token: token });
  if (error) throw error;
  if (!data || !data.contract) return null;
  return data as PublicSignShare;
}

export type SubmitSignatureResult = 'signed' | 'already_signed' | 'not_found' | 'invalid';

export async function submitRemoteClientSignature(
  token: string,
  signatureDataUrl: string,
  signerName: string
): Promise<SubmitSignatureResult> {
  const { data, error } = await supabase.rpc('submit_sign_share', {
    p_token: token,
    p_signature: signatureDataUrl,
    p_signer_name: signerName,
  });
  if (error) throw error;
  return (data as SubmitSignatureResult) || 'not_found';
}
