import { formatCurrency, formatDateCs } from './numberToWordsCs';

export type ReminderTone = 'friendly' | 'standard' | 'urgent';

export interface ReminderInput {
  invoiceNumber: string;
  amount: number;
  dueDate: string; // YYYY-MM-DD
  /** Kladné = dní po splatnosti */
  daysPastDue: number;
  variableSymbol: string;
  scope: string;
  contractorName?: string;
  bankAccount?: string;
}

export function daysWordCs(n: number): string {
  const abs = Math.abs(n);
  return abs === 1 ? 'den' : abs >= 2 && abs <= 4 ? 'dny' : 'dní';
}

/** Text upomínky. U faktury před splatností jde jen o připomenutí – o prodlení se v něm nemluví. */
export function buildReminderText(input: ReminderInput, tone: ReminderTone): string {
  const name = input.contractorName || 'Váš dodavatel';
  const payment = `Číslo účtu: ${input.bankAccount || 'dle faktury'}, VS: ${input.variableSymbol}.`;
  const amount = formatCurrency(input.amount);
  const due = formatDateCs(input.dueDate);
  const overdue = input.daysPastDue > 0;

  if (!overdue) {
    return `Dobrý den, připomínám fakturu ${input.invoiceNumber} na částku ${amount} za dílo „${input.scope}“. Splatnost je ${due}. ${payment} Děkuji a přeji hezký den, ${name}.`;
  }
  const late = `${input.daysPastDue} ${daysWordCs(input.daysPastDue)} po splatnosti`;
  if (tone === 'friendly') {
    return `Dobrý den, posílám jen přátelské připomenutí faktury ${input.invoiceNumber} na částku ${amount} za dílo „${input.scope}“. Splatnost byla ${due}. ${payment} Děkuji a přeji hezký den, ${name}.`;
  }
  if (tone === 'standard') {
    return `Dobrý den, dovoluji si Vás upozornit, že faktura ${input.invoiceNumber} na částku ${amount} je ${late} (termín byl ${due}). Prosím o kontrolu a úhradu. ${payment} V případě nejasností mě neváhejte kontaktovat. S pozdravem, ${name}.`;
  }
  return `Dobrý den, k dnešnímu dni evidujeme neuhrazenou fakturu ${input.invoiceNumber} ve výši ${amount}, splatnou ${due} (${late}). Žádám o okamžitou úhradu. ${payment} V opačném případě bude pohledávka postoupena k vymáhání. ${name}.`;
}
