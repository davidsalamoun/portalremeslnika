import { Contract } from '../types/contract';
import { getAdvanceInvoiceDates, getContractTotal, getFinalInvoiceDates, getVatBreakdown, getVatRate, isReverseCharge } from './invoiceMath';
import { getAdvanceInvoiceNumber, getFinalInvoiceNumber } from './invoiceNumbering';
import { czAccountToIban } from './spayd';

/**
 * Faktura ve formátu ISDOC 6.0.2 (český standard elektronické faktury, který načtou účetní programy jako Pohoda,
 * Money nebo ABRA). Soubor `.isdoc` je XML; jeho platnost proti oficiálnímu schématu hlídá tests/isdoc.test.ts.
 *
 * Částky odpovídají dokladu v aplikaci: ceny jsou u plátce včetně DPH (daň = cena × sazba / (100 + sazba)); při přenesení
 * daňové povinnosti jsou bez DPH, daň je 0 a řádky mají kód předmětu plnění 4 (poskytnutí stavebních nebo montážních prací),
 * neplátce má DPH 0 a `VATApplicable` false. Konečná faktura zdaňuje celou cenu díla a sjednanou zálohu odečítá
 * jako nedaňovou zálohu (aplikace daňový doklad k přijaté záloze nevystavuje). Zálohová faktura je nedaňový
 * zálohový list (typ 4).
 */

export type IsdocKind = 'final' | 'advance';

const ISSUING_SYSTEM = 'Řemeslník PRO';

// Kódy bank → název a BIC (ISDOC je u bankovního účtu vyžaduje); neznámá banka zůstane bez názvu a BIC
const CZ_BANKS: Record<string, [string, string]> = {
  '0100': ['Komerční banka', 'KOMBCZPP'],
  '0300': ['ČSOB', 'CEKOCZPP'],
  '0600': ['MONETA Money Bank', 'AGBACZPP'],
  '0710': ['Česká národní banka', 'CNBACZPP'],
  '0800': ['Česká spořitelna', 'GIBACZPX'],
  '2010': ['Fio banka', 'FIOBCZPP'],
  '2060': ['Citfin', 'CITFCZPP'],
  '2250': ['Banka CREDITAS', 'CTASCZ22'],
  '2700': ['UniCredit Bank', 'BACXCZPP'],
  '3030': ['Air Bank', 'AIRACZPP'],
  '3060': ['PKO BP', 'BPKOCZPP'],
  '4000': ['Max banka', 'EXPNCZPP'],
  '5500': ['Raiffeisenbank', 'RZBCCZPP'],
  '5800': ['J&T Banka', 'JTBPCZPP'],
  '6210': ['mBank', 'BREXCZPP'],
  '6363': ['Partners Banka', 'PTBNCZPP'],
  '7910': ['Deutsche Bank', 'DEUTCZPX'],
  '8040': ['Oberbank', 'OBKLCZ2X'],
};

const esc = (value: unknown) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
const money = (n: number) => (Math.round(n * 100) / 100).toFixed(2);
const el = (name: string, value: unknown) => `<${name}>${esc(value)}</${name}>`;

export interface ParsedAddress {
  street: string;
  building: string;
  postalZone: string;
  city: string;
}

/** Rozdělí adresu „Květinová 124/8, 140 00 Praha 4“ na ulici, číslo, PSČ a obec. Co nejde rozpoznat, zůstane v ulici. */
export function parseCzAddress(address: string | undefined): ParsedAddress {
  const parts = String(address || '')
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);
  const result: ParsedAddress = { street: '', building: '', postalZone: '', city: '' };
  const rest: string[] = [];
  for (const part of parts) {
    const zip = part.match(/^(\d{3})\s?(\d{2})\s+(.+)$/);
    if (zip && !result.postalZone) {
      result.postalZone = `${zip[1]}${zip[2]}`;
      result.city = zip[3];
    } else rest.push(part);
  }
  const first = rest.shift() || '';
  const numbered = first.match(/^(.*\D)\s+(\d+[\w/]*)$/);
  if (numbered) {
    result.street = numbered[1].trim();
    result.building = numbered[2];
  } else result.street = first;
  // Obec bez PSČ (např. „Slunečná 45, Černošice“)
  if (!result.city && rest.length) result.city = rest.shift()!;
  return result;
}

