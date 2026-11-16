import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getVatRegistration, getFlatTaxBand } from '../src/utils/taxLimits';
import { getVatBreakdown, getVatRate } from '../src/utils/invoiceMath';

test('registrace k DPH podle obratu', () => {
  assert.equal(getVatRegistration(0), 'below');
  assert.equal(getVatRegistration(2_000_000), 'below');
  assert.equal(getVatRegistration(2_000_001), 'next_year');
  assert.equal(getVatRegistration(2_536_500), 'next_year');
  assert.equal(getVatRegistration(2_536_501), 'immediate');
});

test('pásmo paušální daně podle výdajového paušálu', () => {
  assert.equal(getFlatTaxBand(1_900_000, 80), 1);
  assert.equal(getFlatTaxBand(1_500_000, 60), 1);
  assert.equal(getFlatTaxBand(1_500_001, 60), 2);
  assert.equal(getFlatTaxBand(1_000_000, 40), 1);
  assert.equal(getFlatTaxBand(1_200_000, 40), 2);
  assert.equal(getFlatTaxBand(1_800_000, 40), 3);
  assert.equal(getFlatTaxBand(2_000_001, 80), null);
});

test('rozpis DPH z ceny včetně daně', () => {
  assert.deepEqual(getVatBreakdown(121_000, 21), { base: 100_000, vat: 21_000, gross: 121_000, rate: 21 });
  assert.deepEqual(getVatBreakdown(112_000, 12), { base: 100_000, vat: 12_000, gross: 112_000, rate: 12 });
  const b = getVatBreakdown(84_500, 21);
  assert.equal(b.vat, 14665.29);
  assert.equal(b.base, 69834.71);
  assert.equal(Math.round((b.base + b.vat) * 100), 8_450_000);
  assert.equal(getVatRate({}), 21);
  assert.equal(getVatRate({ vatRate: 12 }), 12);
});
