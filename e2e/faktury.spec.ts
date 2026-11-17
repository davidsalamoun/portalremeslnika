import { test, expect, openTab } from './support/fixtures';

// Číslování faktur: číslo vzniká až při vystavení, řada se neopakuje, vystavenou fakturu nejde smazat, jen stornovat
const year = new Date().getFullYear();
// Testovací data mají starší faktury 2026001–2026006 (vystavené ještě při založení zakázky)
const nextNumber = year === 2026 ? `${year}007` : `${year}001`;

test.describe('číslování faktur', () => {
  test('faktura bez smlouvy: návrh bez čísla, vystavení, zákaz smazání a storno', async ({ app }) => {
    await openTab(app, 'Nová smlouva');
    await app.getByRole('button', { name: 'Jen faktura', exact: true }).click();
    await expect(app.getByRole('heading', { level: 1, name: 'Nová faktura' })).toBeVisible();
    await expect(app.locator('#advance-input')).toHaveCount(0);
    await app.locator('#client-select').selectOption({ index: 1 });
    await app.locator('#work-desc').fill('Výměna baterie v koupelně');
    await app.locator('#price-input').fill('3500');
    await app.locator('#delivery-date').fill(new Date().toISOString().slice(0, 10));
    await app.locator('form').getByRole('button', { name: 'Zobrazit dokumenty' }).click();

    const paper = app.locator('.contract-page').first();
    await expect(paper).toContainText('NÁVRH FAKTURY');
    await expect(paper).toContainText('Bez čísla');
    await expect(paper).not.toContainText('Smlouvy o dílo');
    await expect(app.getByRole('link', { name: 'WhatsApp' })).toHaveCount(0);

    await app.getByRole('button', { name: 'Vystavit fakturu' }).click();
    await expect(app.getByRole('dialog')).toContainText(`FA-${nextNumber}`);
    await app.getByRole('dialog').getByRole('button', { name: 'Vystavit', exact: true }).click();
    await expect(paper).toContainText(`FA-${nextNumber}`);
    await expect(paper).not.toContainText('NÁVRH');

    // Smazat nejde
    await app.getByRole('button', { name: 'Zpět' }).first().click();
    await openTab(app, 'Archiv');
    await app.getByRole('button', { name: /^Smazat/ }).first().click();
    await expect(app.getByRole('dialog')).toContainText('Zakázku nejde smazat');
    await app.getByRole('dialog').getByRole('button', { name: 'Rozumím' }).click();

    // Storno: zmizí z pohledávek
    await app.getByRole('button', { name: /Výměna baterie|Marek Dvořák|Nova Real/ }).first().click();
    await app.getByRole('button', { name: 'Stornovat' }).click();
    await app.getByRole('dialog').getByRole('button', { name: 'Stornovat fakturu' }).click();
    await expect(app.locator('.contract-page').first()).toContainText('STORNO');
    await app.getByRole('button', { name: 'Zpět' }).first().click();
    await openTab(app, 'Faktury');
    await app.getByRole('tab', { name: /^Všechny/ }).click();
    await expect(app.getByText(`Faktura ${nextNumber}`)).toHaveCount(0);
  });

  test('nová smlouva má fakturu bez čísla, dokud ji nevystavíte', async ({ app }) => {
    await openTab(app, 'Nová smlouva');
    await app.locator('#client-select').selectOption({ index: 1 });
    await app.locator('#work-desc').fill('Oprava omítky v chodbě');
    await app.locator('#price-input').fill('12000');
    await app.locator('#delivery-date').fill(new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10));
    await app.locator('form').getByRole('button', { name: 'Zobrazit dokumenty' }).click();
    await expect(app.locator('.contract-page').first()).toContainText(`SOD-${year}-`);
    const select = app.locator('#nahled-dokument');
    if (await select.isVisible()) await select.selectOption('faktura');
    else await app.getByRole('tab', { name: /^Faktura/ }).click();
    await expect(app.locator('.contract-page').first()).toContainText('Bez čísla');
  });
});
