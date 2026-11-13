/**
 * Synchronizace dat mezi prohlížečem (localStorage) a databází.
 *
 * localStorage zůstává místem, odkud aplikace čte a kam zapisuje (funguje i bez připojení).
 * Tento modul eviduje, co se lokálně změnilo, odesílá změny do databáze a stahuje změny z jiných zařízení.
 * Nezávisí na Supabase ani na prohlížeči – úložiště i databáze se předávají zvenku (kvůli testům).
 */

export type SyncTable = 'profiles' | 'clients' | 'contracts' | 'calendar_events' | 'price_list_items';

interface TableDef {
  table: SyncTable;
  /** Klíč v localStorage – tvar dat pod ním se nemění. */
  key: string;
  /** Jediný objekt místo seznamu (profil zhotovitele). */
  single?: boolean;
  /** Nové záznamy z cloudu se řadí na začátek seznamu (stejně jako při lokálním vytvoření). */
  prepend?: boolean;
  /** Při prvním přihlášení má cloud přednost a lokální data se nezakládají znovu. */
  remoteWinsOnAdopt?: boolean;
}

export const SYNC_TABLES: TableDef[] = [
  { table: 'profiles', key: 'zhotovitel', single: true, remoteWinsOnAdopt: true },
  { table: 'clients', key: 'klienti', prepend: true },
  { table: 'contracts', key: 'smlouvy', prepend: true },
  { table: 'calendar_events', key: 'remeslnik_kalendar' },
  { table: 'price_list_items', key: 'remeslnik_cenik', remoteWinsOnAdopt: true },
];

export const SYNC_STATE_KEY = 'cloud_sync_state';
const SINGLE_ID = 'profil';

export interface RemoteRow {
  id: string;
  data: any;
  updated_at: string;
  deleted_at: string | null;
}

export interface SyncBackend {
  /** Uloží (vloží nebo přepíše) řádky přihlášeného uživatele. */
  upsert(table: SyncTable, rows: { id: string; data: any; deleted_at: string | null }[]): Promise<void>;
  /** Vrátí řádky změněné po čase `since` (včetně smazaných), seřazené od nejstarší změny. */
  pull(table: SyncTable, since: string | null): Promise<RemoteRow[]>;
}

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

interface QueueEntry {
  op: 'upsert' | 'delete';
  n: number;
}

export interface SyncState {
  userId: string | null;
  seq: number;
  queue: Record<string, QueueEntry>;
  lastPulledAt: Partial<Record<SyncTable, string>>;
}

const emptyState = (): SyncState => ({ userId: null, seq: 0, queue: {}, lastPulledAt: {} });
const queueKey = (table: SyncTable, id: string) => `${table}|${id}`;

function parseRecords(def: TableDef, raw: string | null): { id: string; value: any }[] {
  if (!raw) return [];
  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (def.single) {
    return parsed && typeof parsed === 'object' ? [{ id: SINGLE_ID, value: parsed }] : [];
  }
  if (!Array.isArray(parsed)) return [];
  return parsed
    .filter((item) => item && typeof item.id === 'string' && item.id)
    .map((item) => ({ id: item.id as string, value: item }));
}

