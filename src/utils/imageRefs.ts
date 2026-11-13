/**
 * Obrázky (fotky, účtenky, podpisy) se neukládají uvnitř smluv, ale zvlášť. V uložených datech je místo
 * obrázku krátký odkaz "@img:<id>"; při čtení se obrázek dosadí zpět, takže zbytek aplikace pracuje
 * s běžnými data URL jako dřív. Tento soubor nezávisí na prohlížeči (kvůli testům).
 */

export const IMAGE_REF_PREFIX = '@img:';

/** Kratší data URL (ikony apod.) zůstávají přímo v datech. */
const MIN_EXTERNAL_LENGTH = 2048;

const PLACEHOLDER_PREFIX = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' data-ref='";
const PLACEHOLDER_SUFFIX =
  "' width='400' height='300'%3E%3Crect width='400' height='300' fill='%23e2e8f0'/%3E%3C/svg%3E";

/** Zástupný šedý obrázek pro fotku, která se do tohoto zařízení ještě nestáhla. Nese v sobě id fotky. */
export function placeholderFor(id: string): string {
  return `${PLACEHOLDER_PREFIX}${id}${PLACEHOLDER_SUFFIX}`;
}

export function refFromPlaceholder(value: string): string | null {
  if (!value.startsWith(PLACEHOLDER_PREFIX) || !value.endsWith(PLACEHOLDER_SUFFIX)) return null;
  const id = value.slice(PLACEHOLDER_PREFIX.length, value.length - PLACEHOLDER_SUFFIX.length);
  return /^[A-Za-z0-9_]+$/.test(id) ? id : null;
}

export function isExternalizableImage(value: string): boolean {
  return (
    value.length >= MIN_EXTERNAL_LENGTH &&
    /^data:image\/(jpeg|png|webp);base64,/.test(value)
  );
}

/** Id obrázku odvozené z jeho obsahu (stejný obrázek = stejné id, na všech zařízeních). */
export function imageIdFor(dataUrl: string): string {
  // cyrb53 – rychlý 53bitový hash řetězce
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < dataUrl.length; i++) {
    const ch = dataUrl.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const hash = 4294967296 * (2097151 & h2) + (h1 >>> 0);
  return `img_${hash.toString(36)}_${dataUrl.length.toString(36)}`;
}

/**
 * Převede hodnotu na JSON; obrázky nahradí odkazy. `put` obrázek uloží a vrátí jeho id,
 * nebo null, pokud ho uložit nelze – pak obrázek zůstane přímo v datech (nic se neztratí).
 */
export function stringifyWithRefs(value: unknown, put: (dataUrl: string) => string | null): string {
  return JSON.stringify(value, (_key, v) => {
    if (typeof v !== 'string' || v.length < 32) return v;
    const placeholderId = refFromPlaceholder(v);
    if (placeholderId) return IMAGE_REF_PREFIX + placeholderId;
    if (!isExternalizableImage(v)) return v;
    const id = put(v);
    return id ? IMAGE_REF_PREFIX + id : v;
  });
}

/**
 * Načte JSON a odkazy nahradí obrázky. Chybějící obrázek (ještě nestažený) nahradí zástupným
 * a ohlásí přes `onMissing`.
 */
export function parseWithImages(
  raw: string,
  get: (id: string) => string | undefined,
  onMissing?: (id: string) => void
): any {
  return JSON.parse(raw, (_key, v) => {
    if (typeof v !== 'string' || !v.startsWith(IMAGE_REF_PREFIX)) return v;
    const id = v.slice(IMAGE_REF_PREFIX.length);
    const dataUrl = get(id);
    if (dataUrl !== undefined) return dataUrl;
    onMissing?.(id);
    return placeholderFor(id);
  });
}

/** Všechny obrázky uložené přímo v JSON (data ze starší verze aplikace). */
export function collectInlineImages(raw: string): string[] {
  if (!raw.includes('data:image/')) return [];
  const found = new Set<string>();
  JSON.parse(raw, (_key, v) => {
    if (typeof v === 'string' && isExternalizableImage(v)) found.add(v);
    return v;
  });
  return [...found];
}

/** Id všech obrázků, na které JSON odkazuje. */
export function collectImageRefs(raw: string): string[] {
  const ids = new Set<string>();
  const re = /"@img:([A-Za-z0-9_]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw))) ids.add(m[1]);
  return [...ids];
}
