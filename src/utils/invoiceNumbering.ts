import { Contract } from '../types/contract';

/**
 * Číslování dokladů. Číslo faktury vzniká až při vystavení (tlačítko „Vystavit fakturu“), ne při založení
 * zakázky: řada tak nemá díry po nabídkách a poptávkách a po smazání zakázky se číslo neopakuje (další číslo je
 * nejvyšší použité v roce + 1, ne počet zakázek). Konečné faktury (FA-) a zálohové faktury (ZAL-) mají každá
 * svou řadu ve tvaru RRRRNNN.
 *
 * Zakázky založené před touto změnou nemají `numbering: 2`: jejich číslo `invoiceNumber` vzniklo při založení,
 * platí dál jako vystavené a zálohová faktura u nich nese stejné číslo (ZAL-<invoiceNumber>).
 */
export const NUMBERING_VERSION = 2;

type Numbered = Partial<Pick<Contract, 'invoiceNumber' | 'advanceInvoiceNumber' | 'numbering' | 'advanceTaxDocNumber'>>;

/** Pořadí čísla v daném roce (RRRRNNN, případně s předponou FA-/ZAL-/FV-); jinak 0. */
function sequenceInYear(value: string | undefined, year: number): number {
  const match = String(value || '').replace(/^[A-Z]+-/i, '').match(/^(\d{4})(\d{3,})$/);
  return match && Number(match[1]) === year ? Number(match[2]) : 0;
}

export function formatInvoiceNumber(year: number, sequence: number): string {
  return `${year}${String(sequence).padStart(3, '0')}`;
}

/** Číslo konečné faktury, nebo prázdný řetězec, dokud není vystavená. */
export function getFinalInvoiceNumber(contract: Numbered): string {
  return contract.invoiceNumber || '';
}

/** Číslo zálohové faktury, nebo prázdný řetězec, dokud není vystavená. */
export function getAdvanceInvoiceNumber(contract: Numbered): string {
  return contract.numbering === NUMBERING_VERSION ? contract.advanceInvoiceNumber || '' : contract.invoiceNumber || '';
}

export function nextFinalInvoiceNumber(contracts: Numbered[], year: number): string {
  const max = Math.max(0, ...contracts.map((c) => sequenceInYear(getFinalInvoiceNumber(c), year)));
  return formatInvoiceNumber(year, max + 1);
}

export function nextAdvanceInvoiceNumber(contracts: Numbered[], year: number): string {
  const max = Math.max(0, ...contracts.map((c) => sequenceInYear(getAdvanceInvoiceNumber(c), year)));
  return formatInvoiceNumber(year, max + 1);
}

/** Další číslo daňového dokladu k přijaté platbě (řada DP-, nejvyšší v roce + 1). */
export function nextAdvanceTaxDocNumber(contracts: Numbered[], year: number): string {
  const max = Math.max(0, ...contracts.map((c) => sequenceInYear(c.advanceTaxDocNumber, year)));
  return formatInvoiceNumber(year, max + 1);
}

/**
 * Pořadí nové smlouvy nebo nabídky v roce (SOD-RRRR-NNN, CN-RRRR-NNN mají společné pořadí): nejvyšší použité + 1,
 * takže se po smazání zakázky číslo neopakuje.
 */
export function nextDocumentSequence(contracts: Pick<Contract, 'contractNumber' | 'quoteNumber'>[], year: number): string {
  const seq = (value?: string) => {
    const match = String(value || '').match(/(\d{4})-(\d+)$/);
    return match && Number(match[1]) === year ? Number(match[2]) : 0;
  };
  const max = Math.max(0, ...contracts.flatMap((c) => [seq(c.contractNumber), seq(c.quoteNumber)]));
  return String(max + 1).padStart(3, '0');
}

/** Zakázka s fakturou vystavenou v aplikaci se nesmaže – fakturu lze jen stornovat. */
export function hasIssuedInvoice(contract: Pick<Contract, 'invoiceIssuedAt' | 'advanceInvoiceIssuedAt' | 'advanceTaxDocIssuedAt'>): boolean {
  return !!(contract.invoiceIssuedAt || contract.advanceInvoiceIssuedAt || contract.advanceTaxDocIssuedAt);
}
