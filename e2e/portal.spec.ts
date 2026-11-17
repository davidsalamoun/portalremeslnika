import { test as base, expect } from '@playwright/test';
import { collectErrors, mockBackend, expectNoOverflow } from './support/mock';

// Portál online podpisu (?sign=…): otevírá ho zákazník bez přihlášení
const contract = {
  id: 'c1', docKind: 'contract', contractNumber: 'SML-2026-001', workDescription: 'Rekonstrukce koupelny včetně obkladů a dlažeb',
  price: 27520, hasVat: false, advanceAmount: 8000, deliveryDate: '2026-12-06', conclusionDate: '2026-11-06', executionPlace: 'Praze',
  siteAddress: 'Na Výsluní 12, 251 01 Říčany', shareVersion: 2, amendments: [],
  items: [{ id: 'i1', type: 'prace', title: 'Pokládka obkladu', quantity: 24, unit: 'm²', unitPrice: 720, totalPrice: 17280 }],
  contractor: { name: 'Jan Novák – obklady a rekonstrukce', ico: '12345678', address: 'Květinová 124/8, 140 00 Praha 4', phone: '+420 777 123 456', email: 'jan@example.cz', bankAccount: '19-2000145399/0800' },
  client: { name: 'Marek Dvořák', address: 'Slunečná 45, 252 28 Černošice', phone: '+420 608 987 654' },
};

base('zákazník si přečte smlouvu a podepíše ji', async ({ page, context }) => {
  const errors = collectErrors(page);
  const backend = await mockBackend(context, { signShare: { status: 'pending', contract } });
  await page.goto('/?sign=abc123def456abc123def456abc123de');
  await expect(page.getByRole('heading', { level: 1, name: 'Smlouva o dílo' })).toBeVisible();
  await page.getByRole('button', { name: 'Přečíst' }).click();
  await expect(page.getByRole('dialog')).toContainText('Místem provedení díla je Na Výsluní 12');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Podepsat smlouvu' }).click();
  await expect(page.getByRole('alert')).toContainText('podepište');
  const box = (await page.locator('canvas').boundingBox())!;
  await page.mouse.move(box.x + 40, box.y + 60);
  await page.mouse.down();
  for (let i = 0; i < 10; i++) await page.mouse.move(box.x + 40 + i * 20, box.y + 60 + (i % 2 ? 30 : -20));
  await page.mouse.up();
  await page.getByRole('button', { name: 'Podepsat smlouvu' }).click();
  await expect(page.getByRole('heading', { name: 'Podepsáno' })).toBeVisible();
  expect(backend.submitted[0]?.p_signer_name).toBe('Marek Dvořák');
  expect(String(backend.submitted[0]?.p_signature)).toMatch(/^data:image\/png;base64,/);
  await expectNoOverflow(page);
  expect(errors).toEqual([]);
});

base('neplatný odkaz', async ({ page, context }) => {
  await mockBackend(context, { signShare: null });
  await page.goto('/?sign=neexistujici0000000000000000000000');
  await expect(page.getByRole('heading', { name: 'Odkaz nejde otevřít' })).toBeVisible();
});
