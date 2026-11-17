import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  nextFinalInvoiceNumber,
  nextAdvanceInvoiceNumber,
  nextDocumentSequence,
  getAdvanceInvoiceNumber,
  hasIssuedInvoice,
  nextAdvanceTaxDocNumber,
} from '../src/utils/invoiceNumbering';

test('další číslo faktury je nejvyšší v roce + 1, ne počet zakázek', () => {
  const contracts = [{ invoiceNumber: '2026001' }, { invoiceNumber: '2026007' }, { invoiceNumber: '' , numbering: 2 as const }, { invoiceNumber: '2025099' }];
  assert.equal(nextFinalInvoiceNumber(contracts, 2026), '2026008');
  assert.equal(nextFinalInvoiceNumber(contracts, 2027), '2027001');
  assert.equal(nextFinalInvoiceNumber([{ invoiceNumber: 'FV-2026004' }], 2026), '2026005');
});

test('po smazání zakázky se číslo neopakuje', () => {
  const before = [{ invoiceNumber: '2026001' }, { invoiceNumber: '2026002' }, { invoiceNumber: '2026003' }];
  const afterDelete = [before[0], before[2]];
  assert.equal(nextFinalInvoiceNumber(afterDelete, 2026), '2026004');
  assert.equal(nextDocumentSequence([{ contractNumber: 'SOD-2026-001' }, { contractNumber: 'SOD-2026-003', quoteNumber: 'CN-2026-005' }], 2026), '006');
});

test('zálohové faktury mají vlastní řadu; starší zakázky nesou číslo konečné faktury', () => {
  assert.equal(getAdvanceInvoiceNumber({ invoiceNumber: '2026003' }), '2026003');
  assert.equal(getAdvanceInvoiceNumber({ invoiceNumber: '', numbering: 2, advanceInvoiceNumber: '' }), '');
  const contracts = [{ invoiceNumber: '2026003' }, { invoiceNumber: '', numbering: 2 as const, advanceInvoiceNumber: '2026004' }];
  assert.equal(nextAdvanceInvoiceNumber(contracts, 2026), '2026005');
});

test('zakázku s vystavenou fakturou nejde smazat', () => {
  assert.equal(hasIssuedInvoice({}), false);
  assert.equal(hasIssuedInvoice({ invoiceIssuedAt: '2026-11-17T10:00:00Z' }), true);
  assert.equal(hasIssuedInvoice({ advanceInvoiceIssuedAt: '2026-11-17T10:00:00Z' }), true);
});

test('doklady k přijaté záloze mají vlastní řadu DP- a zakázku s nimi nejde smazat', () => {
  const contracts = [{ advanceTaxDocNumber: '2026002' }, { advanceTaxDocNumber: '2025009' }, { invoiceNumber: '2026005' }];
  assert.equal(nextAdvanceTaxDocNumber(contracts, 2026), '2026003');
  assert.equal(nextAdvanceTaxDocNumber([], 2026), '2026001');
  assert.equal(hasIssuedInvoice({ advanceTaxDocIssuedAt: '2026-11-11T09:00:00.000Z' }), true);
});
