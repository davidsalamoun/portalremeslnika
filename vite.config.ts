import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import type { Plugin } from 'vite';
import { serviceWorkerSource } from './src/sw/serviceWorkerSource';
import {defineConfig} from 'vite';

// Adresa webu pro náhled odkazu (og:image musí být celá adresa). Na Vercelu ji dá prostředí, jinak SITE_URL;
// bez ní zůstane cesta relativní.
const siteUrl = (
  process.env.SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : '')
).replace(/\/$/, '');

// Service worker pro práci bez signálu: při buildu dostane seznam všech výsledných souborů (vlastní skripty,
// styly, ikony z public/) a verzi odvozenou z jejich obsahu.
function offlineServiceWorker(): Plugin {
  const publicDir = path.resolve(import.meta.dirname, 'public');
  const listPublic = (dir: string, prefix = ''): string[] =>
    fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
      entry.isDirectory()
        ? listPublic(path.join(dir, entry.name), `${prefix}${entry.name}/`)
        : [`${prefix}${entry.name}`]
    );
  return {
    name: 'offline-service-worker',
    apply: 'build',
    enforce: 'post',
    generateBundle(_options, bundle) {
      const hash = crypto.createHash('sha256');
      const files: string[] = [];
      for (const [fileName, item] of Object.entries(bundle)) {
        // .woff jsou jen záloha pro velmi staré prohlížeče (všechny současné načtou .woff2)
        if (fileName.endsWith('.map') || fileName.endsWith('.woff')) continue;
        files.push(fileName);
        hash.update(fileName);
        hash.update(item.type === 'chunk' ? item.code : typeof item.source === 'string' ? item.source : Buffer.from(item.source));
      }
      const publicFiles = fs.existsSync(publicDir) ? listPublic(publicDir) : [];
      for (const fileName of publicFiles) {
        files.push(fileName);
        hash.update(fileName);
        hash.update(fs.readFileSync(path.join(publicDir, fileName)));
      }
      files.sort();
      this.emitFile({
        type: 'asset',
        fileName: 'sw.js',
        source: serviceWorkerSource(hash.digest('hex').slice(0, 12), files),
      });
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'site-url',
        transformIndexHtml: (html: string) => html.replaceAll('__SITE_URL__', siteUrl),
      },
      offlineServiceWorker(),
    ],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, '.'),
      },
    },
  };
});
