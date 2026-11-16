/**
 * Hranice obratu pro DPH a pásma paušální daně (stav pro roky 2025 a 2026). Aplikace podle nich jen ukazuje,
 * kde se řemeslník nachází – obrat počítá z cen smluv, ne ze skutečných plateb, takže výsledek je orientační.
 */

/** Po překročení v kalendářním roce se podnikatel stává plátcem DPH od 1. ledna následujícího roku. */
export const VAT_LIMIT = 2_000_000;
/** Po překročení se stává plátcem hned následující den. */
export const VAT_LIMIT_IMMEDIATE = 2_536_500;

export type VatRegistration = 'below' | 'next_year' | 'immediate';

export function getVatRegistration(turnover: number): VatRegistration {
  if (turnover > VAT_LIMIT_IMMEDIATE) return 'immediate';
  if (turnover > VAT_LIMIT) return 'next_year';
  return 'below';
}

/** Výdajový paušál, který lze uplatnit na převážnou část (aspoň 75 %) příjmů. */
export type ExpenseFlatRate = 80 | 60 | 40;

/** Horní hranice příjmů 1., 2. a 3. pásma paušální daně podle výdajového paušálu. */
export const FLAT_TAX_BAND_LIMITS: Record<ExpenseFlatRate, [number, number, number]> = {
  80: [2_000_000, 2_000_000, 2_000_000],
  60: [1_500_000, 2_000_000, 2_000_000],
  40: [1_000_000, 1_500_000, 2_000_000],
};

/** Nejnižší pásmo paušální daně, do kterého se příjmy vejdou; null = nad 2 mil. Kč paušální režim nejde. */
export function getFlatTaxBand(income: number, flatRate: ExpenseFlatRate): 1 | 2 | 3 | null {
  const index = FLAT_TAX_BAND_LIMITS[flatRate].findIndex((limit) => income <= limit);
  return index === -1 ? null : ((index + 1) as 1 | 2 | 3);
}
