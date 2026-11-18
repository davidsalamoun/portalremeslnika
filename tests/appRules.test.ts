import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getVatRegistration, getFlatTaxBand } from '../src/utils/taxLimits';
import { getVatBreakdown, getVatRate } from '../src/utils/invoiceMath';
import { getSiteAddress } from '../src/utils/siteAddress';
import { getGettingStartedSteps } from '../src/utils/gettingStarted';
import { DEFAULT_PRICE_LIST_ITEMS, isSamplePriceItem, isPriceListCustomized } from '../src/data/defaultPriceList';

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

test('adresa stavby: vlastní, jinak adresa klienta', () => {
  const client = { id: 'c', name: 'Klient', address: 'Slunečná 45, Černošice', email: '', phone: '', createdAt: '' };
  assert.equal(getSiteAddress({ client }), 'Slunečná 45, Černošice');
  assert.equal(getSiteAddress({ client, siteAddress: '  ' }), 'Slunečná 45, Černošice');
  assert.equal(getSiteAddress({ client, siteAddress: ' Polní 3, Beroun ' }), 'Polní 3, Beroun');
});

test('průvodce prvním spuštěním: kroky podle skutečných dat', () => {
  const done = (...args: Parameters<typeof getGettingStartedSteps>) => getGettingStartedSteps(...args).map((s) => s.done);
  const profile = { name: 'Jan Novák', ico: '12345678', address: 'Praha', bankAccount: '1/0100', phone: '', email: '', defaultPlace: '' };
  assert.deepEqual(done(null, 0, []), [false, false, false, false, false]);
  assert.deepEqual(done({ ...profile, bankAccount: '' }, 0, []), [false, false, false, false, false]);
  assert.deepEqual(done(profile, 0, []), [true, false, false, false, false]);
  assert.deepEqual(done({ ...profile, signature: 'data:image/png;base64,x' }, 1, []), [true, true, false, true, false]);
  assert.deepEqual(done(profile, 0, [{ id: 'c1' }], true), [true, false, true, true, true]);
});

test('ceník: ukázkové ceny se poznají, upravený ceník ne', () => {
  const sample = DEFAULT_PRICE_LIST_ITEMS.map((item, i) => ({ ...item, id: `pl_${i}` }));
  assert.equal(isSamplePriceItem(sample[3]), true);
  assert.equal(isPriceListCustomized(sample), false);
  assert.equal(isPriceListCustomized([]), false);
  assert.equal(isPriceListCustomized(sample.map((it, i) => (i === 3 ? { ...it, unitPrice: 900 } : it))), true);
  const own = { id: 'x', type: 'prace' as const, category: 'Vlastní', title: 'Montáž kuchyně', unit: 'kpl', unitPrice: 8000 };
  assert.equal(isPriceListCustomized([...sample, own]), true);
  assert.equal(isPriceListCustomized(sample.slice(0, 5)), false);
});
