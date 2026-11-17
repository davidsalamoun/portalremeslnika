import { readFile } from 'node:fs/promises';
import { test, expect, openDoc } from './support/fixtures';

// Daňový doklad k přijaté záloze (plátce DPH): vystavení, odečet na konečné faktuře, ISDOC
test.use({ seed: 'vatPayer' });
const year = new Date().getFullYear();

test('záloha zaplacena → doklad DP-, konečná faktura odečte zálohu i s daní', async ({ app, backend }) => {
  await app.getByRole('button', { name: /Rekonstrukce koupelny/ }).first().click();
  await openDoc(app, 'zaloha', /^Faktura/);
  if (!(await app.getByRole('button', { name: 'Záloha zaplacena' }).isVisible())) {
    await app.getByRole('group', { name: 'Druh faktury' }).getByRole('button', { name: 'Zálohová' }).click();
  }
  await app.getByRole('button', { name: 'Záloha zaplacena' }).click();
  const dialog = app.getByRole('dialog', { name: 'Záloha zaplacena' });
  await expect(dialog).toContainText(`DP-${year}001`);
  // Datum v budoucnosti nejde
  await dialog.locator('#zaloha-prijata').fill(`${year + 1}-01-15`);
  await expect(dialog.getByRole('alert')).toContainText('nejpozději dnes');
  await dialog.locator('#zaloha-prijata').fill(new Date().toISOString().slice(0, 10));
  await dialog.getByRole('button', { name: 'Na účet' }).click();
  await dialog.getByRole('button', { name: `Vystavit doklad DP-${year}001` }).click();

  // Doklad: 8 000 Kč s DPH 21 % → základ 6 611,57, daň 1 388,43
  const paper = app.locator('.contract-page').first();
  await expect(paper).toContainText('DAŇOVÝ DOKLAD K PŘIJATÉ PLATBĚ');
  await expect(paper).toContainText(`DP-${year}001`);
  await expect(paper).toContainText(/6\s611,57/);
  await expect(paper).toContainText(/1\s388,43/);
  await expect(paper).toContainText('nejde o výzvu k platbě');
  await expect(paper).toContainText('Bankovní převod');

  const [download] = await Promise.all([app.waitForEvent('download'), app.getByRole('button', { name: 'ISDOC' }).click()]);
  const xml = await readFile((await download.path())!, 'utf8');
  expect(xml).toContain('<DocumentType>5</DocumentType>');

  // Konečná faktura: záloha odečtená i s daní
  await app.getByRole('group', { name: 'Druh faktury' }).getByRole('button', { name: 'Konečná' }).click();
  const invoice = app.locator('.contract-page').first();
  await expect(invoice).toContainText(`Zdaněno zálohou DP-${year}001`);
  await expect(invoice).toContainText(`Daňový doklad k přijaté platbě DP-${year}001`);
  await expect(invoice).toContainText('Zbývá');
  await expect(invoice).toContainText(/22\s822 Kč/);

  // Uloženo do účtu
  await expect.poll(() => JSON.stringify(backend.rows.get('contracts/contract_1') ?? {})).toContain(`"advanceTaxDocNumber":"${year}001"`);
});

test.describe('neplátce', () => {
  test.use({ seed: 'full' });
  test('nemá tlačítko Záloha zaplacena', async ({ app }) => {
    await app.getByRole('button', { name: /Rekonstrukce koupelny/ }).first().click();
    await openDoc(app, 'zaloha', /^Faktura/);
    await expect(app.locator('.contract-page').first()).toBeVisible();
    await expect(app.getByRole('button', { name: 'Záloha zaplacena' })).toHaveCount(0);
  });
});
