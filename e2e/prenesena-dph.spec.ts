import { readFile } from 'node:fs/promises';
import { test, expect, openTab, openDoc } from './support/fixtures';

// Přenesení daňové povinnosti: plátce fakturuje stavební práce jinému plátci bez DPH, daň odvede zákazník
test.use({ seed: 'vatPayer' });

test('klient s DIČ z ARES, smlouva a faktura v režimu přenesení daňové povinnosti', async ({ app, context, backend }) => {
  await context.route('https://ares.gov.cz/**', (route) =>
    route.fulfill({
      status: 200,
      headers: { 'access-control-allow-origin': '*', 'content-type': 'application/json' },
      body: JSON.stringify({ ico: '27074358', dic: 'CZ27074358', obchodniJmeno: 'Stavby Novotný s.r.o.', sidlo: { textovaAdresa: 'Průmyslová 8, 60200 Brno', nazevObce: 'Brno' } }),
    })
  );

  // Nový klient: DIČ doplní ARES
  await openTab(app, 'Klienti');
  await app.getByRole('button', { name: 'Nový klient' }).first().click();
  await app.locator('#klient-ico').fill('27074358');
  await expect(app.locator('#klient-dic')).toHaveValue('CZ27074358');
  await app.locator('#klient-telefon').fill('+420 602 333 444');
  await app.getByRole('dialog').getByRole('button', { name: 'Přidat klienta' }).click();
  await expect(app.getByText('DIČ CZ27074358')).toBeVisible();

  // Nová smlouva: aplikace přenesení nabídne, sama ho nezapne
  await openTab(app, 'Nová smlouva');
  const value = await app.locator('#client-select option', { hasText: 'Stavby Novotný' }).getAttribute('value');
  await app.locator('#client-select').selectOption(value!);
  await expect(app.getByRole('button', { name: 'Já (běžná faktura)' })).toHaveAttribute('aria-pressed', 'true');
  await expect(app.getByText('Klient má DIČ.')).toBeVisible();
  await app.getByRole('button', { name: 'Použít', exact: true }).click();
  await expect(app.getByRole('button', { name: 'Zákazník (přenesení)' })).toHaveAttribute('aria-pressed', 'true');
  await expect(app.locator('label[for="price-input"]')).toHaveText('Cena díla bez DPH');
  await app.locator('#work-desc').fill('Sádrokartonové příčky a podhledy, 2. NP');
  await app.locator('#price-input').fill('120000');
  await app.locator('#delivery-date').fill(new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10));
  await app.locator('form').getByRole('button', { name: 'Zobrazit dokumenty' }).click();

  // Smlouva: DIČ objednatele a schválené znění čl. 3.1
  const paper = app.locator('.contract-page').first();
  await expect(paper).toContainText('CZ27074358');
  await expect(paper).toContainText('Uvedená cena je bez DPH. Na plnění se vztahuje režim přenesení daňové povinnosti podle § 92e');

  // Faktura: bez DPH, „daň odvede zákazník“, k úhradě celá cena bez DPH
  await openDoc(app, 'faktura', /^Faktura/);
  const invoice = app.locator('.contract-page').first();
  await expect(invoice).toContainText('DIČ: CZ27074358');
  await expect(invoice).toContainText('daň odvede zákazník');
  await expect(invoice).toContainText('Daň odvede zákazník. Plnění v režimu přenesení daňové povinnosti podle § 92e');
  await expect(invoice).toContainText('Částka je bez DPH, daň odvede zákazník.');
  await expect(invoice).toContainText('120 000 Kč');
  await expect(invoice).not.toContainText('včetně DPH');

  // Vystavení a ISDOC s kódem předmětu plnění 4
  await expect(app.getByRole('group', { name: 'Kdo odvede daň' })).toBeVisible();
  await app.getByRole('button', { name: 'Vystavit fakturu' }).click();
  await app.getByRole('dialog').getByRole('button', { name: 'Vystavit', exact: true }).click();
  await expect(app.getByRole('group', { name: 'Kdo odvede daň' })).toHaveCount(0);
  const [download] = await Promise.all([app.waitForEvent('download'), app.getByRole('button', { name: 'ISDOC' }).click()]);
  const xml = await readFile((await download.path())!, 'utf8');
  expect(xml).toContain('<LocalReverseChargeCode>4</LocalReverseChargeCode>');
  expect(xml).toContain('<PayableAmount>120000.00</PayableAmount>');
  // Volba přenesení se uloží se zakázkou do účtu
  await expect.poll(() => JSON.stringify([...backend.rows.values()].filter((r) => JSON.stringify(r).includes('Sádrokartonové příčky')))).toContain('"reverseCharge":true');
});

test('běžná zakázka plátce zůstává včetně DPH', async ({ app }) => {
  await app.getByRole('button', { name: /Rekonstrukce koupelny/ }).first().click();
  await expect(app.locator('.contract-page').first()).toContainText('Uvedená cena je včetně DPH.');
  await openDoc(app, 'faktura', /^Faktura/);
  await expect(app.locator('.contract-page').first()).toContainText('Částka je uvedena včetně DPH.');
  await expect(app.locator('.contract-page').first()).not.toContainText('daň odvede zákazník');
});
