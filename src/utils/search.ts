/** Text pro hledání: malá písmena bez diakritiky („Dvořák“ najde i „dvorak“). */
export function normalizeForSearch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

/**
 * Odpovídá záznam hledanému textu? Každé slovo dotazu musí být v některém z údajů; čísla se porovnávají
 * i bez mezer („602111222“ najde „+420 602 111 222“, „2026007“ najde „SOD-2026-007“ jen s pomlčkami).
 */
export function matchesSearch(fields: (string | null | undefined)[], query: string): boolean {
  const words = normalizeForSearch(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const haystack = normalizeForSearch(fields.filter(Boolean).join(' \u0000 '));
  const compact = haystack.replace(/[\s\-/.]/g, '');
  return words.every((w) => haystack.includes(w) || (/^[\d+\-/.]+$/.test(w) && compact.includes(w.replace(/[\s\-/.]/g, ''))));
}