/** Stabilní identifikátor dokladu (stejný doklad = stejné UUID při každém exportu). */
export function documentUuid(seed: string): string {
  const fnv = (text: string, offset: number) => {
    let h = BigInt(offset) ^ 0xcbf29ce484222325n;
    for (const ch of text) {
      h ^= BigInt(ch.codePointAt(0)!);
      h = (h * 0x100000001b3n) & 0xffffffffffffffffn;
    }
    return h.toString(16).padStart(16, '0');
  };
  const hex = (fnv(seed, 1) + fnv(seed, 2)).toUpperCase();
  // Varianta a verze jako u UUID v4, aby identifikátor vypadal standardně
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-${'89AB'[parseInt(hex[16], 16) % 4]}${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

function partyXml(party: { name: string; ico?: string; dic?: string; address?: string; phone?: string; email?: string }): string {
  const address = parseCzAddress(party.address);
  const contact =
    party.phone || party.email
      ? `<Contact>${party.phone ? el('Telephone', party.phone) : ''}${party.email ? el('ElectronicMail', party.email) : ''}</Contact>`
      : '';
  return (
    '<Party>' +
    `<PartyIdentification>${el('ID', party.ico || '')}</PartyIdentification>` +
    `<PartyName>${el('Name', party.name)}</PartyName>` +
    '<PostalAddress>' +
    el('StreetName', address.street) +
    el('BuildingNumber', address.building) +
    el('CityName', address.city) +
    el('PostalZone', address.postalZone) +
    '<Country><IdentificationCode>CZ</IdentificationCode><Name>Česká republika</Name></Country>' +
    '</PostalAddress>' +
    (party.dic ? `<PartyTaxScheme>${el('CompanyID', party.dic)}<TaxScheme>VAT</TaxScheme></PartyTaxScheme>` : '') +
    contact +
    '</Party>'
  );
}

interface Line {
  description: string;
  note?: string;
  gross: number;
}

/** Název souboru: FA-2026007.isdoc */
export function isdocFileName(contract: Contract, kind: IsdocKind): string {
  const number = kind === 'advance' ? getAdvanceInvoiceNumber(contract) : getFinalInvoiceNumber(contract);
  return `${kind === 'advance' ? 'ZAL' : 'FA'}-${number || 'navrh'}.isdoc`;
}

/** XML faktury ve formátu ISDOC. Volat jen pro vystavenou fakturu (s číslem). */
export function buildIsdoc(contract: Contract, kind: IsdocKind = 'final'): string {
  const isAdvance = kind === 'advance';
  const number = isAdvance ? getAdvanceInvoiceNumber(contract) : getFinalInvoiceNumber(contract);
  const documentId = `${isAdvance ? 'ZAL' : 'FA'}-${number}`;
  const isVatPayer = !!contract.contractor?.dic && !isAdvance;
  const rate = isVatPayer ? getVatRate(contract) : 0;
  // Přenesení daňové povinnosti: částky jsou základem, daň 0, řádky nesou kód předmětu plnění 4 (stavební práce)
  const reverseCharge = isVatPayer && isReverseCharge(contract);
  const dates = isAdvance ? getAdvanceInvoiceDates(contract) : getFinalInvoiceDates(contract);
  const advance = contract.advanceAmount && contract.advanceAmount > 0 ? contract.advanceAmount : 0;
  const amendments = contract.amendments || [];
  const amendmentsTotal = amendments.reduce((sum, a) => sum + (a.priceDifference || 0), 0);

  const lines: Line[] = isAdvance
    ? [{ description: 'Záloha na materiál a zahájení prací', note: contract.workDescription, gross: advance }]
    : [
        {
          description:
            contract.docKind === 'invoice' || !contract.contractNumber
              ? 'Provedení prací'
              : `Provedení díla dle Smlouvy o dílo č. ${contract.contractNumber}`,
          note: contract.workDescription,
          gross: getContractTotal(contract) - amendmentsTotal,
        },
        ...amendments.map((a) => ({
          description: `Dodatek č. ${a.amendmentNumber}`,
          note: [a.title, a.description].filter(Boolean).join(' – '),
          gross: a.priceDifference || 0,
        })),
      ];

  const computed = lines.map((line) => {
    const { base, vat } = rate && !reverseCharge ? getVatBreakdown(line.gross, rate as 21 | 12) : { base: line.gross, vat: 0 };
    return { ...line, base, vat };
  });
  // Daň se počítá shora z celkové ceny (stejně jako na dokladu v aplikaci); případný haléřový rozdíl po zaokrouhlení
  // jednotlivých řádků se připíše k největšímu řádku, aby součet řádků seděl s celkem
  if (rate && !reverseCharge) {
    const grossTotal = computed.reduce((s, l) => s + l.gross, 0);
    const totalVat = getVatBreakdown(grossTotal, rate as 21 | 12).vat;
    const diff = Math.round((totalVat - computed.reduce((s, l) => s + l.vat, 0)) * 100) / 100;
    if (diff !== 0) {
      const biggest = computed.reduce((best, l) => (Math.abs(l.gross) > Math.abs(best.gross) ? l : best), computed[0]);
      biggest.vat = Math.round((biggest.vat + diff) * 100) / 100;
      biggest.base = Math.round((biggest.gross - biggest.vat) * 100) / 100;
    }
  }
  const sum = (key: 'base' | 'vat' | 'gross') => Math.round(computed.reduce((s, l) => s + l[key], 0) * 100) / 100;
  const totalBase = sum('base');
  const totalVat = sum('vat');
  const totalGross = sum('gross');
  const paidDeposits = isAdvance ? 0 : advance;
  const payable = Math.round((totalGross - paidDeposits) * 100) / 100;
  const vs = (contract.variableSymbol || number || '').replace(/\D/g, '');

  const linesXml = computed
    .map(
      (line, i) =>
        '<InvoiceLine>' +
        el('ID', i + 1) +
        '<InvoicedQuantity unitCode="kpl">1</InvoicedQuantity>' +
        el('LineExtensionAmount', money(line.base)) +
        el('LineExtensionAmountTaxInclusive', money(line.gross)) +
        el('LineExtensionTaxAmount', money(line.vat)) +
        el('UnitPrice', money(line.base)) +
        el('UnitPriceTaxInclusive', money(line.gross)) +
        `<ClassifiedTaxCategory>${el('Percent', rate)}<VATCalculationMethod>${reverseCharge ? 0 : 1}</VATCalculationMethod>${el('VATApplicable', isVatPayer)}` +
        (reverseCharge ? '<LocalReverseCharge><LocalReverseChargeCode>4</LocalReverseChargeCode></LocalReverseCharge>' : '') +
        '</ClassifiedTaxCategory>' +
        (line.note ? el('Note', line.note) : '') +
        `<Item>${el('Description', line.description)}</Item>` +
        '</InvoiceLine>'
    )
    .join('');

  const [account, bankCode = ''] = String(contract.contractor?.bankAccount || '').split('/').map((s) => s.trim());
  const [bankName, bic] = CZ_BANKS[bankCode] || ['', ''];
  const payment =
    payable > 0 && account
      ? '<PaymentMeans><Payment>' +
        el('PaidAmount', money(payable)) +
        '<PaymentMeansCode>42</PaymentMeansCode>' +
        '<Details>' +
        el('PaymentDueDate', dates.dueDate) +
        el('ID', account) +
        el('BankCode', bankCode) +
        el('Name', bankName) +
        el('IBAN', czAccountToIban(contract.contractor.bankAccount)) +
        el('BIC', bic) +
        (vs ? el('VariableSymbol', vs) : '') +
        '</Details>' +
        '</Payment></PaymentMeans>'
      : '';

  const deposits =
    paidDeposits > 0
      ? '<NonTaxedDeposits><NonTaxedDeposit>' +
        el('ID', getAdvanceInvoiceNumber(contract) ? `ZAL-${getAdvanceInvoiceNumber(contract)}` : 'Záloha podle smlouvy') +
        el('VariableSymbol', vs) +
        el('DepositAmount', money(paidDeposits)) +
        '</NonTaxedDeposit></NonTaxedDeposits>'
      : '';

  const contractRef =
    contract.contractNumber && contract.docKind !== 'invoice'
      ? `<ContractReferences><ContractReference>${el('ID', contract.contractNumber)}${contract.conclusionDate ? el('IssueDate', contract.conclusionDate) : ''}</ContractReference></ContractReferences>`
      : '';

  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<Invoice xmlns="http://isdoc.cz/namespace/2013" version="6.0.2">' +
    el('DocumentType', isAdvance ? 4 : 1) +
    el('ID', documentId) +
    el('UUID', documentUuid(`${contract.id}|${documentId}`)) +
    el('IssuingSystem', ISSUING_SYSTEM) +
    el('IssueDate', dates.issueDate) +
    (isAdvance ? '' : el('TaxPointDate', dates.taxDate)) +
    el('VATApplicable', isVatPayer) +
    '<ElectronicPossibilityAgreementReference></ElectronicPossibilityAgreementReference>' +
    (contract.invoiceCancelledAt && !isAdvance ? el('Note', 'STORNO') : '') +
    '<LocalCurrencyCode>CZK</LocalCurrencyCode><CurrRate>1</CurrRate><RefCurrRate>1</RefCurrRate>' +
    `<AccountingSupplierParty>${partyXml(contract.contractor)}</AccountingSupplierParty>` +
    `<AccountingCustomerParty>${partyXml(contract.client)}</AccountingCustomerParty>` +
    contractRef +
    `<InvoiceLines>${linesXml}</InvoiceLines>` +
    deposits +
    '<TaxTotal><TaxSubTotal>' +
    el('TaxableAmount', money(totalBase)) +
    el('TaxAmount', money(totalVat)) +
    el('TaxInclusiveAmount', money(totalGross)) +
    '<AlreadyClaimedTaxableAmount>0.00</AlreadyClaimedTaxableAmount><AlreadyClaimedTaxAmount>0.00</AlreadyClaimedTaxAmount><AlreadyClaimedTaxInclusiveAmount>0.00</AlreadyClaimedTaxInclusiveAmount>' +
    el('DifferenceTaxableAmount', money(totalBase)) +
    el('DifferenceTaxAmount', money(totalVat)) +
    el('DifferenceTaxInclusiveAmount', money(totalGross)) +
    `<TaxCategory>${el('Percent', rate)}${el('VATApplicable', isVatPayer)}${reverseCharge ? el('LocalReverseChargeFlag', true) : ''}</TaxCategory>` +
    '</TaxSubTotal>' +
    el('TaxAmount', money(totalVat)) +
    '</TaxTotal>' +
    '<LegalMonetaryTotal>' +
    el('TaxExclusiveAmount', money(totalBase)) +
    el('TaxInclusiveAmount', money(totalGross)) +
    '<AlreadyClaimedTaxExclusiveAmount>0.00</AlreadyClaimedTaxExclusiveAmount><AlreadyClaimedTaxInclusiveAmount>0.00</AlreadyClaimedTaxInclusiveAmount>' +
    el('DifferenceTaxExclusiveAmount', money(totalBase)) +
    el('DifferenceTaxInclusiveAmount', money(totalGross)) +
    '<PayableRoundingAmount>0.00</PayableRoundingAmount>' +
    el('PaidDepositsAmount', money(paidDeposits)) +
    el('PayableAmount', money(payable)) +
    '</LegalMonetaryTotal>' +
    payment +
    '</Invoice>\n'
  );
}
