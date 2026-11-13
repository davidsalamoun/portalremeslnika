import { ContractorProfile, Client, Contract } from '../types/contract';
import { trackLocalChange } from './cloudSync';
import { parseWithImages, stringifyWithRefs, collectInlineImages, collectImageRefs } from './imageRefs';
import { getBlob, hasBlob, putBlob, putBlobDurable, isBlobStoreReady } from './blobStore';

// Zápis do localStorage, o kterém se dozví synchronizace s účtem
function setItemTracked(key: string, value: string): void {
  const previous = localStorage.getItem(key);
  localStorage.setItem(key, value);
  trackLocalChange(key, previous, value);
}

// Obrázky (fotky, účtenky, podpisy) se ukládají zvlášť; v localStorage je místo nich odkaz "@img:<id>".
// Při čtení se obrázek dosadí zpět, takže aplikace dál pracuje s běžnými data URL.
function parseStored(raw: string): any {
  return parseWithImages(raw, getBlob);
}

function serializeForStorage(value: unknown): string {
  return stringifyWithRefs(value, putBlob);
}

const IMAGE_BEARING_KEYS = ['zhotovitel', 'klienti', 'smlouvy', 'remeslnik_cenik', 'remeslnik_kalendar'];

/**
 * Převede data ze starší verze (obrázky přímo v localStorage) na odkazy. Obrázek se z localStorage
 * odstraní až poté, co je bezpečně zapsaný na disku. Vrací true, pokud se něco převedlo.
 */
export async function migrateInlineImages(): Promise<boolean> {
  if (!isBlobStoreReady()) return false;
  let migrated = false;
  for (const key of IMAGE_BEARING_KEYS) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const images = collectInlineImages(raw);
      if (images.length === 0) continue;
      for (const dataUrl of images) await putBlobDurable(dataUrl);
      // Znovu načíst – data se během čekání mohla změnit
      const current = localStorage.getItem(key);
      if (!current) continue;
      setItemTracked(key, serializeForStorage(JSON.parse(current)));
      migrated = true;
    } catch (e) {
      console.warn(`Převod obrázků (${key}) se nezdařil, data zůstávají v původní podobě:`, e);
    }
  }
  return migrated;
}

/** Id obrázků, na které data odkazují, ale v tomto zařízení zatím nejsou (je třeba je stáhnout z účtu). */
export function findMissingImageIds(): string[] {
  const missing = new Set<string>();
  for (const key of IMAGE_BEARING_KEYS) {
    const raw = localStorage.getItem(key);
    if (!raw) continue;
    for (const id of collectImageRefs(raw)) if (!hasBlob(id)) missing.add(id);
  }
  return [...missing];
}

const STORAGE_KEYS = {
  ZHOTOVITEL: 'zhotovitel',
  KLIENTI: 'klienti',
  SMLOUVY: 'smlouvy',
} as const;

function notifyStorageError(action: string, error: any) {
  console.error(`Chyba při ukládání (${action}):`, error);
  if (typeof window !== 'undefined') {
    const isQuota =
      error?.name === 'QuotaExceededError' ||
      error?.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
      error?.code === 22 ||
      error?.code === 1014;
    const msg = isQuota
      ? 'Paměť prohlížeče je plná (např. kvůli fotografiím). Doporučujeme stáhnout zálohu v Nastavení a uvolnit místo.'
      : `Chyba při ukládání dat (${action}). Zkontrolujte volné místo v prohlížeči.`;
    window.dispatchEvent(
      new CustomEvent('app:storage_error', {
        detail: { message: msg, isQuota },
      })
    );
  }
}

// Zhotovitel (Moje údaje)
export function getContractorProfile(): ContractorProfile | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.ZHOTOVITEL);
    if (!raw) return null;
    return parseStored(raw);
  } catch (e) {
    console.error('Chyba při načítání zhotovitele z localStorage', e);
    return null;
  }
}

