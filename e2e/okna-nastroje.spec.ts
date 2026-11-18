import { test, expect } from './support/fixtures';

// Okna nástrojů podle vzoru Přehledu: souhrn v rámečku, formulář s chybami u polí, potvrzení přes okno
test('náklady a zisk: přidání výdaje s kontrolou polí a smazání přes potvrzení', async ({ app }) => {
  await app.getByRole('button', { name: 'Vyfotit účtenku' }).click();
  await app.getByRole('dialog', { name: 'Vyfotit účtenku' }).getByRole('button', { name: /Malování kanceláří/ }).click();
  const dialog = app.getByRole('dialog', { name: 'Náklady a zisk' });
  await expect(dialog).toContainText('Zůstane po odečtení nákladů');

  await dialog.getByRole('button', { name: 'Uložit výdaj' }).click();
  await expect(dialog.getByRole('alert').first()).toHaveText('Napište, za co výdaj byl.');
  await expect(dialog.getByLabel('Co jste koupili')).toBeFocused();

  await dialog.getByLabel('Co jste koupili').fill('Penetrace');
  await expect(dialog.getByText('Napište, za co výdaj byl.')).toHaveCount(0);
  await dialog.getByLabel('Částka (Kč)').fill('640');
  await dialog.getByRole('button', { name: 'Doprava' }).click();
  await expect(dialog.getByRole('button', { name: 'Doprava' })).toHaveAttribute('aria-pressed', 'true');
  await dialog.getByRole('button', { name: 'Uložit výdaj' }).click();
  await expect(dialog.getByRole('listitem').filter({ hasText: 'Penetrace' })).toContainText('Doprava');

  await dialog.getByRole('button', { name: 'Smazat výdaj Penetrace' }).click();
  const confirm = app.getByRole('dialog', { name: 'Smazat výdaj?' });
  await confirm.getByRole('button', { name: 'Smazat výdaj' }).click();
  await expect(confirm).toHaveCount(0);
  await expect(dialog.getByRole('listitem').filter({ hasText: 'Penetrace' })).toHaveCount(0);
  await expect(dialog).toBeVisible();
});

async function openTool(app: import('@playwright/test').Page, name: RegExp) {
  await app.getByRole('button', { name: /Rekonstrukce koupelny/ }).first().click();
  await app.locator('#nahled-faze').waitFor();
  const menu = app.getByRole('button', { name: /Nástroje stavby/ });
  if (await menu.isVisible()) await menu.click();
  else await app.getByRole('button', { name: 'Další', exact: true }).click();
  await app.getByRole('button', { name }).or(app.getByRole('menuitem', { name })).first().click();
}

test('stavební deník: zápis bez předvyplněného počasí a lidí, popis je povinný', async ({ app }) => {
  await openTool(app, /^Stavební deník/);
  const dialog = app.getByRole('dialog', { name: 'Stavební deník' });
  await dialog.getByRole('button', { name: 'Zapsat den na stavbě' }).click();
  await expect(dialog.getByLabel('Počasí')).toHaveValue('');
  await expect(dialog.getByLabel('Pracovníků')).toHaveValue('');
  await expect(dialog.getByLabel('Hodin celkem')).toHaveValue('');
  await expect(dialog.getByRole('button', { name: /Zjistit aktuální/ })).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Uložit zápis' }).click();
  await expect(dialog.getByRole('alert')).toHaveText('Napište, co se ten den na stavbě dělalo.');
  await dialog.getByLabel('Co se dělalo').fill('Penetrace podkladu');
  await dialog.getByRole('button', { name: 'Polojasno' }).click();
  await dialog.getByRole('button', { name: 'Uložit zápis' }).click();
  await expect(dialog.getByRole('listitem').filter({ hasText: 'Penetrace podkladu' })).toContainText('Polojasno');
});

test('kniha jízd: jedna jízda s kontrolou kilometrů', async ({ app }) => {
  await openTool(app, /^Kniha jízd/);
  const dialog = app.getByRole('dialog', { name: 'Kniha jízd' });
  await expect(dialog.getByRole('tab', { name: 'Jedna jízda' })).toHaveAttribute('aria-selected', 'true');
  await dialog.getByRole('button', { name: 'Zapsat jízdu' }).click();
  await expect(dialog.getByText('Zadejte ujeté kilometry.')).toBeVisible();
  await expect(dialog.getByLabel('Ujeto km')).toBeFocused();
  await dialog.getByLabel('Ujeto km').fill('40');
  await dialog.getByLabel('Sazba (Kč/km)').fill('5');
  await dialog.getByRole('button', { name: 'Zapsat jízdu' }).click();
  await expect(dialog.getByRole('listitem').filter({ hasText: '40 km × 5 Kč' })).toContainText('200');
});

test('kalkulačka počítá z ceníku a převede rozpočet do formuláře smlouvy', async ({ app }) => {
  await app.getByRole('button', { name: 'Kalkulačka na obhlídce' }).first().click();
  const dialog = app.getByRole('dialog', { name: 'Kalkulačka na obhlídce' });
  await expect(dialog.getByRole('button', { name: 'Převést do smlouvy' })).toBeDisabled();
  await dialog.getByRole('button', { name: 'Obklady a dlažby' }).click();
  await dialog.getByRole('button', { name: 'Přidat do odhadu: Pokládka keramického obkladu / dlažby' }).click();
  await expect(dialog.getByRole('spinbutton', { name: /Pokládka keramického obkladu/ })).toBeFocused();
  await dialog.getByRole('spinbutton', { name: /Pokládka keramického obkladu/ }).fill('10');
  // 10 m² × 650 Kč z výchozího ceníku
  await expect(dialog.getByText('Orientační cena').locator('..')).toContainText(/6\s500/);
  // Výchozí ceník má ukázkové ceny – kalkulačka na to upozorní
  await expect(dialog).toContainText('1 položka má ukázkovou cenu z aplikace, ne vaši.');
  await dialog.getByRole('button', { name: 'Převést do smlouvy' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(app.getByRole('status').filter({ hasText: 'Rozpočet z kalkulačky na obhlídce.' })).toBeVisible();
  await expect(app.getByText('Pokládka keramického obkladu / dlažby').first()).toBeVisible();
});

test('podklady pro účetní: druh výdaje česky, souhrn v jednom rámečku', async ({ app }) => {
  await app.getByRole('button', { name: /Podklady pro účetní|Pro účetní/ }).first().click();
  const dialog = app.getByRole('dialog', { name: 'Podklady pro účetní' });
  await dialog.getByRole('button', { name: 'Celý rok' }).click();
  await expect(dialog.getByRole('button', { name: 'Celý rok' })).toHaveAttribute('aria-pressed', 'true');
  await expect(dialog).toContainText('Odhad zisku za rok');
  await dialog.getByRole('tab', { name: /^Výdaje/ }).click();
  await expect(dialog.getByRole('cell', { name: 'Materiál', exact: true })).toBeVisible();
  await expect(dialog).not.toContainText('material');
});

test('kalkulačka: odkaz Upravit ceník otevře ceník v nastavení', async ({ app }) => {
  await app.getByRole('button', { name: 'Kalkulačka na obhlídce' }).first().click();
  await app.getByRole('dialog', { name: 'Kalkulačka na obhlídce' }).getByRole('button', { name: 'Upravit ceník' }).first().click();
  await expect(app.getByRole('tab', { name: 'Ceník' })).toHaveAttribute('aria-selected', 'true');
});
