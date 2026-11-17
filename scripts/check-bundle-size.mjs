// Hlídá velikost úvodního balíku: JS a CSS, které prohlížeč stáhne hned při otevření aplikace (podle dist/index.html).
// Ostatní stránky se načítají odloženě (React.lazy) a do rozpočtu se nepočítají. Velikosti jsou po kompresi gzip,
// tak jak je posílá server. Spouští se po `npm run build` (npm run size, v CI po buildu).
import { readFileSync, statSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { join } from 'node:path';

// Rozpočet v kB (gzip). Při zvětšení nad limit raději přesunout kód do odložených částí, než limit zvednout.
const BUDGET_KB = { js: 190, css: 20 };

const dist = new URL('../dist/', import.meta.url).pathname;
const html = readFileSync(join(dist, 'index.html'), 'utf8');
const files = [...html.matchAll(/(?:src|href)="\/(assets\/[^"]+\.(js|css))"/g)].map((m) => ({ path: m[1], kind: m[2] }));
if (!files.length) {
  console.error('V dist/index.html nejsou žádné soubory – spusťte nejdřív npm run build.');
  process.exit(1);
}

const totals = { js: 0, css: 0 };
for (const f of files) {
  const raw = readFileSync(join(dist, f.path));
  const gz = gzipSync(raw, { level: 9 }).length;
  totals[f.kind] += gz;
  console.log(`${(gz / 1024).toFixed(1).padStart(7)} kB  ${f.path} (${(statSync(join(dist, f.path)).size / 1024).toFixed(0)} kB bez komprese)`);
}

let failed = false;
for (const kind of ['js', 'css']) {
  const kb = totals[kind] / 1024;
  const ok = kb <= BUDGET_KB[kind];
  if (!ok) failed = true;
  console.log(`${ok ? 'OK ' : 'PŘES'} úvodní ${kind.toUpperCase()}: ${kb.toFixed(1)} kB z ${BUDGET_KB[kind]} kB (gzip)`);
}
if (failed) {
  console.error('Úvodní balík je větší než rozpočet. Přesuňte novou stránku nebo knihovnu do odloženého načítání (lazyLoaders v App.tsx).');
  process.exit(1);
}
