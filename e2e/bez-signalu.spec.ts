import { test, expect } from './support/fixtures';
import { SUPABASE } from './support/mock';

// Práce bez signálu: aplikace se po prvním načtení otevře z mezipaměti service workeru
test.describe('bez signálu', () => {
  test.skip(({ browserName }) => browserName !== 'chromium');

  test('aplikace se otevře bez signálu i s vypršelým přihlášením a změny odešle po návratu signálu', async ({ app, context, backend }, testInfo) => {
    test.skip(testInfo.project.name !== 'pocitac', 'stačí jedno zařízení');
    test.slow();
    await app.evaluate(async () => {
      await navigator.serviceWorker.ready;
      for (let i = 0; i < 40; i++) {
        const keys = await caches.keys();
        const name = keys.find((k) => k.startsWith('remeslnik-app-'));
        if (name && (await (await caches.open(name)).keys()).length > 20) return;
        await new Promise((r) => setTimeout(r, 250));
      }
    });
    // Bez signálu a s vypršelým přístupovým klíčem
    await context.unroute(`${SUPABASE}/**`);
    await context.route(`${SUPABASE}/**`, (r) => r.abort('internetdisconnected'));
    await context.setOffline(true);
    await app.evaluate(() => {
      const key = Object.keys(localStorage).find((k) => k.startsWith('sb-') && k.endsWith('-auth-token'))!;
      const session = JSON.parse(localStorage.getItem(key)!);
      session.expires_at = Math.floor(Date.now() / 1000) - 600;
      localStorage.setItem(key, JSON.stringify(session));
    });
    await app.reload({ waitUntil: 'domcontentloaded' });
    await expect(app.getByRole('heading', { name: 'Rozpracované zakázky' })).toBeVisible();
    await expect(app.locator('#auth-email')).toHaveCount(0);
    await expect(app.getByRole('status').filter({ hasText: 'Jste bez signálu' })).toBeVisible();

    // Změna bez signálu
    await app.getByRole('button', { name: /Zateplení fasády/ }).first().click();
    await app.getByRole('button', { name: 'Adresa stavby' }).click();
    await app.locator('#nahled-adresa-stavby').fill('Bez signálu 1, Beroun');
    await app.getByRole('dialog').getByRole('button', { name: 'Uložit' }).click();
    expect(JSON.stringify(backend.rows.get('contracts/contract_6') ?? {})).not.toContain('Bez signálu 1');

    // Návrat signálu: změna se odešle (Supabase po neúspěšné obnově klíče až minutu čeká)
    await context.unroute(`${SUPABASE}/**`);
    const fresh = await import('./support/mock').then((m) => m.mockBackend(context));
    await context.setOffline(false);
    await app.evaluate(() => window.dispatchEvent(new Event('online')));
    await expect
      .poll(() => JSON.stringify(fresh.rows.get('contracts/contract_6') ?? {}), { timeout: 120_000, intervals: [1000] })
      .toContain('Bez signálu 1');
  });
});
