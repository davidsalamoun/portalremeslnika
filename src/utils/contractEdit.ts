import type { Contract } from '../types/contract';
import { getAdvanceInvoiceNumber, getFinalInvoiceNumber, hasIssuedInvoice } from './invoiceNumbering';

/**
 * Úprava uložené zakázky (cena, popis, termín, klient…) jde jen do chvíle, kdy na ni navazuje závazný doklad.
 * Potom se změny dělají dodatkem (vícepráce/méněpráce), ne přepsáním.
 */
export type EditLock = 'signed' | 'invoice' | 'handover' | 'amendments';

export function getEditLock(
  c: Pick<
    Contract,
    | 'clientSignature'
    | 'invoiceIssuedAt'
    | 'advanceInvoiceIssuedAt'
    | 'advanceTaxDocIssuedAt'
    | 'invoiceNumber'
    | 'advanceInvoiceNumber'
    | 'numbering'
    | 'handoverData'
    | 'amendments'
  >
): EditLock | null {
  if (c.clientSignature) return 'signed';
  // Starší zakázky (bez numbering: 2) mají číslo faktury od založení a platí jako vystavené
  if (hasIssuedInvoice(c) || getFinalInvoiceNumber(c) || getAdvanceInvoiceNumber(c)) return 'invoice';
  if (c.handoverData) return 'handover';
  if (c.amendments && c.amendments.length > 0) return 'amendments';
  return null;
}

export function canEditContract(c: Parameters<typeof getEditLock>[0]): boolean {
  return getEditLock(c) === null;
}

/** Proč zakázku nejde upravit – věta pro uživatele. */
export function editLockReason(lock: EditLock, docKind?: Contract['docKind']): string {
  const doc = docKind === 'quote' ? 'Nabídku' : 'Smlouvu';
  switch (lock) {
    case 'signed':
      return `${doc} klient podepsal, změny se dělají dodatkem.`;
    case 'invoice':
      return 'K zakázce je vystavená faktura, změny se dělají dodatkem.';
    case 'handover':
      return 'Dílo je předané, změny se dělají dodatkem.';
    case 'amendments':
      return 'Zakázka už má dodatek, další změny se dělají dodatkem.';
  }
}

/** Údaje, které úprava mění; ostatní (čísla, podpisy zhotovitele, náklady, fotky, deník…) zůstávají. */
export type ContractEditChanges = Pick<
  Contract,
  'client' | 'workDescription' | 'price' | 'advanceAmount' | 'deliveryDate' | 'siteAddress' | 'pricingType' | 'items' | 'vatRate' | 'reverseCharge'
>;

/**
 * Upravená zakázka. Odkaz k online podpisu (`signToken`) se zahodí – zákazník nesmí podepsat starou verzi;
 * smazání odkazu v účtu zařídí volající (`deleteSignShare`).
 */
export function applyContractEdit(original: Contract, changes: ContractEditChanges): Contract {
  return {
    ...original,
    client: changes.client,
    workDescription: changes.workDescription,
    price: changes.price,
    advanceAmount: changes.advanceAmount,
    deliveryDate: changes.deliveryDate,
    siteAddress: changes.siteAddress,
    pricingType: changes.pricingType,
    items: changes.items,
    vatRate: changes.vatRate,
    reverseCharge: changes.reverseCharge,
    signToken: undefined,
  };
}
