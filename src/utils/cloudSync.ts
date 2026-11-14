import { supabase } from './supabase';
import { createSyncEngine, RemoteRow, SyncBackend, SyncTable } from './syncEngine';
import {
  preloadBlobs,
  getBlob,
  getPendingUploadIds,
  pendingUploadCount,
  markBlobUploaded,
  storeDownloadedBlob,
  loadBlobFromDisk,
  clearAllBlobs,
  listBlobInfo,
  deleteLocalBlobs,
  markBlobForReupload,
} from './blobStore';
import { planImageCleanup } from './imageCleanup';
import { migrateInlineImages, findMissingImageIds, getReferencedImageIds } from './storage';

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

// --- Obrázky: soubory v úložišti Supabase na cestě <user_id>/<id obrázku> ---

const PHOTO_BUCKET = 'photos';

function dataUrlToBlob(dataUrl: string): Blob {
  const comma = dataUrl.indexOf(',');
  const mime = dataUrl.slice(5, dataUrl.indexOf(';'));
  const binary = atob(dataUrl.slice(comma + 1));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/** Nahraje do účtu obrázky, které tam ještě nejsou. Vrací false, pokud se některý nahrát nepodařil. */
async function uploadPendingImages(): Promise<boolean> {
  const ids = getPendingUploadIds();
  if (ids.length === 0) return true;
  const userId = await currentUserId();
  let allOk = true;
  for (const id of ids) {
    const dataUrl = getBlob(id);
    if (dataUrl === undefined) continue;
    const { error } = await supabase.storage
      .from(PHOTO_BUCKET)
      .upload(`${userId}/${id}`, dataUrlToBlob(dataUrl), { upsert: true, contentType: dataUrl.slice(5, dataUrl.indexOf(';')) });
    if (error) {
      console.warn(`Obrázek ${id} se nepodařilo nahrát:`, error.message);
      allOk = false;
      continue;
    }
    await markBlobUploaded(id);
  }
  return allOk;
}

/** Stáhne obrázky, na které data odkazují, ale v zařízení nejsou. Vrací true, pokud nějaký přibyl. */
async function downloadMissingImages(): Promise<boolean> {
  const ids = findMissingImageIds();
  if (ids.length === 0) return false;
  const userId = await currentUserId();
  let added = false;
  for (const id of ids) {
    if (await loadBlobFromDisk(id)) {
      added = true;
      continue;
    }
    const { data, error } = await supabase.storage.from(PHOTO_BUCKET).download(`${userId}/${id}`);
    if (error || !data) continue; // soubor ještě nemusí být nahraný z druhého zařízení; zkusí se příště
    try {
      await storeDownloadedBlob(id, await blobToDataUrl(data));
      added = true;
    } catch (err) {
      console.warn(`Obrázek ${id} se nepodařilo uložit:`, err);
    }
  }
  return added;
}

const IMAGE_CLEANUP_KEY = 'image_cleanup_at';
const IMAGE_CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000;

/**
 * Úklid obrázků, na které už nic neodkazuje (fotka odebraná ze smlouvy, smazaná smlouva).
 * Běží nejvýš jednou denně, jen když je vše synchronizované. Co se smí smazat, rozhoduje
 * planImageCleanup (jen staré soubory, na které neodkazuje účet ani toto zařízení).
 */
async function cleanupUnusedImages(): Promise<void> {
  const last = Number(window.localStorage.getItem(IMAGE_CLEANUP_KEY) || 0);
  if (Date.now() - last < IMAGE_CLEANUP_INTERVAL_MS) return;
  if (engine.pendingCount() > 0 || pendingUploadCount() > 0) return;

  const userId = await currentUserId();

  // Odkazy podle účtu (databáze) i podle tohoto zařízení – obrázek se maže, jen když chybí v obou
  const { data: remoteRefs, error: refsError } = await supabase.rpc('list_referenced_images');
  if (refsError) throw refsError;
  const referenced = new Set<string>([...((remoteRefs as string[] | null) || []), ...getReferencedImageIds()]);

  const remote: { id: string; createdAt: string }[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data: files, error } = await supabase.storage.from(PHOTO_BUCKET).list(userId, { limit: 1000, offset });
    if (error) throw error;
    for (const f of files || []) remote.push({ id: f.name, createdAt: f.created_at || '' });
    if (!files || files.length < 1000) break;
  }

  const local = await listBlobInfo();
  const plan = planImageCleanup({
    referenced,
    remote,
    localUploaded: local.filter((l) => l.uploaded),
    localIds: local.map((l) => l.id),
  });

  for (const id of plan.reupload) await markBlobForReupload(id);
  for (let i = 0; i < plan.deleteRemote.length; i += 100) {
    const { error } = await supabase.storage
      .from(PHOTO_BUCKET)
      .remove(plan.deleteRemote.slice(i, i + 100).map((id) => `${userId}/${id}`));
    if (error) throw error;
  }
  await deleteLocalBlobs(plan.deleteLocal);

  window.localStorage.setItem(IMAGE_CLEANUP_KEY, String(Date.now()));
  if (plan.reupload.length > 0) window.setTimeout(() => void syncNow(), 0);
}