export function saveContractorProfile(profile: ContractorProfile): void {
  try {
    setItemTracked(STORAGE_KEYS.ZHOTOVITEL, serializeForStorage(profile));
  } catch (e) {
    notifyStorageError('profil zhotovitele', e);
  }
}

// Klienti
export function getStoredClients(): Client[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.KLIENTI);
    if (!raw) return [];
    return parseStored(raw);
  } catch (e) {
    console.error('Chyba při načítání klientů z localStorage', e);
    return [];
  }
}

export function saveStoredClients(clients: Client[]): void {
  try {
    setItemTracked(STORAGE_KEYS.KLIENTI, serializeForStorage(clients));
  } catch (e) {
    notifyStorageError('klienti', e);
  }
}

export function addStoredClient(clientData: Omit<Client, 'id' | 'createdAt'>): Client {
  const clients = getStoredClients();
  const newClient: Client = {
    ...clientData,
    id: `client_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    createdAt: new Date().toISOString(),
  };
  clients.unshift(newClient);
  saveStoredClients(clients);
  return newClient;
}

export function updateStoredClient(updated: Client): void {
  const clients = getStoredClients();
  const index = clients.findIndex((c) => c.id === updated.id);
  if (index !== -1) {
    clients[index] = updated;
    saveStoredClients(clients);
  }
}

export function deleteStoredClient(id: string): void {
  const clients = getStoredClients().filter((c) => c.id !== id);
  saveStoredClients(clients);
}

// Smlouvy (Historie)
export function getStoredContracts(): Contract[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SMLOUVY);
    if (!raw) return [];
    return parseStored(raw);
  } catch (e) {
    console.error('Chyba při načítání smluv z localStorage', e);
    return [];
  }
}

export function saveStoredContracts(contracts: Contract[]): void {
  try {
    setItemTracked(STORAGE_KEYS.SMLOUVY, serializeForStorage(contracts));
  } catch (e) {
    notifyStorageError('smlouvy', e);
  }
}

export function addStoredContract(contract: Contract): void {
  const contracts = getStoredContracts();
  // Kontrola, zda již neexistuje se stejným ID
  const existingIndex = contracts.findIndex((c) => c.id === contract.id);
  if (existingIndex >= 0) {
    contracts[existingIndex] = contract;
  } else {
    contracts.unshift(contract);
  }
  saveStoredContracts(contracts);
}

export function updateStoredContract(updated: Contract): void {
  addStoredContract(updated);
}

export function deleteStoredContract(id: string): void {
  const contracts = getStoredContracts().filter((c) => c.id !== id);
  saveStoredContracts(contracts);
}

/**
 * Volitelná pomocná funkce pro načtení zkušebních dat (řemeslník, vzorový klient)
 */
export function seedSampleData(): { contractor: ContractorProfile; client: Client } {
  const sampleContractor: ContractorProfile = {
    name: 'Jan Novák – Řemeslné a obkladačské práce',
    ico: '12345678',
    dic: 'CZ8503120000',
    address: 'Květinová 124/8, 140 00 Praha 4',
    bankAccount: '19-2345670237/0100',
    phone: '+420 777 123 456',
    email: 'novak.remesla@email.cz',
    defaultPlace: 'Praze',
  };

  const sampleClient: Client = {
    id: `client_${Date.now()}`,
    name: 'Marek Dvořák',
    ico: '',
    address: 'Slunečná 45, 252 28 Černošice',
    email: 'marek.dvorak@seznam.cz',
    phone: '+420 608 987 654',
    createdAt: new Date().toISOString(),
  };

  saveContractorProfile(sampleContractor);
  const clients = getStoredClients();
  if (!clients.some((c) => c.name === sampleClient.name)) {
    clients.push(sampleClient);
    saveStoredClients(clients);
  }

  return { contractor: sampleContractor, client: sampleClient };
}

// Výchozí ceník pro české živnostníky
export const DEFAULT_PRICE_LIST_ITEMS: Omit<import('../types/contract').PriceListTemplateItem, 'id'>[] = [
  // Práce
  { category: 'Hodinové sazby & Doprava', type: 'prace', title: 'Hodinová sazba řemeslníka', unit: 'hod', unitPrice: 550, description: 'Běžné montážní a servisní práce' },
  { category: 'Hodinové sazby & Doprava', type: 'prace', title: 'Havarijní výjezd / víkendový příplatek', unit: 'hod', unitPrice: 850, description: 'Práce mimo běžnou pracovní dobu' },
  { category: 'Hodinové sazby & Doprava', type: 'ostatni', title: 'Doprava na stavbu', unit: 'km', unitPrice: 12, description: 'Paušální sazba za km tam i zpět' },
  { category: 'Obklady & Dlažby', type: 'prace', title: 'Pokládka keramického obkladu / dlažby', unit: 'm²', unitPrice: 650, description: 'Standardní formát do 60x60 cm' },
  { category: 'Obklady & Dlažby', type: 'prace', title: 'Pokládka velkoformátové dlažby', unit: 'm²', unitPrice: 950, description: 'Formáty nad 60x120 cm včetně manipulace' },
  { category: 'Obklady & Dlažby', type: 'prace', title: 'Penetrace podkladu', unit: 'm²', unitPrice: 40, description: 'Hloubková penetrace podlah a stěn' },
  { category: 'Obklady & Dlažby', type: 'prace', title: 'Dvousložková hydroizolace včetně pásek', unit: 'm²', unitPrice: 140, description: '2x vrstva hydroizolační stěrky' },
  { category: 'Obklady & Dlažby', type: 'prace', title: 'Spárování a silikonování koutů', unit: 'bm', unitPrice: 65, description: 'Elastické silikonování styčných spár' },
  { category: 'Sádrokartony', type: 'prace', title: 'Montáž SDK příčky (jednoduché opláštění)', unit: 'm²', unitPrice: 480, description: 'Konstrukce CW/UW včetně minerální izolace' },
  { category: 'Sádrokartony', type: 'prace', title: 'Montáž SDK podhledu', unit: 'm²', unitPrice: 520, description: 'Závěsný rošt CD/UD s deskou RB 12.5mm' },
  { category: 'Sádrokartony', type: 'prace', title: 'Tmelení a broušení spár (stupeň Q2-Q3)', unit: 'm²', unitPrice: 95, description: 'Tmelení s výztužnou páskou a přebroušení' },
  { category: 'Elektroinstalace', type: 'prace', title: 'Vysekání drážky ve zdivu pro kabel', unit: 'bm', unitPrice: 110, description: 'Drážkování ve vápennocementové omítce/cihle' },
  { category: 'Elektroinstalace', type: 'prace', title: 'Osazení a zapojení zásuvky / vypínače', unit: 'ks', unitPrice: 160, description: 'Kompletace v krabici KU68' },
  { category: 'Elektroinstalace', type: 'prace', title: 'Zapojení a kompletace rozvaděče', unit: 'kpl', unitPrice: 3500, description: 'Osazení jističů, chráničů a popis okruhů' },
  { category: 'Instalatérské práce', type: 'prace', title: 'Montáž a zapojení závěsného WC (Geberit)', unit: 'ks', unitPrice: 1800, description: 'Kotvení modulu a napojení na odpad DN100' },
  { category: 'Instalatérské práce', type: 'prace', title: 'Montáž umyvadlové / vanové baterie', unit: 'ks', unitPrice: 550, description: 'Osazení baterie a tlakové propojení roháčků' },
  { category: 'Instalatérské práce', type: 'prace', title: 'Rozvody vody v plastu (PPR) - 1 vývod', unit: 'ks', unitPrice: 750, description: 'Přivedení teplé a studené vody k zařizovacímu předmětu' },
  { category: 'Malířské práce', type: 'prace', title: 'Malování bílé 2x nátěr (např. Primalex Plus)', unit: 'm²', unitPrice: 65, description: 'Včetně zakrytí podlah a oken fólií' },
  { category: 'Malířské práce', type: 'prace', title: 'Škrábání staré nesoudržné malby', unit: 'm²', unitPrice: 45, description: 'Odstranění starých vrstev ze zdiva' },
  // Materiál
  { category: 'Stavební materiály', type: 'material', title: 'Flexibilní lepidlo C2TE S1 (25 kg)', unit: 'bal', unitPrice: 340, description: 'Vysoce flexibilní cementové lepidlo' },
  { category: 'Stavební materiály', type: 'material', title: 'Spárovací hmota vodoodpudivá (5 kg)', unit: 'bal', unitPrice: 280, description: 'Pro interiér i exteriér' },
  { category: 'Stavební materiály', type: 'material', title: 'Hloubkový penetrační nátěr (5 l)', unit: 'bal', unitPrice: 320, description: 'Sjednocení savosti podkladu' },
  { category: 'Stavební materiály', type: 'material', title: 'Sádrokartonová deska RB 12.5mm (2x1.25m)', unit: 'ks', unitPrice: 210, description: 'Běžná bílá stavební SDK deska' },
  { category: 'Stavební materiály', type: 'material', title: 'Kabel CYKY-J 3x1.5 (100m klubko)', unit: 'bal', unitPrice: 1450, description: 'Kabel pro světelné okruhy' },
  { category: 'Stavební materiály', type: 'material', title: 'Kabel CYKY-J 3x2.5 (100m klubko)', unit: 'bal', unitPrice: 2250, description: 'Kabel pro zásuvkové okruhy' },
];

export function getStoredPriceList(): import('../types/contract').PriceListTemplateItem[] {
  try {
    const raw = localStorage.getItem('remeslnik_cenik');
    if (!raw) {
      // Inicializace výchozího ceníku
      const defaults = DEFAULT_PRICE_LIST_ITEMS.map((item, idx) => ({
        ...item,
        id: `pl_${idx + 1}_${Date.now()}`,
      }));
      saveStoredPriceList(defaults);
      return defaults;
    }
    return parseStored(raw);
  } catch (e) {
    console.error('Chyba při načítání ceníku', e);
    return [];
  }
}

export function saveStoredPriceList(items: import('../types/contract').PriceListTemplateItem[]): void {
  try {
    setItemTracked('remeslnik_cenik', serializeForStorage(items));
  } catch (e) {
    console.error('Chyba při ukládání ceníku', e);
  }
}

// Kalendář řemeslníka
export function getStoredCalendarEvents(): import('../types/contract').CalendarEvent[] {
  try {
    const raw = localStorage.getItem('remeslnik_kalendar');
    if (!raw) return [];
    return parseStored(raw);
  } catch (e) {
    console.error('Chyba při načítání událostí kalendáře', e);
    return [];
  }
}

export function saveStoredCalendarEvents(events: import('../types/contract').CalendarEvent[]): void {
  try {
    setItemTracked('remeslnik_kalendar', serializeForStorage(events));
  } catch (e) {
    console.error('Chyba při ukládání událostí kalendáře', e);
  }
}

export function addStoredCalendarEvent(eventData: Omit<import('../types/contract').CalendarEvent, 'id' | 'createdAt'>): import('../types/contract').CalendarEvent {
  const events = getStoredCalendarEvents();
  const newEvent: import('../types/contract').CalendarEvent = {
    ...eventData,
    id: `event_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    createdAt: new Date().toISOString(),
  };
  events.push(newEvent);
  saveStoredCalendarEvents(events);
  return newEvent;
}

export function updateStoredCalendarEvent(updated: import('../types/contract').CalendarEvent): void {
  const events = getStoredCalendarEvents();
  const idx = events.findIndex((e) => e.id === updated.id);
  if (idx >= 0) {
    events[idx] = updated;
    saveStoredCalendarEvents(events);
  }
}

export function deleteStoredCalendarEvent(id: string): void {
  const events = getStoredCalendarEvents().filter((e) => e.id !== id);
  saveStoredCalendarEvents(events);
}

