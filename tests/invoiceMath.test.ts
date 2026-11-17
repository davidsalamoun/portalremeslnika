import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addDaysIso,
  daysBetweenIso,
  getContractTotal,
  getFinalBalance,
  getFinalInvoiceDates,
  getAdvanceInvoiceDates,
  getInvoiceStatus,
  isInvoiceable,
  vatIncludedInGross,
  getContractVatBreakdown,
  isReverseCharge,
  contractPriceVatSentence,
  priceVatNote,
  canHaveAdvanceTaxDoc,
  hasAdvanceTaxDoc,
  getAdvanceTaxBreakdown,
} from '../src/utils/invoiceMath.ts';

const contract = (over: Record<string, unknown> = {}): any => ({
  id: 'c1',
  docKind: 'contract',
  price: 27520,
  advanceAmount: 8000,
  conclusionDate: '2026-11-03',
  deliveryDate: '2026-12-03',
  createdAt: '2026-11-03T08:00:00.000Z',
  amendments: [{ priceDifference: 4502 }, { priceDifference: -1200 }],
  ...over,
});

test('počítání s daty nezávisí na časovém pásmu ani přechodu na letní čas', () => {
  assert.equal(addDaysIso('2026-12-25', 14), '2027-01-08');
  assert.equal(addDaysIso('2026-03-20', 14), '2026-04-03'); // přes změnu času
  assert.equal(addDaysIso('2028-02-20', 14), '2028-03-05'); // přestupný rok
  assert.equal(daysBetweenIso('2026-10-20', '2026-11-03'), 14); // přes změnu času
  assert.equal(daysBetweenIso('2026-11-03', '2026-10-20'), -14);
});

test('cena včetně dodatků a doplatek po odečtení zálohy', () => {
  assert.equal(getContractTotal(contract()), 30822);
  assert.equal(getFinalBalance(contract()), 22822);
  assert.equal(getFinalBalance(contract({ advanceAmount: 0 })), 30822);
  assert.equal(getFinalBalance(contract({ advanceAmount: 99999 })), 0);
  // Bez sjednané ceny se vychází z položek rozpočtu
  assert.equal(getContractTotal(contract({ price: 0, amendments: [], items: [{ totalPrice: 5000 }, { unitPrice: 100, quantity: 3 }] })), 5300);
});

test('konečná faktura: vystavení k předání díla, splatnost 14 dnů', () => {
  assert.deepEqual(getFinalInvoiceDates(contract()), { issueDate: '2026-12-03', taxDate: '2026-12-03', dueDate: '2026-12-17' });
  // Skutečné datum předání z protokolu má přednost před plánovaným termínem
  assert.deepEqual(getFinalInvoiceDates(contract({ handoverData: { handoverDate: '2026-11-28', status: 'bez_vad' } })), {
    issueDate: '2026-11-28',
    taxDate: '2026-11-28',
    dueDate: '2026-12-12',
  });
  assert.deepEqual(getAdvanceInvoiceDates(contract()), { issueDate: '2026-11-03', taxDate: '2026-11-03', dueDate: '2026-11-17' });
});

test('stav faktury: před splatností, po splatnosti, zaplaceno', () => {
  assert.deepEqual(getInvoiceStatus(contract(), '2026-12-10'), { isPaid: false, isOverdue: false, daysPastDue: -7, dueDate: '2026-12-17' });
  assert.equal(getInvoiceStatus(contract(), '2026-12-17').isOverdue, false); // den splatnosti ještě není po splatnosti
  assert.deepEqual(getInvoiceStatus(contract(), '2026-12-20'), { isPaid: false, isOverdue: true, daysPastDue: 3, dueDate: '2026-12-17' });
  assert.equal(getInvoiceStatus(contract({ status: 'paid' }), '2027-06-01').isOverdue, false);
  assert.equal(getInvoiceStatus(contract({ paidDate: '2026-12-18' }), '2027-06-01').isPaid, true);
});

test('cenová nabídka a zakázka bez ceny nejsou pohledávkou', () => {
  assert.equal(isInvoiceable(contract()), true);
  assert.equal(isInvoiceable(contract({ docKind: 'quote' })), false);
  assert.equal(isInvoiceable(contract({ price: 0, amendments: [], items: [] })), false);
});

test('DPH obsažená v ceně včetně daně', () => {
  assert.equal(vatIncludedInGross(121000), 21000);
  assert.equal(vatIncludedInGross(112000, 12), 12000);
  assert.equal(vatIncludedInGross(0), 0);
});

test('přenesení daňové povinnosti platí jen u plátce; částka je pak základem bez daně', () => {
  const payer = { contractor: { dic: 'CZ8503120000' }, reverseCharge: true, vatRate: 21 as const };
  const nonPayer = { contractor: { dic: '' }, reverseCharge: true };
  assert.equal(isReverseCharge(payer), true);
  assert.equal(isReverseCharge(nonPayer), false);
  assert.equal(isReverseCharge({ ...payer, reverseCharge: undefined }), false);
  assert.deepEqual(getContractVatBreakdown(payer, 120000), { base: 120000, vat: 0, gross: 120000, rate: 21 });
  assert.deepEqual(getContractVatBreakdown({ ...payer, reverseCharge: false }, 121000), { base: 100000, vat: 21000, gross: 121000, rate: 21 });
  assert.match(contractPriceVatSentence(payer), /^Uvedená cena je bez DPH\. .*§ 92e .*daň přizná a zaplatí objednatel/);
  assert.equal(contractPriceVatSentence({ ...payer, reverseCharge: false }), 'Uvedená cena je včetně DPH.');
  assert.equal(contractPriceVatSentence(nonPayer), 'Zhotovitel není plátcem DPH.');
  assert.equal(priceVatNote(payer), 'bez DPH, daň odvede zákazník');
});

test('doklad k přijaté záloze: jen plátce se zálohou, ne při přenesení; daň shora z přijaté částky', () => {
  const payer = { contractor: { dic: 'CZ8503120000' }, advanceAmount: 30000 };
  assert.equal(canHaveAdvanceTaxDoc(payer), true);
  assert.equal(canHaveAdvanceTaxDoc({ ...payer, contractor: { dic: '' } }), false);
  assert.equal(canHaveAdvanceTaxDoc({ ...payer, advanceAmount: 0 }), false);
  assert.equal(canHaveAdvanceTaxDoc({ ...payer, reverseCharge: true }), false);
  assert.equal(hasAdvanceTaxDoc(payer), false);
  assert.equal(hasAdvanceTaxDoc({ ...payer, advanceTaxDocNumber: '2026001', advancePaidDate: '2026-11-17' }), true);
  assert.deepEqual(getAdvanceTaxBreakdown(payer), { base: 24793.39, vat: 5206.61, gross: 30000, rate: 21 });
  assert.deepEqual(getAdvanceTaxBreakdown({ ...payer, vatRate: 12 }).vat, 3214.29);
});