export function createSyncEngine(kv: KeyValueStore, backend: SyncBackend) {
  const loadState = (): SyncState => {
    try {
      const raw = kv.getItem(SYNC_STATE_KEY);
      if (raw) return { ...emptyState(), ...JSON.parse(raw) };
    } catch {
      // poškozený stav – začneme znovu
    }
    return emptyState();
  };
  const saveState = (state: SyncState) => kv.setItem(SYNC_STATE_KEY, JSON.stringify(state));

  const readRecords = (def: TableDef) => parseRecords(def, kv.getItem(def.key));

  const writeRecords = (def: TableDef, records: { id: string; value: any }[]) => {
    if (def.single) {
      if (records.length === 0) kv.removeItem(def.key);
      else kv.setItem(def.key, JSON.stringify(records[0].value));
      return;
    }
    kv.setItem(def.key, JSON.stringify(records.map((r) => r.value)));
  };

  /**
   * Zapíše řádky z cloudu do localStorage. Záznamy, které čekají na odeslání, se nepřepisují
   * (lokální změna má přednost a odešle se). Vrací true, pokud se lokální data změnila.
   */
  const applyRemoteRows = (def: TableDef, rows: RemoteRow[], state: SyncState): boolean => {
    if (rows.length === 0) return false;
    const records = readRecords(def);
    const indexById = new Map(records.map((r, i) => [r.id, i]));
    const removed = new Set<string>();
    const added: { id: string; value: any }[] = [];
    let changed = false;

    for (const row of rows) {
      if (state.queue[queueKey(def.table, row.id)]) continue;
      const idx = indexById.get(row.id);
      if (row.deleted_at) {
        if (idx !== undefined) {
          removed.add(row.id);
          changed = true;
        }
        continue;
      }
      if (idx === undefined) {
        added.push({ id: row.id, value: row.data });
        changed = true;
      } else if (JSON.stringify(records[idx].value) !== JSON.stringify(row.data)) {
        records[idx] = { id: row.id, value: row.data };
        changed = true;
      }
    }

    if (!changed) return false;
    const kept = records.filter((r) => !removed.has(r.id));
    // Řádky chodí od nejstarší změny; při řazení na začátek tedy nejnovější skončí první
    const next = def.prepend ? [...added.reverse(), ...kept] : [...kept, ...added];
    writeRecords(def, next);
    return true;
  };

  /** Volá se po každém lokálním zápisu: porovná starý a nový obsah klíče a zařadí změny k odeslání. */
  const trackChange = (key: string, oldRaw: string | null, newRaw: string | null): boolean => {
    if (oldRaw === newRaw) return false;
    const def = SYNC_TABLES.find((d) => d.key === key);
    if (!def) return false;
    const state = loadState();
    if (!state.userId) return false;

    const oldMap = new Map(parseRecords(def, oldRaw).map((r) => [r.id, JSON.stringify(r.value)]));
    const newRecords = parseRecords(def, newRaw);
    const newIds = new Set(newRecords.map((r) => r.id));
    let queued = false;

    for (const rec of newRecords) {
      if (oldMap.get(rec.id) !== JSON.stringify(rec.value)) {
        state.queue[queueKey(def.table, rec.id)] = { op: 'upsert', n: ++state.seq };
        queued = true;
      }
    }
    for (const id of oldMap.keys()) {
      if (!newIds.has(id)) {
        state.queue[queueKey(def.table, id)] = { op: 'delete', n: ++state.seq };
        queued = true;
      }
    }
    if (queued) saveState(state);
    return queued;
  };

  /** Odešle čekající změny. Při chybě vyhodí výjimku; neodeslané změny zůstávají ve frontě. */
  const push = async (): Promise<void> => {
    const snapshot = loadState();
    const entries = Object.entries(snapshot.queue).sort((a, b) => a[1].n - b[1].n);

    for (const def of SYNC_TABLES) {
      const tableEntries = entries.filter(([qKey]) => qKey.startsWith(`${def.table}|`));
      if (tableEntries.length === 0) continue;
      // Smlouvy mohou být velké (fotky), posílají se po jedné; ostatní po dávkách
      const batchSize = def.table === 'contracts' ? 1 : 100;

      for (let from = 0; from < tableEntries.length; from += batchSize) {
        const batch = tableEntries.slice(from, from + batchSize);
        const localById = new Map(readRecords(def).map((r) => [r.id, r.value]));
        const deletedAt = new Date().toISOString();
        const rows = batch.map(([qKey, entry]) => {
          const id = qKey.slice(def.table.length + 1);
          const value = entry.op === 'upsert' ? localById.get(id) : undefined;
          return value !== undefined
            ? { id, data: value, deleted_at: null }
            : { id, data: {}, deleted_at: deletedAt };
        });
        await backend.upsert(def.table, rows);

        // Z fronty odebrat jen záznamy, které se během odesílání znovu nezměnily
        const fresh = loadState();
        for (const [qKey, entry] of batch) {
          if (fresh.queue[qKey]?.n === entry.n) delete fresh.queue[qKey];
        }
        saveState(fresh);
      }
    }
  };

  /** Stáhne změny z cloudu od posledního stažení. Vrací true, pokud se lokální data změnila. */
  const pull = async (): Promise<boolean> => {
    let changed = false;
    for (const def of SYNC_TABLES) {
      const since = loadState().lastPulledAt[def.table] ?? null;
      const rows = await backend.pull(def.table, since);
      if (rows.length === 0) continue;
      const state = loadState();
      if (applyRemoteRows(def, rows, state)) changed = true;
      state.lastPulledAt[def.table] = rows[rows.length - 1].updated_at;
      saveState(state);
    }
    return changed;
  };

  /** Smaže z prohlížeče data účtu i stav synchronizace (při odhlášení nebo změně účtu). */
  const clearLocal = () => {
    for (const def of SYNC_TABLES) kv.removeItem(def.key);
    kv.removeItem(SYNC_STATE_KEY);
  };

  /**
   * První propojení prohlížeče s účtem. Data, která v prohlížeči vznikla před přihlášením, se nahrají
   * do účtu; data z účtu se stáhnou. Pokud v prohlížeči zůstala data jiného účtu, nejprve se smažou.
   * Vrací true, pokud se lokální data změnila.
   */
  const adopt = async (userId: string): Promise<boolean> => {
    let state = loadState();
    if (state.userId === userId) return false;
    let changed = false;
    if (state.userId && state.userId !== userId) {
      clearLocal();
      state = emptyState();
      changed = true;
    }

    // Nejdřív vše stáhnout; lokálně se nic nemění, dokud se nepovede celé stažení
    const remote = new Map<SyncTable, RemoteRow[]>();
    for (const def of SYNC_TABLES) {
      remote.set(def.table, await backend.pull(def.table, null));
    }

    const next: SyncState = { ...emptyState(), userId };
    for (const def of SYNC_TABLES) {
      const rows = remote.get(def.table) || [];
      const live = rows.filter((r) => !r.deleted_at);
      const local = readRecords(def);

      if (def.remoteWinsOnAdopt && live.length > 0) {
        const nextRecords = live.map((r) => ({ id: r.id, value: r.data }));
        if (JSON.stringify(local) !== JSON.stringify(nextRecords)) {
          writeRecords(def, nextRecords);
          changed = true;
        }
      } else {
        const remoteIds = new Set(rows.map((r) => r.id));
        for (const rec of local) {
          if (!remoteIds.has(rec.id)) {
            next.queue[queueKey(def.table, rec.id)] = { op: 'upsert', n: ++next.seq };
          }
        }
        if (applyRemoteRows(def, rows, next)) changed = true;
      }
      if (rows.length > 0) next.lastPulledAt[def.table] = rows[rows.length - 1].updated_at;
    }
    saveState(next);
    return changed;
  };

  return {
    trackChange,
    adopt,
    push,
    pull,
    clearLocal,
    getState: loadState,
    pendingCount: () => Object.keys(loadState().queue).length,
  };
}

export type SyncEngine = ReturnType<typeof createSyncEngine>;
