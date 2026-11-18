import { test, expect, openTab } from './support/fixtures';

test('hledání v zakázkách: ve všech fázích, bez diakritiky', async ({ app }) => {
  await openTab(app, 'Zakázky');
  const list = app.getByRole('region', { name: 'Seznam zakázek' });
  await app.getByLabel('Hledat zakázku').fill('dlazby terase');
  // „Výměna dlažby na terase“ je zaplacená – mezi rozpracovanými by nebyla
  await expect(list).toContainText('Výměna dlažby na terase');
  await expect(list).toContainText('hledáno ve všech fázích');
  await expect(app.getByRole('tab', { selected: true })).toHaveCount(0);
  await app.getByLabel('Hledat zakázku').fill('neexistujici zakazka');
  await expect(list).toContainText('Žádná zakázka neodpovídá');
  await list.getByRole('button', { name: 'Zrušit hledání' }).click();
  await expect(app.getByRole('tab', { name: /^Rozpracované/ })).toHaveAttribute('aria-selected', 'true');
});

test('hledání v klientech bez diakritiky', async ({ app }) => {
  await openTab(app, 'Klienti');
  await app.getByLabel('Hledat klienta').fill('dvorak');
  await expect(app.getByText('Marek Dvořák').first()).toBeVisible();
  await expect(app.getByText('Nova Real s.r.o.')).toHaveCount(0);
});
