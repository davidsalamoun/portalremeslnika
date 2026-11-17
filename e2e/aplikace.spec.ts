import { test, expect, openTab, openDoc } from './support/fixtures';
import { expectNoOverflow } from './support/mock';

test.describe('stránky aplikace', () => {
  test('přehled ukazuje zakázky s metrem a pohledávky', async ({ app }) => {
    await expect(app.getByRole('heading', { name: 'Čeká na zaplacení' })).toBeVisible();
    await expect(app.getByRole('img', { name: /Fáze zakázky: Realizace/ }).first()).toBeVisible();
    await expectNoOverflow(app);
  });

  for (const [tab, heading] of [
    ['Zakázky', 'Zakázky'],
    ['Faktury', 'Faktury'],
    ['Klienti', 'Klienti'],
    ['Kalendář', 'Kalendář'],
    ['Archiv', 'Archiv'],
    ['Finance', 'Finance'],
    ['Nastavení', 'Nastavení'],
  ]) {
    test(`stránka ${tab} se otevře bez chyb`, async ({ app }) => {
      await openTab(app, tab);
      await expect(app.getByRole('heading', { level: 1, name: heading })).toBeVisible();
      await expectNoOverflow(app);
    });
  }

  test('posun zakázky do další fáze', async ({ app }) => {
    await openTab(app, 'Zakázky');
    await app.getByRole('tab', { name: /^Nabídka/ }).click();
    await app.getByRole('button', { name: 'Smlouva uzavřena' }).first().click();
    await app.getByRole('tab', { name: /^Smlouva/ }).click();
    await expect(app.getByText('Sádrokartonový podhled')).toBeVisible();
  });
});

test.describe('dokumenty zakázky', () => {
  // [hodnota výběru, záložka, text dokladu, má razítko]
  const docs: [string, RegExp, RegExp, boolean][] = [
    ['dodatek', /^Dodatky/, /DODATEK Č\./i, false],
    ['pokladni_doklad', /^Pokladní doklad/, /PŘÍJMOVÝ POKLADNÍ DOKLAD/i, true],
    ['protokol', /^Předávací protokol/, /PŘEDÁVACÍ PROTOKOL/i, true],
    ['faktura', /^Faktura/, /FA-2026001/, true],
    ['zaruka', /^Záruční list/, /Záruční list/, true],
  ];

  test('všechny doklady se zobrazí a mají razítko', async ({ app }) => {
    await app.getByRole('button', { name: /Rekonstrukce koupelny/ }).first().click();
    await expect(app.locator('.contract-page').first()).toContainText('SMLOUVA O DÍLO');
    await expect(app.locator('[title^="Razítko:"]').first()).toBeVisible();
    for (const [value, tab, text, stamp] of docs) {
      await openDoc(app, value, tab);
      const paper = app.locator('.contract-page, #amendment-printable-paper, #quote-printable-paper, .print-content, [data-pdf-paper]');
      await expect(paper.filter({ hasText: text }).first()).toBeVisible();
      if (stamp) await expect(app.locator('[title^="Razítko:"]').first()).toBeAttached();
      await expectNoOverflow(app);
    }
  });

  test('uložení PDF faktury', async ({ app }, testInfo) => {
    test.skip(testInfo.project.name === 'mobil', 'tlačítko je na mobilu v jiné liště; PDF je stejné');
    await app.getByRole('button', { name: /Rekonstrukce koupelny/ }).first().click();
    await openDoc(app, 'faktura', /^Faktura/);
    const [download] = await Promise.all([app.waitForEvent('download'), app.getByRole('button', { name: 'Uložit PDF' }).first().click()]);
    expect(download.suggestedFilename()).toMatch(/^Faktura_.*\.pdf$/);
  });

  test('adresa stavby se propíše do čl. 2.1 smlouvy a odešle do účtu', async ({ app, backend }) => {
    await app.getByRole('button', { name: /Zateplení fasády/ }).first().click();
    await app.getByRole('button', { name: 'Adresa stavby' }).click();
    await app.locator('#nahled-adresa-stavby').fill('Na Výsluní 12, 251 01 Říčany');
    await app.getByRole('dialog').getByRole('button', { name: 'Uložit' }).click();
    await expect(app.locator('.contract-page')).toContainText('Místem provedení díla je Na Výsluní 12, 251 01 Říčany');
    await expect.poll(() => JSON.stringify(backend.rows.get('contracts/contract_6') ?? {})).toContain('Na Výsluní 12');
  });
});

test.describe('faktura plátce DPH', () => {
  test.use({ seed: 'vatPayer' });
  test('rozpis DPH a volba sazby', async ({ app }) => {
    await app.getByRole('button', { name: /Rekonstrukce koupelny/ }).first().click();
    await openDoc(app, 'faktura', /^Faktura/);
    const paper = app.locator('.contract-page').first();
    await expect(paper).toContainText('FAKTURA – DAŇOVÝ DOKLAD');
    await expect(paper).toContainText('3 960,84 Kč');
    await app.getByRole('button', { name: '12 %' }).click();
    await expect(paper).toContainText('2 445,21 Kč');
  });
});

test.describe('prázdný účet', () => {
  test.use({ seed: 'empty' });
  test('průvodce prvním spuštěním a prázdné seznamy', async ({ app }) => {
    await expect(app.getByText(/Hotovo 0 ze 4 kroků/)).toBeVisible();
    for (const tab of ['Zakázky', 'Faktury', 'Klienti', 'Archiv', 'Finance']) {
      await openTab(app, tab);
      await expectNoOverflow(app);
    }
  });
});
