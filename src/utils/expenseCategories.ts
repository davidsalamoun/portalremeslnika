import type { ExpenseCategory } from '../types/contract';

// Názvy druhů výdajů (okno Náklady a zisk, podklady pro účetní)
export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  material: 'Materiál',
  tools: 'Nářadí a půjčovna',
  subcontractor: 'Subdodávky',
  travel: 'Doprava',
  other: 'Ostatní',
};

export const expenseCategoryLabel = (category: string): string =>
  EXPENSE_CATEGORY_LABELS[category as ExpenseCategory] ?? category;
