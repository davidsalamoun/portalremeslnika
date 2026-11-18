import { test, expect, openTab } from './support/fixtures';

// Opravy v oknech nástrojů: účtenka k zakázce, podklady bez NaN, protokol bez vymyšlených hodnot, kniha jízd jen vybrané dny
test('Vyfotit účtenku vybere zakázku a otevře její náklady', async ({ app }) => {
  await app.getByRole('button', { name: 'Vyfotit účtenku' }).click();
  const picker = app.getByRole('dialog', { name: 'Vyfotit účtenku' });
  await expect(picker).toContainText('Ke které zakázce účtenka patří?');
  await picker.getByRole('button', { name: /Malování kanceláří/ }).click();
  await expect(app.getByRole('dialog', { name: 'Náklady a zisk' })).toBeVisible();
});

test('podklady pro účetní neukazují NaN', async ({ app }) => {
  await app.getByRole('button', { name: /Podklady pro účetní|Pro účetní/ }).first().click();
  const dialog = app.getByRole('dialog', { name: 'Podklady pro účetní' });
  await dialog.getByRole('button', { name: 'Celý rok' }).click();
  await expect(dialog).toContainText('Kniha jízd');
  await expect(dialog).not.toContainText('NaN');
});

test('protokol o zkoušce nemá předvyplněné naměřené hodnoty ani výsledek', async ({ app }) => {
  await app.getByRole('button', { name: /Rekonstrukce koupelny/ }).first().click();
  await app.locator('#nahled-faze').waitFor();
  const menu = app.getByRole('button', { name: /Nástroje stavby/ });
  if (await menu.isVisible()) await menu.click();
  else {
    await app.getByRole('button', { name: 'Další', exact: true }).click();
  }
  await app.getByRole('button', { name: /^Zkoušky a protokoly/ }).or(app.getByRole('menuitem', { name: /^Zkoušky a protokoly/ })).first().click();
  const dialog = app.getByRole('dialog', { name: 'Zkoušky a protokoly' });
  await expect(dialog.getByRole('button', { name: /Tlaková zkouška vodovodu/ })).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Vyhovuje', exact: true })).toHaveAttribute('aria-pressed', 'false');
  await expect(dialog.getByRole('button', { name: 'Nevyhovuje', exact: true })).toHaveAttribute('aria-pressed', 'false');
  await expect(dialog.locator('textarea').first()).toHaveValue('');
  const numbers = dialog.locator('input[type="number"]');
  for (let i = 0; i < (await numbers.count()); i++) await expect(numbers.nth(i)).toHaveValue('');
});

test('kniha jízd: více dní najednou zapíše jen vybrané dny', async ({ app }) => {
  await app.getByRole('button', { name: /Rekonstrukce koupelny/ }).first().click();
  await app.locator('#nahled-faze').waitFor();
  const menu = app.getByRole('button', { name: /Nástroje stavby/ });
  if (await menu.isVisible()) await menu.click();
  else await app.getByRole('button', { name: 'Další', exact: true }).click();
  await app.getByRole('button', { name: /^Kniha jízd/ }).or(app.getByRole('menuitem', { name: /^Kniha jízd/ })).first().click();
  const dialog = app.getByRole('dialog', { name: 'Kniha jízd' });
  await dialog.getByRole('tab', { name: 'Více dní najednou' }).click();
  const zapsat = dialog.getByRole('button', { name: /Zapsat vybrané jízdy/ });
  await expect(zapsat).toBeDisabled();
  const days = dialog.getByRole('group', { name: 'Dny, kdy jste jeli na stavbu' }).getByRole('button');
  await days.nth(0).click();
  await days.nth(2).click();
  await expect(zapsat).toHaveText('Zapsat vybrané jízdy (2)');
});
