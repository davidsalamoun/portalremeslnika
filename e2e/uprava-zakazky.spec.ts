import { Page } from '@playwright/test';
import { test, expect, openTab, openDoc } from './support/fixtures';

const inDays = (d: number) => new Date(Date.now() + d * 864e5).toISOString().slice(0, 10);

async function fillNewContract(app: Page, description: string, price: string) {
  await openTab(app, 'Nová smlouva');
  await app.locator('#client-select').selectOption({ index: 1 });
  await app.locator('#work-desc').fill(description);
  await app.locator('#price-input').fill(price);
  await app.locator('#delivery-date').fill(inDays(10));
}

async function saveInPreview(app: Page) {
  await app.locator('.contract-page').first().waitFor();
  const save = app.getByRole('button', { name: 'Uložit', exact: true });
  if (await save.isVisible()) await save.click();
  else {
    await app.getByRole('button', { name: 'Další možnosti' }).click();
    await app.getByRole('button', { name: 'Uložit do archivu' }).click();
  }
  await expect(app.getByText(/, uloženo$/)).toBeVisible();
}

async function clickEdit(app: Page) {
  await app.locator('.contract-page').first().waitFor();
  const edit = app.getByRole('button', { name: 'Upravit', exact: true });
  if (await edit.isVisible()) await edit.click();
  else {
    await app.getByRole('button', { name: 'Další možnosti' }).click();
    await app.getByRole('button', { name: 'Upravit zakázku' }).click();
  }
}

async function editOffered(app: Page) {
  if (await app.getByRole('button', { name: 'Upravit', exact: true }).isVisible()) return true;
  await app.getByRole('button', { name: 'Další možnosti' }).click();
  return app.getByRole('button', { name: 'Upravit zakázku' }).isVisible();
}

test('rozepsaná smlouva přežije přepnutí záložky a jde začít znovu', async ({ app }) => {
  await openTab(app, 'Nová smlouva');
  await app.locator('#client-select').selectOption({ index: 1 });
  await app.locator('#work-desc').fill('Oprava fasády po zatečení');
  await app.locator('#price-input').fill('25000');
  await app.waitForTimeout(600);
  await openTab(app, 'Klienti');
  await app.getByRole('heading', { level: 1, name: 'Klienti' }).waitFor();
  await openTab(app, 'Nová smlouva');
  await expect(app.getByRole('status').filter({ hasText: 'Pokračujete v rozepsané smlouvě.' })).toBeVisible();
  await expect(app.locator('#work-desc')).toHaveValue('Oprava fasády po zatečení');
  await expect(app.locator('#price-input')).toHaveValue(/^25\s000$/);
  await app.getByRole('button', { name: 'Začít znovu' }).click();
  await expect(app.locator('#work-desc')).toHaveValue('');
  await expect(app.getByText('Pokračujete v rozepsané smlouvě.')).toHaveCount(0);
});

test('po návratu z náhledu neuložené smlouvy zůstane formulář vyplněný', async ({ app }) => {
  await fillNewContract(app, 'Montáž plovoucí podlahy', '18000');
  await app.locator('form').getByRole('button', { name: 'Zobrazit dokumenty' }).click();
  await expect(app.locator('.contract-page').first()).toContainText('Montáž plovoucí podlahy');
  await app.getByRole('button', { name: 'Zpět' }).first().click();
  await expect(app.locator('#work-desc')).toHaveValue('Montáž plovoucí podlahy');
  await expect(app.locator('#price-input')).toHaveValue(/^18\s000$/);
  // Po uložení se koncept zahodí
  await app.locator('form').getByRole('button', { name: 'Zobrazit dokumenty' }).click();
  await saveInPreview(app);
  await app.getByRole('button', { name: 'Zpět' }).first().click();
  await openTab(app, 'Nová smlouva');
  await expect(app.locator('#work-desc')).toHaveValue('');
});

test('uloženou smlouvu jde upravit, dokud k ní není vystavená faktura', async ({ app }) => {
  await fillNewContract(app, 'Výměna oken v kuchyni', '42000');
  await app.locator('form').getByRole('button', { name: 'Zobrazit dokumenty' }).click();
  await saveInPreview(app);
  const number = (await app.locator('.contract-page').first().innerText()).match(/SOD-\d{4}-\d+/)![0];

  await clickEdit(app);
  await expect(app.getByRole('heading', { level: 1, name: 'Úprava smlouvy o dílo' })).toBeVisible();
  await expect(app.getByRole('group', { name: 'Druh dokumentu' })).toHaveCount(0);
  await expect(app.locator('#work-desc')).toHaveValue('Výměna oken v kuchyni');
  await app.locator('#work-desc').fill('Výměna oken v kuchyni a v ložnici');
  await app.locator('#price-input').fill('51000');
  await app.locator('form').getByRole('button', { name: 'Uložit změny' }).click();

  const paper = app.locator('.contract-page').first();
  await expect(paper).toContainText('Výměna oken v kuchyni a v ložnici');
  await expect(paper).toContainText(/51\s000/);
  await expect(paper).toContainText(number);
  await expect(app.getByText('Změny jsou uložené.')).toBeVisible();

  // Po vystavení faktury už úprava není nabízená
  await openDoc(app, 'faktura', /^Faktura/);
  await app.getByRole('button', { name: 'Vystavit fakturu' }).click();
  await app.getByRole('dialog').getByRole('button', { name: 'Vystavit', exact: true }).click();
  await expect(app.getByRole('dialog')).toHaveCount(0);
  expect(await editOffered(app)).toBe(false);
});

test('úprava zruší odkaz k online podpisu poslaný před úpravou', async ({ app, backend }) => {
  await fillNewContract(app, 'Oprava střechy garáže', '30000');
  await app.locator('form').getByRole('button', { name: 'Zobrazit dokumenty' }).click();
  await saveInPreview(app);
  // Klientovi už odešel odkaz k podpisu
  await app.evaluate(() => {
    const list = JSON.parse(localStorage.getItem('smlouvy') || '[]');
    const c = list.find((x: { workDescription: string }) => x.workDescription === 'Oprava střechy garáže');
    c.signToken = 'tok_pred_upravou';
    localStorage.setItem('smlouvy', JSON.stringify(list));
    window.dispatchEvent(new Event('storage'));
  });
  await clickEdit(app);
  await app.locator('#price-input').fill('32000');
  await app.locator('form').getByRole('button', { name: 'Uložit změny' }).click();
  await expect(app.getByText(/Odkaz k podpisu, který jste poslali, už neplatí/)).toBeVisible();
  expect(backend.deleted.some((d) => d.startsWith('sign_shares?') && d.includes('tok_pred_upravou'))).toBe(true);
});
