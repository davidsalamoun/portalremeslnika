import { test, expect } from '@playwright/test';
import { collectErrors, expectNoOverflow, mockBackend } from './support/mock';

// Úvodní stránka pro nepřihlášené
test('úvodní stránka: živá ukázka, podpis na zkoušku a cesta k registraci', async ({ page, context }) => {
  const errors = collectErrors(page);
  await mockBackend(context);
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: /Smlouva, faktura i předávací protokol/ })).toBeVisible();
  await expectNoOverflow(page);

  // Volba řemesla přepne ukázkovou zakázku
  await page.getByRole('button', { name: 'Elektro', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Elektro', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText('Elektroinstalace v bytě 3+1')).toBeVisible();

  // Podpis na zkoušku
  const pad = page.getByLabel('Plocha pro podpis na zkoušku');
  await pad.scrollIntoViewIfNeeded();
  const box = (await pad.boundingBox())!;
  await page.mouse.move(box.x + 40, box.y + 80);
  await page.mouse.down();
  for (let i = 0; i < 12; i++) await page.mouse.move(box.x + 40 + i * 20, box.y + 80 + (i % 2 ? 30 : -20));
  await page.mouse.up();
  await expect(page.getByText('Takhle snadno.')).toBeVisible();

  // Registrace a návrat na úvod
  await page.getByRole('button', { name: 'Založit účet zdarma' }).first().click();
  await expect(page.getByRole('heading', { level: 1, name: /Registrace|Založit účet|Nový účet/ })).toBeVisible();
  await page.getByRole('button', { name: /úvodní stránka/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: /Smlouva, faktura/ })).toBeVisible();
  expect(errors).toEqual([]);
});

test('na mobilu se pod úvodem přilepí tlačítko k registraci', async ({ page, context }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobil', 'jen na mobilu');
  await mockBackend(context);
  await page.goto('/');
  const sticky = page.locator('div.fixed.inset-x-0.bottom-0');
  await expect(sticky).toHaveAttribute('aria-hidden', 'true');
  await page.getByRole('heading', { name: 'Funguje i bez signálu' }).scrollIntoViewIfNeeded();
  await expect(sticky).toHaveAttribute('aria-hidden', 'false');
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await expect(sticky).toHaveAttribute('aria-hidden', 'true');
});

test('zásady ochrany osobních údajů z úvodní stránky, registrace i přímým odkazem', async ({ page, context }) => {
  const errors = collectErrors(page);
  await mockBackend(context);
  await page.goto('/');
  await page.getByRole('link', { name: 'Ochrana osobních údajů' }).click();
  const dialog = page.getByRole('dialog', { name: 'Ochrana osobních údajů' });
  await expect(dialog).toContainText('Řemeslník PRO s.r.o.');
  await expect(dialog).toContainText('info@portalremeslnika.cz');
  await expect(dialog).toContainText('Úřad pro ochranu osobních údajů');
  await expectNoOverflow(page);
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  expect(page.url()).not.toContain('#');
  // z registrace
  await page.getByRole('button', { name: 'Založit účet zdarma' }).first().click();
  await page.getByRole('link', { name: 'zásady ochrany osobních údajů' }).click();
  await expect(dialog).toBeVisible();
  // přímý odkaz
  await page.goto('/#ochrana-osobnich-udaju');
  await expect(dialog).toBeVisible();
  expect(errors).toEqual([]);
});
