import { Contract } from '../types/contract';

/**
 * Jednotná pravidla pro částky a data faktur. Používá je doklad faktury, přehled pohledávek, přehled na
 * úvodní stránce, počítadlo faktur po splatnosti i export pro účetní – aby všude vycházela stejná čísla.
 */

/** Splatnost faktury ve dnech od vystavení (smlouva: doplatek splatný do 14 dnů po předání díla). */
export const INVOICE_DUE_DAYS = 14;

export function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Přičte dny k datu YYYY-MM-DD (bez vlivu časových pásem a letního času). */
export function addDaysIso(iso: string, days: number): string {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  const date = new Date(Date.UTC(y, (m || 1) - 1, d || 1));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Počet dní mezi dvěma daty YYYY-MM-DD (b − a). */
export function daysBetweenIso(a: string, b: string): number {
  const toUtc = (iso: string) => {
    const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
    return Date.UTC(y, (m || 1) - 1, d || 1);
  };
  return Math.round((toUtc(b) - toUtc(a)) / 86_400_000);
}

export function getAmendmentsTotal(contract: Contract): number {
  return (contract.amendments || []).reduce((sum, a) => sum + (a.priceDifference || 0), 0);
}

/** Sjednaná cena díla včetně dodatků (vícepráce i méněpráce). */
export function getContractTotal(contract: Contract): number {
  const itemsTotal = (contract.items || []).reduce(
    (sum, item) => sum + (item.totalPrice || item.unitPrice * item.quantity || 0),
    0
  );
  const base = contract.price > 0 ? contract.price : itemsTotal;
  return Math.max(0, (base || 0) + getAmendmentsTotal(contract));
}

/** Doplatek na konečné faktuře: cena včetně dodatků po odečtení sjednané zálohy. */
export function getFinalBalance(contract: Contract): number {
  return Math.max(0, getContractTotal(contract) - (contract.advanceAmount || 0));
}

export function isContractPaid(contract: Contract): boolean {
  return contract.status === 'paid' || !!contract.paidDate;
}

/** Fakturuje se jen smlouva s cenou – cenová nabídka ani poptávka pohledávkou nejsou. */
export function isInvoiceable(contract: Contract): boolean {
  return contract.docKind !== 'quote' && getContractTotal(contract) > 0;
}

export interface InvoiceDates {
  issueDate: string;
  /** Datum uskutečnění zdanitelného plnění */
  taxDate: string;
  dueDate: string;
}

/**
 * Konečná faktura se vystavuje k předání díla: skutečné datum předání z protokolu, jinak sjednaný termín
 * dokončení. Splatnost je 14 dnů od vystavení.
 */
export function getFinalInvoiceDates(contract: Contract): InvoiceDates {
  const issueDate =
    contract.handoverData?.handoverDate ||
    contract.deliveryDate ||
    contract.conclusionDate ||
    (contract.createdAt || '').slice(0, 10) ||
    todayIso();
  return { issueDate, taxDate: issueDate, dueDate: addDaysIso(issueDate, INVOICE_DUE_DAYS) };
}

/** Zálohová faktura se vystavuje při uzavření smlouvy, splatnost 14 dnů. */
export function getAdvanceInvoiceDates(contract: Contract): InvoiceDates {
  const issueDate = contract.conclusionDate || (contract.createdAt || '').slice(0, 10) || todayIso();
  return { issueDate, taxDate: issueDate, dueDate: addDaysIso(issueDate, INVOICE_DUE_DAYS) };
}

export interface InvoiceStatus {
  isPaid: boolean;
  isOverdue: boolean;
  /** Kladné = dní po splatnosti, záporné = dní do splatnosti */
  daysPastDue: number;
  dueDate: string;
}

export function getInvoiceStatus(contract: Contract, today: string = todayIso()): InvoiceStatus {
  const { dueDate } = getFinalInvoiceDates(contract);
  const isPaid = isContractPaid(contract);
  const daysPastDue = daysBetweenIso(dueDate, today);
  return { isPaid, isOverdue: !isPaid && daysPastDue > 0, daysPastDue, dueDate };
}

/** DPH obsažená v ceně uvedené včetně daně (ceny v aplikaci jsou u plátců včetně DPH). */
export function vatIncludedInGross(gross: number, ratePercent = 21): number {
  return Math.round((gross * ratePercent) / (100 + ratePercent));
}
