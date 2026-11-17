import { test as plain, expect } from '@playwright/test';
import { collectErrors, mockBackend } from './support/mock';
import { test } from './support/fixtures';
import { TERMS_VERSION } from '../src/config/operator';

// Podmínky používání: odkaz z úvodní stránky, povinný souhlas při registraci, pruh pro starší účty

plain('registrace bez souhlasu s podmínkami nejde, souhlas se uloží k účtu', async ({ page, context }) => {
  const errors = collectErrors(page);
  const backend = await mockBackend(context);
  await page.goto('/');

  // Podmínky z patičky úvodní stránky
  await page.getByRole('link', { name: 'Podmínky používání' }).click();
  const dialog = page.getByRole('dialog', { name: 'Podmínky používání' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('Řemeslník PRO s.r.o.').first()).toBeVisible();
  await expect(dialog.getByRole('heading', { name: /Zpracování osobních údajů zákazníků/ })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();

  await page.getByRole('button', { name: 'Založit účet zdarma' }).first().click();
  await page.fill('#auth-email', 'novy@example.cz');
  await page.fill('#auth-password', 'tajneheslo1');
  await page.fill('#auth-password-again', 'tajneheslo1');
  await page.getByRole('button', { name: 'Vytvořit účet' }).click();
  await expect(page.getByRole('alert')).toHaveText('Bez souhlasu s podmínkami používání nelze účet založit.');
  await expect(page.locator('#auth-terms')).toBeFocused();
  expect(backend.signups).toHaveLength(0);

  // Odkaz u zaškrtávacího pole otevře podmínky a pole nezaškrtne
  await page.locator('label[for="auth-terms"]').getByRole('link', { name: 'podmínkami používání' }).click();
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#auth-terms')).not.toBeChecked();

  await page.locator('#auth-terms').check();
  await expect(page.getByRole('alert')).toBeHidden();
  await page.getByRole('button', { name: 'Vytvořit účet' }).click();
  await expect(page.getByRole('heading', { name: 'Potvrďte svůj e-mail' })).toBeVisible();
  expect(backend.signups).toHaveLength(1);
  expect(backend.signups[0].data.terms_version).toBe(TERMS_VERSION);
  expect(typeof backend.signups[0].data.terms_accepted_at).toBe('string');
  expect(errors).toEqual([]);
});

test.describe('účet z doby před podmínkami', () => {
  test.use({ acceptedTerms: false });

  test('po přihlášení potvrdí podmínky v pruhu nad aplikací', async ({ app, backend }) => {
    const banner = app.getByText('Vydali jsme podmínky používání aplikace.');
    await expect(banner).toBeVisible();
    await app.getByRole('link', { name: 'Přečíst' }).click();
    await expect(app.getByRole('dialog', { name: 'Podmínky používání' })).toBeVisible();
    await app.keyboard.press('Escape');
    await app.getByRole('button', { name: 'Souhlasím' }).click();
    await expect(banner).toBeHidden();
    expect(backend.userUpdates).toHaveLength(1);
    expect(backend.userUpdates[0].data.terms_version).toBe(TERMS_VERSION);
  });
});

test('kdo podmínky potvrdil, pruh nevidí', async ({ app }) => {
  await expect(app.getByRole('heading', { name: 'Rozpracované zakázky' })).toBeVisible();
  await expect(app.getByRole('button', { name: 'Souhlasím' })).toHaveCount(0);
});
