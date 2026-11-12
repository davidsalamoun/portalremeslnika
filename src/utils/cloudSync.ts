import { supabase } from './supabase';
import { createSyncEngine, RemoteRow, SyncBackend, SyncTable } from './syncEngine';

/**
 * Propojení synchronizace (syncEngine.ts) se Supabase a s prohlížečem:
 * kdy se synchronizuje, stav pro UI a odhlášení.
 */

const PAGE_SIZE: Record<SyncTable, number> = {
  profiles: 10,
  clients: 500,
  contracts: 20, // smlouvy mohou obsahovat fotky, proto po menších dávkách
  calendar_events: 500,
  price_list_items: 500,
};

async function currentUserId(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const uid = data.session?.user?.id;
  if (!uid) throw new Error('Uživatel není přihlášen.');
  return uid;
}

const backend: SyncBackend = {
  async upsert(table, rows) {
    const userId = await currentUserId();
    const { error } = await supabase
      .from(table)
      .upsert(
        rows.map((r) => ({ user_id: userId, id: r.id, data: r.data, deleted_at: r.deleted_at })),
        { onConflict: 'user_id,id' }
      );
    if (error) throw error;
  },
  async pull(table, since) {
    const size = PAGE_SIZE[table];
    const all: RemoteRow[] = [];
    for (let from = 0; ; from += size) {
      let query = supabase
        .from(table)
        .select('id,data,updated_at,deleted_at')
        .order('updated_at', { ascending: true })
        .order('id', { ascending: true })
        .range(from, from + size - 1);
      if (since) query = query.gt('updated_at', since);
      const { data, error } = await query;
      if (error) throw error;
      all.push(...((data || []) as RemoteRow[]));
      if (!data || data.length < size) break;
    }
    return all;
  },
};

const engine = createSyncEngine(window.localStorage, backend);

export const CLOUD_DATA_CHANGED_EVENT = 'app:cloud_data_changed';

export interface CloudSyncStatus {
  phase: 'idle' | 'syncing' | 'error';
  /** Čas poslední úspěšné synchronizace (ISO) */
  lastSyncAt: string | null;
  /** Počet změn čekajících na odeslání */
  pending: number;
}

let status: CloudSyncStatus = { phase: 'idle', lastSyncAt: null, pending: engine.pendingCount() };
const listeners = new Set<(s: CloudSyncStatus) => void>();

function setStatus(patch: Partial<CloudSyncStatus>) {
  status = { ...status, ...patch, pending: engine.pendingCount() };
  listeners.forEach((l) => l(status));
}

export function getCloudSyncStatus(): CloudSyncStatus {
  return status;
}

export function subscribeCloudSyncStatus(listener: (s: CloudSyncStatus) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notifyDataChanged() {
  window.dispatchEvent(new CustomEvent(CLOUD_DATA_CHANGED_EVENT));
}

let running: Promise<boolean> | null = null;
let rerun = false;

/** Odešle čekající změny a stáhne novinky. Vrací true při úspěchu. Nikdy nevyhazuje výjimku. */
export function syncNow(): Promise<boolean> {
  if (running) {
    rerun = true;
    return running;
  }
  running = (async () => {
    try {
      if (!engine.getState().userId) return false;
      setStatus({ phase: 'syncing' });
      do {
        rerun = false;
        await engine.push();
        if (await engine.pull()) notifyDataChanged();
      } while (rerun);
      setStatus({ phase: 'idle', lastSyncAt: new Date().toISOString() });
      return true;
    } catch (err) {
      console.warn('Synchronizace s cloudem se nezdařila:', err);
      setStatus({ phase: 'error' });
      return false;
    } finally {
      running = null;
    }
  })();
  return running;
}

let pushTimer: number | undefined;

/** Volá storage.ts po každém zápisu do localStorage. */
export function trackLocalChange(key: string, oldRaw: string | null, newRaw: string | null) {
  try {
    if (!engine.trackChange(key, oldRaw, newRaw)) return;
  } catch (err) {
    console.warn('Změnu se nepodařilo zařadit k synchronizaci:', err);
    return;
  }
  setStatus({});
  window.clearTimeout(pushTimer);
  pushTimer = window.setTimeout(() => void syncNow(), 1500);
}

/** True, pokud tento prohlížeč ještě není propojený s daným účtem. */
export function needsAccountConnect(userId: string): boolean {
  return engine.getState().userId !== userId;
}

/**
 * První propojení prohlížeče s účtem: nahraje data vzniklá před přihlášením a stáhne data účtu.
 * Při chybě (např. bez připojení) vyhodí výjimku a lokální data nechá beze změny.
 */
export async function connectAccount(userId: string): Promise<void> {
  const changed = await engine.adopt(userId);
  if (changed) notifyDataChanged();
  setStatus({});
  await syncNow();
}

/** Spustí průběžnou synchronizaci (po návratu do aplikace, po obnovení připojení a pravidelně). */
export function startAutoSync(): () => void {
  let lastRun = 0;
  const run = (minGapMs: number) => {
    if (document.visibilityState === 'hidden' || !navigator.onLine) return;
    if (Date.now() - lastRun < minGapMs) return;
    lastRun = Date.now();
    void syncNow();
  };
  const onFocus = () => run(30_000);
  const onOnline = () => run(0);
  window.addEventListener('focus', onFocus);
  document.addEventListener('visibilitychange', onFocus);
  window.addEventListener('online', onOnline);
  const interval = window.setInterval(() => run(110_000), 120_000);
  run(0);
  return () => {
    window.removeEventListener('focus', onFocus);
    document.removeEventListener('visibilitychange', onFocus);
    window.removeEventListener('online', onOnline);
    window.clearInterval(interval);
  };
}

/**
 * Odhlášení: nejprve se pokusí odeslat neuložené změny, pak smaže data účtu z tohoto prohlížeče
 * (zůstávají v účtu) a načte aplikaci znovu. Vrací false, pokud uživatel odhlášení zrušil.
 */
export async function signOutAndClear(): Promise<boolean> {
  window.clearTimeout(pushTimer);
  await syncNow();
  const pending = engine.pendingCount();
  if (pending > 0) {
    const ok = window.confirm(
      `Některé změny (${pending}) se ještě nepodařilo uložit do účtu, nejspíš kvůli připojení k internetu. ` +
        'Pokud se odhlásíte teď, tyto změny se ztratí. Opravdu se chcete odhlásit?'
    );
    if (!ok) return false;
  }
  await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
  engine.clearLocal();
  window.localStorage.removeItem('last_cloud_sync');
  window.location.reload();
  return true;
}
