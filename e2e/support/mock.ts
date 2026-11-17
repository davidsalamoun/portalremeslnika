import { BrowserContext, Page, Route, test as base, expect } from '@playwright/test';

/**
 * Napodobený Supabase (přihlášení, zápisy do tabulek, úložiště obrázků, funkce pro online podpis), ARES a počasí.
 * Zápisy z aplikace se ukládají do `rows`, aby test mohl ověřit, co by odešlo do účtu.
 */
export const SUPABASE = 'https://cwfpuuiomgyjeekgyibi.supabase.co';
export const USER_ID = '11111111-1111-4111-8111-111111111111';
const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };

export interface SignShareMock {
  status: 'pending' | 'signed';
  contract: unknown;
}

export async function mockBackend(ctx: BrowserContext, opts: { signShare?: SignShareMock | null } = {}) {
  const rows = new Map<string, Record<string, unknown>>();
  const submitted: Record<string, unknown>[] = [];
  const json = (route: Route, body: unknown, status = 200) =>
    route.fulfill({ status, headers: { ...cors, 'content-type': 'application/json' }, body: JSON.stringify(body) });

  await ctx.route(`${SUPABASE}/**`, async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    if (url.pathname === '/auth/v1/token') {
      const exp = Math.floor(Date.now() / 1000) + 3600;
      return json(route, {
        access_token: `${b64({ alg: 'HS256' })}.${b64({ sub: USER_ID, exp, role: 'authenticated' })}.s`,
        token_type: 'bearer',
        expires_in: 3600,
        expires_at: exp,
        refresh_token: 'r',
        user: { id: USER_ID, aud: 'authenticated', role: 'authenticated', email: 'jan@example.cz', identities: [{}], app_metadata: {}, user_metadata: {} },
      });
    }
    if (url.pathname.startsWith('/storage/')) return json(route, { Key: 'x' });
    if (url.pathname === '/rest/v1/rpc/get_sign_share') return json(route, opts.signShare ?? null);
    if (url.pathname === '/rest/v1/rpc/submit_sign_share') {
      submitted.push(req.postDataJSON());
      return json(route, 'signed');
    }
    if (url.pathname.startsWith('/rest/v1/rpc/')) return json(route, null);
    const table = url.pathname.match(/^\/rest\/v1\/(\w+)$/)?.[1];
    if (table && req.method() === 'POST') {
      for (const r of ([] as Record<string, unknown>[]).concat(req.postDataJSON())) rows.set(`${table}/${r.id ?? r.token}`, r);
      return route.fulfill({ status: 201, headers: cors });
    }
    return json(route, []);
  });
  await ctx.route(/^https:\/\/(api|geocoding-api)\.open-meteo\.com\//, (r) => r.abort());
  await ctx.route('https://ares.gov.cz/**', (route) =>
    route.fulfill({
      status: 200,
      headers: { 'access-control-allow-origin': '*', 'content-type': 'application/json' },
      body: JSON.stringify({ ico: '12345678', obchodniJmeno: 'Jan Novák', sidlo: { textovaAdresa: 'Květinová 124/8, 14000 Praha 4', nazevObce: 'Praha' } }),
    })
  );
  return { rows, submitted };
}

/** Chyby ze stránky a z konzole (bez hlášek o nedostupné síti, které při napodobeném backendu nevadí). */
export function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  const ignore = /WebSocket|Failed to load resource|net::ERR|open-meteo|Download the React DevTools|\[vite\]|Failed to fetch|NetworkError|Service worker/i;
  page.on('pageerror', (e) => !ignore.test(e.message) && errors.push(`chyba stránky: ${e.message.split('\n')[0]}`));
  page.on('console', (m) => m.type() === 'error' && !ignore.test(m.text()) && errors.push(`konzole: ${m.text().slice(0, 200)}`));
  return errors;
}

/** Stránka nesmí být širší než okno (vodorovné posouvání na mobilu). */
export async function expectNoOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, 'stránka přetéká do šířky').toBeLessThanOrEqual(0);
}

export { base, expect };
