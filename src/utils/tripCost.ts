import { LogbookTrip } from '../types/contract';

/**
 * Náhrada za jízdu v Kč. Záznamy z knihy jízd mají částku uloženou (`totalCost`); starší nebo neúplný záznam
 * (třeba z importu zálohy) ji dopočítá ze vzdálenosti a sazby, aby se v součtech neobjevilo „NaN“.
 */
export function getTripCost(trip: Partial<Pick<LogbookTrip, 'totalCost' | 'distanceKm' | 'ratePerKm'>>): number {
  const saved = Number(trip.totalCost);
  if (Number.isFinite(saved)) return saved;
  const computed = (Number(trip.distanceKm) || 0) * (Number(trip.ratePerKm) || 0);
  return Math.round(computed * 100) / 100;
}
