import { test, expect, openTab } from './support/fixtures';

// Nová zakázka podle jiné a předvybraný klient z Klientů
test('nová zakázka podle hotové převezme popis, rozpočet a zálohu, klienta a termín ne', async ({ app }) => {
  await app.getByRole('button', { name: /Rekonstrukce koupelny/ }).first().click();
  await app.getByRole('button', { name: 'Další možnosti' }).click();
  await app.getByRole('button', { name: 'Nová zakázka podle této' }).click();

  await expect(app.getByRole('heading', { level: 1, name: 'Nová smlouva o dílo' })).toBeVisible();
  await expect(app.getByRole('status').filter({ hasText: 'Podle zakázky SML-2026-001' })).toContainText('Vyberte klienta a doplňte termín');
  await expect(app.locator('#work-desc')).toHaveValue('Rekonstrukce koupelny včetně obkladů a dlažeb');
  await expect(app.getByLabel('Název položky 2')).toHaveValue('Pokládka obkladu a dlažby');
  await expect(app.locator('#client-select')).toHaveValue('');
  await expect(app.locator('#delivery-date')).toHaveValue('');
  await expect(app.locator('#advance-input')).toHaveValue(/^8\s000$/);

  // Bez klienta to nepustí
  await app.locator('#delivery-date').fill(new Date(Date.now() + 14 * 864e5).toISOString().slice(0, 10));
  await app.locator('form').getByRole('button', { name: 'Zobrazit dokumenty' }).click();
  await expect(app.getByRole('alert').filter({ hasText: 'Vyberte klienta' })).toBeVisible();

  const value = await app.locator('#client-select option', { hasText: 'Nova Real' }).getAttribute('value');
  await app.locator('#client-select').selectOption(value!);
  await app.locator('form').getByRole('button', { name: 'Zobrazit dokumenty' }).click();
  const paper = app.locator('.contract-page').first();
  await expect(paper).toContainText('Nova Real s.r.o.');
  await expect(paper).toContainText('Rekonstrukce koupelny včetně obkladů a dlažeb');
  await expect(paper).toContainText('27 520 Kč');
  await expect(paper).toContainText('Pokládka obkladu a dlažby');
  // Nová zakázka nepřebírá podpisy ani číslo
  await expect(paper).not.toContainText('SML-2026-001');
});

test('Nová smlouva u klienta ho ve formuláři předvybere', async ({ app }) => {
  await openTab(app, 'Klienti');
  // Druhý klient v seznamu je Nova Real s.r.o.
  await expect(app.getByRole('main').getByText('Nova Real s.r.o.', { exact: true })).toBeVisible();
  await app.getByRole('main').getByRole('button', { name: 'Nová smlouva' }).nth(1).click();
  const selected = await app.locator('#client-select').evaluate((el: HTMLSelectElement) => el.options[el.selectedIndex]?.text || '');
  expect(selected).toContain('Nova Real');
  await expect(app.locator('#work-desc')).toHaveValue('');
});
