import { test, expect, openTab, openDoc, jobAction } from './support/fixtures';
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
    await jobAction(app, 'Adresa stavby');
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
    await expect(paper).toContainText('5 349,27 Kč');
    await app.getByRole('button', { name: '12 %' }).click();
    await expect(paper).toContainText('3 302,36 Kč');
  });
});

test.describe('prázdný účet', () => {
  test.use({ seed: 'empty' });
  test('průvodce prvním spuštěním a prázdné seznamy', async ({ app }) => {
    await expect(app.getByText(/Hotovo 0 ze 5 kroků/)).toBeVisible();
    // Krok ceníku otevře Nastavení rovnou na záložce Ceník
    await app.getByRole('button', { name: 'Otevřít ceník' }).click();
    await expect(app.getByRole('tab', { name: 'Ceník' })).toHaveAttribute('aria-selected', 'true');
    await openTab(app, 'Přehled');
    await expect(app.getByText(/Hotovo 0 ze 5 kroků/)).toBeVisible();
    for (const tab of ['Zakázky', 'Faktury', 'Klienti', 'Archiv', 'Finance']) {
      await openTab(app, tab);
      await expectNoOverflow(app);
    }
  });
});

test.describe('export ISDOC', () => {
  test('faktura i podklady pro účetní jdou stáhnout jako ISDOC', async ({ app }, testInfo) => {
    test.skip(testInfo.project.name === 'mobil', 'stažení stačí ověřit na počítači');
    const fs = await import('node:fs/promises');
    await app.getByRole('button', { name: /Rekonstrukce koupelny/ }).first().click();
    await openDoc(app, 'faktura', /^Faktura/);
    const [isdoc] = await Promise.all([app.waitForEvent('download'), app.getByRole('button', { name: 'ISDOC' }).click()]);
    expect(isdoc.suggestedFilename()).toBe('FA-2026001.isdoc');
    const xml = await fs.readFile((await isdoc.path())!, 'utf8');
    expect(xml).toContain('<Invoice xmlns="http://isdoc.cz/namespace/2013" version="6.0.2">');
    expect(xml).toContain('<PayableAmount>22822.00</PayableAmount>');

    await app.getByRole('button', { name: 'Zpět' }).first().click();
    await openTab(app, 'Finance');
    await app.getByRole('button', { name: /Podklady pro účetní/ }).click();
    await app.getByRole('dialog').getByRole('button', { name: /^(Celý rok|Rok)/ }).first().click().catch(() => {});
    const [zip] = await Promise.all([app.waitForEvent('download'), app.getByRole('button', { name: 'Faktury v ISDOC (ZIP)' }).click()]);
    expect(zip.suggestedFilename()).toMatch(/^Faktury_ISDOC_.*\.zip$/);
    const bytes = await fs.readFile((await zip.path())!);
    expect(bytes.readUInt32LE(0)).toBe(0x04034b50);
  });
});

test('nastavení: záložky údaje, ceník a záloha', async ({ app }) => {
  await openTab(app, 'Nastavení');
  await expect(app.getByRole('tab', { name: 'Vaše údaje' })).toHaveAttribute('aria-selected', 'true');
  await expect(app.locator('#nastaveni-podpis')).toBeVisible();
  await app.getByRole('tab', { name: 'Ceník' }).click();
  await expect(app.getByRole('heading', { name: 'Ceník prací a materiálu' })).toBeVisible();
  await expect(app.getByRole('heading', { name: 'Vaše údaje' })).toHaveCount(0);
  // Šipkou na další záložku
  await app.getByRole('tab', { name: 'Ceník' }).press('ArrowRight');
  await expect(app.getByRole('tab', { name: 'Záloha dat' })).toBeFocused();
  await expect(app.getByRole('button', { name: 'Stáhnout zálohu' })).toBeVisible();
});

test('kalendář na mobilu: dnešek nad měsícem a další dny', async ({ app }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobil', 'jen na mobilu');
  await openTab(app, 'Kalendář');
  const today = app.getByRole('heading', { name: 'Dnes', exact: true });
  const month = app.getByRole('heading', { name: /\d{4}$/ });
  expect((await today.boundingBox())!.y).toBeLessThan((await month.boundingBox())!.y);
  const next = app.getByRole('heading', { name: 'Další dny' });
  await expect(next).toBeVisible();
  // Výběr události z dalších dnů ukáže její den
  const item = app.locator('button', { hasText: 'Předání' }).filter({ hasText: /\d+\. \d+\./ }).first();
  await item.click();
  await expect(today).toHaveCount(0);
  await expect(next).toHaveCount(0);
});
