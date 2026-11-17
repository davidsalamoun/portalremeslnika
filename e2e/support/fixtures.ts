import { Page } from '@playwright/test';
import { base, collectErrors, mockBackend } from './mock';
import { seedData } from './seed';

type Seed = 'full' | 'empty' | 'vatPayer';

/**
 * `app`: přihlášená aplikace s testovacími daty na přehledu. `errors`: chyby ze stránky a konzole, které test
 * na konci zkontroluje (každý test končí bez chyb). `backend.rows`: co aplikace odeslala do účtu.
 */
export const test = base.extend<{
  seed: Seed;
  backend: Awaited<ReturnType<typeof mockBackend>>;
  errors: string[];
  app: Page;
}>({
  seed: ['full', { option: true }],
  backend: async ({ context }, use) => {
    await use(await mockBackend(context));
  },
  errors: async ({ page }, use) => {
    const errors = collectErrors(page);
    await use(errors);
    base.expect(errors, 'chyby v konzoli nebo na stránce').toEqual([]);
  },
  app: async ({ page, context, backend, errors, seed }, use) => {
    void backend;
    void errors;
    // Podpis a fotka jako skutečné obrázky (data URL), aby prošly i cestou přes úložiště obrázků
    const [sig, photo] = await page.evaluate(() => {
      const mk = (w: number, h: number, type: string) => {
        const c = document.createElement('canvas');
        c.width = w;
        c.height = h;
        const x = c.getContext('2d')!;
        x.fillStyle = type === 'image/png' ? 'rgba(0,0,0,0)' : '#ddd';
        x.fillRect(0, 0, w, h);
        x.strokeStyle = '#1E3A78';
        x.lineWidth = 3;
        x.beginPath();
        for (let i = 0; i < 40; i++) x.lineTo((i * 37) % w, (i * 53) % h);
        x.stroke();
        return c.toDataURL(type, 0.8);
      };
      return [mk(300, 120, 'image/png'), mk(640, 480, 'image/jpeg')];
    });
    const data = seed === 'empty' ? null : seedData(sig, photo, { vatPayer: seed === 'vatPayer' });
    await context.addInitScript((d) => {
      if (localStorage.getItem('__e2e_seeded')) return;
      localStorage.setItem('__e2e_seeded', '1');
      if (!d) return;
      localStorage.setItem('zhotovitel', JSON.stringify(d.contractor));
      localStorage.setItem('klienti', JSON.stringify(d.clients));
      localStorage.setItem('smlouvy', JSON.stringify(d.contracts));
      localStorage.setItem('remeslnik_kalendar', JSON.stringify(d.events));
    }, data);
    await page.goto('/');
    await page.fill('#auth-email', 'jan@example.cz');
    await page.fill('#auth-password', 'tajneheslo1');
    await page.getByRole('button', { name: 'Přihlásit se' }).click();
    await page.getByRole('heading', { name: seed === 'empty' ? 'Začínáme' : 'Rozpracované zakázky' }).waitFor();
    await use(page);
  },
});

export const expect = base.expect;

/** Přechod na záložku aplikace (boční nabídka na počítači, spodní lišta nebo „Více“ na mobilu). */
export async function openTab(page: Page, label: string) {
  // Boční nabídka (na stránce může být i jiný <aside>, např. souhrn formuláře)
  const aside = page.locator('aside').filter({ has: page.getByRole('button', { name: /^Přehled/ }) });
  if (await aside.isVisible()) {
    await aside.getByRole('button', { name: new RegExp('^' + label) }).click();
    return;
  }
  // Na mobilu je „Nová smlouva“ prostřední tlačítko „+ Smlouva“ ve spodní liště
  const name = label === 'Nová smlouva' ? /Smlouva/ : new RegExp(label);
  const direct = page.locator('nav').last().getByRole('button', { name });
  if (await direct.count()) await direct.first().click();
  else {
    await page.getByRole('button', { name: /Více/ }).last().click();
    await page.getByRole('dialog').getByRole('button', { name: new RegExp(label) }).click();
  }
}

/** Otevře dokument v náhledu zakázky (na počítači záložkou, na mobilu výběrem). */
export async function openDoc(page: Page, value: string, tab: RegExp) {
  await page.locator('#nahled-dokument:visible, [role="tab"]:visible').first().waitFor();
  const select = page.locator('#nahled-dokument');
  if (await select.isVisible()) await select.selectOption(value);
  else await page.getByRole('tab', { name: tab }).click();
}