/**
 * Příprava po startu aplikace: načte obrázky do paměti a převede data ze starší verze
 * (obrázky přímo v localStorage) na odkazy. Volá se před prvním čtením dat.
 */
let prepared: Promise<void> | null = null;

export function prepareLocalData(): Promise<void> {
  if (!prepared) {
    prepared = (async () => {
      await preloadBlobs();
      await migrateInlineImages();
    })().catch((err) => {
      console.warn('Příprava lokálních dat se nezdařila:', err);
    });
  }
  return prepared;
}

export const CLOUD_DATA_CHANGED_EVENT = 'app:cloud_data_changed';

export interface CloudSyncStatus {
  phase: 'idle' | 'syncing' | 'error';
  /** Čas poslední úspěšné synchronizace (ISO) */
  lastSyncAt: string | null;
  /** Počet změn čekajících na odeslání */
  pending: number;
}

let status: CloudSyncStatus = { phase: 'idle', lastSyncAt: null, pending: engine.pendingCount() + pendingUploadCount() };
const listeners = new Set<(s: CloudSyncStatus) => void>();

function setStatus(patch: Partial<CloudSyncStatus>) {
  status = { ...status, ...patch, pending: engine.pendingCount() + pendingUploadCount() };
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
      await prepareLocalData();
      if (!engine.getState().userId) return false;
      setStatus({ phase: 'syncing' });
      let imagesOk = true;
      do {
        rerun = false;
        // Nejdřív obrázky, pak záznamy, které na ně odkazují – druhé zařízení tak obrázek najde
        imagesOk = await uploadPendingImages();
        await engine.push();
        let changed = await engine.pull();
        // Záznamy ze zařízení se starší verzí mohou mít obrázky ještě přímo v datech
        if (changed && (await migrateInlineImages())) rerun = true;
        if (await downloadMissingImages()) changed = true;
        if (changed) notifyDataChanged();
      } while (rerun);
      if (!imagesOk) {
        setStatus({ phase: 'error' });
        return false;
      }
      setStatus({ phase: 'idle', lastSyncAt: new Date().toISOString() });
      // Úklid nepoužívaných obrázků nesmí synchronizaci shodit; při chybě se zkusí příště
      cleanupUnusedImages().catch((err) => console.warn('Úklid nepoužívaných obrázků se nezdařil:', err));
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
  // Stav se oznámí až po dokončení právě probíhajícího vykreslení (zápis může přijít i během něj)
  queueMicrotask(() => setStatus({}));
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
  await prepareLocalData();
  // V prohlížeči zůstala data jiného účtu: jeho obrázky se smažou stejně jako ostatní data
  const previousUser = engine.getState().userId;
  if (previousUser && previousUser !== userId) await clearAllBlobs();
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
  const pending = engine.pendingCount() + pendingUploadCount();
  if (pending > 0) {
    const ok = window.confirm(
      `Některé změny (${pending}) se ještě nepodařilo uložit do účtu, nejspíš kvůli připojení k internetu. ` +
        'Pokud se odhlásíte teď, tyto změny se ztratí. Opravdu se chcete odhlásit?'
    );
    if (!ok) return false;
  }
  await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
  engine.clearLocal();
  await clearAllBlobs();
  window.localStorage.removeItem('last_cloud_sync');
  window.localStorage.removeItem(IMAGE_CLEANUP_KEY);
  window.location.reload();
  return true;
}

export type DeleteAccountResult = 'deleted' | 'wrong_password' | 'failed';

/**
 * Nenávratně smaže účet se všemi daty: soubory obrázků, záznamy v databázi i data v tomto zařízení.
 * Před smazáním se ověří heslo. Při chybě zůstává účet beze změny (nebo jen bez části obrázků).
 */
export async function deleteAccount(email: string, password: string): Promise<DeleteAccountResult> {
  window.clearTimeout(pushTimer);

  const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
  if (authError) {
    const wrong = authError.code === 'invalid_credentials' || /invalid login credentials/i.test(authError.message);
    return wrong ? 'wrong_password' : 'failed';
  }

  try {
    const userId = await currentUserId();

    // 1. Soubory obrázků ve složce uživatele (po dávkách, dokud nějaké zbývají)
    for (;;) {
      const { data: files, error } = await supabase.storage.from(PHOTO_BUCKET).list(userId, { limit: 100 });
      if (error) throw error;
      if (!files || files.length === 0) break;
      const { error: removeError } = await supabase.storage
        .from(PHOTO_BUCKET)
        .remove(files.map((f) => `${userId}/${f.name}`));
      if (removeError) throw removeError;
    }

    // 2. Účet a všechny záznamy v databázi
    const { error: rpcError } = await supabase.rpc('delete_own_account');
    if (rpcError) throw rpcError;
  } catch (err) {
    console.error('Smazání účtu se nezdařilo:', err);
    return 'failed';
  }

  // 3. Data v tomto zařízení
  await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
  engine.clearLocal();
  await clearAllBlobs();
  window.localStorage.removeItem('last_cloud_sync');
  window.localStorage.removeItem(IMAGE_CLEANUP_KEY);
  window.location.reload();
  return 'deleted';
}
