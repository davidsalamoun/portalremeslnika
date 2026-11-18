import AxeBuilder from '@axe-core/playwright';
import { Page } from '@playwright/test';
import { test, expect, openTab, openDoc } from './support/fixtures';
import { test as plain } from '@playwright/test';
import { mockBackend } from './support/mock';

// Přístupnost (WCAG 2.1 A a AA) hlavních obrazovek: axe-core v prohlížeči, na počítači, mobilu i v tmavém režimu
// Razítko (data-stamp) je napodobenina otisku, mírně natočená – axe přes otočení nedopočítá pozadí a hlásil by kontrast
// tmavomodré na černé, ačkoli razítko leží na bílém papíře. Proto se z kontroly vynechává.
async function audit(page: Page, name: string) {
  const result = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .exclude('[data-stamp]')
    .analyze();
  const lines = result.violations.map(
    (v) => `${name}: [${v.impact}] ${v.id} – ${v.help} (${v.nodes.length}×) ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`
  );
  return lines;
}

test('přístupnost obrazovek aplikace', async ({ app }) => {
  test.setTimeout(180000);
  const all: string[] = [];
  all.push(...(await audit(app, 'Přehled')));
  for (const tab of ['Kalendář', 'Zakázky', 'Faktury', 'Nová smlouva', 'Klienti', 'Archiv', 'Finance', 'Nastavení']) {
    await openTab(app, tab);
    await app.waitForTimeout(500);
    all.push(...(await audit(app, tab)));
  }
  // Okno nad obsahem
  await openTab(app, 'Klienti');
  await app.getByRole('button', { name: 'Nový klient' }).first().click();
  await app.getByRole('dialog').waitFor();
  all.push(...(await audit(app, 'Okno Nový klient')));
  await app.keyboard.press('Escape');
  await openTab(app, 'Zakázky');
  await app.getByRole('button', { name: /Rekonstrukce koupelny/ }).first().click();
  await app.locator('.contract-page').first().waitFor();
  all.push(...(await audit(app, 'Smlouva')));
  await openDoc(app, 'faktura', /^Faktura/);
  await app.waitForTimeout(500);
  all.push(...(await audit(app, 'Faktura')));
  expect(all, all.join('\n')).toEqual([]);
});

plain('přístupnost úvodní stránky a přihlášení', async ({ page, context }) => {
  await mockBackend(context);
  await page.goto('/');
  await page.waitForTimeout(800);
  const all = await audit(page, 'Úvod');
  await page.getByRole('button', { name: 'Přihlásit se' }).first().click();
  all.push(...(await audit(page, 'Přihlášení')));
  expect(all, all.join('\n')).toEqual([]);
});

test('přístupnost oken nástrojů stavby', async ({ app }) => {
  test.setTimeout(180000);
  const all: string[] = [];
  await app.getByRole('button', { name: 'Kalkulačka na obhlídce' }).first().click();
  await app.getByRole('dialog').waitFor();
  all.push(...(await audit(app, 'Kalkulačka')));
  await app.keyboard.press('Escape');
  await app.getByRole('button', { name: /Podklady pro účetní|Pro účetní/ }).first().click();
  await app.getByRole('dialog').waitFor();
  all.push(...(await audit(app, 'Podklady pro účetní')));
  await app.keyboard.press('Escape');
  // Náklady a zisk přes „Vyfotit účtenku“, pak ostatní okna z nástrojů stavby téže zakázky
  await app.getByRole('button', { name: 'Vyfotit účtenku' }).click();
  await app.getByRole('dialog', { name: 'Vyfotit účtenku' }).getByRole('button', { name: /Malování kanceláří/ }).click();
  await app.getByRole('dialog', { name: 'Náklady a zisk' }).waitFor();
  all.push(...(await audit(app, 'Okno Náklady a zisk')));
  await app.keyboard.press('Escape');
  await app.locator('#nahled-faze').waitFor();
  for (const name of ['Kniha jízd', 'Stavební deník']) {
    const menu = app.getByRole('button', { name: /Nástroje stavby/ });
    if (await menu.isVisible()) await menu.click();
    else await app.getByRole('button', { name: 'Další', exact: true }).click();
    const trigger = new RegExp(`^${name}`);
    await app.getByRole('button', { name: trigger }).or(app.getByRole('menuitem', { name: trigger })).first().click();
    const dialog = app.getByRole('dialog', { name });
    await dialog.waitFor();
    if (name === 'Stavební deník') await dialog.getByRole('button', { name: 'Zapsat den na stavbě' }).click();
    all.push(...(await audit(app, `Okno ${name}`)));
    await app.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
  }
  expect(all, all.join('\n')).toEqual([]);
});
