import { imageIdFor } from './imageRefs';

/**
 * Úložiště obrázků v prohlížeči (IndexedDB – řádově stovky MB, na rozdíl od ~5 MB v localStorage).
 * Obrázky se po startu načtou do paměti, aby je šlo při čtení dat dosazovat okamžitě.
 */

const DB_NAME = 'portal-zivnostnika';
const STORE = 'images';

interface StoredImage {
  id: string;
  dataUrl: string;
  /** 1 = soubor je nahraný v účtu */
  uploaded: 0 | 1;
  createdAt: string;
}

const memory = new Map<string, string>();
const pendingUploads = new Set<string>();
let db: IDBDatabase | null = null;
let ready = false;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE, { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('IndexedDB je blokovaná jiným oknem'));
  });
}

function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    if (!db) return reject(new Error('Úložiště obrázků není dostupné'));
    const t = db.transaction(STORE, mode);
    const req = run(t.objectStore(STORE));
    t.oncomplete = () => resolve(req ? (req.result as T) : undefined);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error || new Error('Zápis obrázku byl přerušen'));
  });
}

function reportWriteError(err: unknown) {
  console.error('Obrázek se nepodařilo uložit do zařízení:', err);
  window.dispatchEvent(
    new CustomEvent('app:storage_error', {
      detail: {
        message:
          'Fotku se nepodařilo uložit do paměti zařízení. Zkontrolujte volné místo a nezavírejte aplikaci, dokud se neuloží do účtu.',
        isQuota: false,
      },
    })
  );
}

/** Načte obrázky do paměti. Bez IndexedDB (např. některé anonymní režimy) zůstanou obrázky přímo v datech. */
export async function preloadBlobs(): Promise<void> {
  if (ready) return;
  try {
    db = await openDb();
    const all = (await tx<StoredImage[]>('readonly', (s) => s.getAll())) || [];
    for (const item of all) {
      memory.set(item.id, item.dataUrl);
      if (!item.uploaded) pendingUploads.add(item.id);
    }
    ready = true;
  } catch (err) {
    console.warn('IndexedDB není dostupná, obrázky zůstanou uložené přímo v datech:', err);
    db = null;
    ready = false;
  }
}

export function isBlobStoreReady(): boolean {
  return ready;
}

export function getBlob(id: string): string | undefined {
  return memory.get(id);
}

export function hasBlob(id: string): boolean {
  return memory.has(id);
}

/**
 * Uloží obrázek a vrátí jeho id. Zápis na disk doběhne na pozadí.
 * Vrací null, pokud úložiště není dostupné – obrázek pak musí zůstat přímo v datech.
 */
export function putBlob(dataUrl: string): string | null {
  if (!ready) return null;
  const id = imageIdFor(dataUrl);
  if (memory.has(id)) return id;
  memory.set(id, dataUrl);
  pendingUploads.add(id);
  const record: StoredImage = { id, dataUrl, uploaded: 0, createdAt: new Date().toISOString() };
  tx('readwrite', (s) => s.put(record)).catch(reportWriteError);
  return id;
}

/** Jako putBlob, ale počká na dokončení zápisu na disk (pro převod starších dat). */
export async function putBlobDurable(dataUrl: string): Promise<string> {
  if (!ready) throw new Error('Úložiště obrázků není dostupné');
  const id = imageIdFor(dataUrl);
  if (!memory.has(id)) {
    const record: StoredImage = { id, dataUrl, uploaded: 0, createdAt: new Date().toISOString() };
    await tx('readwrite', (s) => s.put(record));
    memory.set(id, dataUrl);
    pendingUploads.add(id);
  }
  return id;
}

/** Uloží obrázek stažený z účtu (už je nahraný, znovu se neodesílá). */
export async function storeDownloadedBlob(id: string, dataUrl: string): Promise<void> {
  memory.set(id, dataUrl);
  if (!ready) return;
  const record: StoredImage = { id, dataUrl, uploaded: 1, createdAt: new Date().toISOString() };
  await tx('readwrite', (s) => s.put(record)).catch(reportWriteError);
}

/** Zkusí obrázek najít na disku (mohlo ho uložit jiné okno aplikace). */
export async function loadBlobFromDisk(id: string): Promise<boolean> {
  if (!ready) return false;
  try {
    const item = await tx<StoredImage | undefined>('readonly', (s) => s.get(id));
    if (!item) return false;
    memory.set(item.id, item.dataUrl);
    if (!item.uploaded) pendingUploads.add(item.id);
    return true;
  } catch {
    return false;
  }
}

export function getPendingUploadIds(): string[] {
  return [...pendingUploads];
}

export function pendingUploadCount(): number {
  return pendingUploads.size;
}

export async function markBlobUploaded(id: string): Promise<void> {
  pendingUploads.delete(id);
  const dataUrl = memory.get(id);
  if (!ready || dataUrl === undefined) return;
  const record: StoredImage = { id, dataUrl, uploaded: 1, createdAt: new Date().toISOString() };
  await tx('readwrite', (s) => s.put(record)).catch((err) => console.warn('Stav obrázku se nepodařilo uložit:', err));
}

/** Smaže všechny obrázky z tohoto zařízení (odhlášení, změna účtu). */
export async function clearAllBlobs(): Promise<void> {
  memory.clear();
  pendingUploads.clear();
  if (!ready) return;
  await tx('readwrite', (s) => s.clear()).catch((err) => console.warn('Obrázky se nepodařilo smazat:', err));
}

/** Přehled obrázků v zařízení pro úklid: které jsou nahrané v účtu a jak jsou staré. */
export async function listBlobInfo(): Promise<{ id: string; createdAt: string; uploaded: boolean }[]> {
  if (!ready) return [];
  const all = (await tx<StoredImage[]>('readonly', (s) => s.getAll())) || [];
  return all.map((item) => ({ id: item.id, createdAt: item.createdAt, uploaded: !!item.uploaded }));
}

/** Smaže z tohoto zařízení obrázky, na které už nic neodkazuje. */
export async function deleteLocalBlobs(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  for (const id of ids) {
    memory.delete(id);
    pendingUploads.delete(id);
  }
  if (!ready) return;
  await new Promise<void>((resolve, reject) => {
    if (!db) return resolve();
    const t = db.transaction(STORE, 'readwrite');
    const store = t.objectStore(STORE);
    ids.forEach((id) => store.delete(id));
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  }).catch((err) => console.warn('Nepoužívané obrázky se nepodařilo smazat ze zařízení:', err));
}

/** Označí obrázek k opětovnému nahrání (v účtu chybí, i když na něj data odkazují). */
export async function markBlobForReupload(id: string): Promise<void> {
  const dataUrl = memory.get(id);
  if (dataUrl === undefined) return;
  pendingUploads.add(id);
  if (!ready) return;
  const record: StoredImage = { id, dataUrl, uploaded: 0, createdAt: new Date().toISOString() };
  await tx('readwrite', (s) => s.put(record)).catch((err) => console.warn('Stav obrázku se nepodařilo uložit:', err));
}
