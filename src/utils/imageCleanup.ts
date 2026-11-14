/**
 * Úklid obrázků, na které už žádná data neodkazují (fotka byla ze smlouvy odebrána, smlouva smazána).
 * Tento soubor jen rozhoduje, co smazat; nezávisí na prohlížeči ani na Supabase (kvůli testům).
 *
 * Mazání je záměrně opatrné – chybné smazání by znamenalo ztrátu fotky:
 * - maže se jen obrázek, na který neodkazuje žádný záznam v tomto zařízení, a to až po úspěšné synchronizaci,
 *   kdy zařízení zná aktuální stav účtu,
 * - obrázek musí být starší než MIN_AGE_DAYS. Jiné zařízení totiž nahrává nejdřív obrázek a teprve pak záznam,
 *   který na něj odkazuje; čerstvý „osiřelý“ obrázek tak může být jen na cestě,
 * - obrázek, na který data odkazují, ale v účtu chybí, se z tohoto zařízení nahraje znovu.
 */

export const IMAGE_CLEANUP_MIN_AGE_DAYS = 30;

export interface StoredImageInfo {
  id: string;
  /** ISO čas vytvoření / nahrání */
  createdAt: string;
}

export interface ImageCleanupPlan {
  /** Soubory v účtu ke smazání */
  deleteRemote: string[];
  /** Obrázky v tomto zařízení ke smazání */
  deleteLocal: string[];
  /** Obrázky, které v účtu chybí a toto zařízení je má – nahrát znovu */
  reupload: string[];
}

function isOlderThan(createdAt: string, now: Date, minAgeDays: number): boolean {
  const created = new Date(createdAt).getTime();
  // Neznámé stáří bereme jako čerstvé – raději nemazat
  if (!Number.isFinite(created)) return false;
  return now.getTime() - created > minAgeDays * 86_400_000;
}

export function planImageCleanup(input: {
  /** Id obrázků, na které odkazují data v tomto zařízení */
  referenced: Iterable<string>;
  /** Soubory uživatele v účtu */
  remote: StoredImageInfo[];
  /** Obrázky v tomto zařízení, které už jsou nahrané v účtu */
  localUploaded: StoredImageInfo[];
  /** Id všech obrázků, které toto zařízení má (nahrané i čekající) */
  localIds: Iterable<string>;
  now?: Date;
  minAgeDays?: number;
}): ImageCleanupPlan {
  const now = input.now ?? new Date();
  const minAgeDays = input.minAgeDays ?? IMAGE_CLEANUP_MIN_AGE_DAYS;
  const referenced = new Set(input.referenced);
  const remoteIds = new Set(input.remote.map((r) => r.id));
  const localIds = new Set(input.localIds);

  const deleteRemote = input.remote
    .filter((r) => !referenced.has(r.id) && isOlderThan(r.createdAt, now, minAgeDays))
    .map((r) => r.id);

  const deleteLocal = input.localUploaded
    .filter((l) => !referenced.has(l.id) && isOlderThan(l.createdAt, now, minAgeDays))
    .map((l) => l.id);

  const reupload = [...referenced].filter((id) => !remoteIds.has(id) && localIds.has(id));

  return { deleteRemote, deleteLocal, reupload };
}
