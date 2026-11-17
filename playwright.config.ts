import { defineConfig, devices } from '@playwright/test';

// Automatické průchody aplikací (e2e/). Supabase, ARES i počasí jsou napodobené (e2e/support/mock.ts),
// takže testy nepotřebují účet, síť ani tajné klíče. Běží proti produkčnímu buildu (kvůli práci bez signálu).
const PORT = Number(process.env.E2E_PORT || 4173);

export default defineConfig({
  testDir: 'e2e',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: true,
  workers: process.env.CI ? 2 : undefined,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: process.env.CI ? 'retain-on-failure' : 'off',
    locale: 'cs-CZ',
    timezoneId: 'Europe/Prague',
  },
  projects: [
    { name: 'pocitac', use: { viewport: { width: 1440, height: 1000 } } },
    { name: 'mobil', use: { ...devices['Pixel 7'] } },
    { name: 'tmavy', use: { viewport: { width: 1440, height: 1000 }, colorScheme: 'dark' } },
  ],
  webServer: {
    command: `npm run build && NODE_ENV=production PORT=${PORT} npx tsx server.ts`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
